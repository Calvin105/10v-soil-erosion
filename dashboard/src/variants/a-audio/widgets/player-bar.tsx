import { useEffect } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

import {
  audioStore,
  getActiveClip,
  useAudioStore,
  type Colormap,
} from "../store"

const CMAPS: Colormap[] = ["inferno", "viridis", "mono"]

export function PlayerBar() {
  const s = useAudioStore()
  const activeClip = getActiveClip(s)
  const dur = activeClip?.durationSec || 10
  const cur = s.playback.currentTime

  // Keyboard shortcut: Space to Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === "Space") {
        e.preventDefault()
        audioStore.togglePlay()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = (sec % 60).toFixed(1)
    return `${m.toString().padStart(2, "0")}:${s.padStart(4, "0")}`
  }

  const handleNextClip = () => {
    const nextIdx = (activeClip.clipIndex % 10) + 1
    audioStore.selectClip(nextIdx)
  }

  const handlePrevClip = () => {
    const prevIdx = activeClip.clipIndex === 1 ? 10 : activeClip.clipIndex - 1
    audioStore.selectClip(prevIdx)
  }

  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b bg-card/60 px-3 backdrop-blur-sm">
      {/* Play / Pause & Prev / Next */}
      <div className="flex items-center gap-1">
        <Button
          size="icon-xs"
          variant="ghost"
          className="size-7"
          onClick={handlePrevClip}
          title="Previous clip"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>

        <Button
          size="xs"
          variant={s.playback.isPlaying ? "secondary" : "default"}
          className="h-7 w-20 gap-1.5 font-medium"
          onClick={() => audioStore.togglePlay()}
        >
          {s.playback.isPlaying ? (
            <>
              <PauseIcon className="size-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <PlayIcon className="size-3.5 fill-current" />
              <span>Play</span>
            </>
          )}
        </Button>

        <Button
          size="icon-xs"
          variant="ghost"
          className="size-7"
          onClick={handleNextClip}
          title="Next clip"
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      {/* Scrubber & Time */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="font-mono text-[11px] font-medium text-foreground">
          {formatTime(cur)}
        </span>

        <Slider
          value={[cur]}
          min={0}
          max={dur}
          step={0.05}
          onValueChange={(val) => {
            const nextTime = Array.isArray(val) ? val[0] : val
            audioStore.seek(nextTime)
          }}
          className="flex-1 cursor-pointer"
        />

        <span className="font-mono text-[11px] text-muted-foreground">
          {formatTime(dur)}
        </span>
      </div>

      {/* Volume & Colormap Picker */}
      <div className="flex items-center gap-2">
        <Button
          size="icon-xs"
          variant="ghost"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={() => audioStore.toggleMute()}
          title={s.playback.isMuted ? "Unmute" : "Mute"}
        >
          {s.playback.isMuted || s.playback.volume === 0 ? (
            <VolumeXIcon className="size-3.5 text-red-500" />
          ) : (
            <Volume2Icon className="size-3.5" />
          )}
        </Button>

        <div className="w-16">
          <Slider
            value={[s.playback.isMuted ? 0 : s.playback.volume]}
            min={0}
            max={1}
            step={0.05}
            onValueChange={(val) => {
              const v = Array.isArray(val) ? val[0] : val
              audioStore.setVolume(v)
            }}
          />
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Colormap switch */}
        <Button
          size="xs"
          variant="ghost"
          className="h-6 px-1.5 font-mono text-[10px] text-muted-foreground"
          onClick={() => {
            const nextIdx = (CMAPS.indexOf(s.colormap) + 1) % CMAPS.length
            audioStore.setColormap(CMAPS[nextIdx])
          }}
          title="Change spectrogram color map"
        >
          cmap: <span className="font-semibold text-foreground uppercase">{s.colormap}</span>
        </Button>
      </div>
    </div>
  )
}
