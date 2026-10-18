import { useEffect } from "react"
import {
  ActivityIcon,
  BatteryChargingIcon,
  BellRingIcon,
  CpuIcon,
  CrosshairIcon,
  FileCodeIcon,
  FlaskConicalIcon,
  LayersIcon,
  MoonIcon,
  PlayIcon,
  PowerIcon,
  RadioTowerIcon,
  WifiOffIcon,
  WavesIcon,
} from "lucide-react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useTheme } from "@/components/theme-provider"
import { rig } from "@/data/rig-sim"
import { alerts, manholes, riskLayers, surfaceReports } from "@/data/seed"
import { MODES } from "./lib"
import { runDemo } from "./prototype/demo"
import { isDarkNow } from "./top-bar"
import { cstore } from "./store"

const MODE_ICON = {
  prototype: FlaskConicalIcon,
  network: RadioTowerIcon,
  risk: LayersIcon,
  alerts: BellRingIcon,
} as const

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate()
  const { setTheme } = useTheme()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  const go = (to: string) => () => {
    onOpenChange(false)
    navigate(to)
  }
  const act = (fn: () => void, to = "/c/prototype") => () => {
    onOpenChange(false)
    navigate(to)
    fn()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Jump to"
      description="Search manholes, alerts, reports, modes and actions"
      className="sm:max-w-xl"
    >
      <Command className="max-h-[min(70vh,520px)]">
        <CommandInput placeholder="Jump to a manhole, alert or action..." />
        <CommandList className="max-h-[min(60vh,440px)]">
          <CommandEmpty>Nothing matches.</CommandEmpty>

          <CommandGroup heading="Modes">
            {MODES.map((m) => {
              const Icon = MODE_ICON[m.id]
              return (
                <CommandItem key={m.id} value={`mode ${m.label}`} onSelect={go(`/c/${m.id}`)}>
                  <Icon /> {m.label}
                </CommandItem>
              )
            })}
          </CommandGroup>
          <CommandSeparator />

          <CommandGroup heading="Manholes (Network concept)">
            {manholes.map((m) => (
              <CommandItem key={m.id} value={`${m.id} ${m.name} ${m.road} ${m.state}`} onSelect={go(`/c/network/${m.id}`)}>
                <RadioTowerIcon />
                <span className="font-mono">{m.id}</span>
                <span className="truncate">{m.name}</span>
                <CommandShortcut>{m.state} · VRI {m.vri}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />

          <CommandGroup heading="Alerts and reports">
            {alerts.map((a) => (
              <CommandItem
                key={a.id}
                value={`${a.id} alert ${a.manholeId} ${a.priority} ${a.state} ${a.summary}`}
                onSelect={go(`/c/alerts/${a.id}`)}
              >
                <BellRingIcon />
                <span className="font-mono">{a.id}</span>
                <span className="truncate">{manholes.find((m) => m.id === a.manholeId)?.name}</span>
                <CommandShortcut>{a.priority} · {a.state}</CommandShortcut>
              </CommandItem>
            ))}
            {surfaceReports.map((r) => (
              <CommandItem key={r.id} value={`${r.id} report ${r.category} ${r.reporter}`} onSelect={go(`/c/alerts/${r.id}`)}>
                <ActivityIcon />
                <span className="font-mono">{r.id}</span>
                <span className="truncate">{r.category}</span>
                <CommandShortcut>{r.status}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />

          <CommandGroup heading="Prototype actions">
            <CommandItem value="open lab view ml dataset ring-down" onSelect={go("/c/prototype/lab")}>
              <FlaskConicalIcon /> Open lab view
            </CommandItem>
            <CommandItem value="calibrate baseline" onSelect={act(() => { rig.calibrate(8); toast("Calibrating healthy baseline for 8 s") })}>
              <CrosshairIcon /> Calibrate healthy baseline
            </CommandItem>
            <CommandItem value="run flow pulse test" onSelect={act(() => { rig.runPulseTest(4, 1200); toast("Flow pulse test: 4 on/off cycles") })}>
              <WavesIcon /> Run flow pulse test
            </CommandItem>
            <CommandItem value="run demo script thud drum" onSelect={act(() => void runDemo())}>
              <PlayIcon /> Run demo script (thud vs drum)
            </CommandItem>
            <CommandItem value="toggle flow on off" onSelect={act(() => rig.setFlow(!rig.snapshot.flowOn))}>
              <PowerIcon /> Toggle water flow
            </CommandItem>
            <CommandItem
              value="toggle tinyml laptop inference"
              onSelect={act(() => {
                const next = !rig.snapshot.tinyMlOnDevice
                rig.setTinyMl(next)
                toast(next ? "VRI now driven by TinyML on the ESP32" : "VRI now driven by the laptop Random Forest")
              })}
            >
              <CpuIcon /> Switch inference: laptop or TinyML
            </CommandItem>
            <CommandItem value="drop wifi serial fallback" onSelect={act(() => { rig.dropWifi(); toast.warning("Simulating Wi-Fi drop") })}>
              <WifiOffIcon /> Simulate Wi-Fi drop
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />

          <CommandGroup heading="Concept and view">
            <CommandItem value="battery calculator life years" onSelect={go("/c/network/battery")}>
              <BatteryChargingIcon /> Battery calculator
            </CommandItem>
            <CommandItem value="payload layout airtime" onSelect={go("/c/network/payload")}>
              <FileCodeIcon /> Payload layout and airtime
            </CommandItem>
            <CommandItem
              value="show all risk layers reset"
              onSelect={() => {
                cstore.setLayers(riskLayers.map((l) => l.id))
                onOpenChange(false)
                navigate("/c/risk")
                toast("All risk layers switched on")
              }}
            >
              <LayersIcon /> Show all risk layers
            </CommandItem>
            <CommandItem
              value="toggle dark light theme"
              onSelect={() => {
                setTheme(isDarkNow() ? "light" : "dark")
                onOpenChange(false)
              }}
            >
              <MoonIcon /> Toggle dark mode
              <CommandShortcut>D</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
