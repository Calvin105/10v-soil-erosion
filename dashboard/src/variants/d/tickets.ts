import type { NetworkNode, PipeEdge } from "./network"

export type TicketSource = "sensor" | "citizen"
export type TicketStatus = "New" | "Assigned" | "Resolved"
export type CitizenCategory =
  | "Cracked road"
  | "Road sinking or dip"
  | "Water pooling"
  | "Strange sound"

export interface Ticket {
  id: string
  source: TicketSource
  title: string
  category?: CitizenCategory | "Sensor alarm"
  locationName: string
  lat: number
  lon: number
  createdAt: number // timestamp
  status: TicketStatus
  isSimulated?: boolean
  notes?: string
  vri?: number
  matchedSensor?: boolean
  matchedCitizen?: boolean
}

/**
 * Calculates Haversine distance between two lat/lon coordinates in meters.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calculates minimum distance in meters from a point (pLat, pLon)
 * to a straight-line pipe segment between (lat1, lon1) and (lat2, lon2).
 */
export function distanceToSegmentMeters(
  pLat: number,
  pLon: number,
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Approximate flat-earth projection for small distance calculation
  const cosLat = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180)
  const x1 = 0
  const y1 = 0
  const x2 = (lon2 - lon1) * cosLat * 111320
  const y2 = (lat2 - lat1) * 110540
  const px = (pLon - lon1) * cosLat * 111320
  const py = (pLat - lat1) * 110540

  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) {
    return Math.hypot(px, py)
  }

  let t = (px * dx + py * dy) / lenSq
  t = Math.max(0, Math.min(1, t))

  const projX = t * dx
  const projY = t * dy

  return Math.hypot(px - projX, py - projY)
}

/**
 * Samples points every ~15m along a pipe segment for smooth Leaflet ground-risk circles.
 */
export function samplePointsAlongPipe(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  intervalMeters = 15
): Array<[number, number]> {
  const dist = haversineDistanceMeters(fromLat, fromLon, toLat, toLon)
  const count = Math.max(2, Math.ceil(dist / intervalMeters))
  const points: Array<[number, number]> = []

  for (let i = 0; i <= count; i++) {
    const fraction = i / count
    const lat = fromLat + (toLat - fromLat) * fraction
    const lon = fromLon + (toLon - fromLon) * fraction
    points.push([lat, lon])
  }

  return points
}

/**
 * 4 seeded citizen tickets per prompt §4:
 * - 2 near the scripted simulated fault (MH-03 / pipe-03-04), which will show as "Matches sensor alert".
 * - 1 or 2 elsewhere (unmatched, low priority).
 * - All labeled "Simulated".
 */
export function getInitialTickets(): Ticket[] {
  const now = Date.now()

  return [
    {
      id: "T-0104",
      source: "citizen",
      category: "Strange sound",
      title: "Hollow echoing sound under pavement",
      locationName: "Jalan Elmina 1/7 (near Slope Toe Trunk)",
      lat: 3.1961,
      lon: 101.4972,
      createdAt: now - 18 * 60 * 1000, // 18m ago
      status: "New",
      isSimulated: true,
      notes: "Driver reported deep acoustic echo when heavy lorries drive over the culvert crossing.",
    },
    {
      id: "T-0102",
      source: "citizen",
      category: "Road sinking or dip",
      title: "Asphalt depression above stormwater line",
      locationName: "Jalan Elmina 1/2 (near MH-03 junction)",
      lat: 3.1969,
      lon: 101.4951,
      createdAt: now - 34 * 60 * 1000, // 34m ago
      status: "New",
      isSimulated: true,
      notes: "Visual dip forming on the road edge next to the stormwater manhole collar.",
    },
    {
      id: "T-0098",
      source: "citizen",
      category: "Cracked road",
      title: "Hairline pavement cracks on curb",
      locationName: "Persiaran Elmina West (near MH-02)",
      lat: 3.2015,
      lon: 101.4998,
      createdAt: now - 95 * 60 * 1000, // 1h 35m ago
      status: "Assigned",
      isSimulated: true,
      notes: "Minor surface weathering along the retaining wall sidewalk curb.",
    },
    {
      id: "T-0095",
      source: "citizen",
      category: "Water pooling",
      title: "Puddle formation after storm runoff",
      locationName: "Lake Retention Pond Connector (near MH-09)",
      lat: 3.1865,
      lon: 101.5122,
      createdAt: now - 180 * 60 * 1000, // 3h ago
      status: "Resolved",
      isSimulated: true,
      notes: "Surface drainage grates cleared of debris; runoff flowing smoothly into lake inlet.",
    },
  ]
}

/**
 * Cross-checks citizen reports and sensor tickets against suspect/critical pipes.
 * If a citizen report falls inside a ground risk zone or within ~100 m of a suspect pipe,
 * tag both tickets "Matches sensor alert" and move them to the top.
 */
export function evaluateTickets(
  tickets: Ticket[],
  pipes: PipeEdge[],
  nodes: Record<string, NetworkNode>
): Ticket[] {
  const problemPipes = pipes.filter((p) => p.status === "suspect" || p.status === "critical")

  const evaluated = tickets.map((ticket) => {
    let matchedSensor = false
    let matchedCitizen = false

    if (ticket.source === "citizen") {
      // Check if citizen ticket is within 100m of any suspect/critical pipe or abnormal manhole
      for (const pipe of problemPipes) {
        const from = nodes[pipe.fromId]
        const to = nodes[pipe.toId]
        if (from && to) {
          const dist = distanceToSegmentMeters(ticket.lat, ticket.lon, from.lat, from.lon, to.lat, to.lon)
          if (dist <= 100) {
            matchedSensor = true
            break
          }
        }
      }

      if (!matchedSensor) {
        // Also check distance to abnormal manholes directly
        for (const node of Object.values(nodes)) {
          if (node.state === "RED" || node.state === "YELLOW") {
            const dist = haversineDistanceMeters(ticket.lat, ticket.lon, node.lat, node.lon)
            if (dist <= 100) {
              matchedSensor = true
              break
            }
          }
        }
      }
    } else {
      // Sensor alert: check if there is any citizen report within 100m
      const nearbyCitizen = tickets.some(
        (t) =>
          t.source === "citizen" &&
          haversineDistanceMeters(ticket.lat, ticket.lon, t.lat, t.lon) <= 100
      )
      matchedCitizen = nearbyCitizen
    }

    return {
      ...ticket,
      matchedSensor,
      matchedCitizen,
    }
  })

  // Sort per prompt instructions:
  // Matched tickets moved to top!
  // Then by status: New > Assigned > Resolved
  // Then by recency (newest first)
  return evaluated.sort((a, b) => {
    const aMatched = a.matchedSensor || a.matchedCitizen
    const bMatched = b.matchedSensor || b.matchedCitizen

    if (aMatched && !bMatched) return -1
    if (!aMatched && bMatched) return 1

    const statusWeight: Record<TicketStatus, number> = {
      New: 3,
      Assigned: 2,
      Resolved: 1,
    }

    if (statusWeight[a.status] !== statusWeight[b.status]) {
      return statusWeight[b.status] - statusWeight[a.status]
    }

    return b.createdAt - a.createdAt
  })
}
