import { CircleAlert, CircleCheck, Info, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { LogEntry } from "@/lib/vpn"

const ICON = {
  ok: <CircleCheck className="size-4 text-emerald-400" />,
  error: <CircleAlert className="size-4 text-rose-400" />,
  info: <Info className="size-4 text-sky-400" />,
}

export function Activity({ log, onClear }: { log: LogEntry[]; onClear: () => void }) {
  return (
    <div className="mx-auto flex max-h-[calc(100vh-1.5rem)] min-h-0 w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8 lg:px-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="text-sm text-muted-foreground">What happened during this session.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClear} disabled={log.length === 0}>
          <Trash2 data-icon="inline-start" />
          Clear
        </Button>
      </div>

      <Card className="min-h-0 flex-1 py-0">
        <ScrollArea className="h-full">
          {log.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">Nothing yet. Connect to see events here.</p>
          ) : (
            <CardContent className="flex flex-col divide-y divide-border px-0">
              {log.map((e, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3 text-sm">
                  <span className="mt-0.5">{ICON[e.kind]}</span>
                  <span className="flex-1 break-words">{e.text}</span>
                  <span className="font-mono text-xs text-muted-foreground">{e.time.toLocaleTimeString()}</span>
                </div>
              ))}
            </CardContent>
          )}
        </ScrollArea>
      </Card>
    </div>
  )
}
