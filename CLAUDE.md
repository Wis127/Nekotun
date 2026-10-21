# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## How to work with this user

- The user is a programming beginner building this project **to learn**. Do not write the implementation for them: explain the concept, give the task, hints, and a way to check it works, then review the code they paste.
- Keep explanations **brief and simple**: short sentences, plain words, a small example or diagram where it helps. No long, detailed write-ups.
- Run commands or edit files only when the user asks.

## Project

A Windows VPN client app in Python. It does **not** implement a VPN protocol itself. It drives the VPN client built into Windows: the user supplies a server IP and a username/password, and the app creates, connects, disconnects and removes a VPN profile.

- Profiles: PowerShell `VpnClient` cmdlets (`Add-VpnConnection`, `Get-VpnConnection | ConvertTo-Json`, `Remove-VpnConnection`), run via `subprocess`.
- Dial / hang up: `rasdial <name> <user> <password>` and `rasdial <name> /disconnect`. The exit code is the RAS error code (e.g. 691, 800, 809, 868, 13801).
- Protocol: IKEv2 by default, which requires `-AuthenticationMethod Eap` (EAP-MSCHAPv2). SSTP/L2TP use `MSChapv2`, and L2TP also needs `-L2tpPsk`.
- User input put into PowerShell strings must be single-quoted with `'` doubled (prevents command injection).
- Actually connecting needs a real server (planned: strongSwan IKEv2 on a Linux VPS). Profiles can be created and removed without one.

## Layout

- `src/vpn/winvpn.py`: the engine (functions that call PowerShell/rasdial and raise `VpnError`).
- `src/vpn/cli.py`: the `argparse` interface (subcommands: setup, connect, disconnect, status, remove). A tkinter GUI is planned and should call the same engine functions.
- `src/vpn/__init__.py`: `main()` entry point (`vpn = "vpn:main"` in `pyproject.toml`).

`winvpn.py` and `cli.py` were first scaffolded by Claude as a reference. The user may delete them and rebuild them step by step (learning roadmap: manual PowerShell → subprocess → quoting → profiles → status/JSON → rasdial → error messages → CLI → GUI/keyring).

## Commands

Uses `uv` (Python 3.11). No tests or linter are set up yet.

```powershell
uv sync                                  # install / create .venv
uv run vpn setup --server 1.2.3.4        # --type Ikev2|Sstp|L2tp|Pptp|Automatic, --name (default PyVPN)
uv run vpn status
uv run vpn connect --user alice          # prompts for password
uv run vpn disconnect
uv run vpn remove
```

Use `192.0.2.x` (a reserved test IP that never connects) when testing profile creation without a server.
