import { useSyncExternalStore } from "react"

import { rig } from "@/data/rig-sim"
import { alerts as seedAlerts, workOrders as seedWorkOrders } from "@/data/seed"
import type { Alert, AlertStatus, ClassLabel, WorkOrder } from "@/data/types"

import { top1 } from "./widgets/ml"

/** Tiny external store so state survives route changes inside variant A. */
export function createStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(next: Partial<T> | ((s: T) => T)) {
      state = typeof next === "function" ? next(state) : { ...state, ...next }
      listeners.forEach((l) => l())
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
  }
}

type Store<T> = ReturnType<typeof createStore<T>>

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get)
}

// ---------- record & label form (shared by toolbar + dataset page) ----------

export type Packing = 1 | 2 | 3

export const recordForm = createStore<{
  label: ClassLabel
  seconds: number
  packing: Packing
}>({ label: "packed", seconds: 10, packing: 1 })

/** rig.recordings has no packing field; remember which packing each clip was taken under. */
const packingByAt = new Map<number, Packing>()
let pendingPacking: Packing = 1
let knownClips = rig.snapshot.recordings.length

export function packingOf(at: number): Packing {
  return packingByAt.get(at) ?? recordForm.get().packing
}

/** Start a labelled recording and remember the packing it was taken under. */
export function startRecording(label?: ClassLabel, seconds?: number) {
  const f = recordForm.get()
  pendingPacking = f.packing
  rig.record(label ?? f.label, seconds ?? f.seconds)
}

// Assign a packing to every clip the rig finishes, whichever screen is open.
rig.subscribe(() => {
  // The rig prepends new clips, so the newest ones are at the front.
  const rec = rig.snapshot.recordings
  for (let i = 0; i < rec.length - knownClips; i++) packingByAt.set(rec[i].at, pendingPacking)
  knownClips = rec.length
})

// ---------- rolling agreement between the laptop RF and the on-device model ----------

const WINDOW = 300
const ring: boolean[] = []
let ringAgree = 0
let lastSeq = -1

export const agreement = createStore<{ rate: number | null; n: number }>({ rate: null, n: 0 })

rig.subscribe(() => {
  const s = rig.snapshot
  if (s.seq === lastSeq) return
  lastSeq = s.seq
  const agree = top1(s.laptopProbs) === top1(s.tinyProbs)
  ring.push(agree)
  if (agree) ringAgree++
  if (ring.length > WINDOW && ring.shift()) ringAgree--
  if (s.seq % 5 === 0) agreement.set({ rate: ringAgree / ring.length, n: ring.length })
})

// ---------- operations (alerts + work orders) ----------

export const LIFECYCLE: AlertStatus[] = [
  "New",
  "Acknowledged",
  "Dispatched",
  "Inspected",
  "Repaired",
  "Closed",
]

export const ops = createStore<{
  alerts: Alert[]
  workOrders: WorkOrder[]
  selectedAlertId: string
}>({
  alerts: seedAlerts,
  workOrders: seedWorkOrders,
  selectedAlertId: seedAlerts[0].id,
})

export function advanceAlert(id: string) {
  ops.set((s) => ({
    ...s,
    alerts: s.alerts.map((a) => {
      if (a.id !== id) return a
      const i = LIFECYCLE.indexOf(a.status)
      return { ...a, status: LIFECYCLE[Math.min(LIFECYCLE.length - 1, i + 1)] }
    }),
  }))
}

export function toggleStep(woId: string, index: number) {
  ops.set((s) => ({
    ...s,
    workOrders: s.workOrders.map((w) => {
      if (w.id !== woId) return w
      const steps = w.steps.map((st, i) => (i === index ? { ...st, done: !st.done } : st))
      const doneCount = steps.filter((st) => st.done).length
      const status: WorkOrder["status"] =
        doneCount === steps.length ? "Done" : doneCount > 0 ? "In progress" : "Queued"
      return { ...w, steps, status }
    }),
  }))
}

export function createWorkOrder(alertId: string) {
  ops.set((s) => {
    const alert = s.alerts.find((a) => a.id === alertId)
    if (!alert || s.workOrders.some((w) => w.alertId === alertId)) return s
    const n = 2300 + s.workOrders.length
    const wo: WorkOrder = {
      id: `WO-${n}`,
      alertId,
      title: `Inspect ${alert.manholeId} (${alert.priority} ${alert.state})`,
      crew: "FM Crew A (unassigned)",
      due: new Date(Date.now() + (alert.priority === "P1" ? 1 : alert.priority === "P2" ? 3 : 7) * 86_400_000).toISOString(),
      status: "Queued",
      steps: [
        { label: "Traffic management / safe access", done: false },
        { label: "CCTV crawler run", done: false },
        { label: "Record outcome and photos", done: false },
      ],
      outcome: "Pending",
    }
    return { ...s, workOrders: [...s.workOrders, wo] }
  })
}

export function setOutcome(woId: string, outcome: NonNullable<WorkOrder["outcome"]>) {
  ops.set((s) => ({
    ...s,
    workOrders: s.workOrders.map((w) => (w.id === woId ? { ...w, outcome } : w)),
  }))
}
