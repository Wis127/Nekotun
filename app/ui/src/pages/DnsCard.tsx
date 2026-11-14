import { useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const OPTIONS: { id: DnsChoice; title: string; text: string; ip: string }[] = [
  { id: "shield", title: "NekoTun Shield", text: "Blocks ads, trackers and malware sites", ip: "10.8.0.1" },
  { id: "cloudflare", title: "Cloudflare", text: "Fast and private", ip: "1.1.1.1" },
  { id: "quad9", title: "Quad9", text: "Blocks known malware", ip: "9.9.9.9" },
  { id: "google", title: "Google", text: "Reliable", ip: "8.8.8.8" },
]

type Props = {
  dns: DnsChoice | "custom" | null // null = still loading
  vpnOn: boolean
  onChanged: (choice: DnsChoice) => void
}

export function DnsCard({ dns, vpnOn, onChanged }: Props) {
  const [saving, setSaving] = useState<DnsChoice | null>(null)

  async function choose(choice: DnsChoice) {
    if (choice === dns || saving) return
    setSaving(choice)
    const r = await window.vpn.setDns(choice)
    setSaving(null)
    if (!r.ok) {
      toast.error("Couldn't change DNS", { description: r.out.replace(/^error:\s*/, "") })
      return
    }
    onChanged(choice)
    toast.success(choice === "shield" ? "Ad & tracker blocking on" : "DNS changed", {
      description: vpnOn ? "Reconnected with the new DNS." : "Used next time you connect.",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Ad & tracker blocking
          {dns === "shield" && (
            <Badge className="bg-emerald-400/15 text-emerald-300">
              <ShieldCheck data-icon="inline-start" />
              On
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="mt-1">
          Choose who answers "what's the address of this website?". Shield runs on your own server and refuses ad
          and tracker domains.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {dns === null ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : (
          <RadioGroup
            value={dns}
            onValueChange={(v) => choose(v as DnsChoice)}
            disabled={saving !== null}
            className="grid gap-2 sm:grid-cols-2"
          >
            {OPTIONS.map((o) => (
              <Label
                key={o.id}
                htmlFor={`dns-${o.id}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg p-3 font-normal ring-1 ring-white/[0.06] transition-all",
                  "hover:ring-white/15 has-data-checked:bg-emerald-400/[0.07] has-data-checked:ring-emerald-300/40",
                )}
              >
                <RadioGroupItem value={o.id} id={`dns-${o.id}`} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{o.title}</span>
                    {saving === o.id ? (
                      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{o.ip}</span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">{o.text}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        )}
        {dns === "custom" && (
          <p className="mt-3 text-xs text-muted-foreground">Your config uses a custom DNS server. Pick one above to replace it.</p>
        )}
      </CardContent>
    </Card>
  )
}
