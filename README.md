# Subsurface Sentinel

**Acoustic early warning for soil washout and sinkholes in master-planned townships.**
Built for the Sime Darby Property University Hackathon 2026 (theme: PLANET, Climate Resilience).

Leaking pipes wash soil away underground. The road above looks fine until it collapses. Subsurface Sentinel puts two cheap sensors in a drainage manhole:

- a **vibration sensor** on the pipe, which hears how long the pipe "rings" after water flow changes;
- a **microphone**, whose sound is turned into a frequency map (FFT).

Packed soil damps the pipe like a **dull thud**. Once soil has washed away, the pipe rings like a **hollow drum**. An ML model turns these signals into a **Void Risk Index (VRI)** and a GREEN / YELLOW / RED alert, before a sinkhole forms.

---

## What is in this repo

| Path | What it is | Status |
|---|---|---|
| [`dashboard/`](dashboard/) | Web dashboard (React + shadcn/ui) with **three layout prototypes** | Working. Runs on **simulated data**, no hardware needed |
| [`prd.md`](prd.md) | Product requirements: detection physics, prototype spec, firmware/backend design, complementary systems, judging-criteria mapping | Draft v1.1 |
| [`context.md`](context.md) | Original brainstorming notes that led to the idea | Reference |

Not in the repo yet: ESP32 firmware, the Python backend and the ML training scripts. Their designs are in [`prd.md`](prd.md) §6.

---

## Run the dashboard

### 1. Install the prerequisites (once)

| Tool | Version | Check |
|---|---|---|
| [Node.js](https://nodejs.org/) | **22 LTS or newer** (minimum 20.19) | `node --version` |
| [pnpm](https://pnpm.io/) | **10.x** | `pnpm --version` |

If you don't have pnpm, either command works:

```bash
corepack enable          # ships with Node; uses the pnpm version pinned in package.json
# or
npm install -g pnpm
```

### 2. Clone, install, start

```bash
git clone https://github.com/Calvin105/10v-soil-erosion.git
cd 10v-soil-erosion/dashboard
pnpm install
pnpm dev
```

### 3. Open it

Go to **http://localhost:5173**. A launcher page lets you pick one of the three layouts:

| Layout | URL | Idea |
|---|---|---|
| **A: Control Room** | http://localhost:5173/#/a | Dense operations console. Every live signal on one screen, with sidebar navigation |
| **B: Command Hierarchy** | http://localhost:5173/#/b | Action-first and hierarchical, like a strategy game: Township → Site → Manhole → Sensor → act. Hotkeys, quantity steppers and an action queue with progress bars |
| **C: Map Canvas** | http://localhost:5173/#/c | The township map is the screen. Modes for Prototype / Network / Risk / Alerts float on top; **Ctrl/Cmd+K** opens search |

Toggle dark mode with the moon/sun button in the top bar, or press **`d`**. In layout B, `d` means *Dispatch crew* on the bench and manhole levels, so use the button there.

Stop the server with **Ctrl+C** in the terminal.

---

## Try the 60-second demo

The prototype rig is simulated in the browser, so every button really changes the signals. In any layout:

1. Set the **demo / simulator control** ("what is on the bench") to **Packed soil**.
2. Click **Calibrate baseline** and wait for the progress bar. This stores the healthy "dull thud".
3. Click **Run flow pulse test**. The pump switches on and off, and the vibration ring-down stays close to baseline (≈ 1.0×).
4. Switch the scenario to **Void 250 ml** or **Void 500 ml** and run the pulse test again. The ring-down jumps to about 2–3× baseline, a resonance line appears on the microphone spectrogram, the VRI climbs, and the state turns **RED**.
5. Compare the **Phase 1 laptop model** with the **Phase 2 TinyML** probabilities, and switch which one drives the VRI.

Also worth opening:
- **LoRaWAN network (concept):** a simulated production network of 10 manholes × 2 sensors and 2 gateways, with a live uplink log, the payload layout and a battery-life calculator. It is clearly labelled *not built*.
- **Alerts & work orders:** move an alert through New → Acknowledged → Dispatched → Inspected → Repaired → Closed.
- **Risk layers:** a mock of the predictive risk map (geology, rainfall, traffic, reports).

> **All data in the dashboard is simulated or seed data.** Map tiles come from OpenStreetMap and need an internet connection. Everything else works offline.

---

## Other commands

Run these from `dashboard/`:

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server with hot reload at http://localhost:5173 |
| `pnpm build` | Type-check and build a production bundle into `dashboard/dist/` |
| `pnpm preview` | Serve the production build locally (run `pnpm build` first) |
| `pnpm typecheck` | TypeScript check only |
| `pnpm lint` | ESLint |

## Troubleshooting

| Problem | Fix |
|---|---|
| `pnpm: command not found` | Run `corepack enable` or `npm install -g pnpm`, then open a new terminal |
| `Port 5173 is in use` | Vite picks the next free port automatically. Use the URL it prints, or run `pnpm dev --port 5174` |
| Install fails with an engine / Node version error | Upgrade Node to 22 LTS or newer |
| The map is grey but markers show | You are offline; OpenStreetMap tiles need internet |
| A blank page after pulling new changes | Run `pnpm install` again, then restart `pnpm dev` |

---

## Project structure

```
10v-soil-erosion/
├── README.md               ← you are here
├── prd.md                  ← product requirements document
├── context.md              ← brainstorming notes
└── dashboard/              ← Vite + React + TypeScript + Tailwind v4 + shadcn/ui
    ├── src/
    │   ├── launcher.tsx            launcher page (pick A / B / C)
    │   ├── variants/a|b|c/         the three layout directions
    │   ├── data/
    │   │   ├── rig-sim.ts          simulated prototype rig (mic FFT + vibration, pulse test, ML, VRI)
    │   │   ├── network-sim.ts      simulated LoRaWAN production concept + battery model
    │   │   ├── seed.ts             manholes, alerts, work orders, risk layers, models
    │   │   └── types.ts
    │   └── components/
    │       ├── viz/rig-viz.tsx     live canvas charts: spectrogram, spectrum, vibration scope
    │       └── ui/                 shadcn/ui components
    └── package.json
```

More detail for developers is in [`dashboard/README.md`](dashboard/README.md).

## Team

Sime Darby Property University Hackathon 2026 submission. The full problem, solution, feasibility and pilot plan are in [`prd.md`](prd.md).
