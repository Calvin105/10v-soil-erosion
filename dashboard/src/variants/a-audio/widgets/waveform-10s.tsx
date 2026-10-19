import { useEffect, useRef } from "react"
import { audioStore, getActiveClip, useAudioStore } from "../store"

export function Waveform10s({ className }: { className?: string }) {
  const s = useAudioStore()
  const activeClip = getActiveClip(s)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext("2d")!
    const { width: w, height: h } = c
    ctx.clearRect(0, 0, w, h)

    const wf = activeClip.waveform
    if (!wf || wf.length === 0) return

    const midY = h / 2
    const n = wf.length

    // Draw center baseline
    ctx.strokeStyle = "rgba(156, 163, 175, 0.2)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, midY)
    ctx.lineTo(w, midY)
    ctx.stroke()

    // Determine playback cursor position
    const dur = activeClip.durationSec || 10
    const progress = Math.max(0, Math.min(1, s.playback.currentTime / dur))
    const playX = progress * w

    // Draw waveform bars
    for (let x = 0; x < w; x++) {
      const idx = Math.floor((x / w) * n)
      const amp = Math.min(1, wf[idx] * 2.5) // Scale for visual clarity
      const barH = Math.max(1, amp * midY * 0.9)

      // Color played region differently from unplayed
      if (x <= playX) {
        ctx.fillStyle = "#0284c7" // Played sky blue
      } else {
        ctx.fillStyle = "rgba(156, 163, 175, 0.5)" // Unplayed gray
      }

      ctx.fillRect(x, midY - barH, 1, barH * 2)
    }

    // Draw playhead cursor line
    ctx.strokeStyle = "#38bdf8"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playX, 0)
    ctx.lineTo(playX, h)
    ctx.stroke()
  }, [activeClip.id, activeClip.waveform, s.playback.currentTime])

  // Resize handler
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      c.width = Math.max(1, Math.round(c.clientWidth * dpr))
      c.height = Math.max(1, Math.round(c.clientHeight * dpr))
    })
    ro.observe(c)
    return () => ro.disconnect()
  }, [])

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
      className={`relative h-full w-full cursor-pointer overflow-hidden rounded-md bg-card/40 ${className || ""}`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <span className="pointer-events-none absolute bottom-1 left-2 font-mono text-[9px] text-muted-foreground">
        0.0s
      </span>
      <span className="pointer-events-none absolute right-2 bottom-1 font-mono text-[9px] text-muted-foreground">
        10.0s
      </span>
    </div>
  )
}
