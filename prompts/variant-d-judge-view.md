# Task: build Variant D, the "Judge View" (a simple live dashboard plus a WAV comparison)

You are working in `dashboard/` (Vite 8, React 19, TypeScript, Tailwind v4, shadcn/ui, Leaflet and react-leaflet, Recharts, hash routing with react-router). Read `dashboard/README.md` for conventions before you start.

## Why this exists

We are presenting **Subsurface Sentinel** to hackathon judges. A sensor in a manhole listens to water flow. A TinyML model on the ESP32 classifies the sound, so the system can tell when soil has washed away around a pipe and left a void. The existing prototypes (`/a`, `/a-audio`, `/b`, `/c`) are dense engineering consoles. `/a-audio` in particular has many controls that judges will not use: run selectors, 10-clip pills, set-as-baseline, scrubbers and a time-scrolling spectrogram.

Variant D is the opposite. **A judge should understand each screen in about 5 seconds**: which spot is a problem, how bad it is, and what to do about it. Every element must earn its place. If in doubt, leave it out.

## Where the code goes

- Create a new folder, `dashboard/src/variants/d/`. Do **not** modify variants a, a-audio, b or c.
- Add the route `/d/*` in `dashboard/src/App.tsx`.
- Add a launcher card in `dashboard/src/launcher.tsx`: tag "D", title "Judge View", marked as featured. Remove `featured` from A-Audio.
- Variant D has two tabs (shadcn `Tabs`, or two routes `/d/network` and `/d/compare` with a minimal top bar):
  1. **Network**, the default
  2. **Compare**

## The live data source (real, already working)

The physical prototype publishes the TinyML result over MQTT about once per second:

- Broker: `wss://broker.hivemq.com:8884/mqtt` (public HiveMQ broker, no username or password)
- Topic: `sentinel/acoustic/telemetry`
- Payload: JSON with values in percent (0 to 100) and `peak` in Hz:
  ```json
  {"ambient":4.69,"critical_void":0.00,"safe_soil":95.31,"peak":7341}
  ```

Reuse `dashboard/src/variants/a-audio/live-mqtt.ts`. It already connects through mqtt.js (installed) and parses this JSON into a `Telemetry` object through `onTelemetry`. Import it; don't copy it. If you need a variant-D-specific store, write a small `useSyncExternalStore` store like `a-audio/store.ts`, but leave out all the clip and playback state. **Auto-connect on page load.** Judges must not have to click Connect.

The rig only sends the classifier output. There is no audio and no spectrum, so the Network tab shows no mic charts.

### How to interpret a message

- **Class** = the argmax of `safe_soil`, `ambient` and `critical_void`. Show it in plain words:
  - `safe_soil`: "Healthy: soil is packed around the pipe"
  - `critical_void`: "Void detected: soil has washed away"
  - `ambient`: "Listening: no flow or background noise only"
- **Void Risk Index (VRI), 0 to 100** = the mean of `critical_void` over the last 5 messages, which smooths flicker. Thresholds, from `prd.md` §6.5:
  - VRI ≥ 70: **RED / Critical**
  - VRI ≥ 40: **YELLOW / Investigate**
  - Otherwise **GREEN / Healthy**
  - If `ambient` is the argmax, show **GRAY / Listening** and don't raise alarms.
- **Connection health:** if no message arrives for 5 s, mark the prototype node "Offline, last seen Xs ago".
- **Demo fallback:** add a small, unobtrusive "Demo feed" switch that replays scripted telemetry: about 20 s healthy, ramp to void, about 20 s void, back to healthy. It must also turn on automatically if MQTT is silent for 10 s, with a visible "DEMO DATA" badge. This keeps the pitch alive if venue Wi-Fi fails. Real data always takes priority when it arrives.

## Tab 1: Network (the complete system at a glance)

A **full-screen map** (Leaflet; reuse the tile setup in `variants/c/map-canvas.tsx`). Use `CircleMarker` and `Polyline`, never default marker images.

**Manholes and pipes**
- Use the 10 manholes from `dashboard/src/data/seed.ts` (they have `lat` and `lon`). Choose **one** to be the real prototype, label it "PROTOTYPE · LIVE" and give it a pulsing ring. Its colour comes from MQTT. The other 9 are simulated and mostly healthy. Script one simulated fault elsewhere, so the map shows that the system covers a whole network.
- There is no pipe data in the seed, so define a small, plausible pipe graph by hand: about 10 to 12 edges connecting the manholes as a drainage network (a tree flowing downhill with a couple of cross links). Put it in `variants/d/network.ts`.
- **Pipe status is inferred from the two manholes it connects.** This is the core idea to show judges:
  - Both ends healthy: pipe is grey or green and thin.
  - One end Void or Investigate and the other end healthy: the pipe is **suspect**. Draw it amber and dashed. The tooltip reads: "Likely void along this pipe, between MH-A (normal flow) and MH-B (void signature)". The reasoning is that sound changes between the two points, so the fault is most likely on the segment between them.
  - Both ends Void: **critical**. Draw it red and thick.
  - When the live prototype goes RED, its pipes to healthy neighbours must turn suspect within a second. That is the demo moment.

**Overlay**: keep it to one compact floating card on the right, not a sidebar of panels:
- A large VRI number and state pill for the live prototype, the class sentence and a tiny 60-second VRI sparkline.
- Three thin bars for safe, ambient and void probability. Peak frequency goes in small muted text.
- "Network: 9 healthy · 1 investigate · 0 critical" as one line.
- A list of currently flagged pipes or manholes, at most 3 rows. Clicking a row flies the map to it.
- The top bar contains only: the title, a Network/Compare switch, a live connection dot, **"Report a problem"** and **"Tickets (n)"**.

**Ground risk zones (sinkhole likelihood)**
- Only around problem pipes and manholes. Healthy areas get **no colour at all**, so red on the map always means something.
- Around each suspect or critical pipe, draw a soft band in three steps: **High** (about 30 m), **Medium** (about 60 m) and **Low** (about 100 m). Use semi-transparent red, orange and yellow that fade out toward neutral. Use Leaflet `Circle`s with the radius in **metres**, sampled every ~15 m along the pipe, so the band scales correctly when zooming. Don't use pixel-width polylines. For a critical pipe, use the full three steps. For a suspect pipe, start at Medium.
- Add a three-row legend in a map corner: "Ground risk: High / Medium / Low". The tooltip on a zone reads: "Soil loss likely near pipe MH-03 → MH-04. Possible sinkhole risk."
- Do **not** build a grid heatmap or reuse `riskCells` from the seed. Keep the risk tied to the pipes.

**Reporting and tickets (citizens can report, everything lands in one ticket list)**
- Put a prominent **"Report a problem"** button on the map, as a citizen would use it. Flow, in a small dialog:
  1. Click a spot on the map, or "Use my location".
  2. Pick a category: Cracked road / Road sinking or dip / Water pooling / Strange sound.
  3. Optionally add a note, then submit.
  Keep it to three steps at most. On submit, a citizen pin appears on the map and a toast confirms: "Report received: ticket #T-0123".
- **One ticket list for both sources.** Sensor alerts (a node entering RED, a pipe becoming critical) and citizen reports create tickets in the same list.
  - Show it in a right-side `Sheet`, opened by a **"Tickets (n)"** button in the top bar with a count badge for New tickets.
  - Each ticket is **one row**: a source icon (sensor or citizen), a short title, the place (nearest manhole or pipe), how long ago it came in, and a status chip.
  - The status chip moves through New → Assigned → Resolved. Clicking the chip advances it. There's no ticket detail page.
  - Clicking a row flies the map to that ticket's location.
- **Cross-check, the key story for judges:** if a citizen report falls inside a ground risk zone or within ~100 m of a suspect pipe, tag both tickets **"Matches sensor alert"** and move them to the top. Do the same the other way round: when a pipe becomes suspect, existing nearby citizen reports get linked. This shows the sensor and the public confirming each other.
- Seed 3 or 4 citizen tickets so the list isn't empty: 2 near the scripted simulated fault, which should show as matched, and 1 or 2 elsewhere, which should show as unmatched and low priority. Label them "Simulated".
- Optional, only if there's time: an "Export" button that prints the ticket list with `window.print()` and a print stylesheet. Don't integrate a PDF library.

**Remove these:** time scrubbers, playback, run or clip selectors, baselines, LoRa or battery details and multi-panel layouts.

## Tab 2: Compare (Problem vs Normal, side by side)

Purpose: show judges what a void *sounds and looks like* compared with normal conditions, using real recordings.

**Layout**: two equal columns. The left column is labelled **"A"** and the right **"B"**. Each column contains:
1. **A drop zone / file picker for one `.wav`.** Preload defaults so the screen is never empty: left = `/audio-runs/void/CRITICAL_VOID_01.wav`, right = `/audio-runs/ambient/AMBIENT_01.wav`, both served from `dashboard/public/audio-runs/`. Add a tiny preset dropdown per column (Void / Safe / Ambient, file 01 to N) as an alternative to dropping a file.
2. **A verdict header**, the biggest thing in the column: a coloured state pill (RED Void / GREEN Healthy / GRAY Ambient), a VRI number and one sentence. The judge should be able to read the verdict from across a table.
3. **MIC spectrogram of the whole file.** Render the full clip at once, with time on the x-axis spanning the entire recording, 0 to 8 kHz on the y-axis and the inferno colormap. It is static: not scrolling, no playhead and no time-synced animation. Reuse `computeStft()` from `variants/a-audio/audio-engine.ts` and copy the colormap LUT approach from `a-audio/widgets/spectrogram-10s.tsx`. Use the **same dB range for both columns** so they are visually comparable.
4. **MIC spectrum.** Show the time-averaged spectrum (dB vs frequency, 0 to 8 kHz) for the column's file. Shade the bands that matter: 800 to 2000 Hz "pipe resonance" and 2000 to 5000 Hz "hiss". Use `AUDIO_BANDS` in `a-audio/types.ts`. Also draw the **other** column's spectrum as a faint dashed overlay, so the contrast is visible on one chart.

Below both columns, add **one "What's different" strip**. It gives 2 or 3 auto-generated plain-language callouts computed from the two files' band energies. Example: "A has +12 dB more hiss (2–5 kHz) than B", "A's resonance peak is 1.6 kHz vs 1.0 kHz in B, which is typical of a hollow cavity".

**VRI for files**: wrap each file as a one-clip `AudioRun` and use `calculateAcousticVri()` from `a-audio/audio-engine.ts`. Use the column holding a Safe or Ambient file as the baseline. If neither is, use a Safe preset loaded silently. Keep the logic in one small function.

**Optional**: a single ▶ play button per column to hear the clip. No scrubber and no time display.

## Visual and UX rules

- Use shadcn/ui components and Tailwind semantic tokens, so light and dark mode both work. Hard-coded colours are allowed only for state colours (GREEN/YELLOW/RED/GRAY) and the spectrogram colormap.
- Use large type for verdicts and VRI, and small, muted type for everything technical. Use at most 2 font sizes per card.
- Use plain words for judges ("Void detected", "Likely failing pipe") rather than jargon. Technical values can appear in tooltips.
- The layout must work on a 1440×900 laptop screen, the size of a projector, without scrolling on the Network tab.
- Anything simulated (the 9 other manholes, the demo feed) must carry a small "Simulated" label. The live prototype must be clearly marked "Live".

## Done when

- `pnpm typecheck` and `pnpm lint` pass in `dashboard/`.
- `/#/d` loads with the map. The prototype dot reflects real MQTT messages from `sentinel/acoustic/telemetry`. Test this by running a quick publisher, for example `npx mqtt pub -h broker.hivemq.com -p 8883 -l mqtts -t sentinel/acoustic/telemetry -m '{"ambient":2,"critical_void":91,"safe_soil":7,"peak":1650}'`, and confirming the dot goes RED and the adjacent pipes turn suspect.
- With the network disconnected, the demo feed kicks in after 10 s and is labelled as demo data.
- When the prototype goes RED, a sensor ticket appears, a High/Medium/Low ground risk band appears around its suspect pipes, and any seeded citizen report inside that band shows "Matches sensor alert".
- A new citizen report takes at most 3 clicks and appears both as a map pin and as a ticket.
- On `/#/d/compare`, the void and ambient defaults render immediately with full-length spectrograms and overlaid spectra. Dropping a different `.wav` into either column updates that column and the "What's different" strip.
- Nothing from variants a, a-audio, b or c changed, apart from the shared `App.tsx` route and `launcher.tsx` card.
