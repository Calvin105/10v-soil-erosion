import { useSyncExternalStore } from "react"

import { manholes } from "./seed"
import type { Manhole, Uplink } from "./types"

/**
 * PRODUCTION CONCEPT ONLY. Not part of the prototype.
 * Simulates 10 field manholes reporting over LoRaWAN (AS923) to 2 gateways.
 */

export const APP_PAYLOAD_BYTES = 11
export const LORAWAN_OVERHEAD_BYTES = 13

/** LoRa time-on-air (ms), BW 125 kHz, CR 4/5, explicit header, CRC on. */
export function airtimeMs(sf: number, phyPayloadBytes = APP_PAYLOAD_BYTES + LORAWAN_OVERHEAD_BYTES) {
  const bw = 125000
  const tSym = (2 ** sf / bw) * 1000
  const de = sf >= 11 ? 1 : 0
  const cr = 1
  const preamble = (8 + 4.25) * tSym
  const num = 8 * phyPayloadBytes - 4 * sf + 28 + 16
  const payloadSym = 8 + Math.max(Math.ceil(num / (4 * (sf - 2 * de))) * (cr + 4), 0)
  return preamble + payloadSym * tSym
}

export interface BatteryInputs {
  wakeIntervalMin: number
  captureSec: number
  stormIntervalMin: number
  stormPct: number
  sf: number
  capacityMah: number
}

export const DEFAULT_BATTERY: BatteryInputs = {
  wakeIntervalMin: 15,
  captureSec: 5,
  stormIntervalMin: 2,
  stormPct: 10,
  sf: 7,
  capacityMah: 19000,
}

/** Rough concept estimate. Needs a measured current profile before any claim. */
export function projectBattery(b: BatteryInputs) {
  const SLEEP_MA = 0.008
  const CAPTURE_MA = 25
  const TX_MA = 45
  const SELF_DISCHARGE_PCT_YR = 1
  const USABLE = 0.8
  const wakesPerDay =
    (1440 / b.wakeIntervalMin) * (1 - b.stormPct / 100) +
    (1440 / b.stormIntervalMin) * (b.stormPct / 100)
  const perWakeMas = CAPTURE_MA * b.captureSec + TX_MA * (airtimeMs(b.sf) / 1000)
  const activeMahDay = (wakesPerDay * perWakeMas) / 3600
  const sleepMahDay = SLEEP_MA * 24
  const selfMahDay = (b.capacityMah * SELF_DISCHARGE_PCT_YR) / 100 / 365
  const mahPerDay = activeMahDay + sleepMahDay + selfMahDay
  const years = Math.min(10, (b.capacityMah * USABLE) / mahPerDay / 365)
  return {
    wakesPerDay,
    mahPerDay,
    years,
    breakdown: [
      { name: "Capture + DSP", mahDay: (wakesPerDay * CAPTURE_MA * b.captureSec) / 3600 },
      { name: "LoRa TX", mahDay: (wakesPerDay * TX_MA * (airtimeMs(b.sf) / 1000)) / 3600 },
      { name: "Sleep", mahDay: sleepMahDay },
      { name: "Self-discharge", mahDay: selfMahDay },
    ],
  }
}

interface NetSnapshot {
  uplinks: Uplink[]
  nodes: Manhole[]
  packetsLastHour: number
}

class NetworkSimulator {
  private listeners = new Set<() => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private fcnt: Record<string, number> = Object.fromEntries(manholes.map((m, i) => [m.id, 1200 + i * 37]))
  snapshot: NetSnapshot = { uplinks: seedUplinks(), nodes: manholes, packetsLastHour: 412 }

  subscribe = (cb: () => void) => {
    this.listeners.add(cb)
    if (!this.timer) this.timer = setInterval(() => this.tick(), 2500)
    return () => {
      this.listeners.delete(cb)
    }
  }

  getSnapshot = () => this.snapshot

  private tick() {
    const node = manholes[Math.floor(Math.random() * manholes.length)]
    const up = makeUplink(node, Date.now(), ++this.fcnt[node.id])
    const nodes = this.snapshot.nodes.map((n) =>
      n.id === node.id ? { ...n, lastUplinkMinAgo: 0, rssi: up.rssi, snr: up.snr } : n
    )
    this.snapshot = {
      uplinks: [up, ...this.snapshot.uplinks].slice(0, 80),
      nodes,
      packetsLastHour: this.snapshot.packetsLastHour + (Math.random() < 0.5 ? 1 : 0),
    }
    this.listeners.forEach((l) => l())
  }
}

function makeUplink(node: Manhole, at: number, fcnt: number): Uplink {
  const rssi = Math.round(node.rssi + (Math.random() * 6 - 3))
  const snr = Math.round((node.snr + (Math.random() * 3 - 1.5)) * 10) / 10
  return {
    id: `${node.id}-${fcnt}`,
    at,
    manholeId: node.id,
    gatewayId: node.gatewayId,
    fcnt,
    sf: node.spreadingFactor,
    rssi,
    snr,
    bytes: APP_PAYLOAD_BYTES,
    airtimeMs: Math.round(airtimeMs(node.spreadingFactor) * 10) / 10,
    vri: Math.max(0, Math.round(node.vri + (Math.random() * 6 - 3))),
    wet: node.wet,
  }
}

function seedUplinks(): Uplink[] {
  const now = Date.now()
  return Array.from({ length: 24 }, (_, i) => {
    const node = manholes[(i * 7) % manholes.length]
    return makeUplink(node, now - i * 95_000, 1100 + i)
  })
}

export const network = new NetworkSimulator()

export function useNetwork() {
  return useSyncExternalStore(network.subscribe, network.getSnapshot)
}

/** Field layout of the 11-byte application payload (concept). */
export const PAYLOAD_LAYOUT = [
  { bytes: "0", field: "state", note: "0 GREEN, 1 YELLOW, 2 RED" },
  { bytes: "1", field: "vri", note: "0-100" },
  { bytes: "2", field: "confidence", note: "x 0.01" },
  { bytes: "3-4", field: "ring_time_ratio", note: "x 0.01" },
  { bytes: "5-7", field: "band_energy (3 bands)", note: "dB + 128" },
  { bytes: "8", field: "flags", note: "bit0 wet, bit1 storm mode, bit2 tamper" },
  { bytes: "9", field: "battery_pct", note: "0-100" },
  { bytes: "10", field: "temp_c", note: "signed" },
]
