import type { ReactElement, ReactNode } from "react"
import {
  AudioWaveformIcon,
  CircleDotIcon,
  CrosshairIcon,
  DropletIcon,
  PlayIcon,
  RotateCcwIcon,
  SquareIcon,
  WavesIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { rig, useRig } from "@/data/rig-sim"
import { CLASS_LABELS, SCENARIOS } from "@/data/seed"
import type { ClassLabel, Scenario } from "@/data/types"
import { cn } from "@/lib/utils"

import { runDemoScript, resetRig } from "./demo-script"
import { recordForm, startRecording, useStore, type Packing } from "./store"

export function Tip({ text, children }: { text: ReactNode; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

const btn = "h-7 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5"

/** Compact rig control toolbar shared by all Prototype screens. */
export function RigToolbar({ className }: { className?: string }) {
  const s = useRig()
  const form = useStore(recordForm)
  const busy = !!s.task
  const onSerial = s.transport === "serial"

  return (
    <div
      className={cn(
        "flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b bg-background px-2 [scrollbar-width:none]",
        className
      )}
    >
      <ButtonGroup>
        <Tip text="Record 8 s of healthy (packed) soil: stores the baseline spectrum and ring-down tau.">
          <Button size="sm" variant="outline" className={btn} disabled={busy} onClick={() => rig.calibrate(8)}>
            <CrosshairIcon />
            Calibrate
          </Button>
        </Tip>
        <Tip text="Switch flow off/on 4 times. Each switch excites the pipe; the mean ring-down tau is compared with the baseline.">
          <Button
            size="sm"
            variant="outline"
            className={btn}
            disabled={busy}
            onClick={() => rig.runPulseTest(4, 1200)}
          >
            <AudioWaveformIcon />
            Pulse test
          </Button>
        </Tip>
      </ButtonGroup>

      <ButtonGroup>
        <Tip text="Toggle the pump. Every switch creates a vibration transient.">
          <Button
            size="sm"
            variant={s.flowOn ? "secondary" : "outline"}
            className={cn(btn, "w-[78px] justify-start")}
            onClick={() => rig.setFlow(!s.flowOn)}
          >
            <WavesIcon />
            Flow
            <span className="font-mono">{s.flowOn ? "ON" : "OFF"}</span>
          </Button>
        </Tip>
        <Tip text="Water at sensor mounting height (binary contact flag).">
          <Button
            size="sm"
            variant={s.wet ? "secondary" : "outline"}
            className={cn(btn, "w-[62px] justify-start")}
            onClick={() => rig.setWet(!s.wet)}
          >
            <DropletIcon />
            <span className="font-mono">{s.wet ? "WET" : "DRY"}</span>
          </Button>
        </Tip>
      </ButtonGroup>

      <ButtonGroup>
        <ButtonGroupText className="h-7 px-1.5 font-mono text-[10px] text-muted-foreground uppercase">
          Rec
        </ButtonGroupText>
        <Select value={form.label} onValueChange={(v) => recordForm.set({ label: v as ClassLabel })}>
          <SelectTrigger size="sm" className="h-7 w-[88px] text-xs" aria-label="Label">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLASS_LABELS.map((l) => (
              <SelectItem key={l} value={l} className="text-xs">
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(form.packing)}
          onValueChange={(v) => recordForm.set({ packing: Number(v) as Packing })}
        >
          <SelectTrigger size="sm" className="h-7 w-[58px] font-mono text-xs" aria-label="Packing">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3].map((p) => (
              <SelectItem key={p} value={String(p)} className="font-mono text-xs">
                P{p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(form.seconds)}
          onValueChange={(v) => recordForm.set({ seconds: Number(v) })}
        >
          <SelectTrigger size="sm" className="h-7 w-[62px] font-mono text-xs" aria-label="Duration">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 30, 60].map((sec) => (
              <SelectItem key={sec} value={String(sec)} className="font-mono text-xs">
                {sec}s
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tip text="Save mic.wav + vib.wav with this label and packing number (training data).">
          <Button
            size="sm"
            variant="outline"
            className={btn}
            disabled={busy}
            onClick={() => startRecording(form.label, form.seconds)}
          >
            <CircleDotIcon className="text-red-600 dark:text-red-400" />
            Record
          </Button>
        </Tip>
      </ButtonGroup>

      <Tip
        text={
          onSerial
            ? "Return to Wi-Fi streaming."
            : "Simulate Wi-Fi loss. The ESP32 falls back to USB serial after ~2.5 s."
        }
      >
        <Button
          size="sm"
          variant="outline"
          className={btn}
          disabled={!s.connected}
          onClick={() => (onSerial ? rig.useWifi() : rig.dropWifi())}
        >
          {onSerial ? <WifiIcon /> : <WifiOffIcon />}
          {onSerial ? "Wi-Fi" : "Drop"}
        </Button>
      </Tip>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={s.tinyMlOnDevice ? "tiny" : "laptop"}
        onValueChange={(v) => v && rig.setTinyMl(v === "tiny")}
        aria-label="Which model drives the VRI"
      >
        <ToggleGroupItem value="laptop" className="h-7 gap-1 px-2 text-xs">
          P1 RF
        </ToggleGroupItem>
        <ToggleGroupItem value="tiny" className="h-7 gap-1 px-2 text-xs">
          P2 TinyML
        </ToggleGroupItem>
      </ToggleGroup>

      {busy && (
        <Button size="sm" variant="ghost" className={btn} onClick={() => rig.cancelTask()}>
          <SquareIcon className="size-3" />
          Stop
        </Button>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1 rounded-md border border-dashed px-1 py-0.5">
        <span className="pl-0.5 font-mono text-[9px] leading-tight text-muted-foreground uppercase">
          sim
        </span>
        <Tip text="Demo / simulator control: what is physically on the bench (soil condition). Not a sensor reading.">
          <div>
            <Select value={s.scenario} onValueChange={(v) => rig.setScenario(v as Scenario)}>
              <SelectTrigger size="sm" className="h-7 w-[132px] text-xs" aria-label="Bench scenario">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENARIOS.map((sc) => (
                  <SelectItem key={sc.id} value={sc.id} className="text-xs">
                    {sc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Tip>
        <Tip text="Scripted judge demo: calibrate on packed soil, open a 250 ml void, then pulse test.">
          <Button
            size="sm"
            className={btn}
            disabled={busy}
            onClick={() => {
              toast("Demo script started", {
                description: "Calibrate packed, then 250 ml void, then flow pulse test.",
              })
              void runDemoScript()
            }}
          >
            <PlayIcon />
            Demo
          </Button>
        </Tip>
        <Tip text="Reset bench to packed, flow on, dry, and acknowledge.">
          <Button size="icon-sm" variant="ghost" className="size-7" onClick={resetRig} aria-label="Reset rig">
            <RotateCcwIcon className="size-3.5" />
          </Button>
        </Tip>
      </div>
    </div>
  )
}
