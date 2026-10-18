import { Fragment } from "react"
import { Link, useNavigate } from "react-router"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

import { useHotkeys } from "../hotkeys"
import { ActionQueue } from "./queue"

export interface Crumb {
  label: React.ReactNode
  to: string
}

export const TOWNSHIP_CRUMB: Crumb = { label: "City of Elmina", to: "/b" }

function DepthPips({ depth, max, level }: { depth: number; max: number; level: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="flex gap-0.5" aria-hidden>
        {Array.from({ length: max + 1 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-3 w-1.5 rounded-[2px]",
              i <= depth ? "bg-foreground" : "bg-foreground/15"
            )}
          />
        ))}
      </div>
      <span className="text-[11px] font-semibold tracking-[0.14em] whitespace-nowrap text-muted-foreground uppercase">
        Level {depth} / {level}
      </span>
    </div>
  )
}

export function LevelLayout({
  crumbs,
  level,
  depth,
  depthMax = 4,
  title,
  subtitle,
  badges,
  commands,
  children,
}: {
  crumbs: Crumb[]
  level: string
  /** semantic depth (defaults to the number of crumbs minus one) */
  depth?: number
  /** deepest level reachable in this branch (sets the number of depth pips) */
  depthMax?: number
  title: React.ReactNode
  subtitle?: React.ReactNode
  badges?: React.ReactNode
  commands: React.ReactNode
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2].to : null
  const up = () => {
    if (parent) navigate(parent)
  }
  useHotkeys([
    { key: "escape", run: up, disabled: !parent },
    { key: "backspace", run: up, disabled: !parent },
  ])

  return (
    <>
      <div className="sticky top-16 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-11 max-w-[1600px] items-center gap-4 px-4">
          <DepthPips depth={depth ?? crumbs.length - 1} max={depthMax} level={level} />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap text-sm">
              {crumbs.map((c, i) => (
                <Fragment key={c.to}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem className="min-w-0">
                    {i === crumbs.length - 1 ? (
                      <BreadcrumbPage className="truncate font-semibold">{c.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={c.to} className="truncate">
                          {c.label}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto hidden shrink-0 items-center gap-3 text-xs text-muted-foreground xl:flex">
            <span className="flex items-center gap-1">
              Select <Kbd>1</Kbd>-<Kbd>9</Kbd>
            </span>
            <span className="flex items-center gap-1">
              Up a level <Kbd>Esc</Kbd>
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}
          </div>
          {children}
        </main>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[7.5rem] lg:max-h-[calc(100svh-8.5rem)] lg:self-start lg:overflow-y-auto lg:pb-2 [scrollbar-width:thin]">
          {commands}
          <ActionQueue />
        </aside>
      </div>
    </>
  )
}

/** A titled panel inside a level's main column. */
export function Panel({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title?: React.ReactNode
  eyebrow?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4", className)}>
      {(title || eyebrow || action) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {eyebrow}
              </div>
            )}
            {title && <h2 className="text-base font-semibold">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
