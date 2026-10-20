import { Route, Routes } from "react-router"

import { Launcher } from "@/launcher"
import VariantA from "@/variants/a"
import VariantAAudio from "@/variants/a-audio"
import VariantB from "@/variants/b"
import VariantC from "@/variants/c"
import VariantD from "@/variants/d"

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Launcher />} />
      <Route path="/a/*" element={<VariantA />} />
      <Route path="/a-audio/*" element={<VariantAAudio />} />
      <Route path="/b/*" element={<VariantB />} />
      <Route path="/c/*" element={<VariantC />} />
      <Route path="/d/*" element={<VariantD />} />
    </Routes>
  )
}

export default App
