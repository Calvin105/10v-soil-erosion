import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { STATE_HEX, envelopeOf, stateOfRatio, stateOfVri, vriTrend } from "./lib"

/** 14-day VRI trend. Synthetic history that ends at the node's current VRI. */
export function VriTrendChart({ id, vri, className }: { id: string; vri: number; className?: string }) {
  const data = useMemo(() => vriTrend(id, vri), [id, vri])
  const color = STATE_HEX[stateOfVri(vri)]
  const config = { vri: { label: "VRI", color } } satisfies ChartConfig
  const gid = `vc-g-${id.replace(/[^a-zA-Z0-9]/g, "")}`
  return (
    <ChartContainer config={config} className={cn("aspect-auto h-28 w-full", className)}>
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-vri)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-vri)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={10} interval={3} />
        <YAxis domain={[0, 100]} ticks={[0, 40, 70, 100]} tickLine={false} axisLine={false} fontSize={10} />
        <ReferenceLine y={40} stroke={STATE_HEX.YELLOW} strokeDasharray="3 3" strokeOpacity={0.7} />
        <ReferenceLine y={70} stroke={STATE_HEX.RED} strokeDasharray="3 3" strokeOpacity={0.7} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="vri"
          type="monotone"
          stroke="var(--color-vri)"
          strokeWidth={2}
          fill={`url(#${gid})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

/** Illustrative ring-down envelopes from a stored ring-time ratio (baseline tau 8 ms). */
export function RingCompare({ ratio, className }: { ratio: number; className?: string }) {
  const data = useMemo(() => {
    const base = envelopeOf(8)
    const now = envelopeOf(8 * ratio)
    return base.map((b, i) => ({ t: Math.round(b.t), base: b.v, now: now[i].v }))
  }, [ratio])
  const color = STATE_HEX[stateOfRatio(ratio)]
  const config = {
    base: { label: "Healthy baseline", color: "var(--muted-foreground)" },
    now: { label: "Now", color },
  } satisfies ChartConfig
  return (
    <ChartContainer config={config} className={cn("aspect-auto h-28 w-full", className)}>
      <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          type="number"
          domain={[0, 80]}
          ticks={[0, 20, 40, 60, 80]}
          tickFormatter={(v) => `${v}`}
          tickLine={false}
          axisLine={false}
          fontSize={10}
        />
        <YAxis tickLine={false} axisLine={false} fontSize={10} domain={[0, 0.8]} tickFormatter={(v) => Number(v).toFixed(1)} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => `${p?.[0]?.payload?.t ?? ""} ms`} />} />
        <Line dataKey="base" type="monotone" stroke="var(--color-base)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        <Line dataKey="now" type="monotone" stroke="var(--color-now)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  )
}
