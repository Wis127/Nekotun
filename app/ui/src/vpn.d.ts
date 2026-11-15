type SplitMode = "all" | "include" | "exclude"
type DnsChoice = "shield" | "cloudflare" | "google" | "quad9"
// What preload.js gives the page (window.vpn)
type VpnResult = { ok: boolean; out: string }

interface Window {
  vpn: {
    up: () => Promise<VpnResult>
    down: () => Promise<VpnResult>
    status: () => Promise<VpnResult>
    ip: () => Promise<string>
    stats: () => Promise<VpnResult> // out = JSON {rx, tx, handshake} or null
    getSplit: () => Promise<VpnResult> // out = JSON {mode, routes}
    setSplit: (mode: SplitMode, routes: string[], apps: string[]) => Promise<VpnResult>
    apps: () => Promise<VpnResult> // out = JSON [{name, ips}]
    getDns: () => Promise<VpnResult> // out = JSON {choice, server}
    setDns: (choice: DnsChoice) => Promise<VpnResult>
  }
}

type Session = { user: string; expires: number; server: string }
type LoginResult = { ok: true; session: Session } | { ok: false; error: string }

interface Window {
  auth: {
    login: (user: string, password: string, remember: boolean) => Promise<LoginResult>
    restore: () => Promise<Session | null>
    logout: () => Promise<boolean>
    changePassword: (oldPassword: string, newPassword: string) => Promise<LoginResult>
  }
}

interface Window {
  desktop: {
    setTrayState: (state: string, server: string) => void
    onTrayToggle: (callback: () => void) => () => void
    getStartup: () => Promise<boolean>
    setStartup: (on: boolean) => Promise<{ ok: true; enabled: boolean } | { ok: false; error: string }>
  }
}
