import { useEffect, useState, type ReactNode } from "react"
import {
  ArrowLeftIcon,
  BatteryMediumIcon,
  BrainCircuitIcon,
  DatabaseIcon,
  LayersIcon,
  MonitorDotIcon,
  MoonIcon,
  RadarIcon,
  RadioTowerIcon,
  SirenIcon,
  SunIcon,
  type LucideIcon,
} from "lucide-react"
import { Link, NavLink, Outlet, useLocation } from "react-router"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useRig } from "@/data/rig-sim"
import { cn } from "@/lib/utils"

import { ops, useStore } from "./store"
import { Dot, Num, STATE, StatePill, clock, zoneOf } from "./ui"

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

interface NavGroup {
  id: "proto" | "concept" | "ops"
  label: string
  tag: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    id: "proto",
    label: "Prototype",
    tag: "live rig",
    items: [
      { to: "/a/console", label: "Live Console", icon: MonitorDotIcon },
      { to: "/a/ml", label: "ML Lab", icon: BrainCircuitIcon },
      { to: "/a/dataset", label: "Dataset", icon: DatabaseIcon },
    ],
  },
  {
    id: "concept",
    label: "Production Concept",
    tag: "not built",
    items: [
      { to: "/a/network", label: "LoRaWAN Network", icon: RadioTowerIcon },
      { to: "/a/battery", label: "Battery", icon: BatteryMediumIcon },
    ],
  },
  {
    id: "ops",
    label: "Operations",
    tag: "seed data",
    items: [
      { to: "/a/alerts", label: "Alerts & Work Orders", icon: SirenIcon },
      { to: "/a/risk", label: "Risk Layers", icon: LayersIcon },
    ],
  },
]

function AppSidebar() {
  const { alerts } = useStore(ops)
  const open = alerts.filter((a) => a.status !== "Closed").length
  const s = useRig()
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Subsurface Sentinel">
              <Link to="/a/console">
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-foreground text-background">
                  <RadarIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">Subsurface Sentinel</span>
                  <span className="truncate font-mono text-[10.5px] text-muted-foreground">
                    CONTROL ROOM / ELMINA
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((g) => (
          <SidebarGroup key={g.id} className="py-1">
            <SidebarGroupLabel className="h-7 gap-2 font-mono text-[10px] tracking-wider uppercase">
              {g.label}
              <span
                className={cn(
                  "ml-auto rounded-sm px-1 py-px text-[9px] font-medium normal-case tracking-normal",
                  g.id === "concept"
                    ? "va-hazard border border-dashed border-foreground/30 text-foreground"
                    : "border text-muted-foreground"
                )}
              >
                {g.tag}
              </span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.to)} tooltip={item.label}>
                      <NavLink to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {item.to === "/a/alerts" && open > 0 && (
                      <SidebarMenuBadge className="font-mono text-[10px]">{open}</SidebarMenuBadge>
                    )}
                    {item.to === "/a/console" && (
                      <SidebarMenuBadge>
                        <Dot state={s.state} className={s.state !== "GREEN" ? "animate-pulse" : ""} />
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <div className="rounded-md border bg-background p-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">RIG-01 / XIAO ESP32S3</span>
            <StatePill state={s.state} compact />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <Num className={cn("text-2xl leading-none font-semibold", STATE[zoneOf(s.vri)].text)}>
              {s.vri}
            </Num>
            <span className="text-[10px] text-muted-foreground">VRI</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {s.transport === "wifi" ? "Wi-Fi" : "USB serial"}
            </span>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="sm" tooltip="All variants">
              <Link to="/">
                <ArrowLeftIcon />
                <span>All variants</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function Cell({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex h-full shrink-0 items-center gap-1.5 border-l px-2.5", className)}>
      <span className="text-[9.5px] tracking-wider text-muted-foreground uppercase">{label}</span>
      {children}
    </div>
  )
}

/** Ticks once a second; the rig itself updates at 15 fps so the bar rarely needs more. */
function WallClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return <Num>{clock(now)}</Num>
}

function StatusBar() {
  const s = useRig()
  const { pathname } = useLocation()
  const { theme, setTheme } = useTheme()
  const group = NAV.find((g) => g.items.some((i) => pathname.startsWith(i.to)))
  const page = group?.items.find((i) => pathname.startsWith(i.to))

  const isDark =
    theme === "dark" ||
    (theme === "system" && document.documentElement.classList.contains("dark"))

  return (
    <header className="flex h-9 shrink-0 items-center border-b bg-background text-xs">
      <div className="flex h-full min-w-0 items-center gap-1.5 pr-2 pl-1.5">
        <SidebarTrigger className="size-7" />
        <Separator orientation="vertical" className="mr-1 data-vertical:h-4" />
        <span className="hidden truncate text-muted-foreground min-[1700px]:inline">{group?.label}</span>
        <span className="hidden text-muted-foreground/50 min-[1700px]:inline">/</span>
        <span className="truncate font-medium">{page?.label}</span>
        {group?.id === "proto" && (
          <span className="ml-1 rounded-sm border px-1.5 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
            PROTOTYPE
          </span>
        )}
        {group?.id === "concept" && (
          <span className="va-hazard ml-1 rounded-sm border border-dashed border-foreground/30 px-1.5 font-mono text-[10px] font-semibold whitespace-nowrap">
            CONCEPT - NOT BUILT
          </span>
        )}
        {group?.id === "ops" && (
          <span className="ml-1 rounded-sm border px-1.5 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
            SEED DATA
          </span>
        )}
      </div>

      <div className="ml-auto flex h-full items-center">
        <Cell label="Link">
          {s.connected ? (
            <span className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60" />
                <span className="relative size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-mono font-semibold">LIVE</span>
              <span className="font-mono text-muted-foreground">
                {s.transport === "wifi" ? "Wi-Fi" : "USB serial"}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <span className="size-2 animate-pulse rounded-full bg-amber-500" />
              <span className="font-mono font-semibold">NO LINK</span>
              <span className="font-mono">fallback...</span>
            </span>
          )}
        </Cell>
        <Cell label="fps">
          <Num className="w-5 text-right">{s.connected ? s.fps : 0}</Num>
        </Cell>
        <Cell label="seq">
          <Num>{String(s.seq).padStart(6, "0")}</Num>
        </Cell>
        <Cell label="State">
          <StatePill state={s.state} compact />
        </Cell>
        <Cell label="VRI">
          <Num className={cn("w-6 text-right text-sm font-semibold", STATE[zoneOf(s.vri)].text)}>
            {s.vri}
          </Num>
        </Cell>
        <Cell label="Task" className="w-[180px]">
          {s.task ? (
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex justify-between gap-2 text-[10px] leading-none">
                <span className="truncate">{s.task.label}</span>
                <Num>{Math.round(s.task.progress * 100)}%</Num>
              </div>
              <Progress value={s.task.progress * 100} className="h-1" />
            </div>
          ) : (
            <span className="font-mono text-muted-foreground">idle</span>
          )}
        </Cell>
        <Cell label="MYT">
          <WallClock />
        </Cell>
        <div className="flex h-full items-center gap-1 border-l px-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-1.5 text-xs"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {isDark ? <SunIcon className="size-3.5" /> : <MoonIcon className="size-3.5" />}
            <Kbd className="h-4 min-w-4 text-[10px]">D</Kbd>
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-xs" asChild>
            <Link to="/" title="All variants" aria-label="All variants">
              <ArrowLeftIcon className="size-3.5" />
              <span className="hidden min-[1600px]:inline">All variants</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

export function Shell() {
  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      <AppSidebar />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
        <StatusBar />
        <div className="min-h-0 flex-1">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
