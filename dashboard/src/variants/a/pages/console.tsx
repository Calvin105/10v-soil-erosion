import { useEffect, useState, type ReactNode } from "react"
import {
  ActivityIcon,
  AudioWaveformIcon,
  BrainCircuitIcon,
  ChartSplineIcon,
  CheckCheckIcon,
  CrosshairIcon,
  GaugeIcon,
  ListChecksIcon,
  MicIcon,
  ScrollTextIcon,
  SigmaIcon,
} from "lucide-react"
import { useSearchParams } from "react-router"

import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { rig, useRig, type RigSnapshot } from "@/data/rig-sim"
import { MicSpectrum, MicWaterfall, VibScope } from "@/components/viz/rig-viz"
import { cn } from "@/lib/utils"

import { runDemoScript } from "../demo-script"
import { RigToolbar } from "../rig-toolbar"
import { Num, Pane, STATE, StatePill, zoneOf } from "../ui"
import { ProbCompare } from "../widgets/ml"
import { EventLog, TaskStatus } from "../widgets/rig-status"
import { DbAxis, FeatureTable, FreqAxis, RingDownChart, RingReadout } from "../widgets/signal"
import { VriGauge, VriTrend } from "../widgets/vri"

function Gutter() {
  return (
    <ResizableHandle className="w-1.5 bg-transparent transition-colors hover:bg-foreground/10 aria-[orientation=horizontal]:h-1.5 aria-[orientation=horizontal]:w-full" />
  )
}

const CMAPS = ["inferno", "viridis", "mono"] as const

export function weightsOf(s: RigSnapshot) {
  const hasRing = !!(s.baseline && (s.lastPulse || s.lastTransient))
  return hasRing ? { c: 0.4, d: 0.3, r: 0.3 } : s.baseline ? { c: 0.57, d: 0.43, r: 0 } : { c: 1, d: 0, r: 0 }
}

export function VriComponents({ s }: { s: RigSnapshot }) {
  const w = weightsOf(s)
  const rows = [
    { k: "Classifier", hint: "P(void) + 0.5 P(leak)", v: s.vriComponents.classifier, w: w.c },
    { k: "Baseline deviation", hint: "max band delta / 20 dB", v: s.vriComponents.deviation, w: w.d },
    { k: "Ring-time ratio", hint: "(tau/tau0 - 1) / 2", v: s.vriComponents.ringTime, w: w.r },
  ]
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r) => (
        <div key={r.k} className="grid grid-cols-[1fr_34px_30px] items-center gap-x-2" title={r.hint}>
          <div className="min-w-0">
            <div className="flex justify-between text-[10.5px] leading-tight">
              <span className={cn("truncate", r.w === 0 && "text-muted-foreground line-through")}>{r.k}</span>
              <span className="font-mono text-[10px] text-muted-foreground">w {r.w.toFixed(2)}</span>
            </div>
            <div className="relative mt-0.5 h-1 rounded-full bg-muted">
              <div
                className={cn("absolute inset-y-0 left-0 rounded-full", r.w === 0 ? "bg-foreground/25" : "bg-foreground/80")}
                style={{ width: `${Math.min(1, r.v) * 100}%` }}
              />
            </div>
          </div>
          <Num className="text-right text-[10.5px]">{r.v.toFixed(2)}</Num>
          <Num className="text-right text-[10.5px] text-muted-foreground">+{Math.round(r.v * r.w * 100)}</Num>
        </div>
      ))}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="pointer-events-auto flex items-center gap-2 rounded-md border bg-background/90 px-2.5 py-1.5 text-[11px] shadow-sm backdrop-blur">
        {children}
      </div>
    </div>
  )
}

export function LiveConsole() {
  const s = useRig()
  const [params] = useSearchParams()
  const [cmap, setCmap] = useState<(typeof CMAPS)[number]>("inferno")
  const [gain, setGain] = useState(1)
  const zone = zoneOf(s.vri)
  const drives = s.tinyMlOnDevice ? "P2 TinyML (ESP32)" : "P1 RF (laptop)"

  useEffect(() => {
    if (params.get("demo") === "1") void runDemoScript(true)
  }, [params])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RigToolbar />
      <div className="min-h-0 flex-1 p-1.5">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize="70%" minSize="45%">
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel defaultSize="36%" minSize="20%">
                <ResizablePanelGroup orientation="horizontal">
                  <ResizablePanel defaultSize="52%" minSize="25%">
                    <Pane
                      title="MIC spectrogram"
                      icon={MicIcon}
                      meta="0-8 kHz / 15 fps / 15 s"
                      actions={
                        <Button
                          size="xs"
                          variant="ghost"
                          className="h-5 px-1.5 font-mono text-[10px]"
                          onClick={() => setCmap(CMAPS[(CMAPS.indexOf(cmap) + 1) % CMAPS.length])}
                        >
                          {cmap}
                        </Button>
                      }
                      bodyClassName="p-1"
                    >
                      <MicWaterfall className="h-full rounded-sm" colormap={cmap} />
                    </Pane>
                  </ResizablePanel>
                  <Gutter />
                  <ResizablePanel defaultSize="48%" minSize="25%">
                    <Pane
                      title="MIC spectrum"
                      icon={ChartSplineIcon}
                      meta={`peak ${(s.features.peakHz / 1000).toFixed(2)} kHz`}
                      actions={
                        <span className="flex items-center gap-2 font-mono text-[9.5px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="h-0.5 w-3 bg-foreground" />
                            live
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-3 border-t border-dashed border-foreground/60" />
                            {s.baseline ? "baseline" : "no baseline"}
                          </span>
                        </span>
                      }
                      bodyClassName="flex flex-col gap-0.5 p-1.5"
                    >
                      <div className="relative min-h-0 flex-1 pl-7">
                        <DbAxis />
                        <MicSpectrum className="h-full text-foreground" />
                      </div>
                      <FreqAxis className="pl-7" />
                    </Pane>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
              <Gutter />
              <ResizablePanel defaultSize="33%" minSize="20%">
                <ResizablePanelGroup orientation="horizontal">
                  <ResizablePanel defaultSize="52%" minSize="25%">
                    <Pane
                      title="VIB scope"
                      icon={ActivityIcon}
                      meta={`2 kHz / 3 s / rms ${s.features.vibRms.toFixed(3)}`}
                      actions={
                        <>
                          <span
                            className={cn(
                              "rounded-sm border px-1 font-mono text-[9.5px]",
                              s.flowOn ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            FLOW {s.flowOn ? "ON" : "OFF"}
                          </span>
                          <Button
                            size="xs"
                            variant="ghost"
                            className="h-5 px-1.5 font-mono text-[10px]"
                            onClick={() => setGain(gain === 1 ? 2 : gain === 2 ? 4 : 1)}
                          >
                            x{gain}
                          </Button>
                        </>
                      }
                      bodyClassName="p-1.5"
                    >
                      <div className="relative h-full">
                        <VibScope className="h-full text-foreground" seconds={3} gain={gain} />
                        <span className="absolute bottom-0 left-0 font-mono text-[9px] text-muted-foreground">-3 s</span>
                        <span className="absolute right-0 bottom-0 font-mono text-[9px] text-muted-foreground">now</span>
                      </div>
                    </Pane>
                  </ResizablePanel>
                  <Gutter />
                  <ResizablePanel defaultSize="48%" minSize="25%">
                    <Pane
                      title="Ring-down"
                      icon={AudioWaveformIcon}
                      meta="dull thud vs hollow drum"
                      actions={
                        <span className="flex items-center gap-2 font-mono text-[9.5px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="h-0.5 w-3 bg-foreground" />
                            now
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-3 border-t border-dashed border-muted-foreground" />
                            baseline
                          </span>
                        </span>
                      }
                      bodyClassName="flex flex-col gap-1 p-1.5"
                    >
                      <div className="relative min-h-0 flex-1">
                        <RingDownChart transient={s.lastTransient} baseline={s.baseline} />
                        {!s.baseline ? (
                          <Empty>
                            <span className="text-muted-foreground">No healthy baseline yet.</span>
                            <Button size="xs" variant="outline" disabled={!!s.task} onClick={() => rig.calibrate(8)}>
                              <CrosshairIcon />
                              Calibrate
                            </Button>
                          </Empty>
                        ) : !s.lastTransient ? (
                          <Empty>
                            <span className="text-muted-foreground">No transient yet.</span>
                            <Button size="xs" variant="outline" disabled={!!s.task} onClick={() => rig.runPulseTest(4, 1200)}>
                              <AudioWaveformIcon />
                              Pulse test
                            </Button>
                          </Empty>
                        ) : null}
                      </div>
                      <RingReadout s={s} />
                    </Pane>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
              <Gutter />
              <ResizablePanel defaultSize="31%" minSize="18%">
                <ResizablePanelGroup orientation="horizontal">
                  <ResizablePanel defaultSize="52%" minSize="25%">
                    <Pane title="Features" icon={SigmaIcon} meta="input vector, 5 Hz">
                      <FeatureTable s={s} />
                    </Pane>
                  </ResizablePanel>
                  <Gutter />
                  <ResizablePanel defaultSize="48%" minSize="25%">
                    <Pane title="Event log" icon={ScrollTextIcon} meta={`${s.events.length} events`} bodyClassName="p-0 pl-2 pt-1">
                      <EventLog events={s.events} />
                    </Pane>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <Gutter />

          <ResizablePanel defaultSize="30%" minSize="22%">
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel defaultSize="47%" minSize="30%">
                <Pane
                  title="Void Risk Index"
                  icon={GaugeIcon}
                  meta="N=3 windows"
                  actions={
                    <span className="rounded-sm border border-dashed px-1 font-mono text-[9px] text-muted-foreground">
                      DEMO TIME
                    </span>
                  }
                  bodyClassName="flex flex-col gap-2"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] items-center gap-2">
                    <div className="relative">
                      <VriGauge vri={s.vri} />
                      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
                        <Num className={cn("text-[28px] leading-none font-semibold", STATE[zone].text)}>
                          {s.vri}
                        </Num>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-1.5">
                      <StatePill state={s.state} className="h-6 text-xs" />
                      <div className="text-[10.5px] leading-snug text-muted-foreground">
                        Driven by <span className="font-medium text-foreground">{drives}</span>
                      </div>
                      {s.state !== "GREEN" && (
                        <Button size="xs" variant="outline" onClick={() => rig.acknowledge()}>
                          <CheckCheckIcon />
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>
                  <VriComponents s={s} />
                  <VriTrend history={s.vriHistory} className="min-h-0 flex-1" />
                </Pane>
              </ResizablePanel>
              <Gutter />
              <ResizablePanel defaultSize="27%" minSize="18%">
                <Pane title="Classifier" icon={BrainCircuitIcon} meta="P1 laptop vs P2 TinyML">
                  <ProbCompare s={s} dense />
                </Pane>
              </ResizablePanel>
              <Gutter />
              <ResizablePanel defaultSize="26%" minSize="16%">
                <Pane title="Tasks & rig" icon={ListChecksIcon} meta={s.task ? "running" : "idle"}>
                  <TaskStatus s={s} />
                </Pane>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
