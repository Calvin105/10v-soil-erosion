import { memo, useMemo, type ReactNode } from "react"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { BANDS, MIC_BINS, MIC_MAX_HZ, rig, type RigSnapshot, type Transient } from "@/data/rig-sim"
import { cn } from "@/lib/utils"

import { STATE, ratioZone } from "../ui"

// ---------- axis overlays for the canvas viz ----------

export function FreqAxis({ className }: { className?: string }) {
  return (
    <div className={cn("flex justify-between font-mono text-[9px] leading-none text-muted-foreground", className)}>
      {[0, 2, 4, 6, 8].map((k) => (
        <span key={k}>{k === 0 ? "0" : `${k}k`}</span>
      ))}
    </div>
  )
}

export function DbAxis({ top = -20, bottom = -110 }: { top?: number; bottom?: number }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-between py-0.5 font-mono text-[9px] leading-none text-muted-foreground">
      <span>{top}</span>
      <span>{Math.round((top + bottom) / 2)}</span>
      <span>{bottom} dB</span>
    </div>
  )
}

// ---------- ring-down ----------

const ENV_MS = 80

const ringConfig = {
  now: { label: "Now", color: "var(--foreground)" },
  base: { label: "Baseline", color: "var(--muted-foreground)" },
} satisfies ChartConfig

/** Transient envelope (now) against the calibrated healthy envelope (baseline). */
export const RingDownChart = memo(function RingDownChart({
  transient,
  baseline,
  className,
}: {
  transient: Transient | null
  baseline: RigSnapshot["baseline"]
  className?: string
}) {
  const data = useMemo(() => {
    const n = transient?.envelope.length ?? baseline?.envelope.length ?? 60
    return Array.from({ length: n }, (_, i) => ({
      t: Math.round((i / (n - 1)) * ENV_MS * 10) / 10,
      now: transient ? Math.round(transient.envelope[i] * 1000) / 1000 : null,
      base: baseline ? Math.round(baseline.envelope[i] * 1000) / 1000 : null,
    }))
  }, [transient, baseline])

  return (
    <ChartContainer config={ringConfig} className={cn("aspect-auto h-full w-full", className)}>
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis
          dataKey="t"
          type="number"
          domain={[0, ENV_MS]}
          ticks={[0, 20, 40, 60, 80]}
          tickLine={false}
          axisLine={false}
          fontSize={9}
          tickFormatter={(v: number) => `${v}ms`}
          height={16}
        />
        <YAxis
          domain={[0, 1.4]}
          ticks={[0, 0.5, 1]}
          tickLine={false}
          axisLine={false}
          fontSize={9}
          width={24}
        />
        {baseline && (
          <ReferenceLine
            x={baseline.tauMs}
            stroke="var(--muted-foreground)"
            strokeDasharray="2 2"
            label={{ value: "tau0", position: "insideTopLeft", fontSize: 9, fill: "var(--muted-foreground)" }}
          />
        )}
        {transient && (
          <ReferenceLine
            x={transient.tauMs}
            stroke="var(--foreground)"
            strokeDasharray="2 2"
            label={{ value: "tau", position: "insideTopRight", fontSize: 9, fill: "var(--foreground)" }}
          />
        )}
        <ChartTooltip
          cursor={{ strokeDasharray: "2 2" }}
          content={<ChartTooltipContent indicator="line" labelFormatter={(_, p) => `t = ${p?.[0]?.payload?.t ?? ""} ms`} />}
        />
        <Line
          dataKey="base"
          type="monotone"
          stroke="var(--color-base)"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          dataKey="now"
          type="monotone"
          stroke="var(--color-now)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  )
})

export function RingReadout({ s }: { s: RigSnapshot }) {
  const tau = s.lastPulse?.meanTauMs ?? s.lastTransient?.tauMs ?? null
  const base = s.baseline?.tauMs ?? null
  const ratio = tau && base ? tau / base : null
  const z = ratio ? ratioZone(ratio) : null
  return (
    <div className="grid grid-cols-4 gap-1 font-mono text-[11px] tabular-nums">
      <Readout k={s.lastPulse ? "tau (pulse)" : "tau now"} v={tau ? tau.toFixed(1) : "--"} u="ms" />
      <Readout k="tau base" v={base ? base.toFixed(1) : "--"} u="ms" />
      <Readout
        k="ratio"
        v={ratio ? `${ratio.toFixed(2)}x` : "--"}
        className={z ? STATE[z].text : undefined}
        strong
      />
      <Readout k="f0" v={s.lastTransient ? s.lastTransient.f0Hz.toFixed(0) : "--"} u="Hz" />
    </div>
  )
}

function Readout({
  k,
  v,
  u,
  className,
  strong,
}: {
  k: string
  v: string
  u?: string
  className?: string
  strong?: boolean
}) {
  return (
    <div className="flex flex-col rounded-sm border bg-muted/30 px-1.5 py-0.5">
      <span className="font-sans text-[9px] tracking-wide text-muted-foreground uppercase">{k}</span>
      <span className={cn(strong ? "text-sm font-semibold" : "text-xs", "leading-tight", className)}>
        {v}
        {u && <span className="ml-0.5 text-[9px] text-muted-foreground">{u}</span>}
      </span>
    </div>
  )
}

// ---------- features ----------

function bandDbOf(spec: Float32Array) {
  return BANDS.map((b) => {
    let e = 0
    for (let i = 0; i < MIC_BINS; i++) {
      const f = (i + 0.5) * (MIC_MAX_HZ / MIC_BINS)
      if (f >= b.from && f < b.to) e += 10 ** (spec[i] / 10)
    }
    return 10 * Math.log10(e + 1e-12)
  })
}

export function useBaselineBands(baselineAt: number | undefined) {
  return useMemo(() => {
    const spec = rig.getBaselineSpectrum()
    return baselineAt && spec ? bandDbOf(spec) : null
  }, [baselineAt])
}

/** Live feature vector: mic + vib scalars, band energies with delta vs baseline. */
export function FeatureTable({ s }: { s: RigSnapshot }) {
  const base = useBaselineBands(s.baseline?.at)
  const f = s.features
  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_1.35fr] gap-3">
      <div className="flex flex-col">
        <Group label="MIC (FFT 256)">
          <Row k="RMS level" v={f.micRmsDb.toFixed(1)} u="dB" />
          <Row k="Centroid" v={f.centroidHz.toFixed(0)} u="Hz" />
          <Row k="Peak bin" v={f.peakHz.toFixed(0)} u="Hz" />
        </Group>
        <Group label="VIB (piezo)">
          <Row k="RMS" v={f.vibRms.toFixed(3)} />
          <Row k="Crest factor" v={f.vibCrest.toFixed(2)} />
          <Row k="Last peak" v={s.lastTransient ? s.lastTransient.peak.toFixed(2) : "--"} />
        </Group>
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="mb-0.5 flex justify-between text-[9px] tracking-wider text-muted-foreground uppercase">
          <span>Band energy</span>
          <span>{base ? "delta vs base" : "no baseline"}</span>
        </div>
        <div className="flex flex-col gap-1">
          {BANDS.map((b, i) => {
            const db = f.bandDb[i]
            const d = base ? db - base[i] : null
            const norm = (db + 100) / 80
            return (
              <div key={b.id} className="grid grid-cols-[minmax(0,1fr)_44px_44px] items-center gap-1.5 text-[10.5px]">
                <div className="min-w-0">
                  <div className="flex justify-between gap-1 leading-tight">
                    <span className="truncate text-muted-foreground">{b.label}</span>
                  </div>
                  <div className="relative mt-px h-1 w-full rounded-full bg-muted">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-foreground/70" style={{ width: `${Math.max(0, Math.min(1, norm)) * 100}%` }} />
                  </div>
                </div>
                <span className="text-right font-mono tabular-nums">{db.toFixed(0)}</span>
                <span
                  className={cn(
                    "text-right font-mono tabular-nums",
                    d === null
                      ? "text-muted-foreground"
                      : d > 10
                        ? STATE.RED.text
                        : d > 5
                          ? STATE.YELLOW.text
                          : "text-muted-foreground"
                  )}
                >
                  {d === null ? "--" : `${d >= 0 ? "+" : ""}${d.toFixed(1)}`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-1.5">
      <div className="mb-0.5 text-[9px] tracking-wider text-muted-foreground uppercase">{label}</div>
      {children}
    </div>
  )
}

function Row({ k, v, u }: { k: string; v: string; u?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-border/70 text-[11px] leading-[18px] last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono tabular-nums">
        {v}
        {u && <span className="ml-0.5 text-[9px] text-muted-foreground">{u}</span>}
      </span>
    </div>
  )
}
