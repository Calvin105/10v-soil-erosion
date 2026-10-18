import { useSyncExternalStore } from "react"
import { toast } from "sonner"

import { network } from "@/data/network-sim"
import { rig, type TaskProgress } from "@/data/rig-sim"
import {
  alerts as seedAlerts,
  manholes,
  riskLayers,
  workOrders as seedWorkOrders,
} from "@/data/seed"
import type { Alert, AlertStatus, ClassLabel, Manhole, WorkOrder } from "@/data/types"

import { suggestPlacement, topCells } from "./risk"

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const LIFECYCLE: AlertStatus[] = [
  "New",
  "Acknowledged",
  "Dispatched",
  "Inspected",
  "Repaired",
  "Closed",
]

export const CREWS = [
  "FM Crew A (Mei Ling)",
  "FM Crew B (Hafiz)",
  "Contractor: Geofoam Sdn Bhd",
] as const

export const RIG_ID = "RIG-01"
export const RIG_LANE = "RIG-01"

export type Packing = 1 | 2 | 3

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

export type QueueStatus = "queued" | "running" | "done" | "cancelled" | "failed"

export interface QueueItem {
  id: string
  /** Items in the same lane run one at a time (like one building's training queue). */
  lane: string
  title: string
  /** Where the command was issued, e.g. "RIG-01 / Microphone". */
  origin: string
  /** true = concept / local timer; false = drives the live rig simulator. */
  simulated: boolean
  durationMs: number
  status: QueueStatus
  progress: number
  queuedAt: number
  startedAt?: number
  endedAt?: number
  rig?: { kind: TaskProgress["kind"]; start: () => void }
  crew?: string
  onDone?: () => void
  doneText?: () => string
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface TapResult {
  at: number
  cycles: number
  ratio: number
}

export interface GameState {
  alerts: Alert[]
  workOrders: WorkOrder[]
  queue: QueueItem[]
  /** minutes between wakes, keyed by zone id */
  sampling: Record<string, number>
  stormMode: Record<string, boolean>
  rebaselinedAt: Record<string, number>
  tapResults: Record<string, TapResult[]>
  selfTests: Record<string, number>
  packingByAt: Record<number, Packing>
  benchPacking: Packing
  lastHealth: { at: number; ok: number; total: number; weakest: string } | null
  watchList: string[] | null
  placement: string[] | null
  modelRetrainedAt: number | null
  edgeExportAt: number | null
  /** risk layer switches (S3 mock), default all on */
  riskOn: Record<string, boolean>
  /** concept nodes running the TinyML model on device (bench uses rig.setTinyMl) */
  tinyMlNodes: Record<string, boolean>
  fleetPlan: { at: number; years: number } | null
}

function initialState(): GameState {
  return {
    alerts: seedAlerts.map((a) => ({ ...a, linkedReports: [...a.linkedReports] })),
    workOrders: seedWorkOrders.map((w) => ({ ...w, steps: w.steps.map((s) => ({ ...s })) })),
    queue: [],
    sampling: { "z-west": 15, "z-central": 15, "z-lake": 15 },
    stormMode: {},
    rebaselinedAt: {},
    tapResults: {},
    selfTests: {},
    packingByAt: {},
    benchPacking: 3,
    lastHealth: null,
    watchList: null,
    placement: null,
    modelRetrainedAt: null,
    edgeExportAt: null,
    riskOn: Object.fromEntries(riskLayers.map((l) => [l.id, true])),
    tinyMlNodes: {},
    fleetPlan: null,
  }
}

let state: GameState = initialState()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null
let seq = 0

function emit() {
  listeners.forEach((l) => l())
}

export function setGame(patch: Partial<GameState> | ((s: GameState) => Partial<GameState>)) {
  const p = typeof patch === "function" ? patch(state) : patch
  state = { ...state, ...p }
  emit()
}

export function getGame() {
  return state
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useGame<T>(selector: (s: GameState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

/* ------------------------------------------------------------------ */
/* Scheduler                                                           */
/* ------------------------------------------------------------------ */

const isActive = (i: QueueItem) => i.status === "queued" || i.status === "running"

function ensureTimer() {
  if (!timer) timer = setInterval(tick, 150)
}

function tick() {
  const now = Date.now()
  const queue = state.queue.map((i) => ({ ...i }))
  const finished: QueueItem[] = []
  let changed = false
  const lanes = [...new Set(queue.filter(isActive).map((i) => i.lane))]

  for (const lane of lanes) {
    const head = queue.find((i) => i.lane === lane && isActive(i))
    if (!head) continue

    if (head.status === "queued") {
      if (head.rig) {
        if (rig.snapshot.task) continue // rig busy: wait our turn
        head.rig.start()
        if (!rig.snapshot.task) {
          head.status = "failed"
          head.endedAt = now
          finished.push(head)
          changed = true
          continue
        }
      }
      head.status = "running"
      head.startedAt = now
      head.progress = 0
      changed = true
      continue
    }

    // running
    if (head.rig) {
      const t = rig.snapshot.task
      if (t && t.kind === head.rig.kind) {
        if (t.progress !== head.progress) {
          head.progress = t.progress
          changed = true
        }
      } else {
        const elapsed = now - (head.startedAt ?? now)
        head.status = head.progress >= 0.8 || elapsed >= head.durationMs ? "done" : "cancelled"
        if (head.status === "done") head.progress = 1
        head.endedAt = now
        finished.push(head)
        changed = true
      }
    } else {
      const p = Math.min(1, (now - (head.startedAt ?? now)) / head.durationMs)
      head.progress = p
      changed = true
      if (p >= 1) {
        head.status = "done"
        head.endedAt = now
        finished.push(head)
      }
    }
  }

  if (changed) {
    // keep at most 8 finished items
    const done = queue.filter((i) => !isActive(i))
    const drop = new Set(done.slice(0, Math.max(0, done.length - 8)).map((i) => i.id))
    setGame({ queue: queue.filter((i) => !drop.has(i.id)) })
  }

  for (const item of finished) {
    if (item.status === "done") {
      item.onDone?.()
      toast.success(`${item.title}: complete`, {
        description: item.doneText?.() ?? item.origin,
      })
    } else if (item.status === "failed") {
      toast.error(`${item.title}: could not start`, { description: "The rig refused the task." })
    } else if (item.status === "cancelled") {
      toast.warning(`${item.title}: cancelled`)
    }
  }

  if (!state.queue.some(isActive) && timer) {
    clearInterval(timer)
    timer = null
  }
}

export function enqueue(
  item: Omit<QueueItem, "id" | "status" | "progress" | "queuedAt">
): string {
  const id = `Q${++seq}`
  setGame((s) => ({
    queue: [...s.queue, { ...item, id, status: "queued", progress: 0, queuedAt: Date.now() }],
  }))
  ensureTimer()
  tick()
  return id
}

export function cancelItem(id: string) {
  const item = state.queue.find((i) => i.id === id)
  if (!item || !isActive(item)) return
  if (item.status === "running" && item.rig) rig.cancelTask()
  setGame((s) => ({
    queue: s.queue.map((i) =>
      i.id === id ? { ...i, status: "cancelled", endedAt: Date.now() } : i
    ),
  }))
  toast.warning(`${item.title}: cancelled`)
}

export function clearFinished() {
  setGame((s) => ({ queue: s.queue.filter(isActive) }))
}

export function laneBusy(lane: string) {
  return state.queue.some((i) => i.lane === lane && isActive(i))
}

/** Remaining ms until this item finishes, counting the items ahead of it in its lane. */
export function etaMs(queue: QueueItem[], item: QueueItem) {
  let total = 0
  for (const i of queue) {
    if (i.lane !== item.lane || !isActive(i)) continue
    total += i.status === "running" ? i.durationMs * (1 - i.progress) : i.durationMs
    if (i.id === item.id) break
  }
  return total
}

/* ------------------------------------------------------------------ */
/* Rig commands (real simulator tasks, serialized in the RIG lane)     */
/* ------------------------------------------------------------------ */

export function queueCalibrate(seconds: number, origin: string) {
  enqueue({
    lane: RIG_LANE,
    title: `Calibrate baseline (${seconds} s)`,
    origin,
    simulated: false,
    durationMs: seconds * 1000,
    rig: { kind: "calibrate", start: () => rig.calibrate(seconds) },
    doneText: () => {
      const b = rig.snapshot.baseline
      return b ? `Baseline tau ${b.tauMs.toFixed(1)} ms saved` : "Baseline saved"
    },
  })
}

export function queuePulse(cycles: number, origin: string, halfPeriodMs = 1200) {
  enqueue({
    lane: RIG_LANE,
    title: `Flow pulse test x${cycles}`,
    origin,
    simulated: false,
    durationMs: cycles * 2 * halfPeriodMs,
    rig: { kind: "pulse", start: () => rig.runPulseTest(cycles, halfPeriodMs) },
    doneText: () => {
      const p = rig.snapshot.lastPulse
      if (!p) return "Pulse test finished"
      return `Mean tau ${p.meanTauMs.toFixed(1)} ms${p.ratio ? `, ${p.ratio.toFixed(2)}x baseline` : " (no baseline yet)"}`
    },
  })
}

export function queueRecordings(
  label: ClassLabel,
  seconds: number,
  count: number,
  packing: Packing,
  origin: string
) {
  for (let n = 1; n <= count; n++) {
    enqueue({
      lane: RIG_LANE,
      title: `Record "${label}" clip ${n}/${count}`,
      origin,
      simulated: false,
      durationMs: seconds * 1000,
      rig: { kind: "record", start: () => rig.record(label, seconds) },
      onDone: () => {
        const r = rig.snapshot.recordings[0]
        if (r) setGame((s) => ({ packingByAt: { ...s.packingByAt, [r.at]: packing } }))
      },
      doneText: () => `${seconds} s labelled "${label}", packing #${packing} (mic.wav + vib.wav)`,
    })
  }
}

/* ------------------------------------------------------------------ */
/* Simulated (concept / local) commands                                */
/* ------------------------------------------------------------------ */

export function queueSim(opts: {
  lane: string
  title: string
  origin: string
  seconds: number
  onDone?: () => void
  doneText?: () => string
  crew?: string
}) {
  return enqueue({
    lane: opts.lane,
    title: opts.title,
    origin: opts.origin,
    simulated: true,
    durationMs: opts.seconds * 1000,
    onDone: opts.onDone,
    doneText: opts.doneText,
    crew: opts.crew,
  })
}

/* ------------------------------------------------------------------ */
/* Missions (alerts + work orders)                                     */
/* ------------------------------------------------------------------ */

export function busyCrews(
  s: Pick<GameState, "alerts" | "workOrders" | "queue">
): Set<string> {
  const busy = new Set<string>()
  for (const wo of s.workOrders) {
    const a = s.alerts.find((x) => x.id === wo.alertId)
    if (a && (a.status === "Dispatched" || a.status === "Inspected")) busy.add(wo.crew)
  }
  for (const q of s.queue) if (q.crew && isActive(q)) busy.add(q.crew)
  return busy
}

function patchAlert(id: string, patch: Partial<Alert>) {
  setGame((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
}

function patchWo(alertId: string, patch: Partial<WorkOrder>) {
  setGame((s) => ({
    workOrders: s.workOrders.map((w) => (w.alertId === alertId ? { ...w, ...patch } : w)),
  }))
}

export function woFor(s: GameState, alertId: string) {
  return s.workOrders.find((w) => w.alertId === alertId)
}

export function acknowledgeAlert(alertId: string, origin: string) {
  if (laneBusy(alertId)) return toast.info(`${alertId} already has a command in progress`)
  queueSim({
    lane: alertId,
    title: `Acknowledge ${alertId}`,
    origin,
    seconds: 1.5,
    onDone: () => patchAlert(alertId, { status: "Acknowledged" }),
    doneText: () => "Owner notified; SLA clock started",
  })
}

export function dispatchCrew(alertId: string, crew: string, origin: string) {
  if (laneBusy(alertId)) return toast.info(`${alertId} already has a command in progress`)
  queueSim({
    lane: alertId,
    title: `Dispatch ${crew.split(" (")[0]} to ${alertId}`,
    origin,
    seconds: 4,
    crew,
    onDone: () => {
      const s = getGame()
      const a = s.alerts.find((x) => x.id === alertId)
      const wo = woFor(s, alertId)
      if (wo) {
        patchWo(alertId, { crew, status: "In progress" })
      } else if (a) {
        const n = 2300 + s.workOrders.length
        const isRig = a.manholeId === RIG_ID
        setGame((st) => ({
          workOrders: [
            ...st.workOrders,
            {
              id: `WO-${n}`,
              alertId,
              title: isRig
                ? `Bench check: re-pack soil and repeat pulse test (${a.manholeId})`
                : `Inspect ${a.manholeId} with CCTV + GPR`,
              crew,
              due: new Date(Date.now() + 24 * 3600_000).toISOString(),
              status: "In progress",
              steps: isRig
                ? [
                    { label: "Photograph container and pipe", done: false },
                    { label: "Probe soil around pipe crown", done: false },
                    { label: "Record outcome", done: false },
                  ]
                : [
                    { label: "Traffic management set up", done: false },
                    { label: "CCTV crawler run over flagged segment", done: false },
                    { label: "GPR scan over flagged segment", done: false },
                    { label: "Record outcome and photos", done: false },
                  ],
              outcome: "Pending",
            },
          ],
        }))
      }
      patchAlert(alertId, { status: "Dispatched" })
    },
    doneText: () => `${crew} on site`,
  })
}

export function toggleStep(alertId: string, idx: number) {
  const wo = woFor(state, alertId)
  if (!wo) return
  patchWo(alertId, {
    steps: wo.steps.map((s, i) => (i === idx ? { ...s, done: !s.done } : s)),
  })
}

export function completeNextStep(alertId: string) {
  const wo = woFor(state, alertId)
  if (!wo) return
  const idx = wo.steps.findIndex((s) => !s.done)
  if (idx >= 0) toggleStep(alertId, idx)
}

export function markInspected(
  alertId: string,
  outcome: "Void confirmed" | "No void found",
  origin: string
) {
  if (laneBusy(alertId)) return toast.info(`${alertId} already has a command in progress`)
  queueSim({
    lane: alertId,
    title: `Log inspection for ${alertId}`,
    origin,
    seconds: 3,
    onDone: () => {
      const wo = woFor(getGame(), alertId)
      if (wo) patchWo(alertId, { outcome, steps: wo.steps.map((s) => ({ ...s, done: true })) })
      patchAlert(alertId, { status: "Inspected" })
    },
    doneText: () => `Outcome: ${outcome} (becomes a ground-truth label)`,
  })
}

export function markRepaired(alertId: string, origin: string) {
  if (laneBusy(alertId)) return toast.info(`${alertId} already has a command in progress`)
  queueSim({
    lane: alertId,
    title: `Repair at ${alertId}`,
    origin,
    seconds: 5,
    onDone: () => {
      patchWo(alertId, { status: "Done" })
      patchAlert(alertId, { status: "Repaired" })
    },
    doneText: () => "Void grouted; node will be re-baselined",
  })
}

export function closeMission(alertId: string, origin: string) {
  if (laneBusy(alertId)) return toast.info(`${alertId} already has a command in progress`)
  queueSim({
    lane: alertId,
    title: `Close ${alertId}`,
    origin,
    seconds: 1.5,
    onDone: () => {
      patchWo(alertId, { status: "Done" })
      patchAlert(alertId, { status: "Closed" })
    },
    doneText: () => "Mission closed and archived",
  })
}

/** Escalate the live bench reading into a mission (prototype -> workflow). */
export function escalateBench(vri: number, ratio: number | null, state: Alert["state"]) {
  const s = getGame()
  const n = 143 + s.alerts.filter((a) => a.manholeId === RIG_ID).length
  const id = `AL-0${n}`
  const alert: Alert = {
    id,
    manholeId: RIG_ID,
    raisedAt: new Date().toISOString(),
    state,
    priority: state === "RED" ? "P1" : state === "YELLOW" ? "P2" : "P3",
    vri,
    ringTimeRatio: ratio ?? 1,
    summary: `Raised from Test Bench RIG-01: live VRI ${vri}${ratio ? `, ring-down ${ratio.toFixed(2)}x baseline` : ""}.`,
    status: "New",
    linkedReports: [],
  }
  setGame((st) => ({ alerts: [alert, ...st.alerts] }))
  return id
}

/* ------------------------------------------------------------------ */
/* Township / zone / lab commands (simulated)                          */
/* ------------------------------------------------------------------ */

export function queueHealthCheck(origin: string) {
  if (laneBusy("township")) return toast.info("A health check is already running")
  queueSim({
    lane: "township",
    title: "Network health check",
    origin,
    seconds: 6,
    onDone: () => {
      const nodes = network.snapshot.nodes
      const bad = nodes.filter((n) => n.lastUplinkMinAgo >= 50 || n.snr < -5 || n.batteryPct < 40)
      const weakest = [...nodes].sort((a, b) => a.snr - b.snr)[0]
      setGame({
        lastHealth: {
          at: Date.now(),
          ok: nodes.length - bad.length,
          total: nodes.length,
          weakest: `${weakest.id} (SNR ${weakest.snr.toFixed(1)} dB, SF${weakest.spreadingFactor})`,
        },
      })
    },
    doneText: () => {
      const h = getGame().lastHealth
      return h ? `${h.ok}/${h.total} nodes healthy. Weakest link: ${h.weakest}` : "Done"
    },
  })
}

export function queueSweep(zoneId: string, zoneName: string, origin: string) {
  queueSim({
    lane: `zone:${zoneId}`,
    title: `Pre-storm sweep: ${zoneName}`,
    origin,
    seconds: 8,
    onDone: () => setGame((s) => ({ stormMode: { ...s.stormMode, [zoneId]: true } })),
    doneText: () => "Every node polled, baseline compared, storm mode armed (2 min wake)",
  })
}

export function endStorm(zoneId: string) {
  setGame((s) => ({ stormMode: { ...s.stormMode, [zoneId]: false } }))
  toast.info("Storm mode stood down", { description: "Nodes return to the normal wake interval." })
}

export function queueSampling(zoneId: string, zoneName: string, minutes: number, origin: string) {
  queueSim({
    lane: `zone:${zoneId}`,
    title: `Sampling every ${minutes} min: ${zoneName}`,
    origin,
    seconds: 3,
    onDone: () => setGame((s) => ({ sampling: { ...s.sampling, [zoneId]: minutes } })),
    doneText: () => "Class A downlink queued; applies on each node's next uplink",
  })
}

export function queueConceptCalibrate(m: Manhole, seconds: number, origin: string) {
  queueSim({
    lane: m.id,
    title: `Calibrate baseline ${m.id} (${seconds} s)`,
    origin,
    seconds,
    onDone: () => {
      setGame((s) => ({ rebaselinedAt: { ...s.rebaselinedAt, [m.id]: Date.now() } }))
      if (m.state !== "GREEN")
        toast.warning(`${m.id} was ${m.state} when re-baselined`, {
          description: "A baseline taken on a damaged node hides the void. Confirm the soil is sound first.",
        })
    },
    doneText: () => `New healthy baseline stored for ${m.id} (simulated)`,
  })
}

export function queueConceptPulse(m: Manhole, cycles: number, origin: string) {
  queueSim({
    lane: m.id,
    title: `Flow pulse test x${cycles} ${m.id}`,
    origin,
    seconds: cycles * 2.4,
    onDone: () => {
      const ratio = Math.max(0.9, m.ringTimeRatio * (1 + (Math.random() - 0.5) * 0.08))
      setGame((s) => ({
        tapResults: {
          ...s.tapResults,
          [m.id]: [{ at: Date.now(), cycles, ratio }, ...(s.tapResults[m.id] ?? [])].slice(0, 6),
        },
      }))
    },
    doneText: () => `Ring-down ${getGame().tapResults[m.id]?.[0]?.ratio.toFixed(2)}x baseline (simulated)`,
  })
}

export function queueSelfTest(key: string, label: string, origin: string) {
  queueSim({
    lane: key,
    title: `Self-test ${label}`,
    origin,
    seconds: 3,
    onDone: () => setGame((s) => ({ selfTests: { ...s.selfTests, [key]: Date.now() } })),
    doneText: () => "Noise floor nominal, no clipping, bias centred",
  })
}

export function queueStreamRaw(key: string, label: string, origin: string, seconds = 10) {
  queueSim({
    lane: key,
    title: `Stream raw ${label}`,
    origin,
    seconds,
    doneText: () => `${seconds} s of raw samples buffered`,
  })
}

export function queueConceptRecord(
  key: string,
  label: ClassLabel,
  count: number,
  seconds: number,
  origin: string
) {
  for (let n = 1; n <= count; n++) {
    queueSim({
      lane: key,
      title: `Capture "${label}" clip ${n}/${count}`,
      origin,
      seconds,
      doneText: () => "Simulated clip. Concept nodes do not feed the prototype dataset",
    })
  }
}

export function setTinyMlNode(id: string, on: boolean) {
  setGame((s) => ({ tinyMlNodes: { ...s.tinyMlNodes, [id]: on } }))
  toast.info(on ? `${id}: TinyML model on device (simulated)` : `${id}: inference back on the server`)
}

export function queueRetrain(origin: string) {
  queueSim({
    lane: "lab",
    title: "Retrain models on dataset",
    origin,
    seconds: 8,
    onDone: () => setGame({ modelRetrainedAt: Date.now() }),
    doneText: () => "Random Forest refit; TinyML candidate rebuilt (simulated)",
  })
}

export function queueExportEdge(origin: string) {
  queueSim({
    lane: "lab",
    title: "Export int8 model to Edge Impulse",
    origin,
    seconds: 5,
    onDone: () => setGame({ edgeExportAt: Date.now() }),
    doneText: () => "Arduino library ready to flash (simulated)",
  })
}

export function queueNetworkPoll(origin: string) {
  if (laneBusy("network")) return toast.info("The network is already busy")
  queueSim({
    lane: "network",
    title: "Poll all nodes now",
    origin,
    seconds: 6,
    doneText: () => {
      const n = network.snapshot.nodes
      const rssi = n.reduce((a, x) => a + x.rssi, 0) / n.length
      return `${n.length}/${n.length} nodes answered. Mean RSSI ${rssi.toFixed(0)} dBm`
    },
  })
}

export function queueFleetPlan(years: number, origin: string) {
  queueSim({
    lane: "network",
    title: "Push wake plan to 10 nodes",
    origin,
    seconds: 5,
    onDone: () => setGame({ fleetPlan: { at: Date.now(), years } }),
    doneText: () => "Class A downlinks queued, one per node (simulated)",
  })
}

export function queueRiskJob(kind: "watch" | "placement", origin: string) {
  if (laneBusy("risk")) return toast.info("A risk job is already running")
  queueSim({
    lane: "risk",
    title: kind === "watch" ? "Build pre-storm watch-list" : "Suggest sensor placement",
    origin,
    seconds: kind === "watch" ? 4 : 5,
    onDone: () => {
      const on = getGame().riskOn
      if (kind === "watch") setGame({ watchList: topCells(on, 5).map((t) => t.cell.id) })
      else setGame({ placement: suggestPlacement(on, 3).map((t) => t.cell.id) })
    },
    doneText: () =>
      kind === "watch"
        ? "Top 5 cells ranked from the enabled layers"
        : "3 gaps in coverage found (more than 180 m from any node)",
  })
}

export function setRiskLayer(id: string, on: boolean) {
  setGame((s) => ({ riskOn: { ...s.riskOn, [id]: on } }))
}

export function setRiskLayers(ids: string[], on: boolean) {
  setGame((s) => ({
    riskOn: { ...s.riskOn, ...Object.fromEntries(ids.map((id) => [id, on])) },
  }))
}

export function acknowledgeAllNew(origin: string) {
  const fresh = getGame().alerts.filter((a) => a.status === "New")
  if (!fresh.length) return toast.info("No new missions to acknowledge")
  fresh.forEach((a) => acknowledgeAlert(a.id, origin))
}

export function openAlertFor(s: Pick<GameState, "alerts">, manholeId: string) {
  return s.alerts.find((a) => a.manholeId === manholeId && a.status !== "Closed")
}

/** 0..1 progress of a mission: lifecycle position plus work-order steps. */
export function missionProgress(s: Pick<GameState, "workOrders">, a: Alert) {
  const idx = LIFECYCLE.indexOf(a.status)
  const wo = s.workOrders.find((w) => w.alertId === a.id)
  const stepFrac = wo && wo.steps.length ? wo.steps.filter((x) => x.done).length / wo.steps.length : 0
  const stages = LIFECYCLE.length - 1
  if (a.status === "Closed") return 1
  return Math.min(0.98, (idx + (idx >= 2 ? stepFrac * 0.9 : 0)) / stages)
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function manholeById(id: string) {
  return manholes.find((m) => m.id === id)
}

export function fmtEta(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function fmtTime(t: number | string) {
  const d = typeof t === "number" ? new Date(t) : new Date(t)
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function fmtDateTime(t: string) {
  const d = new Date(t)
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function downloadText(filename: string, text: string, type = "text/plain") {
  try {
    const blob = new Blob([text], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    /* ignore in headless contexts */
  }
}

/** Reactive: is anything queued or running in this lane? */
export function useLaneBusy(lane: string) {
  return useGame((s) => s.queue.some((i) => i.lane === lane && isActive(i)))
}
