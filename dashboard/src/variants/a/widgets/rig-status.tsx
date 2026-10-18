import { memo } from "react"
import { SquareIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { rig, type RigEvent, type RigSnapshot } from "@/data/rig-sim"
import { SCENARIOS } from "@/data/seed"
import { cn } from "@/lib/utils"

import { KV, STATE, clock, ratioZone } from "../ui"

const LEVEL: Record<RigEvent["level"], { tag: string; cls: string }> = {
  info: { tag: "INFO", cls: "text-muted-foreground border-border" },
  success: { tag: " OK ", cls: `${STATE.GREEN.text} border-emerald-500/30` },
  warn: { tag: "WARN", cls: `${STATE.YELLOW.text} border-amber-500/40` },
  alert: { tag: "ALRT", cls: `${STATE.RED.text} border-red-500/40 bg-red-500/10` },
}

/** Monospace, newest-first event log. */
export const EventLog = memo(function EventLog({
  events,
  className,
}: {
  events: RigEvent[]
  className?: string
}) {
  return (
    <ScrollArea className={cn("h-full", className)}>
      <ol className="flex flex-col pr-2.5">
        {events.map((e, i) => (
          <li
            key={`${e.at}-${i}-${e.text}`}
            className={cn(
              "grid grid-cols-[52px_34px_1fr] items-baseline gap-1.5 border-b border-dashed border-border/60 py-[3px] font-mono text-[10.5px] leading-tight last:border-0",
              i === 0 && "va-flash"
            )}
          >
            <span className="text-muted-foreground tabular-nums">{clock(e.at)}</span>
            <span className={cn("rounded-[3px] border px-0.5 text-center text-[9px] whitespace-pre", LEVEL[e.level].cls)}>
              {LEVEL[e.level].tag}
            </span>
            <span className="min-w-0 font-sans text-[11px]">{e.text}</span>
          </li>
        ))}
      </ol>
    </ScrollArea>
  )
})

/** Active task progress + baseline / pulse / recording status. */
export function TaskStatus({ s }: { s: RigSnapshot }) {
  const t = s.task
  const remaining = t ? Math.max(0, (t.durationMs * (1 - t.progress)) / 1000) : 0
  const pulse = s.lastPulse
  const sc = SCENARIOS.find((x) => x.id === s.scenario)
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="rounded-sm border bg-muted/30 p-1.5">
        <div className="flex items-center gap-2 text-[11px]">
          <span className={cn("size-1.5 rounded-full", t ? "animate-pulse bg-foreground" : "bg-muted-foreground/40")} />
          <span className="truncate font-medium">{t ? t.label : "Idle - no task running"}</span>
          {t && (
            <>
              <span className="ml-auto font-mono text-[10.5px] text-muted-foreground tabular-nums">
                {Math.round(t.progress * 100)}% / {remaining.toFixed(1)}s
              </span>
              <Button size="icon-xs" variant="ghost" onClick={() => rig.cancelTask()} aria-label="Cancel task">
                <SquareIcon className="size-2.5" />
              </Button>
            </>
          )}
        </div>
        <Progress value={(t?.progress ?? 0) * 100} className="mt-1 h-1" />
      </div>

      <div className="grid grid-cols-2 gap-x-3">
        <KV
          k="Baseline tau"
          v={s.baseline ? s.baseline.tauMs.toFixed(1) : "not set"}
          unit={s.baseline ? "ms" : undefined}
          vClassName={s.baseline ? "" : STATE.YELLOW.text}
        />
        <KV k="Captured" v={s.baseline ? clock(s.baseline.at) : "--"} />
        <KV
          k="Pulse mean tau"
          v={pulse ? pulse.meanTauMs.toFixed(1) : "--"}
          unit={pulse ? "ms" : undefined}
        />
        <KV
          k="Pulse ratio"
          v={pulse?.ratio ? `${pulse.ratio.toFixed(2)}x` : "--"}
          vClassName={pulse?.ratio ? STATE[ratioZone(pulse.ratio)].text : ""}
        />
        <KV k="Clips this session" v={s.recordings.length} />
        <KV k="Bench (sim)" v={sc?.label ?? s.scenario} />
      </div>
      {pulse && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[9px] tracking-wider text-muted-foreground uppercase">taus</span>
          {pulse.taus.map((tau, i) => (
            <span key={i} className="rounded-[3px] border px-1 font-mono text-[10px] tabular-nums">
              {tau.toFixed(1)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
