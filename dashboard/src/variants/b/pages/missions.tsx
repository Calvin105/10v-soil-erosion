import {
  BellRingIcon,
  CheckCheckIcon,
  CheckIcon,
  ClipboardCheckIcon,
  FlagIcon,
  LockIcon,
  PlayIcon,
  TruckIcon,
  WrenchIcon,
} from "lucide-react"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRig } from "@/data/rig-sim"
import { surfaceReports } from "@/data/seed"
import type { Alert } from "@/data/types"
import { cn } from "@/lib/utils"

import { envelopeOf } from "../derive"
import { paths } from "../paths"
import {
  acknowledgeAlert,
  acknowledgeAllNew,
  busyCrews,
  closeMission,
  CREWS,
  dispatchCrew,
  escalateBench,
  fmtDateTime,
  LIFECYCLE,
  manholeById,
  markInspected,
  markRepaired,
  missionProgress,
  RIG_ID,
  toggleStep,
  useGame,
  woFor,
} from "../store"
import { KeyValue, Lifecycle, RatioReadout } from "../ui/blocks"
import { RingDownChart } from "../ui/charts"
import { CommandPanel, Picker, type Command } from "../ui/commands"
import { LevelLayout, Panel, TOWNSHIP_CRUMB, type Crumb } from "../ui/layout"
import { NotFound } from "../ui/not-found"
import { Num, SectionLabel, StateBadge } from "../ui/state"
import { Tag, Tile } from "../ui/tiles"

const MISSIONS_CRUMB: Crumb = { label: "Missions", to: paths.missions }
const PRIORITY_RANK = { P1: 0, P2: 1, P3: 2 } as const

/* ------------------------------------------------------------------ */
/* Missions (site)                                                     */
/* ------------------------------------------------------------------ */

export function MissionsPage() {
  const alerts = useGame((s) => s.alerts)
  const workOrders = useGame((s) => s.workOrders)
  const snap = useRig()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<"open" | "closed" | "all">("open")

  const sorted = [...alerts].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.raisedAt.localeCompare(a.raisedAt)
  )
  const shown = sorted.filter((a) => (filter === "all" ? true : filter === "open" ? a.status !== "Closed" : a.status === "Closed"))
  const open = sorted.filter((a) => a.status !== "Closed")
  const fresh = alerts.filter((a) => a.status === "New").length

  const commands: Command[] = [
    {
      id: "next",
      hotkey: "n",
      label: "Open top-priority mission",
      icon: PlayIcon,
      mode: "nav",
      primary: true,
      hint: open[0] ? `${open[0].id} at ${open[0].manholeId}, ${open[0].priority}` : undefined,
      disabled: !open.length,
      reason: "No open missions.",
      run: () => open[0] && navigate(paths.mission(open[0].id)),
    },
    {
      id: "ackall",
      hotkey: "a",
      label: "Acknowledge all new",
      icon: BellRingIcon,
      mode: "sim",
      disabled: !fresh,
      reason: "No new missions.",
      run: () => acknowledgeAllNew("Missions"),
    },
    {
      id: "bench",
      hotkey: "b",
      label: "Raise from bench reading",
      icon: FlagIcon,
      mode: "instant",
      disabled: snap.state === "GREEN" || alerts.some((a) => a.manholeId === RIG_ID && a.status !== "Closed"),
      reason: snap.state === "GREEN" ? "RIG-01 is GREEN." : "RIG-01 already has an open mission.",
      run: () => {
        const id = escalateBench(snap.vri, null, snap.state)
        toast.info(`Mission ${id} raised from the bench`)
        navigate(paths.mission(id))
      },
    },
  ]

  return (
    <LevelLayout
      crumbs={[TOWNSHIP_CRUMB, MISSIONS_CRUMB]}
      level="Site"
      depthMax={2}
      title="Missions"
      subtitle="Each alert is a mission. Select one, then work through its orders: acknowledge, dispatch, inspect, repair, close."
      badges={<Badge variant="outline">Seed data</Badge>}
      commands={<CommandPanel title="Mission orders" commands={commands} />}
    >
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Select a mission</SectionLabel>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((a, i) => {
          const pct = missionProgress({ workOrders }, a) * 100
          return (
            <Tile
              key={a.id}
              to={paths.mission(a.id)}
              hotkey={i < 9 ? String(i + 1) : undefined}
              state={a.state}
              eyebrow={`${a.priority} / ${a.status}`}
              title={`${a.id} at ${a.manholeId}`}
              subtitle={a.summary}
              metric={a.vri}
              metricLabel="VRI"
              bar={pct}
              barLabel={a.status}
              barRight={`${Math.round(pct)}%`}
              tags={
                <>
                  <Tag>{a.ringTimeRatio.toFixed(2)}x ring-down</Tag>
                  {a.linkedReports.length > 0 && <Tag>{a.linkedReports.length} linked report{a.linkedReports.length > 1 ? "s" : ""}</Tag>}
                  {a.manholeId === RIG_ID && <Tag>Bench</Tag>}
                </>
              }
            />
          )
        })}
        {shown.length === 0 && (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground md:col-span-2">
            Nothing here. Switch the filter or raise a mission from the bench.
          </p>
        )}
      </div>
    </LevelLayout>
  )
}

/* ------------------------------------------------------------------ */
/* Mission                                                             */
/* ------------------------------------------------------------------ */

export function MissionRoute() {
  const { alertId } = useParams()
  const exists = useGame((s) => s.alerts.some((a) => a.id === alertId))
  if (!exists || !alertId) return <NotFound what="mission" />
  return <MissionView key={alertId} id={alertId} />
}

type Order = {
  key: "ack" | "dispatch" | "inspect" | "repair" | "close"
  label: string
  stage: number
  icon: typeof BellRingIcon
}
const ORDERS: Order[] = [
  { key: "ack", label: "Acknowledge", stage: 1, icon: BellRingIcon },
  { key: "dispatch", label: "Dispatch crew", stage: 2, icon: TruckIcon },
  { key: "inspect", label: "Mark inspected", stage: 3, icon: ClipboardCheckIcon },
  { key: "repair", label: "Repair", stage: 4, icon: WrenchIcon },
  { key: "close", label: "Close", stage: 5, icon: CheckCheckIcon },
]

function MissionView({ id }: { id: string }) {
  const s = useGame((x) => x)
  const navigate = useNavigate()
  const a = s.alerts.find((x) => x.id === id) as Alert
  const wo = woFor(s, id)
  const mh = manholeById(a.manholeId)
  const isBench = a.manholeId === RIG_ID
  const busy = busyCrews(s)
  const [crew, setCrew] = useState<string>(CREWS[0])
  const [outcome, setOutcome] = useState<"Void confirmed" | "No void found">("Void confirmed")

  const stage = LIFECYCLE.indexOf(a.status)
  const closed = a.status === "Closed"
  const pct = missionProgress(s, a) * 100
  const inFlight = s.queue.some((q) => q.lane === id && (q.status === "queued" || q.status === "running"))
  const reports = surfaceReports.filter((r) => a.linkedReports.includes(r.id))
  const origin = `Mission ${id}`
  const noVoid = wo?.outcome === "No void found"

  const gate = (order: Order["key"]): string | undefined => {
    if (closed) return "Mission is closed."
    if (inFlight) return "An order for this mission is already running."
    switch (order) {
      case "ack":
        return a.status === "New" ? undefined : "Already acknowledged."
      case "dispatch":
        if (a.status === "New") return "Acknowledge first."
        if (a.status !== "Acknowledged") return "Crew already dispatched."
        return busy.has(crew) ? `${crew.split(" (")[0]} is deployed. Pick another crew.` : undefined
      case "inspect":
        if (stage < 2) return "Dispatch a crew first."
        return a.status === "Dispatched" ? undefined : "Already inspected."
      case "repair":
        if (stage < 3) return "Inspect first."
        if (a.status !== "Inspected") return "Already repaired."
        return noVoid ? "No void found: nothing to repair. Close instead." : undefined
      case "close":
        if (stage < 3) return "Inspect first."
        if (a.status === "Inspected" && !noVoid) return "Repair the void first."
        return undefined
    }
  }

  const run: Record<Order["key"], () => void> = {
    ack: () => acknowledgeAlert(id, origin),
    dispatch: () => dispatchCrew(id, crew, origin),
    inspect: () => markInspected(id, outcome, origin),
    repair: () => markRepaired(id, origin),
    close: () => closeMission(id, origin),
  }
  const hotkeys: Record<Order["key"], string> = { ack: "a", dispatch: "d", inspect: "i", repair: "r", close: "c" }

  const next = ORDERS.find((o) => !gate(o.key) || (o.stage === stage + 1 && !closed))
  const commands: Command[] = ORDERS.map((o) => ({
    id: o.key,
    hotkey: hotkeys[o.key],
    label: o.label,
    icon: o.icon,
    mode: "sim" as const,
    primary: !closed && o.key === (next?.key ?? "ack"),
    disabled: !!gate(o.key),
    reason: gate(o.key),
    hint: o.key === "inspect" ? "Marking inspected completes any unticked steps and records a ground-truth label." : undefined,
    extra:
      o.key === "dispatch" ? (
        <Picker
          label="Crew"
          value={crew}
          onChange={setCrew}
          options={CREWS.map((c) => ({ value: c, label: c.split(" (")[0].replace("Contractor: ", ""), disabled: busy.has(c) }))}
        />
      ) : o.key === "inspect" ? (
        <Picker
          label="Outcome"
          value={outcome}
          onChange={setOutcome}
          options={[
            { value: "Void confirmed", label: "Void confirmed" },
            { value: "No void found", label: "No void found" },
          ]}
        />
      ) : undefined,
    run: run[o.key],
  }))
  commands.push({
    id: "asset",
    hotkey: "m",
    label: isBench ? "Open bench" : `Open ${a.manholeId}`,
    icon: PlayIcon,
    mode: "nav",
    primary: closed,
    run: () => navigate(isBench ? paths.bench : mh ? paths.manhole(mh) : paths.missions),
  })

  const stepsDone = wo ? wo.steps.filter((x) => x.done).length : 0
  const canTick = stage >= 2 && !closed

  return (
    <LevelLayout
      crumbs={[TOWNSHIP_CRUMB, MISSIONS_CRUMB, { label: id, to: paths.mission(id) }]}
      level="Mission"
      depthMax={2}
      title={
        <span className="flex flex-wrap items-center gap-3">
          {id} at {a.manholeId} <StateBadge state={a.state} />
        </span>
      }
      subtitle={`Raised ${fmtDateTime(a.raisedAt)}. Priority ${a.priority}.`}
      badges={
        <>
          <Tag>{a.priority}</Tag>
          {isBench ? <Badge variant="outline">Live bench</Badge> : <Badge variant="outline">Seed / simulated</Badge>}
        </>
      }
      commands={<CommandPanel title="Mission orders" commands={commands} />}
    >
      <Panel eyebrow="Mission progress" title={closed ? "Mission complete" : `Stage: ${a.status}`}>
        <div className="flex flex-col gap-1.5">
          <Progress value={pct} className="h-4" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {next && !closed ? `Next order: ${next.label}` : closed ? "Archived" : ""}
            </span>
            <Num>{Math.round(pct)}%</Num>
          </div>
        </div>
        <Lifecycle status={a.status} className="mt-1" />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Orders" title="Mission checklist">
          <ol className="flex flex-col gap-2">
            {ORDERS.map((o) => {
              const done = o.stage <= stage || closed
              const skipped = o.key === "repair" && noVoid && stage >= 3
              const reason = gate(o.key)
              const isNext = next?.key === o.key && !closed
              const Icon = o.icon
              return (
                <li
                  key={o.key}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-2.5",
                    isNext && "border-2 border-foreground/70 bg-muted/40",
                    done && "opacity-70"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                      done ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
                    )}
                  >
                    {done ? <CheckIcon className="size-4" /> : reason && !isNext ? <LockIcon className="size-3.5" /> : <Icon className="size-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {o.label}
                      {skipped && <span className="ml-2 text-xs font-normal text-muted-foreground">skipped</span>}
                    </div>
                    {!done && reason && <div className="truncate text-xs text-muted-foreground">{reason}</div>}
                  </div>
                  {isNext && !reason && (
                    <Button size="sm" onClick={run[o.key]}>
                      {o.label}
                    </Button>
                  )}
                </li>
              )
            })}
          </ol>
        </Panel>

        <Panel
          eyebrow={wo ? wo.id : "Work order"}
          title={wo ? wo.title : "No work order yet"}
          action={wo && <Num className="text-xs text-muted-foreground">{stepsDone}/{wo.steps.length}</Num>}
        >
          {wo ? (
            <>
              <Progress value={(stepsDone / wo.steps.length) * 100} className="h-2.5" />
              <ul className="flex flex-col divide-y">
                {wo.steps.map((st, i) => (
                  <li key={st.label}>
                    <label className={cn("flex items-center gap-3 py-2 text-sm", !canTick && "opacity-60")}>
                      <Checkbox checked={st.done} disabled={!canTick} onCheckedChange={() => toggleStep(id, i)} />
                      <span className={cn(st.done && "text-muted-foreground line-through")}>{st.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <KeyValue
                rows={[
                  ["Crew", wo.crew.split(" (")[0]],
                  ["Due", fmtDateTime(wo.due)],
                  ["Status", wo.status],
                  ["Outcome", wo.outcome ?? "Pending"],
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              A work order is created when a crew is dispatched. Acknowledge, then dispatch.
            </p>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Evidence bundle" title="What the sensors saw">
          <p className="text-sm">{a.summary}</p>
          <RatioReadout tauNow={8 * a.ringTimeRatio} tauBase={8} ratio={a.ringTimeRatio} />
          <RingDownChart now={envelopeOf(8 * a.ringTimeRatio, 1)} base={envelopeOf(8, 1)} className="h-36" />
          <p className="text-xs text-muted-foreground">VRI at alert time: <Num>{a.vri}</Num>. Ring-down curve is rebuilt from the recorded tau.</p>
        </Panel>
        <Panel eyebrow="Evidence" title="Linked surface reports">
          {reports.length ? (
            <ul className="flex flex-col divide-y text-sm">
              {reports.map((r) => (
                <li key={r.id} className="flex flex-col gap-0.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.category}</span>
                    <Tag>{r.relevance}</Tag>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {r.id} / {r.reporter} / {r.count} report{r.count > 1 ? "s" : ""} / {fmtDateTime(r.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No public reports linked to this alert.</p>
          )}
          {mh ? (
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link to={paths.manhole(mh)}>Open {mh.id} {mh.name}</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link to={paths.bench}>Open Test Bench RIG-01</Link>
            </Button>
          )}
          {noVoid && stage >= 3 && (
            <p className="rounded-lg border p-2.5 text-xs text-muted-foreground">
              Inspection found no void. This becomes a ground-truth label for a false alarm and feeds model training.
            </p>
          )}
        </Panel>
      </div>
    </LevelLayout>
  )
}
