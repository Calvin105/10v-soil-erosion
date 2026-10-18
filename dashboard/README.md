# Subsurface Sentinel: dashboard

Frontend for Subsurface Sentinel. It contains three layout prototypes (A Control Room, B Command Hierarchy, C Map Canvas) over the same simulated data. Setup and run instructions are in the [root README](../README.md#run-the-dashboard).

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

## Stack

Vite 8 · React 19 · TypeScript · Tailwind CSS v4 · [shadcn/ui](https://ui.shadcn.com) (radix base) · Recharts (via shadcn `chart`) · Leaflet + react-leaflet · react-router (hash routing).

## How it is organised

| Path | Purpose |
|---|---|
| `src/launcher.tsx` | Landing page linking to the three layouts |
| `src/App.tsx` | Routes: `/#/a/*`, `/#/b/*`, `/#/c/*` |
| `src/variants/a/` | **A: Control Room**, a dense console with sidebar pages (console, ml, dataset, network, battery, alerts, risk) |
| `src/variants/b/` | **B: Command Hierarchy**: drill-down levels, command panels with hotkeys, action queue, missions |
| `src/variants/c/` | **C: Map Canvas**: full-screen map with floating panels, sheets and a command palette |
| `src/data/rig-sim.ts` | Simulated prototype rig. `useRig()` gives a ~5 Hz snapshot; `rig.calibrate()`, `rig.runPulseTest()`, `rig.record()`, etc. drive it. Canvases subscribe to raw frames with `rig.onFrame()` |
| `src/data/network-sim.ts` | Simulated LoRaWAN concept: `useNetwork()`, `airtimeMs()`, `projectBattery()`, `PAYLOAD_LAYOUT` |
| `src/data/seed.ts` | Seed data: township, zones, 10 manholes, gateways, alerts, work orders, surface reports, risk layers, models, dataset |
| `src/components/viz/rig-viz.tsx` | `<MicWaterfall/>`, `<MicSpectrum/>`, `<VibScope/>`: canvas charts that redraw at 15 fps without re-rendering React |
| `src/components/ui/` | shadcn/ui components, generated and not hand-edited (excluded from lint) |

## Conventions

- **Use shadcn/ui** for every button, card, sheet, progress bar and so on. To add a component: `pnpm dlx shadcn@latest add <name>`.
- Use Tailwind **semantic tokens** (`bg-card`, `text-muted-foreground`, …) so light and dark mode both work. Hard-coded colours are only for GREEN/YELLOW/RED states, risk heat and spectrogram colormaps.
- Leaflet: use `CircleMarker` / `divIcon`, not default marker images, which break under bundlers.
- Anything from the production design that is not built (LoRaWAN, battery life) must be labelled **"Concept — simulated, not built"**.

## Connecting the real hardware (next step)

Today `rig-sim.ts` generates frames in the browser. To go live, replace its frame source with the backend WebSocket `/ws/live`. Frame format and endpoints are in [`prd.md`](../prd.md) §6.6–6.7. The UI only depends on `useRig()` and `rig.onFrame()`, so the layouts do not need to change.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server with hot reload |
| `pnpm build` | Type-check + production build to `dist/` |
| `pnpm preview` | Serve `dist/` locally |
| `pnpm typecheck` | TypeScript only |
| `pnpm lint` | ESLint |
