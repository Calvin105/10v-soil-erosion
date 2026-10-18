import { useSyncExternalStore } from "react"

import type { ClassLabel, NodeState, Probs, Scenario } from "./types"

/**
 * Simulates the prototype rig: ESP32 (XIAO ESP32S3 Sense) streaming
 *  - MIC: PDM microphone -> FFT -> 256-bin spectrum (0-8 kHz, dB)
 *  - VIB: analog piezo vibration sensor -> waveform (2 kHz display rate)
 * Flow ON/OFF switching creates vibration transients whose ring-down
 * lengthens when soil around the pipe is missing (the "hollow drum").
 */

export const FPS = 15
export const MIC_BINS = 256
export const MIC_MAX_HZ = 8000
export const VIB_SAMPLES_PER_FRAME = 128
export const VIB_RATE_HZ = 2000
export const BANDS: { id: string; label: string; from: number; to: number }[] = [
  { id: "laminar", label: "Flow rumble", from: 0, to: 200 },
  { id: "low", label: "Low", from: 200, to: 800 },
  { id: "resonance", label: "Pipe resonance", from: 800, to: 2000 },
  { id: "leak", label: "Leak hiss", from: 2000, to: 5000 },
  { id: "high", label: "High", from: 5000, to: 8000 },
]

export interface RigFrame {
  seq: number
  t: number
  mic: Float32Array
  vib: Float32Array
  flowOn: boolean
}

export interface Transient {
  at: number
  tauMs: number
  f0Hz: number
  peak: number
  envelope: number[]
}

export interface TaskProgress {
  kind: "calibrate" | "pulse" | "record"
  label: string
  progress: number
  startedAt: number
  durationMs: number
}

export interface PulseResult {
  cycles: number
  meanTauMs: number
  baselineTauMs: number | null
  ratio: number | null
  taus: number[]
  at: number
}

export interface RigEvent {
  at: number
  level: "info" | "warn" | "alert" | "success"
  text: string
}

export interface RigSnapshot {
  running: boolean
  transport: "wifi" | "serial"
  connected: boolean
  fps: number
  seq: number
  scenario: Scenario
  flowOn: boolean
  wet: boolean
  tinyMlOnDevice: boolean
  features: {
    micRmsDb: number
    vibRms: number
    vibCrest: number
    centroidHz: number
    peakHz: number
    bandDb: number[]
  }
  laptopProbs: Probs
  tinyProbs: Probs
  vri: number
  vriComponents: { classifier: number; deviation: number; ringTime: number }
  state: NodeState
  vriHistory: { t: number; vri: number; state: NodeState }[]
  lastTransient: Transient | null
  baseline: { tauMs: number; at: number; envelope: number[] } | null
  task: TaskProgress | null
  lastPulse: PulseResult | null
  recordings: { label: ClassLabel; seconds: number; at: number }[]
  events: RigEvent[]
}

const SEVERITY: Record<Scenario, number> = {
  packed: 0,
  "void-s": 0.35,
  "void-m": 0.7,
  "void-l": 1,
  leak: 0.15,
  noise: 0,
}

const TAU_MS: Record<Scenario, number> = {
  packed: 8,
  "void-s": 12,
  "void-m": 18,
  "void-l": 24,
  leak: 10,
  noise: 8,
}

const TARGET_PROBS: Record<Scenario, Probs> = {
  packed: { packed: 0.9, void: 0.04, leak: 0.02, noise: 0.04 },
  "void-s": { packed: 0.38, void: 0.52, leak: 0.05, noise: 0.05 },
  "void-m": { packed: 0.1, void: 0.8, leak: 0.06, noise: 0.04 },
  "void-l": { packed: 0.03, void: 0.92, leak: 0.03, noise: 0.02 },
  leak: { packed: 0.08, void: 0.1, leak: 0.78, noise: 0.04 },
  noise: { packed: 0.2, void: 0.04, leak: 0.03, noise: 0.73 },
}

const ENVELOPE_POINTS = 60
const ENVELOPE_MS = 80
const LABELS: ClassLabel[] = ["packed", "void", "leak", "noise"]

function gauss(x: number, mu: number, sigma: number) {
  return Math.exp(-(((x - mu) / sigma) ** 2))
}

function jitter(amount: number) {
  return (Math.random() * 2 - 1) * amount
}

function envelope(tauMs: number, peak = 1): number[] {
  return Array.from({ length: ENVELOPE_POINTS }, (_, i) => {
    const t = (i / (ENVELOPE_POINTS - 1)) * ENVELOPE_MS
    return peak * Math.exp(-t / tauMs)
  })
}

function noisyProbs(target: Probs, noise: number): Probs {
  const raw = LABELS.map((l) => Math.max(0.001, target[l] + jitter(noise)))
  const sum = raw.reduce((a, b) => a + b, 0)
  return Object.fromEntries(LABELS.map((l, i) => [l, raw[i] / sum])) as Probs
}

function mixProbs(prev: Probs, next: Probs, a: number): Probs {
  return Object.fromEntries(
    LABELS.map((l) => [l, prev[l] * (1 - a) + next[l] * a])
  ) as Probs
}

class RigSimulator {
  private frameListeners = new Set<(f: RigFrame) => void>()
  private snapListeners = new Set<() => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private startMs = performance.now()
  private vibPhase = 0
  private transientStart: number | null = null
  private transientTau = 8
  private transientPeak = 0.8
  private pulseTimer: ReturnType<typeof setTimeout> | null = null
  private pulseTaus: number[] = []
  private calibSpectra: Float32Array[] = []
  private baselineSpectrum: Float32Array | null = null
  private abovesince = 0
  private belowsince = 0
  private lastFrameTimes: number[] = []
  private frameCount = 0

  frames: RigFrame[] = []
  snapshot: RigSnapshot = {
    running: true,
    transport: "wifi",
    connected: true,
    fps: FPS,
    seq: 0,
    scenario: "packed",
    flowOn: true,
    wet: false,
    tinyMlOnDevice: false,
    features: {
      micRmsDb: -60,
      vibRms: 0,
      vibCrest: 0,
      centroidHz: 0,
      peakHz: 0,
      bandDb: BANDS.map(() => -90),
    },
    laptopProbs: TARGET_PROBS.packed,
    tinyProbs: TARGET_PROBS.packed,
    vri: 10,
    vriComponents: { classifier: 0, deviation: 0, ringTime: 0 },
    state: "GREEN",
    vriHistory: [],
    lastTransient: null,
    baseline: null,
    task: null,
    lastPulse: null,
    recordings: [],
    events: [
      { at: Date.now(), level: "info", text: "ESP32 connected over Wi-Fi (simulated)" },
    ],
  }

  private ensureRunning() {
    if (this.timer || !this.snapshot.running) return
    this.timer = setInterval(() => this.tick(), 1000 / FPS)
  }

  subscribe = (cb: () => void) => {
    this.snapListeners.add(cb)
    this.ensureRunning()
    return () => this.snapListeners.delete(cb)
  }

  getSnapshot = () => this.snapshot

  getBaselineSpectrum() {
    return this.baselineSpectrum
  }

  onFrame(cb: (f: RigFrame) => void) {
    this.frameListeners.add(cb)
    this.ensureRunning()
    return () => {
      this.frameListeners.delete(cb)
    }
  }

  private emit(patch: Partial<RigSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.snapListeners.forEach((l) => l())
  }

  private log(level: RigEvent["level"], text: string) {
    const events = [{ at: Date.now(), level, text }, ...this.snapshot.events].slice(0, 60)
    this.emit({ events })
  }

  // ---------- controls ----------

  setScenario(scenario: Scenario) {
    this.emit({ scenario })
    this.log("info", `Rig scenario set: ${scenario}`)
  }

  setFlow(on: boolean, silent = false) {
    if (on === this.snapshot.flowOn) return
    const sc = this.snapshot.scenario
    this.transientStart = this.now()
    this.transientTau = TAU_MS[sc] * (1 + jitter(0.1))
    this.transientPeak = 0.7 * (1 + 0.8 * SEVERITY[sc]) * (1 + jitter(0.08))
    const tr: Transient = {
      at: Date.now(),
      tauMs: this.transientTau,
      f0Hz: 180 - 50 * SEVERITY[sc] + jitter(6),
      peak: this.transientPeak,
      envelope: envelope(this.transientTau, this.transientPeak),
    }
    if (this.snapshot.task?.kind === "pulse") this.pulseTaus.push(tr.tauMs)
    this.emit({ flowOn: on, lastTransient: tr })
    if (!silent) this.log("info", `Flow ${on ? "ON" : "OFF"} - transient tau ${tr.tauMs.toFixed(1)} ms`)
  }

  setWet(wet: boolean) {
    this.emit({ wet })
    this.log(wet ? "warn" : "info", wet ? "Water reached sensor height (WET)" : "Water below sensor (DRY)")
  }

  setTinyMl(on: boolean) {
    this.emit({ tinyMlOnDevice: on })
    this.log("info", on ? "TinyML model running on ESP32" : "Inference on laptop (Phase 1)")
  }

  setRunning(running: boolean) {
    if (!running && this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.emit({ running })
    if (running) this.ensureRunning()
  }

  dropWifi() {
    this.emit({ connected: false })
    this.log("warn", "Wi-Fi lost - switching to USB serial fallback")
    setTimeout(() => {
      this.emit({ connected: true, transport: "serial" })
      this.log("success", "Streaming resumed over USB serial")
    }, 2500)
  }

  useWifi() {
    this.emit({ transport: "wifi", connected: true })
    this.log("info", "Streaming over Wi-Fi")
  }

  calibrate(seconds = 8) {
    if (this.snapshot.task) return
    this.calibSpectra = []
    this.startTask("calibrate", "Calibrating healthy baseline", seconds * 1000)
    this.log("info", `Calibrating baseline for ${seconds} s (keep soil packed)`)
  }

  runPulseTest(cycles = 4, halfPeriodMs = 1200) {
    if (this.snapshot.task) return
    this.pulseTaus = []
    const total = cycles * 2 * halfPeriodMs
    this.startTask("pulse", `Flow pulse test (${cycles} on/off cycles)`, total)
    this.log("info", `Flow pulse test started: ${cycles} cycles`)
    let n = 0
    const step = () => {
      if (n >= cycles * 2) return
      this.setFlow(n % 2 === 0 ? false : true, true)
      n++
      this.pulseTimer = setTimeout(step, halfPeriodMs)
    }
    if (!this.snapshot.flowOn) this.setFlow(true, true)
    this.pulseTimer = setTimeout(step, 200)
  }

  record(label: ClassLabel, seconds = 10) {
    if (this.snapshot.task) return
    this.startTask("record", `Recording "${label}" clip`, seconds * 1000)
    this.recordLabel = label
    this.recordSeconds = seconds
    this.log("info", `Recording ${seconds} s labelled "${label}"`)
  }

  cancelTask() {
    if (this.pulseTimer) clearTimeout(this.pulseTimer)
    if (this.snapshot.task) this.log("warn", `${this.snapshot.task.label} cancelled`)
    this.emit({ task: null })
  }

  acknowledge() {
    this.abovesince = 0
    this.emit({ state: "GREEN" })
    this.log("info", "Alert acknowledged - state reset")
  }

  private recordLabel: ClassLabel = "packed"
  private recordSeconds = 10

  private startTask(kind: TaskProgress["kind"], label: string, durationMs: number) {
    this.emit({ task: { kind, label, progress: 0, startedAt: this.now(), durationMs } })
  }

  private finishTask() {
    const task = this.snapshot.task
    if (!task) return
    if (task.kind === "calibrate") {
      const n = this.calibSpectra.length || 1
      const mean = new Float32Array(MIC_BINS)
      this.calibSpectra.forEach((s) => s.forEach((v, i) => (mean[i] += v / n)))
      this.baselineSpectrum = mean
      const tau = TAU_MS[this.snapshot.scenario]
      this.emit({
        task: null,
        baseline: { tauMs: tau, at: Date.now(), envelope: envelope(tau, 0.7) },
      })
      this.log("success", `Baseline saved (ring-down tau ${tau.toFixed(1)} ms)`)
      if (this.snapshot.scenario !== "packed")
        this.log("warn", "Baseline captured while rig was NOT packed - re-pack and recalibrate")
    } else if (task.kind === "pulse") {
      const taus = this.pulseTaus.length ? this.pulseTaus : [TAU_MS[this.snapshot.scenario]]
      const meanTau = taus.reduce((a, b) => a + b, 0) / taus.length
      const base = this.snapshot.baseline?.tauMs ?? null
      const result: PulseResult = {
        cycles: Math.round(taus.length / 2),
        meanTauMs: meanTau,
        baselineTauMs: base,
        ratio: base ? meanTau / base : null,
        taus,
        at: Date.now(),
      }
      if (!this.snapshot.flowOn) this.setFlow(true, true)
      this.emit({ task: null, lastPulse: result })
      this.log(
        result.ratio && result.ratio > 1.8 ? "alert" : "success",
        `Pulse test done: mean tau ${meanTau.toFixed(1)} ms${result.ratio ? ` (${result.ratio.toFixed(2)}x baseline)` : ""}`
      )
    } else if (task.kind === "record") {
      const recordings = [
        { label: this.recordLabel, seconds: this.recordSeconds, at: Date.now() },
        ...this.snapshot.recordings,
      ]
      this.emit({ task: null, recordings })
      this.log("success", `Saved ${this.recordSeconds} s clip "${this.recordLabel}" (mic.wav + vib.wav)`)
    }
  }

  // ---------- generation ----------

  private now() {
    return performance.now() - this.startMs
  }

  private tick() {
    const s = this.snapshot
    if (!s.connected) return
    const t = this.now()
    const seq = s.seq + 1
    const sc = s.scenario
    const sev = SEVERITY[sc]

    // MIC spectrum (dB)
    const mic = new Float32Array(MIC_BINS)
    const inTransient =
      this.transientStart !== null && t - this.transientStart < 140
    const thump = sc === "noise" && Math.random() < 0.12
    const f0 = 1900 - 600 * sev
    for (let i = 0; i < MIC_BINS; i++) {
      const f = (i + 0.5) * (MIC_MAX_HZ / MIC_BINS)
      let db = -98 + jitter(3)
      if (s.flowOn) {
        db += 46 * gauss(f, 90, 140) + 18 * gauss(f, 450, 600)
        if (sev > 0 && sc !== "leak")
          db += 38 * sev * gauss(f, f0, 90) + 20 * sev * gauss(f, 2 * f0, 120)
      } else if (sev > 0 && sc !== "leak") {
        db += 12 * sev * gauss(f, f0, 90)
      }
      if (sc === "leak" && s.flowOn) db += 26 * gauss(f, 2400, 1500) + jitter(2)
      if (sc === "noise") db += 34 * gauss(f, 70, 220) + (thump ? 22 * gauss(f, 300, 2500) : 0)
      if (inTransient) db += 16 * gauss(f, 600, 2500)
      if (s.wet) db += 10 * gauss(f, 300, 3000) - 6 * gauss(f, 5000, 2000)
      mic[i] = Math.max(-120, Math.min(0, db))
    }

    // VIB waveform
    const vib = new Float32Array(VIB_SAMPLES_PER_FRAME)
    const rumbleAmp = (s.flowOn ? 0.12 : 0.015) * (1 + 1.6 * sev)
    let sumSq = 0
    let peak = 0
    for (let k = 0; k < VIB_SAMPLES_PER_FRAME; k++) {
      const ts = t + (k / VIB_RATE_HZ) * 1000
      this.vibPhase += 1 / VIB_RATE_HZ
      let v =
        rumbleAmp *
        (Math.sin(2 * Math.PI * 45 * this.vibPhase) +
          0.6 * Math.sin(2 * Math.PI * 110 * this.vibPhase + 1.3)) +
        jitter(0.02 + (sc === "leak" ? 0.06 : 0))
      if (this.transientStart !== null) {
        const dt = ts - this.transientStart
        if (dt >= 0 && dt < 400) {
          const f = 180 - 50 * sev
          v += this.transientPeak * Math.exp(-dt / this.transientTau) * Math.sin((2 * Math.PI * f * dt) / 1000)
        }
      }
      if (thump && k === 10) {
        this.transientStart = ts
        this.transientTau = 6
        this.transientPeak = 0.9
      }
      vib[k] = Math.max(-1, Math.min(1, v))
      sumSq += vib[k] ** 2
      peak = Math.max(peak, Math.abs(vib[k]))
    }

    const frame: RigFrame = { seq, t, mic, vib, flowOn: s.flowOn }
    this.frames.push(frame)
    if (this.frames.length > 300) this.frames.shift()
    this.frameListeners.forEach((l) => l(frame))

    if (s.task?.kind === "calibrate") this.calibSpectra.push(mic)

    this.frameCount++
    this.lastFrameTimes.push(t)
    if (this.lastFrameTimes.length > 30) this.lastFrameTimes.shift()

    // throttle React snapshot to ~5 Hz
    if (this.frameCount % 3 !== 0) {
      this.snapshot.seq = seq
      return
    }

    // features
    const lin = Array.from(mic, (d) => 10 ** (d / 10))
    const total = lin.reduce((a, b) => a + b, 0)
    let centroid = 0
    let peakBin = 0
    lin.forEach((p, i) => {
      centroid += p * (i + 0.5) * (MIC_MAX_HZ / MIC_BINS)
      if (p > lin[peakBin]) peakBin = i
    })
    centroid /= total
    const bandDb = BANDS.map((b) => {
      let e = 0
      lin.forEach((p, i) => {
        const f = (i + 0.5) * (MIC_MAX_HZ / MIC_BINS)
        if (f >= b.from && f < b.to) e += p
      })
      return 10 * Math.log10(e + 1e-12)
    })
    const vibRms = Math.sqrt(sumSq / VIB_SAMPLES_PER_FRAME)

    // classifiers
    const laptopProbs = mixProbs(s.laptopProbs, noisyProbs(TARGET_PROBS[sc], 0.06), 0.35)
    const tinyProbs = mixProbs(s.tinyProbs, noisyProbs(TARGET_PROBS[sc], 0.1), 0.3)
    const probs = s.tinyMlOnDevice ? tinyProbs : laptopProbs

    // VRI components
    const classifier = Math.min(1, probs.void + 0.5 * probs.leak)
    let deviation = 0
    if (this.baselineSpectrum) {
      let maxDiff = 0
      BANDS.forEach((b) => {
        let d = 0
        let n = 0
        mic.forEach((v, i) => {
          const f = (i + 0.5) * (MIC_MAX_HZ / MIC_BINS)
          if (f >= b.from && f < b.to) {
            d += v - this.baselineSpectrum![i]
            n++
          }
        })
        maxDiff = Math.max(maxDiff, d / Math.max(n, 1))
      })
      deviation = Math.max(0, Math.min(1, maxDiff / 20))
    }
    let ringTime = 0
    const baseTau = s.baseline?.tauMs
    const lastTau = s.lastPulse?.meanTauMs ?? s.lastTransient?.tauMs
    if (baseTau && lastTau) ringTime = Math.max(0, Math.min(1, (lastTau / baseTau - 1) / 2))
    const hasRing = !!(baseTau && lastTau)
    const w = hasRing
      ? { c: 0.4, d: 0.3, r: 0.3 }
      : this.baselineSpectrum
        ? { c: 0.57, d: 0.43, r: 0 }
        : { c: 1, d: 0, r: 0 }
    const raw = 100 * (w.c * classifier + w.d * deviation + w.r * ringTime)
    const vri = Math.round(s.vri * 0.6 + raw * 0.4)

    // state machine (demo: ~3 s persistence)
    let state = s.state
    if (vri >= 70) this.abovesince++
    else if (vri >= 40 && state === "GREEN") this.abovesince++
    else this.abovesince = 0
    if (vri < 30) this.belowsince++
    else this.belowsince = 0
    const N = 9
    if (state !== "RED" && vri >= 70 && this.abovesince >= N) {
      state = "RED"
      this.log("alert", `RED: VRI ${vri} for 3 consecutive windows - alert raised`)
    } else if (state === "GREEN" && vri >= 40 && this.abovesince >= N) {
      state = "YELLOW"
      this.log("warn", `YELLOW: VRI ${vri} - investigate`)
    } else if (state === "YELLOW" && this.belowsince >= N) {
      state = "GREEN"
      this.log("info", "Back to GREEN")
    }

    // task progress
    let task = s.task
    if (task) {
      const progress = Math.min(1, (t - task.startedAt) / task.durationMs)
      task = { ...task, progress }
    }

    const span = this.lastFrameTimes.length > 1
      ? this.lastFrameTimes[this.lastFrameTimes.length - 1] - this.lastFrameTimes[0]
      : 1000
    const fps = Math.round(((this.lastFrameTimes.length - 1) / span) * 1000)

    const vriHistory = [...s.vriHistory, { t: Date.now(), vri, state }].slice(-150)

    this.emit({
      seq,
      fps,
      features: {
        micRmsDb: 10 * Math.log10(total / MIC_BINS + 1e-12),
        vibRms,
        vibCrest: vibRms > 0 ? peak / vibRms : 0,
        centroidHz: centroid,
        peakHz: (peakBin + 0.5) * (MIC_MAX_HZ / MIC_BINS),
        bandDb,
      },
      laptopProbs,
      tinyProbs,
      vri,
      vriComponents: { classifier, deviation, ringTime },
      state,
      vriHistory,
      task,
    })

    if (task && task.progress >= 1) this.finishTask()
  }
}

export const rig = new RigSimulator()

export function useRig(): RigSnapshot {
  return useSyncExternalStore(rig.subscribe, rig.getSnapshot)
}

export function binToHz(i: number) {
  return (i + 0.5) * (MIC_MAX_HZ / MIC_BINS)
}
