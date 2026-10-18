import type { LucideIcon } from "lucide-react"
import {
  ArrowLeftIcon,
  BatteryMediumIcon,
  BrainCircuitIcon,
  DatabaseIcon,
  MoonIcon,
  RadioTowerIcon,
  SirenIcon,
  SunIcon,
  UsersIcon,
} from "lucide-react"
import { Link } from "react-router"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useNetwork } from "@/data/network-sim"
import { useRig } from "@/data/rig-sim"
import { cn } from "@/lib/utils"

import { activeModel, datasetGrid, datasetTotals, DATASET_TARGET_TOTAL } from "../derive"
import { busyCrews, CREWS, useGame } from "../store"
import { LiveDot, Num } from "./state"

function Res({
  icon: Icon,
  label,
  value,
  of,
  fill,
  tip,
  alarm,
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  of?: React.ReactNode
  fill: number
  tip: React.ReactNode
  alarm?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex min-w-0 items-center gap-2 px-3 first:pl-0">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted",
              alarm && "bg-red-500/15 text-red-700 dark:text-red-400"
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-baseline gap-1 leading-none">
              <Num className={cn("text-base font-bold", alarm && "text-red-700 dark:text-red-400")}>
                {value}
              </Num>
              {of !== undefined && <Num className="text-xs text-muted-foreground">/{of}</Num>}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                {label}
              </span>
            </div>
            <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full bg-foreground/70", alarm && "bg-red-500")}
                style={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {tip}
      </TooltipContent>
    </Tooltip>
  )
}

export function Hud() {
  const snap = useRig()
  const net = useNetwork()
  const alerts = useGame((s) => s.alerts)
  const workOrders = useGame((s) => s.workOrders)
  const queue = useGame((s) => s.queue)
  const packingByAt = useGame((s) => s.packingByAt)
  const benchPacking = useGame((s) => s.benchPacking)
  const { theme, setTheme } = useTheme()

  const concept = net.nodes.length
  const conceptOnline = net.nodes.filter((n) => n.lastUplinkMinAgo < 60).length
  const nodesOnline = conceptOnline + (snap.connected ? 1 : 0)
  const open = alerts.filter((a) => a.status !== "Closed")
  const p1 = open.filter((a) => a.priority === "P1").length
  const busy = busyCrews({ alerts, workOrders, queue })
  const crewsFree = CREWS.filter((c) => !busy.has(c)).length
  const avgBattery = net.nodes.reduce((a, n) => a + n.batteryPct, 0) / Math.max(1, concept)
  const totals = datasetTotals(datasetGrid(snap.recordings, packingByAt, benchPacking))
  const model = activeModel(snap.tinyMlOnDevice)

  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4">
        <Link to="/b" className="flex shrink-0 flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight">Subsurface Sentinel</span>
          <span className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Command
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center divide-x overflow-x-auto border-l pl-3 [scrollbar-width:none]">
          <Res
            icon={RadioTowerIcon}
            label="Nodes online"
            value={nodesOnline}
            of={concept + 1}
            fill={nodesOnline / (concept + 1)}
            tip={
              <>
                {conceptOnline}/{concept} concept LoRaWAN nodes (simulated) + bench RIG-01{" "}
                {snap.connected ? "live" : "reconnecting"}.
              </>
            }
          />
          <Res
            icon={SirenIcon}
            label="Open alerts"
            value={open.length}
            fill={open.length / Math.max(1, alerts.length)}
            alarm={p1 > 0}
            tip={`${open.length} open missions, ${p1} at P1.`}
          />
          <Res
            icon={UsersIcon}
            label="Crews free"
            value={crewsFree}
            of={CREWS.length}
            fill={crewsFree / CREWS.length}
            tip={CREWS.map((c) => `${c}: ${busy.has(c) ? "deployed" : "available"}`).join(" / ")}
          />
          <Res
            icon={BatteryMediumIcon}
            label="Avg battery"
            value={`${avgBattery.toFixed(0)}%`}
            fill={avgBattery / 100}
            tip="Concept nodes only (simulated). Concept estimate, needs a measured current profile."
          />
          <Res
            icon={DatabaseIcon}
            label="Dataset min"
            value={totals.minutes.toFixed(0)}
            of={DATASET_TARGET_TOTAL}
            fill={totals.capped / DATASET_TARGET_TOTAL}
            tip={`${totals.full}/${totals.cells} class x packing cells at the 10 min target. Bar counts minutes up to each cell's target.`}
          />
          <Res
            icon={BrainCircuitIcon}
            label={snap.tinyMlOnDevice ? "TinyML acc" : "Laptop acc"}
            value={`${Math.round(model.heldOutAccuracy * 100)}%`}
            fill={model.heldOutAccuracy}
            tip={`${model.stage}: ${model.name}. Held-out accuracy. This model currently drives the VRI.`}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/b/lab/rig-01"
            className="flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
          >
            {snap.connected ? <LiveDot /> : <span className="size-2 rounded-full bg-muted-foreground" />}
            <span>RIG-01</span>
            <Num className="text-muted-foreground">
              {snap.connected ? `${snap.transport === "wifi" ? "Wi-Fi" : "Serial"} ${snap.fps} fps` : "reconnecting"}
            </Num>
          </Link>
          <Button
            variant="outline"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeftIcon /> All variants
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
