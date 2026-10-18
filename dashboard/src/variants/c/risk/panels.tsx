import { useMemo } from "react"
import { CrosshairIcon, LayersIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { manholes, riskCells, riskLayers } from "@/data/seed"
import type { RiskCell, RiskLayer } from "@/data/types"
import { cn } from "@/lib/utils"
import { GLASS, RISK_BANDS, cellRisk, riskBand } from "../lib"
import { SectionLabel } from "../prototype/widgets"
import { cstore, useC } from "../store"
import { ConceptTag, FloatingCard } from "../ui"

const ROLES: RiskLayer["role"][] = ["Likelihood", "Trigger", "Evidence", "Consequence"]
const GROUPS = [...new Set(riskLayers.map((l) => l.group))]

function nearestManhole(c: RiskCell) {
  let best = manholes[0]
  let d = Infinity
  for (const m of manholes) {
    const dd = (m.lat - c.lat) ** 2 + (m.lon - c.lon) ** 2
    if (dd < d) {
      d = dd
      best = m
    }
  }
  return { m: best, meters: Math.round(Math.sqrt(d) * 111_000) }
}

function useScored() {
  const ids = useC((s) => s.riskLayers)
  return useMemo(() => {
    const set = new Set(ids)
    const scored = riskCells.map((c) => ({ cell: c, ...cellRisk(c, set) }))
    return { set, scored }
  }, [ids])
}

function cellName(c: RiskCell) {
  return c.id.replace("C", "Cell ")
}

// ---------- layer picker (bottom-left, Google-Maps style) ----------

export function LayerPicker() {
  const ids = useC((s) => s.riskLayers)
  const set = new Set(ids)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn(GLASS, "pointer-events-auto h-11 gap-2 rounded-2xl px-3.5 text-sm")}>
          <LayersIcon className="size-4" />
          Layers
          <span className="rounded-full bg-foreground px-1.5 py-0.5 font-mono text-[10px] font-semibold text-background tabular-nums">
            {ids.length}/{riskLayers.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={10} className="w-[340px] gap-0 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <div>
            <div className="text-sm font-medium">Risk layers</div>
            <div className="text-[11px] text-muted-foreground">Tick layers to recompute the score on the map</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
          <Button size="xs" variant="outline" onClick={() => cstore.setLayers(riskLayers.map((l) => l.id))}>
            All
          </Button>
          <Button size="xs" variant="outline" onClick={() => cstore.setLayers(riskLayers.filter((l) => l.kind === "Static").map((l) => l.id))}>
            Static only
          </Button>
          <Button size="xs" variant="outline" onClick={() => cstore.setLayers(riskLayers.filter((l) => l.kind !== "Static").map((l) => l.id))}>
            Live only
          </Button>
          <Button size="xs" variant="outline" onClick={() => cstore.setLayers([])}>
            None
          </Button>
        </div>
        <div className="flex max-h-[min(52vh,440px)] flex-col gap-3 overflow-y-auto p-3">
          {GROUPS.map((g) => {
            const layers = riskLayers.filter((l) => l.group === g)
            const on = layers.filter((l) => set.has(l.id)).length
            const state: boolean | "indeterminate" = on === layers.length ? true : on === 0 ? false : "indeterminate"
            return (
              <div key={g} className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <Checkbox
                    checked={state}
                    onCheckedChange={(v) => {
                      const next = new Set(ids)
                      layers.forEach((l) => (v === true ? next.add(l.id) : next.delete(l.id)))
                      cstore.setLayers([...next])
                    }}
                  />
                  {g}
                  <span className="ml-auto font-mono text-[10px] font-normal text-muted-foreground tabular-nums">
                    {on}/{layers.length}
                  </span>
                </label>
                <div className="flex flex-col gap-1 pl-6">
                  {layers.map((l) => (
                    <label key={l.id} className="flex items-start gap-2 rounded-md py-0.5 text-xs">
                      <Checkbox
                        className="mt-0.5"
                        checked={set.has(l.id)}
                        onCheckedChange={(v) => cstore.toggleLayer(l.id, v === true)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{l.name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">{l.source}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                          {l.role}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{l.kind}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function RiskLegend() {
  const { scored } = useScored()
  return (
    <div className={cn(GLASS, "pointer-events-auto flex h-11 items-center gap-3 px-3.5")}>
      <span className="hidden text-[11px] font-medium text-muted-foreground sm:inline">Risk score</span>
      <div className="flex items-center gap-0.5">
        {RISK_BANDS.map((b, i) => {
          const next = RISK_BANDS[i + 1]
          const n = scored.filter((s) => s.risk >= b.min && (!next || s.risk < next.min)).length
          return (
            <div key={b.label} className="flex flex-col items-center gap-0.5" title={`${b.label}: ${n} cells`}>
              <div className="h-2.5 w-9 first:rounded-l-full last:rounded-r-full" style={{ background: b.color }} />
              <span className="font-mono text-[9px] text-muted-foreground tabular-nums">{b.min.toFixed(2)}</span>
            </div>
          )
        })}
      </div>
      <span className="hidden text-[11px] text-muted-foreground md:inline">Very low to very high</span>
    </div>
  )
}

// ---------- left: summary ----------

export function RiskSummaryCard() {
  const { set, scored } = useScored()
  const roleActive = (role: RiskLayer["role"]) => riskLayers.filter((l) => l.role === role && set.has(l.id)).length
  const max = Math.max(1, ...RISK_BANDS.map((b, i) => scored.filter((s) => s.risk >= b.min && (!RISK_BANDS[i + 1] || s.risk < RISK_BANDS[i + 1].min)).length))
  return (
    <FloatingCard className="top-[68px] left-3 w-[320px]" style={{ maxHeight: "calc(100% - 68px - 84px)" }}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <LayersIcon className="size-4" />
        <div className="text-sm font-medium">Void-risk surface</div>
        <ConceptTag className="ml-auto">Mock data (S3)</ConceptTag>
      </div>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Stage S3 mock. Each {riskCells.length}-cell grid square blends geology, load, weather and public reports. The prototype bench
          does not feed this view yet.
        </p>
        <div className="flex flex-col gap-2">
          <SectionLabel>Score formula</SectionLabel>
          <div className="rounded-xl bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
            Risk = (Likelihood x Trigger + Evidence) x Consequence
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {ROLES.map((r) => {
              const n = roleActive(r)
              const total = riskLayers.filter((l) => l.role === r).length
              return (
                <div
                  key={r}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs",
                    n === 0 && "border-dashed text-muted-foreground"
                  )}
                >
                  <span>{r}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {n}/{total}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">A role with no layers ticked is treated as neutral.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Cells by band</SectionLabel>
          {RISK_BANDS.map((b, i) => {
            const next = RISK_BANDS[i + 1]
            const n = scored.filter((s) => s.risk >= b.min && (!next || s.risk < next.min)).length
            return (
              <div key={b.label} className="grid grid-cols-[64px_1fr_28px] items-center gap-2 text-xs">
                <span className="text-muted-foreground">{b.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${(n / max) * 100}%`, background: b.color }} />
                </div>
                <span className="text-right font-mono tabular-nums">{n}</span>
              </div>
            )
          })}
        </div>
      </div>
    </FloatingCard>
  )
}

// ---------- right: hotspots + selected cell ----------

export function RiskRightCard({ onFocusCell }: { onFocusCell: (c: RiskCell) => void }) {
  const { set, scored } = useScored()
  const selectedId = useC((s) => s.selectedCell)
  const top = useMemo(() => [...scored].sort((a, b) => b.raw - a.raw).slice(0, 6), [scored])
  const sel = scored.find((s) => s.cell.id === selectedId)
  const selNear = sel ? nearestManhole(sel.cell) : null
  const contrib = sel
    ? riskLayers
        .filter((l) => set.has(l.id))
        .map((l) => ({ l, v: sel.cell.values[l.id] }))
        .sort((a, b) => b.v - a.v)
    : []
  return (
    <FloatingCard className="top-[68px] right-3 w-[320px]" style={{ maxHeight: "calc(100% - 68px - 120px)" }}>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
        {sel && selNear ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium">{cellName(sel.cell)}</div>
                <div className="text-xs text-muted-foreground">
                  {selNear.meters} m from {selNear.m.id} {selNear.m.name}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl leading-none font-semibold tabular-nums">{sel.risk.toFixed(2)}</div>
                {sel.raw > 1 && <div className="mt-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">raw {sel.raw.toFixed(2)}, capped</div>}
                <div className="mt-1 text-[11px]" style={{ color: riskBand(sel.risk).color }}>
                  <span className="rounded-full px-1.5 py-0.5 font-medium whitespace-nowrap text-foreground ring-1 ring-border">{riskBand(sel.risk).label}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 rounded-xl bg-muted/40 p-2.5 text-center">
              {[
                ["L", sel.L],
                ["T", sel.T],
                ["E", sel.E],
                ["C", sel.C],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <div className="text-[10px] text-muted-foreground">{k}</div>
                  <div className="font-mono text-sm tabular-nums">{(v as number).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <SectionLabel>Layer values in this cell</SectionLabel>
              {contrib.length === 0 && <p className="text-xs text-muted-foreground">No layers ticked.</p>}
              {contrib.map(({ l, v }) => (
                <div key={l.id} className="grid grid-cols-[1fr_72px_30px] items-center gap-2 text-xs">
                  <span className="truncate">{l.name}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-foreground/70" style={{ width: `${v * 100}%` }} />
                  </div>
                  <span className="text-right font-mono tabular-nums">{v.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="xs" className="self-start" onClick={() => cstore.selectCell(null)}>
              Clear selection
            </Button>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
            Click any grid cell to see how the score is built from the ticked layers.
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Top hotspots (raw score, capped at 1 on the map)</SectionLabel>
          {top.map((s, i) => {
            const near = nearestManhole(s.cell)
            return (
              <button
                key={s.cell.id}
                type="button"
                onClick={() => onFocusCell(s.cell)}
                className={cn(
                  "grid grid-cols-[18px_10px_1fr_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/70",
                  selectedId === s.cell.id && "bg-muted"
                )}
              >
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="size-2.5 rounded-sm" style={{ background: riskBand(s.risk).color }} />
                <span className="truncate">
                  {cellName(s.cell)} <span className="text-muted-foreground">near {near.m.id}</span>
                </span>
                <span className="flex items-center gap-1.5 font-mono tabular-nums">
                  {s.raw.toFixed(2)}
                  <CrosshairIcon className="size-3 text-muted-foreground" />
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </FloatingCard>
  )
}
