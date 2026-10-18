import { BANDS, MIC_BINS, MIC_MAX_HZ, type RigSnapshot } from "@/data/rig-sim"
import { CLASS_LABELS, DATASET_TARGET_MIN, dataset, models } from "@/data/seed"
import type { ClassLabel, DatasetRow, Manhole } from "@/data/types"

import type { Packing } from "./store"

export const DATASET_TARGET_TOTAL = DATASET_TARGET_MIN * CLASS_LABELS.length * 3

/** Seed dataset + clips recorded this session on the bench. */
export function datasetGrid(
  recordings: RigSnapshot["recordings"],
  packingByAt: Record<number, Packing>,
  fallback: Packing
): DatasetRow[] {
  const grid = dataset.map((r) => ({ ...r }))
  for (const rec of recordings) {
    const p = packingByAt[rec.at] ?? fallback
    const row = grid.find((r) => r.label === rec.label && r.packing === p)
    if (row) {
      row.minutes += rec.seconds / 60
      row.clips += 1
    }
  }
  return grid
}

export function datasetTotals(grid: DatasetRow[]) {
  const minutes = grid.reduce((a, r) => a + r.minutes, 0)
  const capped = grid.reduce((a, r) => a + Math.min(DATASET_TARGET_MIN, r.minutes), 0)
  const full = grid.filter((r) => r.minutes >= DATASET_TARGET_MIN).length
  return { minutes, capped, full, cells: grid.length }
}

export function cell(grid: DatasetRow[], label: ClassLabel, packing: Packing) {
  return grid.find((r) => r.label === label && r.packing === packing)
}

export function activeModel(tiny: boolean) {
  return tiny ? models[1] : models[0]
}

/** Band energies (dB) from a spectrum in dB, same method as the rig simulator. */
export function bandDbOf(spec: Float32Array | null): number[] | null {
  if (!spec) return null
  return BANDS.map((b) => {
    let e = 0
    for (let i = 0; i < MIC_BINS; i++) {
      const f = (i + 0.5) * (MIC_MAX_HZ / MIC_BINS)
      if (f >= b.from && f < b.to) e += 10 ** (spec[i] / 10)
    }
    return 10 * Math.log10(e + 1e-12)
  })
}

export function scenarioToLabel(sc: RigSnapshot["scenario"]): ClassLabel {
  if (sc.startsWith("void")) return "void"
  if (sc === "leak") return "leak"
  if (sc === "noise") return "noise"
  return "packed"
}

/* ---------- deterministic synthetic series for concept nodes ---------- */

function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

/** 7 days of 6-hourly VRI readings ending at the node's current VRI. */
export function syntheticVriSeries(m: Manhole) {
  const r = hash(m.id)
  const n = 28
  const start = Math.max(8, m.vri * (m.state === "GREEN" ? 0.9 : 0.4))
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const ramp = m.state === "GREEN" ? 0 : t ** 2.2
    const v = start + (m.vri - start) * ramp + (r() - 0.5) * 6
    return { i, label: `${Math.round((n - 1 - i) * 6)} h ago`, vri: Math.max(0, Math.round(i === n - 1 ? m.vri : v)) }
  })
}

export function envelopeOf(tauMs: number, peak = 0.7) {
  return Array.from({ length: 60 }, (_, i) => peak * Math.exp(-((i / 59) * 80) / tauMs))
}

/** Synthetic band energies for a concept node: baseline vs now. */
export function syntheticBands(m: Manhole) {
  const r = hash(`${m.id}-bands`)
  const base = [-52, -66, -74, -82, -90].map((v) => v + (r() - 0.5) * 3)
  const sev = Math.max(0, Math.min(1, (m.ringTimeRatio - 1) / 1.5))
  const now = base.map((v, i) => v + (i === 2 ? 14 * sev : i === 1 ? 5 * sev : 0) + (m.wet && i < 2 ? 6 : 0) + (r() - 0.5) * 2)
  return BANDS.map((b, i) => ({ band: b.label, base: base[i], now: now[i] }))
}

/** Ring-down numbers for the bench, matching how the simulator weighs them. */
export function benchRing(snap: RigSnapshot) {
  const tauBase = snap.baseline?.tauMs ?? null
  const tauNow = snap.lastPulse?.meanTauMs ?? snap.lastTransient?.tauMs ?? null
  const ratio = tauBase && tauNow ? tauNow / tauBase : null
  return { tauNow, tauBase, ratio }
}
