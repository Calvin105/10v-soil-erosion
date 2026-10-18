import { ActivityIcon, BatteryMediumIcon, MicIcon, RadioIcon } from "lucide-react"
import { useNavigate } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { alerts, gateways, manholes, zones } from "@/data/seed"
import { airtimeMs, useNetwork } from "@/data/network-sim"
import { cn } from "@/lib/utils"
import { RSSI_STATE, STATE_BG, STATE_TEXT, fmt, rssiQuality } from "../lib"
import { StatePill, Stat } from "../prototype/widgets"
import { useC } from "../store"
import { RingCompare, VriTrendChart } from "../charts"
import { ConceptTag, SheetCloseButton, SheetSection } from "../ui"

const SENSOR_STATUS: Record<string, string> = {
  ok: "bg-emerald-500 dark:bg-emerald-400",
  degraded: "bg-amber-500 dark:bg-amber-400",
  offline: "bg-red-500 dark:bg-red-400",
}

export function ManholeSheetBody({ id }: { id: string }) {
  const net = useNetwork()
  const navigate = useNavigate()
  const statuses = useC((s) => s.alertStatus)
  const base = manholes.find((m) => m.id === id)
  const node = net.nodes.find((m) => m.id === id) ?? base
  if (!node) return null
  const gw = gateways.find((g) => g.id === node.gatewayId)!
  const zone = zones.find((z) => z.id === node.zoneId)
  const q = rssiQuality(node.rssi)
  const air = airtimeMs(node.spreadingFactor)
  const history = net.uplinks.filter((u) => u.manholeId === id).slice(0, 8)
  const related = alerts.filter((a) => a.manholeId === id)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-3 border-b px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{node.id}</span>
            <StatePill state={node.state} />
            {node.wet && <Badge variant="outline">WET</Badge>}
          </div>
          <div className="mt-1 truncate text-base font-medium">{node.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {node.road} · {node.asset} · {zone?.name}
          </div>
        </div>
        <SheetCloseButton />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <ConceptTag className="self-start" />

        <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/40 p-3">
          <Stat label="VRI" value={node.vri} valueClass={cn("text-xl font-semibold", STATE_TEXT[node.state])} />
          <Stat label="Ring-time ratio" value={`${node.ringTimeRatio.toFixed(2)}x`} valueClass="text-xl" />
          <Stat label="Risk score (S3)" value={node.riskScore.toFixed(2)} valueClass="text-xl" />
        </div>

        <SheetSection title="Two sensors on this node">
          <div className="grid grid-cols-2 gap-2">
            {node.sensors.map((s) => (
              <div key={s.id} className="flex flex-col gap-1.5 rounded-xl border bg-card/60 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  {s.kind === "vibration" ? <ActivityIcon className="size-3.5" /> : <MicIcon className="size-3.5" />}
                  {s.kind === "vibration" ? "Vibration" : "Microphone"}
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                    <span className={cn("size-1.5 rounded-full", SENSOR_STATUS[s.status])} />
                    {s.status}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">{s.model}</div>
                <div className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {s.id} · {s.sampleRateHz / 1000} kHz
                </div>
              </div>
            ))}
          </div>
        </SheetSection>

        <SheetSection title="Radio link" right={<RadioIcon className="size-3.5 text-muted-foreground" />}>
          <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 rounded-xl border p-3">
            <Stat label="Gateway" value={`${gw.id} (${gw.backhaul})`} />
            <Stat label="RSSI" value={node.rssi} unit="dBm" />
            <Stat label="SNR" value={node.snr.toFixed(1)} unit="dB" />
            <Stat label="Spreading factor" value={`SF${node.spreadingFactor}`} />
            <Stat label="Airtime / uplink" value={air.toFixed(0)} unit="ms" />
            <Stat label="Last uplink" value={node.lastUplinkMinAgo === 0 ? "just now" : `${node.lastUplinkMinAgo} min`} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("size-2 rounded-full", STATE_BG[RSSI_STATE[q]])} />
            Link quality: <span className="font-medium text-foreground">{q}</span>
            {q === "poor" && <span>. A higher SF trades battery for range.</span>}
          </div>
        </SheetSection>

        <SheetSection
          title="Battery"
          right={
            <Button variant="ghost" size="xs" onClick={() => navigate("/c/network/battery")}>
              Calculator
            </Button>
          }
        >
          <div className="flex items-center gap-3 rounded-xl border p-3">
            <BatteryMediumIcon className="size-5 text-muted-foreground" />
            <Progress value={node.batteryPct} className="h-2 flex-1" />
            <span className="font-mono text-sm tabular-nums">{node.batteryPct}%</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Installed {node.installedOn}, mounted {node.mountHeightM} m up the chamber wall. Simulated reading.
          </p>
        </SheetSection>

        <SheetSection title="VRI, last 14 days (simulated)">
          <VriTrendChart id={node.id} vri={node.vri} />
        </SheetSection>

        <SheetSection title="Ring-down vs healthy baseline (illustrative)">
          <RingCompare ratio={node.ringTimeRatio} />
        </SheetSection>

        <SheetSection title="Recent uplinks">
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No uplinks received yet in this session.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border">
              {history.map((u) => (
                <li key={u.id} className="grid grid-cols-[58px_1fr_auto] items-center gap-2 px-3 py-1.5 font-mono text-[11px] tabular-nums">
                  <span className="text-muted-foreground">{fmt.time(u.at)}</span>
                  <span>
                    {u.rssi} dBm · SNR {u.snr.toFixed(1)} · SF{u.sf}
                  </span>
                  <span>VRI {u.vri}</span>
                </li>
              ))}
            </ul>
          )}
        </SheetSection>

        {related.length > 0 && (
          <SheetSection title="Alerts on this manhole">
            <div className="flex flex-col gap-1.5">
              {related.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => navigate(`/c/alerts/${a.id}`)}
                  className="flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition-colors hover:bg-muted/60"
                >
                  <span className="font-mono font-semibold">{a.id}</span>
                  <StatePill state={a.state} />
                  <span className="ml-auto text-muted-foreground">{statuses[a.id]}</span>
                </button>
              ))}
            </div>
          </SheetSection>
        )}
      </div>
    </div>
  )
}
