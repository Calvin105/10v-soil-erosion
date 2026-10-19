import type { ReactNode } from "react"
import { CircleCheckIcon, OctagonAlertIcon, TriangleAlertIcon, type LucideIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { NodeState } from "./types"

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

export function zoneOf(vri: number): NodeState {
  return vri >= 70 ? "RED" : vri >= 40 ? "YELLOW" : "GREEN"
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

export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono font-medium tracking-tight tabular-nums", className)}>{children}</span>
}

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
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-md border bg-card text-card-foreground shadow-none",
        className
      )}
    >
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b bg-muted/40 px-2 text-xs">
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
      <div className={cn("relative min-h-0 flex-1 overflow-auto p-2", bodyClassName)}>{children}</div>
    </Card>
  )
}
