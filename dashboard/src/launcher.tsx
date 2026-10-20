import { ArrowRightIcon } from "lucide-react"
import { Link } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const VARIANTS = [
  {
    to: "/d",
    tag: "D",
    title: "Judge View",
    body: "Simplified hackathon presentation view: full-screen pipe network map, live MQTT void localization, downloadable incident report, and side-by-side WAV comparison.",
    featured: true,
  },
  {
    to: "/a-audio",
    tag: "A-Audio",
    title: "Control Room (.WAV Runs)",
    body: "Single-sensor (INMP441 mic) operations console. Audio playback, 10s spectrogram, FFT vs baseline, and 18-run matrix.",
  },
  {
    to: "/a",
    tag: "A",
    title: "Control Room (Dual Sensor)",
    body: "Dense operations console with simulated mic + piezo vibration sensor streams.",
  },
  {
    to: "/b",
    tag: "B",
    title: "Command Hierarchy",
    body: "Action-first and hierarchical. Drill down Township -> Zone -> Manhole -> Sensor.",
  },
  {
    to: "/c",
    tag: "C",
    title: "Map Canvas",
    body: "Spatial-first. The township map is the canvas; prototype, network and risk layers float over it.",
  },
]

export function Launcher() {
  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col justify-center gap-8 p-6">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit">Frontend prototypes - seed data only</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Subsurface Sentinel</h1>
        <p className="text-muted-foreground">
          Five layout directions over the same sensor data. Press <kbd>d</kbd> to toggle dark mode.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VARIANTS.map((v) => (
          <Card key={v.to} className={v.featured ? "border-primary/50 shadow-md ring-1 ring-primary/20" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant={v.featured ? "default" : "secondary"} className="w-fit">
                  {v.tag}
                </Badge>
                {v.featured && (
                  <span className="font-mono text-[10px] font-semibold text-primary uppercase">
                    Featured
                  </span>
                )}
              </div>
              <CardTitle className="text-base">{v.title}</CardTitle>
              <CardDescription className="text-xs">{v.body}</CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto">
              <Button asChild className="w-full">
                <Link to={v.to}>
                  Open {v.title} <ArrowRightIcon />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
