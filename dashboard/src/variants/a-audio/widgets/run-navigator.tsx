import { useRef } from "react"
import {
  CheckIcon,
  FolderOpenIcon,
  RotateCcwIcon,
  SparklesIcon,
  StarIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import {
  audioStore,
  getActiveClip,
  getActiveRun,
  getFilteredRuns,
  useAudioStore,
} from "../store"
import { Dot, StatePill } from "../ui"

export function RunNavigator() {
  const s = useAudioStore()
  const activeRun = getActiveRun(s)
  const activeClip = getActiveClip(s)
  const filteredRuns = getFilteredRuns(s)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    toast.promise(audioStore.loadFolderFiles(files), {
      loading: "Decoding .WAV files and computing STFT spectrograms...",
      success: "Successfully loaded audio runs!",
      error: (err: unknown) => (err instanceof Error ? err.message : "Failed to load audio files"),
    })
  }

  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b bg-background px-3">
      {/* Hidden File Input for Folder Selection */}
      <input
        ref={fileInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in Chromium/Firefox
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={handleFolderSelect}
      />

      <div className="flex min-w-0 items-center gap-3">
        {/* Condition Selector: Safe (18) vs Ambient (8) vs Void (18) */}
        <div className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5">
          <button
            onClick={() => audioStore.setCondition("safe")}
            className={cn(
              "flex h-6 items-center gap-1 rounded px-2 font-mono text-[11px] font-medium transition-colors",
              s.selectedCondition === "safe"
                ? "bg-emerald-600 text-white shadow-xs dark:bg-emerald-500"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="size-1.5 rounded-full bg-emerald-200" />
            Safe (18)
          </button>

          <button
            onClick={() => audioStore.setCondition("ambient")}
            className={cn(
              "flex h-6 items-center gap-1 rounded px-2 font-mono text-[11px] font-medium transition-colors",
              s.selectedCondition === "ambient"
                ? "bg-sky-600 text-white shadow-xs dark:bg-sky-500"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="size-1.5 rounded-full bg-sky-200" />
            Ambient (8)
          </button>

          <button
            onClick={() => audioStore.setCondition("void")}
            className={cn(
              "flex h-6 items-center gap-1 rounded px-2 font-mono text-[11px] font-medium transition-colors",
              s.selectedCondition === "void"
                ? "bg-red-600 text-white shadow-xs dark:bg-red-500"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="size-1.5 rounded-full bg-red-200" />
            Void (18)
          </button>

          <button
            onClick={() => audioStore.setCondition("all")}
            className={cn(
              "flex h-6 items-center rounded px-2 font-mono text-[11px] font-medium transition-colors",
              s.selectedCondition === "all"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All (44)
          </button>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Run Selector */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase">
            Run:
          </span>
          <Select
            value={s.selectedRunId}
            onValueChange={(val) => audioStore.selectRun(val)}
          >
            <SelectTrigger className="h-7 w-[165px] text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {filteredRuns.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    <Dot state={r.state} />
                    <span>{r.name}</span>
                    {r.isBaseline && (
                      <span className="rounded bg-primary/10 px-1 font-mono text-[9px] text-primary">
                        BASELINE
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Set as Baseline Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="xs"
              variant={activeRun.isBaseline ? "secondary" : "outline"}
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => {
                audioStore.setBaseline(activeRun.id)
                toast.success(`${activeRun.name} set as healthy baseline reference!`)
              }}
            >
              {activeRun.isBaseline ? (
                <>
                  <CheckIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Baseline</span>
                </>
              ) : (
                <>
                  <StarIcon className="size-3 text-amber-500" />
                  <span>Set as Baseline</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Mark this run as the reference &quot;Normal/Safe&quot; water flow condition.
          </TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-border" />

        {/* 10-Clip Selector Pills */}
        <div className="flex items-center gap-1">
          <span className="font-mono text-[10px] text-muted-foreground">Clip (10s):</span>
          <div className="flex items-center gap-0.5 rounded-md border bg-muted/30 p-0.5">
            {activeRun.clips.map((clip) => {
              const isSelected = clip.clipIndex === activeClip.clipIndex
              return (
                <button
                  key={clip.id}
                  onClick={() => audioStore.selectClip(clip.clipIndex)}
                  className={cn(
                    "flex h-6 min-w-6 items-center justify-center rounded px-1.5 font-mono text-[11px] font-medium transition-colors",
                    isSelected
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                  )}
                  title={`${clip.name} (${clip.durationSec}s)`}
                >
                  {clip.clipIndex.toString().padStart(2, "0")}
                </button>
              )
            })}
          </div>
        </div>

        {/* State Pill */}
        <StatePill state={activeRun.state} />
      </div>

      {/* Right Actions: Load Folder & Demo Reset */}
      <div className="flex shrink-0 items-center gap-2">
        {activeRun.isSynthetic && (
          <Badge variant="outline" className="gap-1 border-dashed font-mono text-[10px] text-muted-foreground">
            <SparklesIcon className="size-2.5 text-amber-500" />
            SYNTHETIC BENCH AUDIO
          </Badge>
        )}

        <Button
          size="xs"
          variant="outline"
          className="h-7 gap-1 px-2.5 text-xs"
          onClick={() => fileInputRef.current?.click()}
        >
          <FolderOpenIcon className="size-3.5" />
          <span>Load .WAV Folder</span>
        </Button>

        {activeRun.isSynthetic === false && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                className="size-7"
                onClick={() => {
                  audioStore.resetToSynthetic()
                  toast("Reset to synthetic water flow simulation")
                }}
              >
                <RotateCcwIcon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Reset to default demo runs
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
