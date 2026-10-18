import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { CircleIcon, CrosshairIcon, MapIcon, WavesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { MicSpectrum, MicWaterfall, VibScope } from "@/components/viz/rig-viz"
import { rig, useRig } from "@/data/rig-sim"
import { doseResponse, models } from "@/data/seed"
import { cn } from "@/lib/utils"
import { STATE_HEX, STATE_TEXT } from "../lib"
import { TransportChip } from "./dock"
import { ConnectionControls, ScenarioSelect } from "./side-cards"
import {
  DatasetGrid,
  EventLog,
  FeatureGrid,
  InferenceToggle,
  ModelCardView,
  ProbBars,
  RecordForm,
  RingDownChart,
  RingStats,
  SectionLabel,
  StatePill,
  TaskBar,
  VriGauge,
  VriSparkline,
  ringNumbers,
  ringVerdict,
} from "./widgets"

function Panel({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-2xl border bg-card/70 p-4", className)}>
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </section>
  )
}

function DoseResponse() {
  const s = useRig()
  const { ratio } = ringNumbers(s)
  const config = { ringRatio: { label: "Ring-time ratio", color: "var(--foreground)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-36 w-full">
      <LineChart data={doseResponse} margin={{ top: 8, right: 24, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="voidMl" tickFormatter={(v) => `${v} ml`} tickLine={false} axisLine={false} fontSize={10} />
        <YAxis domain={[0, 3.2]} tickFormatter={(v) => `${v}x`} tickLine={false} axisLine={false} fontSize={10} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ReferenceLine y={1.3} stroke={STATE_HEX.YELLOW} strokeDasharray="3 3" strokeOpacity={0.8} />
        <ReferenceLine y={1.8} stroke={STATE_HEX.RED} strokeDasharray="3 3" strokeOpacity={0.8} />
        {ratio && <ReferenceLine y={ratio} stroke="var(--foreground)" strokeDasharray="1 3" label={{ value: `now ${ratio.toFixed(2)}x`, position: "insideTopLeft", fontSize: 10, fill: "var(--foreground)" }} />}
        <Line dataKey="ringRatio" type="monotone" stroke="var(--color-ringRatio)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  )
}

function LabControls() {
  const s = useRig()
  const busy = !!s.task
  return (
    <div className="flex flex-col gap-3">
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
        <Button variant={s.flowOn ? "secondary" : "outline"} disabled={s.task?.kind === "pulse"} onClick={() => rig.setFlow(!s.flowOn)} aria-pressed={s.flowOn}>
          Flow {s.flowOn ? "ON" : "OFF"}
        </Button>
        <div className="flex items-center justify-between gap-2 rounded-lg border px-2.5">
          <Label htmlFor="vc-lab-wet" className="text-xs font-normal">
            WET
          </Label>
          <Switch id="vc-lab-wet" size="sm" checked={s.wet} onCheckedChange={(v) => rig.setWet(v)} />
        </div>
      </div>
      {s.task ? (
        <TaskBar task={s.task} />
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {s.baseline ? `Baseline tau ${s.baseline.tauMs.toFixed(1)} ms saved ${new Date(s.baseline.at).toLocaleTimeString("en-GB")}` : "No baseline yet. Calibrate with packed soil first."}
        </p>
      )}
      <div className="flex flex-col gap-1.5 rounded-xl border border-dashed p-3">
        <SectionLabel>Demo control · what is on the bench</SectionLabel>
        <ScenarioSelect />
      </div>
    </div>
  )
}

export function LabSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useRig()
  const tiny = models.find((m) => m.id === "tinyml-cnn")!
  const laptop = models.find((m) => m.id === "laptop-rf")!
  const comps = s.vriComponents
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto h-[92svh]! max-h-[92svh]! max-w-[1360px]! gap-0! rounded-t-3xl! border-x bg-background/95! p-0! backdrop-blur-xl"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Lab view</SheetTitle>
          <SheetDescription>Live signals, ML insight, dataset progress and controls for the prototype test bench</SheetDescription>
        </SheetHeader>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-3">
          <div className="mx-auto absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/30" aria-hidden />
          <div className="mt-1 flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-foreground text-background">
              <WavesIcon className="size-4" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-medium">Lab view · Test bench</div>
              <div className="text-xs text-muted-foreground">PVC pipe in soil · ESP32 with microphone + piezo vibration</div>
            </div>
          </div>
          <TransportChip />
          <div className="mt-1 ml-auto flex items-center gap-4">
            <VriSparkline history={s.vriHistory} className="hidden h-8 w-40 md:block" />
            <div className="flex items-center gap-2">
              <span className="text-[11px] tracking-wide text-muted-foreground uppercase">VRI</span>
              <span className={cn("font-mono text-3xl leading-none font-semibold tabular-nums", STATE_TEXT[s.state])}>{s.vri}</span>
              <StatePill state={s.state} />
            </div>
            <SheetClose asChild>
              <Button variant="outline" size="sm">
                <MapIcon /> Back to map
              </Button>
            </SheetClose>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {/* live signals */}
          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
            <div className="relative h-56 overflow-hidden rounded-2xl">
              <MicWaterfall className="h-full rounded-2xl" history={300} />
              <span className="pointer-events-none absolute top-2 right-3 rounded-md bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white/85">
                MIC spectrogram · 20 s · 0 to 8 kHz
              </span>
            </div>
            <div className="grid h-56 grid-rows-2 gap-3">
              <div className="relative rounded-2xl border bg-card/70">
                <MicSpectrum className="h-full text-foreground" />
                <span className="pointer-events-none absolute top-1.5 right-3 font-mono text-[10px] text-muted-foreground">spectrum · dashed = baseline</span>
              </div>
              <div className="relative rounded-2xl border bg-card/70">
                <VibScope className="h-full text-foreground" seconds={3} gain={1.1} />
                <span className="pointer-events-none absolute top-1.5 right-3 font-mono text-[10px] text-muted-foreground">VIB piezo · 3 s</span>
              </div>
            </div>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-3">
            {/* column 1 */}
            <div className="flex flex-col gap-4">
              <Panel title="Ring-down: thud or drum?" sub={ringVerdict(s)}>
                <RingDownChart snap={s} className="h-44" />
                <RingStats snap={s} />
                {s.lastPulse && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2 font-mono text-[11px] text-muted-foreground tabular-nums">
                    Last pulse test: {s.lastPulse.taus.length} transients, mean {s.lastPulse.meanTauMs.toFixed(1)} ms
                    {s.lastPulse.ratio ? ` (${s.lastPulse.ratio.toFixed(2)}x baseline)` : ""}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Packed soil rings out in about 8 ms (dull thud). A void lets the pipe ring 12 to 24 ms (hollow drum).
                </p>
              </Panel>
              <Panel title="Calibration curve" sub="Ring-time ratio against washed-out soil volume from bench tests">
                <DoseResponse />
              </Panel>
              <Panel title="Features">
                <FeatureGrid snap={s} />
              </Panel>
            </div>

            {/* column 2 */}
            <div className="flex flex-col gap-4">
              <Panel title="ML insight" sub="Both models see the same features. Pick which one drives the VRI.">
                <InferenceToggle tiny={s.tinyMlOnDevice} />
                <ProbBars laptop={s.laptopProbs} tiny={s.tinyProbs} tinyDrives={s.tinyMlOnDevice} />
                <div className="flex items-center gap-4 rounded-xl bg-muted/40 p-3">
                  <VriGauge vri={s.vri} state={s.state} caption="Void Risk Index" className="w-28 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {(
                      [
                        ["Classifier", comps.classifier],
                        ["Baseline deviation", comps.deviation],
                        ["Ring time", comps.ringTime],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[96px_1fr_28px] items-center gap-2 text-[11px]">
                        <span className="truncate text-muted-foreground">{k}</span>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-foreground/70 transition-[width] duration-200" style={{ width: `${Math.min(100, v * 100)}%` }} />
                        </div>
                        <span className="text-right font-mono tabular-nums">{Math.round(v * 100)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
              <ModelCardView model={laptop} live={s.laptopProbs} active={!s.tinyMlOnDevice} />
              <ModelCardView model={tiny} live={s.tinyProbs} active={s.tinyMlOnDevice} />
            </div>

            {/* column 3 */}
            <div className="flex flex-col gap-4">
              <Panel title="Bench controls">
                <ConnectionControls />
                <LabControls />
              </Panel>
              <Panel title="Dataset" sub="Seed clips plus anything recorded in this session">
                <DatasetGrid recordings={s.recordings} compact />
              </Panel>
              <Panel title="Record and label a clip">
                <RecordForm scenario={s.scenario} busy={!!s.task} />
                {s.recordings.length > 0 && (
                  <ul className="flex flex-col gap-1 text-xs">
                    {s.recordings.slice(0, 4).map((r) => (
                      <li key={r.at} className="flex items-center gap-2">
                        <CircleIcon className="size-2.5 fill-red-500 text-red-500" />
                        <span>{r.label}</span>
                        <span className="font-mono text-muted-foreground tabular-nums">{r.seconds} s</span>
                        <span className="ml-auto font-mono text-muted-foreground tabular-nums">{new Date(r.at).toLocaleTimeString("en-GB")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="Event log">
                <EventLog events={s.events} limit={14} />
              </Panel>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
