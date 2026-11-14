import { ArrowDown, ArrowUp, Clock, Globe as GlobeIcon, HeartPulse, Power, Server as ServerIcon, ShieldCheck } from "lucide-react"

import { Globe } from "@/components/Globe"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { formatBytes, formatSpeed, type Traffic } from "@/lib/traffic"
import { formatDuration, type Server, type VpnState } from "@/lib/vpn"
import { cn } from "@/lib/utils"

const LABEL: Record<VpnState, string> = {
  disconnected: "Not protected",
  connecting: "Connecting",
  connected: "Protected",
  disconnecting: "Disconnecting",
}

type Props = {
  state: VpnState
  ip: string | null
  server: Server
  connectedFor: number | null // ms, null when not connected
  traffic: Traffic
  onToggle: () => void
}

export function Home({ state, ip, server, connectedFor, traffic, onToggle }: Props) {
  const on = state === "connected"
  const working = state === "connecting" || state === "disconnecting"
  const tone = on ? "emerald" : working ? "amber" : "rose"

  return (
    <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-8 lg:grid-cols-[1fr_340px] lg:gap-14 lg:px-12">
      {/* ── left: globe + status ─────────────────────────── */}
      <section className="flex flex-col items-center gap-6">
        <StatusPill tone={tone} text={LABEL[state]} />

        <div className="relative w-[min(23rem,46vh)]">
          {/* soft halo in the state colour */}
          <div
            className={cn(
              "pointer-events-none absolute inset-[12%] rounded-full blur-3xl transition-colors duration-1000",
              on ? "bg-emerald-400/20" : working ? "bg-amber-400/15" : "bg-indigo-400/10",
            )}
          />
          <Globe state={state} lat={server.lat} lng={server.lng} onClick={onToggle} disabled={working} />
          {on && (
            <span className="pointer-events-none absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-full animate-in rounded-md bg-background/80 px-2.5 py-1 text-xs font-medium whitespace-nowrap ring-1 ring-white/10 backdrop-blur duration-700 fade-in slide-in-from-bottom-1">
              {server.flag} {server.name}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="font-heading text-[1.75rem] leading-tight font-semibold tracking-tight">
            {on ? "You're safe" : working ? `${LABEL[state]}…` : "Not connected"}
          </p>
          <p className="text-sm text-muted-foreground">
            {on ? `Traffic is encrypted through ${server.name}` : "Your connection is not encrypted"}
          </p>
        </div>

        <button
          onClick={onToggle}
          disabled={working}
          className={cn(
            "inline-flex h-11 min-w-44 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition-all",
            "outline-none focus-visible:ring-4 focus-visible:ring-ring/40 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70",
            on
              ? "bg-white/[0.06] text-foreground ring-1 ring-white/10 hover:bg-white/[0.1]"
              : "bg-emerald-300 text-emerald-950 shadow-[0_8px_30px_-8px] shadow-emerald-400/60 hover:bg-emerald-200",
          )}
        >
          <Power className="size-4" strokeWidth={2.2} />
          {on ? "Disconnect" : working ? "Please wait…" : "Connect"}
        </button>

        {/* compact facts */}
        <div className="flex flex-wrap justify-center gap-2">
          <Chip>
            <span className="text-base leading-none">{server.flag}</span>
            {server.name}
          </Chip>
          <Chip>
            <GlobeIcon className="size-3.5 text-muted-foreground" />
            {ip ? <span className="font-mono tabular">{ip}</span> : <Skeleton className="h-3.5 w-24" />}
          </Chip>
          <Chip>
            <Clock className="size-3.5 text-muted-foreground" />
            <span className="font-mono tabular">{connectedFor === null ? "00:00:00" : formatDuration(connectedFor)}</span>
          </Chip>
        </div>
      </section>

      {/* ── right: details ────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Traffic</CardTitle>
            <CardDescription>{on ? "Live, through the tunnel" : "Connect to see live speed"}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Speed
              icon={<ArrowDown className="size-3.5" />}
              label="Download"
              color="text-sky-300"
              speed={on ? formatSpeed(traffic.down) : "—"}
              total={on ? formatBytes(traffic.rx) : ""}
            />
            <Speed
              icon={<ArrowUp className="size-3.5" />}
              label="Upload"
              color="text-violet-300"
              speed={on ? formatSpeed(traffic.up) : "—"}
              total={on ? formatBytes(traffic.tx) : ""}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tunnel</CardTitle>
            <CardDescription>How you're connected</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3.5 text-sm">
            <Row icon={<ShieldCheck className="size-4" />} label="Protocol">
              WireGuard
            </Row>
            <Separator />
            <Row icon={<ServerIcon className="size-4" />} label="Endpoint">
              <span className="font-mono">{server.ip}:51820</span>
            </Row>
            <Separator />
            <Row icon={<HeartPulse className="size-4" />} label="Handshake">
              <span className="font-mono tabular">
                {on && traffic.handshakeAge !== null ? `${traffic.handshakeAge}s ago` : "—"}
              </span>
            </Row>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function StatusPill({ tone, text }: { tone: "emerald" | "amber" | "rose"; text: string }) {
  const dot = { emerald: "bg-emerald-400", amber: "bg-amber-400", rose: "bg-rose-400" }[tone]
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-white/[0.06] backdrop-blur">
      <span className="relative flex size-2">
        <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", dot)} />
        <span className={cn("relative inline-flex size-2 rounded-full", dot)} />
      </span>
      {text}
    </span>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.03] px-4 text-sm ring-1 ring-white/[0.06] backdrop-blur">
      {children}
    </span>
  )
}

function Speed(props: { icon: React.ReactNode; label: string; color: string; speed: string; total: string }) {
  return (
    <div className="rounded-lg bg-white/[0.025] p-3.5 ring-1 ring-white/[0.05]">
      <p className={cn("flex items-center gap-1.5 text-xs font-medium", props.color)}>
        {props.icon}
        {props.label}
      </p>
      <p className="mt-2 font-mono text-lg font-semibold tabular">{props.speed}</p>
      <p className="text-xs text-muted-foreground tabular">{props.total ? `${props.total} total` : " "}</p>
    </div>
  )
}

export function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      {children}
    </div>
  )
}
