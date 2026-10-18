import { useMemo, useState } from "react"
import { PackageIcon, RadioTowerIcon, ScrollTextIcon, TableIcon, WaypointsIcon } from "lucide-react"
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip } from "react-leaflet"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { APP_PAYLOAD_BYTES, LORAWAN_OVERHEAD_BYTES, PAYLOAD_LAYOUT, airtimeMs, useNetwork } from "@/data/network-sim"
import { gateways, manholes, zones } from "@/data/seed"
import type { Manhole } from "@/data/types"
import { cn } from "@/lib/utils"

import { ConceptBanner, Dot, Pane, STATE, TD, TDN, TH, Tag, clock, zoneOf } from "../ui"
import { MapSizer, TILE_ATTR, TILE_URL, gatewayIcon, linkMargin, marginState } from "../widgets/map"

// ---------- topology diagram ----------

const GW_POS: Record<string, { x: number; y: number }> = {
  "GW-1": { x: 262, y: 38 },
  "GW-2": { x: 262, y: 128 },
}

const ZONE_BOX = [
  { id: "z-west", y: 4, h: 54 },
  { id: "z-central", y: 62, h: 72 },
  { id: "z-lake", y: 138, h: 54 },
]

function Topology({ nodes, selected }: { nodes: Manhole[]; selected: string | null }) {
  const gwName = Object.fromEntries(gateways.map((g) => [g.id, g]))
  const links = ZONE_BOX.flatMap((z) =>
    gateways
      .map((g) => ({
        z,
        g,
        n: nodes.filter((m) => m.zoneId === z.id && m.gatewayId === g.id).length,
      }))
      .filter((l) => l.n > 0)
  )
  const strokeCls = "stroke-foreground/35"
  return (
    <svg viewBox="0 0 600 196" className="h-full w-full" role="img" aria-label="LoRaWAN topology">
      <defs>
        <marker id="va-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" className="fill-foreground/50" />
        </marker>
      </defs>

      {/* zone -> gateway links */}
      {links.map((l, i) => {
        const gp = GW_POS[l.g.id]
        const x0 = 194
        const y0 = l.z.y + l.z.h / 2
        const d = `M${x0} ${y0} C ${x0 + 40} ${y0}, ${gp.x - 40} ${gp.y}, ${gp.x} ${gp.y}`
        return (
          <g key={`${l.z.id}${l.g.id}`}>
            <path
              id={`va-link-${i}`}
              d={d}
              className={strokeCls}
              fill="none"
              strokeWidth={1 + l.n * 0.5}
              strokeDasharray="4 3"
              markerEnd="url(#va-arrow)"
            />
            <circle r={2.4} className="fill-foreground">
              <animateMotion dur={`${3.2 + i * 0.7}s`} repeatCount="indefinite" begin={`${i * 0.5}s`}>
                <mpath href={`#va-link-${i}`} />
              </animateMotion>
            </circle>
            <text
              x={(x0 + gp.x) / 2}
              y={(y0 + gp.y) / 2 - 3}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={8.5}
            >
              {l.n} node{l.n > 1 ? "s" : ""}
            </text>
          </g>
        )
      })}

      {/* zones with node chips */}
      {ZONE_BOX.map((zb) => {
        const zone = zones.find((z) => z.id === zb.id)!
        const zn = nodes.filter((m) => m.zoneId === zb.id)
        return (
          <g key={zb.id}>
            <rect x={4} y={zb.y} width={190} height={zb.h} rx={4} className="fill-muted/40 stroke-border" />
            <text x={10} y={zb.y + 11} className="fill-muted-foreground" fontSize={9} fontWeight={600} letterSpacing={0.6}>
              {zone.name.toUpperCase()}
            </text>
            <text x={188} y={zb.y + 11} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8.5}>
              {zn.length} x (VIB + MIC)
            </text>
            {zn.map((m, i) => {
              const col = i % 3
              const row = Math.floor(i / 3)
              const x = 9 + col * 61
              const y = zb.y + 17 + row * 24
              const isSel = selected === m.id
              return (
                <g key={m.id}>
                  <rect
                    x={x}
                    y={y}
                    width={56}
                    height={20}
                    rx={3}
                    className={cn("fill-card", isSel ? "stroke-foreground" : "stroke-border")}
                    strokeWidth={isSel ? 1.6 : 1}
                  />
                  <circle cx={x + 8} cy={y + 10} r={3.4} fill={STATE[m.state].hex} />
                  <text x={x + 15} y={y + 13.2} className="fill-foreground font-mono" fontSize={9.5} fontWeight={600}>
                    {m.id}
                  </text>
                  <rect x={x + 47} y={y + 4} width={4} height={5} rx={1} className="fill-foreground/55" />
                  <rect x={x + 47} y={y + 11} width={4} height={5} rx={1} className="fill-foreground/25" />
                </g>
              )
            })}
          </g>
        )
      })}

      {/* gateways */}
      {gateways.map((g) => {
        const p = GW_POS[g.id]
        const count = nodes.filter((m) => m.gatewayId === g.id).length
        return (
          <g key={g.id}>
            <rect x={p.x} y={p.y - 24} width={100} height={48} rx={4} className="fill-card stroke-foreground" strokeWidth={1.4} />
            <text x={p.x + 8} y={p.y - 10} className="fill-foreground font-mono" fontSize={10.5} fontWeight={700}>
              {g.id}
            </text>
            <circle cx={p.x + 90} cy={p.y - 13} r={3} fill="#10b981" />
            <text x={p.x + 8} y={p.y + 2} className="fill-muted-foreground" fontSize={9}>
              {g.name}
            </text>
            <text x={p.x + 8} y={p.y + 15} className="fill-muted-foreground font-mono" fontSize={9}>
              {count} nodes / {g.backhaul}
            </text>
          </g>
        )
      })}

      {/* gateways -> network server */}
      {gateways.map((g, i) => {
        const p = GW_POS[g.id]
        const d = `M${p.x + 100} ${p.y} C ${p.x + 135} ${p.y}, 375 ${i === 0 ? 74 : 112}, 406 ${i === 0 ? 74 : 112}`
        return (
          <g key={g.id}>
            <path
              id={`va-bh-${i}`}
              d={d}
              className="stroke-foreground/55"
              fill="none"
              strokeWidth={1.6}
              markerEnd="url(#va-arrow)"
            />
            <circle r={2.4} className="fill-foreground">
              <animateMotion dur={`${2.6 + i * 0.6}s`} repeatCount="indefinite" begin={`${i * 0.9}s`}>
                <mpath href={`#va-bh-${i}`} />
              </animateMotion>
            </circle>
            <text x={p.x + 112} y={p.y + (i === 0 ? -6 : 14)} className="fill-muted-foreground font-mono" fontSize={8}>
              {gwName[g.id].backhaul}
            </text>
          </g>
        )
      })}

      {/* network server */}
      <rect x={406} y={62} width={100} height={62} rx={4} className="fill-card stroke-foreground" strokeWidth={1.4} />
      <text x={414} y={77} className="fill-foreground" fontSize={10.5} fontWeight={700}>
        Network server
      </text>
      <text x={414} y={90} className="fill-muted-foreground" fontSize={9}>
        LoRaWAN NS
      </text>
      <text x={414} y={102} className="fill-muted-foreground" fontSize={9}>
        ChirpStack / TTN
      </text>
      <text x={414} y={115} className="fill-muted-foreground font-mono" fontSize={9}>
        dedupe, ADR
      </text>

      <path d="M506 93 L534 93" className="stroke-foreground/55" strokeWidth={1.6} markerEnd="url(#va-arrow)" />
      <text x={520} y={88} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>
        API
      </text>

      {/* dashboard */}
      <rect x={536} y={62} width={62} height={62} rx={4} className="fill-foreground" />
      <text x={567} y={80} textAnchor="middle" className="fill-background" fontSize={10} fontWeight={700}>
        Sentinel
      </text>
      <text x={567} y={93} textAnchor="middle" className="fill-background/75" fontSize={8.5}>
        dashboard
      </text>
      <text x={567} y={110} textAnchor="middle" className="fill-background/75 font-mono" fontSize={8}>
        this screen
      </text>

      {/* footer legend */}
      <text x={204} y={188} className="fill-muted-foreground font-mono" fontSize={9}>
        AS923 / SF7-10 / {APP_PAYLOAD_BYTES}-byte payload / hourly + on state change
      </text>
    </svg>
  )
}

// ---------- map ----------

function NetMap({
  nodes,
  selected,
  onSelect,
}: {
  nodes: Manhole[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  const [links, setLinks] = useState(true)
  const gw = Object.fromEntries(gateways.map((g) => [g.id, g]))
  const pts = [...manholes, ...gateways].map((p) => [p.lat, p.lon] as [number, number])
  const lats = pts.map((p) => p[0])
  const lons = pts.map((p) => p[1])
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)],
  ]
  return (
    <div className="va-map absolute inset-0">
      <MapContainer bounds={bounds} boundsOptions={{ padding: [34, 34] }} className="h-full w-full" attributionControl>
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} maxZoom={19} />
        <MapSizer />
        {links &&
          nodes.map((n) => {
            const g = gw[n.gatewayId]
            const m = linkMargin(n)
            const st = marginState(m)
            return (
              <Polyline
                key={`l-${n.id}`}
                positions={[
                  [n.lat, n.lon],
                  [g.lat, g.lon],
                ]}
                pathOptions={{ color: STATE[st].hex, weight: selected === n.id ? 3 : 1.5, dashArray: "5 4", opacity: selected && selected !== n.id ? 0.35 : 0.85 }}
              >
                <Tooltip sticky>
                  <span className="font-mono">
                    {n.id} to {g.id}: SF{n.spreadingFactor}, RSSI {n.rssi} dBm, SNR {n.snr.toFixed(1)} dB, margin {m.toFixed(1)} dB
                  </span>
                </Tooltip>
              </Polyline>
            )
          })}
        {gateways.map((g) => (
          <Marker key={g.id} position={[g.lat, g.lon]} icon={gatewayIcon(g)}>
            <Tooltip direction="top" offset={[0, -12]}>
              {g.name} / {g.backhaul} backhaul
            </Tooltip>
          </Marker>
        ))}
        {nodes.map((n) => (
          <CircleMarker
            key={n.id}
            center={[n.lat, n.lon]}
            radius={n.state === "GREEN" ? 7 : 9}
            pathOptions={{
              color: n.wet ? "#3b82f6" : "#ffffff",
              weight: n.wet ? 3 : 1.5,
              fillColor: STATE[n.state].hex,
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelect(n.id) }}
          >
            <Tooltip permanent direction="right" offset={[9, 0]} className="va-node-label">
              {n.id.replace("MH-", "")}
            </Tooltip>
          </CircleMarker>
        ))}
        {nodes
          .filter((n) => n.state === "RED")
          .map((n) => (
            <CircleMarker
              key={`p-${n.id}`}
              center={[n.lat, n.lon]}
              radius={9}
              interactive={false}
              pathOptions={{ color: STATE.RED.hex, weight: 2, fill: false, className: "va-ping" }}
            />
          ))}
        {selected &&
          nodes
            .filter((n) => n.id === selected)
            .map((n) => (
              <CircleMarker
                key="sel"
                center={[n.lat, n.lon]}
                radius={14}
                interactive={false}
                pathOptions={{ color: "var(--foreground)", weight: 2, fill: false }}
              />
            ))}
      </MapContainer>

      <div className="pointer-events-auto absolute bottom-6 left-2 z-[1000] flex flex-col gap-1 rounded-md border bg-background/90 px-2 py-1.5 font-mono text-[9.5px] shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="font-sans text-[9px] tracking-wider text-muted-foreground uppercase">Node</span>
          {(["GREEN", "YELLOW", "RED"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <Dot state={s} /> {s}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full border-2 border-blue-500" /> wet
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-sans text-[9px] tracking-wider text-muted-foreground uppercase">Link margin</span>
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 bg-emerald-500" />
            {">"}10 dB
          </span>
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 bg-amber-500" />
            5-10
          </span>
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 bg-red-500" />
            {"<"}5
          </span>
        </div>
        <label className="flex items-center gap-1.5 font-sans text-[10px]">
          <Switch size="sm" checked={links} onCheckedChange={setLinks} />
          Show links
        </label>
      </div>
    </div>
  )
}

// ---------- tables ----------

function NodeTable({
  nodes,
  selected,
  onSelect,
}: {
  nodes: Manhole[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={TH}>Node</TableHead>
          <TableHead className={TH}>State</TableHead>
          <TableHead className={cn(TH, "text-right")}>VRI</TableHead>
          <TableHead className={cn(TH, "text-right")}>Ring x</TableHead>
          <TableHead className={cn(TH, "text-center")}>GW</TableHead>
          <TableHead className={cn(TH, "text-right")}>SF</TableHead>
          <TableHead className={cn(TH, "text-right")}>RSSI</TableHead>
          <TableHead className={cn(TH, "text-right")}>SNR</TableHead>
          <TableHead className={cn(TH, "text-right")}>Margin</TableHead>
          <TableHead className={cn(TH, "text-right")}>Batt</TableHead>
          <TableHead className={cn(TH, "text-right")}>Last</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {nodes.map((n) => {
          const m = linkMargin(n)
          return (
            <TableRow
              key={n.id}
              onClick={() => onSelect(n.id)}
              data-state={selected === n.id ? "selected" : undefined}
              className="cursor-pointer"
            >
              <TableCell className={cn(TD, "font-mono font-semibold")}>{n.id}</TableCell>
              <TableCell className={TD}>
                <span className="inline-flex items-center gap-1 font-mono text-[10.5px]">
                  <Dot state={n.state} />
                  {n.state}
                  {n.wet && <span className="text-blue-600 dark:text-blue-400">W</span>}
                </span>
              </TableCell>
              <TableCell className={cn(TDN, STATE[zoneOf(n.vri)].text)}>{n.vri}</TableCell>
              <TableCell className={TDN}>{n.ringTimeRatio.toFixed(2)}</TableCell>
              <TableCell className={cn(TD, "text-center font-mono")}>{n.gatewayId.replace("GW-", "G")}</TableCell>
              <TableCell className={TDN}>{n.spreadingFactor}</TableCell>
              <TableCell className={TDN}>{n.rssi}</TableCell>
              <TableCell className={TDN}>{n.snr.toFixed(1)}</TableCell>
              <TableCell className={cn(TDN, STATE[marginState(m)].text)}>{m.toFixed(1)}</TableCell>
              <TableCell className={cn(TDN, n.batteryPct < 85 && STATE.YELLOW.text)}>{n.batteryPct}%</TableCell>
              <TableCell className={cn(TDN, "text-muted-foreground")}>
                {n.lastUplinkMinAgo === 0 ? "now" : `${n.lastUplinkMinAgo}m`}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function UplinkLog({ selected }: { selected: string | null }) {
  const { uplinks } = useNetwork()
  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={TH}>Time</TableHead>
            <TableHead className={TH}>Node</TableHead>
            <TableHead className={cn(TH, "text-center")}>GW</TableHead>
            <TableHead className={cn(TH, "text-right")}>FCnt</TableHead>
            <TableHead className={cn(TH, "text-right")}>SF</TableHead>
            <TableHead className={cn(TH, "text-right")}>RSSI</TableHead>
            <TableHead className={cn(TH, "text-right")}>SNR</TableHead>
            <TableHead className={cn(TH, "text-right")}>B</TableHead>
            <TableHead className={cn(TH, "text-right")}>Airtime</TableHead>
            <TableHead className={cn(TH, "text-right")}>VRI</TableHead>
            <TableHead className={cn(TH, "text-center")}>Wet</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {uplinks.map((u, i) => (
            <TableRow
              key={u.id}
              className={cn(i === 0 && "va-flash", selected === u.manholeId && "bg-muted/60")}
            >
              <TableCell className={cn(TD, "font-mono tabular-nums text-muted-foreground")}>{clock(u.at)}</TableCell>
              <TableCell className={cn(TD, "font-mono font-semibold")}>{u.manholeId}</TableCell>
              <TableCell className={cn(TD, "text-center font-mono")}>{u.gatewayId.replace("GW-", "G")}</TableCell>
              <TableCell className={TDN}>{u.fcnt}</TableCell>
              <TableCell className={TDN}>{u.sf}</TableCell>
              <TableCell className={TDN}>{u.rssi}</TableCell>
              <TableCell className={TDN}>{u.snr.toFixed(1)}</TableCell>
              <TableCell className={TDN}>{u.bytes}</TableCell>
              <TableCell className={TDN}>{u.airtimeMs.toFixed(0)} ms</TableCell>
              <TableCell className={cn(TDN, STATE[zoneOf(u.vri)].text)}>{u.vri}</TableCell>
              <TableCell className={cn(TD, "text-center font-mono")}>{u.wet ? "W" : "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}

// ---------- payload ----------

function Payload() {
  const cells = PAYLOAD_LAYOUT.map((p) => {
    const [a, b] = p.bytes.split("-").map(Number)
    return { ...p, from: a, span: (b ?? a) - a + 1 }
  })
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-11 gap-px font-mono text-[9px] text-muted-foreground">
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i} className="text-center">
            B{i}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-11 gap-px">
        {cells.map((c) => (
          <div
            key={c.field}
            title={`byte ${c.bytes}: ${c.field} (${c.note})`}
            style={{ gridColumn: `span ${c.span}` }}
            className="min-w-0 rounded-[3px] border bg-muted/50 px-1 py-1 text-center"
          >
            <div className="truncate font-mono text-[10px] leading-3 font-semibold">
              {c.field.replace("_ratio", "").replace("_pct", "").replace(" (3 bands)", "").replace("_c", "")}
            </div>
          </div>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-px text-[10px] leading-[14px]">
        {cells.map((c) => (
          <div key={c.field} className="flex min-w-0 gap-1.5">
            <dt className="w-7 shrink-0 font-mono text-muted-foreground">B{c.bytes}</dt>
            <dd className="min-w-0 truncate">
              <span className="font-mono">{c.field.replace(" (3 bands)", "")}</span>
              <span className="text-muted-foreground"> {c.note}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-x-3 border-t pt-1 font-mono text-[9.5px] text-muted-foreground">
        <span>
          {APP_PAYLOAD_BYTES} B app + {LORAWAN_OVERHEAD_BYTES} B LoRaWAN = {APP_PAYLOAD_BYTES + LORAWAN_OVERHEAD_BYTES} B on air
        </span>
        {[7, 8, 9, 10].map((sf) => (
          <span key={sf}>
            SF{sf} {airtimeMs(sf).toFixed(0)} ms
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------- page ----------

export function NetworkPage() {
  const { nodes, packetsLastHour, uplinks } = useNetwork()
  const [selected, setSelected] = useState<string | null>("MH-07")
  const online = nodes.length
  const reds = nodes.filter((n) => n.state === "RED").length
  const yellows = nodes.filter((n) => n.state === "YELLOW").length
  const meanBatt = useMemo(() => nodes.reduce((a, n) => a + n.batteryPct, 0) / nodes.length, [nodes])

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 p-1.5">
      <ConceptBanner>
        Production design: 10 manholes x 2 sensors, 2 gateways, LoRaWAN AS923. Every number on this screen is simulated.
      </ConceptBanner>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] gap-1.5">
        <div className="flex min-h-0 flex-col gap-1.5">
          <div className="h-[clamp(212px,24vh,300px)] shrink-0">
            <Pane
              title="Topology"
              icon={WaypointsIcon}
              meta={`${online} nodes / ${online * 2} sensors / 2 gateways`}
              actions={
                <span className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="text-muted-foreground">{packetsLastHour} pkt/h</span>
                  <Tag className={cn(reds > 0 && "border-red-500/50", reds > 0 && STATE.RED.text)}>{reds} RED</Tag>
                  <Tag className={cn(yellows > 0 && "border-amber-500/50", yellows > 0 && STATE.YELLOW.text)}>
                    {yellows} YELLOW
                  </Tag>
                </span>
              }
              bodyClassName="p-1"
            >
              <Topology nodes={nodes} selected={selected} />
            </Pane>
          </div>
          <div className="min-h-0 flex-1">
            <Pane
              title="Field map"
              icon={RadioTowerIcon}
              meta="City of Elmina (concept)"
              actions={<span className="font-mono text-[10px] text-muted-foreground">mean battery {meanBatt.toFixed(0)}%</span>}
              bodyClassName="p-0"
            >
              <NetMap nodes={nodes} selected={selected} onSelect={setSelected} />
            </Pane>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-1.5">
          <div className="shrink-0">
            <Pane title="Nodes" icon={TableIcon} meta="click a row to focus" className="h-auto" bodyClassName="p-0">
              <NodeTable nodes={nodes} selected={selected} onSelect={setSelected} />
            </Pane>
          </div>
          <div className="min-h-0 flex-1">
            <Pane
              title="Uplink log"
              icon={ScrollTextIcon}
              meta="1 uplink / 2.5 s, accelerated"
              actions={
                <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  {uplinks.length} buffered
                </span>
              }
              bodyClassName="p-0"
            >
              <UplinkLog selected={selected} />
            </Pane>
          </div>
          <div className="shrink-0">
            <Pane title="Payload layout" icon={PackageIcon} meta="11 bytes, one uplink" className="h-auto" bodyClassName="p-2">
              <Payload />
            </Pane>
          </div>
        </div>
      </div>
    </div>
  )
}
