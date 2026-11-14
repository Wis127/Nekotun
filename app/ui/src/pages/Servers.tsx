import { Check, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { SERVERS, type Server } from "@/lib/vpn"
import { cn } from "@/lib/utils"

type Props = { selected: string; locked: boolean; onSelect: (s: Server) => void }

export function Servers({ selected, locked, onSelect }: Props) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 w-full px-6 py-8 lg:px-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Servers</h1>
        <p className="text-sm text-muted-foreground">
          {locked ? "Disconnect to switch servers." : "Choose where your traffic comes out."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SERVERS.map((s) => {
          const active = s.id === selected
          return (
            <button
              key={s.id}
              disabled={locked}
              onClick={() => onSelect(s)}
              className="rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Card className={cn("transition-colors hover:bg-accent/40", active && "ring-2 ring-primary")}>
                <CardContent className="flex items-center gap-4">
                  <span className="text-3xl">{s.flag}</span>
                  <div className="flex-1">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.country} · <span className="font-mono">{s.ip}</span>
                    </p>
                  </div>
                  {active && (
                    <Badge>
                      <Check data-icon="inline-start" />
                      Selected
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </button>
          )
        })}

        <Card className="border-dashed bg-transparent">
          <CardContent className="flex items-center gap-4 text-muted-foreground">
            <Plus className="size-6" />
            <div>
              <p className="font-medium">Add a server</p>
              <p className="text-xs">Create another AWS instance, then add it to SERVERS in lib/vpn.ts</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
