import { useCallback, useEffect, useRef } from "react"
import { AUDIO_BANDS, MIC_BINS, MIC_MAX_HZ } from "../types"
import { getActiveClip, getBaselineRun, useAudioStore } from "../store"
import { cn } from "@/lib/utils"

export function FreqAxis({ className }: { className?: string }) {
  return (
    <div className={cn("flex justify-between font-mono text-[9px] leading-none text-muted-foreground", className)}>
      {[0, 2, 4, 6, 8].map((k) => (
        <span key={k}>{k === 0 ? "0" : `${k}k`}</span>
      ))}
    </div>
  )
}

export function DbAxis({ top = -20, bottom = -100 }: { top?: number; bottom?: number }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-between py-0.5 font-mono text-[9px] leading-none text-muted-foreground">
      <span>{top}</span>
      <span>{Math.round((top + bottom) / 2)}</span>
      <span>{bottom} dB</span>
    </div>
  )
}

export interface SpectrumProps {
  className?: string
  minDb?: number
  maxDb?: number
  showBands?: boolean
  showBaseline?: boolean
}

/**
 * Live MIC Spectrum visualizer modeled directly on Proposal A:
 * - Alternating vertical band shading with frequency labels
 * - Vertical lines rising from bottom up to each frequency bin
 * - Solid live curve with smooth bottom-up area fill
 * - Dashed baseline curve
 */
export function SpectrumLive({
  className,
  minDb = -100,
  maxDb = -20,
  showBands = true,
  showBaseline = true,
}: SpectrumProps) {
  const s = useAudioStore()
  const activeClip = getActiveClip(s)
  const baselineRun = getBaselineRun(s)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const smoothedRef = useRef<Float32Array>(new Float32Array(MIC_BINS))
  const prevClipId = useRef(activeClip.id)

  useEffect(() => {
    if (prevClipId.current !== activeClip.id) {
      prevClipId.current = activeClip.id
      smoothedRef.current.fill(0)
    }
  }, [activeClip.id])

  const draw = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    const { width: w, height: h } = c
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, w, h)

    const frames = activeClip.stftFrames
    if (!frames || frames.length === 0) return

    // Pick slice corresponding to playback time, or mid slice when paused at 0
    const dur = activeClip.durationSec || 10
    const ratio = Math.max(0, Math.min(1, s.playback.currentTime / dur))
    const frameIdx =
      s.playback.isPlaying || s.playback.currentTime > 0
        ? Math.min(frames.length - 1, Math.floor(ratio * frames.length))
        : Math.floor(frames.length / 2)
    const currentSlice = frames[frameIdx]
    if (!currentSlice) return

    // Temporal smoothing like Proposal A (50% new, 50% previous)
    const smooth = smoothedRef.current
    for (let i = 0; i < MIC_BINS; i++) {
      smooth[i] = smooth[i] === 0 ? currentSlice[i] : smooth[i] * 0.5 + currentSlice[i] * 0.5
    }

    // Baseline spectrum average (across baseline run clips)
    let baseSlice: Float32Array | null = null
    if (baselineRun && baselineRun.clips.length > 0) {
      baseSlice = new Float32Array(MIC_BINS)
      let count = 0
      for (const bClip of baselineRun.clips) {
        if (bClip.stftFrames && bClip.stftFrames.length > 0) {
          const midFrame = bClip.stftFrames[Math.floor(bClip.stftFrames.length / 2)]
          for (let b = 0; b < MIC_BINS; b++) {
            baseSlice[b] += midFrame[b]
          }
          count++
        }
      }
      if (count > 0) {
        for (let b = 0; b < MIC_BINS; b++) {
          baseSlice[b] /= count
        }
      }
    }

    const color = getComputedStyle(c).color || "#ffffff"
    const yOf = (db: number) => h - ((db - minDb) / (maxDb - minDb)) * h
    const xOf = (i: number) => (i / (MIC_BINS - 1)) * w

    // 1. Shaded Band Columns with Labels (Proposal A style)
    if (showBands) {
      AUDIO_BANDS.forEach((b, k) => {
        ctx.fillStyle = color
        ctx.globalAlpha = k % 2 === 0 ? 0.04 : 0.08
        const x0 = (b.from / MIC_MAX_HZ) * w
        const x1 = (b.to / MIC_MAX_HZ) * w
        ctx.fillRect(x0, 0, x1 - x0, h)

        ctx.globalAlpha = 0.55
        ctx.font = `${10 * dpr}px ui-monospace, monospace`
        if (ctx.measureText(b.label).width + 8 * dpr < x1 - x0) {
          ctx.fillText(b.label, x0 + 4 * dpr, 12 * dpr)
        }
      })
      ctx.globalAlpha = 1
    }

    // 2. Dashed Baseline Spectrum Curve (Proposal A style)
    if (showBaseline && baseSlice) {
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.3
      ctx.setLineDash([4 * dpr, 4 * dpr])
      ctx.lineWidth = dpr
      ctx.beginPath()
      baseSlice.forEach((v, i) => (i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v))))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    // 3. Solid Live Spectrum Curve (Proposal A style)
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5 * dpr
    ctx.beginPath()
    smooth.forEach((v, i) => (i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v))))
    ctx.stroke()

    // 4. Smooth Bottom-Up Fill (Proposal A style)
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.globalAlpha = 0.12
    ctx.fillStyle = color
    ctx.fill()
    ctx.globalAlpha = 1
  }, [activeClip, baselineRun, s.playback.currentTime, s.playback.isPlaying, minDb, maxDb, showBands, showBaseline])

  // Handle Resize and immediate draw
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      c.width = Math.max(1, Math.round(c.clientWidth * dpr))
      c.height = Math.max(1, Math.round(c.clientHeight * dpr))
      draw()
    })
    ro.observe(c)
    return () => ro.disconnect()
  }, [draw])

  useEffect(() => {
    draw()
  }, [draw])

  return (
    <div className={cn("relative h-full w-full overflow-hidden text-foreground", className)}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
