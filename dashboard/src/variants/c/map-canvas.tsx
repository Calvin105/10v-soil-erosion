import { useEffect, useMemo, useRef, type CSSProperties } from "react"
import L from "leaflet"
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Rectangle,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet"
import { useNavigate } from "react-router"

import { useNetwork } from "@/data/network-sim"
import { useRig } from "@/data/rig-sim"
import { alerts, gateways, manholes, riskCells, surfaceReports, township, zones } from "@/data/seed"
import type { NodeState } from "@/data/types"
import {
  BENCH,
  DRAIN_LINE,
  NETWORK_POINTS,
  RISK_STEP,
  RSSI_STATE,
  STATE_HEX,
  cellRisk,
  riskBand,
  rssiQuality,
  type Mode,
} from "./lib"
import { cstore, useC } from "./store"

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const gwById = Object.fromEntries(gateways.map((g) => [g.id, g]))
const mhById = Object.fromEntries(manholes.map((m) => [m.id, m]))

// ---------- divIcon factory (cached so Leaflet does not re-create DOM) ----------

const iconCache = new Map<string, L.DivIcon>()
function cachedIcon(key: string, make: () => L.DivIcon) {
  let i = iconCache.get(key)
  if (!i) {
    i = make()
    iconCache.set(key, i)
  }
  return i
}

const SVG_ACTIVITY =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>'
const SVG_TOWER =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9"/><path d="M7.8 4.7a6.14 6.14 0 0 0-.8 7.5"/><circle cx="12" cy="9" r="2"/><path d="M16.2 4.8c2 2 2.26 5.11.8 7.47"/><path d="M19.1 1.9a9.96 9.96 0 0 1 0 14.1"/><path d="M9.5 18h5"/><path d="m8 22 4-11 4 11"/></svg>'

function benchIcon(state: NodeState) {
  return cachedIcon(`bench-${state}`, () =>
    L.divIcon({
      className: "vc-icon",
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      html: `<div class="vc-bench" style="--vc-c:${STATE_HEX[state]}"><span class="vc-pulse"></span><div class="vc-bench-core">${SVG_ACTIVITY}</div></div>`,
    })
  )
}

function gatewayIcon() {
  return cachedIcon("gw", () =>
    L.divIcon({
      className: "vc-icon",
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      html: `<div class="vc-gw">${SVG_TOWER}</div>`,
    })
  )
}

function ringIcon(color: string, kind: "ping" | "pulse", size = 18) {
  return cachedIcon(`${kind}-${color}-${size}`, () =>
    L.divIcon({
      className: "vc-icon",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<div style="position:relative;width:${size}px;height:${size}px;--vc-c:${color}"><span class="vc-${kind}"></span></div>`,
    })
  )
}

function pinIcon(color: string, label: string, selected: boolean) {
  return cachedIcon(`pin-${color}-${label}-${selected}`, () =>
    L.divIcon({
      className: "vc-icon",
      iconSize: [34, 42],
      iconAnchor: [17, 40],
      html: `<div class="vc-pin" data-selected="${selected}" style="--vc-c:${color}"><div class="vc-pin-head"></div><div class="vc-pin-label">${label}</div></div>`,
    })
  )
}

function reportIcon() {
  return cachedIcon("report", () =>
    L.divIcon({
      className: "vc-icon",
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      html: `<div class="vc-report"><div class="vc-report-shape"></div></div>`,
    })
  )
}

function labelIcon(text: string) {
  return cachedIcon(`label-${text}`, () =>
    L.divIcon({
      className: "vc-icon",
      iconSize: [160, 14],
      iconAnchor: [80, 7],
      html: `<div class="vc-zone-label" style="text-align:center">${text}</div>`,
    })
  )
}

// ---------- view controller ----------

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
  /** width of an open side sheet (moves the zoom control) */
  sheet?: number
}

function boundsFor(mode: Mode): L.LatLngBounds {
  if (mode === "risk") {
    const lats = riskCells.map((c) => c.lat)
    const lons = riskCells.map((c) => c.lon)
    return L.latLngBounds(
      [Math.min(...lats) - RISK_STEP / 2, Math.min(...lons) - RISK_STEP / 2],
      [Math.max(...lats) + RISK_STEP / 2, Math.max(...lons) + RISK_STEP / 2]
    )
  }
  if (mode === "alerts") {
    const pts: [number, number][] = [
      ...alerts.map((a) => [mhById[a.manholeId].lat, mhById[a.manholeId].lon] as [number, number]),
      ...surfaceReports.map((r) => [r.lat, r.lon] as [number, number]),
    ]
    return L.latLngBounds(pts)
  }
  if (mode === "prototype") return L.latLngBounds([...NETWORK_POINTS, BENCH])
  return L.latLngBounds(NETWORK_POINTS)
}

function ViewController({
  mode,
  focus,
  insets,
}: {
  mode: Mode
  focus: [number, number][] | null
  insets: Insets
}) {
  const map = useMap()
  const first = useRef(true)
  const fKey = focus && focus.length ? focus.map((p) => p.join(",")).join(";") : ""

  useEffect(() => {
    const animate = !first.current
    first.current = false
    const size = map.getSize()
    // keep at least 260 px of free canvas
    const shrink = (a: number, b: number, total: number) => {
      const free = total - a - b
      if (free >= 260) return [a, b]
      const k = Math.max(0, (total - 260) / Math.max(1, a + b))
      return [a * k, b * k]
    }
    const [l, r] = shrink(insets.left, insets.right, size.x)
    const [t, b] = shrink(insets.top, insets.bottom, size.y)
    const opts: L.FitBoundsOptions = {
      paddingTopLeft: [l, t],
      paddingBottomRight: [r, b],
      animate,
      duration: 0.7,
    }
    if (fKey) {
      const pts = fKey.split(";").map((p) => p.split(",").map(Number) as [number, number])
      const bb = L.latLng(pts[0]).toBounds(260)
      pts.slice(1).forEach((p) => bb.extend(p))
      map.flyToBounds(bb.pad(0.12), { ...opts, maxZoom: 17 })
    } else {
      map.flyToBounds(boundsFor(mode), { ...opts, maxZoom: 16 })
    }
  }, [map, mode, fKey, insets.left, insets.right, insets.top, insets.bottom])

  return null
}

// ---------- shared context layer ----------

function ContextLayer({ dim }: { dim?: boolean }) {
  const zoneLabels = useMemo(
    () =>
      zones.map((z) => {
        const ms = manholes.filter((m) => m.zoneId === z.id)
        const lat = ms.reduce((a, m) => a + m.lat, 0) / ms.length
        const lon = ms.reduce((a, m) => a + m.lon, 0) / ms.length
        return { id: z.id, name: z.name, pos: [lat + 0.0019, lon] as [number, number] }
      }),
    []
  )
  return (
    <>
      <Polyline
        positions={DRAIN_LINE}
        interactive={false}
        pathOptions={{ className: "vc-drain", weight: dim ? 3 : 5, lineCap: "round", lineJoin: "round" }}
      />
      {zoneLabels.map((z) => (
        <Marker key={z.id} position={z.pos} icon={labelIcon(z.name)} interactive={false} keyboard={false} />
      ))}
    </>
  )
}

// ---------- prototype ----------

function PrototypeLayer() {
  const rig = useRig()
  const navigate = useNavigate()
  return (
    <>
      {manholes.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lon]}
          radius={4.5}
          pathOptions={{ className: "vc-ghost", weight: 1.5, dashArray: "2 2" }}
        >
          <Tooltip className="vc-tip" direction="top" offset={[0, -6]}>
            <span className="font-mono">{m.id}</span> concept node, simulated and not built
          </Tooltip>
        </CircleMarker>
      ))}
      <Marker
        position={BENCH}
        icon={benchIcon(rig.state)}
        zIndexOffset={1000}
        eventHandlers={{ click: () => navigate("/c/prototype/lab") }}
      >
        <Tooltip permanent direction="top" offset={[0, -24]} className="vc-tip" interactive={false}>
          <div className="flex items-center gap-2 py-0.5">
            <span className="relative flex size-2">
              <span
                className={`absolute inline-flex size-full rounded-full opacity-60 ${rig.connected ? "animate-ping bg-emerald-500" : "bg-amber-500"}`}
              />
              <span
                className={`relative inline-flex size-2 rounded-full ${rig.connected ? "bg-emerald-500" : "bg-amber-500"}`}
              />
            </span>
            <span className="font-medium">Test bench (LIVE)</span>
            <span className="font-mono tabular-nums text-muted-foreground">VRI</span>
            <span className="font-mono font-semibold tabular-nums" style={{ color: STATE_HEX[rig.state] }}>
              {rig.vri}
            </span>
          </div>
        </Tooltip>
      </Marker>
    </>
  )
}

// ---------- network (concept) ----------

function NetworkLayer({ selected }: { selected: string | null }) {
  const net = useNetwork()
  const navigate = useNavigate()
  const latest = net.uplinks[0]
  const latestNode = latest ? mhById[latest.manholeId] : null
  const latestGw = latest ? gwById[latest.gatewayId] : null

  return (
    <>
      {net.nodes.map((m) => {
        const gw = gwById[m.gatewayId]
        const q = rssiQuality(m.rssi)
        return (
          <Polyline
            key={`l-${m.id}`}
            positions={[
              [m.lat, m.lon],
              [gw.lat, gw.lon],
            ]}
            interactive={false}
            pathOptions={{
              color: STATE_HEX[RSSI_STATE[q]],
              weight: selected === m.id ? 3.5 : 2,
              opacity: selected && selected !== m.id ? 0.3 : 0.8,
              dashArray: q === "poor" ? "2 7" : q === "fair" ? "8 5" : undefined,
              lineCap: "round",
            }}
          />
        )
      })}
      {latest && latestNode && latestGw && (
        <Polyline
          key={`flash-${latest.id}`}
          positions={[
            [latestNode.lat, latestNode.lon],
            [latestGw.lat, latestGw.lon],
          ]}
          interactive={false}
          pathOptions={{ className: "vc-link-flash", weight: 3.5 }}
        />
      )}
      {gateways.map((g) => (
        <Marker key={g.id} position={[g.lat, g.lon]} icon={gatewayIcon()} zIndexOffset={500}>
          <Tooltip permanent direction="right" offset={[16, 0]} className="vc-tip vc-tip-mini">
            {g.id} {g.backhaul}
          </Tooltip>
        </Marker>
      ))}
      {net.nodes.map((m) => (
        <NodeDot
          key={m.id}
          lat={m.lat}
          lon={m.lon}
          state={m.state}
          wet={m.wet}
          label={m.id}
          selected={selected === m.id}
          onClick={() => navigate(`/c/network/${m.id}`)}
        />
      ))}
      {latest && latestNode && (
        <Marker
          key={`ping-${latest.id}`}
          position={[latestNode.lat, latestNode.lon]}
          icon={ringIcon(STATE_HEX[latestNode.state], "ping", 22)}
          interactive={false}
          keyboard={false}
          zIndexOffset={-100}
        />
      )}
    </>
  )
}

function NodeDot({
  lat,
  lon,
  state,
  wet,
  label,
  selected,
  onClick,
  showLabel = true,
}: {
  lat: number
  lon: number
  state: NodeState
  wet: boolean
  label: string
  selected: boolean
  onClick?: () => void
  showLabel?: boolean
}) {
  return (
    <>
      {state === "RED" && (
        <Marker
          position={[lat, lon]}
          icon={ringIcon(STATE_HEX.RED, "pulse", 18)}
          interactive={false}
          keyboard={false}
          zIndexOffset={-200}
        />
      )}
      {wet && (
        <CircleMarker
          center={[lat, lon]}
          radius={13}
          interactive={false}
          pathOptions={{ className: "vc-wet-ring", weight: 1.5, dashArray: "3 3" }}
        />
      )}
      {selected && (
        <CircleMarker
          center={[lat, lon]}
          radius={17}
          interactive={false}
          pathOptions={{ className: "vc-select-ring", weight: 2.5 }}
        />
      )}
      <CircleMarker
        center={[lat, lon]}
        radius={selected ? 10 : 8}
        eventHandlers={onClick ? { click: onClick } : undefined}
        pathOptions={{
          fillColor: STATE_HEX[state],
          fillOpacity: 1,
          color: "#ffffff",
          weight: 2.5,
        }}
      >
        {showLabel && (
          <Tooltip permanent direction="right" offset={[10, 0]} className="vc-tip vc-tip-mini">
            {label}
            {wet ? " WET" : ""}
          </Tooltip>
        )}
      </CircleMarker>
    </>
  )
}

// ---------- risk (S3 mock) ----------

function RiskLayer() {
  const layerIds = useC((s) => s.riskLayers)
  const selectedCell = useC((s) => s.selectedCell)
  const set = useMemo(() => new Set(layerIds), [layerIds])
  const h = RISK_STEP / 2
  const sel = selectedCell ? riskCells.find((c) => c.id === selectedCell) : null
  return (
    <>
      {riskCells.map((c) => {
        const r = cellRisk(c, set).risk
        const b = riskBand(r)
        return (
          <Rectangle
            key={c.id}
            bounds={[
              [c.lat - h, c.lon - h],
              [c.lat + h, c.lon + h],
            ]}
            eventHandlers={{ click: () => cstore.selectCell(c.id) }}
            pathOptions={{
              fillColor: b.color,
              fillOpacity: 0.28 + r * 0.45,
              color: b.color,
              opacity: 0.5,
              weight: 0.6,
            }}
          />
        )
      })}
      {sel && (
        <Rectangle
          key={`sel-${sel.id}`}
          bounds={[
            [sel.lat - h, sel.lon - h],
            [sel.lat + h, sel.lon + h],
          ]}
          interactive={false}
          pathOptions={{ className: "vc-select-ring", weight: 3 }}
        />
      )}
      {manholes.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lon]}
          radius={4}
          interactive={false}
          pathOptions={{ className: "vc-ghost", weight: 2 }}
        />
      ))}
    </>
  )
}

// ---------- alerts ----------

function AlertsLayer({ selected }: { selected: string | null }) {
  const statuses = useC((s) => s.alertStatus)
  const navigate = useNavigate()
  const selectedAlert = alerts.find((a) => a.id === selected)
  const selectedReport = surfaceReports.find((r) => r.id === selected)
  return (
    <>
      {manholes.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lon]}
          radius={4}
          pathOptions={{ className: "vc-ghost", weight: 1.5 }}
        >
          <Tooltip className="vc-tip" direction="top" offset={[0, -6]}>
            <span className="font-mono">{m.id}</span> {m.name}
          </Tooltip>
        </CircleMarker>
      ))}
      {surfaceReports.map((r) => {
        const mh = r.nearManholeId ? mhById[r.nearManholeId] : null
        const hot =
          selectedReport?.id === r.id ||
          (selectedAlert && selectedAlert.linkedReports.includes(r.id))
        return mh ? (
          <Polyline
            key={`rl-${r.id}`}
            positions={[
              [r.lat, r.lon],
              [mh.lat, mh.lon],
            ]}
            interactive={false}
            pathOptions={{ className: "vc-report-link", weight: hot ? 2.5 : 1.5, dashArray: "3 5" }}
          />
        ) : null
      })}
      {surfaceReports.map((r) => (
        <Marker
          key={r.id}
          position={[r.lat, r.lon]}
          icon={reportIcon()}
          eventHandlers={{ click: () => navigate(`/c/alerts/${r.id}`) }}
        >
          <Tooltip className="vc-tip" direction="top" offset={[0, -8]}>
            <span className="font-mono">{r.id}</span> {r.category}
          </Tooltip>
        </Marker>
      ))}
      {[...alerts]
        .sort((a, b) => (statuses[a.id] === "Closed" ? -1 : 0) - (statuses[b.id] === "Closed" ? -1 : 0))
        .map((a) => {
          const m = mhById[a.manholeId]
          const closed = statuses[a.id] === "Closed"
          const color = closed ? "#71717a" : STATE_HEX[a.state]
          const isSel = selected === a.id
          return (
            <Marker
              key={a.id}
              position={[m.lat, m.lon]}
              icon={pinIcon(color, a.priority, isSel)}
              zIndexOffset={isSel ? 2000 : closed ? 0 : 800}
              eventHandlers={{ click: () => navigate(`/c/alerts/${a.id}`) }}
            >
              <Tooltip className="vc-tip" direction="top" offset={[0, -40]}>
                <span className="font-mono">{a.id}</span> {statuses[a.id]} at {m.name}
              </Tooltip>
            </Marker>
          )
        })}
      {alerts
        .filter((a) => a.state === "RED" && statuses[a.id] !== "Closed")
        .map((a) => {
          const m = mhById[a.manholeId]
          return (
            <Marker
              key={`pulse-${a.id}`}
              position={[m.lat, m.lon]}
              icon={ringIcon(STATE_HEX.RED, "pulse", 22)}
              interactive={false}
              keyboard={false}
              zIndexOffset={-500}
            />
          )
        })}
    </>
  )
}

// ---------- canvas ----------

export function MapCanvas({
  mode,
  selected,
  focus,
  insets,
}: {
  mode: Mode
  selected: string | null
  focus: [number, number][] | null
  insets: Insets
}) {
  return (
    <div
      className="absolute inset-0 isolate z-0"
      style={
        {
          "--vc-bottom-inset": `${mode === "prototype" ? insets.bottom - 12 : 0}px`,
          "--vc-right-inset": `${insets.sheet ?? 0}px`,
        } as CSSProperties
      }
    >
      <MapContainer
        className="vc-map h-full w-full"
        center={township.center}
        zoom={15}
        zoomControl={false}
        minZoom={13}
        maxZoom={19}
        zoomSnap={0.25}
        scrollWheelZoom
      >
        <TileLayer url={OSM_URL} attribution={OSM_ATTR} maxZoom={19} />
        <ZoomControl position="bottomright" />
        <ViewController mode={mode} focus={focus} insets={insets} />
        <ContextLayer dim={mode === "risk"} />
        {mode === "prototype" && <PrototypeLayer />}
        {mode === "network" && <NetworkLayer selected={selected} />}
        {mode === "risk" && <RiskLayer />}
        {mode === "alerts" && <AlertsLayer selected={selected} />}
      </MapContainer>
    </div>
  )
}
