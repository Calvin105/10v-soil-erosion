import { memo } from "react"

import type { NodeState } from "@/data/types"
import { cn } from "@/lib/utils"

import { STATE, zoneOf } from "../ui"

const CX = 100
const CY = 92
const R = 72

function pt(v: number, r = R) {
  const a = Math.PI * (1 - v / 100)
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)] as const
}

function arc(v0: number, v1: number, r = R) {
  const [x0, y0] = pt(v0, r)
  const [x1, y1] = pt(v1, r)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

const ZONES: { from: number; to: number; state: NodeState }[] = [
  { from: 0, to: 40, state: "GREEN" },
  { from: 40, to: 70, state: "YELLOW" },
  { from: 70, to: 100, state: "RED" },
]

/** Semicircular VRI gauge: thin zone track, thick value arc, needle. */
export function VriGauge({ vri, className }: { vri: number; className?: string }) {
  const v = Math.max(0, Math.min(100, vri))
  const z = zoneOf(v)
  return (
    <svg viewBox="0 0 200 100" className={cn("w-full", className)} role="img" aria-label={`VRI ${vri}`}>
      {ZONES.map((zn) => (
        <path
          key={zn.state}
          d={arc(zn.from + 0.6, zn.to - 0.6, R + 9)}
          className={STATE[zn.state].stroke}
          strokeWidth={3}
          fill="none"
          opacity={0.55}
        />
      ))}
      <path d={arc(0, 100)} className="stroke-muted" strokeWidth={12} fill="none" />
      {v > 0.5 && (
        <path
          d={arc(0, v)}
          className={cn(STATE[z].stroke, "transition-all duration-200")}
          strokeWidth={12}
          fill="none"
        />
      )}
      {[0, 40, 70, 100].map((t) => {
        const [x0, y0] = pt(t, R - 8)
        const [x1, y1] = pt(t, R + 13)
        const [lx, ly] = pt(t, R + 19)
        return (
          <g key={t}>
            <line x1={x0} y1={y0} x2={x1} y2={y1} className="stroke-background" strokeWidth={2} />
            <text
              x={lx}
              y={ly + 3}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={8}
            >
              {t}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** VRI trend with 40/70 thresholds and a status strip of the hysteresis state underneath. */
export const VriTrend = memo(function VriTrend({
  history,
  className,
}: {
  history: { t: number; vri: number; state: NodeState }[]
  className?: string
}) {
  const W = 300
  const H = 100
  const n = 150
  const pts = history.slice(-n)
  const x = (i: number) => ((n - pts.length + i) / (n - 1)) * W
  const y = (v: number) => H - (v / 100) * H
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.vri).toFixed(1)}`).join(" ")
  const area = pts.length ? `${line} L${x(pts.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z` : ""

  return (
    <div className={cn("flex min-h-0 flex-col gap-0.5", className)}>
      <div className="relative min-h-0 flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <rect x={0} y={0} width={W} height={y(70)} className="fill-red-500/6" />
          <rect x={0} y={y(70)} width={W} height={y(40) - y(70)} className="fill-amber-500/6" />
          {[40, 70].map((t) => (
            <line
              key={t}
              x1={0}
              x2={W}
              y1={y(t)}
              y2={y(t)}
              className={t === 70 ? "stroke-red-500/60" : "stroke-amber-500/60"}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} className="fill-foreground/8" />
          <path d={line} className="stroke-foreground" strokeWidth={1.5} fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
        {[70, 40].map((t) => (
          <span
            key={t}
            className="pointer-events-none absolute right-0.5 -translate-y-full font-mono text-[9px] leading-none text-muted-foreground"
            style={{ top: `${100 - t}%` }}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-[2px] bg-muted">
        <div style={{ flex: n - pts.length }} />
        {pts.map((p, i) => (
          <div key={i} className={cn("h-full flex-1", STATE[p.state].dot)} />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
        <span>-30 s</span>
        <span>state</span>
        <span>now</span>
      </div>
    </div>
  )
})
