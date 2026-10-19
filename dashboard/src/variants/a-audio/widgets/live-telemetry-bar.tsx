import { useAudioStore } from "../store"

const CLASSES = [
  { key: "safe_soil", label: "Safe soil", bar: "bg-emerald-500" },
  { key: "ambient", label: "Ambient", bar: "bg-sky-500" },
  { key: "critical_void", label: "Critical void", bar: "bg-red-500" },
] as const

/** Latest class probabilities + peak from the rig's MQTT telemetry, with a void-probability trail. */
export function LiveTelemetryBar() {
  const { live } = useAudioStore()
  const last = live.telemetry[live.telemetry.length - 1]
  if (!last) return null

  const pts = live.telemetry
    .map((t, i, a) => `${(i / Math.max(1, a.length - 1)) * 100},${100 - Math.min(100, t.critical_void)}`)
    .join(" ")

  return (
    <div className="flex h-12 shrink-0 items-center gap-4 border-b bg-background px-3 font-mono text-[11px]">
      <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
        LIVE
      </span>
      {CLASSES.map((c) => (
        <div key={c.key} className="flex w-36 flex-col gap-0.5">
          <div className="flex justify-between text-muted-foreground">
            <span>{c.label}</span>
            <span className="text-foreground">{last[c.key].toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted">
            <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.min(100, last[c.key])}%` }} />
          </div>
        </div>
      ))}
      <span className="text-muted-foreground">
        peak <span className="text-foreground">{(last.peak / 1000).toFixed(2)} kHz</span>
      </span>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-8 min-w-0 flex-1 text-red-500">
        <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="text-muted-foreground">void trail</span>
    </div>
  )
}
