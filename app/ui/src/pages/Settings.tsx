import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import type { Settings as S } from "@/lib/settings"
import { DnsCard } from "@/pages/DnsCard"

type Props = {
  settings: S
  update: <K extends keyof S>(key: K, value: S[K]) => void
  dns: DnsChoice | "custom" | null
  vpnOn: boolean
  onDnsChanged: (choice: DnsChoice) => void
}

export function Settings({ settings, update, dns, vpnOn, onDnsChanged }: Props) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 w-full px-6 py-8 lg:px-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Saved automatically.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>How the app behaves</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ToggleRow
            id="auto"
            title="Connect on launch"
            text="Turn the VPN on as soon as the app opens."
            checked={settings.autoConnect}
            onChange={(v) => update("autoConnect", v)}
          />
          <Separator />
          <ToggleRow
            id="notify"
            title="Notifications"
            text="Show a pop-up when you connect, disconnect or hit an error."
            checked={settings.notifications}
            onChange={(v) => update("notifications", v)}
          />
          <Separator />
          <StartupRow />
          <Separator />
          <ToggleRow
            id="tray"
            title="Keep running in the tray"
            text="Closing the window hides NekoTun next to the clock. Quit from the tray menu."
            checked
            disabled
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status checks</CardTitle>
          <CardDescription>How often the app asks WireGuard if the tunnel is up</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.refreshSeconds}
            onValueChange={(v) => update("refreshSeconds", v as S["refreshSeconds"])}
            className="flex flex-wrap gap-6"
          >
            {(["1", "3", "5"] as const).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <RadioGroupItem value={s} id={`r${s}`} />
                <Label htmlFor={`r${s}`}>Every {s}s</Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <DnsCard dns={dns} vpnOn={vpnOn} onChanged={onDnsChanged} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            More protection <Badge variant="secondary">Coming soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 opacity-60">
          <ToggleRow id="kill" title="Kill switch" text="Block all internet if the VPN drops." disabled />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-muted-foreground">App</span>
          <span>NekoTun 0.1.0</span>
          <span className="text-muted-foreground">Engine</span>
          <span>Python + WireGuard</span>
          <span className="text-muted-foreground">UI</span>
          <span>Electron + React + shadcn/ui</span>
        </CardContent>
      </Card>
    </div>
  )
}

type ToggleProps = {
  id: string
  title: string
  text: string
  checked?: boolean
  onChange?: (v: boolean) => void
  disabled?: boolean
}

function ToggleRow({ id, title, text, checked = false, onChange, disabled }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <Label htmlFor={id}>{title}</Label>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={(v) => onChange?.(v)} disabled={disabled} />
    </div>
  )
}

// Real "launch at startup" (a Task Scheduler task, so it starts with admin rights)
function StartupRow() {
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.desktop.getStartup().then(setOn)
  }, [])

  async function change(v: boolean) {
    setBusy(true)
    const r = await window.desktop.setStartup(v)
    setBusy(false)
    if (!r.ok) return toast.error("Couldn't change startup", { description: r.error })
    setOn(r.enabled)
    toast.success(r.enabled ? "NekoTun will start with Windows" : "Won't start with Windows")
  }

  return (
    <ToggleRow
      id="boot"
      title="Launch at startup"
      text="Start NekoTun in the tray when you sign in to Windows. Pairs well with Connect on launch."
      checked={!!on}
      onChange={change}
      disabled={on === null || busy}
    />
  )
}
