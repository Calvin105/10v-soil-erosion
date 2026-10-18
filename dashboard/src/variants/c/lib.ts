import type { NodeState, RiskCell, RiskLayer } from "@/data/types"
import { gateways, manholes, riskLayers, township } from "@/data/seed"

export type Mode = "prototype" | "network" | "risk" | "alerts"

export const MODES: { id: Mode; label: string; short: string }[] = [
  { id: "prototype", label: "Prototype", short: "Prototype" },
  { id: "network", label: "Network (Concept)", short: "Network" },
  { id: "risk", label: "Risk Layers", short: "Risk" },
  { id: "alerts", label: "Alerts", short: "Alerts" },
]

/** The physical test bench is pinned on the map for the demo (it lives on a lab table). */
export const BENCH: [number, number] = [township.center[0] - 0.0004, township.center[1] + 0.0006]

/** Floating glass card used for every panel that sits over the map. */
export const GLASS =
  "rounded-2xl border border-border/60 bg-background/80 shadow-lg shadow-black/5 backdrop-blur-xl supports-backdrop-filter:bg-background/70 dark:shadow-black/40"

/** State colours (the only hard-coded hues allowed besides risk heat + colormaps). */
export const STATE_HEX: Record<NodeState, string> = {
  GREEN: "#10b981",
  YELLOW: "#f59e0b",
  RED: "#ef4444",
}

export const STATE_TEXT: Record<NodeState, string> = {
  GREEN: "text-emerald-600 dark:text-emerald-400",
  YELLOW: "text-amber-600 dark:text-amber-400",
  RED: "text-red-600 dark:text-red-400",
}

export const STATE_BG: Record<NodeState, string> = {
  GREEN: "bg-emerald-500 dark:bg-emerald-400",
  YELLOW: "bg-amber-500 dark:bg-amber-400",
  RED: "bg-red-500 dark:bg-red-400",
}

export const STATE_SOFT: Record<NodeState, string> = {
  GREEN:
    "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/30",
  YELLOW:
    "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/30 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30",
  RED: "bg-red-500/10 text-red-700 ring-1 ring-red-500/30 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/30",
}

export const STATE_STROKE: Record<NodeState, string> = {
  GREEN: "stroke-emerald-500 dark:stroke-emerald-400",
  YELLOW: "stroke-amber-500 dark:stroke-amber-400",
  RED: "stroke-red-500 dark:stroke-red-400",
}

export function stateOfVri(vri: number): NodeState {
  return vri >= 70 ? "RED" : vri >= 40 ? "YELLOW" : "GREEN"
}

/** Ring-time ratio -> traffic-light (1x healthy, ~1.4x investigate, ~1.8x+ critical). */
export function stateOfRatio(r: number): NodeState {
  return r >= 1.8 ? "RED" : r >= 1.3 ? "YELLOW" : "GREEN"
}

export type RssiQuality = "good" | "fair" | "poor"
export function rssiQuality(rssi: number): RssiQuality {
  return rssi >= -100 ? "good" : rssi >= -110 ? "fair" : "poor"
}
export const RSSI_STATE: Record<RssiQuality, NodeState> = { good: "GREEN", fair: "YELLOW", poor: "RED" }

export const fmt = {
  n: (v: number, d = 0) => v.toFixed(d),
  pct: (v: number, d = 0) => `${(v * 100).toFixed(d)}%`,
  time: (t: number) =>
    new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  dateTime: (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kuala_Lumpur",
    }),
}

// ---------- risk (S3 mock) ----------

export const RISK_BANDS = [
  { label: "Very low", min: 0, color: "#ffffb2" },
  { label: "Low", min: 0.2, color: "#fecc5c" },
  { label: "Medium", min: 0.3, color: "#fd8d3c" },
  { label: "High", min: 0.45, color: "#f03b20" },
  { label: "Very high", min: 0.65, color: "#bd0026" },
] as const

export function riskBand(r: number) {
  let band: (typeof RISK_BANDS)[number] = RISK_BANDS[0]
  for (const b of RISK_BANDS) if (r >= b.min) band = b
  return band
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/**
 * Same formula as seed.ts, restricted to the selected layers:
 * Risk = min(1, (Likelihood x Trigger + Evidence) x Consequence).
 * A role with nothing selected becomes neutral (trigger 1, consequence 1).
 */
export function cellRisk(cell: RiskCell, selected: ReadonlySet<string>) {
  const by = (role: RiskLayer["role"]) =>
    riskLayers.filter((l) => l.role === role && selected.has(l.id)).map((l) => cell.values[l.id])
  const like = by("Likelihood")
  const trig = by("Trigger")
  const evid = by("Evidence")
  const cons = by("Consequence")
  const L = mean(like)
  const T = trig.length ? 0.5 + mean(trig) : 1
  const E = evid.reduce((a, b) => a + b, 0) / 4
  const C = cons.length ? 0.4 + 0.6 * mean(cons) : 1
  const raw = (L * T + E) * C
  return { risk: Math.min(1, raw), raw, L, T, E, C }
}

export const RISK_STEP = 0.0016

// ---------- geometry ----------

export const DRAIN_LINE: [number, number][] = [
  "MH-02",
  "MH-01",
  "MH-03",
  "MH-04",
  "MH-06",
  "MH-05",
  "MH-07",
  "MH-10",
  "MH-08",
  "MH-09",
].map((id) => {
  const m = manholes.find((x) => x.id === id)!
  return [m.lat, m.lon]
})

export const NETWORK_POINTS: [number, number][] = [
  ...manholes.map((m) => [m.lat, m.lon] as [number, number]),
  ...gateways.map((g) => [g.lat, g.lon] as [number, number]),
]

/** Deterministic pseudo-random for synthetic histories. */
export function prng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function hashId(id: string) {
  let h = 7
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 100000
  return h
}

/** Synthetic 14-day daily VRI trend that ends at the node's current VRI. */
export function vriTrend(id: string, endVri: number, days = 14) {
  const r = prng(hashId(id))
  const start = Math.max(8, endVri * (endVri > 40 ? 0.35 : 0.85))
  return Array.from({ length: days }, (_, i) => {
    const f = i / (days - 1)
    const shape = endVri > 40 ? f ** 2.2 : f
    const v = start + (endVri - start) * shape + (r() - 0.5) * 6
    return { day: `D-${days - 1 - i}`, vri: Math.max(0, Math.round(i === days - 1 ? endVri : v)) }
  })
}

/** Exponential ring-down envelope, same shape as the rig simulator. */
export function envelopeOf(tauMs: number, peak = 0.7, points = 60, spanMs = 80) {
  return Array.from({ length: points }, (_, i) => {
    const t = (i / (points - 1)) * spanMs
    return { t, v: peak * Math.exp(-t / tauMs) }
  })
}
