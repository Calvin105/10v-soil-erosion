import type { LucideIcon } from "lucide-react"
import { CircleCheckIcon, OctagonAlertIcon, TriangleAlertIcon } from "lucide-react"

import type { NodeState } from "@/data/types"
import { cn } from "@/lib/utils"

export const STATE_META: Record<
  NodeState,
  {
    label: string
    text: string
    dot: string
    soft: string
    stripe: string
    ring: string
    bar: string
    stroke: string
    hex: string
    icon: LucideIcon
  }
> = {
  GREEN: {
    label: "Healthy",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
    soft: "bg-emerald-500/10 dark:bg-emerald-500/15",
    stripe: "before:bg-emerald-500",
    ring: "ring-emerald-500/50",
    bar: "*:data-[slot=progress-indicator]:bg-emerald-500",
    stroke: "stroke-emerald-500",
    hex: "#10b981",
    icon: CircleCheckIcon,
  },
  YELLOW: {
    label: "Investigate",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    soft: "bg-amber-500/10 dark:bg-amber-500/15",
    stripe: "before:bg-amber-500",
    ring: "ring-amber-500/50",
    bar: "*:data-[slot=progress-indicator]:bg-amber-500",
    stroke: "stroke-amber-500",
    hex: "#f59e0b",
    icon: TriangleAlertIcon,
  },
  RED: {
    label: "Critical",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-500",
    soft: "bg-red-500/10 dark:bg-red-500/15",
    stripe: "before:bg-red-500",
    ring: "ring-red-500/50",
    bar: "*:data-[slot=progress-indicator]:bg-red-500",
    stroke: "stroke-red-500",
    hex: "#ef4444",
    icon: OctagonAlertIcon,
  },
}

export function stateFromVri(vri: number): NodeState {
  return vri >= 70 ? "RED" : vri >= 40 ? "YELLOW" : "GREEN"
}

export function worstState(states: NodeState[]): NodeState {
  if (states.includes("RED")) return "RED"
  if (states.includes("YELLOW")) return "YELLOW"
  return "GREEN"
}

export function StateBadge({
  state,
  className,
  short = false,
}: {
  state: NodeState
  className?: string
  short?: boolean
}) {
  const m = STATE_META[state]
  const Icon = m.icon
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-semibold tracking-wide",
        m.soft,
        m.text,
        className
      )}
    >
      <Icon className="size-3.5" />
      {state}
      {!short && <span className="font-normal opacity-80">{m.label}</span>}
    </span>
  )
}

export function Num({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <span className={cn("font-mono tabular-nums", className)}>{children}</span>
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2", className)}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-red-500" />
    </span>
  )
}

/** Semicircle VRI gauge with 40 / 70 threshold ticks. */
export function VriGauge({
  vri,
  state,
  className,
  label = "VRI",
}: {
  vri: number
  state: NodeState
  className?: string
  label?: string
}) {
  const m = STATE_META[state]
  const tick = (v: number) => {
    const a = Math.PI - (v / 100) * Math.PI
    return {
      x1: 80 + 58 * Math.cos(a),
      y1: 82 - 58 * Math.sin(a),
      x2: 80 + 80 * Math.cos(a),
      y2: 82 - 80 * Math.sin(a),
    }
  }
  return (
    <div className={cn("relative w-full max-w-48", className)}>
      <svg viewBox="0 0 160 92" className="w-full" role="img" aria-label={`${label} ${vri}`}>
        <path
          d="M 12 82 A 68 68 0 0 1 148 82"
          pathLength={100}
          fill="none"
          strokeWidth={12}
          className="stroke-muted"
        />
        <path
          d="M 12 82 A 68 68 0 0 1 148 82"
          pathLength={100}
          fill="none"
          strokeWidth={12}
          strokeDasharray={`${Math.max(0.5, Math.min(100, vri))} 100`}
          className={cn(m.stroke, "transition-[stroke-dasharray] duration-300")}
        />
        {[40, 70].map((v) => (
          <line key={v} {...tick(v)} strokeWidth={1.5} className="stroke-foreground/40" />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center leading-none">
        <Num className="text-4xl font-bold">{Math.round(vri)}</Num>
        <span className="mt-1 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          {label} / 100
        </span>
      </div>
    </div>
  )
}

export function Meter({
  label,
  value,
  display,
  className,
}: {
  label: string
  value: number
  display: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <Num className="text-foreground">{display}</Num>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/70 transition-[width] duration-300"
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
      </div>
    </div>
  )
}

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase",
        className
      )}
    >
      {children}
    </div>
  )
}

export function ConceptTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-sm border border-dashed border-foreground/30 px-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase",
        className
      )}
    >
      Concept - simulated, not built
    </span>
  )
}
