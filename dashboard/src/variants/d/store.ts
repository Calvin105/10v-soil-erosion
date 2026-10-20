import { useSyncExternalStore } from "react"
import {
  connectLive,
  disconnectLive,
  type LiveStatus,
  type Telemetry,
} from "../a-audio/live-mqtt"
import {
  evaluatePipes,
  getInitialNodes,
  PROTOTYPE_NODE_ID,
  type NetworkNode,
  type NodeCondition,
  type NodeState,
  type PipeEdge,
} from "./network"
import {
  evaluateTickets,
  getInitialTickets,
  type CitizenCategory,
  type Ticket,
  type TicketStatus,
} from "./tickets"

export interface SparkPoint {
  t: number
  vri: number
}

export interface VariantDState {
  // MQTT & Feed state
  mqttStatus: LiveStatus
  mqttError: string | null
  lastMessageTime: number | null
  isDemoFeed: boolean
  demoBadgeVisible: boolean
  offlineSeconds: number | null

  // Telemetry
  latestTelemetry: Telemetry | null
  telemetryWindow: number[] // up to the last 5 critical_void values, for the smoothed VRI
  sparklineHistory: SparkPoint[] // last 60 seconds of VRI

  // Network topology & evaluation
  nodes: Record<string, NetworkNode>
  pipes: PipeEdge[]

  // Unified tickets
  tickets: Ticket[]
}

const BROKER_URL = "wss://broker.hivemq.com:8884/mqtt"
const TOPIC = "sentinel/acoustic/telemetry"

const initialNodes = getInitialNodes()
const initialPipes = evaluatePipes(initialNodes)
const initialTickets = evaluateTickets(getInitialTickets(), initialPipes, initialNodes)

let state: VariantDState = {
  mqttStatus: "idle",
  mqttError: null,
  lastMessageTime: null,
  isDemoFeed: false,
  demoBadgeVisible: false,
  offlineSeconds: null,
  latestTelemetry: {
    ambient: 5,
    critical_void: 0,
    safe_soil: 95,
    peak: 7200,
    t: Date.now(),
  },
  telemetryWindow: [0, 0, 0, 0, 0],
  sparklineHistory: Array.from({ length: 20 }, (_, i) => ({
    t: Date.now() - (20 - i) * 1000,
    vri: 12 + Math.sin(i * 0.5) * 2,
  })),
  nodes: initialNodes,
  pipes: initialPipes,
  tickets: initialTickets,
}

const listeners = new Set<() => void>()
function emit() {
  for (const l of listeners) l()
}

// Track the previous prototype state so a sensor ticket is raised only on entry into RED
let previousPrototypeState: NodeState = "GREEN"

const VRI_WINDOW = 5

function processTelemetry(t: Telemetry, isDemo = false) {
  const now = Date.now()
  const vriWindow = [...state.telemetryWindow, t.critical_void].slice(-VRI_WINDOW)
  const smoothedVri = Math.round(vriWindow.reduce((a, b) => a + b, 0) / vriWindow.length)

  // Determine argmax class
  let condition: NodeCondition = "safe_soil"
  let classSentence = "Healthy: soil is packed around the pipe"

  if (t.critical_void >= t.safe_soil && t.critical_void >= t.ambient) {
    condition = "critical_void"
    classSentence = "Void detected: soil has washed away"
  } else if (t.ambient >= t.safe_soil && t.ambient >= t.critical_void) {
    condition = "ambient"
    classSentence = "Listening: no flow or background noise only"
  }

  // Derive state according to prd.md §6.5 & prompt rules:
  // VRI >= 70: RED / Critical
  // VRI >= 40: YELLOW / Investigate
  // Otherwise: GREEN / Healthy
  // If ambient is argmax: show GRAY / Listening and don't raise alarms.
  let nodeState: NodeState
  if (condition === "ambient") {
    nodeState = "GRAY"
  } else if (smoothedVri >= 70) {
    nodeState = "RED"
  } else if (smoothedVri >= 40) {
    nodeState = "YELLOW"
  } else {
    nodeState = "GREEN"
  }

  const updatedNodes = {
    ...state.nodes,
    [PROTOTYPE_NODE_ID]: {
      ...state.nodes[PROTOTYPE_NODE_ID],
      state: nodeState,
      vri: smoothedVri,
      condition,
      classSentence,
      lastSeen: new Date(t.t).toLocaleTimeString(),
    },
  }

  const updatedPipes = evaluatePipes(updatedNodes)

  // Entering RED raises a sensor ticket in the unified ticket list
  let currentTickets = state.tickets

  if (nodeState === "RED" && previousPrototypeState !== "RED") {
    const proto = updatedNodes[PROTOTYPE_NODE_ID]
    // Create a new sensor ticket for the unified ticket list if not recently added
    const hasRecentSensorTicket = currentTickets.some(
      (tk) => tk.source === "sensor" && tk.vri && tk.status !== "Resolved" && now - tk.createdAt < 60000
    )
    if (!hasRecentSensorTicket) {
      const sensorTicket: Ticket = {
        id: `T-S${now.toString().slice(-4)}`,
        source: "sensor",
        category: "Sensor alarm",
        title: `Critical Void at ${proto.id} (VRI ${smoothedVri})`,
        locationName: `${proto.id}: ${proto.name} (${proto.road})`,
        lat: proto.lat,
        lon: proto.lon,
        createdAt: now,
        status: "New",
        vri: smoothedVri,
        notes: `Automated TinyML acoustic classification: soil washed away around ${proto.id}. Adjacent drainage lines flagged suspect for sinkhole risk.`,
      }
      currentTickets = [sensorTicket, ...currentTickets]
    }
  }
  previousPrototypeState = nodeState

  // Re-evaluate tickets cross-checking against updated network pipes
  const evaluatedTickets = evaluateTickets(currentTickets, updatedPipes, updatedNodes)

  // Append to sparkline (keep last 60 points)
  const nextSpark = [...state.sparklineHistory.slice(-59), { t: now, vri: smoothedVri }]

  state = {
    ...state,
    latestTelemetry: t,
    telemetryWindow: vriWindow,
    sparklineHistory: nextSpark,
    nodes: updatedNodes,
    pipes: updatedPipes,
    tickets: evaluatedTickets,
    lastMessageTime: isDemo ? state.lastMessageTime : now,
    offlineSeconds: isDemo ? state.offlineSeconds : 0,
    demoBadgeVisible: isDemo,
  }
  emit()
}

// -------------------------------------------------------------
// Scripted Demo Feed (Fallback when MQTT silent >10s or user toggles)
// -------------------------------------------------------------
let demoTimer: ReturnType<typeof setInterval> | null = null
let demoStep = 0

function runDemoStep() {
  demoStep = (demoStep + 1) % 50 // 50-second cyclical script

  let safe: number
  let voidVal: number
  let ambient: number
  let peak: number

  if (demoStep < 20) {
    // 0-20s: Healthy packed soil
    safe = 94 + Math.sin(demoStep) * 2
    voidVal = Math.max(0, 1 + Math.cos(demoStep))
    ambient = 100 - safe - voidVal
    peak = 7200 + Math.round(Math.sin(demoStep) * 150)
  } else if (demoStep < 25) {
    // 20-25s: Ramp up toward void
    const progress = (demoStep - 20) / 5
    safe = 95 * (1 - progress) + 5 * progress
    voidVal = 2 * (1 - progress) + 92 * progress
    ambient = 100 - safe - voidVal
    peak = Math.round(7200 * (1 - progress) + 1650 * progress)
  } else if (demoStep < 45) {
    // 25-45s: Critical void detected
    voidVal = 91 + Math.sin(demoStep * 0.8) * 4
    safe = Math.max(0, 5 - Math.sin(demoStep * 0.5) * 2)
    ambient = 100 - voidVal - safe
    peak = 1650 + Math.round(Math.sin(demoStep) * 50)
  } else {
    // 45-50s: Ramp back down to healthy
    const progress = (demoStep - 45) / 5
    safe = 5 * (1 - progress) + 95 * progress
    voidVal = 92 * (1 - progress) + 1 * progress
    ambient = 100 - safe - voidVal
    peak = Math.round(1650 * (1 - progress) + 7200 * progress)
  }

  processTelemetry(
    {
      safe_soil: Math.round(safe * 10) / 10,
      critical_void: Math.round(voidVal * 10) / 10,
      ambient: Math.round(ambient * 10) / 10,
      peak,
      t: Date.now(),
    },
    true
  )
}

function startDemoFeed() {
  if (demoTimer) return
  demoTimer = setInterval(runDemoStep, 1000)
  state = {
    ...state,
    isDemoFeed: true,
    demoBadgeVisible: true,
  }
  emit()
}

function stopDemoFeed() {
  if (demoTimer) {
    clearInterval(demoTimer)
    demoTimer = null
  }
  state = {
    ...state,
    isDemoFeed: false,
    demoBadgeVisible: false,
  }
  emit()
}

// -------------------------------------------------------------
// Health Monitoring & Auto-connect
// -------------------------------------------------------------
let healthCheckTimer: ReturnType<typeof setInterval> | null = null
let isInitialized = false

export const variantDStore = {
  getSnapshot(): VariantDState {
    return state
  },

  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  init() {
    if (isInitialized) return
    isInitialized = true

    // Start demo feed immediately by default
    startDemoFeed()

    // Connect MQTT automatically
    connectLive(
      {
        url: BROKER_URL,
        topic: TOPIC,
        sampleRate: 16000,
      },
      {
        onStatus: (status, err) => {
          console.log("[Variant D MQTT status]:", status, err || "")
          state = {
            ...state,
            mqttStatus: status,
            mqttError: err || null,
          }
          emit()
        },
        onTelemetry: (t) => {
          console.log("[Variant D MQTT telemetry received]:", t)
          // Real data ALWAYS takes priority: stop demo feed immediately, and drop
          // scripted values from the smoothing window so they don't blend into real readings
          if (state.isDemoFeed) {
            stopDemoFeed()
            state = { ...state, telemetryWindow: [] }
          }
          // Align demo step with incoming telemetry so fallback resumes smoothly
          if (t.critical_void >= 70) {
            demoStep = 30
          } else {
            demoStep = 5
          }
          processTelemetry(t, false)
        },
        onPacket: () => {
          // Packet received
        },
        onWindow: () => {
          // PCM window not needed for Variant D
        },
      }
    )

    // Health check ticker (every 1s)
    healthCheckTimer = setInterval(() => {
      const now = Date.now()
      const lastSeen = state.lastMessageTime

      if (lastSeen) {
        const diffSec = Math.floor((now - lastSeen) / 1000)
        const offlineSec = diffSec >= 5 ? diffSec : 0

        // If silent for 30s and demo feed not active, resume dynamic variability cycle
        if (diffSec >= 30 && !state.isDemoFeed) {
          startDemoFeed()
        }

        if (offlineSec !== state.offlineSeconds) {
          state = { ...state, offlineSeconds: offlineSec }
          emit()
        }
      } else {
        // Has never received a real message yet
        // If 10s elapsed since init, auto-engage demo feed
        if (!state.isDemoFeed) {
          startDemoFeed()
        }
      }
    }, 1000)
  },

  cleanup() {
    if (healthCheckTimer) clearInterval(healthCheckTimer)
    healthCheckTimer = null
    stopDemoFeed()
    disconnectLive()
    isInitialized = false
  },

  addCitizenTicket(t: {
    category: CitizenCategory
    notes: string
    lat: number
    lon: number
    locationName?: string
  }): Ticket {
    const randomNum = Math.floor(100 + Math.random() * 900)
    const newTicket: Ticket = {
      id: `T-${randomNum}`,
      source: "citizen",
      category: t.category,
      title: `${t.category} reported`,
      locationName: t.locationName || "Reported location",
      lat: t.lat,
      lon: t.lon,
      createdAt: Date.now(),
      status: "New",
      notes: t.notes,
    }

    const nextTickets = evaluateTickets([newTicket, ...state.tickets], state.pipes, state.nodes)
    state = { ...state, tickets: nextTickets }
    emit()
    return newTicket
  },

  advanceTicketStatus(ticketId: string) {
    const nextStatus: Record<TicketStatus, TicketStatus> = {
      New: "Assigned",
      Assigned: "Resolved",
      Resolved: "New",
    }

    const updated = state.tickets.map((t) => {
      if (t.id === ticketId) {
        return { ...t, status: nextStatus[t.status] }
      }
      return t
    })

    const evaluated = evaluateTickets(updated, state.pipes, state.nodes)
    state = { ...state, tickets: evaluated }
    emit()
  },
}

export function useVariantDStore(): VariantDState {
  return useSyncExternalStore(variantDStore.subscribe, variantDStore.getSnapshot)
}
