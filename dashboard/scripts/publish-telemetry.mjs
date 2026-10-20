import mqtt from "mqtt"

const arg = process.argv[2] || "void"

const PRESETS = {
  void: '{"ambient":2,"critical_void":91,"safe_soil":7,"peak":1650}',
  healthy: '{"ambient":5,"critical_void":0,"safe_soil":95,"peak":7200}',
  ambient: '{"ambient":92,"critical_void":1,"safe_soil":7,"peak":120}',
}

const message = PRESETS[arg] || arg

const t0 = Date.now()
const client = mqtt.connect("mqtts://broker.hivemq.com:8883", {
  family: 4,
  connectTimeout: 4000,
})

// The dashboard averages the last 5 readings, so send a burst to fill that window
const BURST = 5

client.on("connect", () => {
  let sent = 0
  for (let i = 0; i < BURST; i++) {
    client.publish("sentinel/acoustic/telemetry", message, { qos: 0 }, (err) => {
      if (err) {
        console.error("Publish error:", err)
        process.exit(1)
      }
      if (++sent < BURST) return
      console.log(`✓ Published x${BURST} in ${Date.now() - t0}ms: ${message}`)
      client.end(true, () => {
        process.exit(0)
      })
    })
  }
})

client.on("error", (err) => {
  console.error("Connection error:", err.message)
  process.exit(1)
})
