export type VpnState = "disconnected" | "connecting" | "connected" | "disconnecting"

export type Server = { id: string; name: string; country: string; flag: string; ip: string; lat: number; lng: number }

// Only real servers go here. Add more when you create them on AWS.
export const SERVERS: Server[] = [
  { id: "mumbai", name: "Mumbai", country: "India", flag: "🇮🇳", ip: "16.4.103.77", lat: 19.076, lng: 72.8777 },
]

export type LogEntry = { time: Date; kind: "ok" | "error" | "info"; text: string }

export function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  const h = String(Math.floor(s / 3600)).padStart(2, "0")
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  const sec = String(s % 60).padStart(2, "0")
  return `${h}:${m}:${sec}`
}
