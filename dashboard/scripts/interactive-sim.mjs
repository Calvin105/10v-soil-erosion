import readline from "readline"
import mqtt from "mqtt"

const BROKER_URL = "mqtts://broker.hivemq.com:8883"
const TOPIC = "sentinel/acoustic/telemetry"

console.log("Connecting persistent link to HiveMQ...", BROKER_URL)
const client = mqtt.connect(BROKER_URL, {
  keepalive: 60,
  reconnectPeriod: 2000,
})

const PRESETS = {
  v: {
    name: "CRITICAL VOID (91%)",
    payload: { ambient: 2, critical_void: 91, safe_soil: 7, peak: 1650 },
  },
  h: {
    name: "HEALTHY (95%)",
    payload: { ambient: 5, critical_void: 0, safe_soil: 95, peak: 7200 },
  },
  a: {
    name: "AMBIENT LISTENING",
    payload: { ambient: 92, critical_void: 1, safe_soil: 7, peak: 120 },
  },
}

// The dashboard averages the last 5 readings, so send a short burst to fill that window
const BURST = 5
const BURST_GAP_MS = 150

function publish(key) {
  const p = PRESETS[key]
  if (!p) return
  const msg = JSON.stringify(p.payload)
  for (let i = 0; i < BURST; i++) {
    setTimeout(() => {
      client.publish(TOPIC, msg, { qos: 0 }, (err) => {
        if (err) console.error("Error publishing:", err)
        else if (i === BURST - 1) console.log(`[${new Date().toLocaleTimeString()}] Sent ${p.name} x${BURST}`)
      })
    }, i * BURST_GAP_MS)
  }
}

client.on("connect", () => {
  console.log("\n=======================================================")
  console.log("⚡ SENTINEL INSTANT SIMULATOR (Connected to HiveMQ)")
  console.log("=======================================================")
  console.log("Press key:")
  console.log("  [v] -> Trigger CRITICAL VOID (MH-04 RED, VRI 91, suspect pipes)")
  console.log("  [h] -> Trigger HEALTHY BASELINE (MH-04 GREEN, VRI 0)")
  console.log("  [a] -> Trigger AMBIENT (MH-04 GRAY)")
  console.log("  [q] -> Quit")
  console.log("-------------------------------------------------------\n")

  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.on("keypress", (str, key) => {
      if (key.name === "q" || (key.ctrl && key.name === "c")) {
        console.log("\nExiting.")
        client.end(true)
        process.exit(0)
      }
      if (PRESETS[str]) {
        publish(str)
      }
    })
  }
})

client.on("error", (e) => {
  console.error("MQTT Error:", e.message)
})
