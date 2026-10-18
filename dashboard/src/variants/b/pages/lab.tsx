import { CpuIcon, DatabaseZapIcon, DownloadIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { useRig } from "@/data/rig-sim"

import { datasetGrid } from "../derive"
import { paths } from "../paths"
import {
  downloadText,
  queueExportEdge,
  queueRetrain,
  useGame,
  useLaneBusy,
} from "../store"
import { DatasetGridPanel, ModelCards, RigStatus } from "../ui/blocks"
import { CommandPanel, type Command } from "../ui/commands"
import { LevelLayout, TOWNSHIP_CRUMB } from "../ui/layout"
import { LiveDot, Num, SectionLabel } from "../ui/state"
import { Tag, Tile } from "../ui/tiles"

export default function LabPage() {
  const snap = useRig()
  const packingByAt = useGame((s) => s.packingByAt)
  const benchPacking = useGame((s) => s.benchPacking)
  const retrainedAt = useGame((s) => s.modelRetrainedAt)
  const exportedAt = useGame((s) => s.edgeExportAt)
  const busy = useLaneBusy("lab")

  const grid = datasetGrid(snap.recordings, packingByAt, benchPacking)

  const exportDataset = () => {
    const rows = ["label,packing,minutes,clips", ...grid.map((r) => `${r.label},${r.packing},${r.minutes.toFixed(2)},${r.clips}`)]
    downloadText("sentinel-dataset-index.csv", rows.join("\n"), "text/csv")
    toast.success("Dataset index exported", { description: `${grid.length} class x packing rows` })
  }

  const commands: Command[] = [
    {
      id: "retrain",
      hotkey: "t",
      label: "Retrain models on dataset",
      icon: CpuIcon,
      mode: "sim",
      primary: true,
      hint: "Phase 1 Random Forest refit on the laptop. Training is simulated here.",
      disabled: busy,
      reason: "The lab queue is busy.",
      run: () => queueRetrain("Prototype Lab"),
    },
    {
      id: "edge",
      hotkey: "x",
      label: "Export int8 model",
      icon: DatabaseZapIcon,
      mode: "sim",
      hint: "Phase 2: Edge Impulse export for the ESP32.",
      disabled: busy,
      reason: "The lab queue is busy.",
      run: () => queueExportEdge("Prototype Lab"),
    },
    {
      id: "csv",
      hotkey: "e",
      label: "Export dataset index",
      icon: DownloadIcon,
      mode: "instant",
      run: exportDataset,
    },
  ]

  return (
    <LevelLayout
      crumbs={[TOWNSHIP_CRUMB, { label: "Prototype Lab", to: paths.lab }]}
      level="Site"
      depthMax={3}
      title="Prototype Lab"
      subtitle="One physical test bench. Select it to command the rig, or review the training data and models below."
      badges={<RigStatus snap={snap} />}
      commands={<CommandPanel title="Lab orders" commands={commands} />}
    >
      <section className="flex flex-col gap-3">
        <SectionLabel>Select an asset</SectionLabel>
        <Tile
          to={paths.bench}
          hotkey="1"
          state={snap.state}
          eyebrow={
            <span className="flex items-center gap-1.5">
              <LiveDot /> Asset / Live
            </span>
          }
          title="Test Bench RIG-01"
          subtitle="PVC pipe buried in soil inside a container. XIAO ESP32S3 Sense with one microphone and one acoustic vibration sensor."
          metric={snap.vri}
          metricLabel="VRI now"
          bar={snap.vri}
          barLabel="Void Risk Index"
          barRight={snap.state}
          tags={
            <>
              <Tag>Flow {snap.flowOn ? "ON" : "OFF"}</Tag>
              <Tag>{snap.wet ? "WET" : "DRY"}</Tag>
              <Tag>{snap.baseline ? `Baseline tau ${snap.baseline.tauMs.toFixed(1)} ms` : "No baseline"}</Tag>
              <Tag>2 sensors</Tag>
            </>
          }
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Models</SectionLabel>
          <Badge variant="outline">
            <Num>{snap.recordings.length}</Num> clips recorded this session
          </Badge>
        </div>
        <ModelCards tinyActive={snap.tinyMlOnDevice} retrainedAt={retrainedAt} exportedAt={exportedAt} />
      </section>

      <DatasetGridPanel grid={grid} />
    </LevelLayout>
  )
}
