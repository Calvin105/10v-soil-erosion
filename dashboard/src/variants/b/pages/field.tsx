import {
  AudioWaveformIcon,
  BellRingIcon,
  CloudLightningIcon,
  CrosshairIcon,
  GaugeIcon,
  MicIcon,
  SirenIcon,
  TruckIcon,
  WavesIcon,
  XIcon,
} from "lucide-react"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useNetwork } from "@/data/network-sim"
import { manholes, surfaceReports, zones } from "@/data/seed"

import { envelopeOf, syntheticBands, syntheticVriSeries } from "../derive"
import { paths } from "../paths"
import {
  acknowledgeAlert,
  busyCrews,
  CREWS,
  dispatchCrew,
  endStorm,
  fmtDateTime,
  openAlertFor,
  queueConceptCalibrate,
  queueConceptPulse,
  queueSampling,
  queueSweep,
  useGame,
} from "../store"
import { KeyValue, Lifecycle, MiniBands, MiniEnvelope, RatioReadout, Stat } from "../ui/blocks"
import { VriTrend } from "../ui/charts"
import { CommandPanel, Picker, type Command } from "../ui/commands"
import { LevelLayout, Panel, TOWNSHIP_CRUMB, type Crumb } from "../ui/layout"
import { BaseMap, boundsOf, ManholeMarkers } from "../ui/maps"
import { NotFound } from "../ui/not-found"
import { ConceptTag, Num, SectionLabel, StateBadge, VriGauge, worstState } from "../ui/state"
import { Tag, Tile } from "../ui/tiles"

const FIELD_CRUMB: Crumb = { label: "Field Zones", to: paths.field }
export const SAMPLING_STEPS = [60, 30, 15, 10, 5, 2]

/* ------------------------------------------------------------------ */
/* Site: Field Zones                                                   */
/* ------------------------------------------------------------------ */

export function FieldPage() {
  const net = useNetwork()
  const navigate = useNavigate()
  const alerts = useGame((s) => s.alerts)
  const storm = useGame((s) => s.stormMode)
  const sampling = useGame((s) => s.sampling)
  const anyStorm = zones.some((z) => storm[z.id])

  const commands: Command[] = [
    {
      id: "sweep",
      hotkey: "s",
      label: "Pre-storm sweep, all zones",
      icon: CloudLightningIcon,
      mode: "sim",
      primary: true,
      hint: "Polls every node, compares against baseline and arms storm mode. Zones run in parallel.",
      run: () => zones.forEach((z) => queueSweep(z.id, z.name, "Field Zones")),
    },
    {
      id: "stand",
      hotkey: "x",
      label: "Stand down storm mode",
      icon: XIcon,
      mode: "instant",
      disabled: !anyStorm,
      reason: "No zone is in storm mode.",
      run: () => zones.filter((z) => storm[z.id]).forEach((z) => endStorm(z.id)),
    },
    {
      id: "missions",
      hotkey: "m",
      label: "Open Missions",
      icon: SirenIcon,
      mode: "nav",
      run: () => navigate(paths.missions),
    },
  ]

  return (
    <LevelLayout
      crumbs={[TOWNSHIP_CRUMB, FIELD_CRUMB]}
      level="Site"
      depthMax={4}
      title="Field Zones"
      subtitle="Three zones, ten manholes, two sensors each. Select a zone to see its manholes."
      badges={<ConceptTag />}
      commands={<CommandPanel title="Field orders" commands={commands} />}
    >
      <section className="flex flex-col gap-3">
        <SectionLabel>Select a zone</SectionLabel>
        <div className="grid gap-4 md:grid-cols-3">
          {zones.map((z, i) => {
            const nodes = net.nodes.filter((n) => n.zoneId === z.id)
            const healthy = nodes.filter((n) => n.state === "GREEN").length
            const avg = nodes.reduce((a, n) => a + n.vri, 0) / nodes.length
            const open = alerts.filter((a) => a.status !== "Closed" && nodes.some((n) => n.id === a.manholeId)).length
            return (
              <Tile
                key={z.id}
                to={paths.zone(z.id)}
                hotkey={String(i + 1)}
                dashed
                state={worstState(nodes.map((n) => n.state))}
                eyebrow={`Zone / ${nodes.length} manholes`}
                title={z.name}
                subtitle={z.description}
                metric={Math.round(avg)}
                metricLabel="mean VRI"
                bar={(healthy / nodes.length) * 100}
                barLabel="Healthy nodes"
                barRight={`${healthy}/${nodes.length}`}
                tags={
                  <>
                    {open > 0 && (
                      <Tag className="bg-red-500/15 text-red-700 dark:text-red-400">{open} open alert{open > 1 ? "s" : ""}</Tag>
                    )}
                    {storm[z.id] && <Tag>Storm mode</Tag>}
                    <Tag>every {sampling[z.id]} min</Tag>
                  </>
                }
              />
            )
          })}
        </div>
      </section>

      <Panel eyebrow="Map" title="All ten manholes" action={<ConceptTag />}>
        <BaseMap bounds={boundsOf(manholes)} className="h-96">
          <ManholeMarkers nodes={net.nodes} onSelect={(m) => navigate(paths.manhole(m))} />
        </BaseMap>
      </Panel>
    </LevelLayout>
  )
}

/* ------------------------------------------------------------------ */
/* Zone                                                                */
/* ------------------------------------------------------------------ */

export function ZoneRoute() {
  const { zoneId } = useParams()
  const zone = zones.find((z) => z.id === zoneId)
  if (!zone) return <NotFound what="zone" />
  return <ZoneView key={zone.id} zoneId={zone.id} />
}

function ZoneView({ zoneId }: { zoneId: string }) {
  const zone = zones.find((z) => z.id === zoneId)!
  const net = useNetwork()
  const alerts = useGame((s) => s.alerts)
  const storm = useGame((s) => s.stormMode)
  const sampling = useGame((s) => s.sampling)
  const navigate = useNavigate()
  const nodes = net.nodes.filter((n) => n.zoneId === zoneId)
  const [stepIdx, setStepIdx] = useState(Math.max(0, SAMPLING_STEPS.indexOf(sampling[zoneId])))

  const open = alerts.filter((a) => a.status !== "Closed" && nodes.some((n) => n.id === a.manholeId))
  const avgBat = nodes.reduce((a, n) => a + n.batteryPct, 0) / nodes.length
  const wet = nodes.filter((n) => n.wet).length
  const minutes = SAMPLING_STEPS[stepIdx]

  const commands: Command[] = [
    {
      id: "sweep",
      hotkey: "s",
      label: "Schedule pre-storm sweep",
      icon: CloudLightningIcon,
      mode: "sim",
      primary: true,
      hint: storm[zoneId]
        ? "Storm mode is armed. A sweep re-checks every node."
        : "Polls every node here, compares with baseline and arms storm mode.",
      run: () => queueSweep(zone.id, zone.name, `Zone / ${zone.name}`),
    },
    {
      id: "sampling",
      hotkey: "r",
      label: "Raise sampling rate",
      icon: GaugeIcon,
      mode: "sim",
      hint: `Now every ${sampling[zoneId]} min. Faster sampling costs battery.`,
      qty: {
        value: stepIdx,
        min: 0,
        max: SAMPLING_STEPS.length - 1,
        onChange: setStepIdx,
        format: (i) => `every ${SAMPLING_STEPS[i]} min`,
        multiplier: false,
      },
      run: () => queueSampling(zone.id, zone.name, minutes, `Zone / ${zone.name}`),
    },
    {
      id: "stand",
      hotkey: "x",
      label: "Stand down storm mode",
      icon: XIcon,
      mode: "instant",
      disabled: !storm[zoneId],
      reason: "Storm mode is not armed here.",
      run: () => endStorm(zoneId),
    },
    {
      id: "missions",
      hotkey: "m",
      label: "Open Missions",
      icon: SirenIcon,
      mode: "nav",
      run: () => navigate(paths.missions),
    },
  ]

  return (
    <LevelLayout
      crumbs={[TOWNSHIP_CRUMB, FIELD_CRUMB, { label: zone.name, to: paths.zone(zone.id) }]}
      level="Zone"
      depthMax={4}
      title={
        <span className="flex flex-wrap items-center gap-3">
          {zone.name} <StateBadge state={worstState(nodes.map((n) => n.state))} short />
        </span>
      }
      subtitle={zone.description}
      badges={
        <>
          {storm[zoneId] && <Badge>Storm mode</Badge>}
          <ConceptTag />
        </>
      }
      commands={<CommandPanel title={`${zone.name} orders`} commands={commands} />}
    >
      <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 md:grid-cols-4">
        <Stat label="Manholes" value={nodes.length} sub="2 sensors each" />
        <Stat label="Open alerts" value={open.length} />
        <Stat label="Mean battery" value={`${avgBat.toFixed(0)}%`} sub="concept estimate" />
        <Stat label="Wet nodes" value={wet} sub={`wake every ${sampling[zoneId]} min`} />
      </div>

      <section className="flex flex-col gap-3">
        <SectionLabel>Select a manhole</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          {nodes.map((m, i) => (
            <Tile
              key={m.id}
              to={paths.manhole(m)}
              hotkey={String(i + 1)}
              dashed
              state={m.state}
              eyebrow={`Manhole / ${m.asset}`}
              title={`${m.id} ${m.name}`}
              subtitle={m.road}
              metric={m.vri}
              metricLabel="VRI"
              bar={m.vri}
              barLabel={`Ring-down ${m.ringTimeRatio.toFixed(2)}x baseline`}
              barRight={`${m.batteryPct}% battery`}
              tags={
                <>
                  <Tag>
                    SF{m.spreadingFactor} {m.rssi} dBm
                  </Tag>
                  {m.wet && <Tag>WET</Tag>}
                  {openAlertFor({ alerts }, m.id) && (
                    <Tag className="bg-red-500/15 text-red-700 dark:text-red-400">{openAlertFor({ alerts }, m.id)!.status}</Tag>
                  )}
                  {m.sensors.some((s) => s.status !== "ok") && <Tag>sensor degraded</Tag>}
                </>
              }
            />
          ))}
        </div>
      </section>

      <Panel eyebrow="Map" title={zone.name} action={<ConceptTag />}>
        <BaseMap bounds={boundsOf(nodes)} className="h-72">
          <ManholeMarkers nodes={nodes} onSelect={(m) => navigate(paths.manhole(m))} permanentLabels />
        </BaseMap>
      </Panel>
    </LevelLayout>
  )
}

/* ------------------------------------------------------------------ */
/* Manhole                                                             */
/* ------------------------------------------------------------------ */

export function ManholeRoute() {
  const { zoneId, mhId } = useParams()
  const m = manholes.find((x) => x.id === mhId && x.zoneId === zoneId)
  if (!m) return <NotFound what="manhole" />
  return <ManholeView key={m.id} id={m.id} />
}

function ManholeView({ id }: { id: string }) {
  const net = useNetwork()
  const navigate = useNavigate()
  const alerts = useGame((s) => s.alerts)
  const workOrders = useGame((s) => s.workOrders)
  const queue = useGame((s) => s.queue)
  const tap = useGame((s) => s.tapResults[id])
  const rebase = useGame((s) => s.rebaselinedAt[id])
  const [cycles, setCycles] = useState(3)
  const [calSecs, setCalSecs] = useState(8)
  const [crew, setCrew] = useState<string>(CREWS[0])

  const m = net.nodes.find((n) => n.id === id)!
  const zone = zones.find((z) => z.id === m.zoneId)!
  const alert = openAlertFor({ alerts }, id)
  const busy = busyCrews({ alerts, workOrders, queue })
  const reports = surfaceReports.filter((r) => r.nearManholeId === id)
  const series = syntheticVriSeries(m)
  const bands = syntheticBands(m)
  const origin = `${m.id}`
  const ratio = tap?.[0]?.ratio ?? m.ringTimeRatio
  const vib = m.sensors.find((s) => s.kind === "vibration")!

  const dispatchReason = !alert
    ? "No open alert on this manhole."
    : alert.status === "New"
      ? "Acknowledge the alert first [A]."
      : alert.status !== "Acknowledged"
        ? `Mission is already ${alert.status}.`
        : busy.has(crew)
          ? `${crew.split(" (")[0]} is deployed. Pick another crew.`
          : undefined

  const calibrate: Command = {
    id: "calibrate",
    hotkey: "c",
    label: "Calibrate baseline",
    icon: CrosshairIcon,
    mode: "sim",
    hint: rebase ? `Last re-baselined ${fmtDateTime(new Date(rebase).toISOString())}.` : "Learn this node's healthy normal.",
    qty: { value: calSecs, min: 4, max: 20, step: 2, onChange: setCalSecs, format: (n) => `${n} s`, multiplier: false },
    run: () => queueConceptCalibrate(m, calSecs, origin),
  }
  const pulse: Command = {
    id: "pulse",
    hotkey: "p",
    label: "Run flow pulse test",
    icon: WavesIcon,
    mode: "sim",
    hint: "Flow ON/OFF N times, then measure ring-down tau.",
    qty: { value: cycles, min: 1, max: 8, onChange: setCycles, format: (n) => `${n} cycles` },
    run: () => queueConceptPulse(m, cycles, origin),
  }
  const dispatch: Command = {
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
    run: () => alert && dispatchCrew(alert.id, crew, origin),
  }
  const ack: Command = {
    id: "ack",
    hotkey: "a",
    label: "Acknowledge alert",
    icon: BellRingIcon,
    mode: "sim",
    disabled: !alert || alert.status !== "New",
    reason: !alert ? "No open alert on this manhole." : `Alert is already ${alert.status}.`,
    run: () => alert && acknowledgeAlert(alert.id, origin),
  }

  const lead = alert?.status === "New" ? ack : alert?.status === "Acknowledged" ? dispatch : pulse
  const commands: Command[] = [
    { ...lead, primary: true },
    ...[pulse, calibrate, dispatch, ack].filter((c) => c.id !== lead.id),
    {
      id: "mission",
      hotkey: "m",
      label: "Open mission",
      icon: SirenIcon,
      mode: "nav",
      disabled: !alert,
      reason: "No open mission here.",
      run: () => alert && navigate(paths.mission(alert.id)),
    },
  ]

  return (
    <LevelLayout
      crumbs={[
        TOWNSHIP_CRUMB,
        FIELD_CRUMB,
        { label: zone.name, to: paths.zone(zone.id) },
        { label: m.id, to: paths.manhole(m) },
      ]}
      level="Manhole"
      depthMax={4}
      title={
        <span className="flex flex-wrap items-center gap-3">
          {m.id} {m.name} <StateBadge state={m.state} />
        </span>
      }
      subtitle={`${m.asset} on ${m.road}. Sensor mount ${m.mountHeightM} m up the shaft.`}
      badges={<ConceptTag />}
      commands={<CommandPanel title={`${m.id} orders`} commands={commands} />}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Void Risk Index" title="Node health">
          <div className="flex items-center gap-4">
            <VriGauge vri={m.vri} state={m.state} className="max-w-44 shrink-0" />
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
              <Stat label="Battery" value={`${m.batteryPct}%`} sub="concept estimate" />
              <Stat label="Last uplink" value={`${m.lastUplinkMinAgo} min`} sub={`via ${m.gatewayId}`} />
              <Stat label="Link" value={`SF${m.spreadingFactor}`} sub={`${m.rssi} dBm / ${m.snr} dB`} />
              <Stat label="Water" value={m.wet ? "WET" : "DRY"} />
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
          <RatioReadout tauNow={8 * ratio} tauBase={8} ratio={ratio} />
          {tap?.[0] && (
            <p className="rounded-lg border p-2.5 text-sm">
              Last pulse test (simulated): <Num>{tap[0].cycles}</Num> cycles,{" "}
              <Num className="font-semibold">{tap[0].ratio.toFixed(2)}x</Num> baseline.
            </p>
          )}
        </Panel>
      </div>

      <section className="flex flex-col gap-3">
        <SectionLabel>Select a sensor</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          <Tile
            to={paths.manholeSensor(m, "vibration")}
            hotkey="1"
            dashed
            eyebrow={
              <span className="flex items-center gap-1.5">
                <AudioWaveformIcon className="size-3.5" /> Sensor / Simulated
              </span>
            }
            title="Vibration sensor"
            subtitle={vib.model}
            metric={`${ratio.toFixed(2)}x`}
            metricLabel="ring-down vs baseline"
            bar={Math.min(100, ((ratio - 1) / 2) * 100)}
            barLabel="Ring-time excess"
            barRight={`tau ${(8 * ratio).toFixed(1)} ms`}
            tags={vib.status !== "ok" ? <Tag className="bg-amber-500/15 text-amber-700 dark:text-amber-400">{vib.status}</Tag> : undefined}
          >
            <MiniEnvelope now={envelopeOf(8 * ratio, 1)} base={envelopeOf(8, 1)} />
          </Tile>
          <Tile
            to={paths.manholeSensor(m, "microphone")}
            hotkey="2"
            dashed
            eyebrow={
              <span className="flex items-center gap-1.5">
                <MicIcon className="size-3.5" /> Sensor / Simulated
              </span>
            }
            title="Microphone"
            subtitle={m.sensors.find((s) => s.kind === "microphone")!.model}
            metric={(1.9 - 0.6 * Math.max(0, Math.min(1, (m.ringTimeRatio - 1) / 1.5))).toFixed(2)}
            metricLabel="kHz resonance"
            bar={Math.min(100, Math.max(0, bands[2].now - bands[2].base) * 5)}
            barLabel="Resonance band gain"
            barRight={`${(bands[2].now - bands[2].base).toFixed(1)} dB`}
          >
            <MiniBands now={bands.map((b) => b.now)} base={bands.map((b) => b.base)} />
          </Tile>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Last 7 days" title="VRI trend">
          <VriTrend data={series} labelKey="label" />
        </Panel>
        <Panel eyebrow="Evidence" title="Linked surface reports">
          {reports.length ? (
            <ul className="flex flex-col divide-y text-sm">
              {reports.map((r) => (
                <li key={r.id} className="flex flex-col gap-0.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.category}</span>
                    <Tag>{r.relevance}</Tag>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {r.id} / {r.reporter} / {r.count} report{r.count > 1 ? "s" : ""} / {r.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No public reports near this manhole.</p>
          )}
          <KeyValue
            rows={[
              ["Planned install", m.installedOn],
              ["Risk layer score", m.riskScore.toFixed(2)],
              ["Gateway", m.gatewayId],
            ]}
          />
          <div className="h-1">
            <Progress value={m.riskScore * 100} className="h-1" />
          </div>
        </Panel>
      </div>
    </LevelLayout>
  )
}
