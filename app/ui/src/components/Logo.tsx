import { cn } from "@/lib/utils"

// NekoTun mark: a flat, geometric cat head. One solid shape + two eye cut-outs,
// so it stays crisp at any size and works in one colour (like real brand marks).
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-6 text-emerald-300", className)}>
      <defs>
        <mask id="neko-eyes">
          <rect width="24" height="24" fill="white" />
          <rect x="7.6" y="12" width="2.4" height="3.6" rx="1.2" fill="black" />
          <rect x="14" y="12" width="2.4" height="3.6" rx="1.2" fill="black" />
        </mask>
      </defs>
      <path
        d="M4 3.5 L9.2 7.6 H14.8 L20 3.5 V13.5 A8 7.6 0 0 1 4 13.5 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        mask="url(#neko-eyes)"
      />
    </svg>
  )
}

// Logo + name, for the sidebar
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Logo className="size-6 shrink-0" />
      <span className="hidden font-heading text-[1.05rem] font-semibold tracking-[-0.02em] md:inline">
        Neko<span className="text-muted-foreground">Tun</span>
      </span>
    </span>
  )
}
