import {
  ActivityIcon,
  CircleDotIcon,
  CpuIcon,
  CrosshairIcon,
  RadioIcon,
  SquareActivityIcon,
  VideoIcon,
  WavesIcon,
} from "lucide-react"
import { useState } from "react"
import { useParams } from "react-router"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { MicSpectrum, MicWaterfall, VibScope } from "@/components/viz/rig-viz"
import { useNetwork } from "@/data/network-sim"
import { BANDS, rig, useRig, VIB_RATE_HZ } from "@/data/rig-sim"
import { CLASS_LABELS, manholes, zones } from "@/data/seed"
import type { ClassLabel, Manhole } from "@/data/types"

import {
  bandDbOf,
  benchRing,
  envelopeOf,
  scenarioToLabel,
  syntheticBands,
  syntheticVriSeries,
} from "../derive"
import { paths, SENSOR_LABEL, type SensorKind } from "../paths"
import {
  fmtTime,
  queueCalibrate,
  queueConceptCalibrate,
  queueConceptPulse,
  queueConceptRecord,
  queuePulse,
  queueRecordings,
  queueSelfTest,
  queueStreamRaw,
  setGame,
  setTinyMlNode,
  useGame,
  type Packing,
} from "../store"
import { BENCH_CRUMBS } from "./bench"
import { ClassifierPanel, KeyValue, MiniBands, RatioReadout, RigStatus, Stat } from "../ui/blocks"
import { BandChart, RingDownChart, VriTrend } from "../ui/charts"
import { CommandPanel, Picker, type Command } from "../ui/commands"
import { LevelLayout, Panel, TOWNSHIP_CRUMB, type Crumb } from "../ui/layout"
import { ConceptTag, LiveDot, Num, StateBadge } from "../ui/state"
import { NotFound } from "../ui/not-found"

type Target = { kind: "bench" } | { kind: "node"; m: Manhole }

export function isSensorKind(v: string | undefined): v is SensorKind {
  return v === "vibration" || v === "microphone"
}

/* ------------------------------------------------------------------ */

export function BenchSensorRoute() {
  const { sensor } = useParams()
  if (!isSensorKind(sensor)) return <NotFound what="sensor" />
  return <SensorView key={`bench-${sensor}`} target={{ kind: "bench" }} sensor={sensor} />
}

export function NodeSensorRoute() {
  const { zoneId, mhId, sensor } = useParams()
  const m = manholes.find((x) => x.id === mhId && x.zoneId === zoneId)
  if (!m || !isSensorKind(sensor)) return <NotFound what="sensor" />
  return <SensorView key={`${m.id}-${sensor}`} target={{ kind: "node", m }} sensor={sensor} />
}

/* ------------------------------------------------------------------ */

const normalise = (e: number[] | null | undefined) => (e ? e.map((v) => v / (e[0] || 1)) : null)

function TauBars({ taus, base }: { taus: number[]; base: number | null }) {
  const max = Math.max(30, ...taus, base ?? 0)
  return (
    <div className="flex flex-col gap-1.5">
      {taus.map((t, i) => (
        <div key={i} className="grid grid-cols-[28px_1fr_56px] items-center gap-2 text-xs">
          <span className="text-muted-foreground">#{i + 1}</span>
          <div className="relative h-3 rounded-sm bg-muted">
            <div className="h-full rounded-sm bg-foreground/80" style={{ width: `${(t / max) * 100}%` }} />
            {base !== null && (
              <div
                className="absolute inset-y-[-3px] w-0.5 bg-foreground"
                style={{ left: `${(base / max) * 100}%` }}
                title={`Baseline ${base.toFixed(1)} ms`}
              />
            )}
          </div>
          <Num className="text-right">{t.toFixed(1)} ms</Num>
        </div>
      ))}
      {base !== null && (
        <div className="text-[11px] text-muted-foreground">Vertical tick = baseline tau {base.toFixed(1)} ms</div>
      )}
    </div>
  )
}

const specConfig = {
  now: { label: "Now", color: "var(--foreground)" },
  base: { label: "Baseline", color: "var(--muted-foreground)" },
} satisfies ChartConfig

const g = (x: number, mu: number, s: number) => Math.exp(-(((x - mu) / s) ** 2))

function SyntheticSpectrum({ m }: { m: Manhole }) {
  const sev = Math.max(0, Math.min(1, (m.ringTimeRatio - 1) / 1.5))
  const f0 = 1900 - 600 * sev
  const data = Array.from({ length: 64 }, (_, i) => {
    const f = i * 125
    const wob = Math.sin(i * 12.9898 + m.vri) * 1.4
    const base = -98 + 46 * g(f, 90, 140) + 18 * g(f, 450, 600) + 18 * g(f, 1900, 90) * 0.2 + wob
    const now = base + 38 * sev * g(f, f0, 90) + 20 * sev * g(f, 2 * f0, 120) + (m.wet ? 6 * g(f, 300, 3000) : 0)
    return { khz: f / 1000, base, now }
  })
  return (
    <ChartContainer config={specConfig} className="aspect-auto h-52 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis dataKey="khz" type="number" domain={[0, 8]} ticks={[0, 2, 4, 6, 8]} tickFormatter={(v) => `${v} kHz`} tickLine={false} axisLine={false} />
        <YAxis domain={[-110, -30]} hide />
        <Area dataKey="base" stroke="var(--color-base)" strokeDasharray="5 4" fill="none" strokeWidth={1.5} isAnimationActive={false} dot={false} />
        <Area dataKey="now" stroke="var(--color-now)" fill="var(--color-now)" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} dot={false} />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  )
}

/* ------------------------------------------------------------------ */

function SensorView({ target, sensor }: { target: Target; sensor: SensorKind }) {
  const snap = useRig()
  const net = useNetwork()
  const selfTests = useGame((s) => s.selfTests)
  const tapResults = useGame((s) => s.tapResults)
  const queue = useGame((s) => s.queue)
  const tinyNodes = useGame((s) => s.tinyMlNodes)
  const benchPacking = useGame((s) => s.benchPacking)

  const isBench = target.kind === "bench"
  const node = target.kind === "node" ? (net.nodes.find((n) => n.id === target.m.id) ?? target.m) : null
  const idKey = isBench ? `RIG-01/${sensor}` : `${node!.id}/${sensor}`
  const origin = isBench ? `RIG-01 / ${SENSOR_LABEL[sensor]}` : `${node!.id} / ${SENSOR_LABEL[sensor]}`

  const [label, setLabel] = useState<ClassLabel>(scenarioToLabel(snap.scenario))
  const [clips, setClips] = useState(2)
  const [clipSecs, setClipSecs] = useState(5)
  const [cycles, setCycles] = useState(3)
  const [calSecs, setCalSecs] = useState(8)

  const streaming = queue.some((q) => q.lane === idKey && q.title.startsWith("Stream raw") && (q.status === "queued" || q.status === "running"))
  const tiny = isBench ? snap.tinyMlOnDevice : !!tinyNodes[node!.id]
  const selfAt = selfTests[idKey]
  const rigLabel = scenarioToLabel(snap.scenario)

  const record: Command = {
    id: "record",
    hotkey: "r",
    label: isBench ? "Record & label clip" : "Capture & label clip",
    icon: VideoIcon,
    mode: isBench ? "rig" : "sim",
    primary: true,
    hint:
      isBench && label !== rigLabel
        ? `Rig is set to "${rigLabel}" but this clip will be labelled "${label}". Mislabelled clips poison training.`
        : isBench
          ? `Saves mic.wav + vib.wav, ${clipSecs} s each, into packing #${benchPacking}.`
          : "Simulated: concept nodes do not feed the prototype dataset.",
    qty: { value: clips, min: 1, max: 8, onChange: setClips, format: (n) => `${n} clips` },
    extra: (
      <div className="flex flex-col gap-2">
        <Picker
          label="Label"
          value={label}
          onChange={setLabel}
          options={CLASS_LABELS.map((l) => ({ value: l, label: l }))}
        />
        <div className="grid grid-cols-2 gap-2">
          {isBench && (
            <Picker
              label="Soil packing #"
              value={benchPacking}
              onChange={(v) => setGame({ benchPacking: v as Packing })}
              options={[1, 2, 3].map((p) => ({ value: p, label: `#${p}` }))}
            />
          )}
          <Picker
            label="Clip length"
            value={clipSecs}
            onChange={setClipSecs}
            options={[5, 10].map((s) => ({ value: s, label: `${s} s` }))}
          />
        </div>
      </div>
    ),
    run: () =>
      isBench
        ? queueRecordings(label, clipSecs, clips, benchPacking, origin)
        : queueConceptRecord(idKey, label, clips, clipSecs, origin),
  }

  const second: Command =
    sensor === "vibration"
      ? {
          id: "pulse",
          hotkey: "p",
          label: "Run flow pulse test",
          icon: WavesIcon,
          mode: isBench ? "rig" : "sim",
          hint: "Flow ON/OFF N times, then measure ring-down tau.",
          qty: { value: cycles, min: 1, max: 8, onChange: setCycles, format: (n) => `${n} cycles` },
          run: () => (isBench ? queuePulse(cycles, origin) : queueConceptPulse(node!, cycles, origin)),
        }
      : {
          id: "calibrate",
          hotkey: "c",
          label: "Calibrate baseline",
          icon: CrosshairIcon,
          mode: isBench ? "rig" : "sim",
          hint: "Learns this node's own normal spectrum. Do it on healthy soil only.",
          qty: { value: calSecs, min: 4, max: 20, step: 2, onChange: setCalSecs, format: (n) => `${n} s`, multiplier: false },
          run: () => (isBench ? queueCalibrate(calSecs, origin) : queueConceptCalibrate(node!, calSecs, origin)),
        }

  const commands: Command[] = [
    record,
    second,
    {
      id: "selftest",
      hotkey: "t",
      label: "Run self-test",
      icon: SquareActivityIcon,
      mode: "sim",
      hint: "Checks noise floor, clipping and bias.",
      run: () => queueSelfTest(idKey, SENSOR_LABEL[sensor], origin),
    },
    {
      id: "stream",
      hotkey: "s",
      label: "Stream raw",
      icon: RadioIcon,
      mode: "sim",
      disabled: streaming,
      reason: "Raw stream already running.",
      run: () => queueStreamRaw(idKey, SENSOR_LABEL[sensor], origin),
    },
    {
      id: "tiny",
      hotkey: "m",
      label: tiny ? "TinyML: ON device" : "TinyML: OFF device",
      icon: CpuIcon,
      mode: isBench ? "rig" : "sim",
      hint: "Toggle which model runs on the ESP32.",
      run: () => (isBench ? rig.setTinyMl(!snap.tinyMlOnDevice) : setTinyMlNode(node!.id, !tiny)),
    },
  ]

  /* ---------- crumbs ---------- */
  let crumbs: Crumb[]
  let depth: number
  let depthMax: number
  if (isBench) {
    crumbs = [...BENCH_CRUMBS, { label: SENSOR_LABEL[sensor], to: paths.benchSensor(sensor) }]
    depth = 3
    depthMax = 3
  } else {
    const m = node!
    const zone = zones.find((z) => z.id === m.zoneId)!
    crumbs = [
      TOWNSHIP_CRUMB,
      { label: "Field Zones", to: paths.field },
      { label: zone.name, to: paths.zone(zone.id) },
      { label: m.id, to: paths.manhole(m) },
      { label: SENSOR_LABEL[sensor], to: paths.manholeSensor(m, sensor) },
    ]
    depth = 4
    depthMax = 4
  }

  const info = isBench
    ? {
        id: `RIG-01-${sensor === "vibration" ? "VIB" : "MIC"}`,
        model: sensor === "vibration" ? "Piezo vibration (analog)" : "PDM MEMS mic (FFT on device)",
        rate: sensor === "vibration" ? VIB_RATE_HZ : 16000,
        status: "ok" as const,
      }
    : (() => {
        const s = node!.sensors.find((x) => x.kind === sensor)!
        return { id: s.id, model: s.model, rate: s.sampleRateHz, status: s.status }
      })()

  const ring = isBench
    ? benchRing(snap)
    : { tauNow: 8 * node!.ringTimeRatio, tauBase: 8, ratio: node!.ringTimeRatio }
  const state = isBench ? snap.state : node!.state
  const vri = isBench ? snap.vri : node!.vri

  /* ---------- panels ---------- */
  const sensorCard = (
    <Panel eyebrow="Sensor card" title={info.id}>
      <KeyValue
        rows={[
          ["Part", info.model],
          ["Sample rate", `${info.rate.toLocaleString()} Hz`],
          ["Status", <span key="s" className={info.status === "ok" ? "" : "text-amber-700 dark:text-amber-400"}>{info.status}</span>],
          ["Last self-test", selfAt ? fmtTime(selfAt) : "never"],
          ["Inference", tiny ? "TinyML on ESP32" : "Laptop / server"],
        ]}
      />
      {streaming && (
        <Badge variant="outline" className="w-fit gap-1.5">
          <CircleDotIcon className="text-red-500" /> RAW STREAM
        </Badge>
      )}
    </Panel>
  )

  const visuals =
    sensor === "vibration" ? (
      isBench ? (
        <>
          <Panel
            eyebrow="Live"
            title="Vibration waveform"
            action={
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LiveDot /> flow {snap.flowOn ? "ON" : "OFF"}
              </span>
            }
          >
            <VibScope className="h-44 text-foreground" seconds={3} />
            <p className="text-xs text-muted-foreground">
              Switching the flow ON or OFF makes the pipe ring. How long the ring lasts is tau.
            </p>
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel eyebrow="Last transient" title="Ring-down: now vs baseline">
              <div className="relative">
                <RingDownChart
                  now={normalise(snap.lastTransient?.envelope)}
                  base={normalise(snap.baseline?.envelope)}
                  className="h-44"
                />
                {!snap.lastTransient && (
                  <p className="pointer-events-none absolute inset-x-0 top-12 text-center text-sm text-muted-foreground">
                    No transient yet. Switch the flow or queue a pulse test.
                  </p>
                )}
              </div>
            </Panel>
            <Panel eyebrow="Key insight" title="Dull thud or hollow drum?">
              <RatioReadout tauNow={ring.tauNow} tauBase={ring.tauBase} ratio={ring.ratio} />
            </Panel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel eyebrow="Features" title="Vibration features">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="RMS" value={snap.features.vibRms.toFixed(3)} />
                <Stat label="Crest factor" value={snap.features.vibCrest.toFixed(1)} />
                <Stat label="Ring f0" value={snap.lastTransient ? `${snap.lastTransient.f0Hz.toFixed(0)} Hz` : "-"} />
                <Stat label="Transient peak" value={snap.lastTransient ? snap.lastTransient.peak.toFixed(2) : "-"} />
              </div>
            </Panel>
            <Panel eyebrow="Pulse test" title={snap.lastPulse ? `${snap.lastPulse.cycles} cycles measured` : "Pulse test results"}>
              {snap.lastPulse ? (
                <TauBars taus={snap.lastPulse.taus} base={snap.lastPulse.baselineTauMs} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No pulse test yet. Queue one with <span className="font-mono">P</span>.
                </p>
              )}
            </Panel>
          </div>
        </>
      ) : (
        <>
          <Panel eyebrow="Simulated snapshot" title="Last captured transient" action={<ConceptTag />}>
            <RingDownChart now={envelopeOf(8 * node!.ringTimeRatio, 1)} base={envelopeOf(8, 1)} className="h-52" />
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel eyebrow="Key insight" title="Dull thud or hollow drum?">
              <RatioReadout tauNow={ring.tauNow} tauBase={ring.tauBase} ratio={ring.ratio} />
            </Panel>
            <Panel eyebrow="Last 7 days" title="VRI trend">
              <VriTrend data={syntheticVriSeries(node!)} labelKey="label" />
            </Panel>
          </div>
          <Panel eyebrow="Pulse tests" title="Results from this session">
            {(tapResults[node!.id] ?? []).length ? (
              <ul className="flex flex-col divide-y text-sm">
                {tapResults[node!.id].map((t) => (
                  <li key={t.at} className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">
                      {fmtTime(t.at)} / {t.cycles} cycles
                    </span>
                    <Num>{t.ratio.toFixed(2)}x baseline</Num>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                None yet. Queue a simulated pulse test with <span className="font-mono">P</span>.
              </p>
            )}
          </Panel>
        </>
      )
    ) : isBench ? (
      <MicLive />
    ) : (
      <>
        <Panel eyebrow="Simulated snapshot" title="Last spectrum snapshot" action={<ConceptTag />}>
          <SyntheticSpectrum m={node!} />
          <p className="text-xs text-muted-foreground">
            A hollow void shifts and strengthens the pipe resonance (around 1.9 kHz down towards 1.3 kHz).
          </p>
        </Panel>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel eyebrow="Bands" title="Band energy: now vs baseline">
            <BandChart data={syntheticBands(node!).map((b) => ({ band: b.band, now: b.now, base: b.base }))} />
          </Panel>
          <Panel eyebrow="Features" title="Microphone features">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Wet flag" value={node!.wet ? "WET" : "DRY"} />
              <Stat label="Resonance" value={`${(1900 - 600 * Math.max(0, Math.min(1, (node!.ringTimeRatio - 1) / 1.5))).toFixed(0)} Hz`} />
              <Stat label="Last uplink" value={`${node!.lastUplinkMinAgo} min`} sub="ago" />
              <Stat label="SF / RSSI" value={`SF${node!.spreadingFactor} / ${node!.rssi}`} />
            </div>
            <MiniBands now={syntheticBands(node!).map((b) => b.now)} base={syntheticBands(node!).map((b) => b.base)} />
          </Panel>
        </div>
      </>
    )

  return (
    <LevelLayout
      crumbs={crumbs}
      level="Sensor"
      depth={depth}
      depthMax={depthMax}
      title={
        <span className="flex flex-wrap items-center gap-3">
          {SENSOR_LABEL[sensor]} <StateBadge state={state} short />
        </span>
      }
      subtitle={
        <>
          {isBench ? "Test Bench RIG-01" : `${node!.id} ${node!.name}`} / VRI <Num>{vri}</Num>
          {sensor === "vibration" ? " / the pipe's rumble" : " / the frequency map"}
        </>
      }
      badges={isBench ? <RigStatus snap={snap} /> : <ConceptTag />}
      commands={<CommandPanel title={`${SENSOR_LABEL[sensor]} orders`} commands={commands} />}
    >
      {visuals}
      <div className="grid gap-4 lg:grid-cols-2">
        {sensorCard}
        {isBench && sensor === "microphone" ? <ClassifierPanel snap={snap} /> : (
          <Panel eyebrow="Reading" title="How to read this">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <ActivityIcon className="mt-0.5 size-4 shrink-0" />
              {sensor === "vibration"
                ? "Compare the solid line (now) with the dashed baseline. A longer tail means the soil no longer damps the pipe."
                : "The bright band near 1 to 2 kHz is the pipe's resonance. A void makes it louder and moves it down."}
            </p>
          </Panel>
        )}
      </div>
    </LevelLayout>
  )
}

function MicLive() {
  const snap = useRig()
  const bandNow = snap.features.bandDb
  const bandBase = bandDbOf(rig.getBaselineSpectrum())
  return (
    <>
      <Panel
        eyebrow="Live"
        title="Microphone spectrogram"
        action={
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LiveDot /> 8 kHz, 20 s window
          </span>
        }
      >
        <MicWaterfall className="h-56" />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Live" title="Spectrum vs baseline">
          <MicSpectrum className="h-44 text-foreground" />
          <p className="text-xs text-muted-foreground">
            {rig.getBaselineSpectrum() ? "Dashed line is the calibrated healthy baseline." : "No baseline yet. Calibrate to draw the dashed healthy spectrum."}
          </p>
        </Panel>
        <Panel eyebrow="Bands" title="Band energy: now vs baseline">
          <BandChart
            data={BANDS.map((b, i) => ({ band: b.label, now: bandNow[i], base: bandBase ? bandBase[i] : null }))}
          />
        </Panel>
      </div>
      <Panel eyebrow="Features" title="Microphone features">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Level" value={`${snap.features.micRmsDb.toFixed(0)} dB`} />
          <Stat label="Centroid" value={`${(snap.features.centroidHz / 1000).toFixed(2)} kHz`} />
          <Stat label="Peak" value={`${(snap.features.peakHz / 1000).toFixed(2)} kHz`} />
          <Stat label="Deviation" value={snap.vriComponents.deviation.toFixed(2)} sub="vs baseline" />
        </div>
      </Panel>
    </>
  )
}
