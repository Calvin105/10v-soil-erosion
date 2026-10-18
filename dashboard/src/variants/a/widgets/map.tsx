import { useEffect } from "react"
import { divIcon } from "leaflet"
import { useMap } from "react-leaflet"

import type { Gateway, Manhole, NodeState } from "@/data/types"

export const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
export const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'

/** Keeps Leaflet in step with flex / sidebar resizes. */
export function MapSizer() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])
  return null
}

export function gatewayIcon(g: Gateway) {
  return divIcon({
    className: "",
    html: `<div class="va-gw">${g.id}</div>`,
    iconSize: [0, 0],
  })
}

/** Rough LoRa demodulation floor (dB SNR) per spreading factor. */
export const SNR_FLOOR: Record<number, number> = { 7: -7.5, 8: -10, 9: -12.5, 10: -15 }

/** Link margin above the demodulator floor. */
export function linkMargin(n: Pick<Manhole, "snr" | "spreadingFactor">) {
  return n.snr - (SNR_FLOOR[n.spreadingFactor] ?? -7.5)
}

export function marginState(margin: number): NodeState {
  return margin >= 10 ? "GREEN" : margin >= 5 ? "YELLOW" : "RED"
}
