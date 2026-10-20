import { useState } from "react"
import { AlertCircleIcon, CheckCircle2Icon, MapPinIcon, WavesIcon, Volume2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { variantDStore } from "../store"
import type { CitizenCategory } from "../tickets"

const CATEGORIES: Array<{ id: CitizenCategory; label: string; icon: React.ReactNode; desc: string }> = [
  {
    id: "Road sinking or dip",
    label: "Road sinking or dip",
    icon: <AlertCircleIcon className="h-4 w-4 text-red-500" />,
    desc: "Asphalt depression or sinkhole forming",
  },
  {
    id: "Strange sound",
    label: "Strange sound",
    icon: <Volume2Icon className="h-4 w-4 text-amber-500" />,
    desc: "Hollow echoing sound under road surface",
  },
  {
    id: "Cracked road",
    label: "Cracked road",
    icon: <CheckCircle2Icon className="h-4 w-4 text-orange-500" />,
    desc: "Visible fissure or structural pavement crack",
  },
  {
    id: "Water pooling",
    label: "Water pooling",
    icon: <WavesIcon className="h-4 w-4 text-blue-500" />,
    desc: "Unusual stormwater backflow or ponding",
  },
]

export interface ReportLocation {
  lat: number
  lon: number
  name: string
}

export const DEFAULT_REPORT_LOCATION: ReportLocation = {
  lat: 3.1954,
  lon: 101.5023,
  name: "Persiaran Elmina (near MH-04)",
}

export function CitizenReportDialog({
  open,
  onOpenChange,
  location: activeLoc,
  onLocationChange,
  onPickOnMap,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  location: ReportLocation
  onLocationChange: (loc: ReportLocation) => void
  onPickOnMap?: () => void
}) {
  const [category, setCategory] = useState<CitizenCategory>("Road sinking or dip")
  const [notes, setNotes] = useState("")

  const handleUseMyLocation = () => {
    // Simulated GPS fix near the live prototype corridor
    onLocationChange({
      lat: 3.1953 + (Math.random() - 0.5) * 0.001,
      lon: 101.5022 + (Math.random() - 0.5) * 0.001,
      name: "Current GPS Location (Persiaran Elmina)",
    })
    toast.info("Location acquired: Persiaran Elmina corridor")
  }

  const handleSubmit = () => {
    const ticket = variantDStore.addCitizenTicket({
      category,
      notes: notes.trim() || `Citizen report for ${category.toLowerCase()} along ${activeLoc.name}`,
      lat: activeLoc.lat,
      lon: activeLoc.lon,
      locationName: activeLoc.name,
    })

    toast.success(`Report received: ticket #${ticket.id}`, {
      description: ticket.matchedSensor
        ? "Alert cross-matched with acoustic sensor data! Linked to municipal dispatch."
        : "Report logged in dispatch queue.",
    })

    setNotes("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <MapPinIcon className="h-5 w-5 text-red-500" />
            Report a Ground Problem
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Report road depressions, hollow sounds, or water leaks. Reports are automatically cross-checked with underground acoustic sensors.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Step 1: Location */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>1. Location</span>
              <span className="font-mono text-[10px] text-primary">
                {activeLoc.lat.toFixed(4)}, {activeLoc.lon.toFixed(4)}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs truncate">
                {activeLoc.name}
              </div>
              {onPickOnMap && (
                <Button type="button" variant="outline" size="sm" onClick={onPickOnMap} className="text-xs h-8">
                  Pick on map
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={handleUseMyLocation} className="text-xs h-8">
                Use Location
              </Button>
            </div>
          </div>

          {/* Step 2: Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              2. Problem Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/60 bg-background/50 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                      {cat.icon}
                      <span>{cat.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                      {cat.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Step 3: Optional Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              3. Notes or Observations (Optional)
            </label>
            <Textarea
              placeholder="e.g. Hollow sound whenever heavy trucks drive past; asphalt sinking on left shoulder..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none text-xs h-16"
            />
          </div>
        </div>

        <DialogFooter className="pt-2 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSubmit} className="text-xs font-semibold">
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
