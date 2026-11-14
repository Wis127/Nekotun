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
});

// Login. The token stays in main.js — the page only sees the username.
contextBridge.exposeInMainWorld("auth", {
  login: (user, password, remember) => ipcRenderer.invoke("auth:login", user, password, remember),
  restore: () => ipcRenderer.invoke("auth:restore"),
  logout: () => ipcRenderer.invoke("auth:logout"),
  changePassword: (oldPw, newPw) => ipcRenderer.invoke("auth:change", oldPw, newPw),
});
