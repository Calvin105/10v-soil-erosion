import { useCallback, useEffect, useRef } from "react"
import { MIC_BINS } from "../types"
import { audioStore, getActiveClip, useAudioStore, type Colormap } from "../store"
import { cn } from "@/lib/utils"

const STOPS: Record<Colormap, [number, number, number][]> = {
  // Inferno: rich navy blue at lowest energy -> purple -> crimson red -> fiery orange -> bright yellow
  inferno: [
    [0, 5, 40],       // low: deep navy blue
    [27, 12, 65],     // low-mid: deep indigo / purple
    [74, 12, 107],    // purple
    [120, 28, 109],   // magenta
    [165, 44, 96],    // deep red
    [207, 68, 70],    // vibrant crimson red
    [237, 105, 37],   // fiery red-orange
    [251, 155, 6],    // gold orange
    [252, 255, 164],  // peak: bright yellow/white
  ],
  // Jet / Rainbow: blue = low -> cyan -> green -> yellow -> red = high
  jet: [
    [0, 0, 160],      // blue: low
    [0, 100, 255],    // sky blue
    [0, 210, 200],    // cyan
    [0, 210, 60],     // green
    [240, 230, 0],    // yellow
    [255, 100, 0],    // orange
    [220, 0, 0],      // red: high
  ],
  viridis: [
    [68, 1, 84],
    [59, 82, 139],
    [33, 145, 140],
    [94, 201, 98],
    [253, 231, 37],
  ],
  mono: [
    [10, 10, 12],
    [60, 60, 66],
    [130, 130, 140],
    [200, 200, 210],
    [250, 250, 255],
  ],
}

function buildLut(map: Colormap): Uint8ClampedArray {
  const stops = STOPS[map] || STOPS.inferno
  const lut = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * (stops.length - 1)
    const a = Math.floor(x)
    const b = Math.min(stops.length - 1, a + 1)
    const f = x - a
    for (let c = 0; c < 3; c++) {
      lut[i * 3 + c] = Math.round(stops[a][c] + (stops[b][c] - stops[a][c]) * f)
    }
  }
  return lut
}

export interface SpectrogramWaterfallProps {
  className?: string
  minDb?: number
  maxDb?: number
  history?: number
  showAxis?: boolean
}

/**
 * Scrolling Spectrogram Waterfall (Proposal A style):
 * - Frequency: 0 Hz at bottom, 8 kHz at top
 * - Time scrolls from right to left as audio plays
 * - Colormap: Inferno (blue = low, purple, red = high, bright yellow = peak)
 * - Frequency labels on left edge: 8 kHz, 6 kHz, 4 kHz, 2 kHz, 0 Hz
 */
export function Spectrogram10s({
  className,
  minDb = -90,
  maxDb = -30,
  history = 240,
  showAxis = true,
}: SpectrogramWaterfallProps) {
  const s = useAudioStore()
  const activeClip = getActiveClip(s)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const lutRef = useRef(buildLut(s.colormap))
  const lastRenderedIdx = useRef<number>(-1)
  const prevClipId = useRef<string>(activeClip.id)

  // Update LUT when colormap changes
  useEffect(() => {
    lutRef.current = buildLut(s.colormap)
  }, [s.colormap])

  // Helper to colorize a single STFT slice into ImageData column
  const paintSliceColumn = useCallback(
    (slice: Float32Array, colData: ImageData) => {
      const lut = lutRef.current
      for (let bin = 0; bin < MIC_BINS; bin++) {
        const db = slice[bin]
        const norm = Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb)))
        const li = Math.round(norm * 255) * 3
        const y = MIC_BINS - 1 - bin
        colData.data[y * 4] = lut[li]
        colData.data[y * 4 + 1] = lut[li + 1]
        colData.data[y * 4 + 2] = lut[li + 2]
        colData.data[y * 4 + 3] = 255
      }
    },
    [minDb, maxDb]
  )

  // Blit offscreen canvas onto visible canvas
  const blit = useCallback(() => {
    const c = canvasRef.current
    const o = offscreenRef.current
    if (!c || !o) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(o, 0, 0, c.width, c.height)
  }, [])

  // Initialize/Reset offscreen buffer and pre-populate window
  const populateBuffer = useCallback(
    (targetFrameIdx: number) => {
      const frames = activeClip.stftFrames
      if (!frames || frames.length === 0) return

      let o = offscreenRef.current
      if (!o) {
        o = document.createElement("canvas")
        o.width = history
        o.height = MIC_BINS
        offscreenRef.current = o
      }
      const octx = o.getContext("2d")!
      octx.fillStyle = "#000520" // Deep navy/black base
      octx.fillRect(0, 0, history, MIC_BINS)

      const colData = octx.createImageData(1, MIC_BINS)
      const totalFrames = frames.length

      // If at start (targetFrameIdx <= 0), populate initial window across the buffer
      if (targetFrameIdx <= 0) {
        const span = Math.min(history, totalFrames)
        for (let col = 0; col < span; col++) {
          const fIdx = Math.floor((col / span) * totalFrames)
          paintSliceColumn(frames[fIdx], colData)
          octx.putImageData(colData, col, 0)
        }
      } else {
        // Populate trailing history leading up to targetFrameIdx on the right edge
        for (let x = 0; x < history; x++) {
          const offsetFromEnd = history - 1 - x
          const fIdx = targetFrameIdx - offsetFromEnd
          if (fIdx >= 0 && fIdx < totalFrames) {
            paintSliceColumn(frames[fIdx], colData)
            octx.putImageData(colData, x, 0)
          }
        }
      }

      lastRenderedIdx.current = targetFrameIdx
      blit()
    },
    [activeClip.stftFrames, history, paintSliceColumn, blit]
  )

  // Initialize buffer on mount or clip change
  useEffect(() => {
    const frames = activeClip.stftFrames
    if (!frames || frames.length === 0) return

    if (prevClipId.current !== activeClip.id) {
      prevClipId.current = activeClip.id
      lastRenderedIdx.current = -1
    }

    const dur = activeClip.durationSec || 10
    const ratio = Math.max(0, Math.min(1, s.playback.currentTime / dur))
    const currentFrame = Math.floor(ratio * frames.length)

    populateBuffer(currentFrame)
  }, [activeClip.id, populateBuffer, s.playback.currentTime, activeClip.durationSec, s.colormap])

  // Handle continuous scrolling while playing
  useEffect(() => {
    const frames = activeClip.stftFrames
    const o = offscreenRef.current
    if (!frames || frames.length === 0 || !o) return

    const octx = o.getContext("2d")!
    const dur = activeClip.durationSec || 10
    const ratio = Math.max(0, Math.min(1, s.playback.currentTime / dur))
    const currentFrame = Math.min(frames.length - 1, Math.floor(ratio * frames.length))

    // If scrubbed backwards or loop wrapped
    if (currentFrame < lastRenderedIdx.current) {
      populateBuffer(currentFrame)
      return
    }

    // Advance and push new columns
    if (currentFrame > lastRenderedIdx.current) {
      const colData = octx.createImageData(1, MIC_BINS)
      const start = Math.max(0, lastRenderedIdx.current + 1)
      const end = currentFrame

      for (let f = start; f <= end; f++) {
        // Shift previous waterfall left by 1px
        octx.drawImage(o, -1, 0)
        // Paint newest spectral slice on rightmost column
        paintSliceColumn(frames[f], colData)
        octx.putImageData(colData, history - 1, 0)
      }

      lastRenderedIdx.current = currentFrame
      blit()
    }
  }, [s.playback.currentTime, activeClip.durationSec, activeClip.stftFrames, history, paintSliceColumn, populateBuffer, blit])

  // DPR and Canvas Resize Observer
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      c.width = Math.max(1, Math.round(c.clientWidth * dpr))
      c.height = Math.max(1, Math.round(c.clientHeight * dpr))
      blit()
    })
    ro.observe(c)
    return () => ro.disconnect()
  }, [blit])

  // Click to seek in active clip
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const ratio = x / rect.width
    const targetSec = ratio * (activeClip.durationSec || 10)
    audioStore.seek(targetSec)
  }

  return (
    <div
      onClick={handleSeek}
      className={cn("relative h-full w-full cursor-pointer overflow-hidden rounded-md bg-black select-none", className)}
      title="Click to seek · Scrolling spectrogram through time"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Frequency Axis Overlays on Left Edge (Proposal A style) */}
      {showAxis && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-between py-1 pl-1.5 font-mono text-[10px] text-white/70">
          {[8, 6, 4, 2, 0].map((k) => (
            <span key={k}>{k === 0 ? "0 Hz" : `${k} kHz`}</span>
          ))}
        </div>
      )}
    </div>
  )
}
