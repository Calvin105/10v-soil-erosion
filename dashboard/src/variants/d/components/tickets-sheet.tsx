import { ActivityIcon, ExternalLinkIcon, Link2Icon, PrinterIcon, RadioIcon, UserIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useVariantDStore, variantDStore } from "../store"
import type { Ticket } from "../tickets"

function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSec < 60) return "Just now"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

export function TicketsSheet({
  open,
  onOpenChange,
  onFlyTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFlyTo?: (target: [number, number]) => void
}) {
  const s = useVariantDStore()
  const tickets = s.tickets

  const newCount = tickets.filter((t) => t.status === "New").length
  const matchedCount = tickets.filter((t) => t.matchedSensor || t.matchedCitizen).length

  const handleAdvanceStatus = (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation()
    variantDStore.advanceTicketStatus(ticketId)
  }

  const handleRowClick = (ticket: Ticket) => {
    if (onFlyTo) {
      onFlyTo([ticket.lat, ticket.lon])
      onOpenChange(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl !z-[2600] flex flex-col h-full bg-background p-0 shadow-2xl"
      >
        {/* Printable & Screen Header */}
        <div className="border-b px-6 py-4 bg-muted/20">
          <div className="flex items-center justify-between">
            <SheetHeader className="text-left space-y-1">
              <SheetTitle className="text-lg font-bold flex items-center gap-2">
                <RadioIcon className="h-5 w-5 text-primary" />
                Dispatch & Verification Tickets
                {newCount > 0 && (
                  <Badge className="bg-red-500 text-white font-mono text-[10px] ml-1">
                    {newCount} New
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Unified incident queue fusing TinyML acoustic sensor alerts with citizen reports.
              </SheetDescription>
            </SheetHeader>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="print:hidden h-8 text-xs font-semibold gap-1.5 shrink-0 ml-2"
            >
              <PrinterIcon className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>

          {/* Quick Metrics Strip */}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>
              Total: <strong className="text-foreground">{tickets.length}</strong>
            </span>
            <span>·</span>
            <span>
              Cross-checked: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{matchedCount} confirmed</strong>
            </span>
            <span>·</span>
            <span className="text-[10px] italic">Click status chip to advance</span>
          </div>
        </div>

        {/* Scrollable Ticket List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
          {tickets.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground italic">
              No active tickets in queue.
            </div>
          ) : (
            tickets.map((t) => {
              const isMatched = t.matchedSensor || t.matchedCitizen
              const isSensor = t.source === "sensor"

              return (
                <div
                  key={t.id}
                  onClick={() => handleRowClick(t)}
                  className={`group relative rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md ${
                    isMatched
                      ? "border-emerald-500/40 bg-emerald-500/[0.03] hover:border-emerald-500/80"
                      : "border-border/60 bg-card hover:border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Left: Source Icon & Title */}
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`mt-0.5 rounded-full p-1.5 shrink-0 ${
                          isSensor
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {isSensor ? (
                          <ActivityIcon className="h-4 w-4" />
                        ) : (
                          <UserIcon className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-muted-foreground">
                            #{t.id}
                          </span>
                          <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                            {t.title}
                          </span>
                          {t.isSimulated && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal text-muted-foreground">
                              Simulated
                            </Badge>
                          )}
                        </div>

                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
                          <span>{t.locationName}</span>
                          <span>·</span>
                          <span className="font-mono text-[10px]">{formatTimeAgo(t.createdAt)}</span>
                        </div>

                        {t.notes && (
                          <p className="text-[11px] text-foreground/80 mt-1.5 line-clamp-2 italic">
                            "{t.notes}"
                          </p>
                        )}

                        {/* Cross-check Match Badge */}
                        {isMatched && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              <Link2Icon className="h-3 w-3" />
                              Matches sensor alert
                            </span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              {isSensor ? "Citizen reports corroborate fault" : "Ground risk & acoustic anomaly confirmed"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Status chip & Fly icon */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleAdvanceStatus(e, t.id)}
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-transform active:scale-95 ${
                          t.status === "New"
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : t.status === "Assigned"
                            ? "bg-amber-500 text-white hover:bg-amber-600"
                            : "bg-emerald-500 text-white hover:bg-emerald-600"
                        }`}
                        title="Click to advance status (New → Assigned → Resolved)"
                      >
                        {t.status}
                      </button>

                      <span className="text-[10px] font-mono text-muted-foreground group-hover:text-primary flex items-center gap-0.5 transition-colors">
                        Fly <ExternalLinkIcon className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Print Stylesheet */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .sheet-content,
            .sheet-content * {
              visibility: visible;
            }
            .sheet-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              max-width: 100% !important;
              box-shadow: none !important;
              border: none !important;
            }
          }
        `}</style>
      </SheetContent>
    </Sheet>
  )
}
