import mqtt, { type MqttClient } from "mqtt"

export type LiveStatus = "idle" | "connecting" | "connected" | "error"

export interface LiveConfig {
  url: string // MQTT-over-WebSocket broker, e.g. ws://localhost:9001
  topic: string
  username?: string
  password?: string
  sampleRate: number
}

export interface Telemetry {
  ambient: number
  critical_void: number
  safe_soil: number
  peak: number // Hz
  t: number // receive time, ms
}

export interface LiveHandlers {
  onTelemetry: (t: Telemetry) => void
  onStatus: (status: LiveStatus, error?: string) => void
  onPacket: (bytes: number) => void
  onWindow: (pcm: Float32Array, sampleRate: number) => void
}

export const LIVE_WINDOW_SEC = 10
const EMIT_INTERVAL_MS = 400
const MIN_SEC = 1
// Backend/ESP32 frame header (prd.md section 6.6): magic "ST" u16 LE, 18 B header, type 3 = raw PCM
const HEADER_BYTES = 18

let client: MqttClient | null = null
let timer: ReturnType<typeof setInterval> | null = null

/** Extracts int16 LE PCM from a payload; strips the ST frame header if present. */
function toPcm(payload: Uint8Array): Float32Array | null {
  let off = 0
  if (payload.length > HEADER_BYTES && payload[0] === 0x54 && payload[1] === 0x53) {
    if (payload[3] !== 3) return null // not a raw PCM frame
    off = HEADER_BYTES
  }
  const n = (payload.length - off) >> 1
  if (n <= 0) return null
  const view = new DataView(payload.buffer, payload.byteOffset + off, n * 2)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true) / 32768
  return out
}

export function connectLive(cfg: LiveConfig, h: LiveHandlers) {
  disconnectLive()
  h.onStatus("connecting")

  const cap = cfg.sampleRate * LIVE_WINDOW_SEC
  const ring = new Float32Array(cap)
  let filled = 0
  let dirty = false

  const c = mqtt.connect(cfg.url, {
    reconnectPeriod: 2000,
    connectTimeout: 5000,
    username: cfg.username || undefined,
    password: cfg.password || undefined,
  })
  client = c

  c.on("connect", () => {
    c.subscribe(cfg.topic, (err) => {
      if (err) h.onStatus("error", err.message)
      else h.onStatus("connected")
    })
  })
  c.on("reconnect", () => h.onStatus("connecting"))
  c.on("error", (err) => h.onStatus("error", err.message))
  c.on("close", () => {
    if (client === c) h.onStatus("connecting")
  })

  c.on("message", (_topic, payload) => {
    h.onPacket(payload.length)
    if (payload[0] === 0x7b) {
      try {
        const j = JSON.parse(new TextDecoder().decode(payload))
        if (typeof j.critical_void === "number") {
          h.onTelemetry({
            ambient: Number(j.ambient) || 0,
            critical_void: j.critical_void,
            safe_soil: Number(j.safe_soil) || 0,
            peak: Number(j.peak) || 0,
            t: Date.now(),
          })
        }
      } catch {
        // not telemetry JSON
      }
      return
    }
    const pcm = toPcm(payload)
    if (!pcm) return
    const chunk = pcm.length > cap ? pcm.subarray(pcm.length - cap) : pcm
    ring.copyWithin(0, chunk.length)
    ring.set(chunk, cap - chunk.length)
    filled = Math.min(cap, filled + chunk.length)
    dirty = true
  })

  timer = setInterval(() => {
    if (!dirty || filled < cfg.sampleRate * MIN_SEC) return
    dirty = false
    h.onWindow(ring.slice(cap - filled), cfg.sampleRate)
  }, EMIT_INTERVAL_MS)
}

export function disconnectLive() {
  if (timer) clearInterval(timer)
  timer = null
  client?.end(true)
  client = null
}
