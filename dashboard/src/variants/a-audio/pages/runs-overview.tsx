import { StarIcon } from "lucide-react"
import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { audioStore, getFilteredRuns, useAudioStore } from "../store"
import { Dot, Num, StatePill } from "../ui"

export function RunsOverview() {
  const s = useAudioStore()
  const navigate = useNavigate()
  const displayedRuns = getFilteredRuns(s)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Audio Runs Comparative Analysis</h2>
          <p className="text-muted-foreground text-xs">
            Review and benchmark all runs from the three collections: Safe Soil (18), Ambient Baseline (8), and Critical Void (18).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Condition Filter */}
          <div className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5">
            <button
              onClick={() => audioStore.setCondition("all")}
              className={cn(
                "flex h-7 items-center rounded px-2.5 font-mono text-xs font-medium transition-colors",
                s.selectedCondition === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All (44 Runs)
            </button>
            <button
              onClick={() => audioStore.setCondition("safe")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded px-2.5 font-mono text-xs font-medium transition-colors",
                s.selectedCondition === "safe"
                  ? "bg-emerald-600 text-white shadow-xs dark:bg-emerald-500"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="size-1.5 rounded-full bg-emerald-200" />
              Safe (18)
            </button>
            <button
              onClick={() => audioStore.setCondition("ambient")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded px-2.5 font-mono text-xs font-medium transition-colors",
                s.selectedCondition === "ambient"
                  ? "bg-sky-600 text-white shadow-xs dark:bg-sky-500"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="size-1.5 rounded-full bg-sky-200" />
              Ambient (8)
            </button>
            <button
              onClick={() => audioStore.setCondition("void")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded px-2.5 font-mono text-xs font-medium transition-colors",
                s.selectedCondition === "void"
                  ? "bg-red-600 text-white shadow-xs dark:bg-red-500"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="size-1.5 rounded-full bg-red-200" />
              Void (18)
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/a-audio/console")}
          >
            Open Live Console
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">
            Dataset Overview ({displayedRuns.length} Runs · {displayedRuns.length * 10} Clips · 10s each)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Status</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Run ID</TableHead>
                <TableHead>Clips</TableHead>
                <TableHead>Avg RMS Energy</TableHead>
                <TableHead>Peak Resonant Freq</TableHead>
                <TableHead>Acoustic VRI</TableHead>
                <TableHead>Baseline Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedRuns.map((r) => {
                const isSelected = r.id === s.selectedRunId
                const isBase = r.isBaseline

                return (
                  <TableRow
                    key={r.id}
                    className={`cursor-pointer transition-colors ${isSelected ? "bg-muted/50 font-medium" : ""}`}
                    onClick={() => {
                      audioStore.selectRun(r.id)
                      navigate("/a-audio/console")
                    }}
                  >
                    <TableCell>
                      <Dot state={r.state} />
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                          r.condition === "void"
                            ? "bg-red-500/15 text-red-700 dark:text-red-400"
                            : r.condition === "ambient"
                              ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {r.condition}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.clips.length} clips (10s each)</TableCell>
                    <TableCell className="font-mono text-xs">{r.avgRmsDb} dBFS</TableCell>
                    <TableCell className="font-mono text-xs text-amber-500">{r.avgPeakHz} Hz</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatePill state={r.state} compact />
                        <Num className="text-xs">{r.vriScore}</Num>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isBase ? (
                        <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          ★ Active Baseline
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">Candidate</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!isBase && (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="h-6 gap-1 px-2 text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation()
                              audioStore.setBaseline(r.id)
                            }}
                          >
                            <StarIcon className="size-2.5 text-amber-500" />
                            Set Baseline
                          </Button>
                        )}
                        <Button
                          size="xs"
                          variant="secondary"
                          className="h-6 px-2 text-[10px]"
                          onClick={(e) => {
                            e.stopPropagation()
                            audioStore.selectRun(r.id)
                            navigate("/a-audio/console")
                          }}
                        >
                          Inspect
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
