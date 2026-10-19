export type NodeState = "GREEN" | "YELLOW" | "RED"
export type Condition = "safe" | "ambient" | "void"

export interface AudioBand {
  id: string
  label: string
  from: number
  to: number
}

export const AUDIO_BANDS: AudioBand[] = [
  { id: "laminar", label: "Flow rumble", from: 0, to: 200 },
  { id: "low", label: "Low", from: 200, to: 800 },
  { id: "resonance", label: "Pipe resonance", from: 800, to: 2000 },
  { id: "leak", label: "Leak hiss", from: 2000, to: 5000 },
  { id: "high", label: "High", from: 5000, to: 8000 },
]

export const MIC_BINS = 256
export const MIC_MAX_HZ = 8000

export interface AudioClip {
  id: string
  runNumber: number
  clipIndex: number // 1 to 10
  name: string
  condition: Condition
  durationSec: number
  audioBuffer: AudioBuffer | null
  waveform: Float32Array // Downsampled time-domain envelope for fast rendering
  stftFrames: Float32Array[] // Array of 256-bin spectrum slices across the 10s
  stftHopSec: number
  rmsDb: number
  peakHz: number
  centroidHz: number
  bandDb: number[] // 5 bands
}

export interface AudioRun {
  id: string
  runNumber: number // 1 to 18
  condition: Condition
  name: string
  clips: AudioClip[]
  avgRmsDb: number
  avgPeakHz: number
  vriScore: number // 0 to 100
  state: NodeState
  isBaseline: boolean
  isSynthetic: boolean
}

export interface PlaybackState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  playbackRate: number
  loop: boolean
}

export interface VriMetrics {
  vri: number
  state: NodeState
  components: {
    spectralDrift: number // Baseline deviation (0-1)
    resonanceShift: number // 800-2000 Hz resonance peak prominence (0-1)
    turbulentHiss: number // 2000-5000 Hz energy drift (0-1)
  }
}
