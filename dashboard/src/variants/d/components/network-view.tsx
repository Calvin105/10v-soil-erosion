import { useEffect, useMemo, useRef } from "react"
import L from "leaflet"
import {
  MapContainer,
  Marker,
  Pane,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet"
import { AlertTriangleIcon, MapPinIcon, ShieldAlertIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { township } from "@/data/seed"
import {
  bandsForPipe,
  corridorPolygon,
  getStateHex,
  PROTOTYPE_NODE_ID,
  RISK_BANDS,
  type NetworkNode,
  type NodeState,
} from "../network"
import { useVariantDStore } from "../store"

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

// Custom DivIcon for prototype pulsing marker (anchored precisely at center 20, 20)
function createPulseIcon(color: string, state: NodeState) {
  const isRed = state === "RED"
  const isYellow = state === "YELLOW"
  const pingClass = isRed ? "animate-ping duration-700" : isYellow ? "animate-pulse" : ""

  return L.divIcon({
    className: "prototype-pulse-icon",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `
      <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
        <span class="${pingClass}" style="position: absolute; width: 34px; height: 34px; border-radius: 9999px; background-color: ${color}; opacity: 0.35;"></span>
        <span style="position: absolute; width: 22px; height: 22px; border-radius: 9999px; background-color: ${color}; opacity: 0.5;"></span>
        <span style="position: relative; width: 14px; height: 14px; border-radius: 9999px; background-color: ${color}; border: 2.5px solid white; box-shadow: 0 0 10px ${color};"></span>
      </div>
    `,
  })
}

// Custom DivIcon for simulated manholes (anchored precisely at center 10, 10)
function createNodeIcon(color: string) {
  return L.divIcon({
    className: "manhole-marker-icon",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `
      <div style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
        <span style="width: 14px; height: 14px; border-radius: 9999px; background-color: ${color}; border: 2.5px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4); display: block;"></span>
      </div>
    `,
  })
}

// Custom DivIcon for citizen report pins (anchored precisely at center 14, 14)
function createCitizenIcon(isMatched: boolean) {
  const bg = isMatched ? "#10b981" : "#3b82f6"
  return L.divIcon({
    className: "citizen-pin-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `
      <div style="width: 28px; height: 28px; border-radius: 9999px; background-color: ${bg}; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>
    `,
  })
}

// Controller to handle programmatic map flight with smooth panTo (no zoom-bounce layer drifting)
function MapFlightController({ target }: { target: [number, number] | null }) {
  const map = useMap()
  const lastTarget = useRef<string>("")

  useEffect(() => {
    if (!target) return
    const key = `${target[0].toFixed(5)},${target[1].toFixed(5)}`
    if (key === lastTarget.current) return
    lastTarget.current = key

    // Pan smoothly without changing zoom level to prevent marker parallax drift
    map.panTo(target, { animate: true, duration: 0.5 })
  }, [target, map])

  return null
}

// Click listener to pick coordinates for citizen reports (mounted only while picking)
function MapClickListener({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function NetworkView({
  onSelectAsset,
  onOpenTickets,
  onReport,
  picking,
  onPickLocation,
  onCancelPick,
  flyTarget,
}: {
  onSelectAsset?: (assetId: string) => void
  onOpenTickets?: () => void
  onReport: () => void
  picking: boolean
  onPickLocation: (lat: number, lon: number) => void
  onCancelPick: () => void
  flyTarget: [number, number] | null
}) {
  const s = useVariantDStore()
  const proto = s.nodes[PROTOTYPE_NODE_ID]
  const telemetry = s.latestTelemetry

  // Ground-risk corridors around suspect/critical pipes
  const riskZones = useMemo(
    () =>
      s.pipes.flatMap((pipe) => {
        const from = s.nodes[pipe.fromId]
        const to = s.nodes[pipe.toId]
        if (!from || !to) return []
        return bandsForPipe(pipe.status).map((band) => ({
          key: `${pipe.id}-${band.level}`,
          band,
          pipe,
          positions: corridorPolygon([from.lat, from.lon], [to.lat, to.lon], band.radiusM),
        }))
      }),
    [s.pipes, s.nodes]
  )

  // Calculate network counts
  const counts = useMemo(() => {
    let healthy = 0
    let investigate = 0
    let critical = 0

    for (const node of Object.values(s.nodes)) {
      if (node.state === "RED") critical++
      else if (node.state === "YELLOW") investigate++
      else healthy++
    }

    return { healthy, investigate, critical }
  }, [s.nodes])

  // Flagged pipe lines requiring investigation
  const flaggedPipes = useMemo(() => {
    return s.pipes
      .filter((pipe) => pipe.status === "suspect" || pipe.status === "critical")
      .map((pipe) => {
        const fromNode = s.nodes[pipe.fromId]
        const toNode = s.nodes[pipe.toId]
        return {
          id: pipe.id,
          label: `Pipe ${pipe.fromId} ↔ ${pipe.toId}`,
          name: pipe.name,
          detail: pipe.status === "critical" ? "Critical Void Span" : "Suspect Cavity Segment",
          status: pipe.status,
          state: (pipe.status === "critical" ? "RED" : "YELLOW") as NodeState,
          lat: fromNode && toNode ? (fromNode.lat + toNode.lat) / 2 : 0,
          lon: fromNode && toNode ? (fromNode.lon + toNode.lon) / 2 : 0,
        }
      })
  }, [s.pipes, s.nodes])

  // Flagged manholes in need of investigation
  const flaggedManholes = useMemo(() => {
    return Object.values(s.nodes)
      .filter((node) => node.state === "RED" || node.state === "YELLOW")
      .sort((a, b) => {
        if (a.state === "RED" && b.state !== "RED") return -1
        if (b.state === "RED" && a.state !== "RED") return 1
        return b.vri - a.vri
      })
      .map((node) => ({
        id: node.id,
        label: `${node.id}: ${node.name}`,
        road: node.road,
        vri: node.vri,
        state: node.state,
        isPrototype: node.isPrototype,
        detail: `VRI ${node.vri}/100 · ${node.state === "RED" ? "Critical Void" : "Investigate"}`,
        lat: node.lat,
        lon: node.lon,
      }))
  }, [s.nodes])

  // Generate SVG path for 60s sparkline
  const sparkSvgData = useMemo(() => {
    const pts = s.sparklineHistory
    if (!pts || pts.length < 2) return { path: "", area: "", currentY: 20 }

    const width = 230
    const height = 44
    const minVri = 0
    const maxVri = 100

    const coords = pts.map((pt, i) => {
      const x = (i / (pts.length - 1)) * width
      const normY = (pt.vri - minVri) / (maxVri - minVri)
      const y = height - normY * (height - 8) - 4
      return { x, y }
    })

    const pathStr = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`, "")
    const areaStr = `${pathStr} L ${width},${height} L 0,${height} Z`
    const currentY = coords[coords.length - 1]?.y ?? 20

    return { path: pathStr, area: areaStr, currentY }
  }, [s.sparklineHistory])

  const protoColor = getStateHex(proto.state)

  return (
    <div
      className={`relative h-[calc(100vh-3.5rem)] w-full overflow-hidden ${
        picking ? "[&_.leaflet-container]:cursor-crosshair [&_.leaflet-interactive]:cursor-crosshair" : ""
      }`}
    >
      {/* Full screen Leaflet map */}
      <MapContainer
        className="h-full w-full"
        center={township.center}
        zoom={16}
        zoomControl={false}
        minZoom={14}
        maxZoom={18}
        zoomSnap={1}
        scrollWheelZoom
      >
        <TileLayer url={OSM_URL} attribution={OSM_ATTR} maxZoom={19} />
        <MapFlightController target={flyTarget} />
        {picking && <MapClickListener onMapClick={onPickLocation} />}

        {/* Ground risk zones: own pane under the pipes (overlayPane is z 400). Clicks on zones and
            pipes bubble to the map, which only listens while picking a report location. */}
        <Pane name="ground-risk" style={{ zIndex: 350 }}>
          {riskZones.map((z) => (
            <Polygon
              key={z.key}
              positions={z.positions}
              pathOptions={{ stroke: false, fillColor: z.band.color, fillOpacity: z.band.fillOpacity }}
            >
              {!picking && (
                <Tooltip sticky>
                  <div className="space-y-0.5 font-sans text-xs">
                    <div className="font-semibold">{z.band.label} ground risk</div>
                    <div>
                      Soil loss likely near pipe {z.pipe.fromId} → {z.pipe.toId}. Possible sinkhole risk.
                    </div>
                  </div>
                </Tooltip>
              )}
            </Polygon>
          ))}
        </Pane>

        {/* Drainage Pipes */}
        {s.pipes.map((pipe) => {
          const from = s.nodes[pipe.fromId]
          const to = s.nodes[pipe.toId]
          if (!from || !to) return null

          const isSuspect = pipe.status === "suspect"
          const isCritical = pipe.status === "critical"
          const color = isCritical ? "#ef4444" : isSuspect ? "#f59e0b" : "#64748b"
          const weight = isCritical ? 6 : isSuspect ? 4.5 : 2.5
          const dashArray = isSuspect ? "7, 8" : undefined
          const opacity = isCritical ? 0.95 : isSuspect ? 0.9 : 0.65

          return (
            <Polyline
              key={pipe.id}
              positions={[
                [from.lat, from.lon],
                [to.lat, to.lon],
              ]}
              pathOptions={{
                color,
                weight,
                dashArray,
                opacity,
                lineCap: "round",
                lineJoin: "round",
              }}
            >
              <Tooltip sticky>
                <div className="space-y-1 text-xs font-sans">
                  <div className="font-semibold">{pipe.name}</div>
                  <div className="text-muted-foreground">{pipe.reasoning}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    Segment: {pipe.fromId} ({from.state}) ↔ {pipe.toId} ({to.state})
                  </div>
                </div>
              </Tooltip>
            </Polyline>
          )
        })}

        {/* Manhole Nodes (All HTML Markers in markerPane for locked ground anchoring) */}
        {Object.values(s.nodes).map((node: NetworkNode) => {
          const isProto = node.isPrototype
          const color = getStateHex(node.state)

          if (isProto) {
            return (
              <Marker
                key={node.id}
                position={[node.lat, node.lon]}
                icon={createPulseIcon(color, node.state)}
                eventHandlers={{
                  click: () => onSelectAsset?.(node.id),
                }}
              >
                <Tooltip permanent direction="top" offset={[0, -14]} className="font-sans">
                  <div className="flex items-center gap-1.5 font-bold tracking-tight">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    PROTOTYPE · LIVE ({node.id})
                  </div>
                </Tooltip>
              </Marker>
            )
          }

          return (
            <Marker
              key={node.id}
              position={[node.lat, node.lon]}
              icon={createNodeIcon(color)}
              eventHandlers={{
                click: () => onSelectAsset?.(node.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} className="font-sans">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1 font-semibold">
                    <span>{node.id}: {node.name}</span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal text-muted-foreground">
                      Simulated
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">{node.road}</div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="font-mono font-semibold" style={{ color }}>
                      VRI: {node.vri} ({node.state})
                    </span>
                  </div>
                </div>
              </Tooltip>
            </Marker>
          )
        })}

        {/* Citizen Report Pins on the Map (Anchored in markerPane) */}
        {s.tickets
          .filter((t) => t.source === "citizen")
          .map((t) => {
            const isMatched = t.matchedSensor || t.matchedCitizen
            return (
              <Marker
                key={t.id}
                position={[t.lat, t.lon]}
                icon={createCitizenIcon(Boolean(isMatched))}
                eventHandlers={{
                  click: () => onOpenTickets?.(),
                }}
              >
                <Tooltip direction="top" offset={[0, -14]} className="font-sans">
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="text-primary font-mono">#{t.id}</span>
                      <span>{t.title}</span>
                      {t.isSimulated && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal text-muted-foreground">
                          Simulated
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground text-[11px]">{t.locationName}</div>
                    {isMatched && (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <span>✓ Matches sensor alert</span>
                      </div>
                    )}
                    <div className="text-[10px] font-mono text-muted-foreground">
                      Status: <span className="font-semibold uppercase text-foreground">{t.status}</span>
                    </div>
                  </div>
                </Tooltip>
              </Marker>
            )
          })}
      </MapContainer>

      {/* Prominent "Report a Problem" Citizen Button (Top Left) */}
      <div className="pointer-events-none absolute top-4 left-4 z-[450]">
        <Button
          size="sm"
          onClick={onReport}
          className="pointer-events-auto h-9 gap-2 shadow-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-full px-4 border border-white/20 transition-transform active:scale-95"
        >
          <MapPinIcon className="h-4 w-4" />
          Report a Problem
        </Button>
      </div>

      {/* Floating Network Overlay Card (Right Side) */}
      <div className="pointer-events-none absolute top-4 right-4 z-[450] w-[350px]">
        <Card className="pointer-events-auto border-border/60 bg-background/95 p-4 shadow-xl backdrop-blur-md max-h-[calc(100vh-5.5rem)] overflow-y-auto">
          {/* Header & Prototype Tag */}
          <div className="flex items-center justify-between border-b pb-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ backgroundColor: protoColor }}
                />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: protoColor }} />
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold tracking-tight">PROTOTYPE · LIVE</span>
                  <Badge variant="outline" className="font-mono text-[10px] py-0 px-1">
                    MH-04
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                  {proto.name}
                </div>
              </div>
            </div>

            <Badge
              className="text-xs font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: proto.state === "RED" ? "#ef4444" : proto.state === "YELLOW" ? "#f59e0b" : proto.state === "GRAY" ? "#64748b" : "#10b981",
                color: "#ffffff",
              }}
            >
              {proto.state === "RED" ? "Critical Void" : proto.state === "YELLOW" ? "Investigate" : proto.state === "GRAY" ? "Listening" : "Healthy"}
            </Badge>
          </div>

          {/* VRI and Verdict Sentence */}
          <div className="my-3 space-y-1">
            <div className="flex items-baseline justify-between">
              <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Void Risk Index
              </div>
              {telemetry && (
                <div className="font-mono text-[11px] text-muted-foreground">
                  Peak: {telemetry.peak.toLocaleString()} Hz
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight" style={{ color: protoColor }}>
                {proto.vri}
              </span>
              <span className="text-xs text-muted-foreground font-mono">/ 100</span>
            </div>
            <p className="text-xs font-medium text-foreground leading-snug pt-0.5">
              {proto.classSentence}
            </p>
          </div>

          {/* 60s VRI Sparkline */}
          <div className="my-3 rounded-md bg-muted/30 p-2 border border-border/40">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>60s Trend (Smoothing: 5-frame mean)</span>
              <span className="font-mono">VRI {proto.vri}</span>
            </div>
            <svg viewBox="0 0 230 44" className="w-full h-11 overflow-visible">
              <defs>
                <linearGradient id="vriSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={protoColor} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={protoColor} stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {sparkSvgData.area && <path d={sparkSvgData.area} fill="url(#vriSparkGrad)" />}
              {sparkSvgData.path && (
                <path
                  d={sparkSvgData.path}
                  fill="none"
                  stroke={protoColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              <circle cx="230" cy={sparkSvgData.currentY} r="3" fill={protoColor} />
            </svg>
          </div>

          {/* Probability Bars */}
          {telemetry && (
            <div className="space-y-1.5 my-3 text-[11px]">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Safe Soil
                </span>
                <span className="font-mono font-medium text-foreground">{telemetry.safe_soil.toFixed(1)}%</span>
              </div>
              <Progress value={telemetry.safe_soil} className="h-1 bg-muted" />

              <div className="flex items-center justify-between text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  Critical Void
                </span>
                <span className="font-mono font-medium text-foreground">{telemetry.critical_void.toFixed(1)}%</span>
              </div>
              <Progress value={telemetry.critical_void} className="h-1 bg-muted" />

              <div className="flex items-center justify-between text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  Ambient Listening
                </span>
                <span className="font-mono font-medium text-foreground">{telemetry.ambient.toFixed(1)}%</span>
              </div>
              <Progress value={telemetry.ambient} className="h-1 bg-muted" />
            </div>
          )}

          {/* Network Summary Counts line */}
          <div className="border-t pt-2.5 text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>
              Network: <strong className="text-emerald-500 font-semibold">{counts.healthy} healthy</strong> ·{" "}
              <strong className="text-amber-500 font-semibold">{counts.investigate} investigate</strong> ·{" "}
              <strong className="text-red-500 font-semibold">{counts.critical} critical</strong>
            </span>
          </div>

          {/* 1. Lines Requiring Investigation */}
          <div className="mt-3 pt-2.5 border-t space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <span className="flex items-center gap-1.5">
                <AlertTriangleIcon className="h-3.5 w-3.5" />
                Lines Requiring Investigation ({flaggedPipes.length})
              </span>
            </div>
            {flaggedPipes.length === 0 ? (
              <div className="text-[11px] text-muted-foreground italic pl-1">
                No suspect pipe lines detected.
              </div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {flaggedPipes.map((pipe) => (
                  <button
                    key={pipe.id}
                    type="button"
                    onClick={() => onSelectAsset?.(pipe.id)}
                    className="w-full text-left rounded p-1.5 hover:bg-muted/60 transition-colors flex items-center justify-between group border border-amber-500/20 bg-amber-500/5 hover:border-amber-500/50"
                  >
                    <div className="truncate">
                      <div className="text-xs font-semibold group-hover:text-primary transition-colors truncate">
                        {pipe.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {pipe.name} · <span className="font-medium text-amber-600 dark:text-amber-400">{pipe.detail}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-semibold shrink-0 ml-1">Fly →</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Manholes in Need of Investigation */}
          <div className="mt-2.5 pt-2 border-t space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
              <span className="flex items-center gap-1.5">
                <ShieldAlertIcon className="h-3.5 w-3.5" />
                Manholes in Need of Investigation ({flaggedManholes.length})
              </span>
            </div>
            {flaggedManholes.length === 0 ? (
              <div className="text-[11px] text-muted-foreground italic pl-1">
                All manholes operating within baseline.
              </div>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {flaggedManholes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => onSelectAsset?.(node.id)}
                    className="w-full text-left rounded p-1.5 hover:bg-muted/60 transition-colors flex items-center justify-between group border border-red-500/20 bg-red-500/5 hover:border-red-500/50"
                  >
                    <div className="truncate">
                      <div className="text-xs font-semibold group-hover:text-primary transition-colors truncate flex items-center gap-1.5">
                        <span>{node.label}</span>
                        {node.isPrototype && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono text-red-500 border-red-500/40">
                            LIVE
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {node.road} · <span className="font-semibold text-red-600 dark:text-red-400">{node.detail}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-red-600 dark:text-red-400 font-mono font-semibold shrink-0 ml-1">Fly →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Ground risk legend */}
      <div className="pointer-events-none absolute bottom-6 left-4 z-[450] rounded-lg border bg-background/95 px-3 py-2 shadow-lg backdrop-blur-md">
        <div className="mb-1 text-[11px] font-semibold">Ground risk</div>
        {[...RISK_BANDS].reverse().map((b) => (
          <div key={b.level} className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span
              className="h-2.5 w-4 rounded-sm"
              style={{ backgroundColor: b.color, opacity: Math.min(1, b.fillOpacity * 3) }}
            />
            {b.label}
          </div>
        ))}
      </div>

      {/* Pick-on-map banner */}
      {picking && (
        <div className="absolute top-4 left-1/2 z-[460] flex -translate-x-1/2 items-center gap-3 rounded-full border bg-background/95 px-4 py-2 text-xs font-semibold shadow-xl">
          <MapPinIcon className="h-4 w-4 text-red-500" />
          Click the map where the problem is
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onCancelPick}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
