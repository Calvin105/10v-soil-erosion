import { useState } from "react"
import {
  ChevronsUpIcon,
  CircleIcon,
  CrosshairIcon,
  Minimize2Icon,
  PlayIcon,
  PowerIcon,
  SquareIcon,
  WavesIcon,
} from "lucide-react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { MicSpectrum, MicWaterfall, VibScope } from "@/components/viz/rig-viz"
import { rig, useRig } from "@/data/rig-sim"
import { SCENARIOS } from "@/data/seed"
import { cn } from "@/lib/utils"
import { GLASS, STATE_TEXT } from "../lib"
import { cstore, useC } from "../store"
import { runDemo, stopDemo, useDemoStep } from "./demo"
import { RecordForm, StatePill, TaskBar, VriGauge, VriSparkline } from "./widgets"

export const DOCK_H = 262
export const DOCK_H_MIN = 64

export function TransportChip() {
  const s = useRig()
  const label = !s.connected ? "Reconnecting" : s.transport === "wifi" ? "Wi-Fi" : "USB serial"
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 font-mono text-[11px] tabular-nums",
        !s.connected && "border-amber-500/50 text-amber-700 dark:text-amber-300"
      )}
    >
      <span className="relative flex size-1.5">
        {s.connected && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />}
        <span
          className={cn("relative inline-flex size-1.5 rounded-full", s.connected ? "bg-emerald-500" : "bg-amber-500")}
        />
      </span>
      LIVE · {label} · {s.connected ? `${s.fps} fps` : "--"}
    </span>
  )
}

function DockHeader({ minimized }: { minimized: boolean }) {
  const s = useRig()
  const navigate = useNavigate()
  const demo = useDemoStep()
  const scenario = SCENARIOS.find((x) => x.id === s.scenario)
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-foreground text-background">
          <WavesIcon className="size-4" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-medium">Test bench</div>
          <div className="hidden truncate text-[11px] text-muted-foreground sm:block">XIAO ESP32S3 Sense · mic + vibration</div>
        </div>
      </div>
      <span className="hidden sm:inline-flex">
        <TransportChip />
      </span>
      {minimized && (
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-lg font-semibold tabular-nums", STATE_TEXT[s.state])}>{s.vri}</span>
          <StatePill state={s.state} />
          <VriSparkline history={s.vriHistory} className="hidden h-7 w-32 md:block" />
        </div>
      )}
      <span className="hidden truncate text-xs text-muted-foreground lg:inline">
        Bench: <span className="text-foreground">{scenario?.label}</span> (demo control)
        {s.wet && <span className="ml-1 font-medium text-foreground">· WET</span>}
      </span>
      {s.task && !minimized && <TaskBar task={s.task} className="ml-auto hidden w-64 xl:flex" />}
      <div className={cn("flex items-center gap-1", !(s.task && !minimized) && "ml-auto")}>
        {demo ? (
          <Button size="sm" variant="secondary" onClick={stopDemo}>
            <SquareIcon className="fill-current" /> <span className="max-w-56 truncate">{demo}</span>
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={() => void runDemo()}>
                <PlayIcon /> Demo script
              </Button>
            </TooltipTrigger>
            <TooltipContent>Calibrate, pulse packed soil, wash out 250 ml, pulse again</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={minimized ? "Restore player" : "Minimize player"}
              onClick={() => cstore.setDockMinimized(!minimized)}
            >
              {minimized ? <ChevronsUpIcon className="rotate-180" /> : <Minimize2Icon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{minimized ? "Restore player" : "Minimize player"}</TooltipContent>
        </Tooltip>
        <Button size="sm" onClick={() => navigate("/c/prototype/lab")}>
          <ChevronsUpIcon /> Lab view
        </Button>
      </div>
    </div>
  )
}

function DockVri() {
  const s = useRig()
  return (
    <div className="flex h-full flex-col justify-between gap-2 rounded-xl bg-muted/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Void Risk Index</span>
        <StatePill state={s.state} />
      </div>
      <VriGauge vri={s.vri} state={s.state} caption={s.tinyMlOnDevice ? "TinyML on ESP32" : "Laptop RF"} className="mx-auto w-40" />
      <VriSparkline history={s.vriHistory} className="h-8" />
    </div>
  )
}

function DockControls() {
  const s = useRig()
  const [recOpen, setRecOpen] = useState(false)
  const busy = !!s.task
  const needsAck = s.state !== "GREEN"
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            rig.calibrate(8)
            toast("Calibrating healthy baseline for 8 s. Keep the soil packed.")
          }}
        >
          <CrosshairIcon /> Calibrate
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            rig.runPulseTest(4, 1200)
            toast("Flow pulse test: 4 on/off cycles")
          }}
        >
          <WavesIcon /> Pulse test
        </Button>
        <Popover open={recOpen} onOpenChange={setRecOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" disabled={busy}>
              <CircleIcon className="fill-red-500 text-red-500" /> Record
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-80">
            <div className="text-sm font-medium">Record & label a training clip</div>
            <RecordForm scenario={s.scenario} busy={busy} onDone={() => setRecOpen(false)} />
          </PopoverContent>
        </Popover>
        <Button
          variant={s.flowOn ? "secondary" : "outline"}
          disabled={s.task?.kind === "pulse"}
          onClick={() => rig.setFlow(!s.flowOn)}
          aria-pressed={s.flowOn}
        >
          <PowerIcon /> Flow {s.flowOn ? "ON" : "OFF"}
        </Button>
      </div>
      {s.task ? (
        <TaskBar task={s.task} className="xl:hidden" />
      ) : needsAck ? (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            rig.acknowledge()
            toast("Alert acknowledged")
          }}
        >
          Acknowledge {s.state}
        </Button>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {s.baseline
            ? `Baseline tau ${s.baseline.tauMs.toFixed(1)} ms saved ${new Date(s.baseline.at).toLocaleTimeString("en-GB")}`
            : "No baseline yet. Calibrate with packed soil first."}
        </p>
      )}
    </div>
  )
}

export function Dock() {
  const minimized = useC((s) => s.dockMinimized)
  return (
    <div
      className={cn(GLASS, "pointer-events-auto absolute inset-x-3 bottom-3 z-10 flex flex-col overflow-hidden")}
      style={{ height: minimized ? DOCK_H_MIN : DOCK_H }}
    >
      <DockHeader minimized={minimized} />
      {!minimized && (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_200px] gap-3 px-3 pb-3 md:grid-cols-[208px_minmax(0,1fr)_236px] lg:grid-cols-[208px_minmax(0,1.35fr)_minmax(0,1fr)_236px]">
          <div className="hidden h-full md:block">
            <DockVri />
          </div>
          <div className="relative min-h-0 overflow-hidden rounded-xl">
            <MicWaterfall className="h-full rounded-xl" history={225} />
            <span className="pointer-events-none absolute top-1.5 right-2 rounded-md bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white/85">
              MIC spectrogram · 15 s
            </span>
          </div>
          <div className="hidden min-h-0 flex-col gap-2 lg:flex">
            <div className="relative min-h-0 flex-1 rounded-xl border bg-background/60">
              <MicSpectrum className="h-full text-foreground" />
              <span className="pointer-events-none absolute right-2 bottom-1 font-mono text-[10px] text-muted-foreground">
                spectrum · dashed = baseline
              </span>
            </div>
            <div className="relative h-[72px] shrink-0 rounded-xl border bg-background/60">
              <VibScope className="h-full text-foreground" seconds={3} gain={1.1} />
              <span className="pointer-events-none absolute top-1 right-2 font-mono text-[10px] text-muted-foreground">
                VIB piezo · 3 s
              </span>
            </div>
          </div>
          <DockControls />
        </div>
      )}
    </div>
  )
}
