import { ChevronRightIcon, CpuIcon, UsbIcon, WifiIcon, WifiOffIcon } from "lucide-react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { rig, useRig } from "@/data/rig-sim"
import { SCENARIOS } from "@/data/seed"
import type { Scenario } from "@/data/types"
import { cn } from "@/lib/utils"
import { GLASS } from "../lib"
import {
  EventLog,
  InferenceToggle,
  ProbBars,
  RingDownChart,
  RingStats,
  SectionLabel,
  ringVerdict,
} from "./widgets"

export function ScenarioSelect({ className }: { className?: string }) {
  const s = useRig()
  return (
    <Select
      value={s.scenario}
      onValueChange={(v) => {
        rig.setScenario(v as Scenario)
        toast(`Bench scenario: ${SCENARIOS.find((x) => x.id === v)?.label}`)
      }}
    >
      <SelectTrigger className={cn("w-full", className)} size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SCENARIOS.map((sc) => (
          <SelectItem key={sc.id} value={sc.id}>
            {sc.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ConnectionControls() {
  const s = useRig()
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs">
        {!s.connected ? (
          <WifiOffIcon className="size-4 text-amber-600 dark:text-amber-400" />
        ) : s.transport === "wifi" ? (
          <WifiIcon className="size-4" />
        ) : (
          <UsbIcon className="size-4" />
        )}
        <div className="leading-tight">
          <div className="font-medium">
            {!s.connected ? "Wi-Fi lost" : s.transport === "wifi" ? "Streaming over Wi-Fi" : "USB serial fallback"}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground tabular-nums">
            seq {s.seq} · {s.connected ? `${s.fps} fps` : "switching..."}
          </div>
        </div>
      </div>
      {s.transport === "wifi" ? (
        <Button
          size="xs"
          variant="outline"
          disabled={!s.connected}
          onClick={() => {
            rig.dropWifi()
            toast.warning("Simulating Wi-Fi drop. The bench falls back to USB serial.")
          }}
        >
          Drop Wi-Fi
        </Button>
      ) : (
        <Button size="xs" variant="outline" onClick={() => rig.useWifi()}>
          Back to Wi-Fi
        </Button>
      )}
    </div>
  )
}

export function BenchCard({ bottom }: { bottom: number }) {
  const s = useRig()
  return (
    <aside
      className={cn(GLASS, "pointer-events-auto absolute top-[76px] left-3 z-10 flex w-[300px] flex-col overflow-hidden")}
      style={{ maxHeight: `calc(100% - 76px - ${bottom + 12}px)` }}
    >
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <CpuIcon className="size-4" />
        <div className="text-sm font-medium">Prototype rig</div>
        <span className="ml-auto rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold tracking-wide text-background">
          BUILT
        </span>
      </div>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          PVC pipe in soil, one ESP32, two sensors: microphone (FFT) and a piezo on the pipe.
        </p>
        <ConnectionControls />
        <Separator />
        <div className="flex flex-col gap-2">
          <SectionLabel>Inference drives the VRI</SectionLabel>
          <InferenceToggle tiny={s.tinyMlOnDevice} />
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-dashed p-3">
          <SectionLabel>Simulator · what is on the bench</SectionLabel>
          <ScenarioSelect />
          <p className="text-[11px] text-muted-foreground">{SCENARIOS.find((x) => x.id === s.scenario)?.hint}</p>
          <div className="flex items-center justify-between">
            <Label htmlFor="vc-wet" className="text-xs font-normal">
              Water at sensor height (WET)
            </Label>
            <Switch id="vc-wet" size="sm" checked={s.wet} onCheckedChange={(v) => rig.setWet(v)} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <SectionLabel>Event log</SectionLabel>
          <EventLog events={s.events} limit={6} dense />
        </div>
      </div>
    </aside>
  )
}

export function InsightCard({ bottom }: { bottom: number }) {
  const s = useRig()
  const navigate = useNavigate()
  return (
    <aside
      className={cn(GLASS, "pointer-events-auto absolute top-[76px] right-3 z-10 flex w-[320px] flex-col overflow-hidden")}
      style={{ maxHeight: `calc(100% - 76px - ${bottom + 12}px)` }}
    >
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Ring-down: thud or drum?</div>
            <span className="font-mono text-[10px] text-muted-foreground">VIB envelope</span>
          </div>
          <p className="text-xs text-muted-foreground">{ringVerdict(s)}</p>
        </div>
        <RingDownChart snap={s} className="h-32" />
        <RingStats snap={s} />
        {s.lastPulse && (
          <div className="rounded-lg bg-muted/50 px-3 py-2 font-mono text-[11px] text-muted-foreground tabular-nums">
            Last pulse test: {s.lastPulse.taus.length} transients, mean {s.lastPulse.meanTauMs.toFixed(1)} ms
            {s.lastPulse.ratio ? ` (${s.lastPulse.ratio.toFixed(2)}x)` : ""}
          </div>
        )}
        <Separator />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Classifier</div>
            <span className="text-[11px] text-muted-foreground">live probabilities</span>
          </div>
          <ProbBars laptop={s.laptopProbs} tiny={s.tinyProbs} tinyDrives={s.tinyMlOnDevice} compact />
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/c/prototype/lab")}>
          ML models, dataset and full detail <ChevronRightIcon />
        </Button>
      </div>
    </aside>
  )
}
