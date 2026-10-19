import { Navigate, Route, Routes } from "react-router"
import { AudioConsole } from "./pages/audio-console"
import { RunsOverview } from "./pages/runs-overview"
import { Shell } from "./shell"

export default function VariantAAudio() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="console" replace />} />
        <Route path="console" element={<AudioConsole />} />
        <Route path="runs" element={<RunsOverview />} />
        <Route path="*" element={<Navigate to="console" replace />} />
      </Route>
    </Routes>
  )
}
