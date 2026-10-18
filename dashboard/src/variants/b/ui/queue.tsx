import { useEffect, useRef } from "react"
import {
  CheckIcon,
  CircleSlashIcon,
  ClockIcon,
  ListOrderedIcon,
  LoaderCircleIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useRig } from "@/data/rig-sim"
import { cn } from "@/lib/utils"

import {
  cancelItem,
  clearFinished,
  etaMs,
  fmtEta,
  RIG_LANE,
  useGame,
  type QueueItem,
} from "../store"
import { Num, SectionLabel } from "./state"

function StatusIcon({ s }: { s: QueueItem["status"] }) {
  if (s === "running") return <LoaderCircleIcon className="size-4 animate-spin" />
  if (s === "queued") return <ClockIcon className="size-4 text-muted-foreground" />
  if (s === "done") return <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
  return <CircleSlashIcon className="size-4 text-muted-foreground" />
}

function Row({ item, queue }: { item: QueueItem; queue: QueueItem[] }) {
  const active = item.status === "queued" || item.status === "running"
  const ahead = queue.filter(
    (i) =>
      i.lane === item.lane &&
      (i.status === "queued" || i.status === "running") &&
      queue.indexOf(i) < queue.indexOf(item)
  ).length
  return (
    <li
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border p-2.5",
        item.status === "running" && "border-foreground/50 bg-muted/40",
        !active && "opacity-60"
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5">
          <StatusIcon s={item.status} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{item.title}</div>
          <div className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
            <span
              className={cn(
                "rounded-sm px-1 font-semibold tracking-wider uppercase",
                item.simulated
                  ? "border border-dashed border-foreground/30"
                  : "bg-foreground text-background"
              )}
            >
              {item.simulated ? "Sim" : "Rig"}
            </span>
            <span className="truncate">{item.origin}</span>
          </div>
        </div>
        {active && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Cancel ${item.title}`}
            onClick={() => cancelItem(item.id)}
          >
            <XIcon />
          </Button>
        )}
      </div>
      {active && (
        <>
          <Progress value={item.progress * 100} className="h-2" />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>
              {item.status === "running"
                ? `Running ${Math.round(item.progress * 100)}%`
                : item.lane === RIG_LANE && ahead === 0
                  ? "Waiting for rig"
                  : `#${ahead + 1} in ${item.lane} lane`}
            </span>
            <Num>ETA {fmtEta(etaMs(queue, item))}</Num>
          </div>
        </>
      )}
      {!active && (
        <div className="text-[11px] text-muted-foreground capitalize">{item.status}</div>
      )}
    </li>
  )
}

export function ActionQueue() {
  const queue = useGame((s) => s.queue)
  const ref = useRef<HTMLDivElement>(null)
  const activeCount = queue.filter((i) => i.status === "queued" || i.status === "running").length
  const prev = useRef(activeCount)
  useEffect(() => {
    if (activeCount > prev.current) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    prev.current = activeCount
  }, [activeCount])
  const task = useRig().task
  const active = queue.filter((i) => i.status === "queued" || i.status === "running")
  const finished = queue.filter((i) => !(i.status === "queued" || i.status === "running")).reverse()
  const ownsRigTask = active.some((i) => i.status === "running" && !!i.rig)

  return (
    <Card size="sm" className="gap-3" ref={ref}>
      <CardHeader className="gap-0.5">
        <SectionLabel>Action queue</SectionLabel>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Num>{active.length}</Num> active
          <span className="text-xs font-normal text-muted-foreground">
            rig runs one task at a time
          </span>
        </CardTitle>
        {finished.length > 0 && (
          <CardAction>
            <Button variant="ghost" size="xs" onClick={clearFinished}>
              Clear done
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {task && !ownsRigTask && (
          <div className="mb-2 flex flex-col gap-1.5 rounded-lg border border-dashed p-2.5">
            <div className="flex items-center gap-2 text-sm">
              <LoaderCircleIcon className="size-4 animate-spin" />
              {task.label}
            </div>
            <Progress value={task.progress * 100} className="h-2" />
            <div className="text-[11px] text-muted-foreground">Started outside this queue</div>
          </div>
        )}
        {queue.length === 0 && !task ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-dashed p-2.5 text-xs text-muted-foreground">
            <ListOrderedIcon className="size-4 shrink-0" />
            <span>
              <span className="font-medium text-foreground">Queue idle.</span> Issue an order and it queues here with
              progress and ETA.
            </span>
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {active.map((i) => (
              <Row key={i.id} item={i} queue={queue} />
            ))}
            {finished.slice(0, 4).map((i) => (
              <Row key={i.id} item={i} queue={queue} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
