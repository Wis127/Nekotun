const { contextBridge, ipcRenderer } = require("electron");

// The ONLY things the page is allowed to do
contextBridge.exposeInMainWorld("vpn", {
  up: () => ipcRenderer.invoke("vpn", "wg-up"),
  down: () => ipcRenderer.invoke("vpn", "wg-down"),
  status: () => ipcRenderer.invoke("vpn", "wg-status"),
  ip: () => ipcRenderer.invoke("ip"),
  stats: () => ipcRenderer.invoke("vpn", "wg-stats"),
  getSplit: () => ipcRenderer.invoke("vpn:split"),
  setSplit: (mode, routes, apps) => ipcRenderer.invoke("vpn:split", mode, routes, apps),
  apps: () => ipcRenderer.invoke("vpn", "wg-apps"),
  getDns: () => ipcRenderer.invoke("vpn:dns"),
  setDns: (choice) => ipcRenderer.invoke("vpn:dns", choice),
});

// Login. The token stays in main.js — the page only sees the username.
contextBridge.exposeInMainWorld("auth", {
  login: (user, password, remember) => ipcRenderer.invoke("auth:login", user, password, remember),
  restore: () => ipcRenderer.invoke("auth:restore"),
  logout: () => ipcRenderer.invoke("auth:logout"),
  changePassword: (oldPw, newPw) => ipcRenderer.invoke("auth:change", oldPw, newPw),
});

// Tray + launch at startup
contextBridge.exposeInMainWorld("desktop", {
  setTrayState: (state, server) => ipcRenderer.send("tray:state", state, server),
  onTrayToggle: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("tray:toggle", listener);
    return () => ipcRenderer.removeListener("tray:toggle", listener);
  },
  getStartup: () => ipcRenderer.invoke("startup:get"),
  setStartup: (on) => ipcRenderer.invoke("startup:set", on),
});
