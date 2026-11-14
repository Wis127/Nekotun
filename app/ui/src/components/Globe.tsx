import { useEffect, useRef } from "react"
import createGlobe from "cobe"

import type { VpnState } from "@/lib/vpn"

type Props = {
  state: VpnState
  lat: number // server location
  lng: number
  onClick?: () => void
  disabled?: boolean
}

// cobe's angles that put [lat, lng] in the middle of the globe
function anglesFor(lat: number, lng: number) {
  return { phi: Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2), theta: (lat * Math.PI) / 180 }
}

const COLORS: Record<VpnState, [number, number, number]> = {
  connected: [0.35, 0.95, 0.65], // emerald
  connecting: [1, 0.75, 0.3], // amber
  disconnecting: [1, 0.75, 0.3],
  disconnected: [0.55, 0.6, 0.75],
}

/** A slowly turning Earth. When connected it turns to face the server. */
export function Globe({ state, lat, lng, onClick, disabled }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  // values the render loop reads every frame (refs, so the globe isn't rebuilt)
  const live = useRef({ state, lat, lng })
  useEffect(() => {
    live.current = { state, lat, lng }
  }, [state, lat, lng])

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let phi = 0
    let theta = 0.3
    let size = el.offsetWidth

    const globe = createGlobe(el, {
      devicePixelRatio: 2,
      width: size * 2,
      height: size * 2,
      phi,
      theta,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 5,
      mapBaseBrightness: 0.02,
      baseColor: [0.22, 0.24, 0.3],
      markerColor: COLORS.disconnected,
      glowColor: [0.18, 0.2, 0.28],
      markers: [],
      onRender: (s) => {
        const { state, lat, lng } = live.current
        const target = anglesFor(lat, lng)

        if (state === "connected") {
          // turn the short way round to the server, then hold with a gentle sway
          const diff = Math.atan2(Math.sin(target.phi - phi), Math.cos(target.phi - phi))
          phi += diff * 0.06
          theta += (target.theta * 0.8 - theta) * 0.06
        } else if (!reduceMotion) {
          phi += state === "disconnected" ? 0.0025 : 0.012 // spin faster while working
          theta += (0.3 - theta) * 0.04
        }

        if (el.offsetWidth !== size) {
          size = el.offsetWidth
          s.width = size * 2
          s.height = size * 2
        }
        s.phi = phi
        s.theta = theta
        s.markerColor = COLORS[state]
        s.markers = state === "disconnected" ? [] : [{ location: [lat, lng], size: state === "connected" ? 0.09 : 0.06 }]
      },
    })

    requestAnimationFrame(() => (el.style.opacity = "1")) // fade in once drawn
    return () => globe.destroy()
  }, [])

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={state === "connected" ? "Disconnect" : "Connect"}
      className="group relative aspect-square w-full cursor-pointer rounded-full outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:cursor-wait"
    >
      <canvas
        ref={canvas}
        className="size-full opacity-0 transition-[opacity,transform] duration-1000 group-hover:scale-[1.015] group-active:scale-[0.99]"
      />
    </button>
  )
}
