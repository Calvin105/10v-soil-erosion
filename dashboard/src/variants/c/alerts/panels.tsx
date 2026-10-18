import { CheckIcon, ChevronRightIcon, DiamondIcon, MapPinIcon } from "lucide-react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { alerts, manholes, surfaceReports } from "@/data/seed"
import type { Alert, AlertStatus, SurfaceReport } from "@/data/types"
import { cn } from "@/lib/utils"
import { RingCompare, VriTrendChart } from "../charts"
import { STATE_HEX, STATE_TEXT, fmt } from "../lib"
import { StatePill, Stat } from "../prototype/widgets"
import { LIFECYCLE, cstore, useC } from "../store"
import { FloatingCard, SheetCloseButton, SheetSection } from "../ui"

const mhById = Object.fromEntries(manholes.map((m) => [m.id, m]))

const PRIORITY_TONE: Record<string, string> = {
  P1: "bg-red-500 text-white dark:bg-red-500",
  P2: "bg-amber-500 text-white dark:bg-amber-500",
  P3: "bg-yellow-500 text-white dark:bg-yellow-600",
}

function StatusBadge({ status }: { status: AlertStatus }) {
  return (
    <Badge variant={status === "Closed" ? "secondary" : status === "New" ? "default" : "outline"} className="h-5 text-[11px]">
      {status}
    </Badge>
  )
}

// ---------- floating list ----------

export function AlertList({ selected }: { selected: string | null }) {
  const navigate = useNavigate()
  const statuses = useC((s) => s.alertStatus)
  const open = alerts.filter((a) => statuses[a.id] !== "Closed")
  const closed = alerts.filter((a) => statuses[a.id] === "Closed")
  const row = (a: Alert) => {
    const m = mhById[a.manholeId]
    const isClosed = statuses[a.id] === "Closed"
    return (
      <li key={a.id}>
        <button
          type="button"
          onClick={() => navigate(`/c/alerts/${a.id}`)}
          className={cn(
            "grid w-full grid-cols-[32px_1fr_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60",
            selected === a.id && "bg-muted",
            isClosed && "opacity-60"
          )}
        >
          <span
            className={cn(
              "grid size-8 place-items-center rounded-full font-mono text-[11px] font-semibold",
              isClosed ? "bg-muted-foreground/30 text-foreground" : PRIORITY_TONE[a.priority]
            )}
          >
            {a.priority}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="font-mono font-semibold">{a.id}</span>
              <span className="truncate text-muted-foreground">{m.id}</span>
            </span>
            <span className="block truncate text-sm">{m.name}</span>
            <span className="block font-mono text-[11px] text-muted-foreground tabular-nums">
              VRI {a.vri} · {a.ringTimeRatio.toFixed(2)}x · {fmt.dateTime(a.raisedAt)}
            </span>
          </span>
          <span className="flex flex-col items-end gap-1">
            <StatusBadge status={statuses[a.id]} />
            <ChevronRightIcon className="size-3.5 text-muted-foreground" />
          </span>
        </button>
      </li>
    )
  }
  return (
    <FloatingCard className="inset-x-3 bottom-3 max-h-[40svh] lg:inset-x-auto lg:top-[68px] lg:bottom-auto lg:left-3 lg:max-h-[calc(100%-92px)] lg:w-[348px]">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="text-sm font-medium">Alerts</div>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{open.length} open</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: STATE_HEX.RED }} /> alert
          <DiamondIcon className="ml-1.5 size-2.5" /> report
        </span>
      </div>
      <div className="flex min-h-0 flex-col overflow-y-auto">
        <ul className="divide-y">{open.map(row)}</ul>
        {closed.length > 0 && (
          <>
            <div className="border-y bg-muted/40 px-4 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Closed</div>
            <ul className="divide-y">{closed.map(row)}</ul>
          </>
        )}
        <div className="border-y bg-muted/40 px-4 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Surface reports (S1 portal)
        </div>
        <ul className="divide-y">
          {surfaceReports.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => navigate(`/c/alerts/${r.id}`)}
                className={cn(
                  "grid w-full grid-cols-[32px_1fr_auto] items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/60",
                  selected === r.id && "bg-muted"
                )}
              >
                <span className="grid size-8 place-items-center">
                  <span className="size-3.5 rotate-45 rounded-[3px] border-2 border-foreground bg-background" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm">{r.category}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground tabular-nums">
                    {r.id}
                    {r.nearManholeId ? ` · near ${r.nearManholeId}` : ""} · {r.count}x
                  </span>
                </span>
                <Badge variant="outline" className="h-5 text-[11px]">
                  {r.status}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </FloatingCard>
  )
}

// ---------- lifecycle stepper ----------

function Lifecycle({ status }: { status: AlertStatus }) {
  const idx = LIFECYCLE.indexOf(status)
  return (
    <ol className="grid grid-cols-6 gap-0">
      {LIFECYCLE.map((s, i) => {
        const done = i < idx
        const cur = i === idx
        return (
          <li key={s} className="relative flex flex-col items-center gap-1.5 text-center">
            {i > 0 && (
              <span
                className={cn("absolute top-[11px] right-1/2 h-0.5 w-full", i <= idx ? "bg-foreground" : "bg-border")}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 grid size-[22px] place-items-center rounded-full border-2 bg-background text-[10px]",
                done && "border-foreground bg-foreground text-background",
                cur && "border-foreground ring-4 ring-foreground/15",
                !done && !cur && "border-border text-muted-foreground"
              )}
            >
              {done ? <CheckIcon className="size-3" /> : i + 1}
            </span>
            <span className={cn("text-[10px] leading-tight", cur ? "font-semibold text-foreground" : "text-muted-foreground")}>{s}</span>
          </li>
        )
      })}
    </ol>
  )
}

// ---------- sheet bodies ----------

function ReportCard({ r, onOpen }: { r: SurfaceReport; onOpen?: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      className="flex w-full flex-col gap-1 rounded-xl border bg-card/60 p-3 text-left text-xs transition-colors enabled:hover:bg-muted/60"
    >
      <div className="flex items-center gap-2">
        <DiamondIcon className="size-3 shrink-0" />
        <span className="font-mono font-semibold">{r.id}</span>
        <span className="truncate">{r.category}</span>
        <Badge variant="outline" className="ml-auto h-5 text-[11px]">
          {r.status}
        </Badge>
      </div>
      <div className="text-muted-foreground">
        {r.reporter} · {r.count} report{r.count > 1 ? "s" : ""} · relevance {r.relevance} · {fmt.dateTime(r.at)}
      </div>
    </button>
  )
}

export function AlertSheetBody({ alert }: { alert: Alert }) {
  const navigate = useNavigate()
  const statuses = useC((s) => s.alertStatus)
  const workOrders = useC((s) => s.workOrders)
  const status = statuses[alert.id]
  const m = mhById[alert.manholeId]
  const wo = workOrders.find((w) => w.alertId === alert.id)
  const idx = LIFECYCLE.indexOf(status)
  const next = LIFECYCLE[idx + 1]
  const linked = surfaceReports.filter((r) => alert.linkedReports.includes(r.id))
  const doneSteps = wo ? wo.steps.filter((s) => s.done).length : 0

  const advance = () => {
    if (!next) return
    cstore.setAlertStatus(alert.id, next)
    if (next === "Dispatched") cstore.ensureWorkOrder(alert.id, m.name, m.id)
    toast(`${alert.id} is now ${next}`)
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-3 border-b px-4 py-3.5">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold",
            status === "Closed" ? "bg-muted-foreground/30" : PRIORITY_TONE[alert.priority]
          )}
        >
          {alert.priority}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{alert.id}</span>
            <StatePill state={alert.state} />
            <StatusBadge status={status} />
          </div>
          <div className="mt-1 truncate text-base font-medium">{m.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {m.id} · {m.road} · raised {fmt.dateTime(alert.raisedAt)}
          </div>
        </div>
        <SheetCloseButton />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <SheetSection title="Lifecycle">
          <Lifecycle status={status} />
          <div className="flex gap-2">
            {next ? (
              <Button size="sm" onClick={advance} className="flex-1">
                Mark {next} <ChevronRightIcon />
              </Button>
            ) : (
              <p className="flex-1 rounded-lg bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">Closed. The node was re-baselined after repair.</p>
            )}
            {idx > 0 && (
              <Button size="sm" variant="ghost" onClick={() => cstore.setAlertStatus(alert.id, LIFECYCLE[idx - 1])}>
                Undo
              </Button>
            )}
          </div>
        </SheetSection>

        <SheetSection title="Evidence from the node">
          <p className="text-sm leading-relaxed">{alert.summary}</p>
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/40 p-3">
            <Stat label="VRI" value={alert.vri} valueClass={cn("text-xl font-semibold", STATE_TEXT[alert.state])} />
            <Stat label="Ring-time ratio" value={`${alert.ringTimeRatio.toFixed(2)}x`} valueClass="text-xl" />
            <Stat label="Node RSSI" value={m.rssi} unit="dBm" valueClass="text-xl" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">VRI, 14 days (simulated)</span>
              <VriTrendChart id={alert.id} vri={alert.vri} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Ring-down vs baseline (illustrative)</span>
              <RingCompare ratio={alert.ringTimeRatio} />
            </div>
          </div>
        </SheetSection>

        <SheetSection title={`Linked surface reports (${linked.length})`}>
          {linked.length === 0 ? (
            <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">No public report matches this alert yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {linked.map((r) => (
                <ReportCard key={r.id} r={r} onOpen={() => navigate(`/c/alerts/${r.id}`)} />
              ))}
            </div>
          )}
        </SheetSection>

        <SheetSection
          title="Work order"
          right={wo && <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{wo.id}</span>}
        >
          {wo ? (
            <div className="flex flex-col gap-3 rounded-xl border bg-card/60 p-3">
              <div>
                <div className="text-sm font-medium">{wo.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {wo.crew} · due {fmt.dateTime(wo.due)}
                </div>
              </div>
              <ul className="flex flex-col gap-2">
                {wo.steps.map((st, i) => (
                  <li key={i}>
                    <label className="flex items-start gap-2.5 text-sm">
                      <Checkbox className="mt-0.5" checked={st.done} onCheckedChange={() => cstore.toggleStep(wo.id, i)} />
                      <span className={cn(st.done && "text-muted-foreground line-through")}>{st.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {wo.status} · <span className="font-mono tabular-nums">{doneSteps}/{wo.steps.length}</span> steps
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-muted-foreground">Outcome</span>
                <ToggleGroup
                  type="single"
                  size="sm"
                  variant="outline"
                  spacing={0}
                  value={wo.outcome ?? "Pending"}
                  onValueChange={(v) => v && cstore.setOutcome(wo.id, v as NonNullable<typeof wo.outcome>)}
                  className="w-full"
                >
                  {(["Pending", "Void confirmed", "No void found"] as const).map((o) => (
                    <ToggleGroupItem key={o} value={o} className="flex-1 text-xs">
                      {o}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
              <span>A CCTV inspection work order is created when the alert is dispatched.</span>
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  cstore.ensureWorkOrder(alert.id, m.name, m.id)
                  toast("Work order created")
                }}
              >
                Create now
              </Button>
            </div>
          )}
        </SheetSection>

        <Button variant="outline" size="sm" onClick={() => navigate(`/c/network/${m.id}`)}>
          <MapPinIcon /> Open {m.id} on the network map
        </Button>
      </div>
    </div>
  )
}

export function ReportSheetBody({ report }: { report: SurfaceReport }) {
  const navigate = useNavigate()
  const statuses = useC((s) => s.alertStatus)
  const m = report.nearManholeId ? mhById[report.nearManholeId] : null
  const parents = alerts.filter((a) => a.linkedReports.includes(report.id))
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-3 border-b px-4 py-3.5">
        <span className="grid size-9 shrink-0 place-items-center">
          <span className="size-4 rotate-45 rounded-[4px] border-2 border-foreground bg-background" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{report.id}</span>
            <Badge variant="outline" className="h-5 text-[11px]">
              {report.status}
            </Badge>
          </div>
          <div className="mt-1 text-base font-medium">{report.category}</div>
          <div className="text-xs text-muted-foreground">Surface report from the public portal (S1)</div>
        </div>
        <SheetCloseButton />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3">
          <Stat label="Reporter" value={report.reporter} />
          <Stat label="Received" value={fmt.dateTime(report.at)} />
          <Stat label="Reports at this spot" value={report.count} />
          <Stat label="Relevance to voids" value={report.relevance} />
        </div>
        <SheetSection title="Location">
          <p className="font-mono text-xs text-muted-foreground tabular-nums">
            {report.lat.toFixed(4)}, {report.lon.toFixed(4)}
          </p>
          {m ? (
            <Button variant="outline" size="sm" className="justify-start" onClick={() => navigate(`/c/network/${m.id}`)}>
              <MapPinIcon /> Nearest node {m.id}: {m.name}
            </Button>
          ) : (
            <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
              No sensor node within range. This report is the only evidence here, so it only raises the Evidence layer in the risk view.
            </p>
          )}
        </SheetSection>
        <SheetSection title="Linked alerts">
          {parents.length === 0 ? (
            <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">Not linked to an alert.</p>
          ) : (
            parents.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => navigate(`/c/alerts/${a.id}`)}
                className="flex items-center gap-2 rounded-xl border p-3 text-left text-xs transition-colors hover:bg-muted/60"
              >
                <span className="font-mono font-semibold">{a.id}</span>
                <StatePill state={a.state} />
                <span className="ml-auto text-muted-foreground">{statuses[a.id]}</span>
                <ChevronRightIcon className="size-3.5" />
              </button>
            ))
          )}
        </SheetSection>
      </div>
    </div>
  )
}
