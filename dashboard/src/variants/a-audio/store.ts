import { useEffect, useSyncExternalStore } from "react"
import {
  calculateAcousticVri,
  ClipPlayer,
  generateSyntheticRuns,
  parseUploadedWavFiles,
} from "./audio-engine"
import type { AudioClip, AudioRun, PlaybackState, VriMetrics } from "./types"

export type Colormap = "inferno" | "jet" | "viridis" | "mono"
export const CMAPS: Colormap[] = ["inferno", "jet", "viridis", "mono"]
export type SelectedCondition = "all" | "safe" | "ambient" | "void"

interface AudioStoreState {
  runs: AudioRun[]
  selectedCondition: SelectedCondition
  selectedRunId: string
  selectedClipIndex: number
  baselineRunId: string
  playback: PlaybackState
  colormap: Colormap
  gain: number
  isLoading: boolean
  error: string | null
}

const initialRuns = generateSyntheticRuns()
const defaultBaseId = initialRuns.find((r) => r.condition === "safe")?.id || initialRuns[0]?.id || "safe_run_1"

let player: ClipPlayer | null = null

let state: AudioStoreState = {
  runs: initialRuns,
  selectedCondition: "all",
  selectedRunId: defaultBaseId,
  selectedClipIndex: 1,
  baselineRunId: defaultBaseId,
  playback: {
    isPlaying: false,
    currentTime: 0,
    duration: 10,
    volume: 0.8,
    isMuted: false,
    playbackRate: 1,
    loop: false,
  },
  colormap: "inferno",
  gain: 1,
  isLoading: false,
  error: null,
}

// Recompute VRIs whenever runs or baseline changes
function updateVris(runs: AudioRun[], baselineId: string): AudioRun[] {
  const baseRun = runs.find((r) => r.id === baselineId) || runs[0] || null
  return runs.map((r) => {
    const isBase = r.id === baseRun?.id
    const metrics = calculateAcousticVri(r, baseRun)
    return {
      ...r,
      isBaseline: isBase,
      vriScore: metrics.vri,
      state: metrics.state,
    }
  })
}

state.runs = updateVris(state.runs, state.baselineRunId)

const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function getPlayer(): ClipPlayer {
  if (!player) {
    player = new ClipPlayer((t) => {
      state = {
        ...state,
        playback: {
          ...state.playback,
          currentTime: t,
        },
      }
      emit()
    })
    player.setVolume(state.playback.volume)
  }
  return player
}

export const audioStore = {
  getSnapshot(): AudioStoreState {
    return state
  },

  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  setCondition(cond: SelectedCondition) {
    const filtered = cond === "all" ? state.runs : state.runs.filter((r) => r.condition === cond)
    const nextRun = filtered.find((r) => r.id === state.selectedRunId) || filtered[0] || state.runs[0]
    
    if (nextRun && nextRun.id !== state.selectedRunId) {
      audioStore.selectRun(nextRun.id)
    }

    state = {
      ...state,
      selectedCondition: cond,
    }
    emit()
  },

  selectRun(runId: string) {
    const run = state.runs.find((r) => r.id === runId)
    if (!run) return
    const clip = run.clips.find((c) => c.clipIndex === state.selectedClipIndex) || run.clips[0]

    const p = getPlayer()
    p.loadClip(clip?.audioBuffer || null)

    state = {
      ...state,
      selectedRunId: runId,
      playback: {
        ...state.playback,
        isPlaying: false,
        currentTime: 0,
      },
    }
    emit()
  },

  selectClip(clipIndex: number) {
    const run = state.runs.find((r) => r.id === state.selectedRunId)
    if (!run) return
    const clip = run.clips.find((c) => c.clipIndex === clipIndex)
    if (!clip) return

    const p = getPlayer()
    p.loadClip(clip.audioBuffer)

    state = {
      ...state,
      selectedClipIndex: clipIndex,
      playback: {
        ...state.playback,
        isPlaying: false,
        currentTime: 0,
      },
    }
    emit()
  },

  setBaseline(runId: string) {
    const updatedRuns = updateVris(state.runs, runId)
    state = {
      ...state,
      baselineRunId: runId,
      runs: updatedRuns,
    }
    emit()
  },

  play() {
    const run = state.runs.find((r) => r.id === state.selectedRunId)
    const clip = run?.clips.find((c) => c.clipIndex === state.selectedClipIndex)
    if (!clip?.audioBuffer) return

    const p = getPlayer()
    p.play()
    state = {
      ...state,
      playback: {
        ...state.playback,
        isPlaying: true,
      },
    }
    emit()
  },

  pause() {
    const p = getPlayer()
    p.pause()
    state = {
      ...state,
      playback: {
        ...state.playback,
        isPlaying: false,
      },
    }
    emit()
  },

  togglePlay() {
    if (state.playback.isPlaying) {
      audioStore.pause()
    } else {
      audioStore.play()
    }
  },

  seek(seconds: number) {
    const p = getPlayer()
    p.seek(seconds)
    state = {
      ...state,
      playback: {
        ...state.playback,
        currentTime: seconds,
      },
    }
    emit()
  },

  setVolume(vol: number) {
    const p = getPlayer()
    p.setVolume(vol)
    state = {
      ...state,
      playback: {
        ...state.playback,
        volume: vol,
      },
    }
    emit()
  },

  toggleMute() {
    const nextMuted = !state.playback.isMuted
    const p = getPlayer()
    p.setMuted(nextMuted)
    state = {
      ...state,
      playback: {
        ...state.playback,
        isMuted: nextMuted,
      },
    }
    emit()
  },

  setColormap(cmap: Colormap) {
    state = { ...state, colormap: cmap }
    emit()
  },

  setGain(g: number) {
    state = { ...state, gain: g }
    emit()
  },

  async loadFolderFiles(files: FileList | File[]) {
    try {
      state = { ...state, isLoading: true, error: null }
      emit()

      const parsedRuns = await parseUploadedWavFiles(files)
      const baseId = parsedRuns[0]?.id || "run_1"
      const runsWithVri = updateVris(parsedRuns, baseId)

      const p = getPlayer()
      const firstClip = runsWithVri[0]?.clips[0] || null
      p.loadClip(firstClip?.audioBuffer || null)

      state = {
        ...state,
        runs: runsWithVri,
        selectedRunId: runsWithVri[0]?.id || "run_1",
        selectedClipIndex: 1,
        baselineRunId: baseId,
        isLoading: false,
        playback: {
          ...state.playback,
          isPlaying: false,
          currentTime: 0,
        },
      }
      emit()
    } catch (err) {
      state = {
        ...state,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load audio files.",
      }
      emit()
    }
  },

  resetToSynthetic() {
    const syn = generateSyntheticRuns()
    const baseId = syn[0]?.id || "run_1"
    const withVri = updateVris(syn, baseId)

    const p = getPlayer()
    p.loadClip(withVri[0]?.clips[0]?.audioBuffer || null)

    state = {
      ...state,
      runs: withVri,
      selectedRunId: baseId,
      selectedClipIndex: 1,
      baselineRunId: baseId,
      error: null,
      playback: {
        ...state.playback,
        isPlaying: false,
        currentTime: 0,
      },
    }
    emit()
  },
}

export function useAudioStore(): AudioStoreState {
  return useSyncExternalStore(audioStore.subscribe, audioStore.getSnapshot)
}

export function getFilteredRuns(s: AudioStoreState): AudioRun[] {
  if (s.selectedCondition === "all") return s.runs
  return s.runs.filter((r) => r.condition === s.selectedCondition)
}

export function getActiveRun(s: AudioStoreState): AudioRun {
  return s.runs.find((r) => r.id === s.selectedRunId) || s.runs[0]
}

export function getActiveClip(s: AudioStoreState): AudioClip {
  const run = getActiveRun(s)
  return run.clips.find((c) => c.clipIndex === s.selectedClipIndex) || run.clips[0]
}

export function getBaselineRun(s: AudioStoreState): AudioRun | null {
  return s.runs.find((r) => r.id === s.baselineRunId) || null
}

export function getActiveVri(s: AudioStoreState): VriMetrics {
  const activeRun = getActiveRun(s)
  const baseRun = getBaselineRun(s)
  return calculateAcousticVri(activeRun, baseRun)
}

// Hook to load initial clip buffer into player
export function useInitAudioPlayer() {
  const s = useAudioStore()
  useEffect(() => {
    const clip = getActiveClip(s)
    if (clip?.audioBuffer) {
      const p = getPlayer()
      p.loadClip(clip.audioBuffer)
    }
  }, [s.selectedRunId, s.selectedClipIndex])
}
