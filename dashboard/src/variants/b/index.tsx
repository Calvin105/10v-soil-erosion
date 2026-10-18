import { useEffect } from "react"
import { Outlet, Route, Routes, useLocation } from "react-router"

import { BatteryPage, GatewayRoute, NetworkPage } from "./pages/network"
import BenchPage from "./pages/bench"
import { FieldPage, ManholeRoute, ZoneRoute } from "./pages/field"
import LabPage from "./pages/lab"
import { MissionRoute, MissionsPage } from "./pages/missions"
import { RiskGroupRoute, RiskPage } from "./pages/risk"
import { BenchSensorRoute, NodeSensorRoute } from "./pages/sensor"
import TownshipPage from "./pages/township"
import { Hud } from "./ui/hud"
import { NotFound } from "./ui/not-found"

function Shell() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className="min-h-svh bg-background text-foreground">
      <Hud />
      <Outlet />
    </div>
  )
}

/**
 * Direction B: Command Hierarchy. One level per route:
 *   Township > Site > Zone/Bench > Manhole > Sensor
 */
export default function VariantB() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<TownshipPage />} />
        <Route path="lab" element={<LabPage />} />
        <Route path="lab/rig-01" element={<BenchPage />} />
        <Route path="lab/rig-01/:sensor" element={<BenchSensorRoute />} />
        <Route path="field" element={<FieldPage />} />
        <Route path="field/:zoneId" element={<ZoneRoute />} />
        <Route path="field/:zoneId/:mhId" element={<ManholeRoute />} />
        <Route path="field/:zoneId/:mhId/:sensor" element={<NodeSensorRoute />} />
        <Route path="network" element={<NetworkPage />} />
        <Route path="network/battery" element={<BatteryPage />} />
        <Route path="network/gw/:gwId" element={<GatewayRoute />} />
        <Route path="risk" element={<RiskPage />} />
        <Route path="risk/:group" element={<RiskGroupRoute />} />
        <Route path="missions" element={<MissionsPage />} />
        <Route path="missions/:alertId" element={<MissionRoute />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
