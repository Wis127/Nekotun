# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## How to work with this user

- The user is a programming beginner building this project **to learn**. Explain concepts simply, give a way to check things work, and review code they paste. When they ask for the code or ask you to build something, do it, and explain it briefly.
- Keep explanations **brief and simple**: short sentences, plain words, a small example or table where it helps.
- Run commands or edit files only when the user asks. Never run tests or scripts against their running server unless asked.
- Server (AWS) steps are done by the user: give exact commands and say clearly which machine each one runs on (PC PowerShell vs server SSH).

## Project: NekoTun

A personal VPN: a **WireGuard** tunnel to an AWS server, a **Python engine + login server**, and an **Electron desktop app**.

```
Electron app (app/) ──runs──► .venv\Scripts\vpn.exe wg-...   (Python CLI → wg.py → wireguard.exe / wg.exe)
       │
       └──TLS :9000──► server.py on AWS ──► auth.py ──► users.json      (login, tokens, change password)
PC ══WireGuard UDP :51820══► wg0 on AWS ──► NAT ──► internet
```

Rule: **Python owns the logic** (VPN control, auth, protocol). The CLI and the Electron app are only interfaces that call it.

## Layout

### Python (`src/vpn/`, package `vpn`, run with `uv`)
- `wg.py`: WireGuard engine. Key pairs (X25519), client/server config templates, `connect`/`disconnect`/`status` (`wireguard.exe /installtunnelservice`), `stats` (`wg.exe show <name> transfer`), split tunneling (`allowed_ips_for`, `set_split`, app IP learning via `Get-NetTCPConnection`). Raises `WgError`.
- `cli.py`: `argparse` CLI: `wg-keys`, `wg-config --server IP [--force]`, `wg-up`, `wg-down`, `wg-status`, `wg-stats`, `wg-split [--mode all|include|exclude --route=... --app=...]`, `wg-apps`. Configs live in `<project>/wg-configs/` (found from `__file__`).
- `server.py`: TLS login + proxy server (runs on AWS). Request kinds: `PASS` (password → token), `TOKEN`, `CHANGE` (change password, revokes other tokens), then `MUX` or a single `host:port` target. Lockout (5 fails / 60 s), tokens in memory (TTL 1 h), `ipaddress.is_global` check on targets. `HOST` from `VPN_HOST` env (default `127.0.0.1`).
- `auth.py`: scrypt password hashing, `users.json`. `python3 auth.py <name>` adds/updates a user.
- `protocol.py`: `[4-byte length][data]` framing (`send_msg`, `recv_msg`, `recv_exact`, `pipe`).
- `mux.py`: many streams over one tunnel (`[stream id][type][payload]`).
- `socks_client.py`: local SOCKS5 proxy (127.0.0.1:1080) that tunnels through `server.py` on AWS. `--mux` shares one connection.

### Electron app (`app/`, uses Bun)
- `main.js`: window + IPC. Runs only allow-listed `vpn.exe` commands via `execFile` (no shell) and validates every argument. Fetches the public IP.
- `preload.js`: the only bridge to the page (`window.vpn`, `window.auth`). `contextIsolation` on, `nodeIntegration` off.
- `auth.js`: login client for `server.py` (same protocol as `socks_client.py`). Token stays in the main process, saved encrypted with `safeStorage`.
- `certs/server-cert.pem`: the AWS server's **public** TLS cert (trusted via `ca:`, cert is for IP `16.4.103.77`).
- `ui/`: React + Vite + Tailwind v4 + shadcn/ui (base-ui style). Pages in `ui/src/pages/` (Home with `components/Globe.tsx` (cobe), Servers, Split, Activity, Settings, Profile, Login). Server list in `ui/src/lib/vpn.ts`.

## Commands

```powershell
uv sync                                   # Python deps / .venv (the app needs .venv\Scripts\vpn.exe)
uv run vpn --help
uv run vpn wg-config --server 16.4.103.77 # new keys + configs in wg-configs/ (refuses to overwrite without --force)
uv run vpn wg-up | wg-down | wg-status    # wg-up/wg-down need an ADMIN terminal
uvx ruff check src/                       # Python lint

cd app; bun install; bun run start        # build UI + open the app (run as admin to connect)
cd app; bun run dev                       # live-reload UI while designing
cd app\ui; bun run build                  # type-check + build UI only
```

`bun run start` must be run in `app\`, not `app\ui\`.

## Server (AWS Lightsail, Ubuntu 24.04, Mumbai, `16.4.103.77`)

- WireGuard: `/etc/wireguard/wg0.conf`, `wg-quick@wg0`, NAT on `ens5`, `net.ipv4.ip_forward=1`.
- Login server: files in `/opt/nekotun/vpn/` (`__init__.py server.py auth.py protocol.py mux.py`, plus `cert.pem`, `key.pem`, `users.json` made on the server). systemd unit `nekotun` (`VPN_HOST=0.0.0.0`, `PYTHONPATH=/opt/nekotun`, `python3 -m vpn.server`). Logs: `sudo journalctl -u nekotun -f`.
- Lightsail firewall: UDP 51820 and TCP 9000 (plus SSH 22).
- Deploying a change to `server.py`: `scp` it from the PC, `sudo mv` into `/opt/nekotun/vpn/`, `sudo systemctl restart nekotun` (this clears tokens).
- Server code uses only the Python standard library.

## Security rules

- Never commit secrets: `wg-configs/`, `users.json`, `key.pem`, SSH `.pem` keys (kept in `%USERPROFILE%\.ssh\`). Check `git status` before committing.
- Never disable TLS certificate or hostname checks.
- User input that reaches a command must be passed as an argument list (never a shell string) and validated (see `main.js` `split()` and `wg.parse_route`).
- Private keys never leave the machine they were made on.

## Ideas not done yet

SQLite for users/tokens, `vpn login` CLI so the app uses Python auth (then delete `auth.js`), per-user WireGuard keys + device list + phone QR, kill switch, DNS choice, tray icon, installer.
