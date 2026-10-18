import type { Manhole } from "@/data/types"

import { slug } from "./risk"

export type SensorKind = "vibration" | "microphone"

export const SENSOR_LABEL: Record<SensorKind, string> = {
  vibration: "Vibration sensor",
  microphone: "Microphone",
}

export const paths = {
  root: "/b",
  lab: "/b/lab",
  bench: "/b/lab/rig-01",
  benchSensor: (k: SensorKind) => `/b/lab/rig-01/${k}`,
  field: "/b/field",
  zone: (zoneId: string) => `/b/field/${zoneId}`,
  manhole: (m: Pick<Manhole, "zoneId" | "id">) => `/b/field/${m.zoneId}/${m.id}`,
  manholeSensor: (m: Pick<Manhole, "zoneId" | "id">, k: SensorKind) =>
    `/b/field/${m.zoneId}/${m.id}/${k}`,
  network: "/b/network",
  gateway: (id: string) => `/b/network/gw/${id}`,
  battery: "/b/network/battery",
  risk: "/b/risk",
  riskGroup: (group: string) => `/b/risk/${slug(group)}`,
  missions: "/b/missions",
  mission: (id: string) => `/b/missions/${id}`,
}
