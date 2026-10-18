import { useMemo } from "react"
import {
  AlertTriangleIcon,
  CircleDotIcon,
  DatabaseIcon,
  ListOrderedIcon,
  ScrollTextIcon,
  SquareIcon,
  TargetIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { rig, useRig } from "@/data/rig-sim"
import { CLASS_LABELS, DATASET_TARGET_MIN, SCENARIOS, dataset } from "@/data/seed"
import type { ClassLabel, Scenario } from "@/data/types"
import { cn } from "@/lib/utils"

import { RigToolbar } from "../rig-toolbar"
import { packingOf, recordForm, startRecording, useStore, type Packing } from "../store"
import { Dot, Num, Pane, STATE, Stat, TD, TDN, TH, Tag, clock } from "../ui"

const PACKINGS: Packing[] = [1, 2, 3]
const TARGET_CLASS = DATASET_TARGET_MIN * PACKINGS.length

/** Bench scenario that makes a given label physically true. */
const LABEL_SCENARIO: Record<ClassLabel, Scenario> = {
  packed: "packed",
  void: "void-m",
  leak: "leak",
  noise: "noise",
}

function scenarioMatches(label: ClassLabel, scenario: Scenario) {
  if (label === "void") return scenario.startsWith("void")
  return scenario === label
}

interface Cell {
  label: ClassLabel
  packing: Packing
  seedMin: number
  newMin: number
  seedClips: number
  newClips: number
  minutes: number
  clips: number
}

function useCells() {
  const { recordings } = useRig()
  return useMemo(() => {
    const cells: Cell[] = []
    for (const label of CLASS_LABELS) {
      for (const packing of PACKINGS) {
        const seed = dataset.find((d) => d.label === label && d.packing === packing)
        const mine = recordings.filter((r) => r.label === label && packingOf(r.at) === packing)
        const newMin = mine.reduce((a, r) => a + r.seconds, 0) / 60
        const seedMin = seed?.minutes ?? 0
        const seedClips = seed?.clips ?? 0
        cells.push({
          label,
          packing,
          seedMin,
          newMin,
          seedClips,
          newClips: mine.length,
          minutes: seedMin + newMin,
          clips: seedClips + mine.length,
        })
      }
    }
    return cells
  }, [recordings])
}

function cellState(minutes: number) {
  return minutes >= DATASET_TARGET_MIN ? "GREEN" : minutes >= DATASET_TARGET_MIN * 0.5 ? "YELLOW" : "RED"
}

const fmt = (m: number) => (Number.isInteger(m) ? String(m) : m.toFixed(1))

// ---------- coverage matrix ----------

function Matrix({ cells }: { cells: Cell[] }) {
  const form = useStore(recordForm)
  return (
    <div className="grid h-full min-h-0 grid-cols-[84px_repeat(3,minmax(0,1fr))_120px] grid-rows-[auto_repeat(4,minmax(0,1fr))_auto] gap-1">
      <span />
      {PACKINGS.map((p) => (
        <div key={p} className="flex items-baseline justify-between px-1 font-mono text-[10px]">
          <span className="font-semibold">Packing {p}</span>
          <span
            className={cn(
              "rounded-[3px] border px-1 text-[9px] tracking-wider uppercase",
              p === 3 ? "border-foreground/60 bg-foreground/10" : "text-muted-foreground"
            )}
          >
            {p === 3 ? "held-out test" : "train"}
          </span>
        </div>
      ))}
      <span className="px-1 text-right font-mono text-[10px] text-muted-foreground">class total</span>

      {CLASS_LABELS.map((label) => {
        const row = cells.filter((c) => c.label === label)
        const total = row.reduce((a, c) => a + c.minutes, 0)
        return (
          <div key={label} className="contents">
            <div className="flex flex-col justify-center px-1">
              <span className="font-mono text-sm font-semibold">{label}</span>
              <span className="text-[10px] leading-tight text-muted-foreground">
                {label === "packed" && "steady flow, pulses"}
                {label === "void" && "100 / 250 / 500 ml"}
                {label === "leak" && "water into soil"}
                {label === "noise" && "speaker, thumps"}
              </span>
            </div>
            {row.map((c) => {
              const z = cellState(c.minutes)
              const selected = form.label === c.label && form.packing === c.packing
              return (
                <button
                  key={c.packing}
                  type="button"
                  onClick={() => recordForm.set({ label: c.label, packing: c.packing })}
                  title={`Select ${c.label} / packing ${c.packing} for the next recording`}
                  className={cn(
                    "group relative flex min-h-0 flex-col justify-between rounded-md border bg-card p-2 text-left transition-colors hover:bg-muted/50",
                    selected && "ring-2 ring-foreground/70"
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-baseline gap-1">
                      <Num className="text-xl leading-none font-semibold">{fmt(Math.round(c.minutes * 10) / 10)}</Num>
                      <span className="font-mono text-[10px] text-muted-foreground">/ {DATASET_TARGET_MIN} min</span>
                    </div>
                    <Dot state={z} className="mt-0.5" />
                  </div>
                  <div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("absolute inset-y-0 left-0 bg-foreground/45")}
                        style={{ width: `${Math.min(1, c.seedMin / DATASET_TARGET_MIN) * 100}%` }}
                      />
                      <div
                        className="absolute inset-y-0 rounded-r-full bg-emerald-500"
                        style={{
                          left: `${Math.min(1, c.seedMin / DATASET_TARGET_MIN) * 100}%`,
                          width: `${Math.min(1 - Math.min(1, c.seedMin / DATASET_TARGET_MIN), c.newMin / DATASET_TARGET_MIN) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                      <span>{c.clips} clips</span>
                      {c.newClips > 0 ? (
                        <span className={cn("font-semibold", STATE.GREEN.text)}>
                          +{c.newClips} new / +{fmt(Math.round(c.newMin * 10) / 10)} min
                        </span>
                      ) : (
                        <span>{c.minutes >= DATASET_TARGET_MIN ? "at target" : `${fmt(DATASET_TARGET_MIN - c.minutes)} min to go`}</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
            <div className="flex flex-col justify-center rounded-md border border-dashed px-2">
              <div className="flex items-baseline justify-between">
                <Num className="text-sm font-semibold">{fmt(Math.round(total * 10) / 10)}</Num>
                <span className="font-mono text-[10px] text-muted-foreground">/ {TARGET_CLASS}</span>
              </div>
              <Progress value={Math.min(100, (total / TARGET_CLASS) * 100)} className="mt-1 h-1" />
            </div>
          </div>
        )
      })}

      <span className="px-1 text-right font-mono text-[10px] text-muted-foreground">packing total</span>
      {PACKINGS.map((p) => {
        const col = cells.filter((c) => c.packing === p)
        const total = col.reduce((a, c) => a + c.minutes, 0)
        return (
          <div key={p} className="flex items-center justify-between rounded-md border border-dashed px-2 py-1">
            <Num className="text-sm font-semibold">{fmt(Math.round(total * 10) / 10)} min</Num>
            <span className="font-mono text-[10px] text-muted-foreground">
              {col.reduce((a, c) => a + c.clips, 0)} clips
            </span>
          </div>
        )
      })}
      <span />
    </div>
  )
}

// ---------- stacked chart ----------

const stackConfig = {
  p1: { label: "Packing 1", color: "var(--foreground)" },
  p2: { label: "Packing 2", color: "var(--foreground)" },
  p3: { label: "Packing 3", color: "var(--foreground)" },
} satisfies ChartConfig

function StackChart({ cells }: { cells: Cell[] }) {
  const data = CLASS_LABELS.map((label) => {
    const row = cells.filter((c) => c.label === label)
    return {
      label,
      p1: Math.round(row[0].minutes * 10) / 10,
      p2: Math.round(row[1].minutes * 10) / 10,
      p3: Math.round(row[2].minutes * 10) / 10,
    }
  })
  return (
    <ChartContainer config={stackConfig} className="aspect-auto h-full w-full">
      <BarChart data={data} layout="vertical" margin={{ top: 2, right: 12, bottom: 0, left: 0 }} barSize={12}>
        <CartesianGrid horizontal={false} strokeDasharray="2 4" />
        <XAxis
          type="number"
          domain={[0, 36]}
          ticks={[0, 10, 20, 30]}
          tickLine={false}
          axisLine={false}
          fontSize={9}
          tickFormatter={(v: number) => `${v}m`}
          height={16}
        />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} fontSize={10} width={44} />
        <ReferenceLine x={TARGET_CLASS} stroke="var(--foreground)" strokeDasharray="3 3" label={{ value: "target 30", position: "insideTopRight", fontSize: 9, fill: "var(--muted-foreground)" }} />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
        <Bar dataKey="p1" stackId="a" fill="var(--foreground)" fillOpacity={0.85} isAnimationActive={false} />
        <Bar dataKey="p2" stackId="a" fill="var(--foreground)" fillOpacity={0.55} isAnimationActive={false} />
        <Bar dataKey="p3" stackId="a" fill="var(--foreground)" fillOpacity={0.28} radius={[0, 2, 2, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  )
}

// ---------- record form ----------

function RecordPanel() {
  const s = useRig()
  const form = useStore(recordForm)
  const busy = !!s.task
  const recording = s.task?.kind === "record"
  const match = scenarioMatches(form.label, s.scenario)
  const bench = SCENARIOS.find((x) => x.id === s.scenario)?.label ?? s.scenario
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "")
  const name = `rig01_${form.label}_p${form.packing}_${stamp}`

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[52px_1fr] items-center gap-x-2 gap-y-1.5">
        <span className="text-[9.5px] tracking-wider text-muted-foreground uppercase">Label</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          className="w-full"
          value={form.label}
          onValueChange={(v) => v && recordForm.set({ label: v as ClassLabel })}
        >
          {CLASS_LABELS.map((l) => (
            <ToggleGroupItem key={l} value={l} className="h-7 flex-1 font-mono text-[11px]">
              {l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="text-[9.5px] tracking-wider text-muted-foreground uppercase">Packing</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          className="w-full"
          value={String(form.packing)}
          onValueChange={(v) => v && recordForm.set({ packing: Number(v) as Packing })}
        >
          {PACKINGS.map((p) => (
            <ToggleGroupItem key={p} value={String(p)} className="h-7 flex-1 font-mono text-[11px]">
              P{p}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="text-[9.5px] tracking-wider text-muted-foreground uppercase">Length</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          className="w-full"
          value={String(form.seconds)}
          onValueChange={(v) => v && recordForm.set({ seconds: Number(v) })}
        >
          {[10, 30, 60].map((sec) => (
            <ToggleGroupItem key={sec} value={String(sec)} className="h-7 flex-1 font-mono text-[11px]">
              {sec} s
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {!match && (
        <div className="flex items-start gap-1.5 rounded-sm border border-amber-500/40 bg-amber-500/8 px-2 py-1 text-[10.5px] leading-snug">
          <AlertTriangleIcon className={cn("mt-px size-3 shrink-0", STATE.YELLOW.text)} />
          <span className="min-w-0 flex-1">
            Bench (sim) is <b>{bench}</b> but the label is <b className="font-mono">{form.label}</b>.
          </span>
          <Button
            size="xs"
            variant="outline"
            className="h-5 shrink-0 px-1.5 text-[10px]"
            onClick={() => rig.setScenario(LABEL_SCENARIO[form.label])}
          >
            Match
          </Button>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          className="h-8 flex-1 gap-1.5 text-xs"
          disabled={busy}
          onClick={() => startRecording()}
        >
          <CircleDotIcon className="size-3.5 text-red-400" />
          Record {form.seconds} s clip
        </Button>
        {busy && (
          <Button size="icon-sm" variant="outline" className="size-8" onClick={() => rig.cancelTask()} aria-label="Stop">
            <SquareIcon className="size-3" />
          </Button>
        )}
      </div>
      <div className="min-h-[26px]">
        {recording && s.task ? (
          <div>
            <div className="flex justify-between font-mono text-[10px]">
              <span>Recording...</span>
              <span>{Math.round(s.task.progress * 100)}%</span>
            </div>
            <Progress value={s.task.progress * 100} className="mt-0.5 h-1.5" />
          </div>
        ) : (
          <div className="truncate font-mono text-[10px] text-muted-foreground">
            {name}_mic.wav + {name.replace("rig01_", "")}_vib.wav
          </div>
        )}
      </div>
    </div>
  )
}

function GapList({ cells }: { cells: Cell[] }) {
  const s = useRig()
  const gaps = cells
    .filter((c) => c.minutes < DATASET_TARGET_MIN)
    .sort((a, b) => a.minutes - b.minutes)
    .slice(0, 5)
  if (!gaps.length)
    return <div className="p-2 text-[11px] text-muted-foreground">Every cell has reached the target.</div>
  return (
    <ul className="flex flex-col">
      {gaps.map((c) => (
        <li
          key={`${c.label}${c.packing}`}
          className="grid grid-cols-[18px_52px_28px_1fr_auto] items-center gap-x-1.5 border-b border-dashed border-border/70 py-[3px] last:border-0"
        >
          <Dot state={cellState(c.minutes)} />
          <span className="font-mono text-[11px] font-semibold">{c.label}</span>
          <span className="font-mono text-[11px] text-muted-foreground">P{c.packing}</span>
          <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums">
            {fmt(Math.round(c.minutes * 10) / 10)} / {DATASET_TARGET_MIN} min
          </span>
          <Button
            size="xs"
            variant="ghost"
            className="h-5 px-1.5 text-[10px]"
            disabled={!!s.task}
            onClick={() => {
              recordForm.set({ label: c.label, packing: c.packing })
              if (!scenarioMatches(c.label, s.scenario)) rig.setScenario(LABEL_SCENARIO[c.label])
            }}
          >
            Queue
          </Button>
        </li>
      ))}
    </ul>
  )
}

function SessionClips() {
  const { recordings } = useRig()
  if (!recordings.length)
    return (
      <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-muted-foreground">
        No clips recorded this session. Choose a cell and press Record.
      </div>
    )
  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={TH}>Time</TableHead>
            <TableHead className={TH}>Label</TableHead>
            <TableHead className={TH}>Pack</TableHead>
            <TableHead className={cn(TH, "text-right")}>Sec</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recordings.map((r) => (
            <TableRow key={r.at}>
              <TableCell className={cn(TD, "font-mono tabular-nums")}>{clock(r.at)}</TableCell>
              <TableCell className={cn(TD, "font-mono font-semibold")}>{r.label}</TableCell>
              <TableCell className={cn(TD, "font-mono")}>P{packingOf(r.at)}</TableCell>
              <TableCell className={TDN}>{r.seconds}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}

// ---------- page ----------

export function DatasetPage() {
  const cells = useCells()
  const s = useRig()
  const total = cells.reduce((a, c) => a + c.minutes, 0)
  const clips = cells.reduce((a, c) => a + c.clips, 0)
  const done = cells.filter((c) => c.minutes >= DATASET_TARGET_MIN).length
  const remaining = cells.reduce((a, c) => a + Math.max(0, DATASET_TARGET_MIN - c.minutes), 0)
  const weakest = cells.reduce((a, c) => (c.minutes < a.minutes ? c : a), cells[0])
  const newMin = cells.reduce((a, c) => a + c.newMin, 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RigToolbar />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_330px] gap-1.5 p-1.5">
        <div className="flex min-h-0 flex-col gap-1.5">
          <div className="grid shrink-0 grid-cols-5 gap-1.5">
            <Stat label="Total recorded" value={fmt(Math.round(total * 10) / 10)} unit="min" sub={`${clips} clips`} />
            <Stat
              label="Cells at target"
              value={`${done}/${cells.length}`}
              sub={`target ${DATASET_TARGET_MIN} min per class per packing`}
            />
            <Stat
              label="Remaining"
              value={fmt(Math.round(remaining * 10) / 10)}
              unit="min"
              sub="to fill every cell"
              valueClassName={remaining > 0 ? STATE.YELLOW.text : STATE.GREEN.text}
            />
            <Stat
              label="Weakest cell"
              value={`${weakest.label} P${weakest.packing}`}
              sub={`${fmt(Math.round(weakest.minutes * 10) / 10)} min recorded`}
              valueClassName="text-sm"
            />
            <Stat
              label="This session"
              value={`+${fmt(Math.round(newMin * 10) / 10)}`}
              unit="min"
              sub={`${s.recordings.length} new clips`}
              valueClassName={newMin > 0 ? STATE.GREEN.text : undefined}
            />
          </div>
          <div className="min-h-0 flex-[1.55]">
            <Pane
              title="Coverage: class x packing"
              icon={DatabaseIcon}
              meta="click a cell to pick it for the next clip"
              actions={
                <span className="flex items-center gap-2 font-mono text-[9.5px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-3 rounded-full bg-foreground/45" />
                    seed
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-3 rounded-full bg-emerald-500" />
                    new
                  </span>
                </span>
              }
              bodyClassName="p-1.5"
            >
              <Matrix cells={cells} />
            </Pane>
          </div>
          <div className="min-h-0 flex-1">
            <Pane
              title="Minutes per class"
              icon={TargetIcon}
              meta="stacked by packing"
              actions={
                <Tag className="border-dashed">
                  LEAVE-ONE-PACKING-OUT: P3 NEVER TRAINED ON
                </Tag>
              }
              bodyClassName="p-1.5"
            >
              <StackChart cells={cells} />
            </Pane>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-1.5">
          <div className="shrink-0">
            <Pane title="Record & label" icon={CircleDotIcon} meta="saves mic.wav + vib.wav" className="h-auto">
              <RecordPanel />
            </Pane>
          </div>
          <div className="shrink-0">
            <Pane title="Next up" icon={ListOrderedIcon} meta="largest gaps first" className="h-auto" bodyClassName="px-2 py-1">
              <GapList cells={cells} />
            </Pane>
          </div>
          <div className="min-h-0 flex-1">
            <Pane title="Session clips" icon={ScrollTextIcon} meta={`${s.recordings.length}`} bodyClassName="p-0">
              <SessionClips />
            </Pane>
          </div>
        </div>
      </div>
    </div>
  )
}
