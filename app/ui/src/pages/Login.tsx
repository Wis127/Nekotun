import { useState } from "react"
import { CircleAlert, Loader2, Lock, Shield } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [user, setUser] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = await window.auth.login(user.trim(), password, remember)
    setBusy(false)
    if (r.ok) onLogin(r.session)
    else {
      setError(r.error)
      setPassword("")
    }
  }

  return (
    <div className="dark relative grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-primary/10 blur-3xl" />

      <Card className="relative w-full max-w-sm">
        <form onSubmit={submit} className="contents">
          <CardHeader className="items-center text-center">
            <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-primary/10">
              <Shield className="size-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Sign in to NekoTun</CardTitle>
            <CardDescription>Use the account created on your VPN server</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Couldn't sign in</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="user">Username</Label>
              <Input
                id="user"
                autoFocus
                autoComplete="username"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pw">Password</Label>
              <Input
                id="pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v)} />
              <Label htmlFor="remember" className="font-normal">
                Keep me signed in (1 hour)
              </Label>
            </div>
          </CardContent>

          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full" disabled={busy || !user || !password}>
              {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Lock data-icon="inline-start" />}
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Encrypted with TLS · your password is never stored
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
