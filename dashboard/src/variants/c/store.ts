import { useSyncExternalStore } from "react"

import { alerts, riskLayers, workOrders as seedWorkOrders } from "@/data/seed"
import type { AlertStatus, WorkOrder } from "@/data/types"

/** Local UI state for variant C (seed data is never mutated). */
export interface CState {
  riskLayers: string[]
  selectedCell: string | null
  alertStatus: Record<string, AlertStatus>
  workOrders: WorkOrder[]
  /** packing # chosen for each recording, keyed by recording timestamp */
  recordPacking: Record<number, 1 | 2 | 3>
  pendingPacking: (1 | 2 | 3)[]
  dockMinimized: boolean
}

export const LIFECYCLE: AlertStatus[] = [
  "New",
  "Acknowledged",
  "Dispatched",
  "Inspected",
  "Repaired",
  "Closed",
]

let state: CState = {
  riskLayers: riskLayers.map((l) => l.id),
  selectedCell: null,
  alertStatus: Object.fromEntries(alerts.map((a) => [a.id, a.status])),
  workOrders: seedWorkOrders.map((w) => ({ ...w, steps: w.steps.map((s) => ({ ...s })) })),
  recordPacking: {},
  pendingPacking: [],
  dockMinimized: false,
}

const listeners = new Set<() => void>()

function set(patch: Partial<CState> | ((s: CState) => Partial<CState>)) {
  const p = typeof patch === "function" ? patch(state) : patch
  state = { ...state, ...p }
  listeners.forEach((l) => l())
}

export const cstore = {
  subscribe(cb: () => void) {
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  },
  get: () => state,

  toggleLayer(id: string, on: boolean) {
    set((s) => ({
      riskLayers: on ? [...new Set([...s.riskLayers, id])] : s.riskLayers.filter((x) => x !== id),
    }))
  },
  setLayers(ids: string[]) {
    set({ riskLayers: ids })
  },
  selectCell(id: string | null) {
    set({ selectedCell: id })
  },

  setAlertStatus(id: string, status: AlertStatus) {
    set((s) => ({ alertStatus: { ...s.alertStatus, [id]: status } }))
  },
  ensureWorkOrder(alertId: string, manholeName: string, manholeId: string) {
    if (state.workOrders.some((w) => w.alertId === alertId)) return
    const wo: WorkOrder = {
      id: `WO-${2300 + state.workOrders.length}`,
      alertId,
      title: `Inspect ${manholeId} (${manholeName}) with CCTV`,
      crew: "FM Crew A (Mei Ling)",
      due: new Date(Date.now() + 2 * 864e5).toISOString(),
      status: "Queued",
      steps: [
        { label: "Clear debris and open chamber", done: false },
        { label: "CCTV crawler run 20 m each way", done: false },
        { label: "Record outcome and photos", done: false },
      ],
      outcome: "Pending",
    }
    set((s) => ({ workOrders: [wo, ...s.workOrders] }))
  },
  toggleStep(woId: string, idx: number) {
    set((s) => ({
      workOrders: s.workOrders.map((w) => {
        if (w.id !== woId) return w
        const steps = w.steps.map((st, i) => (i === idx ? { ...st, done: !st.done } : st))
        const done = steps.filter((x) => x.done).length
        return {
          ...w,
          steps,
          status: done === steps.length ? "Done" : done > 0 ? "In progress" : "Queued",
        }
      }),
    }))
  },
  setOutcome(woId: string, outcome: WorkOrder["outcome"]) {
    set((s) => ({ workOrders: s.workOrders.map((w) => (w.id === woId ? { ...w, outcome } : w)) }))
  },

  queuePacking(p: 1 | 2 | 3) {
    set((s) => ({ pendingPacking: [...s.pendingPacking, p] }))
  },
  /** assign queued packing numbers to newly finished recordings */
  claimPacking(ats: number[]) {
    const fresh = ats.filter((a) => !(a in state.recordPacking)).sort((a, b) => a - b)
    if (!fresh.length) return
    const queue = [...state.pendingPacking]
    const rp = { ...state.recordPacking }
    fresh.forEach((a) => (rp[a] = queue.shift() ?? 1))
    set({ recordPacking: rp, pendingPacking: queue })
  },
  setDockMinimized(v: boolean) {
    set({ dockMinimized: v })
  },
}

export function useC<T>(sel: (s: CState) => T): T {
  return useSyncExternalStore(cstore.subscribe, () => sel(state))
}
