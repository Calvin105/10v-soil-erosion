import { useState } from "react"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileAudioIcon,
  PlayIcon,
  SearchIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  audioStore,
  getFilteredRuns,
  useAudioStore,
} from "../store"
import { Dot, Num, StatePill } from "../ui"

export function FileListPanel() {
  const s = useAudioStore()
  const [search, setSearch] = useState("")
  const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({
    [s.selectedRunId]: true,
  })

  const displayedRuns = getFilteredRuns(s).filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.name.toLowerCase().includes(q) ||
      r.condition.includes(q) ||
      r.clips.some((c) => c.name.toLowerCase().includes(q))
    )
  })

  const toggleRun = (runId: string) => {
    setExpandedRuns((prev) => ({
      ...prev,
      [runId]: !prev[runId],
    }))
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Search Input */}
      <div className="relative">
        <SearchIcon className="absolute top-2 left-2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Filter runs & .wav clips..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 pl-7 font-mono text-xs"
        />
      </div>

      {/* Runs & Files List */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-xs">
        <div className="flex flex-col gap-1.5">
          {displayedRuns.map((r) => {
            const isSelectedRun = r.id === s.selectedRunId
            const isExpanded = !!expandedRuns[r.id]

            return (
              <div
                key={r.id}
                className={cn(
                  "overflow-hidden rounded-md border transition-all",
                  isSelectedRun ? "border-primary/60 bg-muted/20" : "border-border/60 bg-card/40"
                )}
              >
                {/* Run Header */}
                <div
                  onClick={() => {
                    audioStore.selectRun(r.id)
                    toggleRun(r.id)
                  }}
                  className="flex cursor-pointer items-center justify-between p-2 hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleRun(r.id)
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronDownIcon className="size-3.5" />
                      ) : (
                        <ChevronRightIcon className="size-3.5" />
                      )}
                    </button>

                    <Dot state={r.state} />

                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span>{r.name}</span>
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
                        {r.isBaseline && (
                          <Badge variant="outline" className="h-3.5 px-1 font-mono text-[8.5px] text-primary">
                            BASE
                          </Badge>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Peak: {r.avgPeakHz} Hz · RMS: {r.avgRmsDb} dB
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Num className="text-xs font-bold">VRI {r.vriScore}</Num>
                    <StatePill state={r.state} compact />
                  </div>
                </div>

                {/* Expanded Clips List */}
                {isExpanded && (
                  <div className="flex flex-col border-t bg-background/50 py-1">
                    {r.clips.map((clip) => {
                      const isSelectedClip = isSelectedRun && clip.clipIndex === s.selectedClipIndex

                      return (
                        <div
                          key={clip.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!isSelectedRun) audioStore.selectRun(r.id)
                            audioStore.selectClip(clip.clipIndex)
                            audioStore.play()
                          }}
                          className={cn(
                            "group flex cursor-pointer items-center justify-between px-3 py-1 text-[11px] transition-colors",
                            isSelectedClip
                              ? "bg-primary/10 font-medium text-foreground"
                              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <FileAudioIcon className={cn("size-3", isSelectedClip ? "text-primary" : "text-muted-foreground")} />
                            <span>{clip.name}.wav</span>
                            <span className="font-mono text-[9.5px] text-muted-foreground">
                              ({clip.durationSec}s)
                            </span>
                          </div>

                          <div className="flex items-center gap-2 font-mono text-[10px]">
                            <span>{clip.peakHz} Hz</span>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              className="size-5 opacity-0 group-hover:opacity-100"
                              title="Play this clip"
                            >
                              <PlayIcon className="size-2.5 fill-current" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
