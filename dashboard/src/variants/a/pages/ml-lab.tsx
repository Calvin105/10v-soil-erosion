import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CpuIcon,
  FlaskConicalIcon,
  GaugeIcon,
  LaptopIcon,
  LoaderCircleIcon,
  ScaleIcon,
  SplitIcon,
  TrendingUpIcon,
} from "lucide-react"
import { CartesianGrid, ComposedChart, ErrorBar, Line, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { rig, useRig } from "@/data/rig-sim"
import { CLASS_LABELS, dataset, doseResponse, models } from "@/data/seed"
import type { ModelCard } from "@/data/types"
import { cn } from "@/lib/utils"

import { RigToolbar } from "../rig-toolbar"
import { agreement, useStore } from "../store"
import { Meter, Num, Pane, STATE, Stat, Tag, pct } from "../ui"
import { ConfusionMatrix, ProbCompare } from "../widgets/ml"
import { VriComponents } from "./console"

const STATUS_CLS: Record<ModelCard["status"], string> = {
  Trained: `${STATE.GREEN.text} border-emerald-500/40`,
  Deployed: `${STATE.GREEN.text} border-emerald-500/40 bg-emerald-500/10`,
  Training: `${STATE.YELLOW.text} border-amber-500/40`,
  Planned: "text-muted-foreground",
}

/** Per-class stats derived from a confusion matrix (rows = truth). */
function matrixStats(m: number[][]) {
  const total = m.flat().reduce((a, b) => a + b, 0)
  const hit = m.reduce((a, r, i) => a + r[i], 0)
  const voidIdx = CLASS_LABELS.indexOf("void")
  const voidRow = m[voidIdx].reduce((a, b) => a + b, 0)
  const voidCol = m.reduce((a, r) => a + r[voidIdx], 0)
  return {
    total,
    accuracy: hit / total,
    voidRecall: m[voidIdx][voidIdx] / voidRow,
    voidPrecision: m[voidIdx][voidIdx] / voidCol,
    missedVoids: voidRow - m[voidIdx][voidIdx],
    voidRow,
  }
}

function ModelPane({ model, driving }: { model: ModelCard; driving: boolean }) {
  const phase1 = model.stage.startsWith("Phase 1")
  const st = matrixStats(model.confusion)
  return (
    <Pane
      title={phase1 ? "Phase 1 / laptop" : "Phase 2 / TinyML on ESP32"}
      icon={phase1 ? LaptopIcon : CpuIcon}
      meta={model.id}
      actions={
        <>
          {driving && (
            <Tag className="border-foreground/50 bg-foreground text-background">DRIVES VRI</Tag>
          )}
          <Tag className={STATUS_CLS[model.status]}>{model.status.toUpperCase()}</Tag>
        </>
      }
      bodyClassName="flex flex-col gap-2 p-2"
    >
      <div className="min-w-0">
        <div className="truncate text-[13px] leading-tight font-semibold">{model.name}</div>
        <div className="truncate text-[10.5px] text-muted-foreground">{model.framework}</div>
      </div>
      <div className="grid grid-cols-4 gap-1">
        <Stat label="Held-out acc" value={pct(model.heldOutAccuracy)} sub={`n=${st.total} clips`} />
        <Stat label="Latency" value={model.latencyMs} unit="ms" sub={phase1 ? "per window" : "on-device"} />
        <Stat label="Size" value={model.sizeKb} unit="KB" sub={phase1 ? "pickled forest" : "int8 model"} />
        <Stat
          label="Void recall"
          value={pct(st.voidRecall)}
          sub={`${st.missedVoids} of ${st.voidRow} missed`}
          valueClassName={st.voidRecall < 0.9 ? STATE.YELLOW.text : STATE.GREEN.text}
        />
      </div>
      <div className="text-[10.5px] leading-snug text-muted-foreground">
        <span className="text-[9px] tracking-wider uppercase">Input </span>
        {model.input}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-0.5 flex items-center justify-between text-[9px] tracking-wider text-muted-foreground uppercase">
          <span>Confusion matrix, held-out packing 3</span>
          <span className="font-mono normal-case">clips</span>
        </div>
        <ConfusionMatrix model={model} fill className="min-h-0 flex-1" />
      </div>
      <div className="flex items-center gap-2 border-t pt-1 font-mono text-[10.5px]">
        <span className="text-muted-foreground">latency budget</span>
        <Meter value={model.latencyMs / 500} className="flex-1" muted />
        <span>
          {model.latencyMs}/500 ms
        </span>
      </div>
    </Pane>
  )
}

const STEPS: {
  title: string
  detail: string
  state: "done" | "active" | "todo"
}[] = [
  {
    title: "Collect",
    detail: "10 min per class per packing, 3 packings. Mic WAV + vib WAV per clip.",
    state: "active",
  },
  {
    title: "Split",
    detail: "Leave-one-packing-out: train packings 1-2, test on packing 3. No random window split.",
    state: "done",
  },
  {
    title: "Phase 1: laptop RF",
    detail: "14 features from both sensors, scikit-learn forest. Streams P(class) live.",
    state: "done",
  },
  {
    title: "Phase 2: TinyML",
    detail: "Edge Impulse MFE + 1D CNN, int8. Check RAM and latency in the EON tuner.",
    state: "active",
  },
  {
    title: "Compare",
    detail: "Same stream, both models. Report held-out accuracy, confusion and agreement.",
    state: "todo",
  },
]

function SplitBar() {
  const minutes = (p: number) => dataset.filter((d) => d.packing === p).reduce((a, d) => a + d.minutes, 0)
  const cells = [
    { p: 1, test: false },
    { p: 2, test: false },
    { p: 3, test: true },
  ]
  return (
    <div className="grid grid-cols-3 gap-1">
      {cells.map((c) => (
        <div
          key={c.p}
          className={cn(
            "flex items-baseline justify-between rounded-sm border px-1.5 py-1 font-mono text-[10.5px]",
            c.test ? "border-foreground/60 bg-foreground/10" : "bg-muted/30"
          )}
        >
          <span className="font-semibold">P{c.p}</span>
          <span className="text-[9px] tracking-wider text-muted-foreground uppercase">{c.test ? "test" : "train"}</span>
          <span className="tabular-nums">{minutes(c.p)} min</span>
        </div>
      ))}
    </div>
  )
}

function TrainingPlan() {
  return (
    <ol className="flex flex-col gap-2">
      {STEPS.map((st, i) => {
        const Icon = st.state === "done" ? CheckCircle2Icon : st.state === "active" ? LoaderCircleIcon : CircleDashedIcon
        return (
          <li key={st.title} className="relative flex gap-2">
            {i < STEPS.length - 1 && <span className="absolute top-4 -bottom-2 left-[7px] w-px bg-border" />}
            <Icon
              className={cn(
                "relative mt-px size-3.5 shrink-0 bg-card",
                st.state === "done" && STATE.GREEN.text,
                st.state === "active" && cn(STATE.YELLOW.text, "animate-[spin_3s_linear_infinite]"),
                st.state === "todo" && "text-muted-foreground"
              )}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11.5px] leading-tight font-medium">
                {st.title}
                <span className="font-mono text-[9px] font-normal tracking-wider text-muted-foreground uppercase">
                  {st.state === "done" ? "ready" : st.state === "active" ? "in progress" : "next"}
                </span>
              </div>
              <div className="text-[10.5px] leading-snug text-muted-foreground">{st.detail}</div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

const doseConfig = {
  ringRatio: { label: "Ring-time ratio", color: "var(--foreground)" },
  vri: { label: "VRI", color: "var(--muted-foreground)" },
} satisfies ChartConfig

const VOID_ML: Record<string, number> = { packed: 0, "void-s": 100, "void-m": 250, "void-l": 500 }

function DoseResponse() {
  const s = useRig()
  const ratio = s.lastPulse?.ratio ?? null
  const ml = VOID_ML[s.scenario]
  return (
    <div className="flex h-full min-h-0 flex-col gap-1">
      <div className="relative min-h-0 flex-1">
        <ChartContainer config={doseConfig} className="aspect-auto h-full w-full">
          <ComposedChart data={doseResponse} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} strokeDasharray="2 4" />
            <XAxis
              dataKey="voidMl"
              type="number"
              domain={[0, 500]}
              ticks={[0, 100, 250, 500]}
              tickFormatter={(v: number) => `${v} ml`}
              tickLine={false}
              axisLine={false}
              fontSize={9}
              height={18}
            />
            <YAxis
              yAxisId="r"
              domain={[0, 3.5]}
              ticks={[0, 1, 2, 3]}
              tickFormatter={(v: number) => `${v}x`}
              tickLine={false}
              axisLine={false}
              fontSize={9}
              width={30}
            />
            <YAxis
              yAxisId="v"
              orientation="right"
              domain={[0, 100]}
              ticks={[0, 40, 70, 100]}
              tickLine={false}
              axisLine={false}
              fontSize={9}
              width={26}
            />
            <ReferenceLine yAxisId="r" y={1.3} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.7} />
            <ReferenceLine yAxisId="r" y={1.8} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.7} />
            <ChartTooltip
              cursor={{ strokeDasharray: "2 2" }}
              content={<ChartTooltipContent indicator="line" labelFormatter={(_, p) => `${p?.[0]?.payload?.voidMl ?? ""} ml void`} />}
            />
            <Line
              yAxisId="v"
              dataKey="vri"
              type="monotone"
              stroke="var(--color-vri)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={{ r: 2.5, fill: "var(--card)", stroke: "var(--color-vri)" }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="r"
              dataKey="ringRatio"
              type="monotone"
              stroke="var(--color-ringRatio)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--foreground)" }}
              isAnimationActive={false}
            >
              <ErrorBar dataKey="err" width={5} stroke="var(--foreground)" strokeWidth={1} />
            </Line>
            {ratio && ml !== undefined && (
              <ReferenceDot
                yAxisId="r"
                x={ml}
                y={ratio}
                r={5}
                fill="#ef4444"
                stroke="var(--background)"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
              />
            )}
          </ComposedChart>
        </ChartContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[9.5px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 bg-foreground" />
          ring-time ratio +/- err
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 border-t border-dashed border-muted-foreground" />
          VRI (right axis)
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-red-500" />
          your last pulse test
        </span>
        <span className="ml-auto">dotted: 1.3x / 1.8x zones. Test T2 replaces the seed curve.</span>
      </div>
    </div>
  )
}

function LiveInference() {
  const s = useRig()
  const ag = useStore(agreement)
  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[9.5px] tracking-wider text-muted-foreground uppercase">Drives VRI</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={s.tinyMlOnDevice ? "tiny" : "laptop"}
          onValueChange={(v) => v && rig.setTinyMl(v === "tiny")}
          aria-label="Which model drives the VRI"
        >
          <ToggleGroupItem value="laptop" className="h-6 gap-1 px-2 text-[11px]">
            <LaptopIcon className="size-3" />
            P1 RF
          </ToggleGroupItem>
          <ToggleGroupItem value="tiny" className="h-6 gap-1 px-2 text-[11px]">
            <CpuIcon className="size-3" />
            P2 TinyML
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="ml-auto flex items-baseline gap-1 font-mono text-[10.5px]">
          <span className="text-[9px] tracking-wider text-muted-foreground uppercase">agree (20 s)</span>
          <Num className="text-sm font-semibold">{ag.rate === null ? "--" : pct(ag.rate)}</Num>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <ProbCompare s={s} />
      </div>
    </div>
  )
}

function StateMachine() {
  const rows = [
    { st: "GREEN" as const, enter: "default", exit: "-" },
    { st: "YELLOW" as const, enter: "VRI >= 40", exit: "VRI < 30" },
    { st: "RED" as const, enter: "VRI >= 70", exit: "ack + VRI < 50" },
  ]
  return (
    <div className="grid grid-cols-[52px_1fr_1fr] gap-x-2 gap-y-0.5 font-mono text-[10px] leading-4">
      <span className="text-[9px] tracking-wider text-muted-foreground uppercase">state</span>
      <span className="text-[9px] tracking-wider text-muted-foreground uppercase">enter</span>
      <span className="text-[9px] tracking-wider text-muted-foreground uppercase">exit</span>
      {rows.map((r) => (
        <div key={r.st} className="contents">
          <span className={cn("font-semibold", STATE[r.st].text)}>{r.st}</span>
          <span>{r.enter}</span>
          <span className="text-muted-foreground">{r.exit}</span>
        </div>
      ))}
    </div>
  )
}

export function MlLab() {
  const s = useRig()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <RigToolbar />
      <div className="grid min-h-0 flex-1 grid-cols-12 grid-rows-[minmax(0,1.3fr)_minmax(0,1fr)] gap-1.5 p-1.5">
        <div className="col-span-4 min-h-0">
          <ModelPane model={models[0]} driving={!s.tinyMlOnDevice} />
        </div>
        <div className="col-span-4 min-h-0">
          <ModelPane model={models[1]} driving={s.tinyMlOnDevice} />
        </div>
        <div className="col-span-4 min-h-0">
          <Pane title="ML training plan" icon={SplitIcon} meta="PRD 6.9" bodyClassName="flex flex-col justify-between p-2.5">
            <TrainingPlan />
            <div>
              <div className="mb-0.5 text-[9px] tracking-wider text-muted-foreground uppercase">
                Leave-one-packing-out, seed minutes
              </div>
              <SplitBar />
            </div>
          </Pane>
        </div>

        <div className="col-span-4 min-h-0">
          <Pane title="Live inference" icon={FlaskConicalIcon} meta="same stream, both models">
            <LiveInference />
          </Pane>
        </div>
        <div className="col-span-5 min-h-0">
          <Pane
            title="Dose-response"
            icon={TrendingUpIcon}
            meta="vs void volume"
            actions={<Tag className="border-dashed">SEED CURVE</Tag>}
            bodyClassName="p-1.5"
          >
            <DoseResponse />
          </Pane>
        </div>
        <div className="col-span-3 min-h-0">
          <Pane title="VRI recipe" icon={GaugeIcon} meta="100 x sum(w c)" bodyClassName="flex flex-col gap-2">
            <VriComponents s={s} />
            <div className="border-t pt-1.5">
              <StateMachine />
            </div>
            <div className="mt-auto flex items-start gap-1 text-[10px] leading-snug text-muted-foreground">
              <ScaleIcon className="mt-px size-3 shrink-0" />
              Enter and exit hold for N = 3 windows (demo: 1 s each). Noise frames (mic loud, vib quiet) are excluded.
            </div>
          </Pane>
        </div>
      </div>
    </div>
  )
}
