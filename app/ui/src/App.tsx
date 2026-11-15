import { useCallback, useEffect, useRef, useState } from "react"
import { Activity as ActivityIcon, Globe2, House, Loader2, Settings as SettingsIcon, Split as SplitIcon, UserRound } from "lucide-react"
import { toast } from "sonner"

import { Wordmark } from "@/components/Logo"
import { Toaster } from "@/components/ui/sonner"
import { useSettings } from "@/lib/settings"
import { useTraffic } from "@/lib/traffic"
import { SERVERS, type LogEntry, type VpnState } from "@/lib/vpn"
import { cn } from "@/lib/utils"
import { Activity } from "@/pages/Activity"
import { Home } from "@/pages/Home"
import { Login } from "@/pages/Login"
import { Profile } from "@/pages/Profile"
import { Servers } from "@/pages/Servers"
import { Settings } from "@/pages/Settings"
import { Split } from "@/pages/Split"

type Page = "home" | "servers" | "split" | "activity" | "settings" | "profile"

const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "Home", icon: <House /> },
  { id: "servers", label: "Servers", icon: <Globe2 /> },
  { id: "split", label: "Split tunnel", icon: <SplitIcon /> },
  { id: "activity", label: "Activity", icon: <ActivityIcon /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon /> },
  { id: "profile", label: "Profile", icon: <UserRound /> },
]

// Sign-in gate: checking → login screen → the app
export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    window.auth.restore().then(setSession)
  }, [])

  if (session === undefined)
    return (
      <div className="dark grid min-h-screen place-items-center bg-background text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  if (session === null) return <Login onLogin={setSession} />
  return <VpnApp session={session} onLogout={() => setSession(null)} onSession={setSession} />
}

function VpnApp({ session, onLogout, onSession }: { session: Session; onLogout: () => void; onSession: (s: Session) => void }) {
  const { settings, update } = useSettings()
  const [page, setPage] = useState<Page>("home")
  const [state, setState] = useState<VpnState>("disconnected")
  const [ip, setIp] = useState<string | null>(null)
  const [serverId, setServerId] = useState(SERVERS[0].id)
  const [log, setLog] = useState<LogEntry[]>([])
  const [dns, setDns] = useState<DnsChoice | "custom" | null>(null)
  const [since, setSince] = useState<number | null>(null) // when we connected
  const [now, setNow] = useState(Date.now())
  const busy = useRef(false) // true while connect/disconnect runs
  const autoTried = useRef(false)

  const server = SERVERS.find((s) => s.id === serverId) ?? SERVERS[0]
  const on = state === "connected"
  const working = state === "connecting" || state === "disconnecting"
  const traffic = useTraffic(on)

  const addLog = useCallback((kind: LogEntry["kind"], text: string) => {
    setLog((l) => [{ time: new Date(), kind, text }, ...l].slice(0, 100))
  }, [])

  const notify = useCallback(
    (kind: "success" | "error", title: string, description?: string) => {
      if (settings.notifications) toast[kind](title, { description })
    },
    [settings.notifications],
  )

  const loadIp = useCallback(async () => {
    setIp(null)
    const value = await window.vpn.ip()
    setIp(value)
    addLog("info", `Public IP is ${value}`)
  }, [addLog])

  // Ask the engine for the real state
  const refresh = useCallback(async () => {
    if (busy.current) return null
    const r = await window.vpn.status()
    const up = r.out.includes("UP")
    setState(up ? "connected" : "disconnected")
    setSince((s) => (up ? (s ?? Date.now()) : null))
    return up
  }, [])

  const toggle = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    const goingUp = !(await window.vpn.status()).out.includes("UP")
    setState(goingUp ? "connecting" : "disconnecting")

    const r = goingUp ? await window.vpn.up() : await window.vpn.down()
    await new Promise((ok) => setTimeout(ok, 1200)) // let the service start/stop
    busy.current = false

    if (r.ok) {
      addLog("ok", goingUp ? `Connected to ${server.name}` : "Disconnected")
      notify("success", goingUp ? "You're protected" : "Disconnected")
    } else {
      addLog("error", r.out || "Unknown error")
      notify("error", "Something went wrong", r.out)
    }
    await refresh()
    loadIp()
  }, [addLog, notify, refresh, loadIp, server.name])

  // First load: status, IP, and auto-connect if enabled
  useEffect(() => {
    ;(async () => {
      const up = await refresh()
      await loadIp()
      if (!autoTried.current && settings.autoConnect && up === false) {
        autoTried.current = true
        addLog("info", "Connect on launch is on")
        toggle()
      }
    })()
    // only once, on startup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Which DNS is set (shield = ad blocking)
  useEffect(() => {
    window.vpn.getDns().then((r) => {
      try {
        setDns(JSON.parse(r.out).choice)
      } catch {
        setDns("custom")
      }
    })
  }, [])

  // Tray: mirror the state, and let its menu use the same toggle as the button
  useEffect(() => {
    window.desktop.setTrayState(state, server.name)
  }, [state, server.name])
  const toggleRef = useRef(toggle)
  useEffect(() => {
    toggleRef.current = toggle
  }, [toggle])
  useEffect(() => window.desktop.onTrayToggle(() => toggleRef.current()), [])

  // Keep checking the status
  useEffect(() => {
    const t = setInterval(refresh, Number(settings.refreshSeconds) * 1000)
    return () => clearInterval(t)
  }, [refresh, settings.refreshSeconds])

  // Tick the session timer
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [on])

  async function logout() {
    if ((await window.vpn.status()).out.includes("UP")) await window.vpn.down()
    await window.auth.logout()
    onLogout()
  }

  return (
    <div className="dark relative flex h-screen gap-3 overflow-hidden bg-background p-3 text-foreground select-none">
      {/* background: one slow, soft glow whose colour follows the state */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={cn(
            "drift absolute -top-1/3 left-1/4 size-[60rem] rounded-full blur-[120px] transition-colors duration-1000",
            on ? "bg-emerald-500/[0.13]" : working ? "bg-amber-500/[0.10]" : "bg-indigo-500/[0.08]",
          )}
        />
      </div>

      {/* sidebar: a floating rounded panel. Icons only when the window is narrow */}
      <aside className="relative flex w-16 shrink-0 flex-col rounded-2xl bg-sidebar p-2 ring-1 ring-white/[0.06] backdrop-blur-xl md:w-60 md:p-3">
        <div className="mb-6 flex items-center justify-center gap-2.5 px-2 pt-3 md:justify-start">
          <Wordmark />
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active = page === n.id
            return (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                title={n.label}
                className={cn(
                  "relative flex h-10 items-center justify-center gap-3 rounded-md px-3 text-sm transition-colors md:justify-start",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-[1.05rem]",
                  active
                    ? "bg-white/[0.07] text-foreground ring-1 ring-white/[0.06]"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                {active && <span className="absolute left-0 h-4 w-[3px] rounded-r-full bg-emerald-300" />}
                {n.icon}
                <span className="hidden md:inline">{n.label}</span>
              </button>
            )
          })}
        </nav>

        {/* account + status */}
        <button
          onClick={() => setPage("profile")}
          title={session.user}
          className="mt-auto flex items-center justify-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/[0.04] md:justify-start md:p-2.5"
        >
          <span className="relative">
            <span className="grid size-9 place-items-center rounded-full bg-white/[0.08] text-xs font-semibold ring-1 ring-white/10">
              {session.user.slice(0, 2).toUpperCase()}
            </span>
            <span
              className={cn(
                "absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-background",
                on ? "bg-emerald-400" : working ? "bg-amber-400" : "bg-rose-400",
              )}
            />
          </span>
          <span className="hidden min-w-0 md:block">
            <span className="block truncate text-sm font-medium">{session.user}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {on ? `${server.flag} Secure · ${server.name}` : working ? "Working…" : "Not protected"}
            </span>
          </span>
        </button>
      </aside>

      {/* page area: a rounded panel too, so everything shares one shape */}
      <main className="relative flex min-w-0 flex-1 flex-col overflow-y-auto rounded-2xl ring-1 ring-white/[0.04]">
        <div key={page} className="page-in flex flex-1 flex-col [&>*]:my-auto">
          {page === "home" && (
            <Home
              state={state}
              ip={ip}
              server={server}
              connectedFor={on && since ? now - since : null}
              traffic={traffic}
            adblock={dns === "shield"}
              onToggle={toggle}
            />
          )}
          {page === "servers" && (
            <Servers
              selected={serverId}
              locked={on || working}
              onSelect={(s) => {
                setServerId(s.id)
                addLog("info", `Selected server ${s.name}`)
              }}
            />
          )}
          {page === "split" && <Split vpnOn={on} onApplied={(t) => addLog("info", t)} />}
          {page === "activity" && <Activity log={log} onClear={() => setLog([])} />}
          {page === "settings" && (
            <Settings
              settings={settings}
              update={update}
              dns={dns}
              vpnOn={on}
              onDnsChanged={(c) => {
                setDns(c)
                addLog("info", c === "shield" ? "Ad & tracker blocking on" : `DNS set to ${c}`)
              }}
            />
          )}
          {page === "profile" && <Profile session={session} vpnOn={on} onLogout={logout} onSession={onSession} />}
        </div>
      </main>

      <Toaster theme="dark" position="bottom-right" toastOptions={{ className: "!rounded-xl" }} />
    </div>
  )
}
