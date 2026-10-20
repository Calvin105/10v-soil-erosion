import { manholes as seedManholes } from "@/data/seed"

export type NodeCondition = "safe_soil" | "critical_void" | "ambient"
export type NodeState = "GREEN" | "YELLOW" | "RED" | "GRAY"
export type PipeStatus = "healthy" | "suspect" | "critical"

export interface NetworkNode {
  id: string
  name: string
  road: string
  asset: string
  lat: number
  lon: number
  isPrototype: boolean
  state: NodeState
  vri: number
  condition: NodeCondition
  classSentence: string
  lastSeen?: string
}

export interface PipeEdge {
  id: string
  fromId: string
  toId: string
  name: string
  status: PipeStatus
  reasoning: string
}

export const PROTOTYPE_NODE_ID = "MH-04"

/**
 * 11 plausible drainage pipe edges connecting the 10 township manholes
 * in a downhill drainage tree flowing toward the retention lake.
 */
export const PIPE_CONNECTIONS: Array<{ id: string; fromId: string; toId: string; name: string }> = [
  { id: "pipe-01-02", fromId: "MH-01", toId: "MH-02", name: "Jalan Elmina 1/2 Collector" },
  { id: "pipe-02-04", fromId: "MH-02", toId: "MH-04", name: "North Hill Slope Drain" },
  { id: "pipe-03-04", fromId: "MH-03", toId: "MH-04", name: "Slope Toe Trunk" },
  { id: "pipe-04-05", fromId: "MH-04", toId: "MH-05", name: "Central Boulevard Main Culvert" },
  { id: "pipe-04-06", fromId: "MH-04", toId: "MH-06", name: "Depot West Branch" },
  { id: "pipe-06-07", fromId: "MH-06", toId: "MH-07", name: "Bus Depot Outfall" },
  { id: "pipe-05-07", fromId: "MH-05", toId: "MH-07", name: "Boulevard East Cross Drain" },
  { id: "pipe-07-08", fromId: "MH-07", toId: "MH-08", name: "Heavy Transit Road Crossing" },
  { id: "pipe-05-10", fromId: "MH-05", toId: "MH-10", name: "Hill-to-Flat East Spur" },
  { id: "pipe-10-08", fromId: "MH-10", toId: "MH-08", name: "East Pond Interceptor" },
  { id: "pipe-08-09", fromId: "MH-08", toId: "MH-09", name: "Lake Retention Pond Connector" },
]

/**
 * Baseline manhole configurations:
 * - MH-04 is the live prototype node (state populated dynamically from MQTT).
 * - MH-03 is a scripted simulated fault (YELLOW / Investigate, VRI ~47) to demonstrate network coverage.
 * - The remaining 8 nodes are simulated healthy (GREEN, low VRI 14-26).
 */
export function getInitialNodes(): Record<string, NetworkNode> {
  const nodes: Record<string, NetworkNode> = {}

  for (const m of seedManholes) {
    const isProto = m.id === PROTOTYPE_NODE_ID
    const isSimFault = m.id === "MH-03"

    let state: NodeState
    let vri: number
    let condition: NodeCondition
    let classSentence: string

    if (isProto) {
      state = "GREEN"
      vri = 12
      condition = "safe_soil"
      classSentence = "Healthy: soil is packed around the pipe"
    } else if (isSimFault) {
      state = "YELLOW"
      vri = 47
      condition = "critical_void"
      classSentence = "Investigate: abnormal acoustic shift detected"
    } else {
      state = "GREEN"
      vri = Math.min(28, Math.max(12, m.vri ?? 18))
      condition = "safe_soil"
      classSentence = "Healthy: soil is packed around the pipe"
    }

    nodes[m.id] = {
      id: m.id,
      name: m.name,
      road: m.road,
      asset: m.asset,
      lat: m.lat,
      lon: m.lon,
      isPrototype: isProto,
      state,
      vri,
      condition,
      classSentence,
    }
  }

  return nodes
}

/**
 * Computes pipe status inferred from the two manholes it connects:
 * - Both ends healthy (GREEN/GRAY): pipe is healthy (thin grey/slate).
 * - One end Void (RED) or Investigate (YELLOW) and other healthy (GREEN/GRAY):
 *   pipe is SUSPECT (amber dashed line). Sound changes between the two points,
 *   so fault is most likely on the segment between them.
 * - Both ends Void (RED): CRITICAL (thick red line).
 */
export function evaluatePipes(nodes: Record<string, NetworkNode>): PipeEdge[] {
  return PIPE_CONNECTIONS.map((c) => {
    const fromNode = nodes[c.fromId]
    const toNode = nodes[c.toId]

    if (!fromNode || !toNode) {
      return {
        ...c,
        status: "healthy" as PipeStatus,
        reasoning: "Normal flow signature across segment.",
      }
    }

    const fromRed = fromNode.state === "RED"
    const toRed = toNode.state === "RED"
    const fromAbnormal = fromNode.state === "RED" || fromNode.state === "YELLOW"
    const toAbnormal = toNode.state === "RED" || toNode.state === "YELLOW"

    let status: PipeStatus = "healthy"
    let reasoning = "Normal acoustic flow signature across segment. No void detected."

    if (fromRed && toRed) {
      status = "critical"
      reasoning = `Critical void span: severe void signatures detected at both ${fromNode.id} and ${toNode.id}. High structural risk.`
    } else if (fromAbnormal !== toAbnormal) {
      status = "suspect"
      const abnormalNode = fromAbnormal ? fromNode : toNode
      const normalNode = fromAbnormal ? toNode : fromNode
      reasoning = `Likely void along this pipe, between ${normalNode.id} (${normalNode.state === "GRAY" ? "ambient" : "normal flow"}) and ${abnormalNode.id} (${abnormalNode.state === "RED" ? "void signature" : "elevated anomaly"}). Sound changes between the two points, indicating erosion cavity along this segment.`
    } else if (fromAbnormal && toAbnormal) {
      // Both are yellow (or one yellow one red handled above)
      status = "suspect"
      reasoning = `Elevated acoustic resonance detected at both ${fromNode.id} and ${toNode.id}. Investigation recommended.`
    }

    return {
      ...c,
      status,
      reasoning,
    }
  })
}

export function getStateHex(state: NodeState): string {
  switch (state) {
    case "RED":
      return "#ef4444"
    case "YELLOW":
      return "#f59e0b"
    case "GREEN":
      return "#10b981"
    case "GRAY":
      return "#94a3b8"
  }
}

export type RiskLevel = "high" | "medium" | "low"

/** Ground-risk bands around problem pipes, outermost first so inner bands paint on top. */
export const RISK_BANDS: Array<{ level: RiskLevel; label: string; radiusM: number; color: string; fillOpacity: number }> = [
  { level: "low", label: "Low", radiusM: 100, color: "#facc15", fillOpacity: 0.16 },
  { level: "medium", label: "Medium", radiusM: 60, color: "#f97316", fillOpacity: 0.2 },
  { level: "high", label: "High", radiusM: 30, color: "#ef4444", fillOpacity: 0.28 },
]

/** Suspect pipes start at Medium; only critical pipes get the High band. */
export function bandsForPipe(status: PipeStatus) {
  if (status === "critical") return RISK_BANDS
  if (status === "suspect") return RISK_BANDS.filter((b) => b.level !== "high")
  return []
}

const M_PER_DEG_LAT = 110540
const M_PER_DEG_LON_EQ = 111320

/**
 * Capsule (stadium) polygon of radiusM metres around the segment a→b, in lat/lon,
 * so the band keeps its ground size at every zoom level.
 */
export function corridorPolygon(
  a: [number, number],
  b: [number, number],
  radiusM: number,
  capSteps = 12
): Array<[number, number]> {
  const mPerDegLon = M_PER_DEG_LON_EQ * Math.cos((a[0] * Math.PI) / 180)
  const toLatLon = (x: number, y: number): [number, number] => [a[0] + y / M_PER_DEG_LAT, a[1] + x / mPerDegLon]
  const bx = (b[1] - a[1]) * mPerDegLon
  const by = (b[0] - a[0]) * M_PER_DEG_LAT
  const heading = Math.atan2(by, bx)

  const pts: Array<[number, number]> = []
  // Cap around b sweeps heading-90° → heading+90°, cap around a sweeps heading+90° → heading+270°
  for (const [cx, cy, start] of [
    [bx, by, heading - Math.PI / 2],
    [0, 0, heading + Math.PI / 2],
  ] as const) {
    for (let i = 0; i <= capSteps; i++) {
      const ang = start + (Math.PI * i) / capSteps
      pts.push(toLatLon(cx + radiusM * Math.cos(ang), cy + radiusM * Math.sin(ang)))
    }
  }
  return pts
}
