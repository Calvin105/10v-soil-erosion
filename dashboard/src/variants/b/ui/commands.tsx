import type { LucideIcon } from "lucide-react"
import { MinusIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

import { useHotkeys, type Hotkey } from "../hotkeys"
import { SectionLabel } from "./state"

export interface Qty {
  value: number
  min: number
  max: number
  step?: number
  onChange: (n: number) => void
  /** shown inside the stepper, e.g. n => `${n} cycles` */
  format?: (n: number) => string
  /** append "x N" to the button label (default true; false for seconds, minutes...) */
  multiplier?: boolean
}

export type CommandMode = "rig" | "sim" | "nav" | "instant"

export interface Command {
  id: string
  hotkey: string
  label: string
  icon: LucideIcon
  run: () => void
  disabled?: boolean
  /** why it is disabled (shown under the button) */
  reason?: string
  hint?: string
  mode: CommandMode
  primary?: boolean
  qty?: Qty
  /** parameter pickers rendered above the button (label, crew, outcome...) */
  extra?: React.ReactNode
  destructive?: boolean
}

const MODE_LABEL: Record<CommandMode, string> = {
  rig: "Live rig",
  sim: "Simulated",
  nav: "Open",
  instant: "Instant",
}

function ModeTag({ mode }: { mode: CommandMode }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 shrink-0 items-center rounded-sm px-1 text-[9px] font-semibold tracking-wider whitespace-nowrap uppercase",
        mode === "rig" && "bg-foreground text-background",
        mode === "sim" && "border border-dashed border-foreground/30 text-muted-foreground",
        (mode === "nav" || mode === "instant") && "bg-muted text-muted-foreground"
      )}
    >
      {MODE_LABEL[mode]}
    </span>
  )
}

export function Stepper({ q, keys = false }: { q: Qty; keys?: boolean }) {
  const step = q.step ?? 1
  return (
    <div className="flex items-center gap-2">
      {keys && <Kbd>[</Kbd>}
      <ButtonGroup>
        <Button
          variant="outline"
          size="icon"
          aria-label="Decrease"
          disabled={q.value <= q.min}
          onClick={() => q.onChange(Math.max(q.min, q.value - step))}
        >
          <MinusIcon />
        </Button>
        <ButtonGroupText className="min-w-28 justify-center font-mono tabular-nums">
          {q.format ? q.format(q.value) : q.value}
        </ButtonGroupText>
        <Button
          variant="outline"
          size="icon"
          aria-label="Increase"
          disabled={q.value >= q.max}
          onClick={() => q.onChange(Math.min(q.max, q.value + step))}
        >
          <PlusIcon />
        </Button>
      </ButtonGroup>
      {keys && <Kbd>]</Kbd>}
    </div>
  )
}

function PrimaryCommand({ c }: { c: Command }) {
  const Icon = c.icon
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border-2 border-foreground/80 bg-muted/40 p-3">
      <div className="flex items-center justify-between">
        <SectionLabel className="text-foreground">Primary order</SectionLabel>
        <ModeTag mode={c.mode} />
      </div>
      {c.extra}
      {c.qty && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Quantity</span>
          <Stepper q={c.qty} keys />
        </div>
      )}
      <Button
        size="lg"
        variant={c.destructive ? "destructive" : "default"}
        className="h-11 w-full justify-between px-3 text-base font-semibold"
        disabled={c.disabled}
        onClick={c.run}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="size-5" />
          <span className="truncate">
            {c.label}
            {c.qty && c.qty.multiplier !== false && (
              <span className="font-mono tabular-nums"> ×{c.qty.value}</span>
            )}
          </span>
        </span>
        <Kbd className="h-6 min-w-6 bg-background/20 text-sm text-current uppercase">{c.hotkey}</Kbd>
      </Button>
      {(c.disabled && c.reason) || c.hint ? (
        <p className="text-xs text-muted-foreground">{c.disabled && c.reason ? c.reason : c.hint}</p>
      ) : null}
    </div>
  )
}

function WideCommand({ c }: { c: Command }) {
  const Icon = c.icon
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium">{c.label}</span>
        <ModeTag mode={c.mode} />
      </div>
      {c.extra}
      {c.qty && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Quantity</span>
          <Stepper q={c.qty} />
        </div>
      )}
      <Button
        variant="outline"
        className="h-9 w-full justify-between"
        disabled={c.disabled}
        onClick={c.run}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon />
          <span className="truncate">
            {c.label}
            {c.qty && c.qty.multiplier !== false && (
              <span className="font-mono tabular-nums"> ×{c.qty.value}</span>
            )}
          </span>
        </span>
        <Kbd className="uppercase">{c.hotkey}</Kbd>
      </Button>
      {c.disabled && c.reason ? (
        <p className="text-xs text-muted-foreground">{c.reason}</p>
      ) : c.hint ? (
        <p className="text-xs text-muted-foreground">{c.hint}</p>
      ) : null}
    </div>
  )
}

function GridCommand({ c }: { c: Command }) {
  const Icon = c.icon
  return (
    <Button
      variant={c.destructive ? "destructive" : "outline"}
      className="h-auto min-h-[4.25rem] flex-col items-stretch justify-between gap-1 p-2.5 text-left whitespace-normal"
      disabled={c.disabled}
      onClick={c.run}
      title={c.disabled ? c.reason : c.hint}
    >
      <span className="flex items-center justify-between">
        <Icon className="size-5" />
        <Kbd className="uppercase">{c.hotkey}</Kbd>
      </span>
      <span className="text-[13px] leading-tight font-semibold">{c.label}</span>
      <span className="flex items-center justify-between gap-1">
        <ModeTag mode={c.mode} />
      </span>
    </Button>
  )
}

export function CommandPanel({
  title,
  commands,
  footer,
}: {
  title: string
  commands: Command[]
  footer?: React.ReactNode
}) {
  const primary = commands.find((c) => c.primary) ?? commands[0]
  const rest = commands.filter((c) => c !== primary)
  const wide = rest.filter((c) => c.qty || c.extra)
  const grid = rest.filter((c) => !c.qty && !c.extra)

  const keys: Hotkey[] = commands.map((c) => ({
    key: c.hotkey.toLowerCase(),
    run: c.run,
    disabled: c.disabled,
  }))
  if (primary?.qty) {
    const q = primary.qty
    const step = q.step ?? 1
    keys.push(
      { key: "[", run: () => q.onChange(Math.max(q.min, q.value - step)) },
      { key: "]", run: () => q.onChange(Math.min(q.max, q.value + step)) }
    )
  }
  useHotkeys(keys)

  return (
    <Card size="sm" className="gap-3">
      <CardHeader className="gap-0.5">
        <SectionLabel>Command card</SectionLabel>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {primary && <PrimaryCommand c={primary} />}
        {wide.map((c) => (
          <WideCommand key={c.id} c={c} />
        ))}
        {grid.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {grid.map((c) => (
              <GridCommand key={c.id} c={c} />
            ))}
          </div>
        )}
        {footer}
      </CardContent>
    </Card>
  )
}

/** Compact segmented picker used inside commands (labels, crews, outcomes). */
export function Picker<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: { value: T; label: React.ReactNode; disabled?: boolean }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-7 rounded-md border px-2 text-xs font-medium transition-colors disabled:opacity-40",
              o.value === value
                ? "border-foreground bg-foreground text-background"
                : "bg-background hover:bg-muted"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
