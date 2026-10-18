import { useEffect, useMemo, useState } from "react"
import { CrosshairIcon, EyeIcon, LayersIcon, RadarIcon, TargetIcon } from "lucide-react"
import { CircleMarker, MapContainer, Rectangle, TileLayer, Tooltip, useMap } from "react-leaflet"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { manholes, riskCells, riskLayers, surfaceReports } from "@/data/seed"
import type { RiskCell, RiskLayer } from "@/data/types"
import { cn } from "@/lib/utils"

import { ConceptBanner, HEAT, HEAT_EDGES, HEAT_LABELS, Meter, Num, Pane, STATE, Tag, heatBand } from "../ui"
import { MapSizer, TILE_ATTR, TILE_URL } from "../widgets/map"

const STEP = 0.0016
const ROLE_TAG: Record<RiskLayer["role"], string> = {
  Likelihood: "L",
  Trigger: "T",
  Evidence: "E",
  Consequence: "C",
}
const KIND_TAG: Record<RiskLayer["kind"], string> = { Static: "S", "Slow-dynamic": "SD", Dynamic: "D" }

const GROUPS = Array.from(new Set(riskLayers.map((l) => l.group)))

const ALL_ON = Object.fromEntries(riskLayers.map((l) => [l.id, true])) as Record<string, boolean>

/** PRD 8.3.2 scoring, restricted to the layers that are switched on. */
function score(c: RiskCell, on: Record<string, boolean>) {
  const vals = (role: RiskLayer["role"]) => riskLayers.filter((l) => l.role === role && on[l.id]).map((l) => c.values[l.id])
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
  const likelihood = mean(vals("Likelihood")) ?? 0
  const trigger = 0.5 + (mean(vals("Trigger")) ?? 0.5)
  const evidence = vals("Evidence").reduce((x, y) => x + y, 0) / 4
  const cons = vals("Consequence")
  const consequence = cons.length ? 0.4 + cons[0] * 0.6 : 0.7
  const raw = (likelihood * trigger + evidence) * consequence
  return { likelihood, trigger, evidence, consequence, risk: Math.min(1, raw), raw }
}

function metres(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dy = (aLat - bLat) * 111_320
  const dx = (aLon - bLon) * 111_320 * Math.cos((aLat * Math.PI) / 180)
  return Math.hypot(dx, dy)
}

function nearestNode(c: RiskCell) {
  const lat = c.lat + STEP / 2
  const lon = c.lon + STEP / 2
  return manholes
    .map((m) => ({ m, d: metres(lat, lon, m.lat, m.lon) }))
    .reduce((a, b) => (b.d < a.d ? b : a))
}

const BOUNDS: [[number, number], [number, number]] = [
  [Math.min(...riskCells.map((c) => c.lat)), Math.min(...riskCells.map((c) => c.lon))],
  [Math.max(...riskCells.map((c) => c.lat)) + STEP, Math.max(...riskCells.map((c) => c.lon)) + STEP],
]

/** Pan to the selected cell only when it has left the viewport. */
function FlyTo({ cell }: { cell: RiskCell | null }) {
  const map = useMap()
  useEffect(() => {
    if (!cell) return
    const c: [number, number] = [cell.lat + STEP / 2, cell.lon + STEP / 2]
    if (!map.getBounds().contains(c)) map.panTo(c, { animate: true })
  }, [cell, map])
  return null
}

// ---------- layers panel ----------

function LayerList({
  on,
  setOn,
  focus,
  setFocus,
}: {
  on: Record<string, boolean>
  setOn: (v: Record<string, boolean>) => void
  focus: string | null
  setFocus: (id: string | null) => void
}) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col pb-1">
        {GROUPS.map((g) => {
          const ls = riskLayers.filter((l) => l.group === g)
          const n = ls.filter((l) => on[l.id]).length
          return (
            <section key={g} className="border-b last:border-0">
              <header className="flex h-7 items-center gap-2 bg-muted/30 px-2">
                <span className="text-[10px] font-semibold tracking-wider uppercase">{g}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {n}/{ls.length}
                </span>
                <Switch
                  size="sm"
                  className="ml-auto"
                  checked={n === ls.length}
                  onCheckedChange={(v) => setOn({ ...on, ...Object.fromEntries(ls.map((l) => [l.id, v])) })}
                  aria-label={`Toggle group ${g}`}
                />
              </header>
              <ul>
                {ls.map((l) => (
                  <li
                    key={l.id}
                    className={cn(
                      "grid grid-cols-[16px_minmax(0,1fr)_auto_22px] items-center gap-x-2 px-2 py-1",
                      focus === l.id && "bg-muted/60"
                    )}
                  >
                    <Checkbox
                      className="size-3.5"
                      checked={on[l.id]}
                      onCheckedChange={(v) => setOn({ ...on, [l.id]: v === true })}
                      aria-label={l.name}
                    />
                    <div className="min-w-0">
                      <div className={cn("truncate text-[11.5px] leading-tight", !on[l.id] && "text-muted-foreground")}>{l.name}</div>
                      <div className="truncate text-[10px] leading-tight text-muted-foreground" title={l.source}>
                        {l.source}
                      </div>
                    </div>
                    <span className="flex gap-0.5">
                      <Tag title={`Role: ${l.role}`}>{ROLE_TAG[l.role]}</Tag>
                      <Tag title={`Update rate: ${l.kind}`}>{KIND_TAG[l.kind]}</Tag>
                    </span>
                    <Button
                      size="icon-xs"
                      variant={focus === l.id ? "secondary" : "ghost"}
                      className="size-5"
                      aria-label={`Focus ${l.name}`}
                      title="Show this layer alone"
                      onClick={() => setFocus(focus === l.id ? null : l.id)}
                    >
                      <EyeIcon className="size-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </ScrollArea>
  )
}

// ---------- map ----------

function RiskMap({
  scored,
  focus,
  selected,
  onSelect,
  showNodes,
  showReports,
}: {
  scored: { cell: RiskCell; risk: number }[]
  focus: string | null
  selected: RiskCell | null
  onSelect: (c: RiskCell) => void
  showNodes: boolean
  showReports: boolean
}) {
  return (
    <div className="va-map absolute inset-0">
      <MapContainer bounds={BOUNDS} className="h-full w-full">
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} maxZoom={19} />
        <MapSizer />
        <FlyTo cell={selected} />
        {scored.map(({ cell, risk }) => {
          const v = focus ? cell.values[focus] : risk
          const band = focus ? Math.min(4, Math.floor(v * 5)) : heatBand(v)
          const isSel = selected?.id === cell.id
          return (
            <Rectangle
              key={cell.id}
              bounds={[
                [cell.lat, cell.lon],
                [cell.lat + STEP, cell.lon + STEP],
              ]}
              pathOptions={{
                color: isSel ? "var(--foreground)" : "#ffffff",
                weight: isSel ? 2.5 : 0.4,
                opacity: isSel ? 1 : 0.5,
                fillColor: HEAT[band],
                fillOpacity: 0.2 + band * 0.1,
              }}
              eventHandlers={{ click: () => onSelect(cell) }}
            >
              <Tooltip sticky>
                <span className="font-mono">
                  {cell.id} {focus ? "value" : "risk"} {v.toFixed(2)} / {focus ? "" : HEAT_LABELS[band]}
                </span>
              </Tooltip>
            </Rectangle>
          )
        })}
        {showReports &&
          surfaceReports.map((r) => (
            <CircleMarker
              key={r.id}
              center={[r.lat, r.lon]}
              radius={5}
              pathOptions={{ color: "var(--foreground)", weight: 2, fillColor: "var(--background)", fillOpacity: 1 }}
            >
              <Tooltip>
                {r.id}: {r.category}
              </Tooltip>
            </CircleMarker>
          ))}
        {showNodes &&
          manholes.map((m) => (
            <CircleMarker
              key={m.id}
              center={[m.lat, m.lon]}
              radius={6}
              pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: STATE[m.state].hex, fillOpacity: 1 }}
            >
              <Tooltip>
                <span className="font-mono">
                  {m.id} {m.state} VRI {m.vri}
                </span>
              </Tooltip>
            </CircleMarker>
          ))}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-6 left-2 z-[1000] flex items-center gap-2 rounded-md border bg-background/90 px-2 py-1.5 font-mono text-[9.5px] shadow-sm backdrop-blur">
        <span className="font-sans text-[9px] tracking-wider text-muted-foreground uppercase">
          {focus ? "Layer value" : "Risk"}
        </span>
        {HEAT.map((c, i) => (
          <span key={c} className="flex items-center gap-1">
            <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: c }} />
            {focus ? `${(i * 0.2).toFixed(1)}+` : HEAT_LABELS[i]}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------- right-hand panels ----------

function Histogram({ scored, focus }: { scored: { cell: RiskCell; risk: number }[]; focus: string | null }) {
  const band = (s: { cell: RiskCell; risk: number }) => (focus ? Math.min(4, Math.floor(s.cell.values[focus] * 5)) : heatBand(s.risk))
  const counts = HEAT.map((_, i) => scored.filter((s) => band(s) === i).length)
  const max = Math.max(...counts, 1)
  return (
    <div className="flex flex-col gap-1">
      {HEAT.map((c, i) => (
        <div key={c} className="grid grid-cols-[62px_1fr_26px] items-center gap-x-2 font-mono text-[10px]">
          <span className="text-muted-foreground">{HEAT_LABELS[i]}</span>
          <div className="h-2 rounded-[2px] bg-muted">
            <div className="h-full rounded-[2px]" style={{ width: `${(counts[i] / max) * 100}%`, backgroundColor: c }} />
          </div>
          <span className="text-right tabular-nums">{counts[i]}</span>
        </div>
      ))}
      <div className="text-[9.5px] text-muted-foreground">
        {focus
          ? `raw layer value in 0.2 steps, ${scored.length} cells of ~180 m`
          : `band edges ${HEAT_EDGES.map((e) => e.toFixed(2)).join(" / ")}, ${scored.length} cells of ~180 m`}
      </div>
    </div>
  )
}

function Inspector({ cell, on }: { cell: RiskCell | null; on: Record<string, boolean> }) {
  if (!cell)
    return <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-muted-foreground">Click a cell on the map.</div>
  const sc = score(cell, on)
  const band = heatBand(sc.risk)
  const near = nearestNode(cell)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold">{cell.id}</span>
        <span className="flex items-center gap-1 font-mono text-[10.5px]">
          <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: HEAT[band] }} />
          {HEAT_LABELS[band]}
        </span>
        <Num className="ml-auto text-xl leading-none font-semibold">{sc.risk.toFixed(2)}</Num>
      </div>
      <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
        {[
          ["L", sc.likelihood, "likelihood"],
          ["T", sc.trigger, "trigger x"],
          ["E", sc.evidence, "evidence +"],
          ["C", sc.consequence, "consequence"],
        ].map(([k, v, hint]) => (
          <div key={k as string} className="rounded-sm border bg-muted/30 px-1.5 py-0.5" title={hint as string}>
            <div className="text-[9px] text-muted-foreground">{k}</div>
            <div className="tabular-nums">{(v as number).toFixed(2)}</div>
          </div>
        ))}
      </div>
      <div className="font-mono text-[10px] text-muted-foreground">risk = min(1, (L x T + E) x C)</div>
      <div className="flex flex-col gap-0.5">
        {riskLayers
          .filter((l) => on[l.id])
          .map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_70px_28px] items-center gap-x-2 text-[10.5px]">
              <span className="truncate text-muted-foreground">{l.name}</span>
              <Meter value={cell.values[l.id]} className="h-1" />
              <span className="text-right font-mono tabular-nums">{cell.values[l.id].toFixed(2)}</span>
            </div>
          ))}
      </div>
      <div className="border-t pt-1.5 font-mono text-[10.5px]">
        Nearest node <span className="font-semibold">{near.m.id}</span> at {near.d.toFixed(0)} m
        {near.d > 250 && <span className={cn("ml-1", STATE.YELLOW.text)}>(coverage gap)</span>}
      </div>
    </div>
  )
}

function Hotspots({
  ranked,
  selected,
  onSelect,
}: {
  ranked: { cell: RiskCell; risk: number; raw: number }[]
  selected: RiskCell | null
  onSelect: (c: RiskCell) => void
}) {
  const [mode, setMode] = useState<"top" | "gaps">("top")
  const rows = useMemo(() => {
    const withNode = ranked.map((r) => ({ ...r, near: nearestNode(r.cell) }))
    return (mode === "top" ? withNode : withNode.filter((r) => r.near.d > 250)).slice(0, 7)
  }, [ranked, mode])
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b p-1.5">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={mode}
          onValueChange={(v) => v && setMode(v as "top" | "gaps")}
        >
          <ToggleGroupItem value="top" className="h-6 px-2 text-[11px]">
            Top risk
          </ToggleGroupItem>
          <ToggleGroupItem value="gaps" className="h-6 px-2 text-[11px]">
            Sensor gaps
          </ToggleGroupItem>
        </ToggleGroup>
        <span className="ml-auto truncate font-mono text-[9.5px] text-muted-foreground">
          {mode === "top" ? "uncapped score" : "no node within 250 m"}
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="px-1.5 py-1">
          {rows.map((r, i) => (
            <li key={r.cell.id}>
              <button
                type="button"
                onClick={() => onSelect(r.cell)}
                className={cn(
                  "grid w-full grid-cols-[14px_44px_1fr_auto] items-center gap-x-1.5 rounded-sm px-1 py-[3px] text-left font-mono text-[10.5px] hover:bg-muted/60",
                  selected?.id === r.cell.id && "bg-muted"
                )}
              >
                <span className="text-muted-foreground">{i + 1}</span>
                <span className="font-semibold">{r.cell.id}</span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px]" style={{ backgroundColor: HEAT[heatBand(r.risk)] }} />
                  <span className="tabular-nums">{r.raw.toFixed(2)}</span>
                </span>
                <span className={cn("text-[10px] text-muted-foreground", r.near.d > 250 && STATE.YELLOW.text)}>
                  {r.near.m.id} {r.near.d.toFixed(0)} m
                </span>
              </button>
            </li>
          ))}
          {!rows.length && <li className="p-2 text-center text-[11px] text-muted-foreground">Nothing to show.</li>}
        </ul>
      </ScrollArea>
    </div>
  )
}

// ---------- page ----------

export function RiskPage() {
  const [on, setOn] = useState<Record<string, boolean>>(ALL_ON)
  const [focus, setFocus] = useState<string | null>(null)
  const [selected, setSelected] = useState<RiskCell | null>(() => riskCells.reduce((a, b) => (b.risk > a.risk ? b : a)))
  const [showNodes, setShowNodes] = useState(true)
  const [showReports, setShowReports] = useState(true)

  const scored = useMemo(
    () =>
      riskCells.map((cell) => {
        const sc = score(cell, on)
        return { cell, risk: sc.risk, raw: sc.raw }
      }),
    [on]
  )
  // Rank on the unclamped score so saturated cells do not tie at 1.00.
  const ranked = useMemo(() => [...scored].sort((a, b) => b.raw - a.raw), [scored])
  const nOn = Object.values(on).filter(Boolean).length
  const focusLayer = riskLayers.find((l) => l.id === focus)

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 p-1.5">
      <ConceptBanner>
        S3 Risk Layers mock: synthetic values on a 13 x 10 grid. Real layers (JMG, MET, InSAR) are not wired up.
      </ConceptBanner>
      <div className="grid min-h-0 flex-1 grid-cols-[290px_minmax(0,1fr)_300px] gap-1.5">
        <Pane
          title="Layers"
          icon={LayersIcon}
          meta={`${nOn}/${riskLayers.length} on`}
          actions={
            <>
              <Button size="xs" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => setOn(ALL_ON)}>
                All
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="h-5 px-1.5 text-[10px]"
                onClick={() => setOn(Object.fromEntries(riskLayers.map((l) => [l.id, false])))}
              >
                None
              </Button>
            </>
          }
          bodyClassName="p-0"
        >
          <LayerList on={on} setOn={setOn} focus={focus} setFocus={setFocus} />
        </Pane>

        <Pane
          title={focusLayer ? "Layer view" : "Composite risk"}
          icon={RadarIcon}
          meta={focusLayer ? focusLayer.name : "L x T + E, then x C"}
          actions={
            <div className="flex items-center gap-2.5 text-[10.5px]">
              {focus && (
                <Button size="xs" variant="outline" className="h-5 px-1.5 text-[10px]" onClick={() => setFocus(null)}>
                  Back to composite
                </Button>
              )}
              <label className="flex items-center gap-1">
                <Switch size="sm" checked={showNodes} onCheckedChange={setShowNodes} />
                Nodes
              </label>
              <label className="flex items-center gap-1">
                <Switch size="sm" checked={showReports} onCheckedChange={setShowReports} />
                Reports
              </label>
            </div>
          }
          bodyClassName="p-0"
        >
          <RiskMap scored={scored} focus={focus} selected={selected} onSelect={setSelected} showNodes={showNodes} showReports={showReports} />
        </Pane>

        <div className="flex min-h-0 flex-col gap-1.5">
          <div className="shrink-0">
            <Pane title="Distribution" icon={TargetIcon} meta="cells per band" className="h-auto">
              <Histogram scored={scored} focus={focus} />
            </Pane>
          </div>
          <div className="shrink-0">
            <Pane title="Cell inspector" icon={CrosshairIcon} meta={selected?.id} className="h-auto">
              <Inspector cell={selected} on={on} />
            </Pane>
          </div>
          <div className="min-h-0 flex-1">
            <Pane title="Proactive outputs" icon={TargetIcon} meta="where to look first" bodyClassName="p-0">
              <Hotspots ranked={ranked} selected={selected} onSelect={setSelected} />
            </Pane>
          </div>
        </div>
      </div>
    </div>
  )
}
