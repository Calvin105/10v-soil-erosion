import {
  AUDIO_BANDS,
  MIC_BINS,
  MIC_MAX_HZ,
  type AudioClip,
  type AudioRun,
  type Condition,
} from "./types"

// Lazy Web Audio Context
let audioCtx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new AudioContextClass()
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume()
  }
  return audioCtx
}

// -------------------------------------------------------------
// Fast Fourier Transform (Cooley-Tukey Radix-2)
// -------------------------------------------------------------

function fftRadix2(re: Float32Array, im: Float32Array, n: number) {
  let j = 0
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = re[i]
      re[i] = re[j]
      re[j] = tempR
      const tempI = im[i]
      im[i] = im[j]
      im[j] = tempI
    }
    let k = n >> 1
    while (k <= j) {
      j -= k
      k >>= 1
    }
    j += k
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1
    const angle = (-2 * Math.PI) / len
    const wStepR = Math.cos(angle)
    const wStepI = Math.sin(angle)

    for (let i = 0; i < n; i += len) {
      let wr = 1
      let wi = 0
      for (let m = 0; m < half; m++) {
        const uR = re[i + m]
        const uI = im[i + m]
        const vR = re[i + m + half] * wr - im[i + m + half] * wi
        const vI = re[i + m + half] * wi + im[i + m + half] * wr

        re[i + m] = uR + vR
        im[i + m] = uI + vI
        re[i + m + half] = uR - vR
        im[i + m + half] = uI - vI

        const nextWr = wr * wStepR - wi * wStepI
        wi = wr * wStepI + wi * wStepR
        wr = nextWr
      }
    }
  }
}

// Precomputed Hann window for N=1024
const FFT_SIZE = 1024
const HANN_WINDOW = new Float32Array(FFT_SIZE)
for (let i = 0; i < FFT_SIZE; i++) {
  HANN_WINDOW[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)))
}
// A full-scale sine peaks at |X| = sum(window) / 2, so dividing power by its square gives dBFS
// and keeps spectra in the same range as the rig's mic spectrum (floor ~-100, peaks ~-30).
const POWER_NORM = 1 / (HANN_WINDOW.reduce((a, b) => a + b, 0) / 2) ** 2

/**
 * Computes STFT (Short-Time Fourier Transform) for an AudioBuffer.
 * Returns array of 256-bin spectrum slices (0 to 8000 Hz in dB).
 */
export function computeStft(buffer: AudioBuffer, hopSize = 512): {
  slices: Float32Array[]
  rmsDb: number
  peakHz: number
  centroidHz: number
  bandDb: number[]
  waveform: Float32Array
} {
  const pcm = buffer.getChannelData(0)
  const totalSamples = pcm.length

  // Downsample waveform for visual scope (e.g. 1000 points across the 10 seconds)
  const wavePoints = 800
  const waveform = new Float32Array(wavePoints)
  const step = Math.floor(totalSamples / wavePoints)
  for (let i = 0; i < wavePoints; i++) {
    let sum = 0
    const start = i * step
    const end = Math.min(start + step, totalSamples)
    for (let s = start; s < end; s++) {
      sum += Math.abs(pcm[s])
    }
    waveform[i] = sum / Math.max(1, end - start)
  }

  // Compute STFT frames
  const numFrames = Math.max(1, Math.floor((totalSamples - FFT_SIZE) / hopSize))
  const slices: Float32Array[] = []
  const re = new Float32Array(FFT_SIZE)
  const im = new Float32Array(FFT_SIZE)

  let globalMaxPower = 0
  let globalPeakBin = 0
  let totalEnergy = 0
  let weightedFreqSum = 0

  // Band accumulators
  const bandPowers = [0, 0, 0, 0, 0]

  for (let f = 0; f < numFrames; f++) {
    const offset = f * hopSize
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = pcm[offset + i] * HANN_WINDOW[i]
      im[i] = 0
    }

    fftRadix2(re, im, FFT_SIZE)

    const slice = new Float32Array(MIC_BINS)
    // 512 positive FFT bins -> pool pairs into 256 bins
    for (let b = 0; b < MIC_BINS; b++) {
      const idx1 = b * 2
      const idx2 = idx1 + 1
      const p1 = re[idx1] * re[idx1] + im[idx1] * im[idx1]
      const p2 = re[idx2] * re[idx2] + im[idx2] * im[idx2]
      const power = (p1 + p2) * 0.5 * POWER_NORM

      // Convert power to dBFS (clamped -115 to 0)
      const db = 10 * Math.log10(Math.max(1e-12, power))
      slice[b] = Math.max(-115, Math.min(0, db))

      const freqHz = (b / (MIC_BINS - 1)) * MIC_MAX_HZ
      totalEnergy += power
      weightedFreqSum += freqHz * power

      // Detect resonant acoustic peak (ignore sub-250 Hz DC rumble)
      if (freqHz >= 250 && freqHz <= 7500 && power > globalMaxPower) {
        globalMaxPower = power
        globalPeakBin = b
      }

      // Aggregate into sub-bands
      for (let bi = 0; bi < AUDIO_BANDS.length; bi++) {
        if (freqHz >= AUDIO_BANDS[bi].from && freqHz < AUDIO_BANDS[bi].to) {
          bandPowers[bi] += power
          break
        }
      }
    }
    slices.push(slice)
  }

  // Overall RMS in dB
  let rmsSum = 0
  for (let i = 0; i < totalSamples; i++) {
    rmsSum += pcm[i] * pcm[i]
  }
  const rmsVal = Math.sqrt(rmsSum / Math.max(1, totalSamples))
  const rmsDb = Math.max(-110, Math.min(0, 20 * Math.log10(Math.max(1e-6, rmsVal))))

  // If no peak found above 250 Hz, fallback to 1050 Hz
  const peakHz = globalPeakBin > 0 ? Math.round((globalPeakBin / (MIC_BINS - 1)) * MIC_MAX_HZ) : 1050
  const centroidHz = totalEnergy > 0 ? Math.round(weightedFreqSum / totalEnergy) : 1000

  const totalFrames = Math.max(1, numFrames)
  const bandDb = bandPowers.map((p) => {
    const meanP = p / totalFrames
    return Math.max(-110, Math.min(-10, 10 * Math.log10(Math.max(1e-12, meanP))))
  })

  return {
    slices,
    rmsDb,
    peakHz,
    centroidHz,
    bandDb,
    waveform,
  }
}

// -------------------------------------------------------------
// Audio Clip AudioBuffer Player
// -------------------------------------------------------------

export class ClipPlayer {
  private ctx: AudioContext
  private source: AudioBufferSourceNode | null = null
  private gainNode: GainNode
  private currentBuffer: AudioBuffer | null = null
  private startedAt = 0
  private pauseOffset = 0
  private isPlaying = false
  private rafId: number | null = null
  private onTimeUpdate: (t: number) => void

  constructor(onTimeUpdate: (t: number) => void) {
    this.ctx = getAudioContext()
    this.gainNode = this.ctx.createGain()
    this.gainNode.connect(this.ctx.destination)
    this.onTimeUpdate = onTimeUpdate
  }

  setVolume(vol: number) {
    this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime)
  }

  setMuted(muted: boolean) {
    this.gainNode.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime)
  }

  loadClip(buffer: AudioBuffer | null) {
    this.stop()
    this.currentBuffer = buffer
    this.pauseOffset = 0
    this.onTimeUpdate(0)
  }

  play() {
    if (!this.currentBuffer) return
    if (this.ctx.state === "suspended") void this.ctx.resume()

    this.stopSourceOnly()

    const src = this.ctx.createBufferSource()
    src.buffer = this.currentBuffer
    src.connect(this.gainNode)

    const offset = Math.min(this.pauseOffset, this.currentBuffer.duration)
    src.start(0, offset)
    this.startedAt = this.ctx.currentTime - offset
    this.source = src
    this.isPlaying = true

    src.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false
        this.pauseOffset = 0
        this.stopTicker()
        this.onTimeUpdate(0)
      }
    }

    this.startTicker()
  }

  pause() {
    if (!this.isPlaying) return
    const elapsed = this.ctx.currentTime - this.startedAt
    this.pauseOffset = Math.min(elapsed, this.currentBuffer?.duration || 0)
    this.stopSourceOnly()
    this.isPlaying = false
    this.stopTicker()
    this.onTimeUpdate(this.pauseOffset)
  }

  seek(seconds: number) {
    const dur = this.currentBuffer?.duration || 10
    const clamped = Math.max(0, Math.min(dur, seconds))
    this.pauseOffset = clamped
    if (this.isPlaying) {
      this.play()
    } else {
      this.onTimeUpdate(clamped)
    }
  }

  stop() {
    this.stopSourceOnly()
    this.isPlaying = false
    this.pauseOffset = 0
    this.stopTicker()
    this.onTimeUpdate(0)
  }

  private stopSourceOnly() {
    if (this.source) {
      try {
        this.source.stop()
        this.source.disconnect()
      } catch {
        // ignore if already stopped
      }
      this.source = null
    }
  }

  private startTicker() {
    this.stopTicker()
    const tick = () => {
      if (this.isPlaying && this.currentBuffer) {
        const t = this.ctx.currentTime - this.startedAt
        this.onTimeUpdate(Math.min(t, this.currentBuffer.duration))
        this.rafId = requestAnimationFrame(tick)
      }
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private stopTicker() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}

// -------------------------------------------------------------
// Synthetic Water Flow Audio Generator (Fallback)
// -------------------------------------------------------------

/**
 * Creates 10-second synthetic audio buffers simulating water flow
 * through a pipe, with subtle turbulence and varying resonant peaks
 * corresponding to the 18 test runs.
 */
export function generateSyntheticRuns(): AudioRun[] {
  const sampleRate = 16000
  const durationSec = 10
  const totalSamples = sampleRate * durationSec
  const ctx = getAudioContext()

  const runs: AudioRun[] = []
  const conditions: { cond: Condition; label: string; count: number }[] = [
    { cond: "safe", label: "Safe", count: 18 },
    { cond: "ambient", label: "Ambient", count: 8 },
    { cond: "void", label: "Void", count: 18 },
  ]

  for (const { cond, label, count } of conditions) {
    const isVoid = cond === "void"
    const isAmbient = cond === "ambient"

    for (let r = 1; r <= count; r++) {
      const clips: AudioClip[] = []

      // In "safe" condition: well-damped, resonance ~1000-1120 Hz, lower energy, no hollow ringing
      // In "ambient" condition: idle background, very quiet noise floor
      // In "void" condition: undamped cavity resonance ~1400-1750 Hz, high turbulent hiss in 2-5 kHz
      const severity = isVoid
        ? 0.72 + (r % 6) * 0.04
        : isAmbient
          ? 0.03 + (r % 4) * 0.01
          : 0.08 + (r % 6) * 0.02

      const baseResonance = isVoid
        ? 1450 + (r % 6) * 40
        : isAmbient
          ? 500 + (r % 4) * 30
          : 1040 + (r % 6) * 15

      const flowRumbleGain = isVoid ? 0.32 : isAmbient ? 0.02 : 0.18

      for (let c = 1; c <= 10; c++) {
        const buffer = ctx.createBuffer(1, totalSamples, sampleRate)
        const data = buffer.getChannelData(0)

        const clipResonance = baseResonance + Math.sin(c * 1.5) * (isVoid ? 45 : 15)
        const resonanceQ = isVoid ? 18 : isAmbient ? 3 : 6

        let b0 = 0
        let b1 = 0
        let b2 = 0
        let y1 = 0
        let y2 = 0

        const omega = (2 * Math.PI * clipResonance) / sampleRate
        const alpha = Math.sin(omega) / (2 * resonanceQ)
        const a0 = 1 + alpha
        const a1 = -2 * Math.cos(omega)
        const a2 = 1 - alpha

        for (let i = 0; i < totalSamples; i++) {
          const white = Math.random() * 2 - 1

          b0 = 0.99 * b0 + white * 0.05
          b1 = 0.95 * b1 + white * 0.1
          b2 = 0.85 * b2 + white * 0.15
          const waterRumble = (b0 + b1 + b2) * 0.33 * flowRumbleGain

          const inSample = white * (isVoid ? 0.08 : isAmbient ? 0.005 : 0.02)
          const outSample = (alpha * inSample - a1 * y1 - a2 * y2) / a0
          y2 = y1
          y1 = outSample

          data[i] = Math.max(-0.95, Math.min(0.95, waterRumble + outSample * (isAmbient ? 1.5 : 4)))
        }

        const stft = computeStft(buffer, 512)

        clips.push({
          id: `${cond}_run_${r}_clip_${c}`,
          runNumber: r,
          clipIndex: c,
          condition: cond,
          name: `${label} R${r.toString().padStart(2, "0")} C${c.toString().padStart(2, "0")}`,
          durationSec,
          audioBuffer: buffer,
          waveform: stft.waveform,
          stftFrames: stft.slices,
          stftHopSec: 512 / sampleRate,
          rmsDb: stft.rmsDb,
          peakHz: stft.peakHz,
          centroidHz: stft.centroidHz,
          bandDb: stft.bandDb,
        })
      }

      const avgRmsDb = clips.reduce((acc, c) => acc + c.rmsDb, 0) / clips.length
      const avgPeakHz = clips.reduce((acc, c) => acc + c.peakHz, 0) / clips.length

      const vriScore = Math.round(severity * 100)
      const state = vriScore >= 70 ? "RED" : vriScore >= 40 ? "YELLOW" : "GREEN"

      runs.push({
        id: `${cond}_run_${r}`,
        runNumber: r,
        condition: cond,
        name: `${label} Run ${r.toString().padStart(2, "0")}`,
        clips,
        avgRmsDb: Math.round(avgRmsDb * 10) / 10,
        avgPeakHz: Math.round(avgPeakHz),
        vriScore,
        state,
        isBaseline: cond === "safe" && r === 1,
        isSynthetic: true,
      })
    }
  }

  return runs
}

// -------------------------------------------------------------
// File Ingestion (.WAV Parser for real files)
// -------------------------------------------------------------

/**
 * Parses uploaded .wav files and categorizes them into safe, ambient, or void.
 */
export async function parseUploadedWavFiles(files: FileList | File[]): Promise<AudioRun[]> {
  const ctx = getAudioContext()
  const fileArray = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".wav"))

  if (fileArray.length === 0) {
    throw new Error("No .wav files found in selection.")
  }

  const runs: AudioRun[] = []

  // Check if we have single long files (e.g. 30-min void.wav / safe.wav) or multiple clip files
  for (const file of fileArray) {
    const path = ((file as { webkitRelativePath?: string }).webkitRelativePath || file.name).toLowerCase()
    const isAmbient = path.includes("ambient")
    const isVoid = path.includes("void")
    const condition: Condition = isAmbient ? "ambient" : isVoid ? "void" : "safe"
    const label = isAmbient ? "Ambient" : isVoid ? "Void" : "Safe"

    const arrayBuffer = await file.arrayBuffer()
    const fullBuffer = await ctx.decodeAudioData(arrayBuffer)

    // If file is a long recording (> 20s, e.g. 30 minutes = 1800s): auto-slice into runs x 10 clips
    if (fullBuffer.duration > 20) {
      const clipDuration = 10
      const sampleRate = fullBuffer.sampleRate
      const pcm = fullBuffer.getChannelData(0)
      const totalClips = Math.min(180, Math.floor(fullBuffer.duration / clipDuration))
      const numRuns = Math.max(1, Math.min(18, Math.ceil(totalClips / 10)))

      for (let r = 1; r <= numRuns; r++) {
        const clips: AudioClip[] = []
        const startClipIdx = (r - 1) * 10 + 1
        const endClipIdx = Math.min(totalClips, r * 10)

        for (let c = startClipIdx; c <= endClipIdx; c++) {
          const clipIdxInRun = c - (r - 1) * 10
          const startSample = (c - 1) * clipDuration * sampleRate
          const endSample = Math.min(pcm.length, c * clipDuration * sampleRate)

          const clipBuffer = ctx.createBuffer(1, Math.max(1, endSample - startSample), sampleRate)
          clipBuffer.getChannelData(0).set(pcm.subarray(startSample, endSample))
          const stft = computeStft(clipBuffer, 512)

          clips.push({
            id: `${condition}_r${r}_c${clipIdxInRun}`,
            runNumber: r,
            clipIndex: clipIdxInRun,
            condition,
            name: `${label} R${r.toString().padStart(2, "0")} C${clipIdxInRun.toString().padStart(2, "0")}`,
            durationSec: 10,
            audioBuffer: clipBuffer,
            waveform: stft.waveform,
            stftFrames: stft.slices,
            stftHopSec: 512 / sampleRate,
            rmsDb: stft.rmsDb,
            peakHz: stft.peakHz,
            centroidHz: stft.centroidHz,
            bandDb: stft.bandDb,
          })
        }

        const avgRmsDb = clips.reduce((acc, c) => acc + c.rmsDb, 0) / Math.max(1, clips.length)
        const avgPeakHz = clips.reduce((acc, c) => acc + c.peakHz, 0) / Math.max(1, clips.length)

        runs.push({
          id: `${condition}_run_${r}`,
          runNumber: r,
          condition,
          name: `${label} Run ${r.toString().padStart(2, "0")}`,
          clips,
          avgRmsDb: Math.round(avgRmsDb * 10) / 10,
          avgPeakHz: Math.round(avgPeakHz),
          vriScore: 0,
          state: "GREEN",
          isBaseline: condition === "safe" && r === 1,
          isSynthetic: false,
        })
      }
    }
  }

  // If files were already multiple individual 10s clip files:
  if (runs.length === 0) {
    const groupMap = new Map<string, { condition: Condition; runNumber: number; clips: Map<number, File> }>()

    for (const file of fileArray) {
      const path = ((file as { webkitRelativePath?: string }).webkitRelativePath || file.name).toLowerCase()
      const isAmbient = path.includes("ambient")
      const isVoid = path.includes("void")
      const condition: Condition = isAmbient ? "ambient" : isVoid ? "void" : "safe"

      const matchRun =
        path.match(/run[_\s-]?(\d+)/i) ||
        path.match(/safe[_\s-]?soil[_\s-]?(\d+)/i) ||
        path.match(/critical[_\s-]?void[_\s-]?(\d+)/i) ||
        path.match(/ambient[_\s-]?(\d+)/i) ||
        path.match(/(\d+)[_\s\/-]/)
      const matchClip =
        path.match(/clip[_\s-]?(\d+)/i) ||
        path.match(/[-_](\d+)\.wav$/i) ||
        path.match(/(\d+)\.wav$/i)

      const rNum = matchRun ? parseInt(matchRun[1], 10) : 1
      const cNum = matchClip ? parseInt(matchClip[1], 10) : 1

      const key = `${condition}_${rNum}`
      if (!groupMap.has(key)) {
        groupMap.set(key, { condition, runNumber: rNum, clips: new Map() })
      }
      groupMap.get(key)!.clips.set(cNum, file)
    }

    for (const [key, group] of groupMap.entries()) {
      const sortedClipNumbers = Array.from(group.clips.keys()).sort((a, b) => a - b)
      const clips: AudioClip[] = []

      for (const cNum of sortedClipNumbers) {
        const file = group.clips.get(cNum)!
        const arrayBuffer = await file.arrayBuffer()
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        const stft = computeStft(audioBuffer, 512)

        clips.push({
          id: `${key}_clip_${cNum}`,
          runNumber: group.runNumber,
          clipIndex: cNum,
          condition: group.condition,
          name: file.name.replace(/\.wav$/i, ""),
          durationSec: Math.round(audioBuffer.duration * 10) / 10,
          audioBuffer,
          waveform: stft.waveform,
          stftFrames: stft.slices,
          stftHopSec: 512 / audioBuffer.sampleRate,
          rmsDb: stft.rmsDb,
          peakHz: stft.peakHz,
          centroidHz: stft.centroidHz,
          bandDb: stft.bandDb,
        })
      }

      const avgRmsDb = clips.reduce((acc, c) => acc + c.rmsDb, 0) / Math.max(1, clips.length)
      const avgPeakHz = clips.reduce((acc, c) => acc + c.peakHz, 0) / Math.max(1, clips.length)
      const label = group.condition === "void" ? "Void" : group.condition === "ambient" ? "Ambient" : "Safe"

      runs.push({
        id: key,
        runNumber: group.runNumber,
        condition: group.condition,
        name: `${label} Run ${group.runNumber.toString().padStart(2, "0")}`,
        clips,
        avgRmsDb: Math.round(avgRmsDb * 10) / 10,
        avgPeakHz: Math.round(avgPeakHz),
        vriScore: 0,
        state: "GREEN",
        isBaseline: group.condition === "safe" && group.runNumber === 1,
        isSynthetic: false,
      })
    }
  }

  // Sort by condition (safe first, then ambient, then void) then run number
  const order: Record<Condition, number> = { safe: 0, ambient: 1, void: 2 }
  runs.sort((a, b) => {
    if (a.condition !== b.condition) return order[a.condition] - order[b.condition]
    return a.runNumber - b.runNumber
  })

  return runs
}

// -------------------------------------------------------------
// Calculate Acoustic Void Risk Index (VRI)
// -------------------------------------------------------------

/**
 * Computes Void Risk Index (0-100) and state for a run compared against
 * the designated baseline run using purely acoustic (INMP441) features.
 */
export function calculateAcousticVri(run: AudioRun, baselineRun: AudioRun | null): {
  vri: number
  state: "GREEN" | "YELLOW" | "RED"
  components: {
    spectralDrift: number
    resonanceShift: number
    turbulentHiss: number
  }
} {
  if (!baselineRun || run.id === baselineRun.id) {
    return {
      vri: 12,
      state: "GREEN",
      components: {
        spectralDrift: 0.1,
        resonanceShift: 0.1,
        turbulentHiss: 0.15,
      },
    }
  }

  // 1. Spectral band drift (5 bands vs baseline). Only energy gained counts: a void adds
  // resonant/turbulent energy, whereas a quieter run (e.g. idle ambient noise) is not a void.
  let bandDeltaSum = 0
  for (let i = 0; i < 5; i++) {
    const curBand = run.clips.reduce((acc, c) => acc + c.bandDb[i], 0) / Math.max(1, run.clips.length)
    const baseBand = baselineRun.clips.reduce((acc, c) => acc + c.bandDb[i], 0) / Math.max(1, baselineRun.clips.length)
    bandDeltaSum += Math.max(0, curBand - baseBand)
  }
  const avgBandDelta = bandDeltaSum / 5
  // Map 0 to 15 dB drift -> 0 to 1
  const spectralDrift = Math.max(0, Math.min(1, avgBandDelta / 15))

  // 2. Resonance shift (peak frequency moving up towards 1200-1800 Hz cavity resonance)
  const peakDelta = Math.max(0, run.avgPeakHz - baselineRun.avgPeakHz)
  // Map 0 to 600 Hz shift -> 0 to 1
  const resonanceShift = Math.max(0, Math.min(1, peakDelta / 600))

  // 3. Turbulent Hiss drift (band 3: 2000-5000 Hz)
  const curHiss = run.clips.reduce((acc, c) => acc + c.bandDb[3], 0) / Math.max(1, run.clips.length)
  const baseHiss = baselineRun.clips.reduce((acc, c) => acc + c.bandDb[3], 0) / Math.max(1, baselineRun.clips.length)
  const hissDelta = Math.max(0, curHiss - baseHiss)
  const turbulentHiss = Math.max(0, Math.min(1, hissDelta / 12))

  // Weighted VRI formula: 45% Spectral Drift, 35% Resonance Shift, 20% Turbulent Hiss
  const rawVri = (spectralDrift * 0.45 + resonanceShift * 0.35 + turbulentHiss * 0.2) * 100
  const vri = Math.round(Math.max(5, Math.min(98, rawVri)))

  const state = vri >= 70 ? "RED" : vri >= 40 ? "YELLOW" : "GREEN"

  return {
    vri,
    state,
    components: {
      spectralDrift: Math.round(spectralDrift * 100) / 100,
      resonanceShift: Math.round(resonanceShift * 100) / 100,
      turbulentHiss: Math.round(turbulentHiss * 100) / 100,
    },
  }
}
