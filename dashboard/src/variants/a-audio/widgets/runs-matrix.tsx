import { useState } from "react"
import { LayoutGridIcon, ListIcon, StarIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { audioStore, getFilteredRuns, useAudioStore } from "../store"
import { Dot, Num, StatePill } from "../ui"

export function RunsMatrix() {
  const s = useAudioStore()
  const displayedRuns = getFilteredRuns(s)
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* View Switcher Header */}
      <div className="flex shrink-0 items-center justify-between border-b pb-1 text-xs">
        <span className="font-mono text-[10px] text-muted-foreground">
          Showing {displayedRuns.length} runs
        </span>
        <div className="flex items-center gap-0.5 rounded border bg-muted/30 p-0.5">
          <Button
            size="icon-xs"
            variant={viewMode === "list" ? "secondary" : "ghost"}
            className="size-5"
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <ListIcon className="size-3" />
          </Button>
          <Button
            size="icon-xs"
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            className="size-5"
            onClick={() => setViewMode("grid")}
            title="2-Column Grid view"
          >
            <LayoutGridIcon className="size-3" />
          </Button>
        </div>
      </div>

      {/* Content Container (Scrollable) */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {viewMode === "list" ? (
          /* List View: Spacious, aligned rows with zero text collision */
          <div className="flex flex-col gap-1">
            {displayedRuns.map((r) => {
              const isSelected = r.id === s.selectedRunId
              const isBase = r.isBaseline

              return (
                <div
                  key={r.id}
                  onClick={() => audioStore.selectRun(r.id)}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between rounded-md border px-2.5 py-1.5 transition-colors",
                    isSelected
                      ? "border-primary/60 bg-primary/10 font-medium"
                      : "border-border/60 bg-card/40 hover:bg-muted/40"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Dot state={r.state} />
                    <span className="truncate text-xs font-semibold">{r.name}</span>
                    <span
                      className={`rounded px-1 font-mono text-[9px] uppercase ${
                        r.condition === "void"
                          ? "bg-red-500/15 text-red-600 dark:text-red-400"
                          : r.condition === "ambient"
                            ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {r.condition}
                    </span>
                    {isBase && (
                      <Badge variant="outline" className="h-3.5 px-1 font-mono text-[8.5px] text-primary">
                        BASE
                      </Badge>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5 font-mono text-[11px]">
                    <span className="text-muted-foreground">{r.avgPeakHz} Hz</span>
                    <Num className="font-bold">VRI {r.vriScore}</Num>
                    <StatePill state={r.state} compact />

                    {!isBase && (
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="size-5 opacity-0 group-hover:opacity-100"
                        title="Set as baseline reference"
                        onClick={(e) => {
                          e.stopPropagation()
                          audioStore.setBaseline(r.id)
                        }}
                      >
                        <StarIcon className="size-3 text-amber-500" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* 2-Column Grid View: Spacious cards, max 2 columns */
          <div className="grid grid-cols-2 gap-2">
            {displayedRuns.map((r) => {
              const isSelected = r.id === s.selectedRunId
              const isBase = r.isBaseline

              return (
                <div
                  key={r.id}
                  onClick={() => audioStore.selectRun(r.id)}
                  className={cn(
                    "group flex cursor-pointer flex-col justify-between rounded-md border p-2 transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border/60 bg-card/40 hover:bg-card"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex min-w-0 items-center gap-1.5 font-semibold text-xs">
                      <Dot state={r.state} />
                      <span className="truncate">{r.name}</span>
                    </div>
                    {isBase && (
                      <Badge variant="outline" className="h-3.5 px-1 font-mono text-[8.5px] text-primary">
                        BASE
                      </Badge>
                    )}
                  </div>

                  <div className="my-1.5 flex items-baseline justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground">VRI</span>
                    <Num className="text-base font-bold">{r.vriScore}</Num>
                  </div>

                  <div className="flex flex-col gap-0.5 border-t border-border/50 pt-1 font-mono text-[10px] text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Peak</span>
                      <span className="text-foreground">{r.avgPeakHz} Hz</span>
                    </div>
                    <div className="flex justify-between">
                      <span>RMS</span>
                      <span className="text-foreground">{r.avgRmsDb} dB</span>
                    </div>
                  </div>

                  {!isBase && (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="mt-1 h-5 w-full gap-1 p-0 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        audioStore.setBaseline(r.id)
                      }}
                    >
                      <StarIcon className="size-2.5 text-amber-500" />
                      Make Base
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
