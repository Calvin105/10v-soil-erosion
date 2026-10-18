import type { ReactNode } from "react"
import { CircleCheckIcon, OctagonAlertIcon, TriangleAlertIcon, type LucideIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import type { NodeState } from "@/data/types"
import { cn } from "@/lib/utils"

// ---------- state colours (the only hard-coded colours in this variant) ----------

export const STATE: Record<
  NodeState,
  { pill: string; dot: string; text: string; hex: string; stroke: string; icon: LucideIcon; word: string }
> = {
  GREEN: {
    pill: "border-emerald-600/30 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    hex: "#10b981",
    stroke: "stroke-emerald-500",
    icon: CircleCheckIcon,
    word: "Normal",
  },
  YELLOW: {
    pill: "border-amber-600/30 bg-amber-500/12 text-amber-700 dark:border-amber-400/30 dark:text-amber-400",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    hex: "#f59e0b",
    stroke: "stroke-amber-500",
    icon: TriangleAlertIcon,
    word: "Investigate",
  },
  RED: {
    pill: "border-red-600/30 bg-red-500/12 text-red-700 dark:border-red-400/30 dark:text-red-400",
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
    hex: "#ef4444",
    stroke: "stroke-red-500",
    icon: OctagonAlertIcon,
    word: "Critical",
  },
}

/** VRI zone (not the hysteresis state) for colouring a raw number. */
export function zoneOf(vri: number): NodeState {
  return vri >= 70 ? "RED" : vri >= 40 ? "YELLOW" : "GREEN"
}

/** Ring-time ratio zone: 1x healthy, >1.3x drifting, >1.8x hollow. */
export function ratioZone(r: number): NodeState {
  return r >= 1.8 ? "RED" : r >= 1.3 ? "YELLOW" : "GREEN"
}

export function StatePill({
  state,
  className,
  compact = false,
}: {
  state: NodeState
  className?: string
  compact?: boolean
}) {
  const s = STATE[state]
  const Icon = s.icon
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 font-mono text-[10.5px] font-semibold tracking-wide",
        s.pill,
        className
      )}
    >
      <Icon className="size-3" />
      {state}
      {!compact && <span className="font-sans font-normal opacity-80">{s.word}</span>}
    </span>
  )
}

export function Dot({ state, className }: { state: NodeState; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", STATE[state].dot, className)} />
}

// ---------- layout primitives ----------

export function Pane({
  title,
  icon: Icon,
  meta,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode
  icon?: LucideIcon
  meta?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Card
      size="sm"
      className={cn("h-full min-h-0 gap-0 rounded-md py-0 shadow-none ring-foreground/12", className)}
    >
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b bg-muted/40 px-2">
        {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
        <span className="truncate text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </span>
        {meta && (
          <span className="truncate font-mono text-[10.5px] text-muted-foreground/80 tabular-nums">
            {meta}
          </span>
        )}
        {actions && <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      <div className={cn("relative min-h-0 flex-1 p-2", bodyClassName)}>{children}</div>
    </Card>
  )
}

export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono tabular-nums", className)}>{children}</span>
}

/** Compact key / value row used across readouts. */
export function KV({
  k,
  v,
  unit,
  className,
  vClassName,
}: {
  k: ReactNode
  v: ReactNode
  unit?: string
  className?: string
  vClassName?: string
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-2 text-[11px] leading-5", className)}>
      <span className="truncate text-muted-foreground">{k}</span>
      <span className={cn("font-mono tabular-nums", vClassName)}>
        {v}
        {unit && <span className="ml-0.5 text-muted-foreground">{unit}</span>}
      </span>
    </div>
  )
}

/** Thin horizontal meter, value 0..1. Neutral ink unless a state is given. */
export function Meter({
  value,
  state,
  className,
  muted = false,
}: {
  value: number
  state?: NodeState
  className?: string
  muted?: boolean
}) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-[width] duration-200",
          state ? STATE[state].dot : muted ? "bg-muted-foreground/50" : "bg-foreground/80"
        )}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  )
}

/** Big striped strip that marks the production concept as not built. */
export function ConceptBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="va-hazard flex shrink-0 items-center gap-2 rounded-md border border-dashed border-foreground/25 px-3 py-1.5 text-[11px]">
      <span className="rounded-sm bg-foreground px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest text-background">
        CONCEPT
      </span>
      <span className="font-medium">Simulated, not built.</span>
      <span className="truncate text-muted-foreground">{children}</span>
    </div>
  )
}

// ---------- formatting ----------

export function clock(ms: number) {
  return new Date(ms).toLocaleTimeString("en-GB", { hour12: false })
}

export function dateTime(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`
}

export function pct(v: number, digits = 0) {
  return `${(v * 100).toFixed(digits)}%`
}

// ---------- dense table + tile helpers ----------

/** Class names that turn the shadcn Table into a compact console grid. */
export const TH =
  "h-6 px-1.5 text-[9.5px] font-semibold tracking-wider text-muted-foreground uppercase bg-muted/40 sticky top-0 z-10"
export const TD = "px-1.5 py-[3px] text-[11px]"
export const TDN = "px-1.5 py-[3px] text-right font-mono text-[11px] tabular-nums"

/** Small boxed readout: label above, value below. */
export function Stat({
  label,
  value,
  unit,
  sub,
  className,
  valueClassName,
}: {
  label: ReactNode
  value: ReactNode
  unit?: string
  sub?: ReactNode
  className?: string
  valueClassName?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col rounded-sm border bg-muted/30 px-2 py-1", className)}>
      <span className="truncate text-[9px] tracking-wider text-muted-foreground uppercase">{label}</span>
      <span className={cn("font-mono text-base leading-tight font-semibold tabular-nums", valueClassName)}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{unit}</span>}
      </span>
      {sub && <span className="truncate text-[10px] leading-tight text-muted-foreground">{sub}</span>}
    </div>
  )
}

/** Tiny outlined tag. */
export function Tag({
  children,
  className,
  title,
}: {
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-4 items-center rounded-[3px] border px-1 font-mono text-[9.5px] leading-none whitespace-nowrap text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  )
}

/** Heat colour for a 0..1 risk value (5 bands, very low to very high). */
export const HEAT = ["#3b9c6e", "#a3b94a", "#f2c230", "#ee8130", "#d6342c"] as const
export const HEAT_LABELS = ["Very low", "Low", "Moderate", "High", "Very high"] as const

/** Band edges tuned to the seed grid (most cells sit between 0.15 and 0.35). */
export const HEAT_EDGES = [0.2, 0.3, 0.45, 0.65] as const

export function heatBand(v: number) {
  return HEAT_EDGES.filter((e) => v >= e).length
}
