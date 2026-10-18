import { useEffect, useRef } from "react"

import {
  BANDS,
  MIC_BINS,
  MIC_MAX_HZ,
  VIB_RATE_HZ,
  rig,
  type RigFrame,
} from "@/data/rig-sim"
import { cn } from "@/lib/utils"

type Colormap = "inferno" | "viridis" | "mono"

const STOPS: Record<Colormap, [number, number, number][]> = {
  inferno: [
    [0, 0, 4], [27, 12, 65], [74, 12, 107], [120, 28, 109], [165, 44, 96],
    [207, 68, 70], [237, 105, 37], [251, 155, 6], [252, 255, 164],
  ],
  viridis: [
    [68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37],
  ],
  mono: [
    [10, 10, 12], [60, 60, 66], [130, 130, 140], [200, 200, 210], [250, 250, 255],
  ],
}

function buildLut(map: Colormap) {
  const stops = STOPS[map]
  const lut = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * (stops.length - 1)
    const a = Math.floor(x)
    const b = Math.min(stops.length - 1, a + 1)
    const f = x - a
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = stops[a][c] + (stops[b][c] - stops[a][c]) * f
  }
  return lut
}

function useDpr(
  canvas: React.RefObject<HTMLCanvasElement | null>,
  onResize: () => void
) {
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      el.width = Math.max(1, Math.round(el.clientWidth * dpr))
      el.height = Math.max(1, Math.round(el.clientHeight * dpr))
      onResize()
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export interface WaterfallProps {
  className?: string
  colormap?: Colormap
  minDb?: number
  maxDb?: number
  /** number of frames visible (15 fps -> 300 = 20 s) */
  history?: number
  showAxis?: boolean
}

/** Scrolling spectrogram of the MIC channel: time left->right, frequency bottom->top. */
export function MicWaterfall({
  className,
  colormap = "inferno",
  minDb = -105,
  maxDb = -35,
  history = 225,
  showAxis = true,
}: WaterfallProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const off = useRef<HTMLCanvasElement | null>(null)
  const lut = useRef(buildLut(colormap))

  useEffect(() => {
    lut.current = buildLut(colormap)
  }, [colormap])

  useEffect(() => {
    const o = document.createElement("canvas")
    o.width = history
    o.height = MIC_BINS
    off.current = o
    const octx = o.getContext("2d")!
    octx.fillStyle = "black"
    octx.fillRect(0, 0, history, MIC_BINS)
    const col = octx.createImageData(1, MIC_BINS)

    const drawColumn = (f: RigFrame) => {
      octx.drawImage(o, -1, 0)
      for (let i = 0; i < MIC_BINS; i++) {
        const v = Math.max(0, Math.min(1, (f.mic[i] - minDb) / (maxDb - minDb)))
        const li = Math.round(v * 255) * 3
        const y = MIC_BINS - 1 - i
        col.data[y * 4] = lut.current[li]
        col.data[y * 4 + 1] = lut.current[li + 1]
        col.data[y * 4 + 2] = lut.current[li + 2]
        col.data[y * 4 + 3] = 255
      }
      octx.putImageData(col, history - 1, 0)
    }

    const blit = () => {
      const c = ref.current
      if (!c) return
      const ctx = c.getContext("2d")!
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(o, 0, 0, c.width, c.height)
    }

    rig.frames.slice(-history).forEach(drawColumn)
    blit()
    const unsub = rig.onFrame((f) => {
      drawColumn(f)
      blit()
    })
    return unsub
  }, [history, minDb, maxDb])

  useDpr(ref, () => {
    const c = ref.current
    if (c && off.current) c.getContext("2d")!.drawImage(off.current, 0, 0, c.width, c.height)
  })

  return (
    <div className={cn("relative h-48 w-full overflow-hidden rounded-md bg-black", className)}>
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
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

export interface ScopeProps {
  className?: string
  /** seconds of history */
  seconds?: number
  /** vertical gain */
  gain?: number
}

/** Rolling waveform of the VIB channel. Stroke uses the element's text color. */
export function VibScope({ className, seconds = 3, gain = 1 }: ScopeProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const buf = useRef<Float32Array>(new Float32Array(Math.round(seconds * VIB_RATE_HZ)))

  const draw = () => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext("2d")!
    const { width: w, height: h } = c
    ctx.clearRect(0, 0, w, h)
    const color = getComputedStyle(c).color
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.25
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.lineWidth = Math.max(1, (window.devicePixelRatio || 1) * 1.1)
    ctx.beginPath()
    const b = buf.current
    const n = b.length
    for (let x = 0; x < w; x++) {
      const i0 = Math.floor((x / w) * n)
      const i1 = Math.max(i0 + 1, Math.floor(((x + 1) / w) * n))
      let lo = 1
      let hi = -1
      for (let i = i0; i < i1 && i < n; i++) {
        lo = Math.min(lo, b[i])
        hi = Math.max(hi, b[i])
      }
      const y1 = h / 2 - hi * gain * (h / 2) * 0.95
      const y2 = h / 2 - lo * gain * (h / 2) * 0.95
      ctx.moveTo(x + 0.5, y1)
      ctx.lineTo(x + 0.5, Math.max(y2, y1 + 1))
    }
    ctx.stroke()
  }

  useEffect(() => {
    buf.current = new Float32Array(Math.round(seconds * VIB_RATE_HZ))
    const push = (f: RigFrame) => {
      const b = buf.current
      b.copyWithin(0, f.vib.length)
      b.set(f.vib, b.length - f.vib.length)
    }
    rig.frames.forEach(push)
    draw()
    return rig.onFrame((f) => {
      push(f)
      draw()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, gain])

  useDpr(ref, draw)

  return (
    <div className={cn("relative h-28 w-full text-primary", className)}>
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
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

/** Current MIC spectrum (line) with optional baseline ghost and band shading. */
export function MicSpectrum({
  className,
  minDb = -110,
  maxDb = -20,
  showBands = true,
  showBaseline = true,
}: SpectrumProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const last = useRef<Float32Array | null>(null)

  const draw = () => {
    const c = ref.current
    const spec = last.current
    if (!c || !spec) return
    const ctx = c.getContext("2d")!
    const { width: w, height: h } = c
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, w, h)
    const color = getComputedStyle(c).color
    const yOf = (db: number) => h - ((db - minDb) / (maxDb - minDb)) * h
    const xOf = (i: number) => (i / (MIC_BINS - 1)) * w

    if (showBands) {
      BANDS.forEach((b, k) => {
        ctx.fillStyle = color
        ctx.globalAlpha = k % 2 === 0 ? 0.04 : 0.08
        const x0 = (b.from / MIC_MAX_HZ) * w
        const x1 = (b.to / MIC_MAX_HZ) * w
        ctx.fillRect(x0, 0, x1 - x0, h)
        ctx.globalAlpha = 0.55
        ctx.font = `${10 * dpr}px ui-monospace, monospace`
        if (ctx.measureText(b.label).width + 8 * dpr < x1 - x0)
          ctx.fillText(b.label, x0 + 4 * dpr, 12 * dpr)
      })
      ctx.globalAlpha = 1
    }

    const base = rig.getBaselineSpectrum()
    if (showBaseline && base) {
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.3
      ctx.setLineDash([4 * dpr, 4 * dpr])
      ctx.lineWidth = dpr
      ctx.beginPath()
      base.forEach((v, i) => (i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v))))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    ctx.strokeStyle = color
    ctx.lineWidth = 1.5 * dpr
    ctx.beginPath()
    spec.forEach((v, i) => (i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v))))
    ctx.stroke()
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.globalAlpha = 0.12
    ctx.fillStyle = color
    ctx.fill()
    ctx.globalAlpha = 1
  }

  useEffect(() => {
    const smooth = new Float32Array(MIC_BINS)
    const take = (f: RigFrame) => {
      for (let i = 0; i < MIC_BINS; i++) smooth[i] = smooth[i] === 0 ? f.mic[i] : smooth[i] * 0.6 + f.mic[i] * 0.4
      last.current = smooth
    }
    rig.frames.slice(-5).forEach(take)
    draw()
    return rig.onFrame((f) => {
      take(f)
      draw()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDb, maxDb, showBands, showBaseline])

  useDpr(ref, draw)

  return (
    <div className={cn("relative h-40 w-full text-primary", className)}>
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
