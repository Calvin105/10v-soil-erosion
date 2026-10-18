import { ChevronRightIcon } from "lucide-react"
import { Link, useNavigate } from "react-router"

import { Kbd } from "@/components/ui/kbd"
import { Progress } from "@/components/ui/progress"
import type { NodeState } from "@/data/types"
import { cn } from "@/lib/utils"

import { useHotkeys } from "../hotkeys"
import { Num, STATE_META, StateBadge } from "./state"

export interface TileProps {
  to: string
  hotkey?: string
  state?: NodeState
  eyebrow: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  metric?: React.ReactNode
  metricLabel?: React.ReactNode
  bar?: number
  barLabel?: React.ReactNode
  barRight?: React.ReactNode
  tags?: React.ReactNode
  children?: React.ReactNode
  className?: string
  dashed?: boolean
}

/** A big, chunky selectable child at the current level. */
export function Tile({
  to,
  hotkey,
  state,
  eyebrow,
  title,
  subtitle,
  metric,
  metricLabel,
  bar,
  barLabel,
  barRight,
  tags,
  children,
  className,
  dashed,
}: TileProps) {
  const navigate = useNavigate()
  useHotkeys(hotkey ? [{ key: hotkey, run: () => navigate(to) }] : [])
  const m = state ? STATE_META[state] : null

  return (
    <Link
      to={to}
      className={cn(
        "group relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl border-2 bg-card p-4 pl-5 text-card-foreground transition-all outline-none",
        "before:absolute before:inset-y-0 before:left-0 before:w-1.5",
        m ? m.stripe : "before:bg-foreground/20",
        "hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-lg focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        dashed && "border-dashed",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {eyebrow}
        </div>
        <div className="flex items-center gap-1.5">
          {hotkey && <Kbd className="h-6 min-w-6 text-sm">{hotkey}</Kbd>}
          <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-lg leading-tight font-semibold">{title}</div>
        {subtitle && (
          <div className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{subtitle}</div>
        )}
      </div>

      {(metric !== undefined || state) && (
        <div className="flex items-end justify-between gap-2">
          {metric !== undefined && (
            <div className="flex items-baseline gap-1.5">
              <Num className="text-4xl leading-none font-bold">{metric}</Num>
              {metricLabel && <span className="text-xs text-muted-foreground">{metricLabel}</span>}
            </div>
          )}
          {state && <StateBadge state={state} short />}
        </div>
      )}

      {children}

      {bar !== undefined && (
        <div className="flex flex-col gap-1">
          <Progress
            value={Math.max(0, Math.min(100, bar))}
            className={cn("h-2", m ? m.bar : "")}
          />
          {(barLabel || barRight) && (
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>{barLabel}</span>
              <span className="font-mono tabular-nums">{barRight}</span>
            </div>
          )}
        </div>
      )}

      {tags && <div className="flex flex-wrap items-center gap-1.5">{tags}</div>}
    </Link>
  )
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-sm bg-muted px-1.5 text-[11px] font-medium text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  )
}
