import { AUDIO_BANDS } from "../types"
import { getActiveClip, useAudioStore } from "../store"
import { Num } from "../ui"

export function FeatureTable() {
  const s = useAudioStore()
  const clip = getActiveClip(s)

  return (
    <div className="flex flex-col gap-2.5">
      {/* Primary Key Scalars */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col rounded border bg-muted/20 p-2">
          <span className="font-mono text-[9.5px] text-muted-foreground uppercase">RMS Energy</span>
          <Num className="text-sm font-semibold">{clip.rmsDb.toFixed(1)} dBFS</Num>
        </div>
        <div className="flex flex-col rounded border bg-muted/20 p-2">
          <span className="font-mono text-[9.5px] text-muted-foreground uppercase">Peak Resonant</span>
          <Num className="text-sm font-semibold text-amber-500">{clip.peakHz} Hz</Num>
        </div>
        <div className="flex flex-col rounded border bg-muted/20 p-2">
          <span className="font-mono text-[9.5px] text-muted-foreground uppercase">Centroid</span>
          <Num className="text-sm font-semibold">{clip.centroidHz} Hz</Num>
        </div>
      </div>

      {/* 5 Sub-band Energies */}
      <div className="flex flex-col gap-1.5 rounded border bg-card/40 p-2">
        <span className="font-mono text-[10px] font-semibold text-muted-foreground uppercase">
          Sub-band Spectral Power (dB)
        </span>

        {AUDIO_BANDS.map((band, i) => {
          const db = clip.bandDb[i] || -80
          const pct = Math.max(0, Math.min(100, ((db + 100) / 80) * 100))
          const isResonance = band.id === "resonance"
          const isLeak = band.id === "leak"

          return (
            <div key={band.id} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className={isResonance ? "font-semibold text-amber-500" : isLeak ? "font-medium text-sky-400" : "text-muted-foreground"}>
                  {band.label} ({band.from}-{band.to} Hz)
                </span>
                <Num className="text-[10.5px]">{db.toFixed(1)} dB</Num>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isResonance ? "bg-amber-500" : isLeak ? "bg-sky-400" : "bg-muted-foreground/60"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
