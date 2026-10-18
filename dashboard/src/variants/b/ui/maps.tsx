import type { LatLngBoundsExpression, LatLngExpression } from "leaflet"
import { CircleMarker, MapContainer, TileLayer, Tooltip as LTooltip } from "react-leaflet"

import type { Manhole } from "@/data/types"
import { cn } from "@/lib/utils"

import { STATE_META } from "./state"

export function BaseMap({
  bounds,
  className,
  children,
  interactive = true,
}: {
  bounds: LatLngBoundsExpression
  className?: string
  children?: React.ReactNode
  interactive?: boolean
}) {
  return (
    <div className={cn("relative isolate z-0 h-72 overflow-hidden rounded-lg border", className)}>
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [28, 28] }}
        scrollWheelZoom={false}
        dragging={interactive}
        zoomControl={interactive}
        className="h-full w-full bg-muted! dark:[&_.leaflet-tile]:[filter:invert(1)_hue-rotate(180deg)_brightness(0.8)_contrast(0.9)]"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {children}
      </MapContainer>
    </div>
  )
}

export function boundsOf(points: { lat: number; lon: number }[], pad = 0.0015): LatLngBoundsExpression {
  const lats = points.map((p) => p.lat)
  const lons = points.map((p) => p.lon)
  return [
    [Math.min(...lats) - pad, Math.min(...lons) - pad],
    [Math.max(...lats) + pad, Math.max(...lons) + pad],
  ]
}

export function ManholeMarkers({
  nodes,
  onSelect,
  highlight,
  permanentLabels = false,
}: {
  nodes: Manhole[]
  onSelect?: (m: Manhole) => void
  highlight?: string
  permanentLabels?: boolean
}) {
  return (
    <>
      {nodes.map((m) => {
        const pos: LatLngExpression = [m.lat, m.lon]
        const hex = STATE_META[m.state].hex
        return (
          <CircleMarker
            key={m.id}
            center={pos}
            radius={m.id === highlight ? 12 : m.state === "RED" ? 10 : 8}
            pathOptions={{
              color: m.id === highlight ? "#111" : "#fff",
              weight: m.id === highlight ? 3 : 2,
              fillColor: hex,
              fillOpacity: 0.95,
            }}
            eventHandlers={onSelect ? { click: () => onSelect(m) } : undefined}
          >
            <LTooltip direction="top" offset={[0, -8]} permanent={permanentLabels}>
              <span className="font-mono text-xs">
                {m.id} VRI {m.vri}
              </span>
            </LTooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}
