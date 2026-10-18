import { ArrowLeftIcon, BellRingIcon, FlaskConicalIcon, LayersIcon, MoonIcon, RadioTowerIcon, SearchIcon, SunIcon, WavesIcon } from "lucide-react"
import { Link, NavLink } from "react-router"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { alerts } from "@/data/seed"
import { GLASS, MODES, type Mode } from "./lib"
import { useC } from "./store"

const MODE_ICON: Record<Mode, typeof WavesIcon> = {
  prototype: FlaskConicalIcon,
  network: RadioTowerIcon,
  risk: LayersIcon,
  alerts: BellRingIcon,
}

export function isDarkNow() {
  return document.documentElement.classList.contains("dark")
}

export function ThemeButton({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  // theme state drives re-render; the DOM class is the resolved truth
  const dark = theme === "dark" || (theme === "system" && isDarkNow())
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          aria-label="Toggle dark mode"
          onClick={() => setTheme(dark ? "light" : "dark")}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Toggle dark mode (D)</TooltipContent>
    </Tooltip>
  )
}

export function TopBar({ onSearch }: { onSearch: () => void }) {
  const statuses = useC((s) => s.alertStatus)
  const open = alerts.filter((a) => statuses[a.id] !== "Closed").length
  return (
    <header className="pointer-events-none absolute inset-x-3 top-3 z-20 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
      <div className="flex items-center">
        <div className={cn(GLASS, "pointer-events-auto flex h-11 items-center gap-1 pr-3 pl-1.5")}>
          <Button asChild variant="ghost" size="sm" className="gap-1 px-2">
            <Link to="/" aria-label="All variants">
              <ArrowLeftIcon />
              <span className="hidden sm:inline">All variants</span>
            </Link>
          </Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <WavesIcon className="size-4" />
          <div className="hidden leading-none md:block">
            <div className="text-sm font-semibold tracking-tight">Subsurface Sentinel</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">Map Canvas</div>
          </div>
        </div>
      </div>

      <nav className={cn(GLASS, "pointer-events-auto flex h-11 items-center gap-0.5 p-1")} aria-label="Mode">
        {MODES.map((m) => {
          const Icon = MODE_ICON[m.id]
          return (
            <NavLink
              key={m.id}
              to={`/c/${m.id}`}
              className={({ isActive }) =>
                cn(
                  "relative flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium whitespace-nowrap transition-colors sm:px-3",
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <Icon className="size-4" />
              <span className="hidden lg:inline">{m.label}</span>
              <span className="hidden sm:inline lg:hidden">{m.short}</span>
              {m.id === "alerts" && open > 0 && (
                <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 font-mono text-[10px] font-semibold text-white tabular-nums sm:static">
                  {open}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onSearch}
          className={cn(
            GLASS,
            "pointer-events-auto flex h-11 items-center gap-2 pr-2 pl-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          )}
        >
          <SearchIcon className="size-4" />
          <span className="hidden xl:inline">Jump to manhole, alert, action</span>
          <span className="hidden sm:inline-flex">
            <Kbd>Ctrl K</Kbd>
          </span>
        </button>
        <div className={cn(GLASS, "pointer-events-auto grid h-11 place-items-center px-1")}>
          <ThemeButton />
        </div>
      </div>
    </header>
  )
}
