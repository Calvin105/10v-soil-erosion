import { manholes, riskCells, riskLayers } from "@/data/seed"
import type { NodeState, RiskCell, RiskLayer } from "@/data/types"

/** Mean of the enabled layers of one role for a cell (null when none are enabled). */
function roleMean(cell: RiskCell, role: RiskLayer["role"], on: Record<string, boolean>) {
  const ids = riskLayers.filter((l) => l.role === role && on[l.id] !== false).map((l) => l.id)
  if (!ids.length) return null
  return ids.reduce((a, id) => a + cell.values[id], 0) / ids.length
}

/**
 * Same shape as the seed formula: (likelihood x trigger + evidence) x consequence,
 * but only layers the operator has switched on contribute.
 */
export function scoreCell(cell: RiskCell, on: Record<string, boolean>) {
  const likelihood = roleMean(cell, "Likelihood", on) ?? 0.3
  const trigger = 0.5 + (roleMean(cell, "Trigger", on) ?? 0.25)
  const evidence = (roleMean(cell, "Evidence", on) ?? 0) / 2
  const consequence = 0.4 + (roleMean(cell, "Consequence", on) ?? 0.5) * 0.6
  return (likelihood * trigger + evidence) * consequence
}

/** Scores rescaled so the hottest cell is 1.0 (keeps the ranking readable). */
export function scoreAll(on: Record<string, boolean>) {
  const raw = riskCells.map((c) => ({ cell: c, score: scoreCell(c, on) }))
  const max = Math.max(...raw.map((r) => r.score), 1e-6)
  return raw.map((r) => ({ cell: r.cell, score: r.score / max }))
}

/** Quantile cut-offs so the map always shows a readable spread. */
export function cutoffs(scores: number[]) {
  const sorted = [...scores].sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  return { high: at(0.88), medium: at(0.62) }
}

export function bandOf(score: number, cut: { high: number; medium: number }): NodeState {
  return score >= cut.high ? "RED" : score >= cut.medium ? "YELLOW" : "GREEN"
}

export function metres(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dy = (aLat - bLat) * 111_320
  const dx = (aLon - bLon) * 111_320 * Math.cos((aLat * Math.PI) / 180)
  return Math.hypot(dx, dy)
}

export function nearestManhole(lat: number, lon: number) {
  let best = manholes[0]
  let bestD = Infinity
  for (const m of manholes) {
    const d = metres(lat, lon, m.lat, m.lon)
    if (d < bestD) {
      best = m
      bestD = d
    }
  }
  return { manhole: best, metres: bestD }
}

export function topCells(on: Record<string, boolean>, n: number) {
  return scoreAll(on)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
}

/** Highest-risk cells that are not already covered by a sensor (> 180 m from any node, spaced apart). */
export function suggestPlacement(on: Record<string, boolean>, n = 3) {
  const picked: { cell: RiskCell; score: number }[] = []
  for (const s of scoreAll(on).sort((a, b) => b.score - a.score)) {
    if (nearestManhole(s.cell.lat, s.cell.lon).metres < 180) continue
    if (picked.some((p) => metres(p.cell.lat, p.cell.lon, s.cell.lat, s.cell.lon) < 220)) continue
    picked.push(s)
    if (picked.length >= n) break
  }
  return picked
}

export function slug(group: string) {
  return group.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

export const RISK_GROUPS = Array.from(new Set(riskLayers.map((l) => l.group)))
