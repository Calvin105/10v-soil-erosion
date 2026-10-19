import { getActiveRun, getActiveVri, getBaselineRun, useAudioStore } from "../store"
import { Dot, Num, STATE, StatePill, zoneOf } from "../ui"
import { cn } from "@/lib/utils"

export function VriPanel() {
  const s = useAudioStore()
  const activeRun = getActiveRun(s)
  const baselineRun = getBaselineRun(s)
  const metrics = getActiveVri(s)
  const zone = zoneOf(metrics.vri)

  return (
    <div className="flex flex-col gap-3">
      {/* VRI Gauge & Big Number */}
      <div className="flex items-center justify-between rounded-md border bg-card/60 p-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            Void Risk Index (Acoustic)
          </span>
          <div className="flex items-baseline gap-2">
            <Num className={cn("text-3xl font-bold tracking-tight", STATE[zone].text)}>
              {metrics.vri}
            </Num>
            <span className="font-mono text-xs text-muted-foreground">/ 100</span>
          </div>
          <StatePill state={metrics.state} />
        </div>

        <div className="flex flex-col items-end text-right">
          <span className="font-mono text-[10px] text-muted-foreground">Reference Baseline:</span>
          <span className="font-medium text-xs text-foreground">
            {baselineRun ? baselineRun.name : "None (Run 01)"}
          </span>
          {activeRun.id === baselineRun?.id ? (
            <span className="mt-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
              ● Active baseline
            </span>
          ) : (
            <span className="mt-1 font-mono text-[10px] text-muted-foreground">
              Compared vs baseline
            </span>
          )}
        </div>
      </div>

      {/* Acoustic Anomaly Components Breakdown */}
      <div className="flex flex-col gap-2 rounded-md border bg-card/40 p-2.5">
        <span className="font-mono text-[10px] font-semibold text-muted-foreground uppercase">
          Acoustic Anomaly Breakdown
        </span>

        {/* 1. Spectral Band Drift */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">1. Spectral Drift (All Bands)</span>
            <Num className="text-[11px]">
              {(metrics.components.spectralDrift * 100).toFixed(0)}%
            </Num>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-300"
              style={{ width: `${metrics.components.spectralDrift * 100}%` }}
            />
          </div>
        </div>

        {/* 2. Cavity Resonance Shift */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">2. Cavity Resonance (800-2k Hz)</span>
            <Num className="text-[11px]">
              {(metrics.components.resonanceShift * 100).toFixed(0)}%
            </Num>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300"
              style={{ width: `${metrics.components.resonanceShift * 100}%` }}
            />
          </div>
        </div>

        {/* 3. Turbulent Hiss Drift */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">3. Turbulent Hiss (2k-5k Hz)</span>
            <Num className="text-[11px]">
              {(metrics.components.turbulentHiss * 100).toFixed(0)}%
            </Num>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-purple-500 transition-all duration-300"
              style={{ width: `${metrics.components.turbulentHiss * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 10-Clip Risk Stability Profile */}
      <div className="flex flex-col gap-1.5 rounded-md border bg-card/40 p-2.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold text-muted-foreground uppercase">
            Run Clips Consistency (10 Clips)
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {activeRun.name}
          </span>
        </div>

        <div className="grid grid-cols-10 gap-1 pt-1">
          {activeRun.clips.map((clip) => {
            const isSelected = clip.clipIndex === s.selectedClipIndex
            const clipDev = Math.abs(clip.peakHz - (baselineRun?.avgPeakHz || 1100))
            const clipState = clipDev > 400 ? "RED" : clipDev > 200 ? "YELLOW" : "GREEN"
            return (
              <div
                key={clip.id}
                className={cn(
                  "flex flex-col items-center gap-1 rounded border p-1 text-center transition-all",
                  isSelected
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-border/60 bg-muted/20"
                )}
                title={`Clip ${clip.clipIndex}: Peak ${clip.peakHz} Hz, ${clip.rmsDb.toFixed(1)} dB`}
              >
                <span className="font-mono text-[9px] font-medium">
                  {clip.clipIndex}
                </span>
                <Dot state={clipState} className="size-1.5" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
