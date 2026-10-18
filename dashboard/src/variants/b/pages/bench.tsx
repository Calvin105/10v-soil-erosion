import {
  AudioWaveformIcon,
  BellRingIcon,
  CrosshairIcon,
  DropletsIcon,
  GaugeIcon,
  MicIcon,
  ScrollTextIcon,
  SirenIcon,
  TruckIcon,
  WavesIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { rig, useRig } from "@/data/rig-sim"
import { Link } from "react-router"
import { MicSpectrum, VibScope } from "@/components/viz/rig-viz"

import { benchRing, bandDbOf } from "../derive"
import { paths } from "../paths"
import {
  acknowledgeAlert,
  busyCrews,
  CREWS,
  dispatchCrew,
  escalateBench,
  fmtTime,
  openAlertFor,
  queueCalibrate,
  queuePulse,
  RIG_ID,
  useGame,
} from "../store"
import {
  ClassifierPanel,
  EventLog,
  Lifecycle,
  RatioReadout,
  RigControls,
  RigStatus,
  TaskStrip,
} from "../ui/blocks"
import { VriTrend } from "../ui/charts"
import { CommandPanel, Picker, type Command } from "../ui/commands"
import { LevelLayout, Panel, TOWNSHIP_CRUMB } from "../ui/layout"
import { LiveDot, Meter, Num, SectionLabel, StateBadge, VriGauge } from "../ui/state"
import { Tag, Tile } from "../ui/tiles"

export const BENCH_CRUMBS = [
  TOWNSHIP_CRUMB,
  { label: "Prototype Lab", to: paths.lab },
  { label: "Test Bench RIG-01", to: paths.bench },
]

export default function BenchPage() {
  const snap = useRig()
  const navigate = useNavigate()
  const alerts = useGame((s) => s.alerts)
  const workOrders = useGame((s) => s.workOrders)
  const queue = useGame((s) => s.queue)
  const [cycles, setCycles] = useState(4)
  const [calSecs, setCalSecs] = useState(8)
  const [crew, setCrew] = useState<string>(CREWS[0])

  const ring = benchRing(snap)
  const alert = openAlertFor({ alerts }, RIG_ID)
  const busy = busyCrews({ alerts, workOrders, queue })
  const hasBaseline = !!snap.baseline
  const history = useMemo(
    () => snap.vriHistory.map((h, i) => ({ i, vri: h.vri, label: fmtTime(h.t) })),
    [snap.vriHistory]
  )
  const baseBands = bandDbOf(rig.getBaselineSpectrum())
  const rigBusy = !!snap.task || queue.some((q) => !!q.rig && (q.status === "queued" || q.status === "running"))

  const acknowledge = () => {
    let id = alert?.id
    if (!id && snap.state !== "GREEN") {
      id = escalateBench(snap.vri, ring.ratio, snap.state)
      toast.info(`Mission ${id} raised from the live reading`)
    }
    const current = alerts.find((a) => a.id === id)
    if (id && (!current || current.status === "New")) acknowledgeAlert(id, "RIG-01")
    if (snap.state !== "GREEN") rig.acknowledge()
  }

  const dispatch = () => {
    if (alert) dispatchCrew(alert.id, crew, "RIG-01")
  }

  const dispatchReason = !alert
    ? "Acknowledge an alert first. The bench has no open mission."
    : alert.status === "New"
      ? "Acknowledge the alert first [A]."
      : alert.status !== "Acknowledged"
        ? `Mission is already ${alert.status}.`
        : busy.has(crew)
          ? `${crew.split(" (")[0]} is deployed. Pick another crew.`
          : undefined

  const pulse: Command = {
    id: "pulse",
    hotkey: "p",
    label: "Run flow pulse test",
    icon: WavesIcon,
    mode: "rig",
    hint: rigBusy ? "Rig is busy: this order will queue behind the running task." : "Flow ON/OFF N times, then measure ring-down tau.",
    primary: hasBaseline,
    qty: { value: cycles, min: 1, max: 8, onChange: setCycles, format: (n) => `${n} cycles` },
    run: () => queuePulse(cycles, "RIG-01"),
  }
  const calibrate: Command = {
    id: "calibrate",
    hotkey: "c",
    label: "Calibrate baseline",
    icon: CrosshairIcon,
    mode: "rig",
    hint: hasBaseline
      ? "Overwrites the healthy baseline. Only do this with packed soil."
      : "No baseline yet. Calibrate with packed soil first.",
    primary: !hasBaseline,
    qty: { value: calSecs, min: 4, max: 20, step: 2, onChange: setCalSecs, format: (n) => `${n} s`, multiplier: false },
    run: () => queueCalibrate(calSecs, "RIG-01"),
  }
  const commands: Command[] = [
    hasBaseline ? pulse : calibrate,
    hasBaseline ? calibrate : pulse,
    {
      id: "dispatch",
      hotkey: "d",
      label: "Dispatch crew",
      icon: TruckIcon,
      mode: "sim",
      disabled: !!dispatchReason,
      reason: dispatchReason,
      extra: (
        <Picker
          label="Crew"
          value={crew}
          onChange={setCrew}
          options={CREWS.map((c) => ({ value: c, label: c.split(" (")[0].replace("Contractor: ", ""), disabled: busy.has(c) }))}
        />
      ),
      run: dispatch,
    },
    {
      id: "ack",
      hotkey: "a",
      label: "Acknowledge alert",
      icon: BellRingIcon,
      mode: "instant",
      disabled: !alert && snap.state === "GREEN",
      reason: "RIG-01 is GREEN. Nothing to acknowledge.",
      run: acknowledge,
    },
    {
      id: "flow",
      hotkey: "f",
      label: snap.flowOn ? "Flow OFF" : "Flow ON",
      icon: DropletsIcon,
      mode: "instant",
      run: () => rig.setFlow(!snap.flowOn),
    },
    {
      id: "mission",
      hotkey: "m",
      label: "Open mission",
      icon: SirenIcon,
      mode: "nav",
      disabled: !alert,
      reason: "No open mission for RIG-01.",
      run: () => alert && navigate(paths.mission(alert.id)),
    },
  ]

  return (
    <LevelLayout
      crumbs={BENCH_CRUMBS}
      level="Bench"
      depth={2}
      depthMax={3}
      title={
        <span className="flex items-center gap-3">
          Test Bench RIG-01 <StateBadge state={snap.state} />
        </span>
      }
      subtitle="Compact summary. Open a sensor to see its full live view."
      badges={<RigStatus snap={snap} />}
      commands={<CommandPanel title="Bench orders" commands={commands} />}
    >
      <TaskStrip snap={snap} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel eyebrow="Void Risk Index" title="Bench health" action={<Badge variant="outline">{snap.tinyMlOnDevice ? "TinyML" : "Laptop RF"} drives VRI</Badge>}>
          <div className="flex items-center gap-4">
            <VriGauge vri={snap.vri} state={snap.state} className="max-w-44 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <Meter label="Classifier" value={snap.vriComponents.classifier} display={snap.vriComponents.classifier.toFixed(2)} />
              <Meter label="Spectrum deviation" value={snap.vriComponents.deviation} display={snap.vriComponents.deviation.toFixed(2)} />
              <Meter label="Ring-time" value={snap.vriComponents.ringTime} display={snap.vriComponents.ringTime.toFixed(2)} />
            </div>
          </div>
          {alert && (
            <Link
              to={paths.mission(alert.id)}
              className="flex flex-col gap-2 rounded-lg border-2 border-dashed p-2.5 text-sm hover:bg-muted/50"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  Mission <Num>{alert.id}</Num>
                </span>
                <Tag>{alert.priority}</Tag>
              </div>
              <Lifecycle status={alert.status} />
            </Link>
          )}
        </Panel>

        <Panel eyebrow="Key insight" title="Dull thud or hollow drum?">
          <RatioReadout tauNow={ring.tauNow} tauBase={ring.tauBase} ratio={ring.ratio} />
          {snap.lastPulse && (
            <div className="rounded-lg border p-2.5 text-sm">
              Last pulse test: <Num>{snap.lastPulse.cycles}</Num> cycles, mean tau{" "}
              <Num>{snap.lastPulse.meanTauMs.toFixed(1)} ms</Num>
              {snap.lastPulse.ratio && (
                <>
                  , <Num className="font-semibold">{snap.lastPulse.ratio.toFixed(2)}x</Num> baseline
                </>
              )}
              .
            </div>
          )}
        </Panel>
      </div>

      <section className="flex flex-col gap-3">
        <SectionLabel>Select a sensor</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          <Tile
            to={paths.benchSensor("vibration")}
            hotkey="1"
            eyebrow={
              <span className="flex items-center gap-1.5">
                <AudioWaveformIcon className="size-3.5" /> Sensor / Live
              </span>
            }
            title="Vibration sensor"
            subtitle="Analog piezo on the pipe: the rumble and the ring-down."
            metric={ring.ratio === null ? "n/a" : `${ring.ratio.toFixed(2)}x`}
            metricLabel="ring-down vs baseline"
            bar={ring.ratio === null ? 0 : Math.min(100, ((ring.ratio - 1) / 2) * 100)}
            barLabel="Ring-time excess"
            barRight={ring.tauNow ? `tau ${ring.tauNow.toFixed(1)} ms` : undefined}
            tags={
              <>
                <Tag>RMS {snap.features.vibRms.toFixed(2)}</Tag>
                <Tag>crest {snap.features.vibCrest.toFixed(1)}</Tag>
              </>
            }
          >
            <VibScope className="h-12 text-foreground" seconds={2} />
          </Tile>
          <Tile
            to={paths.benchSensor("microphone")}
            hotkey="2"
            eyebrow={
              <span className="flex items-center gap-1.5">
                <MicIcon className="size-3.5" /> Sensor / Live
              </span>
            }
            title="Microphone"
            subtitle="MEMS mic to on-device FFT: the frequency map."
            metric={(snap.features.peakHz / 1000).toFixed(2)}
            metricLabel="kHz peak"
            bar={snap.vriComponents.deviation * 100}
            barLabel="Deviation from baseline"
            barRight={snap.vriComponents.deviation.toFixed(2)}
            tags={
              <>
                <Tag>{snap.features.micRmsDb.toFixed(0)} dB</Tag>
                <Tag>centroid {(snap.features.centroidHz / 1000).toFixed(2)} kHz</Tag>
                {baseBands ? <Tag>baseline set</Tag> : <Tag>no baseline</Tag>}
              </>
            }
          >
            <MicSpectrum className="h-12 text-foreground" showBands={false} />
          </Tile>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          eyebrow="Last 150 samples"
          title="VRI history"
          action={
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LiveDot /> live
            </span>
          }
        >
          <VriTrend data={history} labelKey="label" />
          <p className="text-xs text-muted-foreground">Dashed lines mark the YELLOW (40) and RED (70) thresholds.</p>
        </Panel>
        <ClassifierPanel snap={snap} />
      </div>

      <RigControls snap={snap} />

      <EventLog snap={snap} />

      <Panel eyebrow="Reading guide" title="What the numbers mean">
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <GaugeIcon className="mt-0.5 size-4 shrink-0" />
          <p>
            Packed soil damps the pipe in about 8 ms (a dull thud). With soil washed away the pipe rings 12 to 24 ms
            (a hollow drum). The ratio against this bench&apos;s own calibrated baseline is the signal, not the raw
            number.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link to={paths.benchSensor("vibration")}>
            <ScrollTextIcon /> See the ring-down curve
          </Link>
        </Button>
      </Panel>
    </LevelLayout>
  )
}
