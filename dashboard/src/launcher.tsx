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
    to: "/a",
    tag: "A",
    title: "Control Room",
    body: "Dense, everything-at-once operations console. Sidebar navigation, multi-panel live monitoring.",
  },
  {
    to: "/b",
    tag: "B",
    title: "Command Hierarchy",
    body: "Action-first and hierarchical. Drill down Township -> Zone -> Manhole -> Sensor, then act with verbs, queues and progress bars.",
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
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col justify-center gap-8 p-6">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit">Frontend prototypes - seed data only</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Subsurface Sentinel</h1>
        <p className="text-muted-foreground">
          Three layout directions over the same simulated data. Press <kbd>d</kbd> to toggle dark mode.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {VARIANTS.map((v) => (
          <Card key={v.to}>
            <CardHeader>
              <Badge className="w-fit">{v.tag}</Badge>
              <CardTitle>{v.title}</CardTitle>
              <CardDescription>{v.body}</CardDescription>
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
