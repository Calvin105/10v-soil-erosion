import { useMemo, useState } from "react"
import { RotateCcwIcon } from "lucide-react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  APP_PAYLOAD_BYTES,
  DEFAULT_BATTERY,
  LORAWAN_OVERHEAD_BYTES,
  PAYLOAD_LAYOUT,
  airtimeMs,
  projectBattery,
  type BatteryInputs,
} from "@/data/network-sim"
import { cn } from "@/lib/utils"
import { Callout, ConceptTag, SheetCloseButton, SheetSection } from "../ui"

function Param({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
  hint,
}: {
  label: string
  value: number
  unit: string
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium">{label}</label>
        <span className="font-mono text-xs tabular-nums">
          {value.toLocaleString("en-GB")} <span className="text-muted-foreground">{unit}</span>
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} aria-label={label} />
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  )
}

const SHARE_TONE = ["bg-foreground", "bg-foreground/65", "bg-foreground/40", "bg-foreground/20"]

function BatteryCalc() {
  const [b, setB] = useState<BatteryInputs>(DEFAULT_BATTERY)
  const patch = (p: Partial<BatteryInputs>) => setB((x) => ({ ...x, ...p }))
  const r = useMemo(() => projectBattery(b), [b])
  const air = airtimeMs(b.sf)
  const total = r.breakdown.reduce((a, x) => a + x.mahDay, 0) || 1
  const capped = r.years >= 10
  const tone = r.years >= 5 ? "text-emerald-600 dark:text-emerald-400" : r.years >= 2 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3 rounded-xl bg-muted/40 p-4">
        <div>
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Projected life per node</div>
          <div className={cn("font-mono text-4xl leading-none font-semibold tabular-nums", tone)}>
            {capped ? "10+" : r.years.toFixed(1)}
            <span className="ml-1 text-base font-normal text-muted-foreground">years</span>
          </div>
        </div>
        <div className="text-right font-mono text-[11px] text-muted-foreground tabular-nums">
          <div>{r.mahPerDay.toFixed(2)} mAh/day</div>
          <div>{r.wakesPerDay.toFixed(0)} wakes/day</div>
          <div>airtime {air.toFixed(0)} ms</div>
        </div>
      </div>

      <Callout>
        <span className="font-medium">Concept estimate — needs a measured current profile.</span> Currents are assumed (sleep 8 uA, capture 25
        mA, TX 45 mA, 80% usable capacity, 1% per year self-discharge). Nothing here has been measured on the prototype.
      </Callout>

      <div className="flex flex-col gap-4">
        <Param label="Wake interval (calm)" value={b.wakeIntervalMin} unit="min" min={1} max={60} onChange={(v) => patch({ wakeIntervalMin: v })} />
        <Param label="Capture + DSP time per wake" value={b.captureSec} unit="s" min={1} max={30} onChange={(v) => patch({ captureSec: v })} hint="Mic FFT plus a vibration burst before sleeping again." />
        <Param label="Storm interval" value={b.stormIntervalMin} unit="min" min={1} max={15} onChange={(v) => patch({ stormIntervalMin: v })} />
        <Param label="Share of time in storm mode" value={b.stormPct} unit="%" min={0} max={50} onChange={(v) => patch({ stormPct: v })} />
        <Param label="Spreading factor" value={b.sf} unit={`SF${b.sf}`} min={7} max={12} onChange={(v) => patch({ sf: v })} hint="Higher SF reaches further but stays on air much longer." />
        <Param label="Battery capacity" value={b.capacityMah} unit="mAh" min={2000} max={30000} step={500} onChange={(v) => patch({ capacityMah: v })} />
      </div>

      <SheetSection
        title="Where the energy goes"
        right={
          <Button variant="ghost" size="xs" onClick={() => setB(DEFAULT_BATTERY)}>
            <RotateCcwIcon /> Reset
          </Button>
        }
      >
        <div className="flex h-3 overflow-hidden rounded-full bg-muted">
          {r.breakdown.map((x, i) => (
            <div key={x.name} className={SHARE_TONE[i]} style={{ width: `${(x.mahDay / total) * 100}%` }} title={x.name} />
          ))}
        </div>
        <ul className="flex flex-col gap-1.5">
          {r.breakdown.map((x, i) => (
            <li key={x.name} className="grid grid-cols-[12px_1fr_auto_44px] items-center gap-2 text-xs">
              <span className={cn("size-2.5 rounded-sm", SHARE_TONE[i])} />
              <span>{x.name}</span>
              <span className="font-mono text-muted-foreground tabular-nums">{x.mahDay.toFixed(3)} mAh/day</span>
              <span className="text-right font-mono tabular-nums">{((x.mahDay / total) * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </SheetSection>
    </div>
  )
}

function PayloadView() {
  const phy = APP_PAYLOAD_BYTES + LORAWAN_OVERHEAD_BYTES
  const stormPerHour = 30
  return (
    <div className="flex flex-col gap-5">
      <SheetSection title={`Application payload, ${APP_PAYLOAD_BYTES} bytes`}>
        <div className="grid grid-cols-11 gap-0.5">
          {Array.from({ length: APP_PAYLOAD_BYTES }, (_, i) => (
            <div key={i} className="grid h-7 place-items-center rounded-sm bg-foreground/10 font-mono text-[10px] tabular-nums">
              {i}
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left text-[11px] text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 font-medium">Byte</th>
                <th className="px-3 py-1.5 font-medium">Field</th>
                <th className="px-3 py-1.5 font-medium">Encoding</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {PAYLOAD_LAYOUT.map((p) => (
                <tr key={p.field}>
                  <td className="px-3 py-1.5 font-mono tabular-nums">{p.bytes}</td>
                  <td className="px-3 py-1.5 font-mono">{p.field}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Only a few bytes of derived result leave the node. Raw audio and vibration stay on the device, so the radio stays quiet.
          On-air frame: {APP_PAYLOAD_BYTES} B payload + {LORAWAN_OVERHEAD_BYTES} B LoRaWAN overhead = {phy} B.
        </p>
      </SheetSection>

      <SheetSection title="Time on air per spreading factor">
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left text-[11px] text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 font-medium">SF</th>
                <th className="px-3 py-1.5 text-right font-medium">Airtime</th>
                <th className="px-3 py-1.5 text-right font-medium">At {stormPerHour} uplinks/h</th>
              </tr>
            </thead>
            <tbody className="divide-y font-mono tabular-nums">
              {[7, 8, 9, 10, 11, 12].map((sf) => {
                const a = airtimeMs(sf)
                return (
                  <tr key={sf}>
                    <td className="px-3 py-1.5">SF{sf}</td>
                    <td className="px-3 py-1.5 text-right">{a.toFixed(0)} ms</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{((a * stormPerHour) / 3.6e6 * 100).toFixed(2)}% duty</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">125 kHz bandwidth, coding rate 4/5, explicit header, CRC on. Computed by the simulator.</p>
      </SheetSection>
    </div>
  )
}

export function ConceptSheetBody({ tab }: { tab: "battery" | "payload" }) {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-3 border-b px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium">Node power and payload</div>
          <div className="mt-1">
            <ConceptTag />
          </div>
        </div>
        <SheetCloseButton />
      </div>
      <Tabs value={tab} onValueChange={(v) => navigate(`/c/network/${v}`)} className="min-h-0 flex-1 gap-0">
        <div className="px-4 pt-3">
          <TabsList>
            <TabsTrigger value="battery">Battery calculator</TabsTrigger>
            <TabsTrigger value="payload">Payload and airtime</TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <TabsContent value="battery">
            <BatteryCalc />
          </TabsContent>
          <TabsContent value="payload">
            <PayloadView />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
