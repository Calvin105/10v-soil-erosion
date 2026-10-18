import {
  BatteryChargingIcon,
  ExternalLinkIcon,
  RadioTowerIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
  WifiIcon,
} from "lucide-react"
import { divIcon } from "leaflet"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { CircleMarker, Marker, Polyline } from "react-leaflet"
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Slider } from "@/components/ui/slider"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  airtimeMs,
  DEFAULT_BATTERY,
  PAYLOAD_LAYOUT,
  projectBattery,
  useNetwork,
  type BatteryInputs,
} from "@/data/network-sim"
import { gateways, manholes, zones } from "@/data/seed"
import type { Gateway, NodeState } from "@/data/types"
import { cn } from "@/lib/utils"

import { paths } from "../paths"
import {
  fmtTime,
  queueFleetPlan,
  queueNetworkPoll,
  queueSim,
  useGame,
  useLaneBusy,
} from "../store"
import { KeyValue, Stat } from "../ui/blocks"
import { CommandPanel, type Command } from "../ui/commands"
import { LevelLayout, Panel, TOWNSHIP_CRUMB, type Crumb } from "../ui/layout"
import { BaseMap, boundsOf } from "../ui/maps"
import { NotFound } from "../ui/not-found"
import { ConceptTag, Num, SectionLabel, STATE_META } from "../ui/state"
import { Tag, Tile } from "../ui/tiles"

const NET_CRUMB: Crumb = { label: "Network (Concept)", to: paths.network }
const CAVEAT = "Concept estimate - needs a measured current profile"

function linkState(snr: number): NodeState {
  return snr >= 5 ? "GREEN" : snr >= 0 ? "YELLOW" : "RED"
}

/* ------------------------------------------------------------------ */
/* Topology diagram                                                    */
/* ------------------------------------------------------------------ */

function Topology() {
  const navigate = useNavigate()
  const net = useNetwork()
  const ROW = 33
  const GAP = 20
  // vertical position per node, grouped by zone
  const pos = new Map<string, number>()
  let y = 34
  zones.forEach((z) => {
    manholes
      .filter((m) => m.zoneId === z.id)
      .forEach((m) => {
        pos.set(m.id, y)
        y += ROW
      })
    y += GAP
  })
  const H = y
  const gwY = (id: string) => (id === "GW-1" ? H * 0.3 : H * 0.7)
  const GX = 420
  const NSX = 610
  const DX = 820

  return (
    <svg viewBox={`0 0 960 ${H}`} className="w-full" role="img" aria-label="LoRaWAN topology">
      {[
        [0, "10 MANHOLES x 2 SENSORS"],
        [GX, "2 GATEWAYS"],
        [NSX, "NETWORK SERVER"],
        [DX, "SENTINEL"],
      ].map(([x, t]) => (
        <text key={String(t)} x={x as number} y={14} className="fill-muted-foreground text-[10px] font-semibold" letterSpacing="1.2">
          {t}
        </text>
      ))}

      {/* node -> gateway */}
      {manholes.map((m) => {
        const ny = pos.get(m.id)! + 12
        const gy = gwY(m.gatewayId)
        const live = net.nodes.find((n) => n.id === m.id)!
        return (
          <path
            key={m.id}
            d={`M 214 ${ny} C 320 ${ny}, 320 ${gy}, ${GX} ${gy}`}
            fill="none"
            strokeWidth={1.5}
            strokeDasharray={m.spreadingFactor >= 9 ? "4 4" : undefined}
            className={cn("transition-colors", STATE_META[linkState(live.snr)].stroke)}
            opacity={0.55}
          />
        )
      })}

      {/* gateway -> NS -> dashboard */}
      {gateways.map((g) => (
        <path key={g.id} d={`M ${GX + 150} ${gwY(g.id)} C 570 ${gwY(g.id)}, 570 ${H / 2}, ${NSX} ${H / 2}`} fill="none" strokeWidth={2} className="stroke-foreground/40" />
      ))}
      <path d={`M ${NSX + 130} ${H / 2} L ${DX} ${H / 2}`} fill="none" strokeWidth={2} className="stroke-foreground/40" />
      <text x={NSX + 65} y={H / 2 - 38} className="fill-muted-foreground text-[10px]" textAnchor="middle">
        Fibre / 4G in
      </text>
      <text x={(NSX + 130 + DX) / 2} y={H / 2 - 8} className="fill-muted-foreground text-[10px]" textAnchor="middle">
        MQTT / API
      </text>
      <text x={320} y={H - 4} className="fill-muted-foreground text-[10px]" textAnchor="middle">
        LoRa AS923, SF7 to SF10 (dashed = SF9+)
      </text>

      {/* zone labels + nodes */}
      {zones.map((z) => {
        const mine = manholes.filter((m) => m.zoneId === z.id)
        const top = pos.get(mine[0].id)!
        return (
          <g key={z.id}>
            <text x={0} y={top - 6} className="fill-muted-foreground text-[10px]">
              {z.name}
            </text>
          </g>
        )
      })}
      {manholes.map((m) => {
        const live = net.nodes.find((n) => n.id === m.id)!
        const ny = pos.get(m.id)!
        return (
          <g
            key={m.id}
            role="link"
            tabIndex={0}
            className="cursor-pointer outline-none focus-visible:[&>rect]:stroke-ring"
            onClick={() => navigate(paths.manhole(m))}
            onKeyDown={(e) => e.key === "Enter" && navigate(paths.manhole(m))}
          >
            <rect x={0} y={ny} width={214} height={25} rx={6} className="fill-card stroke-border hover:stroke-foreground" strokeWidth={1.5} />
            <circle cx={14} cy={ny + 12.5} r={5} fill={STATE_META[live.state].hex} />
            <text x={28} y={ny + 16.5} className="fill-foreground font-mono text-[11px] font-semibold">
              {m.id}
            </text>
            <text x={78} y={ny + 16.5} className="fill-muted-foreground text-[10px]">
              VIB + MIC
            </text>
            <text x={206} y={ny + 16.5} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
              SF{live.spreadingFactor}
            </text>
          </g>
        )
      })}

      {gateways.map((g) => (
        <g key={g.id} role="link" tabIndex={0} className="cursor-pointer" onClick={() => navigate(paths.gateway(g.id))} onKeyDown={(e) => e.key === "Enter" && navigate(paths.gateway(g.id))}>
          <rect x={GX} y={gwY(g.id) - 28} width={150} height={56} rx={10} className="fill-card stroke-foreground/60" strokeWidth={2} />
          <text x={GX + 12} y={gwY(g.id) - 8} className="fill-foreground font-mono text-[12px] font-bold">
            {g.id}
          </text>
          <text x={GX + 12} y={gwY(g.id) + 8} className="fill-muted-foreground text-[10px]">
            {g.name}
          </text>
          <text x={GX + 12} y={gwY(g.id) + 21} className="fill-muted-foreground text-[10px]">
            {g.backhaul} backhaul
          </text>
        </g>
      ))}

      <rect x={NSX} y={H / 2 - 30} width={130} height={60} rx={10} className="fill-muted stroke-foreground/40" strokeWidth={2} strokeDasharray="5 4" />
      <text x={NSX + 65} y={H / 2 - 4} textAnchor="middle" className="fill-foreground text-[12px] font-bold">
        LoRaWAN NS
      </text>
      <text x={NSX + 65} y={H / 2 + 12} textAnchor="middle" className="fill-muted-foreground text-[10px]">
        ChirpStack / TTN
      </text>
      <rect x={DX} y={H / 2 - 30} width={130} height={60} rx={10} className="fill-foreground" />
      <text x={DX + 65} y={H / 2 - 4} textAnchor="middle" className="fill-background text-[12px] font-bold">
        Dashboard
      </text>
      <text x={DX + 65} y={H / 2 + 12} textAnchor="middle" className="fill-background/70 text-[10px]">
        this app
      </text>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Link map                                                            */
/* ------------------------------------------------------------------ */

function gwIcon(g: Gateway) {
  return divIcon({
    className: "",
    iconSize: [54, 22],
    iconAnchor: [27, 11],
    html: `<div class="flex h-[22px] w-[54px] items-center justify-center rounded-md border-2 border-white bg-neutral-900 font-mono text-[11px] font-bold text-white shadow">${g.id}</div>`,
  })
}

function LinkMap() {
  const net = useNetwork()
  const navigate = useNavigate()
  const pts = [...manholes, ...gateways]
  return (
    <BaseMap bounds={boundsOf(pts)} className="h-80">
      {net.nodes.map((n) => {
        const g = gateways.find((x) => x.id === n.gatewayId)!
        return (
          <Polyline
            key={`l-${n.id}`}
            positions={[
              [n.lat, n.lon],
              [g.lat, g.lon],
            ]}
            pathOptions={{ color: STATE_META[linkState(n.snr)].hex, weight: 2, opacity: 0.6, dashArray: n.spreadingFactor >= 9 ? "5 6" : undefined }}
          />
        )
      })}
      {net.nodes.map((n) => (
        <CircleMarker
          key={n.id}
          center={[n.lat, n.lon]}
          radius={7}
          pathOptions={{ color: "#fff", weight: 2, fillColor: STATE_META[n.state].hex, fillOpacity: 1 }}
          eventHandlers={{ click: () => navigate(paths.manhole(n)) }}
        />
      ))}
      {gateways.map((g) => (
        <Marker key={g.id} position={[g.lat, g.lon]} icon={gwIcon(g)} eventHandlers={{ click: () => navigate(paths.gateway(g.id)) }} />
      ))}
    </BaseMap>
  )
}

/* ------------------------------------------------------------------ */
/* Uplink log                                                          */
/* ------------------------------------------------------------------ */

function UplinkTable({ gw, rows = 10 }: { gw?: string; rows?: number }) {
  const net = useNetwork()
  const list = net.uplinks.filter((u) => !gw || u.gatewayId === gw).slice(0, rows)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Node</TableHead>
          <TableHead>GW</TableHead>
          <TableHead className="text-right">SF</TableHead>
          <TableHead className="text-right">RSSI</TableHead>
          <TableHead className="text-right">SNR</TableHead>
          <TableHead className="text-right">Airtime</TableHead>
          <TableHead className="text-right">VRI</TableHead>
          <TableHead>Wet</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((u) => (
          <TableRow key={u.id}>
            <TableCell className="font-mono text-xs tabular-nums">{fmtTime(u.at)}</TableCell>
            <TableCell className="font-mono text-xs">{u.manholeId}</TableCell>
            <TableCell className="font-mono text-xs">{u.gatewayId}</TableCell>
            <TableCell className="text-right font-mono text-xs tabular-nums">{u.sf}</TableCell>
            <TableCell className="text-right font-mono text-xs tabular-nums">{u.rssi}</TableCell>
            <TableCell className="text-right font-mono text-xs tabular-nums">{u.snr.toFixed(1)}</TableCell>
            <TableCell className="text-right font-mono text-xs tabular-nums">{u.airtimeMs.toFixed(0)} ms</TableCell>
            <TableCell className="text-right font-mono text-xs tabular-nums">{u.vri}</TableCell>
            <TableCell className="text-xs">{u.wet ? "WET" : "dry"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/* ------------------------------------------------------------------ */
/* Network (site)                                                      */
/* ------------------------------------------------------------------ */

export function NetworkPage() {
  const net = useNetwork()
  const navigate = useNavigate()
  const busy = useLaneBusy("network")
  const fleet = useGame((s) => s.fleetPlan)
  const bat = projectBattery(DEFAULT_BATTERY)
  const weakest = [...net.nodes].sort((a, b) => a.snr - b.snr)[0]

  const commands: Command[] = [
    {
      id: "poll",
      hotkey: "p",
      label: "Poll all nodes now",
      icon: RefreshCwIcon,
      mode: "sim",
      primary: true,
      hint: "Asks every node for an extra uplink. Normally they wake on their own schedule.",
      disabled: busy,
      reason: "The network is already busy.",
      run: () => queueNetworkPoll("Network"),
    },
    {
      id: "weak",
      hotkey: "w",
      label: "Open weakest link",
      icon: TriangleAlertIcon,
      mode: "nav",
      hint: `${weakest.id} at ${weakest.snr.toFixed(1)} dB SNR`,
      run: () => navigate(paths.manhole(weakest)),
    },
    {
      id: "battery",
      hotkey: "b",
      label: "Open Battery planner",
      icon: BatteryChargingIcon,
      mode: "nav",
      run: () => navigate(paths.battery),
    },
  ]

  return (
    <LevelLayout
      crumbs={[TOWNSHIP_CRUMB, NET_CRUMB]}
      level="Site"
      depthMax={2}
      title="LoRaWAN Network"
      subtitle="Production design: 10 manholes with two sensors each report over LoRa to two gateways. None of this is built."
      badges={<ConceptTag />}
      commands={<CommandPanel title="Network orders" commands={commands} />}
    >
      <Alert>
        <RadioTowerIcon />
        <AlertTitle>Concept - simulated, not built</AlertTitle>
        <AlertDescription>
          The prototype is one rig on Wi-Fi. This section shows how it would scale. Every number here is generated.
        </AlertDescription>
      </Alert>

      <section className="flex flex-col gap-3">
        <SectionLabel>Select a gateway or tool</SectionLabel>
        <div className="grid gap-4 md:grid-cols-3">
          {gateways.map((g, i) => {
            const mine = net.nodes.filter((n) => n.gatewayId === g.id)
            const good = mine.filter((n) => n.snr >= 0).length
            return (
              <Tile
                key={g.id}
                to={paths.gateway(g.id)}
                hotkey={String(i + 1)}
                dashed
                eyebrow={`Gateway / ${g.backhaul}`}
                title={`${g.id} ${g.name}`}
                subtitle={`${g.status === "online" ? "Online" : "Offline"} / ${mine.length} nodes in range`}
                metric={mine.length}
                metricLabel="nodes"
                bar={(good / mine.length) * 100}
                barLabel="Links with SNR above 0 dB"
                barRight={`${good}/${mine.length}`}
              />
            )
          })}
          <Tile
            to={paths.battery}
            hotkey="3"
            dashed
            eyebrow="Tool / Concept"
            title="Battery planner"
            subtitle="Wake interval, capture length, storm share, spreading factor."
            metric={bat.years.toFixed(1)}
            metricLabel="years projected"
            bar={(bat.years / 10) * 100}
            barLabel={CAVEAT}
            barRight={fleet ? "plan pushed" : undefined}
          />
        </div>
      </section>

      <Panel eyebrow="Topology" title="From manhole to dashboard" action={<ConceptTag />}>
        <Topology />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel eyebrow="Coverage" title="Link quality map" action={<ConceptTag />}>
          <LinkMap />
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {(["GREEN", "YELLOW", "RED"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={cn("h-0.5 w-5", STATE_META[s].dot)} /> SNR {s === "GREEN" ? ">= 5 dB" : s === "YELLOW" ? "0 to 5 dB" : "< 0 dB"}
              </span>
            ))}
            <span>Dashed = SF9 or higher</span>
          </div>
        </Panel>

        <Panel eyebrow="Packet" title="11-byte payload" action={<ConceptTag />}>
          <PayloadStrip />
        </Panel>
      </div>

      <Panel
        eyebrow="Live"
        title="Uplink log"
        action={
          <div className="flex items-center gap-2">
            <Num className="text-xs text-muted-foreground">{net.packetsLastHour} packets / h</Num>
            <ConceptTag />
          </div>
        }
      >
        <UplinkTable />
      </Panel>
    </LevelLayout>
  )
}

function PayloadStrip() {
  const spans = PAYLOAD_LAYOUT.map((p) => {
    const [a, b] = p.bytes.split("-").map(Number)
    return { ...p, from: a, to: b ?? a }
  })
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-11 gap-0.5">
        {spans.map((p) => (
          <div
            key={p.field}
            className="flex h-14 flex-col items-center justify-center rounded-[4px] border bg-muted/60 px-0.5 text-center"
            style={{ gridColumn: `${p.from + 1} / span ${p.to - p.from + 1}` }}
          >
            <span className="w-full truncate font-mono text-[10px] font-semibold">{p.field.split(" ")[0]}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{p.bytes}</span>
          </div>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Byte</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Encoding</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PAYLOAD_LAYOUT.map((p) => (
            <TableRow key={p.field}>
              <TableCell className="font-mono text-xs">{p.bytes}</TableCell>
              <TableCell className="font-mono text-xs">{p.field}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{p.note}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        11 bytes of payload plus 13 bytes of LoRaWAN overhead: {airtimeMs(7).toFixed(0)} ms on air at SF7,{" "}
        {airtimeMs(10).toFixed(0)} ms at SF10.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Gateway                                                             */
/* ------------------------------------------------------------------ */

export function GatewayRoute() {
  const { gwId } = useParams()
  const g = gateways.find((x) => x.id === gwId)
  if (!g) return <NotFound what="gateway" />
  return <GatewayView key={g.id} g={g} />
}

function GatewayView({ g }: { g: Gateway }) {
  const net = useNetwork()
  const busyPing = useLaneBusy(`gw:${g.id}`)
  const mine = net.nodes.filter((n) => n.gatewayId === g.id)
  const sfCounts = [7, 8, 9, 10].map((sf) => ({ sf: `SF${sf}`, n: mine.filter((m) => m.spreadingFactor === sf).length }))
  const meanSnr = mine.reduce((a, n) => a + n.snr, 0) / mine.length
  const meanRssi = mine.reduce((a, n) => a + n.rssi, 0) / mine.length

  const commands: Command[] = [
    {
      id: "ping",
      hotkey: "g",
      label: "Ping gateway",
      icon: WifiIcon,
      mode: "sim",
      primary: true,
      hint: "Round trip to the gateway and the network server.",
      disabled: busyPing,
      reason: "A command is already running on this gateway.",
      run: () =>
        queueSim({
          lane: `gw:${g.id}`,
          title: `Ping ${g.id}`,
          origin: `Network / ${g.id}`,
          seconds: 2,
          doneText: () => `${g.id} answered in ${g.backhaul === "Fibre" ? 24 : 88} ms via ${g.backhaul}`,
        }),
    },
    {
      id: "adr",
      hotkey: "a",
      label: "Rebalance spreading factors",
      icon: RefreshCwIcon,
      mode: "sim",
      hint: "Adaptive data rate: faster SF where the link allows, saving airtime and battery.",
      disabled: busyPing,
      reason: "A command is already running on this gateway.",
      run: () =>
        queueSim({
          lane: `gw:${g.id}`,
          title: `Rebalance SFs on ${g.id}`,
          origin: `Network / ${g.id}`,
          seconds: 4,
          doneText: () => `${mine.length} nodes re-evaluated (simulated)`,
        }),
    },
  ]

  return (
    <LevelLayout
      crumbs={[TOWNSHIP_CRUMB, NET_CRUMB, { label: g.id, to: paths.gateway(g.id) }]}
      level="Gateway"
      depthMax={2}
      title={`${g.id} ${g.name}`}
      subtitle={`${g.backhaul} backhaul. ${mine.length} nodes are in range.`}
      badges={
        <>
          <Badge variant="outline">{g.status === "online" ? "Online" : "Offline"}</Badge>
          <ConceptTag />
        </>
      }
      commands={<CommandPanel title={`${g.id} orders`} commands={commands} />}
    >
      <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 md:grid-cols-4">
        <Stat label="Nodes" value={mine.length} />
        <Stat label="Mean SNR" value={`${meanSnr.toFixed(1)} dB`} />
        <Stat label="Mean RSSI" value={`${meanRssi.toFixed(0)} dBm`} />
        <Stat label="Backhaul" value={g.backhaul} />
      </div>

      <section className="flex flex-col gap-3">
        <SectionLabel>Select a node</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mine.map((n, i) => (
            <Tile
              key={n.id}
              to={paths.manhole(n)}
              hotkey={i < 9 ? String(i + 1) : undefined}
              dashed
              state={n.state}
              eyebrow={`SF${n.spreadingFactor} / ${airtimeMs(n.spreadingFactor).toFixed(0)} ms airtime`}
              title={`${n.id} ${n.name}`}
              metric={n.rssi}
              metricLabel="dBm RSSI"
              bar={Math.max(0, Math.min(100, ((n.snr + 20) / 30) * 100))}
              barLabel="Link margin"
              barRight={`SNR ${n.snr.toFixed(1)} dB`}
              tags={<Tag>{n.lastUplinkMinAgo} min ago</Tag>}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Spread" title="Spreading factors in use" action={<ConceptTag />}>
          <ChartContainer config={{ n: { label: "Nodes", color: "var(--foreground)" } } satisfies ChartConfig} className="aspect-auto h-40 w-full">
            <BarChart data={sfCounts} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="2 4" />
              <XAxis dataKey="sf" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} width={20} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="n" fill="var(--color-n)" fillOpacity={0.8} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        </Panel>
        <Panel eyebrow="Live" title="Uplinks through this gateway" action={<ConceptTag />}>
          <UplinkTable gw={g.id} rows={6} />
        </Panel>
      </div>
    </LevelLayout>
  )
}

/* ------------------------------------------------------------------ */
/* Battery planner                                                     */
/* ------------------------------------------------------------------ */

const batteryConfig = { mahDay: { label: "mAh per day", color: "var(--foreground)" } } satisfies ChartConfig

function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  note,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit: string
  onChange: (v: number) => void
  note?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <Num className="font-semibold">
          {value.toLocaleString()} {unit}
        </Num>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} aria-label={label} />
      {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
    </div>
  )
}

export function BatteryPage() {
  const navigate = useNavigate()
  const [b, setB] = useState<BatteryInputs>(DEFAULT_BATTERY)
  const busy = useLaneBusy("network")
  const fleet = useGame((s) => s.fleetPlan)
  const set = (patch: Partial<BatteryInputs>) => setB((x) => ({ ...x, ...patch }))
  const p = projectBattery(b)
  const air = airtimeMs(b.sf)
  const total = p.breakdown.reduce((a, x) => a + x.mahDay, 0)

  const commands: Command[] = [
    {
      id: "apply",
      hotkey: "a",
      label: "Push plan to all nodes",
      icon: RadioTowerIcon,
      mode: "sim",
      primary: true,
      hint: `Projected ${p.years.toFixed(1)} years. ${CAVEAT}.`,
      disabled: busy,
      reason: "The network is already busy.",
      run: () => queueFleetPlan(p.years, "Battery planner"),
    },
    {
      id: "storm",
      hotkey: "s",
      label: "Storm-season profile",
      icon: BatteryChargingIcon,
      mode: "instant",
      run: () => setB({ ...b, wakeIntervalMin: 10, stormPct: 30, stormIntervalMin: 2, captureSec: 8, sf: 9 }),
    },
    {
      id: "reset",
      hotkey: "r",
      label: "Reset to defaults",
      icon: RefreshCwIcon,
      mode: "instant",
      run: () => setB(DEFAULT_BATTERY),
    },
    {
      id: "net",
      hotkey: "n",
      label: "Back to Network",
      icon: ExternalLinkIcon,
      mode: "nav",
      run: () => navigate(paths.network),
    },
  ]

  return (
    <LevelLayout
      crumbs={[TOWNSHIP_CRUMB, NET_CRUMB, { label: "Battery planner", to: paths.battery }]}
      level="Tool"
      depthMax={2}
      title="Battery planner"
      subtitle="Tune the wake plan and see what it costs the cell."
      badges={<ConceptTag />}
      commands={<CommandPanel title="Planner orders" commands={commands} />}
    >
      <Alert>
        <BatteryChargingIcon />
        <AlertTitle>{CAVEAT}</AlertTitle>
        <AlertDescription>
          Current figures are placeholders (25 mA capture, 45 mA transmit, 8 uA sleep). A real number needs a
          bench measurement of the finished node.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel eyebrow="Wake plan" title="Inputs" action={<ConceptTag />}>
          <Knob label="Normal wake interval" value={b.wakeIntervalMin} min={5} max={120} step={5} unit="min" onChange={(v) => set({ wakeIntervalMin: v })} />
          <Knob label="Capture length" value={b.captureSec} min={1} max={15} unit="s" onChange={(v) => set({ captureSec: v })} />
          <Knob label="Storm-mode interval" value={b.stormIntervalMin} min={1} max={10} unit="min" onChange={(v) => set({ stormIntervalMin: v })} />
          <Knob label="Time in storm mode" value={b.stormPct} min={0} max={50} unit="%" onChange={(v) => set({ stormPct: v })} />
          <Knob
            label="Spreading factor"
            value={b.sf}
            min={7}
            max={10}
            unit={`SF (${air.toFixed(0)} ms on air)`}
            onChange={(v) => set({ sf: v })}
            note="Higher SF reaches further but stays on air longer."
          />
          <Knob label="Cell capacity" value={b.capacityMah} min={2000} max={30000} step={1000} unit="mAh" onChange={(v) => set({ capacityMah: v })} />
        </Panel>

        <Panel eyebrow="Projection" title="How long it lasts">
          <div className="flex items-end gap-2">
            <Num className="text-6xl leading-none font-bold">{p.years.toFixed(1)}</Num>
            <span className="pb-1 text-lg text-muted-foreground">years</span>
            {p.years >= 10 && <Badge variant="outline">capped at 10</Badge>}
          </div>
          <div className="flex flex-col gap-1">
            <div
              className="h-3 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={p.years}
              aria-valuemax={10}
            >
              <div
                className={cn("h-full rounded-full", p.years >= 5 ? "bg-emerald-500" : p.years >= 2 ? "bg-amber-500" : "bg-red-500")}
                style={{ width: `${Math.min(100, (p.years / 10) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0</span>
              <span>target 5+</span>
              <span>10 yr</span>
            </div>
          </div>
          <KeyValue
            rows={[
              ["Wakes per day", p.wakesPerDay.toFixed(0)],
              ["Energy per day", `${p.mahPerDay.toFixed(2)} mAh`],
              ["Airtime per uplink", `${air.toFixed(0)} ms`],
              ["Usable capacity", `${(b.capacityMah * 0.8).toLocaleString()} mAh (80%)`],
            ]}
          />
          {fleet && (
            <p className="rounded-lg border border-dashed p-2.5 text-xs text-muted-foreground">
              Plan pushed at {fmtTime(fleet.at)} projecting {fleet.years.toFixed(1)} years (simulated).
            </p>
          )}
        </Panel>
      </div>

      <Panel eyebrow="Energy budget" title="Where the charge goes" action={<ConceptTag />}>
        <ChartContainer config={batteryConfig} className="aspect-auto h-44 w-full">
          <BarChart data={p.breakdown} layout="vertical" margin={{ left: 12, right: 24, top: 4, bottom: 0 }}>
            <CartesianGrid horizontal={false} strokeDasharray="2 4" />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis dataKey="name" type="category" width={110} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(v) => <Num>{Number(v).toFixed(3)} mAh/day</Num>} />} />
            <Bar dataKey="mahDay" fill="var(--color-mahDay)" fillOpacity={0.8} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {p.breakdown.map((x) => (
                <Cell key={x.name} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {p.breakdown.map((x) => (
            <Stat key={x.name} label={x.name} value={`${((x.mahDay / total) * 100).toFixed(0)}%`} sub={`${x.mahDay.toFixed(3)} mAh/day`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={paths.network} className="text-xs underline underline-offset-4">
            Back to the network
          </Link>
          <Tag>{CAVEAT}</Tag>
        </div>
      </Panel>
    </LevelLayout>
  )
}
