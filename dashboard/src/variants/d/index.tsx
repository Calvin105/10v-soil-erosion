import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import {
  ActivityIcon,
  ArrowLeftIcon,
  MapPinIcon,
  RadioIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  CitizenReportDialog,
  DEFAULT_REPORT_LOCATION,
  type ReportLocation,
} from "./components/citizen-report-dialog"
import { CompareView } from "./components/compare-view"
import { NetworkView } from "./components/network-view"
import { TicketsSheet } from "./components/tickets-sheet"
import { useVariantDStore, variantDStore } from "./store"

export default function VariantD() {
  const location = useLocation()
  const navigate = useNavigate()
  const s = useVariantDStore()

  const [ticketsOpen, setTicketsOpen] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [reportLocation, setReportLocation] = useState<ReportLocation>(DEFAULT_REPORT_LOCATION)
  const [picking, setPicking] = useState(false)
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)

  // Initialize MQTT and health monitoring on mount
  useEffect(() => {
    variantDStore.init()
    return () => {
      variantDStore.cleanup()
    }
  }, [])

  // Sync tab with URL
  const currentTab = location.pathname.includes("/compare") ? "compare" : "network"

  const handleTabChange = (value: string) => {
    if (value === "compare") {
      navigate("/d/compare")
    } else {
      navigate("/d/network")
    }
  }

  // Handle asset click from map or overlay list
  const handleSelectAsset = (assetId: string) => {
    const node = s.nodes[assetId]
    if (node) {
      setFlyTarget([node.lat, node.lon])
      return
    }

    const pipe = s.pipes.find((p) => p.id === assetId)
    if (pipe) {
      const from = s.nodes[pipe.fromId]
      const to = s.nodes[pipe.toId]
      if (from && to) {
        setFlyTarget([(from.lat + to.lat) / 2, (from.lon + to.lon) / 2])
      }
    }
  }

  const newTicketsCount = s.tickets.filter((t) => t.status === "New").length
  const mqttConnected = s.mqttStatus === "connected"
  const isOffline = s.offlineSeconds !== null && s.offlineSeconds >= 5

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Minimal Top Bar per Prompt §2 & §3 */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-md">
        {/* Left: Branding & Launcher link */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" asChild>
            <Link to="/">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
              <ActivityIcon className="h-4 w-4 text-primary" />
              Subsurface Sentinel
            </h1>
          </div>
        </div>

        {/* Center: Tabs Switcher (Network vs Compare) */}
        <div className="flex items-center justify-center">
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-[280px]">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="network" className="text-xs font-semibold">
                1. Network
              </TabsTrigger>
              <TabsTrigger value="compare" className="text-xs font-semibold">
                2. Compare (WAV)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Right: Live connection dot, "Report a problem", "Tickets (n)" */}
        <div className="flex items-center gap-2.5">
          {/* Live MQTT Connection Dot */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 cursor-default">
                <span className="relative flex h-2 w-2">
                  {mqttConnected && !isOffline && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${
                      mqttConnected && !isOffline
                        ? "bg-emerald-500"
                        : isOffline
                        ? "bg-amber-500"
                        : "bg-muted-foreground"
                    }`}
                  />
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {mqttConnected && !isOffline ? "Live MQTT" : isOffline ? `Offline (${s.offlineSeconds}s)` : "Connecting"}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {mqttConnected
                ? "Connected to wss://broker.hivemq.com:8884/mqtt on topic sentinel/acoustic/telemetry"
                : "Connecting to MQTT WebSocket broker..."}
            </TooltipContent>
          </Tooltip>

          {/* Citizen "Report a problem" Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReportDialogOpen(true)}
            className="h-8 text-xs font-semibold gap-1.5 border-border/80 hover:bg-muted/60"
          >
            <MapPinIcon className="h-3.5 w-3.5 text-red-500" />
            Report a problem
          </Button>

          {/* Unified "Tickets (n)" Button */}
          <Button
            variant="default"
            size="sm"
            onClick={() => setTicketsOpen(true)}
            className="relative h-8 text-xs font-semibold gap-1.5"
          >
            <RadioIcon className="h-3.5 w-3.5" />
            Tickets
            {newTicketsCount > 0 && (
              <Badge className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
                {newTicketsCount}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 overflow-x-hidden">
        {currentTab === "network" ? (
          <NetworkView
            onSelectAsset={handleSelectAsset}
            onOpenTickets={() => setTicketsOpen(true)}
            onReport={() => setReportDialogOpen(true)}
            picking={picking}
            onPickLocation={(lat, lon) => {
              setReportLocation({ lat, lon, name: `Map selection (${lat.toFixed(4)}, ${lon.toFixed(4)})` })
              setPicking(false)
              setReportDialogOpen(true)
            }}
            onCancelPick={() => {
              setPicking(false)
              setReportDialogOpen(true)
            }}
            flyTarget={flyTarget}
          />
        ) : (
          <CompareView />
        )}
      </main>

      {/* Unified Dispatch Tickets Sheet */}
      <TicketsSheet
        open={ticketsOpen}
        onOpenChange={setTicketsOpen}
        onFlyTo={(target) => {
          setFlyTarget(target)
          setTicketsOpen(false)
        }}
      />

      {/* Citizen Report Dialog */}
      <CitizenReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        location={reportLocation}
        onLocationChange={setReportLocation}
        onPickOnMap={
          currentTab === "network"
            ? () => {
                setReportDialogOpen(false)
                setPicking(true)
              }
            : undefined
        }
      />
    </div>
  )
}
