import { useState } from "react"
import { ArrowDownIcon, BatteryChargingIcon, CpuIcon, FileCodeIcon, ServerIcon, MonitorIcon, RadioTowerIcon } from "lucide-react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { airtimeMs } from "@/data/network-sim"
import { useNetwork } from "@/data/network-sim"
import { gateways } from "@/data/seed"
import { RSSI_STATE, STATE_BG, STATE_HEX, STATE_TEXT, fmt, rssiQuality } from "../lib"
import { ConceptTag, FloatingCard } from "../ui"
import { SectionLabel, Stat } from "../prototype/widgets"

function Tier({ icon, title, sub, className, children }: { icon: React.ReactNode; title: string; sub: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border bg-card/60 p-2.5", className)}>
      <div className="flex items-center gap-2">
        <div className="grid size-6 shrink-0 place-items-center rounded-md bg-muted">{icon}</div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-xs font-medium">{title}</div>
          <div className="truncate text-[11px] text-muted-foreground">{sub}</div>
        </div>
      </div>
      {children}
    </div>
  )
}

function Link2({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      <ArrowDownIcon className="size-3" />
      {label}
    </div>
  )
}

export function ConceptCard() {
  const net = useNetwork()
  const navigate = useNavigate()
  const nodes = net.nodes
  const avgRssi = Math.round(nodes.reduce((a, n) => a + n.rssi, 0) / nodes.length)
  const weak = nodes.filter((n) => rssiQuality(n.rssi) === "poor").length
  const degraded = nodes.filter((n) => n.sensors.some((s) => s.status !== "ok")).length
  const sensorTotal = nodes.reduce((a, n) => a + n.sensors.length, 0)
  return (
    <FloatingCard className="top-[68px] left-3 w-[320px]" style={{ maxHeight: "calc(100% - 68px - 24px)" }}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <RadioTowerIcon className="size-4" />
        <div className="text-sm font-medium">LoRaWAN production network</div>
      </div>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
        <ConceptTag className="self-start" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Not built. Everything on this map is simulated data for a design discussion: {sensorTotal} sensors on {nodes.length} manholes
          reporting over LoRaWAN to {gateways.length} gateways.
        </p>

        <div className="flex flex-col">
          <Tier
            icon={<CpuIcon className="size-3.5" />}
            title={`${nodes.length} manholes x 2 sensors`}
            sub="Piezo + MEMS mic, VRI on device"
          >
            <div className="grid grid-cols-10 gap-1">
              {nodes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  title={`${n.id} ${n.name} (${n.state}, VRI ${n.vri})`}
                  onClick={() => navigate(`/c/network/${n.id}`)}
                  className={cn("h-5 rounded-[5px] font-mono text-[9px] font-semibold text-white tabular-nums transition-transform hover:scale-110", STATE_BG[n.state])}
                >
                  {n.id.slice(3)}
                </button>
              ))}
            </div>
          </Tier>
          <Link2 label="LoRa AS923, SF7 to SF10 (11 B payload)" />
          <div className="grid grid-cols-2 gap-2">
            {gateways.map((g) => (
              <Tier
                key={g.id}
                icon={<RadioTowerIcon className="size-3.5" />}
                title={g.id}
                sub={`${g.backhaul} · ${nodes.filter((n) => n.gatewayId === g.id).length} nodes`}
              />
            ))}
          </div>
          <Link2 label="Fibre / 4G backhaul (MQTT)" />
          <Tier icon={<ServerIcon className="size-3.5" />} title="Network server" sub="Dedup, ADR, decode, store" />
          <Link2 label="API" />
          <Tier icon={<MonitorIcon className="size-3.5" />} title="This dashboard" sub="Map, alerts, work orders" />
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-muted/40 p-3">
          <Stat label="Packets last hour" value={net.packetsLastHour} />
          <Stat label="Mean RSSI" value={avgRssi} unit="dBm" />
          <Stat label="Weak links (poor)" value={weak} valueClass={weak ? STATE_TEXT.RED : undefined} />
          <Stat label="Degraded sensors" value={degraded} valueClass={degraded ? STATE_TEXT.YELLOW : undefined} />
        </div>

        <div className="flex flex-col gap-1.5">
          <SectionLabel>Link colour = RSSI</SectionLabel>
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            {(["good", "fair", "poor"] as const).map((q) => (
              <div key={q} className="flex items-center gap-1.5 rounded-lg border px-2 py-1">
                <span className="h-0 w-4 border-t-2" style={{ borderColor: STATE_HEX[RSSI_STATE[q]], borderStyle: q === "good" ? "solid" : q === "fair" ? "dashed" : "dotted" }} />
                <span className="font-mono tabular-nums">{q === "good" ? ">= -100" : q === "fair" ? ">= -110" : "< -110"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/c/network/battery")}>
            <BatteryChargingIcon /> Battery calculator
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/c/network/payload")}>
            <FileCodeIcon /> Payload layout
          </Button>
        </div>
      </div>
    </FloatingCard>
  )
}

export function UplinkFeed() {
  const net = useNetwork()
  const navigate = useNavigate()
  const [mountedAt] = useState(() => Date.now())
  return (
    <FloatingCard className="top-[68px] right-3 w-[340px]" style={{ maxHeight: "calc(100% - 68px - 120px)" }}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <div className="text-sm font-medium">Live uplinks</div>
        <ConceptTag className="ml-auto" />
      </div>
      <ul className="flex min-h-0 flex-col divide-y overflow-y-auto">
        {net.uplinks.slice(0, 16).map((u) => {
          const q = rssiQuality(u.rssi)
          const fresh = u.at > mountedAt
          return (
            <li key={u.id} className={cn(fresh && "vc-row-new")}>
              <button
                type="button"
                onClick={() => navigate(`/c/network/${u.manholeId}`)}
                className="grid w-full grid-cols-[58px_1fr_auto] items-center gap-x-2 gap-y-0.5 px-4 py-2 text-left transition-colors hover:bg-muted/60"
              >
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{fmt.time(u.at)}</span>
                <span className="truncate text-xs">
                  <span className="font-mono font-semibold">{u.manholeId}</span>
                  <span className="text-muted-foreground"> to </span>
                  <span className="font-mono">{u.gatewayId}</span>
                </span>
                <span className={cn("font-mono text-xs font-semibold tabular-nums", u.vri >= 70 ? STATE_TEXT.RED : u.vri >= 40 ? STATE_TEXT.YELLOW : STATE_TEXT.GREEN)}>
                  VRI {u.vri}
                </span>
                <span />
                <span className="col-span-2 flex flex-wrap items-center gap-x-2.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <span className={cn("size-1.5 rounded-full", STATE_BG[RSSI_STATE[q]])} />
                    {u.rssi} dBm
                  </span>
                  <span>SNR {u.snr.toFixed(1)}</span>
                  <span>SF{u.sf}</span>
                  <span>{u.airtimeMs.toFixed(0)} ms</span>
                  <span>fcnt {u.fcnt}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Airtime at SF7 / SF10: <span className="font-mono tabular-nums">{airtimeMs(7).toFixed(0)} / {airtimeMs(10).toFixed(0)} ms</span> for a 24 B frame
      </div>
    </FloatingCard>
  )
}
