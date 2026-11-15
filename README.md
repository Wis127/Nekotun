<p align="center">
  <img src="app/assets/tray.png" width="96" alt="NekoTun logo">
</p>

<h1 align="center">NekoTun</h1>

<p align="center">
  A personal, self-hosted VPN: WireGuard + a Python engine + an Electron desktop app.
</p>

---

## Features

- **WireGuard tunnel** to your own cloud server (built and tested on AWS Lightsail)
- **Desktop app** (Electron + React + shadcn/ui) with a live globe, connection timer and traffic stats
- **Accounts:** TLS login server with scrypt password hashing, lockout after failed tries, and password change from the app
- **Split tunneling:** send everything, only some sites/IPs, or everything *except* some sites, IPs and apps
- **Ad & tracker blocking** through AdGuard Home on the server, or pick Cloudflare / Quad9 / Google DNS
- **System tray** with a status dot, plus **launch at startup**
- **CLI** for everything the app does

## How it works

```
Electron app ──runs──► vpn.exe (Python CLI) ──► wg.py ──► WireGuard
     │
     └──TLS :9000──► server.py (login, tokens) on your server

PC ══ WireGuard UDP :51820 ══► server ──► NAT ──► internet
```

Python owns the logic. The CLI and the desktop app are only interfaces that call it.

## Project layout

| Path | What it is |
|---|---|
| `src/vpn/wg.py` | WireGuard engine: keys, configs, connect, stats, split tunneling, DNS |
| `src/vpn/cli.py` | Command-line interface (`vpn wg-up`, `vpn wg-split`, …) |
| `src/vpn/server.py` | TLS login server that runs on the VPN server |
| `src/vpn/auth.py` | User accounts (scrypt hashes in `users.json`) |
| `src/vpn/protocol.py`, `mux.py`, `socks_client.py` | Message framing, stream multiplexing, optional SOCKS5 proxy |
| `app/` | Electron main process, tray, startup task, login client |
| `app/ui/` | React + Vite + Tailwind UI |

## Requirements

- Windows 10/11 (the client uses `wireguard.exe` and Windows services)
- [WireGuard for Windows](https://www.wireguard.com/install/)
- [uv](https://docs.astral.sh/uv/) (Python) and [Bun](https://bun.sh/)
- A Linux server with a public IP (Ubuntu 24.04 was used)

## Setup

### 1. Client (your PC)

```powershell
uv sync
uv run vpn wg-config --server <SERVER_IP>   # makes keys + configs in wg-configs/
```

This writes a client config and a server config. Private keys never leave the machine they were made on.

### 2. Server

1. Install WireGuard, enable IP forwarding (`net.ipv4.ip_forward=1`) and NAT.
2. Put the server config at `/etc/wireguard/wg0.conf` and start `wg-quick@wg0`.
3. Copy `server.py auth.py protocol.py mux.py __init__.py` to `/opt/nekotun/vpn/`, make a TLS cert for the server's IP, and run it as a systemd service with `VPN_HOST=0.0.0.0`.
4. Add a user: `python3 auth.py <username>`.
5. Open the firewall: **UDP 51820** (WireGuard) and **TCP 9000** (login).
6. Optional: install [AdGuard Home](https://github.com/AdguardTeam/AdGuardHome) listening on `10.8.0.1:53` for ad blocking.

Copy the server's **public** certificate to `app/certs/server-cert.pem` and set the server IP in `app/ui/src/lib/vpn.ts`.

### 3. Desktop app

```powershell
cd app
bun install
bun run start      # run as administrator so it can start the tunnel
```

## CLI

```powershell
uv run vpn wg-up            # connect    (admin)
uv run vpn wg-down          # disconnect (admin)
uv run vpn wg-status
uv run vpn wg-stats         # bytes sent/received, last handshake
uv run vpn wg-split --mode exclude --route=example.com --app=chrome.exe
uv run vpn wg-dns --set shield
```

Run `uv run vpn --help` for everything.

## Security notes

- Never commit `wg-configs/`, `users.json`, `key.pem` or SSH keys. They are in `.gitignore`.
- The app checks the server's TLS certificate. Don't turn that off.
- The app only runs an allow-list of commands, with checked arguments and no shell.
- Login tokens are kept in memory on the server (1 hour) and stored encrypted on the PC with Electron `safeStorage`.

## Roadmap

- Kill switch
- Per-user WireGuard keys, device list, phone QR codes
- Blocked-ads counter
- Installer

## License

[GPL-3.0](LICENSE). You can use, change and share this code, even commercially, but if you share a changed version you must publish its source under the same license and keep the credit.
