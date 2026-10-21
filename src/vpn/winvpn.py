"""Thin wrapper around the VPN client built into Windows (RAS).

Profiles are managed with the VpnClient PowerShell cmdlets (the same entries
you see in Settings -> Network -> VPN). Dialing and hanging up use rasdial.exe.
"""

from __future__ import annotations

import json
import subprocess

TUNNEL_TYPES = ("Ikev2", "Sstp", "L2tp", "Pptp", "Automatic")


class VpnError(RuntimeError):
    """Raised when Windows refuses a VPN operation."""


def _quote(value: str) -> str:
    # PowerShell single-quoted strings are literal; only ' needs escaping (doubled).
    # This stops a server name like "x; Remove-Item ..." from running as code.
    return "'" + value.replace("'", "''") + "'"


def _powershell(command: str) -> str:
    result = subprocess.run(
        [
            "powershell", "-NoProfile", "-NonInteractive", "-Command",
            "$ErrorActionPreference = 'Stop'; " + command,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise VpnError(result.stderr.strip() or f"PowerShell exited with {result.returncode}")
    return result.stdout


def add_profile(name: str, server: str, tunnel_type: str = "Ikev2", psk: str | None = None) -> None:
    """Create a VPN profile for the current user (no admin rights needed)."""
    if tunnel_type not in TUNNEL_TYPES:
        raise VpnError(f"Unknown tunnel type {tunnel_type!r}; choose from {', '.join(TUNNEL_TYPES)}")

    # IKEv2 only accepts username/password wrapped in EAP (EAP-MSCHAPv2 by default).
    auth = "Eap" if tunnel_type == "Ikev2" else "MSChapv2"
    command = (
        f"Add-VpnConnection -Name {_quote(name)} -ServerAddress {_quote(server)} "
        f"-TunnelType {tunnel_type} -AuthenticationMethod {auth} "
        f"-EncryptionLevel Required -RememberCredential -Force"
    )
    if tunnel_type == "L2tp":
        if not psk:
            raise VpnError("L2TP needs a pre-shared key (--psk)")
        command += f" -L2tpPsk {_quote(psk)}"
    _powershell(command)


def remove_profile(name: str) -> None:
    _powershell(f"Remove-VpnConnection -Name {_quote(name)} -Force")


def get_profile(name: str) -> dict:
    """Return the profile's settings and live status as a dict."""
    output = _powershell(
        f"Get-VpnConnection -Name {_quote(name)} | "
        "Select-Object Name, ServerAddress, TunnelType, AuthenticationMethod, ConnectionStatus | "
        "ConvertTo-Json"
    )
    return json.loads(output)


def connect(name: str, username: str, password: str) -> None:
    # Note: rasdial takes the password as an argument, so it is briefly visible
    # to other processes on this PC. Acceptable for learning; see README ideas.
    result = subprocess.run(["rasdial", name, username, password], capture_output=True, text=True)
    if result.returncode != 0:
        raise VpnError(explain_rasdial_error(result.returncode))


def disconnect(name: str) -> None:
    result = subprocess.run(["rasdial", name, "/disconnect"], capture_output=True, text=True)
    if result.returncode != 0:
        raise VpnError(explain_rasdial_error(result.returncode))


def explain_rasdial_error(code: int) -> str:
    """Turn a rasdial exit code into a message a normal user can act on."""
    # TODO(human): map the common RAS error codes to friendly messages.
    return f"Windows VPN error {code} (see 'rasdial error {code}' online)"
