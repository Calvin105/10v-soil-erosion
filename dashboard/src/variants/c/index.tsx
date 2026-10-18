import { useEffect, useMemo, useState } from "react"
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router"

import { rig } from "@/data/rig-sim"
import { alerts, gateways, manholes, surfaceReports } from "@/data/seed"
import type { RiskCell } from "@/data/types"
import { AlertList, AlertSheetBody, ReportSheetBody } from "./alerts/panels"
import { CommandPalette } from "./command-palette"
import { useMediaQuery } from "./hooks"
import { MODES, type Mode } from "./lib"
import { MapCanvas, type Insets } from "./map-canvas"
import { ConceptSheetBody } from "./network/concept-sheet"
import { ManholeSheetBody } from "./network/manhole-sheet"
import { ConceptCard, UplinkFeed } from "./network/panels"
import { Dock, DOCK_H, DOCK_H_MIN } from "./prototype/dock"
import { LabSheet } from "./prototype/lab-sheet"
import { BenchCard, InsightCard } from "./prototype/side-cards"
import { LayerPicker, RiskLegend, RiskRightCard, RiskSummaryCard } from "./risk/panels"
import { cstore, useC } from "./store"
import { TopBar } from "./top-bar"
import { ConceptTag, SideSheet } from "./ui"
import "./map.css"

export default function VariantC() {
  return (
    <Routes>
      <Route index element={<Navigate to="/c/prototype" replace />} />
      <Route path="*" element={<Shell />} />
    </Routes>
  )
}

function Shell() {
  const { pathname } = useLocation()
  const seg = pathname.split("/").filter(Boolean) // ["c", "network", "MH-07"]
  const mode = MODES.find((m) => m.id === seg[1])?.id
  if (!mode) return <Navigate to="/c/prototype" replace />
  return <Frame mode={mode} param={seg[2] ? decodeURIComponent(seg[2]) : null} />
}

const SHEET_W = { manhole: 420, concept: 470, alert: 450 }

function Frame({ mode, param }: { mode: Mode; param: string | null }) {
  const navigate = useNavigate()
  const wide = useMediaQuery("(min-width: 1280px)")
  const mid = useMediaQuery("(min-width: 1024px)")
  const dockMin = useC((s) => s.dockMinimized)
  const [palette, setPalette] = useState(false)
  const [riskFocus, setRiskFocus] = useState<[number, number][] | null>(null)

  // assign queued packing numbers to finished recordings (dataset by packing)
  useEffect(() => {
    const off = rig.subscribe(() => cstore.claimPacking(rig.snapshot.recordings.map((r) => r.at)))
    return () => void off()
  }, [])
  const [prevMode, setPrevMode] = useState(mode)
  if (prevMode !== mode) {
    setPrevMode(mode)
    setRiskFocus(null)
  }

  // ---- what is selected / which sheet is open ----
  const manhole = mode === "network" && param ? manholes.find((m) => m.id === param) : undefined
  const conceptTab = mode === "network" && (param === "battery" || param === "payload") ? param : null
  const alert = mode === "alerts" && param ? alerts.find((a) => a.id === param) : undefined
  const report = mode === "alerts" && param ? surfaceReports.find((r) => r.id === param) : undefined
  const labOpen = mode === "prototype" && param === "lab"

  const sheetW = manhole ? SHEET_W.manhole : conceptTab ? SHEET_W.concept : alert || report ? SHEET_W.alert : 0
  const sheetOpen = sheetW > 0
  const selected = manhole?.id ?? alert?.id ?? report?.id ?? null

  const focus = useMemo<[number, number][] | null>(() => {
    if (manhole) {
      // show the node together with the gateway it talks to, so the link is visible
      const gw = gateways.find((g) => g.id === manhole.gatewayId)
      return [[manhole.lat, manhole.lon], ...(gw ? [[gw.lat, gw.lon] as [number, number]] : [])]
    }
    if (alert) {
      const m = manholes.find((x) => x.id === alert.manholeId)!
      const reps = surfaceReports.filter((r) => alert.linkedReports.includes(r.id))
      return [[m.lat, m.lon], ...reps.map((r) => [r.lat, r.lon] as [number, number])]
    }
    if (report) {
      const m = manholes.find((x) => x.id === report.nearManholeId)
      return [[report.lat, report.lon], ...(m ? [[m.lat, m.lon] as [number, number]] : [])]
    }
    if (mode === "risk") return riskFocus
    return null
  }, [manhole, alert, report, mode, riskFocus])

  const insets = useMemo<Insets>(() => {
    const top = 72
    const sheet = sheetOpen ? sheetW + 24 : 0
    switch (mode) {
      case "prototype":
        return {
          top,
          left: wide ? 324 : 12,
          right: wide ? 344 : 12,
          bottom: (dockMin ? DOCK_H_MIN : DOCK_H) + 24,
        }
      case "network":
        return { top, left: mid ? 344 : 12, right: sheet || (mid ? 410 : 12), bottom: 24, sheet }
      case "risk":
        return { top, left: mid ? 344 : 12, right: mid ? 344 : 12, bottom: 72 }
      case "alerts":
        return { top, left: mid ? 372 : 12, right: sheet || 12, bottom: mid ? 24 : 320, sheet }
    }
  }, [mode, wide, mid, dockMin, sheetOpen, sheetW])

  const closeSheet = () => navigate(`/c/${mode}`)

  const focusCell = (c: RiskCell) => {
    cstore.selectCell(c.id)
    setRiskFocus([[c.lat, c.lon]])
  }

  return (
    <div className="relative h-svh w-full overflow-hidden bg-muted text-foreground">
      <MapCanvas mode={mode} selected={selected} focus={focus} insets={insets} />

      <div className="pointer-events-none absolute inset-0 z-10">
        <TopBar onSearch={() => setPalette(true)} />

        {mode === "prototype" && (
          <>
            {wide && <BenchCard bottom={dockMin ? DOCK_H_MIN : DOCK_H} />}
            {wide && <InsightCard bottom={dockMin ? DOCK_H_MIN : DOCK_H} />}
            <Dock />
          </>
        )}

        {mode === "network" && (
          <>
            {mid && <ConceptCard />}
            {mid && !sheetOpen && <UplinkFeed />}
          </>
        )}

        {mode === "risk" && (
          <>
            {mid && <RiskSummaryCard />}
            {mid && <RiskRightCard onFocusCell={focusCell} />}
            <div className="pointer-events-none absolute bottom-6 left-3 z-10 flex items-center gap-2">
              <LayerPicker />
              <RiskLegend />
            </div>
          </>
        )}

        {mode === "alerts" && <AlertList selected={selected} />}
        {mode === "network" && !mid && (
          <div className="pointer-events-none absolute inset-x-0 top-[64px] flex justify-center">
            <ConceptTag />
          </div>
        )}
      </div>

      {/* sheets (portals, always above the map) */}
      <LabSheet open={labOpen} onClose={closeSheet} />

      <SideSheet
        open={!!manhole}
        onClose={closeSheet}
        width={SHEET_W.manhole}
        title={`Manhole ${manhole?.id ?? ""}`}
        description="Sensors, radio statistics and history for this manhole (production concept, simulated)"
      >
        {manhole && <ManholeSheetBody id={manhole.id} />}
      </SideSheet>

      <SideSheet
        open={!!conceptTab}
        onClose={closeSheet}
        width={SHEET_W.concept}
        title="Node power and payload"
        description="Battery life calculator and payload layout for the LoRaWAN concept (not built)"
      >
        {conceptTab && <ConceptSheetBody tab={conceptTab} />}
      </SideSheet>

      <SideSheet
        open={!!alert || !!report}
        onClose={closeSheet}
        width={SHEET_W.alert}
        title={alert ? `Alert ${alert.id}` : `Surface report ${report?.id ?? ""}`}
        description="Evidence, linked surface reports and work order"
      >
        {alert ? <AlertSheetBody alert={alert} /> : report ? <ReportSheetBody report={report} /> : null}
      </SideSheet>

      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  )
}

