import { useMemo, useState } from "react"
import {
  AudioWaveformIcon,
  CheckIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  FileTextIcon,
  HistoryIcon,
  MapPinIcon,
  PlusIcon,
  SirenIcon,
} from "lucide-react"
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet"
import { toast } from "sonner"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { manholes, surfaceReports, zones } from "@/data/seed"
import type { Alert, AlertStatus, Manhole, WorkOrder } from "@/data/types"
import { cn } from "@/lib/utils"

import { LIFECYCLE, advanceAlert, createWorkOrder, ops, setOutcome, toggleStep, useStore } from "../store"
import { Num, Pane, STATE, Stat, StatePill, TD, TDN, TH, Tag, dateTime, ratioZone, zoneOf } from "../ui"
import { MapSizer, TILE_ATTR, TILE_URL } from "../widgets/map"

const mhOf = (id: string) => manholes.find((m) => m.id === id) as Manhole

const PRIORITY_CLS: Record<Alert["priority"], string> = {
  P1: `${STATE.RED.text} border-red-500/50 bg-red-500/10`,
  P2: `${STATE.YELLOW.text} border-amber-500/50 bg-amber-500/10`,
  P3: "text-muted-foreground",
}

/** Six-segment lifecycle meter for the queue rows. */
function LifecycleBar({ status }: { status: AlertStatus }) {
  const idx = LIFECYCLE.indexOf(status)
  return (
    <div className="flex gap-px" title={`Lifecycle: ${status}`}>
      {LIFECYCLE.map((s, i) => (
        <span
          key={s}
          className={cn("h-1 w-3.5 first:rounded-l-full last:rounded-r-full", i <= idx ? "bg-foreground/80" : "bg-muted")}
        />
      ))}
    </div>
  )
}

// ---------- queue ----------

type Filter = "all" | "open" | "closed"

function Queue({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const { alerts } = useStore(ops)
  const [filter, setFilter] = useState<Filter>("all")
  const rows = alerts.filter((a) => (filter === "all" ? true : filter === "open" ? a.status !== "Closed" : a.status === "Closed"))
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b p-1.5">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={filter}
          onValueChange={(v) => v && setFilter(v as Filter)}
        >
          {(["all", "open", "closed"] as const).map((f) => (
            <ToggleGroupItem key={f} value={f} className="h-6 px-2 text-[11px] capitalize">
              {f}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{rows.length} shown</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="flex flex-col gap-1 p-1.5">
          {rows.map((a) => {
            const m = mhOf(a.manholeId)
            const isSel = a.id === selected
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onSelect(a.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-md border bg-card p-2 text-left transition-colors hover:bg-muted/50",
                    isSel && "ring-2 ring-foreground/70",
                    a.status === "Closed" && "opacity-65"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <StatePill state={a.state} compact />
                    <span className="font-mono text-[11px] font-semibold">{a.id}</span>
                    <Tag className={PRIORITY_CLS[a.priority]}>{a.priority}</Tag>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">{dateTime(a.raisedAt)}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 text-[11px] leading-tight">
                    <span className="font-mono font-semibold">{a.manholeId}</span>
                    <span className="truncate text-muted-foreground">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10.5px]">
                    <span className={STATE[zoneOf(a.vri)].text}>VRI {a.vri}</span>
                    <span className={STATE[ratioZone(a.ringTimeRatio)].text}>{a.ringTimeRatio.toFixed(2)}x</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="text-muted-foreground">{a.status}</span>
                      <LifecycleBar status={a.status} />
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}

// ---------- detail ----------

function Stepper({ status }: { status: AlertStatus }) {
  const idx = LIFECYCLE.indexOf(status)
  return (
    <ol className="grid grid-cols-6">
      {LIFECYCLE.map((s, i) => {
        const done = i < idx
        const cur = i === idx
        return (
          <li key={s} className="relative flex flex-col items-center gap-1">
            {i > 0 && (
              <span
                className={cn(
                  "absolute top-[9px] right-1/2 left-[-50%] h-px",
                  i <= idx ? "bg-foreground/70" : "bg-border"
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-[19px] items-center justify-center rounded-full border font-mono text-[9px]",
                done && "border-foreground bg-foreground text-background",
                cur && "border-foreground bg-background ring-2 ring-foreground/25",
                !done && !cur && "bg-card text-muted-foreground"
              )}
            >
              {done ? <CheckIcon className="size-3" /> : i + 1}
            </span>
            <span className={cn("text-[10.5px] leading-tight", cur ? "font-semibold" : "text-muted-foreground")}>{s}</span>
          </li>
        )
      })}
    </ol>
  )
}

const ringConfig = {
  now: { label: "Now", color: "var(--foreground)" },
  base: { label: "Baseline", color: "var(--muted-foreground)" },
} satisfies ChartConfig

/** Ring-down overlay rebuilt from the alert's ratio (baseline tau 8 ms, the rig's packed value). */
function RingEvidence({ ratio }: { ratio: number }) {
  const data = useMemo(() => {
    const tau0 = 8
    return Array.from({ length: 41 }, (_, i) => {
      const t = i * 2
      return { t, base: Math.exp(-t / tau0), now: Math.exp(-t / (tau0 * ratio)) }
    })
  }, [ratio])
  return (
    <ChartContainer config={ringConfig} className="aspect-auto h-full w-full">
      <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis dataKey="t" type="number" domain={[0, 80]} ticks={[0, 20, 40, 60, 80]} tickFormatter={(v: number) => `${v}ms`} tickLine={false} axisLine={false} fontSize={9} height={16} />
        <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickLine={false} axisLine={false} fontSize={9} width={30} />
        <ReferenceLine x={8} stroke="var(--muted-foreground)" strokeDasharray="2 2" />
        <ReferenceLine x={8 * ratio} stroke="var(--foreground)" strokeDasharray="2 2" />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Line dataKey="base" type="monotone" stroke="var(--color-base)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
        <Line dataKey="now" type="monotone" stroke="var(--color-now)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  )
}

function Reports({ alert }: { alert: Alert }) {
  const rows = surfaceReports.filter((r) => alert.linkedReports.includes(r.id) || r.nearManholeId === alert.manholeId)
  if (!rows.length)
    return <div className="p-3 text-center text-[11px] text-muted-foreground">No surface reports linked or nearby.</div>
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={TH}>Report</TableHead>
          <TableHead className={TH}>Category</TableHead>
          <TableHead className={TH}>Relevance</TableHead>
          <TableHead className={cn(TH, "text-right")}>#</TableHead>
          <TableHead className={TH}>Source</TableHead>
          <TableHead className={TH}>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className={cn(TD, "font-mono font-semibold")}>{r.id}</TableCell>
            <TableCell className={cn(TD, "max-w-[160px] truncate")} title={r.category}>
              {r.category}
            </TableCell>
            <TableCell className={TD}>
              <Tag className={r.relevance === "High" ? `${STATE.RED.text} border-red-500/40` : ""}>{r.relevance}</Tag>
            </TableCell>
            <TableCell className={TDN}>{r.count}</TableCell>
            <TableCell className={cn(TD, "max-w-[110px] truncate text-muted-foreground")} title={r.reporter}>
              {r.reporter}
            </TableCell>
            <TableCell className={TD}>
              <Tag className={r.status === "Linked to alert" ? "border-foreground/50 text-foreground" : ""}>{r.status}</Tag>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}


function Timeline({ alert }: { alert: Alert }) {
  const { workOrders } = useStore(ops)
  const idx = LIFECYCLE.indexOf(alert.status)
  const wo = workOrders.find((w) => w.alertId === alert.id)
  const timed = [
    ...surfaceReports
      .filter((r) => alert.linkedReports.includes(r.id))
      .map((r) => ({ t: new Date(r.at).getTime(), text: `${r.id} received: ${r.category} (x${r.count})`, tone: "report" as const })),
    {
      t: new Date(alert.raisedAt).getTime(),
      text: `Alert raised ${alert.state}: VRI ${alert.vri}, ring-time ${alert.ringTimeRatio.toFixed(2)}x`,
      tone: "alert" as const,
    },
  ].sort((a, b) => a.t - b.t)
  const untimed = [
    ...LIFECYCLE.slice(1, idx + 1).map((s) => ({ t: null as number | null, text: `Moved to ${s}`, tone: "status" as const })),
    ...(wo
      ? [
          {
            t: null as number | null,
            text: `${wo.id} ${wo.status.toLowerCase()}: ${wo.steps.filter((x) => x.done).length}/${wo.steps.length} steps done${wo.outcome && wo.outcome !== "Pending" ? `, ${wo.outcome.toLowerCase()}` : ""}`,
            tone: "wo" as const,
          },
        ]
      : []),
  ]
  const items = [...timed.map((x) => ({ ...x, t: x.t as number | null })), ...untimed]
  return (
    <ol className="min-h-0 flex-1 overflow-y-auto rounded-sm border bg-muted/20 px-2 py-1.5">
      {items.map((it, i) => (
        <li key={i} className="relative grid grid-cols-[48px_10px_1fr] items-baseline gap-x-2 pb-1 text-[11px] leading-snug last:pb-0">
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{it.t ? dateTime(new Date(it.t).toISOString()).slice(-5) : "--:--"}</span>
          <span className="relative flex justify-center self-stretch">
            {i < items.length - 1 && <span className="absolute top-2.5 -bottom-1.5 w-px bg-border" />}
            <span
              className={cn(
                "relative mt-1 size-2 rounded-full border bg-card",
                it.tone === "alert" && "border-red-500 bg-red-500",
                it.tone === "report" && "border-foreground",
                it.tone === "status" && "border-foreground bg-foreground",
                it.tone === "wo" && "border-muted-foreground"
              )}
            />
          </span>
          <span>{it.text}</span>
        </li>
      ))}
    </ol>
  )
}

function Detail({ alert }: { alert: Alert }) {
  const { workOrders } = useStore(ops)
  const m = mhOf(alert.manholeId)
  const zone = zones.find((z) => z.id === m.zoneId)
  const idx = LIFECYCLE.indexOf(alert.status)
  const next = LIFECYCLE[idx + 1] as AlertStatus | undefined
  const hasWo = workOrders.some((w) => w.alertId === alert.id)

  function advance() {
    if (!next) return
    advanceAlert(alert.id)
    if (next === "Dispatched" && !hasWo) createWorkOrder(alert.id)
    toast(`${alert.id}: ${next}`, {
      description:
        next === "Inspected"
          ? "Record the CCTV / GPR outcome on the work order. It becomes a ground-truth label."
          : next === "Dispatched" && !hasWo
            ? "Work order created from template."
            : undefined,
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-semibold">{alert.id}</span>
            <StatePill state={alert.state} />
            <Tag className={PRIORITY_CLS[alert.priority]}>{alert.priority}</Tag>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            <span className="font-mono text-foreground">{m.id}</span> {m.name}, {m.road} / {zone?.name}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {next ? (
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={advance}>
              {next === "Acknowledged" ? "Acknowledge" : next === "Dispatched" ? "Dispatch crew" : next === "Inspected" ? "Mark inspected" : next === "Repaired" ? "Mark repaired" : "Close alert"}
              <ChevronRightIcon className="size-3.5" />
            </Button>
          ) : (
            <Tag className="h-6 border-foreground/40 px-2 text-foreground">CLOSED</Tag>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-muted/20 px-3 py-2.5">
        <Stepper status={alert.status} />
      </div>

      <p className="rounded-sm border-l-2 border-foreground/40 bg-muted/30 px-2 py-1.5 text-[11.5px] leading-snug">{alert.summary}</p>

      <div className="grid h-[178px] shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-2">
        <div className="flex flex-col gap-1.5">
          <div className="text-[9px] tracking-wider text-muted-foreground uppercase">Evidence bundle</div>
          <div className="grid grid-cols-3 gap-1">
            <Stat label="VRI" value={alert.vri} valueClassName={STATE[zoneOf(alert.vri)].text} />
            <Stat label="Ring x" value={`${alert.ringTimeRatio.toFixed(2)}x`} valueClassName={STATE[ratioZone(alert.ringTimeRatio)].text} />
            <Stat label="Wet flag" value={m.wet ? "WET" : "DRY"} valueClassName="text-sm" />
          </div>
          <dl className="grid grid-cols-2 gap-x-3 font-mono text-[10.5px] leading-[18px]">
            <dt className="text-muted-foreground">Asset</dt>
            <dd className="truncate text-right font-sans text-[11px]" title={m.asset}>{m.asset}</dd>
            <dt className="text-muted-foreground">Mount height</dt>
            <dd className="text-right tabular-nums">{m.mountHeightM.toFixed(1)} m</dd>
            <dt className="text-muted-foreground">Gateway / SF</dt>
            <dd className="text-right tabular-nums">{m.gatewayId} / SF{m.spreadingFactor}</dd>
            <dt className="text-muted-foreground">RSSI / SNR</dt>
            <dd className="text-right whitespace-nowrap tabular-nums">{m.rssi} / {m.snr.toFixed(1)} dB</dd>
            <dt className="text-muted-foreground">Battery</dt>
            <dd className="text-right tabular-nums">{m.batteryPct}%</dd>
            <dt className="text-muted-foreground">Installed</dt>
            <dd className="text-right tabular-nums">{m.installedOn}</dd>
          </dl>
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="mb-0.5 flex items-center justify-between text-[9px] tracking-wider text-muted-foreground uppercase">
            <span className="flex items-center gap-1">
              <AudioWaveformIcon className="size-3" />
              Ring-down overlay
            </span>
            <span className="font-mono normal-case">rebuilt from {alert.ringTimeRatio.toFixed(2)}x, tau0 8 ms</span>
          </div>
          <div className="min-h-0 flex-1 rounded-sm border bg-card p-1">
            <RingEvidence ratio={alert.ringTimeRatio} />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col">
        <div className="mb-0.5 flex items-center gap-1 text-[9px] tracking-wider text-muted-foreground uppercase">
          <FileTextIcon className="size-3" />
          Surface reports (S1 / S2)
        </div>
        <div className="overflow-hidden rounded-sm border">
          <Reports alert={alert} />
        </div>
      </div>

      <div className="flex min-h-[90px] flex-1 flex-col">
        <div className="mb-0.5 flex items-center gap-1 text-[9px] tracking-wider text-muted-foreground uppercase">
          <HistoryIcon className="size-3" />
          Timeline
          <span className="ml-auto font-mono normal-case">status times are not stored in seed data</span>
        </div>
        <Timeline alert={alert} />
      </div>
    </div>
  )
}

// ---------- work order ----------

function WorkOrderCard({ wo }: { wo: WorkOrder }) {
  const done = wo.steps.filter((s) => s.done).length
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card p-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold">{wo.id}</span>
            <Tag
              className={cn(
                wo.status === "Done" && `${STATE.GREEN.text} border-emerald-500/40`,
                wo.status === "In progress" && `${STATE.YELLOW.text} border-amber-500/40`
              )}
            >
              {wo.status.toUpperCase()}
            </Tag>
          </div>
          <div className="mt-0.5 text-[11.5px] leading-snug font-medium">{wo.title}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 text-[10.5px]">
        <div>
          <div className="text-[9px] tracking-wider text-muted-foreground uppercase">Crew</div>
          {wo.crew}
        </div>
        <div>
          <div className="text-[9px] tracking-wider text-muted-foreground uppercase">Due</div>
          <span className="font-mono">{dateTime(wo.due)}</span>
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>STEPS</span>
          <span>
            {done}/{wo.steps.length}
          </span>
        </div>
        <Progress value={(done / wo.steps.length) * 100} className="mb-1.5 h-1" />
        <ul className="flex flex-col gap-1">
          {wo.steps.map((s, i) => (
            <li key={s.label}>
              <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-snug">
                <Checkbox className="mt-px size-3.5" checked={s.done} onCheckedChange={() => toggleStep(wo.id, i)} />
                <span className={cn(s.done && "text-muted-foreground line-through")}>{s.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t pt-1.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[9px] tracking-wider text-muted-foreground uppercase">Inspection outcome</span>
          <span className="font-mono text-[9px] text-muted-foreground">label for S3</span>
        </div>
        <Select value={wo.outcome ?? "Pending"} onValueChange={(v) => setOutcome(wo.id, v as NonNullable<WorkOrder["outcome"]>)}>
          <SelectTrigger size="sm" className="h-7 w-full text-xs" aria-label="Inspection outcome">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["Pending", "Void confirmed", "No void found"] as const).map((o) => (
              <SelectItem key={o} value={o} className="text-xs">
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function AllWorkOrders({ selectedAlert }: { selectedAlert: string }) {
  const { workOrders } = useStore(ops)
  return (
    <div className="rounded-md border">
      <div className="border-b bg-muted/40 px-2 py-1 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
        All work orders
      </div>
      <ul>
        {workOrders.map((w) => {
          const done = w.steps.filter((x) => x.done).length
          return (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => ops.set({ selectedAlertId: w.alertId })}
                className={cn(
                  "grid w-full grid-cols-[52px_1fr_auto] items-center gap-x-2 border-b px-2 py-1 text-left text-[10.5px] last:border-0 hover:bg-muted/50",
                  w.alertId === selectedAlert && "bg-muted/60"
                )}
              >
                <span className="font-mono font-semibold">{w.id}</span>
                <span className="min-w-0">
                  <span className="block truncate leading-tight">{w.title}</span>
                  <span className="block truncate font-mono text-[9.5px] leading-tight text-muted-foreground">
                    {w.alertId} / {w.status} / {done}/{w.steps.length}
                  </span>
                </span>
                <Progress value={(done / w.steps.length) * 100} className="h-1 w-10" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function WorkOrders({ alert }: { alert: Alert }) {
  const { workOrders } = useStore(ops)
  const mine = workOrders.filter((w) => w.alertId === alert.id)
  return (
    <div className="flex h-full flex-col gap-1.5 overflow-y-auto p-2">
      {mine.map((w) => (
        <WorkOrderCard key={w.id} wo={w} />
      ))}
      {!mine.length && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed p-4 text-center">
          <ClipboardListIcon className="size-5 text-muted-foreground" />
          <div className="text-[11px] text-muted-foreground">No work order for {alert.id} yet. Dispatching creates one.</div>
          <Button size="xs" variant="outline" onClick={() => createWorkOrder(alert.id)}>
            <PlusIcon />
            Create work order
          </Button>
        </div>
      )}
      <AllWorkOrders selectedAlert={alert.id} />
    </div>
  )
}

// ---------- mini map ----------

function AlertMap({ alert }: { alert: Alert }) {
  const m = mhOf(alert.manholeId)
  const reports = surfaceReports.filter((r) => alert.linkedReports.includes(r.id) || r.nearManholeId === alert.manholeId)
  return (
    <div className="va-map absolute inset-0">
      <MapContainer key={alert.id} center={[m.lat, m.lon]} zoom={17} className="h-full w-full">
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} maxZoom={19} />
        <MapSizer />
        {manholes
          .filter((x) => x.id !== m.id)
          .map((x) => (
            <CircleMarker
              key={x.id}
              center={[x.lat, x.lon]}
              radius={4}
              pathOptions={{ color: "var(--background)", weight: 1, fillColor: STATE[x.state].hex, fillOpacity: 0.7 }}
            >
              <Tooltip>{x.id}</Tooltip>
            </CircleMarker>
          ))}
        {reports.map((r) => (
          <Polyline
            key={`l${r.id}`}
            positions={[
              [m.lat, m.lon],
              [r.lat, r.lon],
            ]}
            pathOptions={{ color: "var(--foreground)", weight: 1, dashArray: "3 4", opacity: 0.7 }}
          />
        ))}
        {reports.map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.lat, r.lon]}
            radius={6}
            pathOptions={{ color: "var(--foreground)", weight: 2, fillColor: "var(--background)", fillOpacity: 1 }}
          >
            <Tooltip permanent direction="top" offset={[0, -6]}>
              {r.id}: {r.category}
            </Tooltip>
          </CircleMarker>
        ))}
        <CircleMarker
          center={[m.lat, m.lon]}
          radius={10}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: STATE[alert.state].hex, fillOpacity: 1 }}
        >
          <Tooltip permanent direction="right" offset={[10, 0]}>
            <span className="font-mono font-semibold">{m.id}</span>
          </Tooltip>
        </CircleMarker>
        {alert.state === "RED" && (
          <CircleMarker
            center={[m.lat, m.lon]}
            radius={10}
            interactive={false}
            pathOptions={{ color: STATE.RED.hex, weight: 2, fill: false, className: "va-ping" }}
          />
        )}
      </MapContainer>
    </div>
  )
}

// ---------- page ----------

export function AlertsPage() {
  const { alerts, workOrders, selectedAlertId } = useStore(ops)
  const alert = alerts.find((a) => a.id === selectedAlertId) ?? alerts[0]
  const open = alerts.filter((a) => a.status !== "Closed").length
  const counts = LIFECYCLE.map((s) => ({ s, n: alerts.filter((a) => a.status === s).length }))
  const woOpen = workOrders.filter((w) => w.status !== "Done").length

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 p-1.5">
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
        <Stat label="Open alerts" value={open} className="w-[110px]" valueClassName={open ? STATE.YELLOW.text : undefined} />
        <Stat label="Open work orders" value={woOpen} className="w-[130px]" />
        <div className="flex h-full flex-1 items-stretch gap-px rounded-sm border bg-muted/30 px-2 py-1">
          {counts.map((c, i) => (
            <div key={c.s} className="flex min-w-0 flex-1 items-center gap-1.5">
              <div className="min-w-0">
                <div className="truncate text-[9px] tracking-wider text-muted-foreground uppercase">{c.s}</div>
                <Num className={cn("text-base leading-tight font-semibold", c.n === 0 && "text-muted-foreground")}>{c.n}</Num>
              </div>
              {i < counts.length - 1 && <ChevronRightIcon className="ml-auto size-3 shrink-0 text-muted-foreground/60" />}
            </div>
          ))}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[330px_minmax(0,1fr)_340px] gap-1.5">
        <Pane title="Alert queue" icon={SirenIcon} meta="seed data" bodyClassName="p-0">
          <Queue selected={alert.id} onSelect={(id) => ops.set({ selectedAlertId: id })} />
        </Pane>
        <Pane title="Alert detail" icon={SirenIcon} meta={`${alert.id} / ${alert.status}`} bodyClassName="p-0">
          <Detail alert={alert} />
        </Pane>
        <div className="flex min-h-0 flex-col gap-1.5">
          <div className="min-h-0 flex-[1.3]">
            <Pane title="Work order" icon={ClipboardListIcon} meta={alert.manholeId} bodyClassName="p-0">
              <WorkOrders alert={alert} />
            </Pane>
          </div>
          <div className="min-h-0 flex-1">
            <Pane title="Location" icon={MapPinIcon} meta="node and linked reports" bodyClassName="p-0">
              <AlertMap alert={alert} />
            </Pane>
          </div>
        </div>
      </div>
    </div>
  )
}
