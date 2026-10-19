import {
  ArrowLeftIcon,
  Grid2X2Icon,
  MonitorDotIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react"
import { Link, NavLink, Outlet } from "react-router"

import { useTheme } from "@/components/theme-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getActiveRun, useAudioStore } from "./store"
import { Dot } from "./ui"

export function Shell() {
  const { theme, setTheme } = useTheme()
  const s = useAudioStore()
  const activeRun = getActiveRun(s)

  return (
    <div className="flex h-svh w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top Header */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-3">
          <Button asChild size="icon-xs" variant="ghost" className="size-7">
            <Link to="/" title="Return to Prototype Launcher">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight">Subsurface Sentinel</span>
            <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">
              Prototype A (Audio .WAV Runs)
            </Badge>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Navigation Links */}
          <nav className="flex items-center gap-1">
            <NavLink
              to="/a-audio/console"
              className={({ isActive }) =>
                cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )
              }
            >
              <MonitorDotIcon className="size-3.5" />
              <span>Live Console</span>
            </NavLink>

            <NavLink
              to="/a-audio/runs"
              className={({ isActive }) =>
                cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )
              }
            >
              <Grid2X2Icon className="size-3.5" />
              <span>18 Runs Matrix</span>
            </NavLink>
          </nav>
        </div>

        {/* Right Info & Dark Mode Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <Dot state={activeRun.state} />
            <span>Active: <strong className="text-foreground">{activeRun.name}</strong></span>
          </div>

          <Button
            size="icon-xs"
            variant="ghost"
            className="size-7"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Toggle theme"
          >
            {theme === "dark" ? <SunIcon className="size-3.5" /> : <MoonIcon className="size-3.5" />}
          </Button>
        </div>
      </header>

      {/* Main Outlet */}
      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
