import {
  AudioWaveformIcon,
  ChartSplineIcon,
  FolderTreeIcon,
  GaugeIcon,
  Grid2X2Icon,
  MicIcon,
  SigmaIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { audioStore, CMAPS, getActiveClip, getActiveRun, getBaselineRun, useAudioStore, useInitAudioPlayer } from "../store"
import { Pane } from "../ui"
import { FeatureTable } from "../widgets/feature-table"
import { FileListPanel } from "../widgets/file-list-panel"
import { PlayerBar } from "../widgets/player-bar"
import { RunNavigator } from "../widgets/run-navigator"
import { RunsMatrix } from "../widgets/runs-matrix"
import { Spectrogram10s } from "../widgets/spectrogram-10s"
import { DbAxis, FreqAxis, SpectrumLive } from "../widgets/spectrum-live"
import { VriPanel } from "../widgets/vri-panel"
import { Waveform10s } from "../widgets/waveform-10s"

function Gutter() {
  return (
    <ResizableHandle className="w-1.5 bg-transparent transition-colors hover:bg-foreground/10 aria-[orientation=horizontal]:h-1.5 aria-[orientation=horizontal]:w-full" />
  )
}

export function AudioConsole() {
  useInitAudioPlayer()
  const s = useAudioStore()
  const run = getActiveRun(s)
  const clip = getActiveClip(s)
  const baselineRun = getBaselineRun(s)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Run & Clip Navigation Bar */}
      <RunNavigator />

      {/* Audio Playback & Scrubber Controls */}
      <PlayerBar />

      {/* Main Multi-Panel Workspace */}
      <div className="min-h-0 flex-1 p-2">
        <ResizablePanelGroup orientation="horizontal">
          {/* Column 1: File & Run Browser */}
          <ResizablePanel defaultSize="22%" minSize="15%" maxSize="35%">
            <Pane
              title="Files & Runs"
              icon={FolderTreeIcon}
              meta={`${s.runs.length} runs`}
              bodyClassName="p-2"
            >
              <FileListPanel />
            </Pane>
          </ResizablePanel>

          <Gutter />

          {/* Column 2: Acoustic Visualizations */}
          <ResizablePanel defaultSize="52%" minSize="35%">
            <ResizablePanelGroup orientation="vertical">
              {/* 1. Full Scrolling Spectrogram (STFT Waterfall) */}
              <ResizablePanel defaultSize="42%" minSize="25%">
                <Pane
                  title="MIC spectrogram"
                  icon={MicIcon}
                  meta="0-8 kHz / 31 fps / 7.7 s"
                  actions={
                    <Button
                      size="xs"
                      variant="ghost"
                      className="h-5 px-1.5 font-mono text-[10px]"
                      onClick={() => {
                        const next = CMAPS[(CMAPS.indexOf(s.colormap) + 1) % CMAPS.length]
                        audioStore.setColormap(next)
                      }}
                    >
                      {s.colormap}
                    </Button>
                  }
                  bodyClassName="p-1"
                >
                  <Spectrogram10s className="h-full rounded-sm" />
                </Pane>
              </ResizablePanel>

              <Gutter />

              {/* 2. Instantaneous Live Spectrum vs Baseline */}
              <ResizablePanel defaultSize="34%" minSize="20%">
                <Pane
                  title="MIC spectrum"
                  icon={ChartSplineIcon}
                  meta={`peak ${(clip.peakHz / 1000).toFixed(2)} kHz`}
                  actions={
                    <span className="flex items-center gap-2 font-mono text-[9.5px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="h-0.5 w-3 bg-foreground" />
                        live
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 border-t border-dashed border-foreground/60" />
                        {baselineRun ? "baseline" : "no baseline"}
                      </span>
                    </span>
                  }
                  bodyClassName="flex flex-col gap-0.5 p-1.5"
                >
                  <div className="relative min-h-0 flex-1 pl-7">
                    <DbAxis />
                    <SpectrumLive className="h-full text-foreground" />
                  </div>
                  <FreqAxis className="pl-7" />
                </Pane>
              </ResizablePanel>

              <Gutter />

              {/* 3. Waveform Scrubber & Sub-band Feature Metrics */}
              <ResizablePanel defaultSize="24%" minSize="18%">
                <ResizablePanelGroup orientation="horizontal">
                  <ResizablePanel defaultSize="55%">
                    <Pane
                      title="10s Audio Waveform"
                      icon={AudioWaveformIcon}
                      meta="Click to seek"
                      bodyClassName="p-1"
                    >
                      <Waveform10s />
                    </Pane>
                  </ResizablePanel>

                  <Gutter />

                  <ResizablePanel defaultSize="45%">
                    <Pane
                      title="Acoustic Features"
                      icon={SigmaIcon}
                      meta="5-band energy vector"
                      bodyClassName="p-2"
                    >
                      <FeatureTable />
                    </Pane>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <Gutter />

          {/* Right Column: Decision & 18-Run Comparative Analysis */}
          <ResizablePanel defaultSize="26%" minSize="20%">
            <ResizablePanelGroup orientation="vertical">
              {/* Void Risk Index Panel */}
              <ResizablePanel defaultSize="58%" minSize="40%">
                <Pane
                  title="Void Risk Decision"
                  icon={GaugeIcon}
                  meta={`${run.name} · ${clip.name}`}
                  bodyClassName="flex flex-col gap-3 p-2.5"
                >
                  <VriPanel />
                </Pane>
              </ResizablePanel>

              <Gutter />

              {/* 18 Runs Rapid Matrix */}
              <ResizablePanel defaultSize="42%" minSize="30%">
                <Pane
                  title="18 Runs Matrix"
                  icon={Grid2X2Icon}
                  meta="All test scenarios"
                  bodyClassName="p-2"
                >
                  <RunsMatrix />
                </Pane>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
