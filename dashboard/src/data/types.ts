export type NodeState = "GREEN" | "YELLOW" | "RED"

export type Scenario = "packed" | "void-s" | "void-m" | "void-l" | "leak" | "noise"

export type ClassLabel = "packed" | "void" | "leak" | "noise"

export type Probs = Record<ClassLabel, number>

export interface Township {
  id: string
  name: string
  center: [number, number]
}

export interface Zone {
  id: string
  townshipId: string
  name: string
  description: string
}

export type AssetType =
  | "Culvert under road"
  | "Pipe-to-manhole collar"
  | "Retention pond inlet"
  | "Retaining wall drain"
  | "Junction box"

export interface SensorInfo {
  id: string
  kind: "vibration" | "microphone"
  model: string
  sampleRateHz: number
  status: "ok" | "degraded" | "offline"
}

/** A field manhole in the LoRaWAN production concept (simulated). */
export interface Manhole {
  id: string
  zoneId: string
  name: string
  road: string
  asset: AssetType
  lat: number
  lon: number
  mountHeightM: number
  state: NodeState
  vri: number
  ringTimeRatio: number
  wet: boolean
  sensors: SensorInfo[]
  gatewayId: string
  spreadingFactor: 7 | 8 | 9 | 10
  rssi: number
  snr: number
  batteryPct: number
  lastUplinkMinAgo: number
  installedOn: string
  riskScore: number
}

export interface Gateway {
  id: string
  name: string
  lat: number
  lon: number
  backhaul: "Fibre" | "4G"
  status: "online" | "offline"
}

export interface Uplink {
  id: string
  at: number
  manholeId: string
  gatewayId: string
  fcnt: number
  sf: number
  rssi: number
  snr: number
  bytes: number
  airtimeMs: number
  vri: number
  wet: boolean
}

export type AlertStatus =
  | "New"
  | "Acknowledged"
  | "Dispatched"
  | "Inspected"
  | "Repaired"
  | "Closed"

export type Priority = "P1" | "P2" | "P3"

export interface Alert {
  id: string
  manholeId: string
  raisedAt: string
  state: NodeState
  priority: Priority
  vri: number
  ringTimeRatio: number
  summary: string
  status: AlertStatus
  linkedReports: string[]
}

export interface WorkOrder {
  id: string
  alertId: string
  title: string
  crew: string
  due: string
  status: "Queued" | "In progress" | "Done"
  steps: { label: string; done: boolean }[]
  outcome?: "Void confirmed" | "No void found" | "Pending"
}

export interface SurfaceReport {
  id: string
  at: string
  category: string
  relevance: "High" | "Medium-High" | "Medium"
  lat: number
  lon: number
  nearManholeId?: string
  reporter: string
  count: number
  status: "Received" | "Verified" | "Linked to alert"
}

export interface RiskLayer {
  id: string
  group: string
  name: string
  source: string
  role: "Likelihood" | "Trigger" | "Evidence" | "Consequence"
  kind: "Static" | "Slow-dynamic" | "Dynamic"
}

export interface RiskCell {
  id: string
  lat: number
  lon: number
  values: Record<string, number>
  risk: number
}

export interface DatasetRow {
  label: ClassLabel
  packing: 1 | 2 | 3
  minutes: number
  clips: number
}

export interface ModelCard {
  id: string
  stage: "Phase 1 - Laptop" | "Phase 2 - TinyML on ESP32"
  name: string
  framework: string
  input: string
  heldOutAccuracy: number
  latencyMs: number
  sizeKb: number
  status: "Trained" | "Training" | "Planned" | "Deployed"
  confusion: number[][]
}
