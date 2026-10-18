import { Navigate, Route, Routes } from "react-router"

import "./a.css"
import { AlertsPage } from "./pages/alerts"
import { BatteryPage } from "./pages/battery"
import { LiveConsole } from "./pages/console"
import { DatasetPage } from "./pages/dataset"
import { MlLab } from "./pages/ml-lab"
import { NetworkPage } from "./pages/network"
import { RiskPage } from "./pages/risk"
import { Shell } from "./shell"

/** Variant A - "Control Room": dense NOC/SCADA-style operations console. */
export default function VariantA() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="console" replace />} />
        <Route path="console" element={<LiveConsole />} />
        <Route path="ml" element={<MlLab />} />
        <Route path="dataset" element={<DatasetPage />} />
        <Route path="network" element={<NetworkPage />} />
        <Route path="battery" element={<BatteryPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="risk" element={<RiskPage />} />
        <Route path="*" element={<Navigate to="console" replace />} />
      </Route>
    </Routes>
  )
}
