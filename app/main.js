const { app, BrowserWindow, ipcMain, net } = require("electron");
const { execFile } = require("child_process");
const path = require("path");
const auth = require("./auth");

const PROJECT = path.join(__dirname, ".."); // C:\codes\VPN
const DEV_URL = process.env.DEV_URL; // set by "bun run dev"

// The project's own vpn.exe (made by "uv sync"). Much faster than "uv run" for polling.
const VPN_EXE = path.join(PROJECT, ".venv", "Scripts", "vpn.exe");

// Run one of OUR commands with arguments, e.g. vpn(["wg-split", "--mode", "all"])
function vpn(args) {
  const commands = ["wg-up", "wg-down", "wg-status", "wg-stats", "wg-split", "wg-apps"];
  if (!Array.isArray(args) || !commands.includes(args[0])) throw new Error("not allowed");
  if (!args.every((a) => typeof a === "string" && a.length < 256)) throw new Error("bad argument");
  return new Promise((resolve) => {
    execFile(VPN_EXE, args, { cwd: PROJECT, windowsHide: true },
      (err, stdout, stderr) => resolve({ ok: !err, out: (stdout + stderr).trim() }));
  });
}

// wg-split: build the argument list here, so the page can only send a mode + routes
function split(mode, routes, apps = []) {
  if (mode === undefined) return vpn(["wg-split"]);
  if (!["all", "include", "exclude"].includes(mode)) throw new Error("bad mode");
  if (!Array.isArray(routes) || routes.length > 100) throw new Error("bad routes");
  const args = ["wg-split", "--mode", mode];
  for (const r of routes) {
    // only characters that can appear in an IP, network or domain
    if (typeof r !== "string" || !/^[A-Za-z0-9.\-\/:]{1,253}$/.test(r)) throw new Error(`bad route: ${r}`);
    args.push(`--route=${r}`); // "=" so a route can never be read as an option
  }
  if (!Array.isArray(apps) || apps.length > 20) throw new Error("bad apps");
  for (const a of apps) {
    if (typeof a !== "string" || !/^[A-Za-z0-9 ._-]{1,64}$/.test(a)) throw new Error(`bad app: ${a}`);
    args.push(`--app=${a}`);
  }
  return vpn(args);
}

// Which IP do websites see? (asked from here, so the page needs no internet access)
async function publicIp() {
  try {
    const r = await net.fetch("https://api.ipify.org", { signal: AbortSignal.timeout(5000) });
    return (await r.text()).trim();
  } catch {
    return "unknown";
  }
}

ipcMain.handle("vpn", (_event, command) => vpn([command]));
ipcMain.handle("vpn:split", (_event, mode, routes, apps) => split(mode, routes, apps));
ipcMain.handle("ip", () => publicIp());
ipcMain.handle("auth:login", (_e, user, password, remember) => auth.login(user, password, !!remember));
ipcMain.handle("auth:restore", () => auth.restore());
ipcMain.handle("auth:logout", () => auth.logout());
ipcMain.handle("auth:change", (_e, oldPw, newPw) => auth.changePassword(oldPw, newPw));

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 420,
    minHeight: 600,
    show: false, // show once ready, so there's no white flash
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, // page can't reach Node directly
      nodeIntegration: false,
    },
  });
  win.once("ready-to-show", () => win.show());
  if (DEV_URL) win.loadURL(DEV_URL); // live-reload while designing
  else win.loadFile(path.join(__dirname, "ui", "dist", "index.html"));
});

app.on("window-all-closed", () => app.quit());
