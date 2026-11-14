import { useEffect, useRef, useState } from "react"

export type Traffic = {
  rx: number // total bytes downloaded this session
  tx: number // total bytes uploaded
  down: number // bytes per second right now
  up: number
  handshake: number // unix seconds of the last handshake (0 = never)
  handshakeAge: number | null // seconds since then
}

const EMPTY: Traffic = { rx: 0, tx: 0, down: 0, up: 0, handshake: 0, handshakeAge: null }

// Ask the engine for the counters every second while connected.
// Speed = (bytes now - bytes before) / seconds between.
export function useTraffic(on: boolean) {
  const [traffic, setTraffic] = useState<Traffic>(EMPTY)
  const last = useRef<{ rx: number; tx: number; t: number } | null>(null)

  useEffect(() => {
    if (!on) {
      last.current = null
      return
    }
    let stopped = false
    async function tick() {
      const r = await window.vpn.stats()
      if (stopped || !r.ok) return
      let s: { rx: number; tx: number; handshake: number } | null = null
      try {
        s = JSON.parse(r.out)
      } catch {
        return
      }
      if (!s) return
      const t = performance.now()
      const prev = last.current
      const secs = prev ? (t - prev.t) / 1000 : 0
      setTraffic({
        ...s,
        handshakeAge: s.handshake ? Math.max(0, Math.round(Date.now() / 1000 - s.handshake)) : null,
        down: prev && secs > 0 ? Math.max(0, (s.rx - prev.rx) / secs) : 0,
        up: prev && secs > 0 ? Math.max(0, (s.tx - prev.tx) / secs) : 0,
      })
      last.current = { rx: s.rx, tx: s.tx, t }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [on])

  return on ? traffic : EMPTY
}

export function formatBytes(n: number) {
  const units = ["B", "KB", "MB", "GB", "TB"]
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatSpeed(bytesPerSec: number) {
  const bits = bytesPerSec * 8 // networks are measured in bits
  if (bits >= 1e6) return `${(bits / 1e6).toFixed(1)} Mbps`
  if (bits >= 1e3) return `${(bits / 1e3).toFixed(0)} Kbps`
  return `${bits.toFixed(0)} bps`
}
