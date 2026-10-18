import { useSyncExternalStore } from "react"
import { toast } from "sonner"

import { rig } from "@/data/rig-sim"

/** A scripted "dull thud vs hollow drum" walkthrough for judges. */
let step: string | null = null
let cancelled = false
const listeners = new Set<() => void>()
const setStep = (s: string | null) => {
  step = s
  listeners.forEach((l) => l())
}

export function useDemoStep() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    () => step
  )
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const waitTask = () =>
  new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      if (!rig.snapshot.task || cancelled) {
        clearInterval(iv)
        resolve()
      }
    }, 150)
  })

export function stopDemo() {
  if (!step) return
  cancelled = true
  rig.cancelTask()
  setStep(null)
}

export async function runDemo() {
  if (step) return
  cancelled = false
  const go = async (label: string, fn: () => void, settle = 250) => {
    if (cancelled) return
    setStep(label)
    toast(label)
    fn()
    await wait(settle)
    await waitTask()
  }
  try {
    if (rig.snapshot.task) rig.cancelTask()
    if (!rig.snapshot.connected || rig.snapshot.transport === "serial") rig.useWifi()
    rig.setScenario("packed")
    if (!rig.snapshot.flowOn) rig.setFlow(true)
    await go("1/4 Calibrate healthy baseline on packed soil", () => rig.calibrate(5))
    await go("2/4 Pulse test on packed soil: dull thud", () => rig.runPulseTest(3, 800))
    await go("3/4 Wash out 250 ml of soil under the pipe", () => rig.setScenario("void-m"), 1800)
    await go("4/4 Pulse test again: hollow drum", () => rig.runPulseTest(3, 800))
    if (!cancelled) toast.success("Demo done: compare the ring-down curves")
  } finally {
    setStep(null)
  }
}
