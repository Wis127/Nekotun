// System-tray icon: a coloured dot that follows the VPN state, plus a small menu.
const fs = require("fs");
const path = require("path");
const { Menu, Tray, nativeImage } = require("electron");

// Your own icon: put a square PNG here (64×64 or bigger, transparent background)
const CUSTOM_ICON = path.join(__dirname, "assets", "tray.png");

const COLORS = {
  connected: [52, 211, 153], // emerald
  connecting: [251, 191, 36], // amber
  disconnecting: [251, 191, 36],
  disconnected: [148, 163, 184], // slate
};

const LABELS = {
  connected: "Protected",
  connecting: "Connecting…",
  disconnecting: "Disconnecting…",
  disconnected: "Not protected",
};

// Draw a 32×32 ring-and-dot icon in memory (no image files needed).
function makeIcon([r, g, b]) {
  const size = 32;
  const buf = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      // outer ring (radius 13–15.5) + solid centre dot (radius 8), with soft edges
      const ring = Math.max(0, Math.min(1, 15.5 - d)) * Math.max(0, Math.min(1, d - 12));
      const dot = Math.max(0, Math.min(1, 8.5 - d));
      const a = Math.max(ring * 0.9, dot);
      const i = (y * size + x) * 4;
      buf[i] = b; // Windows bitmaps are BGRA
      buf[i + 1] = g;
      buf[i + 2] = r;
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: 2 });
}

// Your icon + a status dot in the bottom-right corner (with a dark outline so it shows on any icon)
function makeCustomIcon(base, [r, g, b]) {
  const size = 32;
  const buf = Buffer.from(base.toBitmap()); // BGRA pixels of the 32×32 icon
  const cx = 24.5, cy = 24.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const outline = Math.max(0, Math.min(1, 8 - d)); // dark ring, radius ~8
      const dot = Math.max(0, Math.min(1, 6 - d)); // coloured dot, radius ~6
      if (outline <= 0) continue;
      const i = (y * size + x) * 4;
      const [cb, cg, cr] = dot > 0 ? [b, g, r] : [24, 20, 18];
      const a = Math.max(dot, outline);
      // paint over the icon
      buf[i] = Math.round(cb * a + buf[i] * (1 - a));
      buf[i + 1] = Math.round(cg * a + buf[i + 1] * (1 - a));
      buf[i + 2] = Math.round(cr * a + buf[i + 2] * (1 - a));
      buf[i + 3] = Math.max(buf[i + 3], Math.round(a * 255));
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: 2 });
}

function loadCustom() {
  if (!fs.existsSync(CUSTOM_ICON)) return null;
  const img = nativeImage.createFromPath(CUSTOM_ICON);
  if (img.isEmpty()) return null; // not a valid image
  return img.resize({ width: 32, height: 32, quality: "best" });
}

const custom = loadCustom();
const icons = Object.fromEntries(
  Object.entries(COLORS).map(([k, v]) => [k, custom ? makeCustomIcon(custom, v) : makeIcon(v)]),
);

function createTray({ onShow, onToggle, onQuit }) {
  const tray = new Tray(icons.disconnected);
  let state = "disconnected";
  let server = "";

  function render() {
    const busy = state === "connecting" || state === "disconnecting";
    tray.setImage(icons[state] || icons.disconnected);
    tray.setToolTip(`NekoTun — ${LABELS[state]}${state === "connected" && server ? ` (${server})` : ""}`);
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: `${LABELS[state]}${state === "connected" && server ? ` · ${server}` : ""}`, enabled: false },
        { type: "separator" },
        { label: state === "connected" ? "Disconnect" : "Connect", enabled: !busy, click: onToggle },
        { label: "Open NekoTun", click: onShow },
        { type: "separator" },
        { label: "Quit", click: onQuit },
      ]),
    );
  }

  tray.on("click", onShow); // left-click opens the window
  render();

  return {
    update(newState, newServer) {
      if (!LABELS[newState]) return;
      if (newState === state && newServer === server) return;
      state = newState;
      server = typeof newServer === "string" ? newServer.slice(0, 40) : "";
      render();
    },
    destroy: () => tray.destroy(),
  };
}

module.exports = { createTray };
