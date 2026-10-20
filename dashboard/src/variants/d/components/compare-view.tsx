import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PlayIcon, SquareIcon, UploadCloudIcon, AlertCircleIcon, ArrowRightLeftIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { computeStft, getAudioContext } from "../../a-audio/audio-engine"
import { MIC_BINS, MIC_MAX_HZ, type Condition } from "../../a-audio/types"

// Inferno colormap LUT (256 RGB values)
const INFERNO_STOPS: [number, number, number][] = [
  [0, 5, 40],
  [27, 12, 65],
  [74, 12, 107],
  [120, 28, 109],
  [165, 44, 96],
  [207, 68, 70],
  [237, 105, 37],
  [251, 155, 6],
  [252, 255, 164],
]

function buildInfernoLut(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * (INFERNO_STOPS.length - 1)
    const a = Math.floor(x)
    const b = Math.min(INFERNO_STOPS.length - 1, a + 1)
    const f = x - a
    for (let c = 0; c < 3; c++) {
      lut[i * 3 + c] = Math.round(
        INFERNO_STOPS[a][c] + (INFERNO_STOPS[b][c] - INFERNO_STOPS[a][c]) * f
      )
    }
  }
  return lut
}

const INFERNO_LUT = buildInfernoLut()
const MIN_DB = -90
const MAX_DB = -30

// Available presets from /audio-runs/
const PRESETS = [
  { label: "Void 01 (Critical)", path: "/audio-runs/void/CRITICAL_VOID_01.wav", condition: "void" as Condition },
  { label: "Void 02 (Critical)", path: "/audio-runs/void/CRITICAL_VOID_02.wav", condition: "void" as Condition },
  { label: "Void 03 (Critical)", path: "/audio-runs/void/CRITICAL_VOID_03.wav", condition: "void" as Condition },
  { label: "Void 05 (Critical)", path: "/audio-runs/void/CRITICAL_VOID_05.wav", condition: "void" as Condition },
  { label: "Safe Soil 01 (Baseline)", path: "/audio-runs/safe/SAFE_SOIL_01.wav", condition: "safe" as Condition },
  { label: "Safe Soil 02 (Baseline)", path: "/audio-runs/safe/SAFE_SOIL_02.wav", condition: "safe" as Condition },
  { label: "Safe Soil 03 (Baseline)", path: "/audio-runs/safe/SAFE_SOIL_03.wav", condition: "safe" as Condition },
  { label: "Ambient 01 (Listening)", path: "/audio-runs/ambient/AMBIENT_01.wav", condition: "ambient" as Condition },
  { label: "Ambient 02 (Listening)", path: "/audio-runs/ambient/AMBIENT_02.wav", condition: "ambient" as Condition },
]

// computeStft maps its bins to 0-8 kHz, which only holds for 16 kHz audio. Decoding through
// the live AudioContext would resample to the device rate (44.1/48 kHz) and skew every band.
const ANALYSIS_RATE = 16000

function decode16k(data: ArrayBuffer): Promise<AudioBuffer> {
  return new OfflineAudioContext(1, 1, ANALYSIS_RATE).decodeAudioData(data)
}

/**
 * Measured verdict, from two features that separate all 44 lab recordings in /audio-runs:
 * - Ambient (no flow): spectral centroid below 85 Hz (ambient 51-72 Hz, everything else >= 95 Hz).
 * - Void vs safe: hiss band (2-5 kHz) minus resonance band (0.8-2 kHz). Void -2.7..+2.5 dB,
 *   safe -3.0..-6.7 dB, so the boundary sits at -2.85 dB. Fitted on this dataset, not the TinyML model.
 */
const AMBIENT_CENTROID_HZ = 85
const HISS_RES_BOUNDARY_DB = -2.85
const SCORE_PER_DB = 15

type Verdict = "void" | "safe" | "ambient"

interface Measurement {
  verdict: Verdict
  voidScore: number | null // 0-100, 50 = boundary; null for ambient
  hissMinusResDb: number
  centroidHz: number
}

function measure(stft: ReturnType<typeof computeStft>): Measurement {
  const hissMinusResDb = stft.bandDb[3] - stft.bandDb[2]
  if (stft.centroidHz < AMBIENT_CENTROID_HZ) {
    return { verdict: "ambient", voidScore: null, hissMinusResDb, centroidHz: stft.centroidHz }
  }
  const voidScore = Math.round(
    Math.max(0, Math.min(100, 50 + (hissMinusResDb - HISS_RES_BOUNDARY_DB) * SCORE_PER_DB))
  )
  return { verdict: voidScore >= 50 ? "void" : "safe", voidScore, hissMinusResDb, centroidHz: stft.centroidHz }
}

const VERDICT_STYLE: Record<Verdict, { color: string; label: string; sentence: string }> = {
  void: { color: "#ef4444", label: "VOID SIGNATURE", sentence: "Sounds like a void: strong hiss relative to pipe resonance" },
  safe: { color: "#10b981", label: "HEALTHY SOIL", sentence: "Sounds healthy: hiss stays well below pipe resonance" },
  ambient: { color: "#94a3b8", label: "NO FLOW", sentence: "Ambient only: no water flow to judge" },
}

const LABEL_NAME: Record<Condition, string> = { void: "Void", safe: "Safe soil", ambient: "Ambient" }

interface LoadedAudio {
  name: string
  label: Condition | null // ground-truth label from the dataset filename, null for unknown uploads
  buffer: AudioBuffer
  stft: ReturnType<typeof computeStft>
  avgSpectrum: Float32Array // 256 bins average dB
  m: Measurement
}

function labelFromName(name: string): Condition | null {
  const lower = name.toLowerCase()
  if (lower.startsWith("critical_void")) return "void"
  if (lower.startsWith("safe_soil")) return "safe"
  if (lower.startsWith("ambient")) return "ambient"
  return null
}

function processAudioBuffer(name: string, buffer: AudioBuffer): LoadedAudio {
  const stft = computeStft(buffer, 512)

  // Compute time-averaged spectrum (256 bins)
  const avg = new Float32Array(MIC_BINS)
  const numFrames = Math.max(1, stft.slices.length)
  for (let f = 0; f < numFrames; f++) {
    const slice = stft.slices[f]
    for (let b = 0; b < MIC_BINS; b++) {
      avg[b] += slice[b]
    }
  }
  for (let b = 0; b < MIC_BINS; b++) {
    avg[b] /= numFrames
  }

  return {
    name,
    label: labelFromName(name),
    buffer,
    stft,
    avgSpectrum: avg,
    m: measure(stft),
  }
}

export function CompareView() {
  const [audioA, setAudioA] = useState<LoadedAudio | null>(null)
  const [audioB, setAudioB] = useState<LoadedAudio | null>(null)
  const [loadingA, setLoadingA] = useState(true)
  const [loadingB, setLoadingB] = useState(true)
  const [errorA, setErrorA] = useState<string | null>(null)
  const [errorB, setErrorB] = useState<string | null>(null)

  // Web Audio playback state
  const [dragOver, setDragOver] = useState<"A" | "B" | null>(null)
  const [playingCol, setPlayingCol] = useState<"A" | "B" | null>(null)
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null)

  // Canvas refs
  const specCanvasRefA = useRef<HTMLCanvasElement>(null)
  const specCanvasRefB = useRef<HTMLCanvasElement>(null)
  const fftCanvasRefA = useRef<HTMLCanvasElement>(null)
  const fftCanvasRefB = useRef<HTMLCanvasElement>(null)

  // Stop playback on unmount
  useEffect(() => {
    return () => {
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  // Load a file from URL
  const loadFromUrl = useCallback(async (url: string, col: "A" | "B") => {
    const setLoad = col === "A" ? setLoadingA : setLoadingB
    const setErr = col === "A" ? setErrorA : setErrorB
    const setAud = col === "A" ? setAudioA : setAudioB

    setLoad(true)
    setErr(null)

    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch ${url}`)
      const audioBuffer = await decode16k(await res.arrayBuffer())
      const parsed = processAudioBuffer(url.split("/").pop() || url, audioBuffer)
      setAud(parsed)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoad(false)
    }
  }, [])

  // Preload defaults on mount asynchronously without synchronous setState
  useEffect(() => {
    let active = true

    async function loadDefaults() {
      try {
        const [resA, resB] = await Promise.all([
          fetch("/audio-runs/void/CRITICAL_VOID_01.wav"),
          fetch("/audio-runs/ambient/AMBIENT_01.wav"),
        ])
        const [bufA, bufB] = await Promise.all([resA.arrayBuffer(), resB.arrayBuffer()])
        const [decA, decB] = await Promise.all([decode16k(bufA), decode16k(bufB)])

        if (active) {
          setAudioA(processAudioBuffer("CRITICAL_VOID_01.wav", decA))
          setAudioB(processAudioBuffer("AMBIENT_01.wav", decB))
          setLoadingA(false)
          setLoadingB(false)
        }
      } catch (e) {
        if (active) {
          setErrorA((e as Error).message)
          setLoadingA(false)
          setLoadingB(false)
        }
      }
    }

    void loadDefaults()

    return () => {
      active = false
    }
  }, [])

  // Handle local file drop/picker
  const handleFileUpload = async (file: File, col: "A" | "B") => {
    const setLoad = col === "A" ? setLoadingA : setLoadingB
    const setErr = col === "A" ? setErrorA : setErrorB
    const setAud = col === "A" ? setAudioA : setAudioB

    setLoad(true)
    setErr(null)

    try {
      const audioBuffer = await decode16k(await file.arrayBuffer())
      const parsed = processAudioBuffer(file.name, audioBuffer)
      setAud(parsed)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoad(false)
    }
  }

  // Play / Pause toggle
  const togglePlay = (col: "A" | "B") => {
    const target = col === "A" ? audioA : audioB
    if (!target) return

    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop()
      } catch {
        // ignore
      }
      currentSourceRef.current = null
    }

    if (playingCol === col) {
      setPlayingCol(null)
      return
    }

    const ctx = getAudioContext()
    if (ctx.state === "suspended") void ctx.resume()

    const src = ctx.createBufferSource()
    src.buffer = target.buffer
    src.connect(ctx.destination)
    src.onended = () => {
      setPlayingCol(null)
      currentSourceRef.current = null
    }
    src.start()
    currentSourceRef.current = src
    setPlayingCol(col)
  }

  // Draw full static spectrogram on canvas
  const drawSpectrogram = useCallback((audio: LoadedAudio | null, canvas: HTMLCanvasElement | null) => {
    if (!audio || !canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const slices = audio.stft.slices
    const numFrames = slices.length
    if (numFrames === 0) return

    // Offscreen render at native STFT resolution (frames x 256)
    const offscreen = document.createElement("canvas")
    offscreen.width = numFrames
    offscreen.height = MIC_BINS
    const octx = offscreen.getContext("2d")!
    const imgData = octx.createImageData(numFrames, MIC_BINS)
    const data = imgData.data

    for (let f = 0; f < numFrames; f++) {
      const slice = slices[f]
      for (let b = 0; b < MIC_BINS; b++) {
        const db = slice[b]
        const norm = Math.max(0, Math.min(1, (db - MIN_DB) / (MAX_DB - MIN_DB)))
        const li = Math.round(norm * 255) * 3
        const y = MIC_BINS - 1 - b // Frequency: 0Hz at bottom, 8kHz at top
        const pixelIdx = (y * numFrames + f) * 4

        data[pixelIdx] = INFERNO_LUT[li]
        data[pixelIdx + 1] = INFERNO_LUT[li + 1]
        data[pixelIdx + 2] = INFERNO_LUT[li + 2]
        data[pixelIdx + 3] = 255
      }
    }

    octx.putImageData(imgData, 0, 0)

    // Render scaled onto visible canvas
    ctx.imageSmoothingEnabled = true
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height)
  }, [])

  // Draw time-averaged spectrum with band shading and other column's dashed overlay
  const drawSpectrum = useCallback(
    (
      primary: LoadedAudio | null,
      secondary: LoadedAudio | null,
      canvas: HTMLCanvasElement | null,
      primaryColor: string
    ) => {
      if (!primary || !canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      // Frequency bands shading
      // Band 2: Pipe resonance (800 - 2000 Hz)
      const xResStart = (800 / MIC_MAX_HZ) * w
      const xResEnd = (2000 / MIC_MAX_HZ) * w
      ctx.fillStyle = "rgba(245, 158, 11, 0.12)"
      ctx.fillRect(xResStart, 0, xResEnd - xResStart, h)

      // Band 3: Turbulent hiss (2000 - 5000 Hz)
      const xHissStart = (2000 / MIC_MAX_HZ) * w
      const xHissEnd = (5000 / MIC_MAX_HZ) * w
      ctx.fillStyle = "rgba(239, 68, 68, 0.12)"
      ctx.fillRect(xHissStart, 0, xHissEnd - xHissStart, h)

      // Helper to map dB (-100 to -10) to Y
      const dbToY = (db: number) => {
        const norm = (db - (-100)) / (-10 - (-100))
        return h - Math.max(0, Math.min(1, norm)) * (h - 16) - 8
      }

      // Draw secondary spectrum (faint dashed overlay)
      if (secondary) {
        ctx.save()
        ctx.beginPath()
        ctx.setLineDash([4, 4])
        ctx.strokeStyle = "rgba(148, 163, 184, 0.55)"
        ctx.lineWidth = 1.5

        for (let b = 0; b < MIC_BINS; b++) {
          const x = (b / (MIC_BINS - 1)) * w
          const y = dbToY(secondary.avgSpectrum[b])
          if (b === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()
      }

      // Draw primary spectrum (solid bold line)
      ctx.beginPath()
      ctx.strokeStyle = primaryColor
      ctx.lineWidth = 2.2
      ctx.lineJoin = "round"

      for (let b = 0; b < MIC_BINS; b++) {
        const x = (b / (MIC_BINS - 1)) * w
        const y = dbToY(primary.avgSpectrum[b])
        if (b === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Peak highlight dot
      const peakBin = Math.round((primary.stft.peakHz / MIC_MAX_HZ) * (MIC_BINS - 1))
      if (peakBin >= 0 && peakBin < MIC_BINS) {
        const peakX = (peakBin / (MIC_BINS - 1)) * w
        const peakY = dbToY(primary.avgSpectrum[peakBin])
        ctx.fillStyle = primaryColor
        ctx.beginPath()
        ctx.arc(peakX, peakY, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    []
  )

  // Re-draw canvases when audio state changes
  useEffect(() => {
    drawSpectrogram(audioA, specCanvasRefA.current)
    if (audioA) drawSpectrum(audioA, audioB, fftCanvasRefA.current, VERDICT_STYLE[audioA.m.verdict].color)
  }, [audioA, audioB, drawSpectrogram, drawSpectrum])

  useEffect(() => {
    drawSpectrogram(audioB, specCanvasRefB.current)
    if (audioB) drawSpectrum(audioB, audioA, fftCanvasRefB.current, VERDICT_STYLE[audioB.m.verdict].color)
  }, [audioA, audioB, drawSpectrogram, drawSpectrum])

  // Plain-language callouts for "What's different", stated only from what was measured
  const differences = useMemo(() => {
    if (!audioA || !audioB) return []
    const a = audioA.m
    const b = audioB.m
    const diffs: string[] = []

    const fmt = (db: number) => `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`
    diffs.push(
      `Hiss vs resonance: A is ${fmt(a.hissMinusResDb)}, B is ${fmt(b.hissMinusResDb)}. Void recordings sit above ${HISS_RES_BOUNDARY_DB} dB: the 2–5 kHz hiss nearly matches the 0.8–2 kHz pipe resonance.`
    )

    diffs.push(
      `Energy centre: A ${a.centroidHz.toLocaleString()} Hz vs B ${b.centroidHz.toLocaleString()} Hz. Below ${AMBIENT_CENTROID_HZ} Hz means no water flow (ambient only).`
    )

    const rmsDelta = audioA.stft.rmsDb - audioB.stft.rmsDb
    diffs.push(
      Math.abs(rmsDelta) >= 3
        ? `${rmsDelta > 0 ? "A" : "B"} is ${Math.abs(rmsDelta).toFixed(1)} dB louder overall. Loudness alone does not indicate a void; the hiss/resonance balance does.`
        : "Both clips have similar overall loudness, so the difference is in the spectral shape, not volume."
    )

    return diffs
  }, [audioA, audioB])

  const handleDrop = (e: React.DragEvent, col: "A" | "B") => {
    e.preventDefault()
    setDragOver(null)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFileUpload(file, col)
  }

  // Render single column
  const renderColumn = (col: "A" | "B") => {
    const audio = col === "A" ? audioA : audioB
    const loading = col === "A" ? loadingA : loadingB
    const error = col === "A" ? errorA : errorB
    const specRef = col === "A" ? specCanvasRefA : specCanvasRefB
    const fftRef = col === "A" ? fftCanvasRefA : fftCanvasRefB
    const isPlaying = playingCol === col

    const style = audio ? VERDICT_STYLE[audio.m.verdict] : null
    const stateColor = style?.color ?? "#94a3b8"
    const labelMismatch = audio?.label != null && audio.label !== audio.m.verdict

    return (
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(col)
        }}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => handleDrop(e, col)}
        className={`relative flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition-colors ${
          dragOver === col ? "border-primary ring-2 ring-primary/40" : "border-border/70"
        }`}
      >
        {dragOver === col && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
            Drop .wav to load into {col}
          </div>
        )}
        {/* Preset Selector & File Picker Drop Zone */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-sm font-bold px-2.5 py-0.5">
              {col}
            </Badge>
            <span className="text-xs font-semibold text-muted-foreground truncate max-w-[200px]">
              {audio?.name || "No file selected"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Select
              onValueChange={(val) => {
                void loadFromUrl(val, col)
              }}
            >
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Select preset..." />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.path} value={p.path} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="cursor-pointer">
              <input
                type="file"
                accept=".wav,audio/wav"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFileUpload(file, col)
                  e.target.value = ""
                }}
              />
              <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                <span>
                  <UploadCloudIcon className="h-3.5 w-3.5 mr-1" />
                  WAV
                </span>
              </Button>
            </label>
          </div>
        </div>

        {/* Verdict Header (Big & Clear for Judges) */}
        <div className="space-y-1.5 py-1">
          <div className="flex items-center justify-between">
            <Badge
              className="text-xs font-extrabold uppercase tracking-wider px-3 py-1"
              style={{ backgroundColor: stateColor, color: "#ffffff" }}
            >
              {style?.label ?? "NO FILE"}
            </Badge>

            {audio && (
              <Button
                variant={isPlaying ? "destructive" : "secondary"}
                size="sm"
                className="h-8 px-3 text-xs font-medium"
                onClick={() => togglePlay(col)}
              >
                {isPlaying ? (
                  <>
                    <SquareIcon className="h-3.5 w-3.5 mr-1.5 fill-current" />
                    Stop
                  </>
                ) : (
                  <>
                    <PlayIcon className="h-3.5 w-3.5 mr-1.5 fill-current" />
                    Hear Clip
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-5xl font-black tracking-tight" style={{ color: stateColor }}>
              {audio?.m.voidScore ?? "—"}
            </span>
            <span
              className="text-xs font-mono text-muted-foreground"
              title={`Measured from this clip: hiss (2–5 kHz) minus pipe resonance (0.8–2 kHz). 50 = boundary at ${HISS_RES_BOUNDARY_DB} dB, which separates all 44 lab recordings. Fitted on this dataset; not the on-device TinyML model.`}
            >
              VOID SCORE / 100 ⓘ
            </span>
          </div>

          <p className="text-base font-semibold text-foreground tracking-tight leading-snug">
            {style?.sentence ?? "Pick a preset or drop a .wav file"}
          </p>
          {audio && (
            <p className="text-[11px] text-muted-foreground">
              {audio.label ? `Dataset label: ${LABEL_NAME[audio.label]}` : "Unlabelled upload"}
              {labelMismatch && (
                <span className="ml-1.5 font-semibold text-amber-600 dark:text-amber-400">
                  · measurement disagrees with label
                </span>
              )}
            </p>
          )}
        </div>

        {/* Spectrogram (Whole File, 0-8 kHz, Inferno colormap) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold">Full Recording Spectrogram (0 to 8 kHz)</span>
            <span className="font-mono text-[11px]">{MIN_DB} to {MAX_DB} dBFS</span>
          </div>
          <div className="relative rounded-lg overflow-hidden border border-border/80 bg-black aspect-[2.4/1]">
            <canvas ref={specRef} width={480} height={200} className="w-full h-full object-cover" />
            {/* Axis frequency labels */}
            <div className="absolute left-1.5 top-1 text-[9px] font-mono text-white/70 select-none">8 kHz</div>
            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-white/70 select-none">4 kHz</div>
            <div className="absolute left-1.5 bottom-1 text-[9px] font-mono text-white/70 select-none">0 Hz</div>
            <div className="absolute right-2 bottom-1 text-[9px] font-mono text-white/70 select-none">{audio ? `${audio.buffer.duration.toFixed(1)}s` : ""}</div>
          </div>
        </div>

        {/* Spectrum (FFT dB vs Frequency) with shaded bands and other column dashed overlay */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold">Time-Averaged Spectrum (FFT)</span>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-amber-500/40 border border-amber-500/70" />
                Resonance (0.8–2k)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-red-500/40 border border-red-500/70" />
                Hiss (2–5k)
              </span>
            </div>
          </div>
          <div className="relative rounded-lg overflow-hidden border border-border/80 bg-black aspect-[3/1]">
            <canvas ref={fftRef} width={480} height={160} className="w-full h-full object-cover" />
            {/* Legend & Freq ticks */}
            <div className="absolute right-2 top-1 text-[9px] font-mono text-slate-400 select-none">
              --- Other Column Overlay
            </div>
            <div className="absolute left-1.5 top-1 text-[9px] font-mono text-slate-400 select-none">-10 dB</div>
            <div className="absolute left-1.5 bottom-1 text-[9px] font-mono text-slate-400 select-none">-100 dB</div>
            <div className="absolute right-2 bottom-1 text-[9px] font-mono text-slate-400 select-none">8 kHz</div>
          </div>
        </div>

        {/* Audio Metrics */}
        {audio && (
          <div className="grid grid-cols-3 gap-2 pt-1 border-t text-xs">
            <div>
              <div className="text-[10px] text-muted-foreground">Peak Frequency</div>
              <div className="font-mono font-semibold">{audio.stft.peakHz.toLocaleString()} Hz</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">RMS Power</div>
              <div className="font-mono font-semibold">{audio.stft.rmsDb.toFixed(1)} dB</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Cavity Hiss (2-5k)</div>
              <div className="font-mono font-semibold">{audio.stft.bandDb[3].toFixed(1)} dB</div>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center text-xs text-muted-foreground py-2">
            Decoding audio buffer...
          </div>
        )}
        {error && (
          <div className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircleIcon className="h-3.5 w-3.5" />
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      {/* Side-by-side Columns A and B */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderColumn("A")}
        {renderColumn("B")}
      </div>

      {/* "What's Different" Plain Language Strip */}
      <Card className="border-border/80 bg-muted/30 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2.5">
          <ArrowRightLeftIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Acoustic Comparison Insights (What's Different)
          </h3>
        </div>

        {differences.length === 0 ? (
          <p className="text-xs text-muted-foreground">Load recordings into both columns to see acoustic differentiation.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {differences.map((diff, i) => (
              <div key={i} className="rounded-lg border bg-background/80 p-3.5 space-y-1 text-xs">
                <div className="text-[10px] font-semibold text-primary uppercase">
                  Insight {i + 1}
                </div>
                <p className="font-medium text-foreground leading-relaxed">
                  {diff}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
