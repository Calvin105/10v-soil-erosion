import {
  ActivityIcon,
  FileDownIcon,
  LayersIcon,
  MapPinnedIcon,
  RadioTowerIcon,
  SirenIcon,
  FlaskConicalIcon,
} from "lucide-react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { useNetwork } from "@/data/network-sim"
import { useRig } from "@/data/rig-sim"
import { gateways, riskLayers, zones } from "@/data/seed"

import { paths } from "../paths"
import {
  downloadText,
  fmtDateTime,
  LIFECYCLE,
  missionProgress,
  queueHealthCheck,
  useGame,
  useLaneBusy,
} from "../store"
import { Stat } from "../ui/blocks"
import { CommandPanel, type Command } from "../ui/commands"
import { LevelLayout, Panel, TOWNSHIP_CRUMB } from "../ui/layout"
import { BaseMap, boundsOf, ManholeMarkers } from "../ui/maps"
import { ConceptTag, LiveDot, SectionLabel, worstState } from "../ui/state"
import { Tag, Tile } from "../ui/tiles"

export default function TownshipPage() {
  const snap = useRig()
  const net = useNetwork()
  const navigate = useNavigate()
  const alerts = useGame((s) => s.alerts)
  const workOrders = useGame((s) => s.workOrders)
  const lastHealth = useGame((s) => s.lastHealth)
  const riskOn = useGame((s) => s.riskOn)
  const healthBusy = useLaneBusy("township")

  const open = alerts.filter((a) => a.status !== "Closed")
  const nodes = net.nodes
  const worst = worstState(nodes.map((n) => n.state))
  const healthy = nodes.filter((n) => n.state === "GREEN").length
  const online = nodes.filter((n) => n.lastUplinkMinAgo < 60).length
  const missionPct =
    open.length === 0
      ? 100
      : (open.reduce((a, x) => a + missionProgress({ workOrders }, x), 0) / open.length) * 100
  const worstOpen = worstState(open.map((a) => a.state))
  const layersOn = riskLayers.filter((l) => riskOn[l.id] !== false).length

  const exportReport = () => {
    const date = new Date().toISOString().slice(0, 10)
    const lines = [
      `Subsurface Sentinel - daily report ${date}`,
      "",
      "PROTOTYPE (live rig, simulated stream)",
      `  RIG-01 state ${snap.state}, VRI ${snap.vri}, scenario ${snap.scenario}`,
      `  Baseline tau: ${snap.baseline ? snap.baseline.tauMs.toFixed(1) + " ms" : "not calibrated"}`,
      "",
      "FIELD CONCEPT (simulated, not built)",
      ...nodes.map((n) => `  ${n.id} ${n.name}: ${n.state} VRI ${n.vri}, ratio ${n.ringTimeRatio.toFixed(2)}x, battery ${n.batteryPct}%`),
      "",
      "MISSIONS",
      ...alerts.map((a) => `  ${a.id} ${a.manholeId} ${a.priority} ${a.status}: ${a.summary}`),
    ]
    const file = `sentinel-daily-${date}.txt`
    downloadText(file, lines.join("\n"))
    toast.success("Daily report exported", { description: `${file} (${lines.length} lines)` })
  }

  const commands: Command[] = [
    {
      id: "health",
      hotkey: "h",
      label: "Run network health check",
      icon: ActivityIcon,
      mode: "sim",
      primary: true,
      hint: "Polls all 10 concept nodes and both gateways, then reports the weakest link.",
      disabled: healthBusy,
      reason: "A health check is already running.",
      run: () => queueHealthCheck("Township"),
    },
    {
      id: "report",
      hotkey: "e",
      label: "Export daily report",
      icon: FileDownIcon,
      mode: "instant",
      run: exportReport,
    },
    {
      id: "risk",
      hotkey: "r",
      label: "Open Risk Intel",
      icon: LayersIcon,
      mode: "nav",
      run: () => navigate(paths.risk),
    },
  ]

  return (
    <LevelLayout
      crumbs={[TOWNSHIP_CRUMB]}
      level="Township"
      depthMax={4}
      title="City of Elmina"
      subtitle="Choose a site to command. The prototype lab is live; field zones and the network are a simulated concept."
      badges={
        <>
          <Badge variant="outline" className="gap-1.5">
            <LiveDot /> Lab LIVE
          </Badge>
          <ConceptTag />
        </>
      }
      commands={<CommandPanel title="Township orders" commands={commands} />}
    >
      <section className="flex flex-col gap-3">
        <SectionLabel>Select a site</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          <Tile
            to={paths.lab}
            hotkey="1"
            state={snap.state}
            eyebrow={
              <span className="flex items-center gap-1.5">
                <LiveDot /> Site / Live prototype
              </span>
            }
            title="Prototype Lab"
            subtitle="Test Bench RIG-01: PVC pipe in soil, ESP32 with a microphone and a vibration sensor."
            metric={snap.vri}
            metricLabel="VRI now"
            bar={snap.vri}
            barLabel="Void Risk Index"
            barRight={`${snap.state}`}
            tags={
              <>
                <Tag>{snap.transport === "wifi" ? "Wi-Fi" : "Serial"} {snap.fps} fps</Tag>
                <Tag>{snap.baseline ? "Baseline set" : "No baseline"}</Tag>
                <Tag>{snap.tinyMlOnDevice ? "TinyML" : "Laptop RF"}</Tag>
              </>
            }
          />
          <Tile
            to={paths.field}
            hotkey="2"
            dashed
            state={worst}
            eyebrow="Site / Concept, simulated"
            title="Field Zones"
            subtitle={zones.map((z) => z.name).join(", ")}
            metric={nodes.length}
            metricLabel="manholes x 2 sensors"
            bar={(healthy / nodes.length) * 100}
            barLabel="Healthy nodes"
            barRight={`${healthy}/${nodes.length}`}
            tags={
              <>
                {nodes.some((n) => n.state === "RED") && (
                  <Tag className="bg-red-500/15 text-red-700 dark:text-red-400">
                    {nodes.filter((n) => n.state === "RED").length} RED
                  </Tag>
                )}
                <Tag className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                  {nodes.filter((n) => n.state === "YELLOW").length} YELLOW
                </Tag>
                <Tag>{online} online</Tag>
              </>
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>Operations</SectionLabel>
        <div className="grid gap-4 md:grid-cols-3">
          <Tile
            to={paths.network}
            hotkey="3"
            dashed
            eyebrow="Network / Concept"
            title="LoRaWAN Network"
            subtitle="Topology, uplinks, payload and the battery planner."
            metric={gateways.length}
            metricLabel="gateways"
            bar={(online / nodes.length) * 100}
            barLabel="Nodes reporting"
            barRight={`${online}/${nodes.length}`}
          />
          <Tile
            to={paths.risk}
            hotkey="4"
            dashed
            eyebrow="Risk Intel / S3 mock"
            title="Risk Intel"
            subtitle="Layers that say where to look before a sensor says so."
            metric={layersOn}
            metricLabel={`of ${riskLayers.length} layers on`}
            bar={(layersOn / riskLayers.length) * 100}
            barLabel="Layers enabled"
            barRight={`${layersOn}/${riskLayers.length}`}
          />
          <Tile
            to={paths.missions}
            hotkey="5"
            state={open.length ? worstOpen : undefined}
            eyebrow="Missions / Seed data"
            title="Missions"
            subtitle="Alerts become missions with work-order steps."
            metric={open.length}
            metricLabel="open"
            bar={missionPct}
            barLabel="Open mission progress"
            barRight={`${Math.round(missionPct)}%`}
            tags={
              <>
                <Tag>
                  <SirenIcon className="size-3" /> {open.filter((a) => a.priority === "P1").length} at P1
                </Tag>
                <Tag>{LIFECYCLE.length} stages</Tag>
              </>
            }
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel
          eyebrow="Township map"
          title="Where the sensors are"
          action={<ConceptTag />}
        >
          <BaseMap bounds={boundsOf(nodes)} className="h-80">
            <ManholeMarkers nodes={nodes} onSelect={(m) => navigate(paths.manhole(m))} />
          </BaseMap>
          <p className="text-xs text-muted-foreground">
            Marker colour is the node state. Click a marker to jump straight to that manhole.
            The physical bench has no map position.
          </p>
        </Panel>

        <Panel eyebrow="Last order" title="Network health check">
          {lastHealth ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Healthy" value={`${lastHealth.ok}/${lastHealth.total}`} sub="nodes" />
                <Stat label="Checked" value={fmtDateTime(new Date(lastHealth.at).toISOString())} />
              </div>
              <div className="flex items-start gap-2 rounded-lg border p-2.5 text-sm">
                <RadioTowerIcon className="mt-0.5 size-4 shrink-0" />
                <span>
                  Weakest link <span className="font-mono">{lastHealth.weakest}</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-start gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <MapPinnedIcon className="size-5" />
              No check yet. Press <span className="font-mono">H</span> or use the primary order to poll the
              network.
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-sm">
            {gateways.map((g) => (
              <div key={g.id} className="rounded-lg bg-muted/60 p-2">
                <div className="font-mono text-xs">{g.id}</div>
                <div className="text-xs text-muted-foreground">{g.backhaul}</div>
              </div>
            ))}
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="flex items-center gap-1 text-xs">
                <FlaskConicalIcon className="size-3" /> RIG-01
              </div>
              <div className="text-xs text-muted-foreground">{snap.connected ? "Live" : "Offline"}</div>
            </div>
          </div>
        </Panel>
      </div>
    </LevelLayout>
  )
}
