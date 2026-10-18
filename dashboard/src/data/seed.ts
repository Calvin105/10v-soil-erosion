import type {
  Alert,
  DatasetRow,
  Gateway,
  Manhole,
  ModelCard,
  RiskCell,
  RiskLayer,
  SensorInfo,
  SurfaceReport,
  Township,
  WorkOrder,
  Zone,
} from "./types"

export const township: Township = {
  id: "elmina",
  name: "City of Elmina (concept)",
  center: [3.1945, 101.5032],
}

export const zones: Zone[] = [
  {
    id: "z-west",
    townshipId: "elmina",
    name: "Elmina West",
    description: "Hillside phases, retaining walls, steep drains",
  },
  {
    id: "z-central",
    townshipId: "elmina",
    name: "Elmina Central",
    description: "Main boulevard, heavy-vehicle corridor, culverts",
  },
  {
    id: "z-lake",
    townshipId: "elmina",
    name: "Retention Lake",
    description: "Low-lying inlets where hill runoff meets flat drains",
  },
]

function sensors(id: string, degraded = false): SensorInfo[] {
  return [
    {
      id: `${id}-VIB`,
      kind: "vibration",
      model: "Piezo vibration (analog)",
      sampleRateHz: 4000,
      status: degraded ? "degraded" : "ok",
    },
    {
      id: `${id}-MIC`,
      kind: "microphone",
      model: "PDM MEMS mic (FFT)",
      sampleRateHz: 16000,
      status: "ok",
    },
  ]
}

export const gateways: Gateway[] = [
  {
    id: "GW-1",
    name: "Clubhouse rooftop",
    lat: 3.1972,
    lon: 101.4991,
    backhaul: "Fibre",
    status: "online",
  },
  {
    id: "GW-2",
    name: "Sales gallery mast",
    lat: 3.1903,
    lon: 101.5094,
    backhaul: "4G",
    status: "online",
  },
]

export const manholes: Manhole[] = [
  {
    id: "MH-01",
    zoneId: "z-west",
    name: "Bukit Terrace collar",
    road: "Jalan Elmina 1/2",
    asset: "Pipe-to-manhole collar",
    lat: 3.1991,
    lon: 101.4962,
    mountHeightM: 0.9,
    state: "GREEN",
    vri: 14,
    ringTimeRatio: 1.05,
    wet: false,
    sensors: sensors("MH-01"),
    gatewayId: "GW-1",
    spreadingFactor: 7,
    rssi: -91,
    snr: 8.5,
    batteryPct: 97,
    lastUplinkMinAgo: 12,
    installedOn: "2026-11-02",
    riskScore: 0.42,
  },
  {
    id: "MH-02",
    zoneId: "z-west",
    name: "Retaining wall R3 outlet",
    road: "Persiaran Elmina West",
    asset: "Retaining wall drain",
    lat: 3.2006,
    lon: 101.4989,
    mountHeightM: 0.6,
    state: "GREEN",
    vri: 22,
    ringTimeRatio: 1.12,
    wet: false,
    sensors: sensors("MH-02"),
    gatewayId: "GW-1",
    spreadingFactor: 8,
    rssi: -103,
    snr: 4.0,
    batteryPct: 95,
    lastUplinkMinAgo: 41,
    installedOn: "2026-11-02",
    riskScore: 0.58,
  },
  {
    id: "MH-03",
    zoneId: "z-west",
    name: "Slope toe junction",
    road: "Jalan Elmina 1/7",
    asset: "Junction box",
    lat: 3.1967,
    lon: 101.4948,
    mountHeightM: 0.8,
    state: "YELLOW",
    vri: 47,
    ringTimeRatio: 1.62,
    wet: false,
    sensors: sensors("MH-03"),
    gatewayId: "GW-1",
    spreadingFactor: 9,
    rssi: -112,
    snr: -1.5,
    batteryPct: 91,
    lastUplinkMinAgo: 6,
    installedOn: "2026-11-03",
    riskScore: 0.71,
  },
  {
    id: "MH-04",
    zoneId: "z-central",
    name: "Boulevard culvert A",
    road: "Persiaran Elmina (main boulevard)",
    asset: "Culvert under road",
    lat: 3.1952,
    lon: 101.5021,
    mountHeightM: 1.2,
    state: "GREEN",
    vri: 18,
    ringTimeRatio: 1.08,
    wet: true,
    sensors: sensors("MH-04"),
    gatewayId: "GW-1",
    spreadingFactor: 7,
    rssi: -88,
    snr: 9.2,
    batteryPct: 96,
    lastUplinkMinAgo: 3,
    installedOn: "2026-11-04",
    riskScore: 0.66,
  },
  {
    id: "MH-05",
    zoneId: "z-central",
    name: "Boulevard culvert B",
    road: "Persiaran Elmina (main boulevard)",
    asset: "Culvert under road",
    lat: 3.1938,
    lon: 101.5047,
    mountHeightM: 1.2,
    state: "GREEN",
    vri: 26,
    ringTimeRatio: 1.15,
    wet: true,
    sensors: sensors("MH-05"),
    gatewayId: "GW-2",
    spreadingFactor: 7,
    rssi: -94,
    snr: 7.1,
    batteryPct: 94,
    lastUplinkMinAgo: 18,
    installedOn: "2026-11-04",
    riskScore: 0.69,
  },
  {
    id: "MH-06",
    zoneId: "z-central",
    name: "Bus depot entrance",
    road: "Jalan Elmina 3/1",
    asset: "Pipe-to-manhole collar",
    lat: 3.1927,
    lon: 101.5013,
    mountHeightM: 0.9,
    state: "GREEN",
    vri: 31,
    ringTimeRatio: 1.21,
    wet: false,
    sensors: sensors("MH-06", true),
    gatewayId: "GW-2",
    spreadingFactor: 8,
    rssi: -105,
    snr: 2.2,
    batteryPct: 88,
    lastUplinkMinAgo: 27,
    installedOn: "2026-11-05",
    riskScore: 0.74,
  },
  {
    id: "MH-07",
    zoneId: "z-central",
    name: "Refuse-truck route crossing",
    road: "Jalan Elmina 3/4",
    asset: "Culvert under road",
    lat: 3.1919,
    lon: 101.5058,
    mountHeightM: 1.1,
    state: "RED",
    vri: 78,
    ringTimeRatio: 2.4,
    wet: false,
    sensors: sensors("MH-07"),
    gatewayId: "GW-2",
    spreadingFactor: 7,
    rssi: -90,
    snr: 8.0,
    batteryPct: 93,
    lastUplinkMinAgo: 2,
    installedOn: "2026-11-05",
    riskScore: 0.88,
  },
  {
    id: "MH-08",
    zoneId: "z-lake",
    name: "Lake inlet north",
    road: "Lingkaran Tasik Elmina",
    asset: "Retention pond inlet",
    lat: 3.1898,
    lon: 101.5101,
    mountHeightM: 0.7,
    state: "GREEN",
    vri: 20,
    ringTimeRatio: 1.1,
    wet: true,
    sensors: sensors("MH-08"),
    gatewayId: "GW-2",
    spreadingFactor: 7,
    rssi: -86,
    snr: 9.8,
    batteryPct: 98,
    lastUplinkMinAgo: 9,
    installedOn: "2026-11-06",
    riskScore: 0.55,
  },
  {
    id: "MH-09",
    zoneId: "z-lake",
    name: "Lake inlet south",
    road: "Lingkaran Tasik Elmina",
    asset: "Retention pond inlet",
    lat: 3.1879,
    lon: 101.5083,
    mountHeightM: 0.7,
    state: "YELLOW",
    vri: 44,
    ringTimeRatio: 1.55,
    wet: true,
    sensors: sensors("MH-09"),
    gatewayId: "GW-2",
    spreadingFactor: 10,
    rssi: -117,
    snr: -6.0,
    batteryPct: 82,
    lastUplinkMinAgo: 55,
    installedOn: "2026-11-06",
    riskScore: 0.63,
  },
  {
    id: "MH-10",
    zoneId: "z-lake",
    name: "Hill-to-flat transition",
    road: "Jalan Tasik 2",
    asset: "Junction box",
    lat: 3.1911,
    lon: 101.5122,
    mountHeightM: 0.8,
    state: "GREEN",
    vri: 16,
    ringTimeRatio: 1.06,
    wet: false,
    sensors: sensors("MH-10"),
    gatewayId: "GW-2",
    spreadingFactor: 9,
    rssi: -110,
    snr: -0.5,
    batteryPct: 90,
    lastUplinkMinAgo: 33,
    installedOn: "2026-11-07",
    riskScore: 0.6,
  },
]

export const alerts: Alert[] = [
  {
    id: "AL-0142",
    manholeId: "MH-07",
    raisedAt: "2026-10-15T08:42:00+08:00",
    state: "RED",
    priority: "P1",
    vri: 78,
    ringTimeRatio: 2.4,
    summary:
      "Ring-down 2.4x baseline for 3 consecutive readings; resonance peak shifted 1.9 to 1.4 kHz. Resident reported road sagging 12 m away.",
    status: "Dispatched",
    linkedReports: ["RP-3310"],
  },
  {
    id: "AL-0141",
    manholeId: "MH-03",
    raisedAt: "2026-10-15T06:10:00+08:00",
    state: "YELLOW",
    priority: "P3",
    vri: 47,
    ringTimeRatio: 1.62,
    summary:
      "Baseline deviation 2.8 sigma in 0.8-2 kHz band after overnight rain. Sampling raised to every 10 min.",
    status: "Acknowledged",
    linkedReports: [],
  },
  {
    id: "AL-0140",
    manholeId: "MH-09",
    raisedAt: "2026-10-14T21:30:00+08:00",
    state: "YELLOW",
    priority: "P2",
    vri: 44,
    ringTimeRatio: 1.55,
    summary:
      "Surcharged 6 h during storm (wet flag), then ring-down rose 1.55x. Muddy water reported in drain during dry weather.",
    status: "New",
    linkedReports: ["RP-3302"],
  },
  {
    id: "AL-0131",
    manholeId: "MH-05",
    raisedAt: "2026-10-09T14:05:00+08:00",
    state: "RED",
    priority: "P2",
    vri: 72,
    ringTimeRatio: 2.1,
    summary:
      "Void confirmed by CCTV at joint J-14; grouted 0.2 m3. Node re-baselined after repair.",
    status: "Closed",
    linkedReports: [],
  },
]

export const workOrders: WorkOrder[] = [
  {
    id: "WO-2291",
    alertId: "AL-0142",
    title: "Inspect culvert MH-07 with CCTV + GPR",
    crew: "FM Crew B (Hafiz)",
    due: "2026-10-16T08:42:00+08:00",
    status: "In progress",
    steps: [
      { label: "Traffic management set up (cone off lane)", done: true },
      { label: "CCTV crawler run upstream 30 m", done: true },
      { label: "GPR scan over flagged segment", done: false },
      { label: "Record outcome and photos", done: false },
    ],
    outcome: "Pending",
  },
  {
    id: "WO-2288",
    alertId: "AL-0141",
    title: "Visual check MH-03 and weep holes on slope toe",
    crew: "FM Crew A (Mei Ling)",
    due: "2026-10-18T17:00:00+08:00",
    status: "Queued",
    steps: [
      { label: "Clear debris at junction", done: false },
      { label: "Check retaining wall weep holes", done: false },
      { label: "Record outcome", done: false },
    ],
    outcome: "Pending",
  },
  {
    id: "WO-2270",
    alertId: "AL-0131",
    title: "Grout void at joint J-14 (MH-05)",
    crew: "Contractor: Geofoam Sdn Bhd",
    due: "2026-10-11T17:00:00+08:00",
    status: "Done",
    steps: [
      { label: "CCTV confirmed void", done: true },
      { label: "PU foam injection 0.2 m3", done: true },
      { label: "Re-baseline node", done: true },
    ],
    outcome: "Void confirmed",
  },
]

export const surfaceReports: SurfaceReport[] = [
  {
    id: "RP-3310",
    at: "2026-10-15T07:55:00+08:00",
    category: "Road dip / sagging",
    relevance: "High",
    lat: 3.1921,
    lon: 101.5061,
    nearManholeId: "MH-07",
    reporter: "Resident (WhatsApp)",
    count: 3,
    status: "Linked to alert",
  },
  {
    id: "RP-3302",
    at: "2026-10-14T12:20:00+08:00",
    category: "Muddy water in drain (dry weather)",
    relevance: "High",
    lat: 3.1881,
    lon: 101.5079,
    nearManholeId: "MH-09",
    reporter: "Resident (QR on manhole)",
    count: 1,
    status: "Linked to alert",
  },
  {
    id: "RP-3297",
    at: "2026-10-13T18:02:00+08:00",
    category: "Pothole keeps returning",
    relevance: "High",
    lat: 3.1931,
    lon: 101.5009,
    nearManholeId: "MH-06",
    reporter: "Commuter (web)",
    count: 2,
    status: "Verified",
  },
  {
    id: "RP-3290",
    at: "2026-10-12T09:40:00+08:00",
    category: "Crack in road",
    relevance: "Medium",
    lat: 3.1999,
    lon: 101.4975,
    reporter: "Resident (web)",
    count: 1,
    status: "Received",
  },
]

export const riskLayers: RiskLayer[] = [
  { id: "karst", group: "Geology", name: "Karst limestone", source: "JMG geological maps", role: "Likelihood", kind: "Static" },
  { id: "mining", group: "Geology", name: "Ex-tin-mining land", source: "JMG / JUPEM historical maps", role: "Likelihood", kind: "Static" },
  { id: "fill", group: "Topography", name: "Cut-and-fill depth", source: "SDP earthwork records", role: "Likelihood", kind: "Static" },
  { id: "paleo", group: "Topography", name: "Buried stream paths", source: "Historical JUPEM topo", role: "Likelihood", kind: "Static" },
  { id: "pipeAge", group: "Infrastructure", name: "Pipe age and joints", source: "SDP as-built GIS", role: "Likelihood", kind: "Static" },
  { id: "rain", group: "Weather", name: "Rainfall forecast 72 h", source: "MET Malaysia (data.gov.my)", role: "Trigger", kind: "Dynamic" },
  { id: "heavy", group: "Load", name: "Heavy vehicles (bus, refuse, mixer)", source: "HPU traffic census, GTFS, refuse routes", role: "Trigger", kind: "Slow-dynamic" },
  { id: "construction", group: "Load", name: "Construction and piling", source: "Council approvals, SDP phases", role: "Trigger", kind: "Slow-dynamic" },
  { id: "reports", group: "Evidence", name: "Public reports", source: "S1 Report Portal", role: "Evidence", kind: "Dynamic" },
  { id: "insar", group: "Evidence", name: "InSAR settlement", source: "ESA Sentinel-1", role: "Evidence", kind: "Slow-dynamic" },
  { id: "footfall", group: "Consequence", name: "Footfall and schools", source: "SDP malls, OSM", role: "Consequence", kind: "Dynamic" },
]

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

export const riskCells: RiskCell[] = (() => {
  const cells: RiskCell[] = []
  const [lat0, lon0] = [3.1865, 101.4935]
  const step = 0.0016
  let i = 0
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 13; c++) {
      const lat = lat0 + r * step
      const lon = lon0 + c * step
      const values: Record<string, number> = {}
      riskLayers.forEach((l, k) => {
        const base = rand(i * 31 + k * 7)
        const hotspot =
          Math.exp(-(((lat - 3.1919) / 0.004) ** 2 + ((lon - 101.5058) / 0.005) ** 2)) * 0.6
        values[l.id] = Math.min(1, base * 0.6 + hotspot)
      })
      const likelihood =
        (values.karst + values.mining + values.fill + values.paleo + values.pipeAge) / 5
      const trigger = 0.5 + (values.rain + values.heavy + values.construction) / 3
      const evidence = (values.reports + values.insar) / 4
      const consequence = 0.4 + values.footfall * 0.6
      const risk = Math.min(1, (likelihood * trigger + evidence) * consequence)
      cells.push({ id: `C${r}-${c}`, lat, lon, values, risk })
      i++
    }
  }
  return cells
})()

export const dataset: DatasetRow[] = [
  { label: "packed", packing: 1, minutes: 12, clips: 72 },
  { label: "packed", packing: 2, minutes: 11, clips: 66 },
  { label: "packed", packing: 3, minutes: 6, clips: 36 },
  { label: "void", packing: 1, minutes: 14, clips: 84 },
  { label: "void", packing: 2, minutes: 10, clips: 60 },
  { label: "void", packing: 3, minutes: 4, clips: 24 },
  { label: "leak", packing: 1, minutes: 8, clips: 48 },
  { label: "leak", packing: 2, minutes: 7, clips: 42 },
  { label: "leak", packing: 3, minutes: 0, clips: 0 },
  { label: "noise", packing: 1, minutes: 9, clips: 54 },
  { label: "noise", packing: 2, minutes: 6, clips: 36 },
  { label: "noise", packing: 3, minutes: 3, clips: 18 },
]

export const DATASET_TARGET_MIN = 10

export const models: ModelCard[] = [
  {
    id: "laptop-rf",
    stage: "Phase 1 - Laptop",
    name: "Random Forest on 14 features",
    framework: "scikit-learn (Python, on laptop)",
    input: "Mic FFT band energies + vibration RMS, crest, ring-down",
    heldOutAccuracy: 0.94,
    latencyMs: 3,
    sizeKb: 410,
    status: "Trained",
    confusion: [
      [58, 1, 0, 1],
      [2, 55, 2, 1],
      [0, 3, 51, 0],
      [3, 0, 1, 50],
    ],
  },
  {
    id: "tinyml-cnn",
    stage: "Phase 2 - TinyML on ESP32",
    name: "MFE + 1D CNN (int8)",
    framework: "Edge Impulse -> Arduino library",
    input: "Mic 1 s window (MFE) + vibration features",
    heldOutAccuracy: 0.9,
    latencyMs: 48,
    sizeKb: 46,
    status: "Training",
    confusion: [
      [55, 3, 0, 2],
      [3, 52, 3, 2],
      [1, 4, 49, 0],
      [4, 1, 1, 48],
    ],
  },
]

export const CLASS_LABELS = ["packed", "void", "leak", "noise"] as const

export const doseResponse = [
  { voidMl: 0, ringRatio: 1.0, err: 0.06, vri: 12 },
  { voidMl: 100, ringRatio: 1.4, err: 0.12, vri: 38 },
  { voidMl: 250, ringRatio: 2.1, err: 0.18, vri: 66 },
  { voidMl: 500, ringRatio: 2.9, err: 0.25, vri: 84 },
]

export const SCENARIOS: { id: import("./types").Scenario; label: string; hint: string }[] = [
  { id: "packed", label: "Packed soil", hint: "Healthy: soil fully supports the pipe" },
  { id: "void-s", label: "Void 100 ml", hint: "Small cavity under the pipe crown" },
  { id: "void-m", label: "Void 250 ml", hint: "Medium cavity" },
  { id: "void-l", label: "Void 500 ml", hint: "Large cavity" },
  { id: "leak", label: "Leak into soil", hint: "Water escaping through a hole" },
  { id: "noise", label: "Traffic noise", hint: "Speaker rumble + table thumps" },
]
