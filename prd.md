# PRD: Subsurface Sentinel

**Acoustic early warning for soil washout and sinkholes in master-planned townships**

| | |
|---|---|
| Event | Sime Darby Property (SDP) University Hackathon 2026 |
| Theme | PLANET (Climate Resilience), with PEOPLE (Safety) impact |
| Status | Draft v1.1, 2026-10-15 |
| Submission deadline | Fri 2026-10-23, 23:59 (registration closes Wed 2026-10-21) |
| Prototype | ESP32 board (assumed: Seeed XIAO ESP32S3 Sense) with exactly **two sensors**: **one acoustic vibration sensor** on the pipe and **one microphone**. The pipe is PVC, buried in soil inside a container (simulated manhole). |
| Dashboard | React + shadcn/ui. Three layout directions are prototyped in `dashboard/` (frontend only, seed data). |

**Changes in v1.1**
- The two sensors now have distinct jobs. The **microphone** produces the frequency map (FFT). The **vibration sensor** captures the pipe's rumble and the transients when water flow is switched on and off.
- The primary excitation is now the **flow pulse test** (switching the water on and off). The solenoid tapper is optional.
- ML runs on the **laptop first** (Phase 1), then as **TinyML on the ESP32** (Phase 2).
- LoRaWAN and multi-year battery life are **not in the prototype**. They appear in the dashboard as a clearly labelled **production concept** with 10 simulated manholes.

---

## Table of contents

1. [Problem](#1-problem)
2. [Goals and non-goals](#2-goals-and-non-goals)
3. [Users and user stories](#3-users-and-user-stories)
4. [How detection works](#4-how-detection-works)
5. [Core product requirements](#5-core-product-requirements)
6. [Prototype technical specification](#6-prototype-technical-specification)
7. [Production design (not built for the hackathon)](#7-production-design-not-built-for-the-hackathon)
8. [Complementary systems (S1 to S4)](#8-complementary-systems-s1-to-s4)
9. [Competitive landscape](#9-competitive-landscape)
10. [Judging criteria mapping](#10-judging-criteria-mapping)
11. [Success metrics](#11-success-metrics)
12. [Risks, limitations and open questions](#12-risks-limitations-and-open-questions)
13. [Build timeline (15 to 23 Oct)](#13-build-timeline-15-to-23-oct)
14. [Glossary](#14-glossary)

---

## 1. Problem

**Sinkholes in urban Malaysia start out invisible.** A cracked joint or a failed pipe lets water carry soil away from around a buried pipe. A cavity (void) grows under the road. The asphalt above bridges the void and looks normal until it fails all at once, usually under a heavy vehicle.

- **Real-world anchor:** On 23 August 2024 a sinkhole about 8 m deep opened on Jalan Masjid India, Kuala Lumpur. A pedestrian fell in and was never recovered. Investigators linked it to a failed sewer pipe structure. *(Cite primary news sources in the deck.)*
- **The gap:** township and council maintenance is **reactive**. Assets are inspected on complaints or fixed schedules. Nothing continuously watches the soil around drainage pipes, so the first sign of a void is often a collapse.
- **Why townships are exposed:** many Klang Valley townships sit on karst limestone or backfilled ex-tin-mining land. They take intense tropical rainfall and carry heavy construction and refuse-truck traffic. Section 8.3 lists these "predisposition attractors" in full.

**Cost asymmetry (illustrative; the team must verify figures before pitching):** filling an early void with grout or polyurethane is a small, planned job. An emergency road excavation after a collapse means road closures, liability, reputational damage, and possible loss of life.

---

## 2. Goals and non-goals

### 2.1 Hackathon goals (by 23 Oct)

**Minimum bar (must work even if everything else slips):** the prototype **streams both sensors into the dashboard live**. The dashboard **visualises** them (mic frequency map, vibration waveform and transients) and **shows ML insights**: first from a model running **on the laptop**, then from **TinyML on the ESP32**.

| ID | Goal |
|---|---|
| G1 | **Stream both sensors live** (vibration + microphone) from the ESP32 into the dashboard. |
| G2 | **Visualise**: the mic spectrogram and live spectrum (FFT) against the healthy baseline; the vibration waveform and flow on/off ring-down against the baseline. |
| G3 | **Insights, Phase 1:** run ML on the laptop over the streamed features, showing class probabilities, the Void Risk Index and state. |
| G4 | **Insights, Phase 2:** run the same task as TinyML on the ESP32, and compare it with the laptop model in the dashboard. |
| G5 | Show on the rig that the system **tells packed soil from a void** repeatably, with a graded response to void size. |
| G6 | Show the **operational loop**: anomaly → alert on a township map → work order. |
| G7 | Show the **production concept** in the dashboard: a LoRaWAN network of 10 manholes × 2 sensors, plus a battery projection. Simulated and clearly labelled. |
| G8 | Present the **ecosystem roadmap** (S1 to S4). |
| G9 | Ship a public repo and a hosted dashboard link that works **without the hardware** (Replay mode). |

### 2.2 Pilot goals (post-hackathon, months 1 to 6)

- Validate detection on real concrete culverts and manholes in one SDP township.
- Compare alerts against CCTV and ground-penetrating radar (GPR) ground truth.
- Integrate with SDP Facility Management work-order tooling.

### 2.3 Non-goals (hackathon)

- Real manhole installation, a **LoRaWAN radio network**, or **multi-year battery operation** in the prototype. These are designed in Section 7 and **displayed in the dashboard as a simulated concept** (10 manholes, 2 gateways, uplink log, battery calculator). They are not built in hardware.
- Measuring water level as a percentage. The node reports **wet/dry only** (Section 4.4).
- Measuring void size in absolute units in the field. The prototype shows a *relative* response to void size on the rig only.
- Building S1 to S4 fully. They appear as specification plus optional mock views.

---

## 3. Users and user stories

### 3.1 Personas

| Persona | Role | Needs |
|---|---|---|
| **Farah, FM Engineer** (primary) | SDP Facility Management, responsible for drainage and roads in one township | Early, trustworthy alerts with evidence; few false alarms; a clear "go inspect here" |
| **Daniel, Township Manager** | Oversees budget, contractors and resident relations | Risk overview, cost avoided, which areas to prioritise, reports for management |
| **Council engineer** | Local authority (PBT) maintaining public drains and roads | Shared view of risk on council assets; standard data exports |
| **Resident / commuter** | Lives and drives in the township | Safe roads; an easy way to report cracks or sagging; feedback that reports were acted on |
| **Hackathon judge** | Evaluates in a 5-minute demo | Sees the physics work live, understands the value immediately |

### 3.2 User stories

| ID | Story | Priority |
|---|---|---|
| US1 | As an FM engineer, I want a node to alert me when the soil around a pipe starts washing away, so I can fix it before the road collapses. | Must |
| US2 | As an FM engineer, I want each alert to come with evidence (spectrogram, ring-time change, history), so I can trust it and justify dispatching a crew. | Must |
| US3 | As an FM engineer, I want to see every node on a map with green/yellow/red status, so I know where to look first. | Must |
| US4 | As an FM engineer, I want an alert to create a work order whose inspection result is recorded, so the system learns which alerts were real. | Must |
| US5 | As a judge, I want to watch the frequency map change as soil is removed, so I can see the detection is real and not scripted. | Must |
| US6 | As a township manager, I want a risk map that combines geology, rainfall, traffic and reports, so I can place sensors and schedule inspections proactively. | Should (S3) |
| US7 | As a resident, I want to report a crack or sinking road in under a minute and hear back, so I feel safe and heard. | Should (S1) |
| US8 | As an FM engineer, I want to know which manholes run full during storms, so I can find blockages and surcharged pipes. | Could (S4) |

---

## 4. How detection works

### 4.1 Two sensors, two jobs

| | **Acoustic vibration sensor** (VIB) | **Microphone** (MIC) |
|---|---|---|
| Hardware | Analog piezo vibration sensor bonded to the pipe wall | Microphone in the chamber air (assumed: the XIAO ESP32S3 Sense onboard PDM mic) |
| What it hears | The **pipe's own rumble**, through the structure: flow vibration and the **transient each time water flow is switched on or off** | **Sound** in the chamber: flow noise, the pipe's ringing, leak hiss |
| Processing | Time domain: RMS, peak, crest factor, and **ring-down time (τ)** of each on/off transient | **FFT → frequency map** (spectrogram) and band energies |
| Dashboard view | Rolling waveform + ring-down envelope vs baseline | Waterfall spectrogram + live spectrum vs baseline |
| Main insight | **How long the pipe keeps vibrating** after a flow change | **Which frequencies light up**: resonance peak and leak band |

### 4.2 The physics both sensors pick up

**Signal 1: loss of soil damping (the "hollow drum").** This is the primary signal.
- Packed soil around a pipe acts as a heavy damper. When water flow starts or stops, the pipe wall vibrates briefly and the vibration dies away within milliseconds: a **dull thud**.
- When soil washes away, part of the pipe wall is unsupported. It vibrates for longer, louder, and at a different resonant frequency: a **hollow ring**.
- **VIB** measures this as a longer **ring-down time (τ)** and higher rumble RMS.
- **MIC** measures it as a **resonance peak** appearing or shifting, plus more energy in the 0.8–2 kHz band.

**Signal 2: leak noise.** This is secondary.
- Water escaping through a crack into soil makes broadband turbulent noise, typically in the high hundreds of Hz to a few kHz. It is mainly a **MIC** signal.
- **Caveat:** stormwater culverts are mostly **gravity-fed and unpressurised**, so leaks there are quiet. Leak noise is strongest on **pressurised** pipes (water mains, sewer force mains) and on stormwater pipes while they are surcharged. Signal 1 therefore carries the product, and Signal 2 is supporting evidence.

**Why two sensors beat one:** a sound that is loud on MIC but weak on VIB is airborne, such as traffic or voices. A vibration strong on VIB is coming through the pipe. Comparing the two channels rejects a lot of ambient noise.

### 4.3 Excitation: the flow pulse test

The rig switches the water **on/off/on/off** in a fixed pattern, and every switch sends a transient through the pipe.

| Mode | How | Strengths | Weaknesses |
|---|---|---|---|
| **Passive** | Listen to steady flow and whatever else is happening | No control needed; also catches leak noise | Random excitation, so readings are harder to compare over time |
| **Flow pulse test** (primary) | The ESP32 switches the pump on and off (e.g. 4 cycles, 1.2 s each way) through a MOSFET or relay; VIB measures τ for each switch | Repeatable excitation; the ring-down is directly comparable with the baseline; uses the pump the rig already has | In the field, stormwater flow cannot be switched. Production relies on natural flow changes or an optional tapper (Section 7) |
| Solenoid tap (optional) | A small solenoid taps the pipe | Works with no flow at all | One extra actuator |

**The demo:** run the pulse test with packed soil, open the void window, run it again, and compare the two ring-down curves on screen.

### 4.4 Each node learns its own "normal"

Every manhole, pipe material, depth and soil type sounds different, so one universal "void sound" model will not transfer from a sand box to the field. The design is therefore:
1. **Commissioning:** each node records a healthy baseline (in production, days to weeks; on the rig, about 10–30 s plus one pulse test).
2. **Monitoring:** the node scores **drift from its own baseline** (mic band-energy deviation, vibration ring-time ratio, resonance-peak shift).
3. **The classifier assists.** The rig-trained classifier adds a second opinion. It does not make the decision alone.

### 4.5 Wet/dry detection (binary water contact)

The node reports `water_contact = true/false` **at its mounting height only**: no percentage and no depth.
- **Primary (two-sensor constraint):** inferred acoustically. When water reaches the sensor level, VIB picks up strong broadband flow coupling, and the MIC spectrum changes as the chamber fills. A `submerged` class or rule detects this. **This is unvalidated and must be proven on the rig.**
- **Recommended hardening:** an optional conductive water-contact probe (two stainless screws, about RM3) makes the flag deterministic. Only the mic electronics must stay dry.
- The mounting height is chosen deliberately as a **surcharge threshold** (for example, the pipe crown). This flag feeds S4 (Section 8.4).

---

## 5. Core product requirements

Priorities: **M** = must for the hackathon, **S** = should, **C** = could / stretch, **P** = production only.

### 5.1 Sensor node

| ID | Requirement | Pri |
|---|---|---|
| FR-N1 | Capture **VIB** (analog piezo vibration sensor on the pipe wall) through the ADC at 4 kHz. | M |
| FR-N2 | Capture **MIC** (microphone in the chamber) at 16 kHz. | M |
| FR-N3 | Frame both channels on a shared timeline (same frame index, skew < 1 frame). | M |
| FR-N4 | Switch the pump on and off for the **flow pulse test** (MOSFET or relay on a GPIO), on command or on a schedule. Timestamp every switch. | M |
| FR-N5 | Report `water_contact` (bool). | S |
| FR-N6 | Detect and flag clipping on either channel. | S |
| FR-N7 | Optional solenoid tapper, for excitation with no flow. | C |
| FR-N8 | Production: mount dry, on the pipe crown or the manhole collar, above normal water level. | P |

### 5.2 Signal processing and ML

| ID | Requirement | Pri |
|---|---|---|
| FR-E1 | **MIC:** compute a Hann-windowed FFT per frame (1024 samples, hop 512) → 256-bin frequency map. | M |
| FR-E2 | **MIC features:** RMS, 5 band energies, spectral centroid, peak frequency. | M |
| FR-E3 | **VIB features:** RMS, peak, crest factor, dominant frequency, and the downsampled waveform for display. | M |
| FR-E4 | **VIB transients:** for each flow on/off switch, compute the ring-down envelope and τ, then compare with the baseline τ (ring-time ratio). | M |
| FR-E5 | **Cross-channel:** compute the VIB/MIC energy ratio to separate airborne noise from pipe vibration. | S |
| FR-E6 | **Phase 1 ML on the laptop:** a scikit-learn model (Random Forest to start) over the streamed features, giving `packed`, `void`, `leak` and `noise` probabilities in real time. | M |
| FR-E7 | **Phase 2 TinyML on the ESP32:** an Edge Impulse int8 model doing the same task on-device. Its probabilities are sent in the stream so the dashboard can compare it with the laptop model. | S |
| FR-E8 | Compute baseline deviation and the Void Risk Index (Section 6.5). The prototype runs this on the laptop; production runs it on-device. | M |
| FR-E9 | Detect `submerged` (wet) acoustically. | C |

### 5.3 Telemetry

| ID | Requirement | Pri |
|---|---|---|
| FR-T1 | STREAM mode: send binary frames at 10 to 15 fps over WebSocket (Wi-Fi). Each frame carries the mic spectrum, a vibration waveform chunk, features, and transient events. | M |
| FR-T2 | Fall back to USB serial with identical framing if Wi-Fi fails. | M |
| FR-T3 | Accept commands from the laptop: pulse test, pump on/off, calibrate, sampling-rate change. | M |
| FR-T4 | TELEMETRY mode: send a compact 11-byte status payload (the same layout LoRaWAN would carry) periodically and on state change, to prove the payload design. | C |
| FR-T5 | Production only: LoRaWAN AS923 uplink with a downlink for config. **Not built.** Shown as a concept in the dashboard (FR-D9). | P |

### 5.4 Backend

| ID | Requirement | Pri |
|---|---|---|
| FR-B1 | Ingest frames over WebSocket and serial, and fan out to dashboard clients. | M |
| FR-B2 | Calibrate a baseline per node on request: mic baseline spectrum, plus vibration baseline τ from a pulse test. | M |
| FR-B3 | Compute the Void Risk Index and run the alert state machine with persistence and hysteresis. | M |
| FR-B3a | Run the **Phase 1 laptop model** (scikit-learn) on each feature window and stream its probabilities to the dashboard. | M |
| FR-B4 | Record labelled clips with metadata (`mic.wav` + `vib.wav` + JSON sidecar); export a dataset for scikit-learn and for Edge Impulse. | M |
| FR-B5 | Store nodes, alerts, work orders and recordings (SQLite). | M |
| FR-B6 | Record sessions for Replay. | M |
| FR-B7 | Accept surface reports (S1 mock) and apply the S2 escalation rules. | C |

### 5.5 Dashboard

| ID | Requirement | Pri |
|---|---|---|
The dashboard is built with **React + shadcn/ui**, which gives one design system for buttons, cards, sidebars, sheets, charts and so on. It has two clearly separated areas:
- **Prototype (live):** everything streamed from the real rig.
- **Production concept (simulated, not built):** the LoRaWAN network and battery projection.

| ID | Requirement | Pri |
|---|---|---|
| FR-D1 | **Prototype, mic:** waterfall spectrogram + live spectrum with a dashed baseline overlay and labelled bands. | M |
| FR-D2 | **Prototype, vibration:** rolling waveform + ring-down panel (current transient envelope vs baseline, τ now vs baseline, ratio). | M |
| FR-D3 | **Prototype, ML insights:** Phase 1 laptop probabilities and Phase 2 TinyML probabilities side by side; a switch for which model drives the VRI; model cards with held-out accuracy and confusion matrix. | M |
| FR-D4 | **Prototype, VRI:** gauge, state (GREEN/YELLOW/RED), components, and history. | M |
| FR-D5 | **Prototype, controls:** Calibrate baseline, Run flow pulse test, Pump on/off, Record & label, Wet toggle, transport status (Wi-Fi/serial), with progress bars for running tasks and an event log. | M |
| FR-D6 | **Prototype, dataset:** minutes collected per class per packing toward the target. | S |
| FR-D7 | **Township Map** with the live rig plus simulated manholes, coloured by state. | M |
| FR-D8 | **Alerts & Work Orders** with lifecycle and an evidence snapshot. | M |
| FR-D9 | **Production concept (simulated):** a LoRaWAN topology of 10 manholes × 2 sensors → 2 gateways → network server → dashboard. Includes a live uplink log (RSSI, SNR, spreading factor, time-on-air), the 11-byte payload layout, and a battery projection calculator labelled "concept estimate". | M |
| FR-D10 | **Replay mode**: runs fully client-side from recorded sessions, so the hosted link works with no hardware. | M |
| FR-D11 | **Risk Layers** mock view (S3 vision). | C |
| FR-D12 | Public report form mock (S1) that feeds S2 escalation. | C |

### 5.6 Non-functional requirements

| ID | Requirement |
|---|---|
| NFR1 | End-to-end latency from sensor to screen < 500 ms on local Wi-Fi. |
| NFR2 | Spectrogram renders at ≥ 10 fps without dropped UI frames on a mid-range laptop. |
| NFR3 | The demo survives venue Wi-Fi loss (serial fallback, phone hotspot). |
| NFR4 | Replay works offline from static hosting. |
| NFR5 | Any time compression used in the demo is shown on screen ("DEMO TIME" badge). |
| NFR6 | Production: node BOM target < RM200 at volume (to be validated); IP68; dry mount; corrosion-resistant. |
| NFR7 | Production and S1: comply with Malaysia's PDPA 2010 for any resident data. |

---

## 6. Prototype technical specification

### 6.1 Test rig: a simulated manhole

The container is the ground, its side wall is the manhole wall, and the pipe end sticking out of the wall is the pipe entering the manhole. In the field, the sensor sits on the exposed pipe end inside the manhole. The rig mirrors that.

```
            "Manhole chamber" (inverted bucket / box over pipe end)
                ┌──────────────┐
   MIC ───────► │   (air)      │   (ESP32 board with mic sits here, not touching the pipe)
                │  ┌────────┐  │      Clear storage container packed with soil/sand
   VIB sensor ─►│  │ pipe   │══╪═════════════════════════════════════════════╗
   (on pipe)    │  │  end   │  │   ░░░░░░░ packed soil ░░░░░░░░░░░░░░░░░░░░░░ ║  <- PVC pipe
                │  └────────┘  │   ░░░░░░░░░░[ void zone ]░░░░░░░░░░░░░░░░░░░ ║
                └──────────────┘   ░░░░░░░░░░ access window ░░░░░░░░░░░░░░░░░ ║
                                   pump inlet ─► recirculating flow ──────────╝
                                   (pump switched ON/OFF by the ESP32 for the flow pulse test)
```

**Controlled variables (these are what make the data credible):**
- **Flow:** a small submersible pump recirculates from a bucket at a constant rate. Do not pour by hand.
- **Flow switching:** the ESP32 switches the pump through a logic-level MOSFET (DC pump) or a relay module, so on/off timing is identical every run. Manual switching is acceptable for early tests only.
- **Void size:** an access window in the container wall at the void zone. Remove soil with measuring cups of **0 / 100 / 250 / 500 ml** to create steps of known size. Re-pack with a tamper to a marked level to restore the baseline.
- **Leak:** a second pipe section (or a plugged hole) that can be opened so water escapes into the soil.
- **Interference:** a speaker playing truck or traffic rumble, and hand thumps on the table, to test noise rejection.
- **Packings:** record the whole scenario set on at least **3 separate re-packings**, so the test set can be a packing the model never saw.

### 6.2 Bill of materials (approximate Malaysian retail prices)

| Item | Purpose | Approx. RM |
|---|---|---|
| Seeed XIAO ESP32S3 Sense (assumed; any ESP32-S3 works) | MCU + **onboard PDM microphone** (MIC); vector instructions help TinyML | 60–80 |
| **Analog** piezo vibration sensor module, or a bare piezo disc + preamp | **VIB** sensor on the pipe wall. **Not** the SW-420 digital vibration switch, which only outputs on/off and cannot give a waveform | 5–15 |
| MCP6002 op-amp + 1 MΩ bias, trimmer, RC filter, BAT54S clamp (only if using a bare disc) | Piezo preamp and anti-alias filter | 5–10 |
| IRLZ44N MOSFET + 1N4007 diode (DC pump), or a 5 V relay module | Lets the ESP32 switch the pump for the flow pulse test | 5–10 |
| 5 V 2 A supply / power bank | Pump power (common ground with the ESP32) | — |
| 5 V solenoid (optional) | Tapper for excitation with no flow | 10–20 |
| Stainless screws + wire (optional) | Water-contact probe | 3 |
| 50 mm PVC pipe ~60 cm + fittings | Pipe | 20–30 |
| Clear storage container ~50 L | Ground | 20–40 |
| Sand / soil | Backfill | 10–20 |
| Small submersible pump + tubing + bucket | Constant flow | 15–25 |
| Breadboard, jumpers, hot glue, epoxy | Assembly | 15 |
| **Total** | | **~RM150–260** |

**Mounting:**
- Bond the VIB sensor to the pipe crown with epoxy or cyanoacrylate, or clamp it. **Do not use a thick layer of hot glue.** It damps exactly the vibration being measured.
- Keep the board and its mic **off the pipe**, in the chamber air, so the two channels stay physically distinct. Keep the mic-to-pipe distance the same in every session.

**Wiring notes:**
- Use an **ADC1** pin for the VIB sensor. ADC2 conflicts with Wi-Fi on ESP32-family chips.
- Piezos produce voltage spikes on hard knocks. Use a series resistor and clamp diodes before the ADC.
- The ESP32 ADC is noisy and non-linear. That is fine for relative comparison against a baseline.
- Put a flyback diode across the pump motor, and run the pump from its own 5 V supply with a shared ground. Pump switching noise must not reset the ESP32.

### 6.3 System architecture

```
 [VIB sensor on pipe]─► ADC1 (continuous DMA, 4 kHz) ──► waveform, RMS, transient ring-down τ ─┐
                                                                                                ├─► frame builder
 [Mic (PDM)] ─────────► PDM/I2S (DMA, 16 kHz) ─────────► FFT → 256-bin frequency map, bands ───┘   (+ Phase 2:
 [Pump] ◄── GPIO → MOSFET/relay ◄── "pulse test" command                                            TinyML int8)
                                                                              │
                                                       ├─ WebSocket over Wi-Fi ─┐
                                                       └─ USB serial (fallback) ┤
                                                                                ▼
        FastAPI backend (laptop): ingest → Phase 1 ML (scikit-learn) → baseline / VRI / alerts → SQLite + WAV
                                                │  WS /ws/live
                                                ▼
        Browser dashboard (React + shadcn/ui)
          ├─ PROTOTYPE (live): Mic | Vibration | ML insights | VRI | Controls | Dataset
          ├─ Operations: Map | Alerts & Work Orders | Risk Layers (mock)
          └─ PRODUCTION CONCEPT (simulated): LoRaWAN 10 manholes × 2 sensors | Battery projection
                                                │
        Static hosting (Replay mode, no backend) ◄── recorded sessions
```

### 6.4 Firmware pipeline

| Stage | Detail |
|---|---|
| Capture, MIC | PDM microphone at 16 kHz via the I2S/PDM peripheral with DMA. |
| Capture, VIB | ADC1 continuous mode at 4 kHz, 12-bit, with DMA. 4 kHz covers the pipe rumble and transient ring (tens of Hz to ~1.5 kHz). |
| Framing | Mic: N = 1024 samples (64 ms), hop 512 → ~31 frames/s computed, every 2nd frame sent → **~15 fps**. VIB is framed on the same clock (≈ 256 samples per mic frame). |
| MIC FFT | `esp-dsp` real FFT, Hann window → 512 bins (15.6 Hz each, 0–8 kHz) → mean-pooled to **256 bins (31.25 Hz each)**. |
| dB quantisation | `q = clamp(round((dB + 120) × 2), 0, 255)`: 0.5 dB steps, range −120 to +7.5 dBFS. |
| VIB waveform | Downsample to 2 kHz and send 128 samples as int8 per frame, for the dashboard scope. |
| Features (14 × float32) | **MIC:** rms, band[0–200, 200–800, 800–2k, 2k–5k, 5k–8k Hz] (5), centroid, peak_freq. **VIB:** rms, peak, crest, dominant_freq. **Cross:** vib/mic energy ratio. **Last transient:** τ. |
| Noise rejection hint | Sound that is strong on **MIC but weak on VIB** is airborne or ambient (traffic, voices). Energy on **VIB** comes through the pipe structure. |
| Flow pulse test | On a `pulse` command: switch the pump OFF/ON for `cycles` × `half_period_ms`. For each switch, capture 400 ms of VIB, compute the RMS envelope (5 ms windows), and fit an exponential decay → **τ**; the dominant frequency gives **f0**. Send one transient frame (type 2) per switch, then a summary (mean τ, ratio vs baseline). |
| Inference, Phase 1 | Done on the **laptop** (backend), using the streamed features. The firmware only streams. |
| Inference, Phase 2 | Edge Impulse model on-device (MFE on MIC + VIB features → small 1D CNN, int8, 1 s window, output every 0.5 s). Probabilities are added to each frame. |
| Output | STREAM mode (type 1/2/3 frames) or TELEMETRY mode (Section 6.6). |

### 6.5 Void Risk Index (VRI) and alert logic

**Baseline (on Calibrate, packed soil):**
- Record 10–30 s of steady flow on the rig (production: a commissioning period).
- Store the MIC per-band mean and standard deviation of log energy, and the MIC mean spectrum, drawn as the dashed baseline in the dashboard.
- Run one flow pulse test and store the **VIB median τ and f0** from its switches.

**Components (each normalised to 0–1):**

| Component | Source | Computation | Weight (start) |
|---|---|---|---|
| Classifier | Laptop model (Phase 1) or TinyML (Phase 2) | P(void) + 0.5 · P(leak) | 0.4 |
| Baseline deviation | MIC | max band z-score, mapped 0σ → 0 and 5σ → 1 | 0.3 |
| Ring-time ratio | VIB (flow pulse test) | τ_now / τ_baseline, mapped 1× → 0 and 3× → 1 | 0.3 (redistributed to the other two until a pulse test has run) |

`VRI = 100 × Σ(weight × component)`. Frames flagged `noise` (MIC loud but VIB quiet, handling thumps) are excluded from the window.

**State machine (with hysteresis):**

| State | Enter when | Exit when |
|---|---|---|
| GREEN | default | — |
| YELLOW (investigate) | VRI ≥ 40 for N consecutive windows | VRI < 30 for N windows |
| RED (critical) | VRI ≥ 70 for N consecutive windows | Manual acknowledge + VRI < 50 |

- **Demo:** N = 3 windows of 1 s each, with the "DEMO TIME" badge shown.
- **Production:** N = 3 readings spread over 48–72 h, plus an immediate re-check after heavy rain.

Entering RED creates an **alert**, which creates a **work order** (Section 6.8, Alerts view).

### 6.6 Data contracts

**Binary stream frame (little-endian), ESP32 → backend:**

| Offset | Field | Type | Notes |
|---|---|---|---|
| 0 | magic | u16 | `0x5354` ("ST") |
| 2 | version | u8 | 1 |
| 3 | type | u8 | 1 = live frame, 2 = VIB transient (one per flow switch), 3 = raw PCM chunk, 4 = status |
| 4 | node_id | u16 | |
| 6 | seq | u32 | detect dropped frames |
| 10 | t_ms | u32 | device uptime |
| 14 | flags | u8 | bit0 wet, bit1 pump_on, bit2 clip_mic, bit3 clip_vib, bit4 tinyml_valid |
| 15 | mode | u8 | 0 stream, 1 pulse test running |
| 16 | reserved | u16 | |
| 18 | payload | — | type 1: mic_bins[256] u8 · vib_wave[128] i8 · features[14] f32 · tinyml_probs[4] u8 (= 444 B) |

- **Type 2 (transient):** switch direction u8, τ_ms f32, f0_hz f32, peak f32, envelope[60] u8 (80 ms).
- Type 1 is ~462 B per frame; at 15 fps that is **~7 KB/s**, trivial on Wi-Fi.
- Type 3 (optional raw PCM for a Listen button): mic 16 kHz × 16-bit = 32 KB/s, also fine on Wi-Fi.
- Over serial, frames are SLIP- or COBS-framed at ≥ 921600 baud.

**Commands, backend → ESP32 (JSON text over the same WebSocket, or newline-terminated over serial):**
```json
{"cmd": "pump", "on": false}
{"cmd": "pulse", "cycles": 4, "half_period_ms": 1200}
{"cmd": "tinyml", "enabled": true}
{"cmd": "stream", "raw_pcm": true}
```

**Telemetry status, production-style (rig sends it as JSON; production packs it into the 11-byte LoRaWAN payload shown in the dashboard's concept view):**
```json
{
  "node_id": "SDP-ELM-DRAIN-042",
  "ts": 1792051200,
  "state": "RED",
  "void_risk_index": 82,
  "anomaly_confidence": 0.81,
  "ring_time_ratio": 2.7,
  "water_contact": false,
  "band_energy_db": [-42, -38, -51, -60, -71],
  "battery_pct": 96,
  "fw": "0.3.1"
}
```
Location is **not** sent per packet. Each node's lat/lon and asset ID live in the backend node registry.

### 6.7 Backend (FastAPI + Uvicorn, Python)

| Endpoint | Purpose |
|---|---|
| `WS /ws/ingest` | ESP32 pushes binary frames; server pushes commands back |
| `WS /ws/live` | Dashboards subscribe: raw frames plus a computed state JSON (VRI, state, components) |
| `GET /api/nodes` · `POST /api/nodes` | Node registry (id, name, lat/lon, asset, mount height, real or simulated) |
| `POST /api/calibrate` | `{node_id, seconds}` → stores the MIC baseline, then runs a pulse test for the VIB baseline τ |
| `POST /api/command` | Relays pump, pulse, tinyml and stream commands to the node |
| `POST /api/record` | `{label, seconds, meta}` → `mic.wav` + `vib.wav` + JSON sidecar |
| `POST /api/ml/train` | Phase 1: retrain the scikit-learn model on the recorded clips (leave-one-packing-out) and report accuracy and the confusion matrix |
| `GET /api/export/edge-impulse` | Zip of labelled WAVs in Edge Impulse upload layout (Phase 2) |
| `GET /api/alerts` · `PATCH /api/alerts/{id}` | Alert lifecycle |
| `GET/POST /api/workorders` | Work orders with inspection outcome |
| `POST /api/reports` | (stretch) S1 surface report → S2 escalation |
| `POST /api/sessions/start` · `/stop` | Record a session for Replay (frames + state) |

- **Serial bridge:** `bridge_serial.py --port /dev/ttyUSB0` reads the same frames over USB and forwards them to `/ws/ingest`. The dashboard does not care which transport is used.
- **Synthetic node:** `fake_node.py` generates realistic frames: packed vs void spectra, and flow-switch transients with short vs long ring-down. **The dashboard team can then build from day 1 without waiting for hardware.** The frontend already has an equivalent in-browser simulator, `dashboard/src/data/rig-sim.ts`. Mirror its behaviour.
- **Phase 1 ML:** `ml/features.py` (shared feature extraction from the WAV pairs), `ml/train.py` (scikit-learn Random Forest, leave-one-packing-out evaluation), and `ml/serve.py` (loaded by the backend; scores each 1 s window).
- **Storage:** SQLite tables `nodes`, `baselines`, `alerts`, `work_orders`, `recordings`, `reports`, `sessions`. WAV files live on disk.
- **Recording file naming:** `{label}.v{void_ml}.{flow|noflow|pulse}.p{packing}.{seq}.{mic|vib}.wav` (e.g. `void.v250.pulse.p2.0007.vib.wav`).

### 6.8 Dashboard (React + shadcn/ui)

**Stack:** Vite + React + TypeScript + Tailwind CSS v4 + **shadcn/ui** (radix base). Every shadcn component is installed: Sidebar, Card, Button/ButtonGroup, Progress, Tabs, Sheet, Drawer, Command, Breadcrumb, Kbd, Chart and more. One design system keeps every button, badge, progress bar and panel consistent across views and in light/dark mode. The code lives in `dashboard/`.

**Rendering choices:**
- **Canvas 2D** for the three live, high-rate views: MIC waterfall, MIC spectrum and VIB scope (shared components in `dashboard/src/components/viz/rig-viz.tsx`). The canvases subscribe to frames directly, because re-rendering React at 15 fps would stutter.
- **shadcn Chart** (Recharts) for slower charts: VRI history, ring-down envelope, battery breakdown, dose-response.
- **Leaflet + OpenStreetMap** tiles, so no API key is needed.
- A perceptual colour map (inferno or viridis) for the spectrogram.
- **Why not Streamlit:** it re-runs the script on every update and cannot render a smooth 10–15 fps spectrogram.

**Three clearly separated areas:**

| Area | Data source | Badge |
|---|---|---|
| **Prototype (live)** | The rig's stream. Today this is the in-browser simulator `src/data/rig-sim.ts`; later it is the WebSocket `/ws/live` from the backend | LIVE, or REPLAY |
| **Operations** | Map, alerts, work orders, risk layers (`src/data/seed.ts`) | Seed data |
| **Production concept** | `src/data/network-sim.ts`: 10 manholes × 2 sensors, 2 gateways, LoRaWAN uplinks, battery model | CONCEPT · SIMULATED · NOT BUILT |

#### Prototype console (the hero screen for the demo)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ TEST BENCH RIG-01  ● LIVE (Wi-Fi)  15 fps  seq ok        State: RED   VRI 82        │
│ [Calibrate baseline] [Run flow pulse test ×4] [Pump ON/OFF] [Record & label ▼] [Wet]│
│ ▓▓▓▓▓▓▓▓▓▓░░░░ Flow pulse test 3/4 …                     DEMO TIME (1 s = 1 day)   │
├───────────────────────────────────────────────┬─────────────────────────────────────┤
│ MICROPHONE — frequency map (FFT)               │ VIBRATION — pipe rumble              │
│ 8 kHz ┤                                        │ ~~~~/\/\/\~~~~ rolling waveform      │
│       ┤   ▒▓██▓▒  <- resonance lights up       │      ^ flow OFF   ^ flow ON          │
│ 0 Hz  ┼───────────── time ──────────►          │ Ring-down: baseline τ 8 ms (grey)    │
│ Live spectrum vs dashed baseline;              │            now τ 22 ms  -> 2.7×      │
│ bands: flow rumble | resonance | leak hiss     │ RMS 0.31 · crest 3.9 · f0 130 Hz     │
├───────────────────────────────────────────────┼─────────────────────────────────────┤
│ ML INSIGHTS                                    │ VOID RISK INDEX        82  RED       │
│ Phase 1 laptop (RF)   void ███████▊ 0.81       │ classifier 0.81 · deviation 0.62 ·   │
│ Phase 2 TinyML (ESP32) void ███████  0.74      │ ring-time 0.85                       │
│ Drives VRI: (•) Laptop  ( ) TinyML             │ [VRI history, last 5 min]            │
├───────────────────────────────────────────────┴─────────────────────────────────────┤
│ Event log: Flow OFF – τ 22.4 ms · Pulse test done 2.95× baseline · RED raised …     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Console behaviour:**
- **Calibrate:** shows a progress bar, then draws the dashed baseline spectrum and records the baseline τ.
- **Run flow pulse test ×N:** switches the pump on and off N times with a progress bar. Each switch adds a ring-down curve. The result card shows mean τ and the ratio vs baseline. **This is the "dull thud vs hollow drum" moment for judges.**
- **Record & label:** pick a label and duration (and void ml, packing #). The backend saves `mic.wav` + `vib.wav`. *The dashboard is also the data-collection tool for training.*
- **ML insights:** both models' probabilities are shown live, with a switch for which one drives the VRI. Once Phase 2 is deployed, this shows whether the on-device model agrees with the laptop model.
- **Status:** clipping, dropped frames (seq gaps) and the transport (Wi-Fi/serial) are always visible.

#### Production concept: LoRaWAN network (simulated, not built)

```
 10 manholes × (VIB + MIC)             2 gateways                   Network server         Sentinel
 MH-01…MH-03  Elmina West ───┐
 MH-04…MH-07  Central ───────┼─LoRa─► GW-1 Clubhouse roof (fibre) ─┐
 MH-08…MH-10  Retention Lake ┘ AS923  GW-2 Sales gallery (4G) ─────┴─► LoRaWAN NS ─► API ─► Dashboard
              SF7–SF10 · 11-byte payload · hourly + on state change     (e.g. ChirpStack / TTN)
```

The concept view shows:
- the topology above, plus a map of the 10 manholes and 2 gateways with link quality;
- a live uplink log: RSSI, SNR, spreading factor, time-on-air, VRI and wet flag;
- the 11-byte payload layout;
- a **battery projection calculator** (wake interval, capture length, storm-mode share, spreading factor) with an energy breakdown, always labelled *"Concept estimate — needs a measured current profile."*

#### Township Map
- Leaflet map centred on City of Elmina (around 3.1945, 101.5032), showing a drainage line with **1 real node plus ~10 simulated nodes**.
- Markers are coloured GREEN / YELLOW / RED. A red marker pulses.
- Clicking a node opens a side panel: state, VRI trend, last spectrum snapshot, asset info and mount height.
- Wet nodes show a blue ring, which previews S4.

#### Alerts & Work Orders
- **Lifecycle:** `New → Acknowledged → Dispatched → Inspected (CCTV/GPR result: void confirmed / not found) → Repaired → Closed`.
- Each alert stores an **evidence bundle**: spectrum snapshot, ring-down overlay, VRI components, time series, and linked surface reports (S2).
- The inspection outcome becomes a **ground-truth label** that feeds S3 model training.

#### Risk Layers mock (stretch)
- Toggleable layers (Section 8.3) built from synthetic or public sample data on an H3 hex grid.
- Shows the S3 vision without claiming it is built.

#### Replay mode
- Recorded sessions are exported as static files (frames + state).
- The hosted build (GitHub Pages, Netlify or Vercel) plays them back with the same UI and a "REPLAY" badge.
- **This is the prototype link judges can open.**

#### Three layout directions (frontend prototypes on seed data)

All three use the same shadcn/ui components, simulator and seed data, so they differ only in structure. Run them with `cd dashboard && pnpm dev`, then open http://localhost:5173 and choose one from the launcher.

| | **A — Control Room** (`/#/a`) | **B — Command Hierarchy** (`/#/b`) | **C — Map Canvas** (`/#/c`) |
|---|---|---|---|
| Idea | Everything at once, like a NOC/SCADA screen | Action-first and strictly hierarchical, like RTS game menus | The township map is the canvas; panels float over it |
| Navigation | Sidebar: Prototype · Production Concept · Operations | Drill-down with a breadcrumb: Township → Site → Manhole → Sensor → act | Mode tabs: Prototype · Network · Risk · Alerts; Cmd+K palette |
| Actions | Compact toolbar | Command panel of verbs per level, hotkeys, quantity steppers, an **action queue with progress bars** | Bottom dock for the live rig; Sheets for details |
| Best for | Engineers monitoring a big screen | Operators who need to know "what can I do here?"; also a clear demo story | Judges and managers; spatial storytelling |

**Hierarchy used in direction B** (to reach an action you must pass through its parents, the way you select the barracks, then the unit type, then the number to train):

```
Township: City of Elmina
├── Prototype Lab ─ Test Bench RIG-01 (LIVE)
│     ├── Vibration sensor ─ [Run flow pulse test ×N] [Calibrate τ] [Self-test]
│     └── Microphone ────── [Record & label ×N] [Toggle TinyML] [Stream raw]
├── Field Zones (concept) ─ Elmina West | Elmina Central | Retention Lake
│     └── Manhole MH-xx ─ [Dispatch crew] [Acknowledge alert] [Raise sampling]
│           └── Vibration | Microphone (simulated)
├── Network (concept) ─ LoRaWAN topology, uplinks, battery
├── Risk Intel ─ S3 layers
└── Missions ─ alerts → work-order steps
```

**Choosing one:** review all three. Keep the winner's structure and borrow strong pieces from the others (e.g. B's action queue inside A's layout). Then build only the chosen direction against the real backend.

### 6.9 ML training plan (Phase 1 laptop → Phase 2 TinyML)

| Step | Detail |
|---|---|
| Data | ≥ 10 min per class per packing (≥ 600 × 1 s windows/class), across **3 packings**. Every clip has a mic WAV and a vib WAV. |
| Classes | `packed` (steady flow and pulse tests), `void` (100/250/500 ml), `leak`, `noise` (speaker rumble, table thumps, handling) |
| Split | **Leave-one-packing-out:** train on packings 1–2, test on packing 3. No random window split, because adjacent windows leak information. |
| **Phase 1: laptop** | Features from both sensors (14 features, Section 6.4) → **scikit-learn Random Forest** (then try gradient boosting). Trains in seconds, so iterate fast. Feature importances show which sensor carries the signal. Runs live in the backend and streams probabilities to the dashboard. |
| **Phase 2: TinyML on ESP32** | Edge Impulse: MFE on MIC + VIB features → small 1D CNN, int8 quantised. Check RAM and latency on the ESP32-S3 in the EON tuner. Deploy as an Arduino library. |
| Compare | The dashboard shows both models live on the same stream. Report held-out accuracy and the confusion matrix for each, and the agreement rate between them. |
| Report | Confusion matrices on the held-out packing, plus the dose-response plot below |

**Key evidence plot for the deck:** **ring-time ratio and VRI vs void volume (0 / 100 / 250 / 500 ml)**, with error bars across pulse-test switches and packings. A rising curve shows the effect is physical and graded, not a single scripted switch.

### 6.10 Prototype test plan

| Test | Pass criterion |
|---|---|
| T1 Baseline stability | 20 flow switches (5 pulse tests) on a packed pipe: VIB τ coefficient of variation < 10% |
| T2 Dose-response | Median ring-time ratio rises steadily with void volume |
| T3 Detection | Void (≥ 250 ml) reaches RED in ≥ 9 of 10 trials; packed reaches RED in 0 of 10 |
| T4 Noise rejection | Speaker traffic rumble and table thumps on a packed pipe never reach RED |
| T5 Held-out accuracy | ≥ 90% on the unseen packing (report honestly if lower) |
| T6 Latency and fps | < 500 ms end to end, ≥ 10 fps for 10 min |
| T7 Fallback | Pull Wi-Fi mid-demo → serial bridge resumes within 5 s |
| T8 Replay | Hosted link plays a full session offline |
| T9 Wet/dry (if built) | Flag flips correctly in ≥ 9 of 10 water-rise trials |

### 6.11 What the prototype does not prove (be upfront with judges)

- PVC in sand is not concrete in compacted laterite or clay. Absolute thresholds will differ in the field, which is why each node calibrates its own baseline and why the pilot exists.
- The rig's "traffic" is a speaker. Real 30-tonne axle loads couple into the ground very differently.
- Detection range along a pipe (how many metres one node covers) is unknown and is a key pilot measurement.

---

## 7. Production design (not built for the hackathon)

| Aspect | Design intent |
|---|---|
| MCU / radio | Move from ESP32 (Wi-Fi, power-hungry) to a low-power LoRa SoC (e.g. STM32WL-based module) for multi-year battery life |
| Network | LoRaWAN **AS923** (Malaysia); downlink for config, sampling-rate changes and on-demand captures. Shown as a simulated concept in the dashboard (10 manholes, 2 gateways) |
| Duty cycle | Sleep; wake every 15–60 min for a 3–5 s capture of both sensors; wake immediately on a VIB threshold interrupt (natural flow surges act as the excitation) or a storm-mode downlink |
| Excitation in the field | Stormwater flow cannot be switched like the rig's pump. Use **natural flow changes** (rain onset, surges), which the VIB threshold interrupt catches, and optionally a small tapper for dry-weather checks |
| Power | Li-SOCl2 primary cell. The **3–5 year life claim needs a power budget calculation**; treat it as unverified |
| Mounting | Dry mount on the pipe crown or manhole collar; stainless bracket; antenna under the cover vent slot or a non-metallic cover insert |
| Enclosure | IP68; resistant to H2S and sulfuric-acid corrosion; potted electronics |
| Safety | Sewer manholes may contain methane or H2S, so assess intrinsic-safety certification (IECEx/ATEX) before deploying in sewers. Stormwater is lower risk but should still be assessed |
| Install | Confined-space entry procedures; or install from the surface on the collar ring to avoid entry |
| Placement | Prioritise by S3 risk score (Section 8.3), not randomly |
| Integration | REST/webhook into SDP FM's work-order system; GIS export (GeoJSON) for councils |

**Pilot plan:**
- **Month 1–2:** 10 nodes in one SDP township, placed by S3 static risk. Include known-good and known-problem segments. Commission baselines. CCTV-survey the same segments for ground truth.
- **Month 3:** controlled validation, using flushing tests and comparison with GPR on flagged spots.
- **Month 4–6:** live alerts into FM workflow. Measure precision, lead time and cost avoided.

---

## 8. Complementary systems (S1 to S4)

Sentinel nodes see the subsurface **at points**. The complementary systems add **surface evidence** (S1, S2), **area-wide context and prediction** (S3) and **water behaviour** (S4). Together they turn a sensor into a township subsurface risk platform.

> Note: S1 is the new public reporting system. S2 was "System 1", S3 was "System 2", S4 was "System 5". Water-quality monitoring (old System 3) is dropped because it needs sensors beyond the two-sensor design. Flood warning (old System 4) is folded into S3 (rainfall layers) and S4 (surcharge).

```
 Residents ──► S1 Public Ground Report Portal ──┐
 Dashcam / drone / InSAR ───────────────────────┤ surface evidence
                                                ▼
 Sentinel nodes ── VRI ───────────────► S2 Surface Risk Correlation ──► Incident ──► Work order ──► Inspection
      │                                         ▲                                                   outcome
      │ wet/dry flags                           │ zone risk context                                    │ labels
      ▼                                         │                                                      ▼
 S4 Stormwater Discharge Coordinator ─surcharge─► S3 Predictive Risk Map & Maintenance Scheduler ◄─ retrain
      ▲                                         │   sensor placement · pre-storm lists · crew schedule
      └──── rainfall forecast (MET / JPS) ──────┘
```

### 8.1 S1: Public Ground Report Portal

**Purpose:** turn residents and commuters into thousands of surface observers. It is the eyes-on-the-ground input to S2.

**Channels:**
- A PWA web form with no install, opened from **QR stickers on sensor-equipped manhole covers, lamp posts and bus stops**.
- A WhatsApp bot.
- Integration with SDP's township app, if one exists.

**Report flow (< 60 s):** photo → auto GPS (pin can be dragged) → category → optional note or voice → submit → reference number → status updates back to the reporter.

**Categories and sinkhole relevance:**

| Category | Why it matters | Relevance |
|---|---|---|
| Road dip / sagging / depression | Void below has started to consume the asphalt's support | High |
| Pothole that keeps returning after repair | Classic sign of subgrade loss beneath | High |
| Water seeping or bubbling from the ground in dry weather | Active pipe leak | High |
| Ground sounds hollow or feels soft or bouncy | Void near the surface | High |
| Muddy, sandy water in a drain in dry weather | Soil fines are being washed out right now | High |
| Retaining wall bulging, cracked, or weep holes blocked | Water pressure build-up behind the wall | High |
| Manhole cover rattling, sunk, or with a gap around it | Collar settlement, often the first failure point | Medium-High |
| Crack in road or pavement | Weak alone, strong in clusters | Medium |
| Kerb/gutter separating from road | Runoff entry point that scours the subgrade | Medium |
| Drain overflowing or blocked | Surcharge; feeds S4 | Medium |
| **"The ground has opened"** | **Emergency**: shows 999 / Bomba and a do-not-approach message at once. Not a ticket. | Emergency |

**Rules:**
- **Clustering:** reports within ~25 m and 14 days in related categories merge into one incident with a report count. More reports mean more confidence.
- **Trust:** WhatsApp number or OTP verification, rate limits, photo moderation, and EXIF stripped except GPS.
- **Languages:** BM / EN / 中文 / தமிழ்.
- **Routing:** council-owned assets are forwarded to the relevant local authority's complaint channel (e.g. SISPAA) with a link back.
- **Loop closure:** the reporter is notified when the report is inspected and when it is fixed, which builds trust and repeat reporting.
- **Optional incentive:** points redeemable at SDP malls and township merchants, **only for verified reports**. This supports Commercial & Value Multiplication without rewarding spam.

**Metrics:** time to acknowledge, % reports verified, reports per 1,000 residents, reporter return rate.

### 8.2 S2: Surface Risk Correlation Engine

**Purpose:** join subsurface signals (Sentinel) with surface evidence (S1, dashcam computer vision, drone, InSAR) into one prioritised incident.

**Core principle: evidence only adds; absence of evidence never subtracts.**
- **Clean asphalt does not cancel a sensor alert.** Asphalt bridges voids until it fails suddenly. That is exactly why sinkholes surprise people.
- **A quiet sensor does not cancel a resident report.** A node only "hears" a limited stretch of pipe.

**Inputs:**
- S1 incidents
- Dashcam computer-vision detections (cracks, depressions, potholes) from SDP maintenance vehicles and refuse trucks on their normal routes
- Drone surveys
- InSAR settlement (from S3 layer F3)
- Sentinel node states
- The pipe network GIS

**Linking:**
- **Spatial:** snap each surface observation to the nearest pipe segment or manhole within ~15 m of the pipe centreline. Then propagate along the network, since water and soil migrate along pipe bedding, so a void can surface downstream of the defect.
- **Temporal:** a 30-day window, with recurrence counts.

**Escalation matrix:**

| Sentinel node | Surface evidence | S3 zone risk | Priority | Action |
|---|---|---|---|---|
| RED | Yes | any | **P1 Critical** | Inspect < 24 h; traffic management (cone off the lane, restrict heavy vehicles) |
| RED | None | any | **P2 High** | Inspect < 72 h. **Never downgraded** |
| YELLOW | Yes | any | **P2 High** | Inspect < 72 h |
| YELLOW | None | any | P3 Watch | Increase sampling rate; re-check on the next flow surge |
| No node in range | Yes (high relevance) | High | **P2 High** | Inspect, and **deploy a temporary node** |
| No node in range | Yes | Low / Med | P3 | Standard maintenance ticket |
| GREEN (in range) | Yes (high relevance) | any | P3 + coverage flag | Inspect; check whether the node actually covers that segment |

**Output:** one incident with an evidence bundle (spectrogram, ring-down, photos, map, risk-layer context), turned into a work order. Inspection outcomes calibrate the matrix over time.

### 8.3 S3: Predictive Risk Map & Maintenance Scheduler

**Purpose:** move from reactive to **proactive**. Sinkholes do not occur randomly. Like fish gathering under shade and structure, they "seek out" a specific mix of **geology, hydrology, structural weakness and dynamic load**. S3 maps those attractors as stacked layers, like Google Maps, scores every cell, and tells SDP where to put sensors, what to inspect before a storm, and how much maintenance work is coming.

#### 8.3.1 Layer catalogue

Type: **S** = static (changes yearly or never), **SD** = slow-dynamic (weekly to monthly), **D** = dynamic (minutes to days).
Role: **L** = likelihood (makes failure more likely), **C** = consequence (makes failure worse), **E** = evidence (failure may be starting).

**Group 0: Base**

| # | Layer | Source (owner) | Type | Role / use |
|---|---|---|---|---|
| 0.1 | Basemap, roads, buildings | OpenStreetMap / Mapbox | S | Context |
| 0.2 | Township phases and completion year | SDP master plan | S | L: phase age is a proxy for pipe age |

**Group A: Geology and ground (what is under the dirt)**

| # | Layer | Source (owner) | Type | Role / use |
|---|---|---|---|---|
| A1 | Karst limestone extent (e.g. Kuala Lumpur Limestone) | JMG (Dept. of Mineral & Geoscience) geological maps | S | L: dissolution cavities |
| A2 | Ex-tin-mining land and former mining ponds | JMG mining records; historical JUPEM topo maps; historical satellite and aerial imagery | S | L: loose sand and slimes prone to piping erosion |
| A3 | Soil type: alluvium, peat, residual soil | Dept. of Agriculture soil maps; JMG | S | L |
| A4 | Site-investigation borehole logs (SPT N-values, profiles, cavities found) | **SDP's own SI reports** from every phase | S | L: high-value data SDP already owns |
| A5 | Groundwater level and fluctuation | JMG / NAHRIM monitoring wells; SDP construction piezometers | SD | L: sudden drawdown removes soil support |
| A6 | Sinkhole and subsidence history | JMG geohazard records; council records; news archive | S (append) | L / E |

**Group B: Hydrology and weather (where the water comes from)**

| # | Layer | Source (owner) | Type | Role / use |
|---|---|---|---|---|
| B1 | Rainfall forecast (1–7 day) and weather warnings | MET Malaysia via data.gov.my weather API | D | Trigger: pre-storm lists |
| B2 | Radar nowcast | MET Malaysia radar | D | Trigger: storm-mode node sampling |
| B3 | Observed rainfall and river/drain levels | JPS Public InfoBanjir telemetry | D | Trigger, post-storm sweep |
| B4 | Rainfall intensity history (IDF) | JPS / MSMA (Urban Stormwater Management Manual) | S | L: design vs actual load |
| B5 | Flood-prone areas and flood history | JPS flood maps; S4 history | SD | L |
| B6 | Antecedent rainfall index (7/14/30-day totals) | Derived from B3 | D | Trigger: saturated soil erodes faster |
| B7 | Surcharge duration per manhole | **S4 / Sentinel wet flags** | D | Trigger: surcharged pipes push water out through joints |

**Group C: Topography and water traps (where the water wants to go)**

| # | Layer | Source (owner) | Type | Role / use |
|---|---|---|---|---|
| C1 | Elevation (DEM) and slope | SDP LiDAR/drone surveys; JUPEM; Copernicus DEM (30 m) | S | L |
| C2 | **Cut-and-fill depth** (pre-development survey minus finished levels) | SDP earthwork records | S | L: deep fill is prone to settlement and piping. *A key derived layer.* |
| C3 | Paleo-channels (buried historical streams) | Historical JUPEM topo maps; pre-development imagery; flow accumulation on pre-development DEM | S | L: groundwater still follows old stream paths |
| C4 | Hill-to-flat transition zones (slope breaks) | Derived from C1 | S | L: high-velocity flow and turbulence dislodge seals |
| C5 | Retaining walls and slopes, incl. weep-hole condition | SDP as-builts; JKR slope inventory; inspections | S + inspection | L: hydrostatic build-up washes out backfill |
| C6 | Road sag points (ponding) | Derived from C1 + road network | S | L: curb and gutter infiltration |

**Group D: Infrastructure (where pipes fail)**

| # | Layer | Source (owner) | Type | Role / use |
|---|---|---|---|---|
| D1 | Stormwater network: pipes, culverts, manholes; material, diameter, depth, install year | SDP as-built GIS; local authority (PBT) records | S | L, and the asset backbone for everything |
| D2 | Sewer network and force mains | Indah Water Konsortium (IWK) | S | L: H2S crown corrosion; pressurised leaks |
| D3 | Potable water mains and burst/leak history | Air Selangor | S + events | L: pressurised leaks are a major washout source |
| D4 | Other utility trenches (power, telco, gas) | Utility owners | S | L: backfilled trenches are preferential water paths |
| D5 | Rigid-to-flexible transitions (pipe-to-manhole collars, culvert joints) | Derived from D1 | S | L: the highest mechanical failure points |
| D6 | Maintenance and repair history | SDP FM work-order system | Events | L: recurring repairs mean a chronic problem |
| D7 | CCTV pipe-condition grades | SDP / council inspection reports | Events | L / E |
| D8 | Pavement condition, recurring potholes | Road maintenance records; S1 / S2 | Events | E |

**Group E: Load and human triggers (the final straw)**

| # | Layer | Source (owner) | Type | Role / use |
|---|---|---|---|---|
| E1 | Traffic volume and heavy-vehicle share | Highway Planning Unit, *Road Traffic Volume Malaysia*; council counts | S (annual) | Trigger: cyclic heavy-axle loading |
| E2 | Live congestion | Google / TomTom / HERE traffic APIs (paid) | D | Proxy only; does not measure axle load |
| E3 | Bus routes and frequency | Prasarana GTFS via data.gov.my | S / D | Trigger: repeated heavy axles |
| E4 | Refuse-truck routes and schedules | KDEB Waste Management / SWCorp / council | S (weekly) | Trigger: heavy, repetitive, predictable |
| E5 | Construction sites, piling, basement excavation, dewatering | Council development approvals; **SDP's own active phases**; contractor schedules | SD | Trigger: vibration densifies soil, so voids migrate upward |
| E6 | Rail tunnelling and works (MRT/LRT) | MRT Corp alignments and progress | SD | Trigger |
| E7 | Concrete-mixer and quarry haul routes | Batching plants / contractors | S | Trigger: 30-tonne loads |

**Group F: Surface and deformation evidence (is it starting?)**

| # | Layer | Source (owner) | Type | Role / use |
|---|---|---|---|---|
| F1 | Public reports | S1 | D | E |
| F2 | CV-detected cracks and depressions | S2 dashcam / drone | D | E |
| F3 | InSAR ground settlement (mm/year) | ESA Sentinel-1 satellite via ASF HyP3 (free) or commercial providers | SD (~12-day revisit) | E: millimetre-scale settlement trends |
| F4 | Drone/LiDAR change detection | SDP surveys | SD | E |

**Group G: Live sensing**

| # | Layer | Source | Type | Role / use |
|---|---|---|---|---|
| G1 | Sentinel node state and VRI | Sentinel | D | E (strongest) |
| G2 | Wet/dry flags | Sentinel / S4 | D | Trigger |

**Group H: Consequence (who and what gets hurt)**

| # | Layer | Source (owner) | Type | Role / use |
|---|---|---|---|---|
| H1 | Road class and emergency routes | JKR / council / OSM | S | C |
| H2 | Footfall and crowd density | SDP mall footfall counters; events calendar; Google Popular Times | D | C: people exposed |
| H3 | Critical facilities: schools, clinics, hospitals | OSM / government directories | S | C |
| H4 | Building and utility proximity | OSM / SDP GIS | S | C |

> Heavy vehicles, construction and tunnels make a collapse **more likely** (Group E). Pedestrians and passengers make a collapse **more harmful** (Group H). Keeping these separate prevents a busy pedestrian plaza from being mistaken for a high-load road.

#### 8.3.2 Scoring model

- **Grid:** H3 hexagons at resolution 11 (~25 m edge), plus a per-pipe-segment score.

```
Susceptibility  S(cell)    = weighted sum of normalised static layers (A, C, D)          0..1
Trigger         T(cell, t) = f(B1, B2, B6, B7, A5 change, E1–E7 intensity)            0.5..1.5 multiplier
Evidence        E(cell, t) = boost from F1–F4, G1 (decays over time)                    0..1
Likelihood      L          = min(1, S × T + E)
Consequence     C(cell)    = f(H1–H4)                                                  0..1
Risk            R          = L × C  → 5 bands (Very low … Very high)
```

- **Phase 1:** expert-weighted layers using AHP (Analytic Hierarchy Process), the standard method in geohazard susceptibility mapping, with weights set alongside SDP engineers.
- **Phase 2:** a gradient-boosted model trained on **inspection outcomes and incidents** (labels from the work-order loop). The expert weights are kept as a fallback and as a sanity check.

#### 8.3.3 Proactive outputs

| Output | What it does |
|---|---|
| **Sensor placement planner** | Ranks manholes by S × C. Recommends "the next 10 nodes go here" and shows coverage gaps. |
| **Pre-storm watch** | When B1/B2 forecast heavy rain over high-S cells: generate a pre-storm inspection list, check that drains are clear, and send a downlink putting those nodes into storm-mode sampling. |
| **Post-storm sweep** | After rainfall above threshold (B3): a ranked inspection route through the cells most likely to have been damaged. |
| **Maintenance demand forecast** | Expected inspections and repairs per week by zone, from forecast rainfall × risk, for crew and budget planning. |
| **Construction watch** | A new permit or piling work near a high-S cell notifies the contractor and FM, and triggers temporary monitoring. |
| **Crew scheduler** | Clusters nearby jobs into routes, and schedules heavy-traffic roads into low-traffic windows (nights). |

**Hackathon scope:** a mock Risk Layers view (Section 6.8, View D) with 5–6 layers from synthetic or public sample data.

### 8.4 S4: Stormwater Discharge Coordinator

**Purpose:** use the network of Sentinel **wet/dry flags** to see how stormwater actually behaves during storms. Then coordinate retention storage, release water before a storm and keep it during dry spells, and feed surcharge risk back into S3.

**Sensing model:**
- Each node gives a single **boolean at its mount height**. It is not a level gauge.
- Mounting at the pipe crown makes `wet = true` mean "this pipe is running full or surcharged".
- Many nodes across a network give a **coarse surcharge map**. Nodes at different heights in the same manhole, or a second probe, would add more levels later.

**Functions:**

| Function | Logic |
|---|---|
| Live surcharge map | Which manholes are wet now, and for how long |
| **Blockage localisation** | Upstream node wet + downstream node dry implies a constriction or blockage between them, so issue a clearing work order (this also reduces stagnant-water dengue risk) |
| **Surcharge → erosion feedback** | Surcharge duration per segment becomes S3 layer B7. Pressurised flow in a gravity pipe forces water out of the joints and washes out the bedding |
| Pre-storm drawdown (advisory) | When B1 forecasts heavy rain, recommend releasing retention pond or tank storage to create buffer capacity |
| Dry-spell retention (advisory) | Hold storage for township landscape irrigation, reducing treated-water use |
| Automation (later) | Only where controllable gates or smart tanks exist. It starts as **advisory**, because a wrong release decision has flood consequences |

**Limitations:**
- Binary at one height: no flow rate, no volume.
- Acoustic wet detection is unvalidated (Section 4.4).
- Actuation depends on existing controllable infrastructure.

### 8.5 Scope summary

| System | Hackathon | Pilot | Later |
|---|---|---|---|
| Sentinel node + console | **Build** (rig) | Field nodes | LoRa fleet |
| Map + alerts + work orders | **Build** (simulated nodes) | FM integration | Council sharing |
| S1 Report Portal | Stretch: simple form in dashboard | PWA + WhatsApp | Merchant rewards |
| S2 Correlation | Stretch: escalation matrix on mock reports | Live with S1 | Dashcam CV, InSAR |
| S3 Risk Map | Stretch: mock layers | Static layers + AHP | ML scoring, scheduler |
| S4 Stormwater | Wet/dry flag on console | Surcharge map | Pond/tank coordination |

**Strong stretch demo (~1 day of work):** the node goes RED, a judge submits a mock "road sagging" report at the same spot, and S2 escalates P2 to **P1 Critical** live.

---

## 9. Competitive landscape

**Be precise about this.** Judges may know these products. *The team should verify each claim before the pitch.*

| Existing approach | What it does | Gap Sentinel targets |
|---|---|---|
| Manual acoustic leak detectors (e.g. PQWT-style ground microphones) | A technician listens on site, after a problem is suspected | Not continuous; needs a skilled operator; finds leaks, not soil loss |
| Permanently installed acoustic leak-noise loggers (e.g. Gutermann, Echologics) | Networked loggers on **pressurised water mains** detecting leak noise | Built for pressurised mains and leak noise; not for gravity stormwater culverts or measuring soil support (damping) |
| Fibre-optic distributed acoustic sensing (DAS) | Continuous acoustic sensing along a fibre | Needs fibre along the asset; high cost; suited to pipelines and perimeters |
| Ground-penetrating radar (GPR) surveys | Images voids under roads | Periodic and costly per survey. *Complementary*: Sentinel tells you **where** to run GPR |
| CCTV pipe inspection | Camera crawler inside the pipe | Periodic; sees the pipe, not the soil behind it. *Complementary* for verification |
| InSAR satellite monitoring | mm-scale surface settlement over time | Sees the surface only after movement starts; revisit time in days. *Complementary* as S3 layer F3 |
| Indoor water-leak cables (e.g. CMR-type) | Detect water on floors in buildings | Different problem entirely |

**Differentiation in one line:** continuous, low-cost, per-manhole monitoring of **soil support around gravity drainage pipes** (damping and ring-down, not just leak noise), fused with surface reports and a township risk map, inside the master developer's own maintenance workflow.

---

## 10. Judging criteria mapping

| Criterion (weight) | How this PRD answers it | Evidence to show |
|---|---|---|
| **Impact & Sustainability (25%)** | Prevents sinkhole injuries and deaths, road closures and emergency excavation. Proactive maintenance cuts waste. S4 adds water reuse. | Masjid India case; dose-response plot; cost asymmetry (verified figures) |
| **Innovation & Differentiation (20%)** | Two-sensor damping measurement on drainage (vibration ring-down + mic frequency map); per-node baselines; laptop-to-TinyML pipeline; fusion of subsurface, surface and risk layers | Section 9 table; live ring-down overlay |
| **Feasibility & Deliverability (20%)** | Off-the-shelf parts (~RM200 rig); working live demo; staged pilot plan; honest limitations | Live demo, test results T1–T8, Section 6.11, pilot plan |
| **Strategic Fit & Theme (15%)** | PLANET / Climate Resilience (extreme rainfall), plus PEOPLE / Safety | Map of an SDP township; placement driven by S3 layers |
| **Commercial & Value Multiplication (10%)** | SDP avoids emergency costs and protects asset value; licensing to councils and other developers; S1 merchant rewards bring footfall to SDP malls | Value chain slide |
| **Team, Evidence & Pitch (10%)** | Validated problem; measured, graded evidence; held-out test set | Confusion matrix; dose-response plot; 5-minute video |

**5-minute video outline:**

| Time | Content |
|---|---|
| 0:00–0:45 | Hook: Masjid India. "The road looked fine." |
| 0:45–1:30 | The problem and the solution in one diagram |
| 1:30–3:15 | **Live rig.** Calibrate on packed soil and run a flow pulse test (dull, short ring-down; flat spectrum). Open the access window and remove 250 ml, then run the pulse test again (ring-down jumps; a resonance line appears on the frequency map; VRI climbs; RED). Show the laptop model and TinyML agreeing |
| 3:15–4:00 | Map turns red, work order created; (stretch) resident report escalates it to P1 |
| 4:00–4:40 | Ecosystem: S1–S4 and the risk layers map |
| 4:40–5:00 | Value to SDP and the pilot ask |

---

## 11. Success metrics

**Hackathon (measured on the rig):** see T1–T9 in Section 6.10. Headline numbers for the deck:
- held-out accuracy
- void-detection rate
- false-RED rate under noise
- ring-time ratio at 250 ml

**Pilot (proposed KPIs):**

| KPI | Target (to be set with SDP) |
|---|---|
| Alert precision (RED alerts confirmed by CCTV/GPR) | e.g. ≥ 60% at first, improving with outcome feedback |
| Lead time (alert → visible surface distress, where it occurs) | Weeks, not hours |
| Alert-to-inspection time (P1 / P2) | < 24 h / < 72 h |
| Emergency excavations in the monitored area | Downward trend vs previous years |
| Node uptime | ≥ 95% |
| Coverage | % of high-risk (S3) manholes instrumented |

---

## 12. Risks, limitations and open questions

| Risk | Impact | Mitigation |
|---|---|---|
| Rig results do not transfer to the field | Field thresholds differ | Per-node baselines; pilot with CCTV/GPR ground truth; message it honestly |
| Traffic and ambient noise cause false alerts | Alert fatigue | Active tapping; dual-channel correlation; `noise` class; persistence and hysteresis; capture during low-traffic hours |
| Detection range per node is unknown | Coverage gaps | Measure in pilot; S2 coverage flag; S3 placement |
| Acoustic wet/dry detection is unreliable | Bad S4 data | RM3 contact probe option |
| Venue Wi-Fi fails during the demo | Demo breaks | Serial fallback; phone hotspot; pre-recorded Replay |
| VIB sensor coupling degrades (glue, temperature) | Drift | Rigid bonding; periodic re-baseline; drift monitoring |
| Pump switching noise resets the ESP32 or corrupts readings | Demo breaks | Separate pump supply, flyback diode, shared ground; ignore the first ~20 ms after a switch command |
| Data access for S3 layers (utilities, councils) | Thin risk map | Start with what SDP owns: SI logs, as-builts, earthworks, FM history |
| Production battery-life claims | Credibility | Present as a target pending a power budget |
| Over-claiming novelty | Judge pushback | Section 9 framing |

**Open questions:**
1. **Confirmed:** one acoustic vibration sensor + one microphone. **Still to confirm:** the exact board (this PRD assumes the XIAO ESP32S3 Sense with its onboard mic) and the vibration sensor part. It must have an **analog** output: a piezo module, not an SW-420 switch, and not an MPU6050, whose ~1 kHz rate is too slow.
2. How is the pump switched for the flow pulse test? A MOSFET (DC pump) or a relay module is recommended. Manual switching is acceptable for early data only.
3. Will the team add the RM3 water-contact probe, or rely on acoustic wet detection?
4. Which SDP township should the map show? Default: City of Elmina.
5. Does SDP have an existing township app or FM system to name as the integration target?

---

## 13. Build timeline (15 to 23 Oct)

Streams: **HW** = hardware/firmware, **ML** = data and model, **SW** = backend/dashboard, **PD** = pitch deck/video.

| Day | HW | ML | SW | PD |
|---|---|---|---|---|
| **Thu 15** | Buy parts locally (online shipping may be too slow); build rig | Define labels and recording protocol | **Done:** Vite + shadcn/ui scaffold, simulator and seed data done; 3 layout directions prototyped → **pick one** | Confirm **registration** now; outline the deck |
| **Fri 16** | Capture both sensors (MIC via PDM, VIB via ADC); raw serial dump; wire pump switching | — | Consolidate the chosen layout; scaffold FastAPI; write `fake_node.py` mirroring `rig-sim.ts` | Problem/solution slides |
| **Sat 17** | MIC FFT + VIB waveform framing + WebSocket; pump switching; transient (τ) frames | Test recordings via dashboard; first feature extraction script | Live from the real ESP32; serial bridge; Calibrate / Pulse test / Record | Visuals: thud vs drum diagram |
| **Sun 18** | Rig refinements | **Data collection day:** all scenarios × 3 packings | VRI engine + state machine | Ecosystem slides (S1–S4) |
| **Mon 19** | — | **Phase 1:** train the scikit-learn model on the laptop and serve it live; leave-one-packing-out eval; dose-response plot. Start Edge Impulse (Phase 2) | Map + Alerts/Work Orders + Production concept views | Judging-criteria pass |
| **Tue 20** | **Phase 2:** deploy the int8 TinyML model to the ESP32; stream its probabilities | Confusion matrices for laptop vs TinyML; agreement rate | Laptop-vs-TinyML comparison live; run tests T1–T8; **stretch:** S1 form + S2 escalation | Draft video script |
| **Wed 21** | **Feature freeze** | — | Record Replay sessions; deploy the static site | **Registration closes today** |
| **Thu 22** | Rig on standby | — | Bug fixes only | **Film the demo** (plus backup take); edit; finalise the deck |
| **Fri 23** | — | — | Clean up README; make the repo public | **Submit by 18:00** (hard deadline 23:59) |

**Parallelisation trick:** `fake_node.py` lets SW build the full dashboard before the hardware works. The ML stream should record through the dashboard's Record & Label feature, so the data pipeline gets exercised early.

---

## 14. Glossary

| Term | Meaning |
|---|---|
| Void / cavity | Empty space under or around a pipe after soil is washed away |
| Washout / piping erosion | Water carrying soil particles away through a gap |
| Surcharge | A gravity pipe running completely full, so water is under pressure |
| Ring-down (τ) | How long the pipe keeps vibrating after a flow switch (or a tap); longer means less soil damping |
| Flow pulse test | Switching the rig's water on/off in a fixed pattern so the vibration sensor can measure ring-down repeatably |
| VIB / MIC | The acoustic vibration sensor on the pipe / the microphone in the chamber |
| shadcn/ui | The React component library and design system used for the dashboard |
| Q factor | How sharply something resonates; a hollow pipe has higher Q |
| FFT / spectrum | Splits a sound into its frequencies |
| Spectrogram / waterfall | Spectrum over time; colour shows loudness |
| VRI | Void Risk Index, 0–100, Sentinel's combined score |
| TinyML / Edge ML | Small ML models running on the microcontroller itself |
| LoRaWAN | Long-range, low-power radio network for IoT sensors |
| InSAR | Satellite radar technique that measures millimetre ground movement |
| GPR | Ground-penetrating radar, used to confirm voids |
| AHP | Analytic Hierarchy Process, a structured method for weighting map layers |
| PBT | Pihak Berkuasa Tempatan (local authority / council) |
