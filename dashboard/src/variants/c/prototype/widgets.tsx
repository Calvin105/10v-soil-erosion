import { useState } from "react"
import { CircleIcon, MicIcon, XIcon } from "lucide-react"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Progress } from "@/components/ui/progress"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { BANDS, rig, type RigSnapshot } from "@/data/rig-sim"
import { CLASS_LABELS, DATASET_TARGET_MIN, SCENARIOS, dataset } from "@/data/seed"
import type { ClassLabel, ModelCard, NodeState, Probs, Scenario } from "@/data/types"
import { STATE_BG, STATE_HEX, STATE_SOFT, STATE_STROKE, STATE_TEXT, fmt, stateOfRatio } from "../lib"
import { cstore, useC } from "../store"

// ---------- state + status ----------

export function StatePill({ state, className }: { state: NodeState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full px-2 font-mono text-[11px] font-semibold tracking-wide",
        STATE_SOFT[state],
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATE_BG[state])} />
      {state}
    </span>
  )
}

export function Stat({
  label,
  value,
  unit,
  className,
  valueClass,
}: {
  label: React.ReactNode
  value: React.ReactNode
  unit?: string
  className?: string
  valueClass?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <span className="truncate text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-sm tabular-nums", valueClass)}>
        {value}
        {unit && <span className="ml-0.5 text-[11px] text-muted-foreground">{unit}</span>}
      </span>
    </div>
  )
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[11px] font-medium tracking-wide text-muted-foreground uppercase", className)}>
      {children}
    </div>
  )
}

// ---------- VRI gauge ----------

const ARC_R = 46
function arcPath(from: number, to: number) {
  // value 0..100 mapped to 180deg..0deg
  const a0 = Math.PI * (1 - from / 100)
  const a1 = Math.PI * (1 - to / 100)
  const p = (a: number) => [60 + ARC_R * Math.cos(a), 58 - ARC_R * Math.sin(a)]
  const [x0, y0] = p(a0)
  const [x1, y1] = p(a1)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${ARC_R} ${ARC_R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

export function VriGauge({
  vri,
  state,
  className,
  caption,
}: {
  vri: number
  state: NodeState
  className?: string
  caption?: React.ReactNode
}) {
  const v = Math.max(0, Math.min(100, vri))
  return (
    <div className={cn("relative", className)}>
      <svg viewBox="0 0 120 66" className="w-full">
        <path d={arcPath(0, 39.5)} className="fill-none stroke-emerald-500/25 dark:stroke-emerald-400/25" strokeWidth={9} />
        <path d={arcPath(40.5, 69.5)} className="fill-none stroke-amber-500/25 dark:stroke-amber-400/25" strokeWidth={9} />
        <path d={arcPath(70.5, 100)} className="fill-none stroke-red-500/25 dark:stroke-red-400/25" strokeWidth={9} />
        {v > 0.5 && (
          <path
            d={arcPath(0, v)}
            className={cn("fill-none transition-all", STATE_STROKE[state])}
            strokeWidth={9}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="font-mono text-3xl leading-none font-semibold tabular-nums">{vri}</span>
        {caption && <span className="mt-0.5 text-[10px] text-muted-foreground">{caption}</span>}
      </div>
    </div>
  )
}

// ---------- sparkline (SVG, cheap at 5 Hz) ----------

export function VriSparkline({
  history,
  className,
}: {
  history: { vri: number; state: NodeState }[]
  className?: string
}) {
  const w = 200
  const h = 40
  const pts = history.slice(-90)
  const xOf = (i: number) => (pts.length <= 1 ? 0 : (i / (pts.length - 1)) * w)
  const yOf = (v: number) => h - (v / 100) * h
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(p.vri).toFixed(1)}`).join(" ")
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-10 w-full overflow-visible", className)}>
      <line x1={0} x2={w} y1={yOf(40)} y2={yOf(40)} className="stroke-amber-500/50" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <line x1={0} x2={w} y1={yOf(70)} y2={yOf(70)} className="stroke-red-500/50" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      {pts.length > 1 && (
        <>
          <path d={`${d} L${w},${h} L0,${h} Z`} className="fill-foreground/5" />
          <path d={d} className="fill-none stroke-foreground" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </>
      )}
      {last && <circle cx={w} cy={yOf(last.vri)} r={2.5} fill={STATE_HEX[last.state]} />}
    </svg>
  )
}

// ---------- probabilities ----------

export function ProbBars({
  laptop,
  tiny,
  tinyDrives,
  compact,
}: {
  laptop: Probs
  tiny: Probs
  tinyDrives: boolean
  compact?: boolean
}) {
  const top = (p: Probs) => CLASS_LABELS.reduce((a, b) => (p[b] > p[a] ? b : a), "packed" as ClassLabel)
  const lt = top(laptop)
  const tt = top(tiny)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[52px_1fr_1fr] items-center gap-x-2 text-[10px] text-muted-foreground">
        <span />
        <span className={cn(!tinyDrives && "font-semibold text-foreground")}>
          {compact ? "Laptop RF" : "Phase 1 Laptop RF"}
          {!tinyDrives && " (drives VRI)"}
        </span>
        <span className={cn(tinyDrives && "font-semibold text-foreground")}>
          {compact ? "TinyML" : "Phase 2 TinyML"}
          {tinyDrives && " (drives VRI)"}
        </span>
      </div>
      {CLASS_LABELS.map((c) => (
        <div key={c} className="grid grid-cols-[52px_1fr_1fr] items-center gap-x-2">
          <span className="text-xs">{c}</span>
          {[
            { p: laptop[c], on: !tinyDrives, isTop: lt === c },
            { p: tiny[c], on: tinyDrives, isTop: tt === c },
          ].map((x, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-[width] duration-200",
                    x.on ? "bg-foreground" : "bg-foreground/35"
                  )}
                  style={{ width: `${x.p * 100}%` }}
                />
              </div>
              <span
                className={cn(
                  "w-8 text-right font-mono text-[11px] tabular-nums",
                  x.isTop ? "font-semibold" : "text-muted-foreground"
                )}
              >
                {x.p.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function InferenceToggle({ tiny, className }: { tiny: boolean; className?: string }) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      spacing={0}
      value={tiny ? "tiny" : "laptop"}
      onValueChange={(v) => {
        if (!v) return
        rig.setTinyMl(v === "tiny")
        toast(v === "tiny" ? "VRI now driven by TinyML on the ESP32" : "VRI now driven by the laptop Random Forest")
      }}
      className={cn("w-full", className)}
    >
      <ToggleGroupItem value="laptop" className="flex-1 text-xs">
        Laptop (Phase 1)
      </ToggleGroupItem>
      <ToggleGroupItem value="tiny" className="flex-1 text-xs">
        TinyML (Phase 2)
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

// ---------- ring-down ----------

export function ringNumbers(s: RigSnapshot) {
  const nowTau = s.lastPulse?.meanTauMs ?? s.lastTransient?.tauMs ?? null
  const baseTau = s.baseline?.tauMs ?? null
  const ratio = nowTau && baseTau ? nowTau / baseTau : null
  return { nowTau, baseTau, ratio, ratioState: ratio ? stateOfRatio(ratio) : ("GREEN" as NodeState) }
}

export function RingDownChart({ snap, className }: { snap: RigSnapshot; className?: string }) {
  const { ratioState } = ringNumbers(snap)
  const last = snap.lastTransient
  const base = snap.baseline
  const data = Array.from({ length: 60 }, (_, i) => ({
    t: Math.round((i / 59) * 800) / 10,
    base: base ? base.envelope[i] : null,
    now: last ? last.envelope[i] : null,
  }))
  const config = {
    base: { label: "Baseline (packed)", color: "var(--muted-foreground)" },
    now: { label: "Latest transient", color: STATE_HEX[ratioState] },
  } satisfies ChartConfig
  if (!last && !base) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground",
          className
        )}
      >
        No transient yet. Calibrate a baseline, then switch flow or run a pulse test.
      </div>
    )
  }
  return (
    <ChartContainer config={config} className={cn("aspect-auto h-36 w-full", className)}>
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          type="number"
          domain={[0, 80]}
          ticks={[0, 20, 40, 60, 80]}
          tickFormatter={(v) => `${v} ms`}
          tickLine={false}
          axisLine={false}
          fontSize={10}
        />
        <YAxis tickLine={false} axisLine={false} fontSize={10} domain={[0, "auto"]} tickFormatter={(v) => Number(v).toFixed(1)} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => `${p?.[0]?.payload?.t ?? ""} ms`} />} />
        {base && (
          <ReferenceLine x={base.tauMs} stroke="var(--muted-foreground)" strokeDasharray="2 3" />
        )}
        {last && <ReferenceLine x={last.tauMs} stroke={STATE_HEX[ratioState]} strokeDasharray="2 3" />}
        <Line
          dataKey="base"
          type="monotone"
          stroke="var(--color-base)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="now"
          type="monotone"
          stroke="var(--color-now)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}

export function RingStats({ snap }: { snap: RigSnapshot }) {
  const { nowTau, baseTau, ratio, ratioState } = ringNumbers(snap)
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="tau now" value={nowTau ? nowTau.toFixed(1) : "--"} unit="ms" />
      <Stat label="tau baseline" value={baseTau ? baseTau.toFixed(1) : "--"} unit="ms" />
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] text-muted-foreground">ratio</span>
        <span className={cn("font-mono text-sm font-semibold tabular-nums", ratio && STATE_TEXT[ratioState])}>
          {ratio ? `${ratio.toFixed(2)}x` : "--"}
        </span>
      </div>
    </div>
  )
}

export function ringVerdict(snap: RigSnapshot) {
  const { ratio } = ringNumbers(snap)
  if (!snap.baseline) return "Calibrate on packed soil to set the healthy ring-down."
  if (!ratio) return "Switch flow or run a pulse test to excite the pipe."
  if (ratio < 1.3) return "Dull thud: soil is damping the pipe like the baseline."
  if (ratio < 1.8) return "Rings longer than baseline: possible early washout."
  return "Hollow drum: pipe rings far longer than baseline. Likely void."
}

// ---------- features ----------

export function FeatureGrid({ snap, cols = 3 }: { snap: RigSnapshot; cols?: number }) {
  const f = snap.features
  return (
    <div className="flex flex-col gap-3">
      <div className={cn("grid gap-x-3 gap-y-2", cols === 3 ? "grid-cols-3" : "grid-cols-2")}>
        <Stat label="Mic RMS" value={f.micRmsDb.toFixed(1)} unit="dB" />
        <Stat label="Centroid" value={Math.round(f.centroidHz)} unit="Hz" />
        <Stat label="Peak" value={Math.round(f.peakHz)} unit="Hz" />
        <Stat label="Vib RMS" value={f.vibRms.toFixed(3)} />
        <Stat label="Crest" value={f.vibCrest.toFixed(2)} />
        <Stat label="f0 (transient)" value={snap.lastTransient ? Math.round(snap.lastTransient.f0Hz) : "--"} unit="Hz" />
      </div>
      <div className="flex flex-col gap-1">
        {BANDS.map((b, i) => {
          const db = f.bandDb[i]
          const w = Math.max(0, Math.min(1, (db + 100) / 80))
          return (
            <div key={b.id} className="grid grid-cols-[92px_1fr_52px] items-center gap-2">
              <span className="truncate text-[11px] text-muted-foreground">{b.label}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground/70 transition-[width] duration-200" style={{ width: `${w * 100}%` }} />
              </div>
              <span className="text-right font-mono text-[11px] tabular-nums">{db.toFixed(0)} dB</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- confusion matrix + model card ----------

export function ConfusionMatrix({ m }: { m: number[][] }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[56px_repeat(4,1fr)] gap-1 text-[10px] text-muted-foreground">
        <span className="text-right">true / pred</span>
        {CLASS_LABELS.map((c) => (
          <span key={c} className="truncate text-center">
            {c}
          </span>
        ))}
      </div>
      {m.map((row, i) => {
        const sum = row.reduce((a, b) => a + b, 0) || 1
        return (
          <div key={i} className="grid grid-cols-[56px_repeat(4,1fr)] gap-1">
            <span className="self-center text-right text-[11px] text-muted-foreground">{CLASS_LABELS[i]}</span>
            {row.map((v, j) => {
              const p = v / sum
              return (
                <div
                  key={j}
                  className={cn(
                    "grid h-7 place-items-center rounded-md font-mono text-[11px] tabular-nums",
                    p > 0.5 ? "text-background" : "text-foreground",
                    i === j && "ring-1 ring-foreground/30"
                  )}
                  style={{ backgroundColor: `color-mix(in oklch, var(--foreground) ${Math.round(6 + p * 80)}%, transparent)` }}
                  title={`${CLASS_LABELS[i]} predicted as ${CLASS_LABELS[j]}: ${v}`}
                >
                  {v}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export function ModelCardView({ model, live, active }: { model: ModelCard; live?: Probs; active?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", active && "ring-2 ring-foreground/60")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{model.stage}</div>
          <div className="font-medium">{model.name}</div>
          <div className="text-xs text-muted-foreground">{model.framework}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={model.status === "Trained" || model.status === "Deployed" ? "default" : "outline"}>
            {model.status}
          </Badge>
          {active && <Badge variant="secondary">drives VRI</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2">
        <Stat label="Held-out acc." value={fmt.pct(model.heldOutAccuracy)} />
        <Stat label="Latency" value={model.latencyMs} unit="ms" />
        <Stat label="Size" value={model.sizeKb} unit="KB" />
      </div>
      <div className="text-xs text-muted-foreground">Input: {model.input}</div>
      <ConfusionMatrix m={model.confusion} />
      {live && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {CLASS_LABELS.map((c) => (
            <span key={c} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums">
              {c} {live[c].toFixed(2)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- dataset ----------

export function useDatasetMinutes(recordings: RigSnapshot["recordings"]) {
  const packing = useC((s) => s.recordPacking)
  const extra: Record<string, number> = {}
  recordings.forEach((r) => {
    const k = `${r.label}-${packing[r.at] ?? 1}`
    extra[k] = (extra[k] ?? 0) + r.seconds / 60
  })
  return dataset.map((row) => ({
    ...row,
    added: extra[`${row.label}-${row.packing}`] ?? 0,
    total: row.minutes + (extra[`${row.label}-${row.packing}`] ?? 0),
  }))
}

export function DatasetGrid({ recordings, compact }: { recordings: RigSnapshot["recordings"]; compact?: boolean }) {
  const rows = useDatasetMinutes(recordings)
  const done = rows.filter((r) => r.total >= DATASET_TARGET_MIN).length
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>
          Target {DATASET_TARGET_MIN} min per class per packing
        </span>
        <span className="font-mono tabular-nums">
          {done}/{rows.length} cells at target
        </span>
      </div>
      <div className={cn("grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
        {CLASS_LABELS.map((c) => (
          <div key={c} className="flex flex-col gap-1.5 rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{c}</span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {rows
                  .filter((r) => r.label === c)
                  .reduce((a, r) => a + r.total, 0)
                  .toFixed(1)}{" "}
                min
              </span>
            </div>
            {rows
              .filter((r) => r.label === c)
              .map((r) => (
                <div key={r.packing} className="grid grid-cols-[64px_1fr_86px] items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Packing {r.packing}</span>
                  <Progress value={Math.min(100, (r.total / DATASET_TARGET_MIN) * 100)} className="h-1.5" />
                  <span className="text-right font-mono text-[11px] tabular-nums">
                    {r.total.toFixed(1)}/{DATASET_TARGET_MIN}
                    {r.added > 0 && <span className="ml-1 text-emerald-600 dark:text-emerald-400">+{r.added.toFixed(1)}</span>}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- event log ----------

const LEVEL_DOT: Record<string, string> = {
  info: "bg-muted-foreground/60",
  warn: "bg-amber-500 dark:bg-amber-400",
  alert: "bg-red-500 dark:bg-red-400",
  success: "bg-emerald-500 dark:bg-emerald-400",
}

export function EventLog({ events, limit, dense }: { events: RigSnapshot["events"]; limit?: number; dense?: boolean }) {
  const list = limit ? events.slice(0, limit) : events
  return (
    <ul className={cn("flex flex-col", dense ? "gap-1" : "gap-1.5")}>
      {list.map((e, i) => (
        <li key={`${e.at}-${i}`} className="grid grid-cols-[56px_8px_1fr] items-baseline gap-2 text-xs">
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{fmt.time(e.at)}</span>
          <span className={cn("size-1.5 translate-y-[-1px] rounded-full", LEVEL_DOT[e.level])} />
          <span className={cn(dense && "truncate")}>{e.text}</span>
        </li>
      ))}
    </ul>
  )
}

// ---------- task progress ----------

export function TaskBar({ task, className }: { task: RigSnapshot["task"]; className?: string }) {
  if (!task) return null
  const remaining = Math.max(0, (task.durationMs * (1 - task.progress)) / 1000)
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate">{task.label}</span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {Math.round(task.progress * 100)}% · {remaining.toFixed(0)} s
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Cancel task"
            onClick={() => {
              rig.cancelTask()
              toast("Task cancelled")
            }}
          >
            <XIcon />
          </Button>
        </span>
      </div>
      <Progress value={task.progress * 100} className="h-1.5" />
    </div>
  )
}

// ---------- record & label form ----------

export const SCENARIO_LABEL: Record<Scenario, ClassLabel> = {
  packed: "packed",
  "void-s": "void",
  "void-m": "void",
  "void-l": "void",
  leak: "leak",
  noise: "noise",
}

export function RecordForm({ scenario, busy, onDone }: { scenario: Scenario; busy: boolean; onDone?: () => void }) {
  const [label, setLabel] = useState<ClassLabel>(SCENARIO_LABEL[scenario])
  const [secs, setSecs] = useState("10")
  const [packing, setPacking] = useState<"1" | "2" | "3">("1")
  const mismatch = SCENARIO_LABEL[scenario] !== label
  const scenarioName = SCENARIOS.find((s) => s.id === scenario)?.label
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Label</SectionLabel>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={0}
          value={label}
          onValueChange={(v) => v && setLabel(v as ClassLabel)}
          className="w-full"
        >
          {CLASS_LABELS.map((c) => (
            <ToggleGroupItem key={c} value={c} className="flex-1 text-xs">
              {c}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Duration</SectionLabel>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            spacing={0}
            value={secs}
            onValueChange={(v) => v && setSecs(v)}
            className="w-full"
          >
            {["5", "10", "20"].map((s) => (
              <ToggleGroupItem key={s} value={s} className="flex-1 font-mono text-xs">
                {s}s
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Packing #</SectionLabel>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            spacing={0}
            value={packing}
            onValueChange={(v) => v && setPacking(v as "1" | "2" | "3")}
            className="w-full"
          >
            {["1", "2", "3"].map((s) => (
              <ToggleGroupItem key={s} value={s} className="flex-1 font-mono text-xs">
                {s}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
      <p className={cn("text-xs", mismatch ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
        {mismatch
          ? `Bench is set to "${scenarioName}" but the label is "${label}". Check before recording.`
          : `Bench: ${scenarioName}. Saves mic.wav + vib.wav with this label.`}
      </p>
      <Button
        disabled={busy}
        onClick={() => {
          cstore.queuePacking(Number(packing) as 1 | 2 | 3)
          rig.record(label, Number(secs))
          toast(`Recording ${secs} s labelled "${label}" (packing ${packing})`)
          onDone?.()
        }}
      >
        <CircleIcon className="fill-red-500 text-red-500" /> Start recording
      </Button>
    </div>
  )
}

export function MicBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <MicIcon className="size-3" /> MIC
    </span>
  )
}
