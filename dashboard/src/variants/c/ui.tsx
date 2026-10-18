import type { CSSProperties, ReactNode } from "react"
import { InfoIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { GLASS } from "./lib"

/** Floating glass card that sits over the map. Parent overlay is pointer-events-none. */
export function FloatingCard({
  className,
  style,
  children,
}: {
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div className={cn(GLASS, "pointer-events-auto absolute z-10 flex flex-col overflow-hidden", className)} style={style}>
      {children}
    </div>
  )
}

/**
 * Non-modal, floating right-hand sheet: the map stays visible and clickable,
 * so a click on another pin simply swaps the sheet content.
 */
export function SideSheet({
  open,
  onClose,
  width = 420,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  width?: number
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Sheet open={open} modal={false} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ width, maxWidth: "calc(100vw - 24px)" }}
        className="top-[68px]! right-3! bottom-3! h-auto! gap-0! overflow-hidden rounded-2xl! border! border-border/60! bg-background/90! p-0! shadow-2xl backdrop-blur-xl"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}

export function SheetCloseButton({ className }: { className?: string }) {
  return (
    <SheetClose asChild>
      <Button variant="ghost" size="icon-sm" className={className} aria-label="Close">
        <XIcon />
      </Button>
    </SheetClose>
  )
}

/** The "Concept — simulated, not built" tag used across the production section. */
export function ConceptTag({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full border border-dashed border-amber-500/60 bg-amber-500/10 px-2 text-[11px] font-medium whitespace-nowrap text-amber-800 dark:border-amber-400/50 dark:text-amber-300",
        className
      )}
    >
      {children ?? "Concept — simulated, not built"}
    </span>
  )
}

export function Callout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-400/40 dark:text-amber-200",
        className
      )}
    >
      <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export function SheetSection({
  title,
  right,
  children,
  className,
}: {
  title: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}
