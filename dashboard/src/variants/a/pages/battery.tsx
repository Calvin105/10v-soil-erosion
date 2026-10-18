import { useMemo, useState } from "react"
import {
  BatteryMediumIcon,
  ChartColumnIcon,
  ChartSplineIcon,
  InfoIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  ZapIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Slider } from "@/components/ui/slider"
import { DEFAULT_BATTERY, airtimeMs, projectBattery, useNetwork, type BatteryInputs } from "@/data/network-sim"
import { cn } from "@/lib/utils"

import { ConceptBanner, Meter, Num, Pane, STATE, Stat, Tag } from "../ui"
import type { NodeState } from "@/data/types"

const CAVEAT = "Concept estimate — needs a measured current profile"

const PRESETS: { id: string; label: string; patch: Partial<BatteryInputs>; hint: string }[] = [
  { id: "default", label: "Default", patch: DEFAULT_BATTERY, hint: "15 min wake, 5 s capture, SF7" },
  {
    id: "hourly",
    label: "Hourly",
    patch: { wakeIntervalMin: 60, captureSec: 5, stormPct: 5, sf: 7 },
    hint: "60 min wake, storm 5%",
  },
  {
    id: "stress",
    label: "Stress",
    patch: { wakeIntervalMin: 5, captureSec: 15, stormPct: 30, sf: 10 },
    hint: "5 min wake, 15 s, SF10, storm 30%",
  },
]

function yearsState(y: number): NodeState {
  return y >= 5 ? "GREEN" : y >= 2 ? "YELLOW" : "RED"
}

function Param({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
  note,
}: {
  label: string
  value: number
  unit: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  note?: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px]">{label}</span>
        <Num className="text-xs font-semibold">
          {value.toLocaleString("en-US")}
          <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{unit}</span>
        </Num>
      </div>
      <Slider className="my-1.5" min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0])} aria-label={label} />
      <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
        <span>{min.toLocaleString("en-US")}</span>
        {note && <span>{note}</span>}
        <span>{max.toLocaleString("en-US")}</span>
      </div>
    </div>
  )
}

const breakdownConfig = {
  mahDay: { label: "mAh / day", color: "var(--foreground)" },
} satisfies ChartConfig

const lifeConfig = {
  years: { label: "Years", color: "var(--foreground)" },
} satisfies ChartConfig

const WAKES = [5, 10, 15, 20, 30, 45, 60, 90, 120]

export function BatteryPage() {
  const [inputs, setInputs] = useState<BatteryInputs>(DEFAULT_BATTERY)
  const { nodes } = useNetwork()
  const set = (patch: Partial<BatteryInputs>) => setInputs((b) => ({ ...b, ...patch }))
  const r = useMemo(() => projectBattery(inputs), [inputs])

  // Recover the model constants from the breakdown so this page never drifts from network-sim.ts.
  const consts = useMemo(() => {
    const air = airtimeMs(inputs.sf) / 1000
    return {
      sleepUa: (r.breakdown[2].mahDay / 24) * 1000,
      captureMa: (r.breakdown[0].mahDay * 3600) / (r.wakesPerDay * inputs.captureSec),
      txMa: (r.breakdown[1].mahDay * 3600) / (r.wakesPerDay * air),
      selfPctYr: (r.breakdown[3].mahDay * 365 * 100) / inputs.capacityMah,
    }
  }, [r, inputs])

  const totalDay = r.breakdown.reduce((a, b) => a + b.mahDay, 0)
  const meanUa = (r.mahPerDay / 24) * 1000
  const air = airtimeMs(inputs.sf)
  const st = yearsState(r.years)
  const capped = r.years >= 10

  const breakdownData = r.breakdown.map((b) => ({
    name: b.name,
    mahDay: Math.round(b.mahDay * 10000) / 10000,
    share: b.mahDay / totalDay,
  }))
  const wakeData = useMemo(
    () => WAKES.map((w) => ({ wake: w, years: Math.round(projectBattery({ ...inputs, wakeIntervalMin: w }).years * 100) / 100 })),
    [inputs]
  )
  const sfData = useMemo(
    () =>
      [7, 8, 9, 10].map((sf) => ({
        sf: `SF${sf}`,
        n: sf,
        years: Math.round(projectBattery({ ...inputs, sf }).years * 100) / 100,
        air: Math.round(airtimeMs(sf)),
      })),
    [inputs]
  )
  const sortedNodes = [...nodes].sort((a, b) => a.batteryPct - b.batteryPct)

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 p-1.5">
      <ConceptBanner>{CAVEAT}.</ConceptBanner>
      <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_270px] gap-1.5">
        {/* inputs */}
        <Pane
          title="Calculator inputs"
          icon={SlidersHorizontalIcon}
          meta="per node"
          actions={
            <Button size="icon-xs" variant="ghost" onClick={() => setInputs(DEFAULT_BATTERY)} aria-label="Reset inputs">
              <RotateCcwIcon />
            </Button>
          }
          bodyClassName="flex flex-col gap-3 overflow-y-auto p-2.5"
        >
          <Param
            label="Wake interval (normal)"
            value={inputs.wakeIntervalMin}
            unit="min"
            min={5}
            max={120}
            step={5}
            onChange={(v) => set({ wakeIntervalMin: v })}
          />
          <Param
            label="Capture length"
            value={inputs.captureSec}
            unit="s"
            min={1}
            max={30}
            step={1}
            onChange={(v) => set({ captureSec: v })}
            note="mic + vib + DSP"
          />
          <Param
            label="Storm-mode interval"
            value={inputs.stormIntervalMin}
            unit="min"
            min={1}
            max={15}
            step={1}
            onChange={(v) => set({ stormIntervalMin: v })}
          />
          <Param
            label="Time in storm mode"
            value={inputs.stormPct}
            unit="%"
            min={0}
            max={50}
            step={1}
            onChange={(v) => set({ stormPct: v })}
          />
          <Param
            label="Spreading factor"
            value={inputs.sf}
            unit={`SF / ${air.toFixed(0)} ms`}
            min={7}
            max={10}
            step={1}
            onChange={(v) => set({ sf: v })}
            note="time on air"
          />
          <Param
            label="Battery capacity"
            value={inputs.capacityMah}
            unit="mAh"
            min={2000}
            max={30000}
            step={500}
            onChange={(v) => set({ capacityMah: v })}
          />
          <div className="border-t pt-2">
            <div className="mb-1 text-[9px] tracking-wider text-muted-foreground uppercase">Presets compared</div>
            <div className="flex flex-col gap-1">
              {PRESETS.map((p) => {
                const pr = projectBattery({ ...DEFAULT_BATTERY, ...p.patch })
                const active = (Object.keys(DEFAULT_BATTERY) as (keyof BatteryInputs)[]).every(
                  (k) => inputs[k] === ({ ...DEFAULT_BATTERY, ...p.patch })[k]
                )
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setInputs({ ...DEFAULT_BATTERY, ...p.patch })}
                    className={cn(
                      "grid grid-cols-[1fr_auto] items-center gap-x-2 rounded-sm border px-2 py-1 text-left transition-colors hover:bg-muted/50",
                      active && "border-foreground/60 bg-muted/50"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-[11px] leading-tight font-medium">{p.label}</span>
                      <span className="block truncate text-[10px] leading-tight text-muted-foreground">{p.hint}</span>
                    </span>
                    <Num className={cn("text-sm font-semibold", STATE[yearsState(pr.years)].text)}>
                      {pr.years.toFixed(1)}
                      <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">y</span>
                    </Num>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mt-auto border-t pt-2">
            <div className="mb-1 text-[9px] tracking-wider text-muted-foreground uppercase">Model constants</div>
            <dl className="grid grid-cols-2 gap-x-3 font-mono text-[10.5px] leading-5">
              <dt className="text-muted-foreground">Deep sleep</dt>
              <dd className="text-right tabular-nums">{consts.sleepUa.toFixed(0)} uA</dd>
              <dt className="text-muted-foreground">Capture + DSP</dt>
              <dd className="text-right tabular-nums">{consts.captureMa.toFixed(0)} mA</dd>
              <dt className="text-muted-foreground">LoRa TX</dt>
              <dd className="text-right tabular-nums">{consts.txMa.toFixed(0)} mA</dd>
              <dt className="text-muted-foreground">Self-discharge</dt>
              <dd className="text-right tabular-nums">{consts.selfPctYr.toFixed(1)} %/yr</dd>
              <dt className="text-muted-foreground">Usable / cap</dt>
              <dd className="text-right tabular-nums">80% / 10 y</dd>
            </dl>
          </div>
        </Pane>

        {/* results */}
        <div className="flex min-h-0 flex-col gap-1.5">
          <div className="grid shrink-0 grid-cols-[2.1fr_repeat(3,minmax(0,1fr))] gap-1.5">
            <div className="rounded-md border bg-card px-3 py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] tracking-wider text-muted-foreground uppercase">Projected battery life</span>
                <Tag className={cn("border-dashed", STATE[st].text)}>{capped ? "CAPPED AT 10 Y" : st}</Tag>
              </div>
              <div className="flex items-baseline gap-1.5">
                <Num className={cn("text-[36px] leading-none font-semibold tracking-tight", STATE[st].text)}>{r.years.toFixed(1)}</Num>
                <span className="font-mono text-xs text-muted-foreground">years</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] leading-tight text-muted-foreground">
                <InfoIcon className="size-3 shrink-0" />
                {CAVEAT}
              </div>
            </div>
            <Stat label="Mean current" value={meanUa.toFixed(0)} unit="uA" sub={`${r.mahPerDay.toFixed(2)} mAh / day`} className="justify-center" />
            <Stat label="Wakes per day" value={r.wakesPerDay.toFixed(0)} sub={`storm ${inputs.stormPct}% of time`} className="justify-center" />
            <Stat label="Airtime / uplink" value={air.toFixed(0)} unit="ms" sub={`SF${inputs.sf}, 24 B on air`} className="justify-center" />
          </div>

          <div className="min-h-0 flex-[0.8]">
            <Pane title="Energy breakdown" icon={ChartColumnIcon} meta={`${totalDay.toFixed(3)} mAh / day`} bodyClassName="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3 p-2">
              <ChartContainer config={breakdownConfig} className="aspect-auto h-full w-full">
                <BarChart data={breakdownData} layout="vertical" margin={{ top: 2, right: 64, bottom: 0, left: 0 }} barSize={16}>
                  <CartesianGrid horizontal={false} strokeDasharray="2 4" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={10} width={104} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                  <Bar dataKey="mahDay" radius={2} isAnimationActive={false}>
                    {breakdownData.map((d, i) => (
                      <Cell key={d.name} fill="var(--foreground)" fillOpacity={[0.9, 0.62, 0.38, 0.2][i]} />
                    ))}
                    <LabelList
                      dataKey="mahDay"
                      position="right"
                      fontSize={10}
                      className="fill-foreground font-mono"
                      formatter={(v: unknown) => `${Number(v).toFixed(3)}`}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
              <div className="flex flex-col justify-center gap-1.5">
                {breakdownData.map((d, i) => (
                  <div key={d.name} className="grid grid-cols-[1fr_44px] items-center gap-x-2">
                    <div>
                      <div className="flex justify-between text-[10.5px] leading-tight">
                        <span>{d.name}</span>
                        <span className="font-mono text-muted-foreground">{d.mahDay.toFixed(3)} mAh</span>
                      </div>
                      <Meter value={d.share} className="mt-0.5 h-1" />
                    </div>
                    <Num className={cn("text-right text-xs", i === 0 && "font-semibold")}>{(d.share * 100).toFixed(1)}%</Num>
                  </div>
                ))}
                <div className="mt-0.5 flex items-center gap-1 border-t pt-1 text-[10px] leading-snug text-muted-foreground">
                  <ZapIcon className="size-3 shrink-0" />
                  {r.breakdown[0].mahDay + r.breakdown[1].mahDay > r.breakdown[2].mahDay + r.breakdown[3].mahDay
                    ? "Waking up dominates: lengthen the wake interval or shorten the capture."
                    : "Sleep and self-discharge dominate: more capacity helps more than fewer uplinks."}
                </div>
              </div>
            </Pane>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5">
            <Pane title="Life vs wake interval" icon={ChartSplineIcon} meta="other inputs held" bodyClassName="p-1.5">
              <ChartContainer config={lifeConfig} className="aspect-auto h-full w-full">
                <LineChart data={wakeData} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="2 4" />
                  <XAxis
                    dataKey="wake"
                    type="number"
                    domain={[0, 120]}
                    ticks={[5, 30, 60, 90, 120]}
                    tickFormatter={(v: number) => `${v}m`}
                    tickLine={false}
                    axisLine={false}
                    fontSize={9}
                    height={16}
                  />
                  <YAxis domain={[0, 11]} ticks={[0, 2, 5, 10]} tickLine={false} axisLine={false} fontSize={9} width={30} tickFormatter={(v: number) => `${v}y`} />
                  <ReferenceLine y={10} stroke="var(--muted-foreground)" strokeDasharray="3 3" label={{ value: "10 y cap", position: "insideBottomRight", fontSize: 9, fill: "var(--muted-foreground)" }} />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" labelFormatter={(_, p) => `wake every ${p?.[0]?.payload?.wake ?? ""} min`} />} />
                  <Line dataKey="years" type="monotone" stroke="var(--color-years)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--foreground)" }} isAnimationActive={false} />
                  <ReferenceDot x={inputs.wakeIntervalMin} y={Math.min(10.8, r.years)} r={5} fill={STATE[st].hex} stroke="var(--background)" strokeWidth={1.5} />
                </LineChart>
              </ChartContainer>
            </Pane>
            <Pane title="Life vs spreading factor" icon={ChartColumnIcon} meta="airtime in ms" bodyClassName="p-1.5">
              <ChartContainer config={lifeConfig} className="aspect-auto h-full w-full">
                <BarChart data={sfData} margin={{ top: 14, right: 8, bottom: 0, left: 0 }} barSize={30}>
                  <CartesianGrid vertical={false} strokeDasharray="2 4" />
                  <XAxis dataKey="sf" tickLine={false} axisLine={false} fontSize={10} height={16} />
                  <YAxis domain={[0, 11]} ticks={[0, 2, 5, 10]} tickLine={false} axisLine={false} fontSize={9} width={30} tickFormatter={(v: number) => `${v}y`} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                  <Bar dataKey="years" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                    {sfData.map((d) => (
                      <Cell key={d.sf} fill="var(--foreground)" fillOpacity={d.n === inputs.sf ? 0.9 : 0.25} />
                    ))}
                    <LabelList
                      dataKey="air"
                      position="top"
                      fontSize={9}
                      className="fill-muted-foreground font-mono"
                      formatter={(v: unknown) => `${v} ms`}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </Pane>
          </div>
        </div>

        {/* fleet + caveats */}
        <div className="flex min-h-0 flex-col gap-1.5">
          <div className="min-h-0 flex-1">
            <Pane title="Fleet" icon={BatteryMediumIcon} meta="battery %, simulated" bodyClassName="flex flex-col justify-between p-2">
              {sortedNodes.map((n) => (
                <div key={n.id} className="grid grid-cols-[42px_1fr_32px] items-center gap-x-2 font-mono text-[10.5px]">
                  <span className="font-semibold">{n.id}</span>
                  <Meter value={n.batteryPct / 100} state={n.batteryPct < 85 ? "YELLOW" : undefined} />
                  <span className={cn("text-right tabular-nums", n.batteryPct < 85 && STATE.YELLOW.text)}>{n.batteryPct}%</span>
                </div>
              ))}
              <div className="mt-1 border-t pt-1 text-[10px] leading-snug text-muted-foreground">
                Nodes using a higher spreading factor (MH-09 at SF10) drain faster: longer airtime per uplink.
              </div>
            </Pane>
          </div>
          <div className="shrink-0">
            <Pane title="What this is not" icon={InfoIcon} className="h-auto" bodyClassName="p-2">
              <ul className="flex list-disc flex-col gap-1 pl-3.5 text-[10.5px] leading-snug text-muted-foreground marker:text-foreground/40">
                <li>
                  <span className="font-medium text-foreground">{CAVEAT}.</span>
                </li>
                <li>Currents are planning figures, not measurements of the XIAO or a LoRa radio.</li>
                <li>No temperature derating, retries, join traffic or ADR changes.</li>
                <li>The prototype rig streams over Wi-Fi and has no battery.</li>
              </ul>
            </Pane>
          </div>
        </div>
      </div>
    </div>
  )
}
