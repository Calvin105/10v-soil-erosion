import { CheckIcon, XIcon } from "lucide-react"

import type { RigSnapshot } from "@/data/rig-sim"
import { CLASS_LABELS } from "@/data/seed"
import type { ClassLabel, ModelCard, Probs } from "@/data/types"
import { cn } from "@/lib/utils"

export function top1(p: Probs): ClassLabel {
  return CLASS_LABELS.reduce((a, b) => (p[b] > p[a] ? b : a), CLASS_LABELS[0] as ClassLabel)
}

/**
 * Two bars per class: Phase 1 laptop RF and Phase 2 TinyML.
 * The model that currently drives the VRI is drawn solid, the other faded.
 */
export function ProbCompare({ s, dense = false }: { s: RigSnapshot; dense?: boolean }) {
  const drivesTiny = s.tinyMlOnDevice
  const rf = top1(s.laptopProbs)
  const tm = top1(s.tinyProbs)
  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="grid grid-cols-[46px_1fr_38px] items-center gap-x-2 text-[9px] tracking-wider text-muted-foreground uppercase">
        <span>class</span>
        <span className="flex gap-3">
          <span className="flex items-center gap-1">
            <span className={cn("h-1.5 w-3 rounded-full", drivesTiny ? "bg-foreground/30" : "bg-foreground")} />
            P1 RF laptop
          </span>
          <span className="flex items-center gap-1">
            <span className={cn("h-1.5 w-3 rounded-full", drivesTiny ? "bg-foreground" : "bg-foreground/30")} />
            P2 TinyML
          </span>
        </span>
        <span className="text-right">p</span>
      </div>
      <div className={cn("flex flex-1 flex-col justify-around", dense ? "gap-1" : "gap-1.5")}>
        {CLASS_LABELS.map((c) => (
          <div key={c} className="grid grid-cols-[46px_1fr_38px] items-center gap-x-2">
            <span
              className={cn(
                "font-mono text-[11px]",
                c === top1(drivesTiny ? s.tinyProbs : s.laptopProbs) ? "font-semibold" : "text-muted-foreground"
              )}
            >
              {c}
            </span>
            <div className="flex flex-col gap-[3px]">
              <Bar v={s.laptopProbs[c]} active={!drivesTiny} />
              <Bar v={s.tinyProbs[c]} active={drivesTiny} />
            </div>
            <div className="flex flex-col text-right font-mono text-[10px] leading-[11px] tabular-nums">
              <span className={drivesTiny ? "text-muted-foreground" : ""}>{s.laptopProbs[c].toFixed(2)}</span>
              <span className={drivesTiny ? "" : "text-muted-foreground"}>{s.tinyProbs[c].toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t pt-1 font-mono text-[10.5px]">
        <span className="text-muted-foreground">top-1</span>
        <span>RF {rf}</span>
        <span className="text-muted-foreground">/</span>
        <span>TML {tm}</span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-0.5 rounded-sm border px-1",
            rf === tm ? "text-muted-foreground" : "border-foreground/40 font-semibold"
          )}
        >
          {rf === tm ? <CheckIcon className="size-3" /> : <XIcon className="size-3" />}
          {rf === tm ? "agree" : "disagree"}
        </span>
      </div>
    </div>
  )
}

function Bar({ v, active }: { v: number; active: boolean }) {
  return (
    <div className="relative h-[5px] w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-[width] duration-200",
          active ? "bg-foreground" : "bg-foreground/30"
        )}
        style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }}
      />
    </div>
  )
}

/** Row-normalised confusion matrix (rows = true label, cols = predicted). */
export function ConfusionMatrix({
  model,
  className,
  fill = false,
}: {
  model: ModelCard
  className?: string
  /** Stretch the four class rows to the height of the parent. */
  fill?: boolean
}) {
  const m = model.confusion
  const colSums = m[0].map((_, j) => m.reduce((a, r) => a + r[j], 0))
  return (
    <div className={cn("flex flex-col gap-1", fill && "h-full", className)}>
      <div
        className={cn(
          "grid grid-cols-[52px_repeat(4,minmax(0,1fr))_40px] gap-px text-[9px]",
          fill && "min-h-0 flex-1 grid-rows-[auto_repeat(4,minmax(24px,1fr))_auto] gap-0.5"
        )}
      >
        <span className="text-muted-foreground">true \ pred</span>
        {CLASS_LABELS.map((c) => (
          <span key={c} className="truncate text-center font-mono text-muted-foreground">
            {c}
          </span>
        ))}
        <span className="text-right font-mono text-muted-foreground">recall</span>
        {m.map((row, i) => {
          const sum = row.reduce((a, b) => a + b, 0)
          return [
            <span key={`l${i}`} className="self-center font-mono text-[10px] text-muted-foreground">
              {CLASS_LABELS[i]}
            </span>,
            ...row.map((v, j) => {
              const p = v / sum
              return (
                <div
                  key={`c${i}${j}`}
                  title={`true ${CLASS_LABELS[i]}, predicted ${CLASS_LABELS[j]}: ${v} clips`}
                  className={cn(
                    "flex items-center justify-center rounded-[3px] font-mono text-[10.5px] tabular-nums",
                    fill ? "h-full text-xs" : "h-6",
                    p > 0.5 ? "text-background" : "text-foreground",
                    i === j ? "font-semibold" : ""
                  )}
                  style={{ backgroundColor: `color-mix(in oklch, var(--foreground) ${Math.round(Math.max(p, 0.03) * 90)}%, transparent)` }}
                >
                  {v}
                </div>
              )
            }),
            <span key={`r${i}`} className="self-center text-right font-mono text-[10px] tabular-nums">
              {((row[i] / sum) * 100).toFixed(0)}%
            </span>,
          ]
        })}
        <span className="font-mono text-[9px] text-muted-foreground">precision</span>
        {colSums.map((cs, j) => (
          <span key={j} className="text-center font-mono text-[10px] tabular-nums">
            {((m[j][j] / cs) * 100).toFixed(0)}%
          </span>
        ))}
        <span />
      </div>
    </div>
  )
}
