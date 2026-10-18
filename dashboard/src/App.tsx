import { Route, Routes } from "react-router"

import { Launcher } from "@/launcher"
import VariantA from "@/variants/a"
import VariantB from "@/variants/b"
import VariantC from "@/variants/c"

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Launcher />} />
      <Route path="/a/*" element={<VariantA />} />
      <Route path="/b/*" element={<VariantB />} />
      <Route path="/c/*" element={<VariantC />} />
    </Routes>
  )
}

export default App
