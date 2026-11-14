import { useEffect, useState } from "react"
import { CircleAlert, KeyRound, Loader2, LogOut, Server, Timer, User } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { formatDuration } from "@/lib/vpn"
import { Row } from "@/pages/Home"

type Props = { session: Session; vpnOn: boolean; onLogout: () => void; onSession: (s: Session) => void }

export function Profile({ session, vpnOn, onLogout, onSession }: Props) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const left = Math.max(0, session.expires - now)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 w-full px-6 py-8 lg:px-10">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Profile</h1>

      <Card>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarFallback className="text-xl">{session.user.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-lg font-semibold">{session.user}</p>
            <p className="text-sm text-muted-foreground">Signed in to your NekoTun server</p>
          </div>
          <Badge variant={vpnOn ? "default" : "secondary"}>{vpnOn ? "VPN on" : "VPN off"}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Details of this sign-in</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <Row icon={<User className="size-4" />} label="Username">
            {session.user}
          </Row>
          <Separator />
          <Row icon={<Server className="size-4" />} label="Account server">
            <span className="font-mono">{session.server}</span>
          </Row>
          <Separator />
          <Row icon={<Timer className="size-4" />} label="Session expires in">
            <span className="font-mono">{formatDuration(left)}</span>
          </Row>
        </CardContent>
      </Card>

      <ChangePassword onDone={onSession} />

      <Card>
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
          <CardDescription>
            {vpnOn ? "The VPN will be disconnected first." : "You'll need your password to sign in again."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={onLogout}>
            <LogOut data-icon="inline-start" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function ChangePassword({ onDone }: { onDone: (s: Session) => void }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mismatch = confirm.length > 0 && next !== confirm
  const tooShort = next.length > 0 && next.length < 8
  const ready = current && next.length >= 8 && next === confirm && !busy

  function reset() {
    setCurrent("")
    setNext("")
    setConfirm("")
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    const r = await window.auth.changePassword(current, next)
    setBusy(false)
    if (!r.ok) {
      setError(r.error)
      setCurrent("")
      return
    }
    onDone(r.session)
    reset()
    setOpen(false)
    toast.success("Password changed", { description: "Other devices have been signed out." })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            Password
          </CardTitle>
          <CardDescription className="mt-1">Checked and stored securely on your server.</CardDescription>
        </div>
        {!open && (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Change
          </Button>
        )}
      </CardHeader>

      {open && (
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Field id="pw-current" label="Current password" value={current} onChange={setCurrent} auto="current-password" />
            <Field
              id="pw-new"
              label="New password"
              value={next}
              onChange={setNext}
              auto="new-password"
              hint={tooShort ? "At least 8 characters" : undefined}
            />
            <Field
              id="pw-confirm"
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              auto="new-password"
              hint={mismatch ? "Passwords don't match" : undefined}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  reset()
                  setOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!ready}>
                {busy && <Loader2 className="animate-spin" data-icon="inline-start" />}
                {busy ? "Saving…" : "Save password"}
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  )
}

function Field(props: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  auto: string
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        type="password"
        autoComplete={props.auto}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={props.hint ? true : undefined}
      />
      {props.hint && <p className="text-xs text-destructive">{props.hint}</p>}
    </div>
  )
}
