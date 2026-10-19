import { useState } from "react"
import { RadioIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { audioStore, useAudioStore } from "../store"

const STATUS_DOT = {
  idle: "bg-muted-foreground/50",
  connecting: "bg-amber-500 animate-pulse",
  connected: "bg-emerald-500",
  error: "bg-red-500",
} as const

export function LiveMqttPopover() {
  const { live } = useAudioStore()
  const [url, setUrl] = useState(live.url)
  const [topic, setTopic] = useState(live.topic)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [rate, setRate] = useState(String(live.sampleRate))
  const active = live.status !== "idle"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="xs" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs">
          <span className={cn("size-1.5 rounded-full", STATUS_DOT[live.status])} />
          <RadioIcon className="size-3.5" />
          <span>Live MQTT</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 text-xs">
        <p className="text-muted-foreground">
          Subscribes to an MQTT broker over WebSocket (wss://…:8884/mqtt). Accepts JSON telemetry (safe_soil, ambient, critical_void, peak) or int16 PCM.
        </p>
        <div className="space-y-1">
          <Label htmlFor="mqtt-url" className="text-xs">Broker WebSocket URL</Label>
          <Input id="mqtt-url" value={url} onChange={(e) => setUrl(e.target.value)} className="h-7 font-mono text-xs" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="mqtt-user" className="text-xs">Username</Label>
            <Input id="mqtt-user" value={username} onChange={(e) => setUsername(e.target.value)} className="h-7 font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mqtt-pass" className="text-xs">Password</Label>
            <Input id="mqtt-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-7 font-mono text-xs" />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <div className="space-y-1">
            <Label htmlFor="mqtt-topic" className="text-xs">Topic</Label>
            <Input id="mqtt-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="h-7 font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mqtt-rate" className="text-xs">Sample rate</Label>
            <Input id="mqtt-rate" value={rate} onChange={(e) => setRate(e.target.value)} className="h-7 font-mono text-xs" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {live.status}
            {live.status === "connected" && ` · ${live.packets} pkts · ${(live.bytes / 1024).toFixed(0)} KB`}
          </span>
          {active ? (
            <Button size="xs" variant="outline" className="h-7" onClick={() => audioStore.stopLive()}>
              Disconnect
            </Button>
          ) : (
            <Button
              size="xs"
              className="h-7"
              onClick={() =>
                audioStore.startLive({ url, topic, username, password, sampleRate: Number(rate) || 16000 })
              }
            >
              Connect
            </Button>
          )}
        </div>
        {live.error && <p className="font-mono text-[10px] text-red-500">{live.error}</p>}
      </PopoverContent>
    </Popover>
  )
}
