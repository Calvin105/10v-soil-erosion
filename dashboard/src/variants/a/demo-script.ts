import { rig } from "@/data/rig-sim"

/**
 * Scripted judge demo: calibrate on packed soil, introduce a 250 ml void,
 * then run a flow pulse test so the ring-down "hollow drum" appears.
 */

let running = false

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function waitIdle() {
  return new Promise<void>((resolve) => {
    if (!rig.snapshot.task) return resolve()
    const unsub = rig.subscribe(() => {
      if (!rig.snapshot.task) {
        unsub()
        resolve()
      }
    })
  })
}

export function demoRunning() {
  return running
}

export async function runDemoScript(fast = false) {
  if (running || rig.snapshot.task) return
  running = true
  try {
    rig.setScenario("packed")
    if (!rig.snapshot.flowOn) rig.setFlow(true)
    rig.calibrate(fast ? 2 : 6)
    await waitIdle()
    await sleep(fast ? 250 : 1200)
    rig.setScenario("void-m")
    await sleep(fast ? 300 : 1500)
    rig.runPulseTest(fast ? 2 : 4, fast ? 400 : 1000)
    await waitIdle()
  } finally {
    running = false
  }
}

export function resetRig() {
  rig.cancelTask()
  rig.setScenario("packed")
  if (!rig.snapshot.flowOn) rig.setFlow(true)
  if (rig.snapshot.wet) rig.setWet(false)
  rig.acknowledge()
}
