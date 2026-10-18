import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { CLASS_LABELS } from "@/data/seed"
import type { ModelCard, Probs } from "@/data/types"
import { cn } from "@/lib/utils"

import { Num } from "./state"

/* ---------------- Ring-down: now vs baseline envelope ---------------- */

const ringConfig = {
  now: { label: "Now", color: "var(--foreground)" },
  base: { label: "Baseline", color: "var(--muted-foreground)" },
} satisfies ChartConfig

export function RingDownChart({
  now,
  base,
  className,
  legend = true,
}: {
  now: number[] | null
  base: number[] | null
  className?: string
  legend?: boolean
}) {
  const n = Math.max(now?.length ?? 0, base?.length ?? 0, 2)
  const data = Array.from({ length: n }, (_, i) => ({
    ms: Math.round((i / (n - 1)) * 800) / 10,
    now: now ? now[i] : null,
    base: base ? base[i] : null,
  }))
  return (
    <ChartContainer config={ringConfig} className={cn("aspect-auto h-48 w-full", className)}>
      <LineChart data={data} margin={{ left: 4, right: 12, top: 6, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis
          dataKey="ms"
          type="number"
          domain={[0, 80]}
          ticks={[0, 20, 40, 60, 80]}
          tickFormatter={(v) => `${v} ms`}
          tickLine={false}
          axisLine={false}
        />
        <YAxis hide domain={[0, "auto"]} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => `t = ${p?.[0]?.payload?.ms ?? ""} ms`}
              formatter={(v, name) => (
                <div className="flex w-full justify-between gap-3">
                  <span className="text-muted-foreground">
                    {ringConfig[name as keyof typeof ringConfig]?.label ?? name}
                  </span>
                  <Num>{Number(v).toFixed(3)}</Num>
                </div>
              )}
            />
          }
        />
        <Line
          dataKey="base"
          stroke="var(--color-base)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          dataKey="now"
          stroke="var(--color-now)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        {legend && <ChartLegend content={<ChartLegendContent />} />}
      </LineChart>
    </ChartContainer>
  )
}

/* ---------------- VRI trend with thresholds ---------------- */

const vriConfig = { vri: { label: "VRI", color: "var(--foreground)" } } satisfies ChartConfig

export function VriTrend({
  data,
  className,
  xKey = "i",
  labelKey,
}: {
  data: { vri: number; [k: string]: unknown }[]
  className?: string
  xKey?: string
  labelKey?: string
}) {
  return (
    <ChartContainer config={vriConfig} className={cn("aspect-auto h-36 w-full", className)}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis dataKey={xKey} hide />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 40, 70, 100]}
          width={32}
          tickLine={false}
          axisLine={false}
        />
        <ReferenceLine y={70} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
        <ReferenceLine y={40} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(_, p) =>
                labelKey ? String(p?.[0]?.payload?.[labelKey] ?? "") : "VRI"
              }
            />
          }
        />
        <Area
          dataKey="vri"
          type="monotone"
          stroke="var(--color-vri)"
          strokeWidth={2}
          fill="var(--color-vri)"
          fillOpacity={0.08}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

/* ---------------- Band energy: now vs baseline ---------------- */

const bandConfig = {
  now: { label: "Now", color: "var(--foreground)" },
  base: { label: "Baseline", color: "var(--muted-foreground)" },
} satisfies ChartConfig

export function BandChart({
  data,
  className,
}: {
  data: { band: string; now: number; base: number | null }[]
  className?: string
}) {
  const shifted = data.map((d) => ({
    band: d.band,
    now: d.now + 120,
    base: d.base === null ? null : d.base + 120,
    nowDb: d.now,
    baseDb: d.base,
  }))
  return (
    <ChartContainer config={bandConfig} className={cn("aspect-auto h-44 w-full", className)}>
      <BarChart data={shifted} margin={{ left: 0, right: 8, top: 6, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis dataKey="band" tickLine={false} axisLine={false} interval={0} fontSize={10} />
        <YAxis hide domain={[0, "auto"]} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(_, name, item) => {
                const db = name === "now" ? item.payload.nowDb : item.payload.baseDb
                return (
                  <div className="flex w-full justify-between gap-3">
                    <span className="text-muted-foreground">
                      {bandConfig[name as keyof typeof bandConfig]?.label ?? name}
                    </span>
                    <Num>{db === null ? "-" : `${Number(db).toFixed(1)} dB`}</Num>
                  </div>
                )
              }}
            />
          }
        />
        <Bar dataKey="base" fill="var(--color-base)" fillOpacity={0.45} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="now" fill="var(--color-now)" fillOpacity={0.8} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  )
}

/* ---------------- Phase 1 vs Phase 2 probabilities ---------------- */

export function ProbCompare({
  laptop,
  tiny,
  tinyActive,
  className,
}: {
  laptop: Probs
  tiny: Probs
  tinyActive: boolean
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-foreground/80" />
          Phase 1 laptop RF
          {!tinyActive && <span className="font-semibold">(drives VRI)</span>}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm border border-foreground/60 bg-[repeating-linear-gradient(135deg,var(--foreground)_0_1.5px,transparent_1.5px_4px)] opacity-70" />
          Phase 2 TinyML (ESP32)
          {tinyActive && <span className="font-semibold">(drives VRI)</span>}
        </span>
      </div>
      {CLASS_LABELS.map((l) => (
        <div key={l} className="grid grid-cols-[56px_1fr_44px] items-center gap-x-2 gap-y-1">
          <span className="row-span-2 text-sm font-medium capitalize">{l}</span>
          <div className="h-2.5 overflow-hidden rounded-sm bg-muted">
            <div
              className={cn("h-full rounded-sm bg-foreground/80 transition-[width] duration-300", tinyActive && "opacity-40")}
              style={{ width: `${laptop[l] * 100}%` }}
            />
          </div>
          <Num className="text-right text-xs">{laptop[l].toFixed(2)}</Num>
          <div className="h-2.5 overflow-hidden rounded-sm bg-muted">
            <div
              className={cn(
                "h-full rounded-sm border border-foreground/60 bg-[repeating-linear-gradient(135deg,var(--foreground)_0_1.5px,transparent_1.5px_4px)] transition-[width] duration-300",
                !tinyActive && "opacity-40"
              )}
              style={{ width: `${tiny[l] * 100}%` }}
            />
          </div>
          <Num className="text-right text-xs text-muted-foreground">{tiny[l].toFixed(2)}</Num>
        </div>
      ))}
    </div>
  )
}

/* ---------------- Confusion matrix ---------------- */

export function ConfusionMatrix({ model, className }: { model: ModelCard; className?: string }) {
  const m = model.confusion
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="grid grid-cols-[52px_repeat(4,minmax(0,1fr))] gap-[2px] text-[10px]">
        <span className="self-end text-muted-foreground">act \ pred</span>
        {CLASS_LABELS.map((l) => (
          <span key={l} className="truncate text-center text-muted-foreground capitalize">
            {l}
          </span>
        ))}
        {m.map((row, r) => {
          const sum = row.reduce((a, b) => a + b, 0)
          return [
            <span key={`l${r}`} className="flex items-center text-muted-foreground capitalize">
              {CLASS_LABELS[r]}
            </span>,
            ...row.map((v, c) => {
              const pct = sum ? v / sum : 0
              return (
                <span
                  key={`${r}-${c}`}
                  title={`${CLASS_LABELS[r]} predicted as ${CLASS_LABELS[c]}: ${v} (${Math.round(pct * 100)}%)`}
                  className={cn(
                    "flex h-7 items-center justify-center rounded-[3px] font-mono text-xs tabular-nums",
                    pct > 0.5 ? "text-background" : "text-foreground"
                  )}
                  style={{
                    background: `color-mix(in oklch, var(--foreground) ${Math.round(Math.max(pct, 0.03) * 85)}%, transparent)`,
                  }}
                >
                  {v}
                </span>
              )
            }),
          ]
        })}
      </div>
    </div>
  )
}
