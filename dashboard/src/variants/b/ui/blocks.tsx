import {
  CheckIcon,
  CircleDashedIcon,
  CircleIcon,
  WifiOffIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { rig, type RigSnapshot } from "@/data/rig-sim"
import { CLASS_LABELS, DATASET_TARGET_MIN, models, SCENARIOS } from "@/data/seed"
import type { AlertStatus, DatasetRow } from "@/data/types"
import { cn } from "@/lib/utils"

import { datasetTotals } from "../derive"
import { fmtDateTime, fmtTime, LIFECYCLE } from "../store"
import { ConfusionMatrix, ProbCompare } from "./charts"
import { Picker } from "./commands"
import { Panel } from "./layout"
import { LiveDot, Num, SectionLabel } from "./state"

/* ---------------- small stat ---------------- */

export function Stat({
  label,
  value,
  sub,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <Num className="truncate text-xl leading-tight font-semibold">{value}</Num>
      {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}

export function KeyValue({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right font-mono tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ---------------- dull thud vs hollow drum ---------------- */

export function ringVerdict(ratio: number | null) {
  if (ratio === null) return { label: "No baseline yet", sub: "Calibrate to compare" }
  if (ratio < 1.3) return { label: "Dull thud", sub: "Soil supports the pipe" }
  if (ratio < 1.8) return { label: "Starting to ring", sub: "Investigate" }
  return { label: "Hollow drum", sub: "Soil likely missing" }
}

export function RatioReadout({
  tauNow,
  tauBase,
  ratio,
  className,
}: {
  tauNow: number | null
  tauBase: number | null
  ratio: number | null
  className?: string
}) {
  const v = ringVerdict(ratio)
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-end gap-4">
        <div>
          <SectionLabel>Ring-down vs baseline</SectionLabel>
          <div className="flex items-baseline gap-1">
            <Num className="text-5xl leading-none font-bold">
              {ratio === null ? "n/a" : ratio.toFixed(2)}
            </Num>
            {ratio !== null && <span className="text-lg text-muted-foreground">x</span>}
          </div>
        </div>
        <div className="pb-1">
          <div className="text-sm font-semibold">{v.label}</div>
          <div className="text-xs text-muted-foreground">{v.sub}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md bg-muted/60 px-2.5 py-1.5">
          <div className="text-[11px] text-muted-foreground">tau now</div>
          <Num className="font-semibold">{tauNow === null ? "-" : `${tauNow.toFixed(1)} ms`}</Num>
        </div>
        <div className="rounded-md bg-muted/60 px-2.5 py-1.5">
          <div className="text-[11px] text-muted-foreground">tau baseline</div>
          <Num className="font-semibold">{tauBase === null ? "-" : `${tauBase.toFixed(1)} ms`}</Num>
        </div>
      </div>
    </div>
  )
}

/* ---------------- mini visuals for tiles ---------------- */

export function MiniEnvelope({
  now,
  base,
  className,
}: {
  now: number[]
  base?: number[] | null
  className?: string
}) {
  const path = (a: number[]) =>
    a.map((v, i) => `${i === 0 ? "M" : "L"}${(i / (a.length - 1)) * 100} ${30 - v * 38}`).join(" ")
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={cn("h-10 w-full", className)}>
      {base && (
        <path
          d={path(base)}
          fill="none"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
          className="stroke-muted-foreground"
        />
      )}
      <path
        d={path(now)}
        fill="none"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        className="stroke-foreground"
      />
    </svg>
  )
}

export function MiniBands({
  now,
  base,
  className,
}: {
  now: number[]
  base?: number[] | null
  className?: string
}) {
  const lo = -110
  const hi = -30
  const h = (v: number) => `${Math.max(4, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`
  return (
    <div className={cn("flex h-10 items-end gap-1", className)}>
      {now.map((v, i) => (
        <div key={i} className="relative flex-1 self-stretch">
          {base && (
            <div
              className="absolute inset-x-0 bottom-0 rounded-[2px] bg-muted-foreground/30"
              style={{ height: h(base[i]) }}
            />
          )}
          <div
            className="absolute inset-x-1 bottom-0 rounded-[2px] bg-foreground/80 transition-[height] duration-300"
            style={{ height: h(v) }}
          />
        </div>
      ))}
    </div>
  )
}

/* ---------------- lifecycle ---------------- */

export function Lifecycle({ status, className }: { status: AlertStatus; className?: string }) {
  const idx = LIFECYCLE.indexOf(status)
  return (
    <ol className={cn("flex items-start", className)}>
      {LIFECYCLE.map((st, i) => {
        const done = i < idx || status === "Closed"
        const cur = i === idx && status !== "Closed"
        return (
          <li key={st} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : done || cur ? "bg-foreground" : "bg-border")} />
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs",
                  done && "border-foreground bg-foreground text-background",
                  cur && "border-foreground bg-background ring-4 ring-foreground/15",
                  !done && !cur && "border-border text-muted-foreground"
                )}
              >
                {done ? <CheckIcon className="size-3.5" /> : cur ? <CircleIcon className="size-2 fill-current" /> : null}
              </span>
              <span
                className={cn(
                  "h-0.5 flex-1",
                  i === LIFECYCLE.length - 1 ? "opacity-0" : done ? "bg-foreground" : "bg-border"
                )}
              />
            </div>
            <span
              className={cn(
                "truncate text-[11px]",
                cur ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {st}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------------- rig controls & log ---------------- */

export function RigStatus({ snap }: { snap: RigSnapshot }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="gap-1.5">
        {snap.connected ? <LiveDot /> : <WifiOffIcon />}
        {snap.connected ? "LIVE" : "RECONNECTING"}
      </Badge>
      <Badge variant="secondary">
        <Num>{snap.transport === "wifi" ? "Wi-Fi" : "USB serial"}</Num>
        <Num>{snap.fps} fps</Num>
      </Badge>
      <Badge variant="secondary">Flow {snap.flowOn ? "ON" : "OFF"}</Badge>
      <Badge variant="secondary">{snap.wet ? "WET" : "DRY"}</Badge>
    </div>
  )
}

export function RigControls({ snap }: { snap: RigSnapshot }) {
  return (
    <Panel
      eyebrow="Demo controls"
      title="Rig bench controls"
      action={<Badge variant="outline">Drives the simulator</Badge>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm">
          <span>
            <span className="font-medium">Water flow</span>
            <span className="block text-xs text-muted-foreground">
              Switching flow creates the vibration transient
            </span>
          </span>
          <Switch checked={snap.flowOn} onCheckedChange={(v) => rig.setFlow(v)} />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm">
          <span>
            <span className="font-medium">Water at sensor (wet)</span>
            <span className="block text-xs text-muted-foreground">Binary water-contact flag</span>
          </span>
          <Switch checked={snap.wet} onCheckedChange={(v) => rig.setWet(v)} />
        </label>
      </div>
      <Picker
        label="Soil scenario (demo only: what the simulator pretends is under the pipe)"
        value={snap.scenario}
        options={SCENARIOS.map((s) => ({ value: s.id, label: s.label }))}
        onChange={(v) => rig.setScenario(v)}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => rig.dropWifi()} disabled={!snap.connected}>
          <WifiOffIcon /> Drop Wi-Fi (fall back to serial)
        </Button>
        {snap.transport === "serial" && snap.connected && (
          <Button variant="outline" size="sm" onClick={() => rig.useWifi()}>
            Back to Wi-Fi
          </Button>
        )}
      </div>
    </Panel>
  )
}

export function EventLog({ snap, rows = 8 }: { snap: RigSnapshot; rows?: number }) {
  const tone = {
    info: "bg-muted-foreground/40",
    warn: "bg-amber-500",
    alert: "bg-red-500",
    success: "bg-emerald-500",
  } as const
  return (
    <Panel eyebrow="Rig log" title="Event log">
      <ol className="flex flex-col divide-y text-sm">
        {snap.events.slice(0, rows).map((e, i) => (
          <li key={`${e.at}-${i}`} className="flex items-start gap-2 py-1.5">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", tone[e.level])} />
            <Num className="shrink-0 text-xs text-muted-foreground">{fmtTime(e.at)}</Num>
            <span className="min-w-0 flex-1">{e.text}</span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

/* ---------------- classifier ---------------- */

export function ClassifierPanel({ snap }: { snap: RigSnapshot }) {
  return (
    <Panel
      eyebrow="ML insight"
      title="What the models think"
      action={
        <label className="flex items-center gap-2 text-xs">
          <span className={cn(!snap.tinyMlOnDevice && "font-semibold")}>Laptop</span>
          <Switch
            checked={snap.tinyMlOnDevice}
            onCheckedChange={(v) => rig.setTinyMl(v)}
            aria-label="Run TinyML on the ESP32"
          />
          <span className={cn(snap.tinyMlOnDevice && "font-semibold")}>TinyML on ESP32</span>
        </label>
      }
    >
      <ProbCompare laptop={snap.laptopProbs} tiny={snap.tinyProbs} tinyActive={snap.tinyMlOnDevice} />
    </Panel>
  )
}

/* ---------------- dataset ---------------- */

export function DatasetGridPanel({ grid }: { grid: DatasetRow[] }) {
  const t = datasetTotals(grid)
  const total = DATASET_TARGET_MIN * grid.length
  return (
    <Panel
      eyebrow="Training data"
      title="Dataset progress"
      action={
        <Num className="text-sm">
          {t.full}/{t.cells} cells at target
        </Num>
      }
    >
      <div className="flex flex-col gap-1">
        <Progress value={(t.capped / total) * 100} className="h-3" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Minutes toward the {DATASET_TARGET_MIN} min per class per packing target
          </span>
          <Num>
            {t.capped.toFixed(0)} / {total} min
          </Num>
        </div>
      </div>
      <div className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] items-center gap-x-3 gap-y-2.5">
        <span />
        {[1, 2, 3].map((p) => (
          <SectionLabel key={p}>Packing {p}</SectionLabel>
        ))}
        {CLASS_LABELS.map((l) => (
          <div key={l} className="contents">
            <span className="text-sm font-medium capitalize">{l}</span>
            {([1, 2, 3] as const).map((p) => {
              const r = grid.find((x) => x.label === l && x.packing === p)!
              const full = r.minutes >= DATASET_TARGET_MIN
              return (
                <div key={p} className="flex flex-col gap-1">
                  <Progress
                    value={Math.min(100, (r.minutes / DATASET_TARGET_MIN) * 100)}
                    className={cn("h-2.5", full && "*:data-[slot=progress-indicator]:bg-emerald-500")}
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <Num>{r.minutes.toFixed(1)} min</Num>
                    <Num>{r.clips} clips</Num>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </Panel>
  )
}

/* ---------------- models ---------------- */

export function ModelCards({
  tinyActive,
  retrainedAt,
  exportedAt,
}: {
  tinyActive: boolean
  retrainedAt: number | null
  exportedAt: number | null
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {models.map((m, i) => {
        const drives = (i === 1) === tinyActive
        return (
          <Panel
            key={m.id}
            eyebrow={m.stage}
            title={m.name}
            action={
              <Badge variant={m.status === "Trained" || m.status === "Deployed" ? "default" : "secondary"}>
                {i === 1 && exportedAt ? "Exported" : m.status}
              </Badge>
            }
          >
            <div className="text-xs text-muted-foreground">
              {m.framework}. Input: {m.input}.
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-sm">
                <span>Held-out accuracy</span>
                <Num className="font-semibold">{(m.heldOutAccuracy * 100).toFixed(0)}%</Num>
              </div>
              <Progress value={m.heldOutAccuracy * 100} className="h-2.5" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Stat label="Latency" value={`${m.latencyMs} ms`} />
              <Stat label="Size" value={`${m.sizeKb} kB`} />
              <Stat label="Drives VRI" value={drives ? "Yes" : "No"} />
            </div>
            <ConfusionMatrix model={m} />
            {i === 0 && retrainedAt && (
              <div className="text-xs text-muted-foreground">Refit {fmtDateTime(new Date(retrainedAt).toISOString())} (simulated)</div>
            )}
            {i === 1 && exportedAt && (
              <div className="text-xs text-muted-foreground">Exported {fmtDateTime(new Date(exportedAt).toISOString())} (simulated)</div>
            )}
          </Panel>
        )
      })}
    </div>
  )
}

/* ---------------- task progress (the bench task, shown in-page) ---------------- */

export function TaskStrip({ snap }: { snap: RigSnapshot }) {
  const t = snap.task
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border-2 p-3",
        t ? "border-foreground/60" : "border-dashed"
      )}
    >
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          {t ? <CircleDashedIcon className="size-4 animate-spin" /> : <CircleIcon className="size-4 text-muted-foreground" />}
          {t ? t.label : "Rig idle. Issue an order from the command card."}
        </span>
        {t && <Num className="text-xs">{Math.round(t.progress * 100)}%</Num>}
      </div>
      <Progress value={t ? t.progress * 100 : 0} className="h-2.5" />
    </div>
  )
}

export function TwoUp({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>
}
