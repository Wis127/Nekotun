import { useEffect, useState } from "react"
import { AppWindow, Check, ChevronDown, CircleAlert, Copy, Loader2, Plus, RefreshCw, X } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const MODES: { id: SplitMode; title: string; text: string }[] = [
  { id: "all", title: "Everything", text: "All traffic is encrypted" },
  { id: "include", title: "Only selected", text: "Just these use the VPN" },
  { id: "exclude", title: "All except selected", text: "These skip the VPN" },
]

const PRESETS = [
  { label: "Home network", value: "192.168.0.0/16" },
  { label: "10.x network", value: "10.0.0.0/8" },
]

const ROUTE = /^[A-Za-z0-9.\-/:]{1,253}$/

type Saved = { mode: SplitMode; routes: string[]; apps: Record<string, string[]> }
type RunningApp = { name: string; ips: number }

export function Split({ vpnOn, onApplied }: { vpnOn: boolean; onApplied: (text: string) => void }) {
  const [mode, setMode] = useState<SplitMode>("all")
  const [routes, setRoutes] = useState<string[]>([])
  const [apps, setApps] = useState<string[]>([])
  const [learned, setLearned] = useState<Record<string, string[]>>({})
  const [saved, setSaved] = useState<string | null>(null) // what's applied, as JSON
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState<RunningApp[] | null>(null)
  const [picking, setPicking] = useState(false)

  const key = (m: SplitMode, r: string[], a: string[]) =>
    JSON.stringify(m === "all" ? { m } : { m, r: [...r].sort(), a: [...a].sort() })

  useEffect(() => {
    window.vpn.getSplit().then((r) => {
      let s: Saved = { mode: "all", routes: [], apps: {} }
      try {
        s = { ...s, ...JSON.parse(r.out) }
      } catch {
        /* first run: defaults */
      }
      setMode(s.mode)
      setRoutes(s.routes)
      setApps(Object.keys(s.apps))
      setLearned(s.apps)
      setSaved(key(s.mode, s.routes, Object.keys(s.apps)))
    })
  }, [])

  async function loadRunning() {
    setPicking(true)
    setRunning(null)
    const r = await window.vpn.apps()
    try {
      setRunning(JSON.parse(r.out))
    } catch {
      setRunning([])
    }
  }

  function addRoute(value = draft) {
    const v = value.trim()
    if (!v) return
    if (!ROUTE.test(v)) return setError(`"${v}" doesn't look like an IP, network or domain`)
    if (!routes.includes(v)) setRoutes([...routes, v])
    setDraft("")
    setError(null)
  }

  async function apply() {
    setBusy(true)
    setError(null)
    const r = await window.vpn.setSplit(mode, mode === "all" ? [] : routes, mode === "all" ? [] : apps)
    setBusy(false)
    if (!r.ok) return setError(r.out.replace(/^error:\s*/, ""))
    try {
      setLearned((JSON.parse(r.out) as Saved).apps)
    } catch {
      /* keep old */
    }
    setSaved(key(mode, routes, apps))
    onApplied(mode === "all" ? "Split tunneling off" : `Split tunneling: ${mode}, ${routes.length} routes, ${apps.length} apps`)
    toast.success("Saved", { description: vpnOn ? "Reconnected with the new rules." : "Used next time you connect." })
  }

  const changed = saved !== null && saved !== key(mode, routes, apps)
  const empty = mode !== "all" && routes.length === 0 && apps.length === 0

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-8 lg:px-10">
      <header className="mb-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Split tunneling</h1>
        <p className="mt-1 text-sm text-muted-foreground">Decide what goes through the VPN.</p>
      </header>

      {saved === null ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <>
          {/* mode: three tiles */}
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as SplitMode)}
            className="grid gap-3 sm:grid-cols-3"
          >
            {MODES.map((m) => (
              <Label
                key={m.id}
                htmlFor={`mode-${m.id}`}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-1 rounded-xl bg-card p-4 font-normal ring-1 ring-white/[0.06] backdrop-blur-xl transition-all",
                  "hover:ring-white/15 has-data-checked:bg-emerald-400/[0.07] has-data-checked:ring-emerald-300/40",
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <span className="font-medium">{m.title}</span>
                  <RadioGroupItem value={m.id} id={`mode-${m.id}`} />
                </span>
                <span className="text-xs text-muted-foreground">{m.text}</span>
              </Label>
            ))}
          </RadioGroup>

          {mode !== "all" && (
            <>
              {/* apps */}
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>Apps</CardTitle>
                    <CardDescription className="mt-1">
                      NekoTun learns which servers an app uses while it's open.
                    </CardDescription>
                  </div>
                  <Button variant="secondary" size="sm" onClick={loadRunning}>
                    <Plus data-icon="inline-start" />
                    Add app
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {picking && (
                    <div className="rounded-lg bg-white/[0.025] p-2 ring-1 ring-white/[0.05]">
                      <div className="flex items-center justify-between px-2 pt-1 pb-2 text-xs text-muted-foreground">
                        <span>Running apps with internet connections</span>
                        <span className="flex gap-1">
                          <button className="rounded-md p-1 hover:bg-white/5" onClick={loadRunning} aria-label="Refresh">
                            <RefreshCw className="size-3.5" />
                          </button>
                          <button className="rounded-md p-1 hover:bg-white/5" onClick={() => setPicking(false)} aria-label="Close">
                            <X className="size-3.5" />
                          </button>
                        </span>
                      </div>
                      {running === null ? (
                        <div className="flex flex-col gap-1.5 p-1">
                          {[0, 1, 2].map((i) => (
                            <Skeleton key={i} className="h-9 w-full rounded-lg" />
                          ))}
                        </div>
                      ) : running.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-muted-foreground">No apps with connections found.</p>
                      ) : (
                        <div className="flex max-h-56 flex-col overflow-y-auto">
                          {running.map((a) => {
                            const added = apps.includes(a.name)
                            return (
                              <button
                                key={a.name}
                                disabled={added}
                                onClick={() => {
                                  setApps([...apps, a.name])
                                  setError(null)
                                }}
                                className="flex h-9 items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-white/[0.05] disabled:opacity-50"
                              >
                                <AppWindow className="size-4 text-muted-foreground" />
                                <span className="flex-1 truncate">{a.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {added ? "Added" : `${a.ips} server${a.ips === 1 ? "" : "s"}`}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {apps.length === 0 ? (
                    !picking && <p className="text-sm text-muted-foreground">No apps yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {apps.map((a) => (
                        <Pill key={a} onRemove={() => setApps(apps.filter((x) => x !== a))}>
                          <AppWindow className="size-3.5 text-muted-foreground" />
                          {a}
                          {learned[a] && <span className="text-muted-foreground">· {learned[a].length}</span>}
                        </Pill>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* websites & IPs */}
              <Card>
                <CardHeader>
                  <CardTitle>Websites & IPs</CardTitle>
                  <CardDescription className="mt-1">IP (1.2.3.4), network (10.0.0.0/8) or domain</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      addRoute()
                    }}
                  >
                    <Input
                      className="h-9"
                      placeholder="example.com"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <Button type="submit" variant="secondary" className="h-9" disabled={!draft.trim()}>
                      Add
                    </Button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    {routes.map((r) => (
                      <Pill key={r} onRemove={() => setRoutes(routes.filter((x) => x !== r))}>
                        <span className="font-mono">{r}</span>
                      </Pill>
                    ))}
                    {PRESETS.filter((p) => !routes.includes(p.value)).map((p) => (
                      <button
                        key={p.value}
                        onClick={() => addRoute(p.value)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground ring-1 ring-white/10 ring-dashed transition-colors hover:text-foreground hover:ring-white/20"
                      >
                        <Plus className="size-3" />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {error && (
            <Alert variant="destructive" className="rounded-xl">
              <CircleAlert />
              <AlertTitle>Couldn't apply</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* apply bar */}
          <div className="flex items-center justify-between gap-4 rounded-xl bg-card px-5 py-3.5 ring-1 ring-white/[0.06] backdrop-blur-xl">
            <p className="text-sm text-muted-foreground">
              {!changed ? "These rules are active." : vpnOn ? "Applying briefly reconnects the VPN." : "Not applied yet."}
            </p>
            <Button onClick={apply} disabled={!changed || busy || empty}>
              {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}
              {busy ? "Applying…" : "Apply"}
            </Button>
          </div>

          <ProxyHelp />
        </>
      )}
    </div>
  )
}

function Pill({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.05] pr-1 pl-3 text-sm ring-1 ring-white/[0.07]">
      {children}
      <button
        aria-label="Remove"
        onClick={onRemove}
        className="ml-0.5 grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </span>
  )
}

// Exact per-app control for apps that have a proxy setting
function ProxyHelp() {
  const [open, setOpen] = useState(false)
  const address = "127.0.0.1:1080"
  return (
    <div className="rounded-xl ring-1 ring-white/[0.05]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm"
      >
        <span>
          <span className="font-medium">Exact control with a proxy</span>
          <span className="ml-2 text-muted-foreground">for apps that support one</span>
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-white/[0.05] px-5 py-4 text-sm text-muted-foreground">
          <p>
            Browsers, Discord, Telegram and Steam can use a SOCKS5 proxy. Only that app goes through your server —
            nothing else changes.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Start the proxy: <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-foreground">uv run python -m vpn.socks_client</code>
            </li>
            <li>In the app's network/proxy settings choose SOCKS5 and enter:</li>
          </ol>
          <div className="flex items-center gap-2">
            <code className="rounded-md bg-white/[0.06] px-3 py-2 font-mono text-foreground">{address}</code>
            <Button
              variant="ghost"
              size="sm"
              className=""
              onClick={() => {
                navigator.clipboard.writeText(address)
                toast.success("Copied")
              }}
            >
              <Copy data-icon="inline-start" />
              Copy
            </Button>
          </div>
          <p className="text-xs">
            The proxy uses your login server (TCP 9000), not WireGuard, so it works even with the VPN off.
          </p>
        </div>
      )}
    </div>
  )
}
