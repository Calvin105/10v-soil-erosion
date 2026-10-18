import {
  EyeIcon,
  EyeOffIcon,
  ListChecksIcon,
  MapPinPlusIcon,
  SirenIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { CircleMarker, Tooltip as LTooltip } from "react-leaflet"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { riskCells, riskLayers } from "@/data/seed"
import type { NodeState, RiskCell, RiskLayer } from "@/data/types"
import { cn } from "@/lib/utils"
import { useNetwork } from "@/data/network-sim"

import { paths } from "../paths"
import { bandOf, cutoffs, nearestManhole, RISK_GROUPS, scoreAll, slug } from "../risk"
import { queueRiskJob, setRiskLayer, setRiskLayers, useGame, useLaneBusy } from "../store"
import { Stat } from "../ui/blocks"
import { CommandPanel, type Command } from "../ui/commands"
import { LevelLayout, Panel, TOWNSHIP_CRUMB, type Crumb } from "../ui/layout"
import { BaseMap, boundsOf, ManholeMarkers } from "../ui/maps"
import { NotFound } from "../ui/not-found"
import { ConceptTag, Num, SectionLabel, STATE_META } from "../ui/state"
import { Tag, Tile } from "../ui/tiles"

const RISK_CRUMB: Crumb = { label: "Risk Intel", to: paths.risk }

const COLS = 13
const ROWS = 10

const BAND_FILL: Record<NodeState, string> = {
  GREEN: "bg-muted",
  YELLOW: "bg-amber-500/45",
  RED: "bg-red-500/70",
}

/* ---------- heat grid (north up) ---------- */

function HeatGrid({
  value,
  band,
  onPick,
  picked,
  marks,
}: {
  value: (c: RiskCell) => number
  band?: (c: RiskCell) => NodeState
  onPick?: (c: RiskCell) => void
  picked?: string | null
  marks?: Record<string, "watch" | "place">
}) {
  const ordered = useMemo(() => {
    const rows: RiskCell[][] = []
    for (let r = ROWS - 1; r >= 0; r--) rows.push(riskCells.slice(r * COLS, r * COLS + COLS))
    return rows.flat()
  }, [])
  return (
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
      {ordered.map((c) => {
        const v = value(c)
        const b = band?.(c)
        return (
          <button
            key={c.id}
            type="button"
            title={`${c.id}  ${(v * 100).toFixed(0)}`}
            onClick={() => onPick?.(c)}
            className={cn(
              "relative aspect-square rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
              b ? BAND_FILL[b] : "bg-foreground",
              picked === c.id && "ring-2 ring-foreground",
              marks?.[c.id] === "watch" && "ring-2 ring-foreground",
              marks?.[c.id] === "place" && "border-2 border-dashed border-foreground"
            )}
            style={!b ? { opacity: 0.06 + v * 0.8 } : undefined}
          >
            {marks?.[c.id] && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                {marks[c.id] === "watch" ? "W" : "+"}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- risk map ---------- */

function RiskMap({
  score,
  cut,
  marks,
  onPick,
}: {
  score: Map<string, number>
  cut: { high: number; medium: number }
  marks: Record<string, "watch" | "place">
  onPick: (c: RiskCell) => void
}) {
  const net = useNetwork()
  const navigate = useNavigate()
  return (
    <BaseMap bounds={boundsOf(riskCells, 0.0008)} className="h-96">
      {riskCells.map((c) => {
        const s = score.get(c.id) ?? 0
        const b = bandOf(s, cut)
        const hex = STATE_META[b].hex
        const mark = marks[c.id]
        return (
          <CircleMarker
            key={c.id}
            center={[c.lat, c.lon]}
            radius={16}
            pathOptions={{
              color: mark ? "#111" : hex,
              weight: mark ? 3 : 0,
              dashArray: mark === "place" ? "4 4" : undefined,
              fillColor: hex,
              fillOpacity: b === "GREEN" ? 0.06 : b === "YELLOW" ? 0.3 : 0.5,
            }}
            eventHandlers={{ click: () => onPick(c) }}
          >
            <LTooltip direction="top">
              <span className="font-mono text-xs">
                {c.id} risk {(s * 100).toFixed(0)}
              </span>
            </LTooltip>
          </CircleMarker>
        )
      })}
      <ManholeMarkers nodes={net.nodes} onSelect={(m) => navigate(paths.manhole(m))} />
    </BaseMap>
  )
}

/* ---------- cell detail ---------- */

function CellDetail({ cell, score, on }: { cell: RiskCell | null; score: number; on: Record<string, boolean> }) {
  if (!cell) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Pick a cell on the map or grid to see which layers drive it.
      </p>
    )
  }
  const near = nearestManhole(cell.lat, cell.lon)
  const rows = riskLayers
    .map((l) => ({ l, v: cell.values[l.id], on: on[l.id] !== false }))
    .sort((a, b) => b.v - a.v)
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Cell" value={cell.id} />
        <Stat label="Risk" value={(score * 100).toFixed(0)} />
        <Stat label="Nearest" value={near.manhole.id} sub={`${near.metres.toFixed(0)} m`} />
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.slice(0, 6).map(({ l, v, on: enabled }) => (
          <li key={l.id} className={cn("grid grid-cols-[1fr_90px_34px] items-center gap-2 text-xs", !enabled && "opacity-40")}>
            <span className="truncate">{l.name}</span>
            <Progress value={v * 100} className="h-1.5" />
            <Num className="text-right">{(v * 100).toFixed(0)}</Num>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Risk Intel (site)                                                   */
/* ------------------------------------------------------------------ */

export function RiskPage() {
  const on = useGame((s) => s.riskOn)
  const watch = useGame((s) => s.watchList)
  const placement = useGame((s) => s.placement)
  const busy = useLaneBusy("risk")
  const navigate = useNavigate()
  const [picked, setPicked] = useState<RiskCell | null>(null)

  const scored = useMemo(() => scoreAll(on), [on])
  const score = useMemo(() => new Map(scored.map((s) => [s.cell.id, s.score])), [scored])
  const cut = useMemo(() => cutoffs(scored.map((s) => s.score)), [scored])
  const marks = useMemo(() => {
    const m: Record<string, "watch" | "place"> = {}
    watch?.forEach((id) => (m[id] = "watch"))
    placement?.forEach((id) => (m[id] = "place"))
    return m
  }, [watch, placement])
  const enabledCount = riskLayers.filter((l) => on[l.id] !== false).length
  const high = scored.filter((s) => bandOf(s.score, cut) === "RED").length

  const commands: Command[] = [
    {
      id: "watch",
      hotkey: "w",
      label: "Build pre-storm watch-list",
      icon: ListChecksIcon,
      mode: "sim",
      primary: true,
      hint: "Ranks the top 5 cells from the layers that are switched on.",
      disabled: busy,
      reason: "A risk job is already running.",
      run: () => queueRiskJob("watch", "Risk Intel"),
    },
    {
      id: "place",
      hotkey: "p",
      label: "Suggest sensor placement",
      icon: MapPinPlusIcon,
      mode: "sim",
      hint: "Finds high-risk cells that no node covers yet.",
      disabled: busy,
      reason: "A risk job is already running.",
      run: () => queueRiskJob("placement", "Risk Intel"),
    },
    {
      id: "all",
      hotkey: "a",
      label: "All layers on",
      icon: EyeIcon,
      mode: "instant",
      run: () => setRiskLayers(riskLayers.map((l) => l.id), true),
    },
    {
      id: "none",
      hotkey: "x",
      label: "All layers off",
      icon: EyeOffIcon,
      mode: "instant",
      run: () => setRiskLayers(riskLayers.map((l) => l.id), false),
    },
    {
      id: "missions",
      hotkey: "m",
      label: "Open Missions",
      icon: SirenIcon,
      mode: "nav",
      run: () => navigate(paths.missions),
    },
  ]

  return (
    <LevelLayout
      crumbs={[TOWNSHIP_CRUMB, RISK_CRUMB]}
      level="Site"
      depthMax={2}
      title="Risk Intel"
      subtitle="Where to look before a sensor says so. A mock of the S3 predictive risk map on synthetic data."
      badges={
        <>
          <Badge variant="outline">Mock data</Badge>
          <ConceptTag />
        </>
      }
      commands={<CommandPanel title="Risk Intel orders" commands={commands} />}
    >
      <section className="flex flex-col gap-3">
        <SectionLabel>Select a layer group</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {RISK_GROUPS.map((g, i) => {
            const layers = riskLayers.filter((l) => l.group === g)
            const n = layers.filter((l) => on[l.id] !== false).length
            return (
              <Tile
                key={g}
                to={paths.riskGroup(g)}
                hotkey={String(i + 1)}
                dashed
                eyebrow={`Group / ${layers[0].role}`}
                title={g}
                subtitle={layers.map((l) => l.name).join(", ")}
                bar={(n / layers.length) * 100}
                barLabel="Layers on"
                barRight={`${n}/${layers.length}`}
                className="min-h-0"
              />
            )
          })}
        </div>
      </section>

      <Panel
        eyebrow="Composite"
        title="Predicted risk from the enabled layers"
        action={
          <div className="flex items-center gap-2">
            <Num className="text-xs text-muted-foreground">
              {enabledCount}/{riskLayers.length} layers / {high} hot cells
            </Num>
            <ConceptTag />
          </div>
        }
      >
        <Tabs defaultValue="map">
          <TabsList>
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="grid">Grid</TabsTrigger>
          </TabsList>
          <TabsContent value="map" className="mt-3">
            <RiskMap score={score} cut={cut} marks={marks} onPick={setPicked} />
          </TabsContent>
          <TabsContent value="grid" className="mt-3">
            <HeatGrid
              value={(c) => score.get(c.id) ?? 0}
              band={(c) => bandOf(score.get(c.id) ?? 0, cut)}
              picked={picked?.id}
              onPick={setPicked}
              marks={marks}
            />
          </TabsContent>
        </Tabs>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {(["GREEN", "YELLOW", "RED"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded-[3px]", STATE_META[s].dot, s === "GREEN" && "opacity-30")} />
              {s === "GREEN" ? "Lower" : s === "YELLOW" ? "Elevated" : "Highest 12%"}
            </span>
          ))}
          <span>W = watch-list, + = suggested sensor. Dots are existing nodes.</span>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Selected" title="Why this cell?">
          <CellDetail cell={picked} score={picked ? (score.get(picked.id) ?? 0) : 0} on={on} />
        </Panel>
        <div className="flex flex-col gap-4">
          <ResultList
            title="Pre-storm watch-list"
            ids={watch}
            score={score}
            empty="Not built yet. Press W."
            onPick={(id) => setPicked(riskCells.find((c) => c.id === id) ?? null)}
          />
          <ResultList
            title="Suggested sensor placement"
            ids={placement}
            score={score}
            empty="Not computed yet. Press P."
            onPick={(id) => setPicked(riskCells.find((c) => c.id === id) ?? null)}
          />
        </div>
      </div>
    </LevelLayout>
  )
}

function ResultList({
  title,
  ids,
  score,
  empty,
  onPick,
}: {
  title: string
  ids: string[] | null
  score: Map<string, number>
  empty: string
  onPick: (id: string) => void
}) {
  return (
    <Panel eyebrow="Result" title={title}>
      {ids ? (
        <ol className="flex flex-col divide-y text-sm">
          {ids.map((id, i) => {
            const c = riskCells.find((x) => x.id === id)!
            const near = nearestManhole(c.lat, c.lon)
            return (
              <li key={id}>
                <button type="button" onClick={() => onPick(id)} className="flex w-full items-center gap-3 py-1.5 text-left hover:bg-muted/50">
                  <Num className="w-4 text-muted-foreground">{i + 1}</Num>
                  <Num className="w-14 font-semibold">{id}</Num>
                  <span className="flex-1 text-xs text-muted-foreground">
                    {near.metres.toFixed(0)} m from {near.manhole.id}
                  </span>
                  <Num>{((score.get(id) ?? 0) * 100).toFixed(0)}</Num>
                </button>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* Group                                                               */
/* ------------------------------------------------------------------ */

export function RiskGroupRoute() {
  const { group } = useParams()
  const name = RISK_GROUPS.find((g) => slug(g) === group)
  if (!name) return <NotFound what="layer group" />
  return <RiskGroupView key={name} group={name} />
}

function RiskGroupView({ group }: { group: string }) {
  const on = useGame((s) => s.riskOn)
  const layers = riskLayers.filter((l) => l.group === group)
  const [focus, setFocus] = useState<RiskLayer>(layers[0])
  const navigate = useNavigate()

  const commands: Command[] = [
    {
      id: "on",
      hotkey: "a",
      label: "Enable all in group",
      icon: EyeIcon,
      mode: "instant",
      primary: true,
      run: () => setRiskLayers(layers.map((l) => l.id), true),
    },
    {
      id: "off",
      hotkey: "x",
      label: "Disable all in group",
      icon: EyeOffIcon,
      mode: "instant",
      run: () => setRiskLayers(layers.map((l) => l.id), false),
    },
    {
      id: "back",
      hotkey: "c",
      label: "Back to composite",
      icon: ListChecksIcon,
      mode: "nav",
      run: () => navigate(paths.risk),
    },
  ]

  return (
    <LevelLayout
      crumbs={[TOWNSHIP_CRUMB, RISK_CRUMB, { label: group, to: paths.riskGroup(group) }]}
      level="Layer group"
      depthMax={2}
      title={group}
      subtitle="Switch layers on or off. The composite map on Risk Intel recomputes from what is on."
      badges={<ConceptTag />}
      commands={<CommandPanel title={`${group} orders`} commands={commands} />}
    >
      <section className="flex flex-col gap-3">
        <SectionLabel>Layers in this group</SectionLabel>
        <ul className="flex flex-col gap-3">
          {layers.map((l) => {
            const enabled = on[l.id] !== false
            return (
              <li
                key={l.id}
                className={cn(
                  "flex items-center gap-4 rounded-xl border-2 bg-card p-4 transition-colors",
                  focus.id === l.id && "border-foreground/60",
                  !enabled && "opacity-60"
                )}
              >
                <button type="button" onClick={() => setFocus(l)} className="min-w-0 flex-1 text-left outline-none">
                  <div className="text-base font-semibold">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{l.source}</div>
                  <div className="mt-1.5 flex gap-1.5">
                    <Tag>{l.role}</Tag>
                    <Tag>{l.kind}</Tag>
                  </div>
                </button>
                <Switch checked={enabled} onCheckedChange={(v) => setRiskLayer(l.id, v)} aria-label={`Toggle ${l.name}`} />
              </li>
            )
          })}
        </ul>
      </section>

      <Panel eyebrow="Preview" title={focus.name}>
        <div className="max-w-xl"><HeatGrid value={(c) => c.values[focus.id]} /></div>
        <p className="text-xs text-muted-foreground">
          Darker cell = stronger signal for this layer alone. North is up. Synthetic values, not real survey data.
        </p>
      </Panel>
    </LevelLayout>
  )
}
