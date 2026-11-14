import { useEffect, useState } from "react"

// Saved in the browser storage of the app, so they survive restarts
export type Settings = {
  autoConnect: boolean // connect when the app opens
  notifications: boolean // show pop-up messages
  refreshSeconds: "1" | "3" | "5" // how often to check the status
}

const DEFAULTS: Settings = { autoConnect: false, notifications: true, refreshSeconds: "1" }
const KEY = "nekotun.settings"

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }
  } catch {
    return DEFAULTS
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      /* storage blocked: settings just won't be remembered */
    }
  }, [settings])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  return { settings, update }
}
