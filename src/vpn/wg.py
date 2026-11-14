import base64
import ipaddress
import json
import re
import socket
import subprocess
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)

WG_EXE = r"C:\Program Files\WireGuard\wireguard.exe"


class WgError(Exception):
    pass


def run(cmd):
    """Run a command , raise WgError if it fails."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except FileNotFoundError:
        raise WgError(f"program not found: {cmd[0]} (is WireGuard installed?)") from None
    if result.returncode != 0:
        raise WgError(
            result.stderr.strip()
            or result.stdout.strip()
            or f"exit {result.returncode}"
        )
    return result.stdout


def connect(conf_path):
    """Start the tunnel. Tunnel name = file name (client.conf -> client)."""
    path = Path(conf_path).resolve()
    if not path.exists():
        raise WgError(f"config not found: {path}")
    run([WG_EXE, "/installtunnelservice", str(path)])


def disconnect(name):
    run([WG_EXE, "/uninstalltunnelservice", name])


def status(name):
    """Return True if the tunnel service is running."""
    result = subprocess.run(
        ["sc", "query", f"WireGuardTunnel${name}"], capture_output=True, text=True, check=False
    )
    return "RUNNING" in result.stdout


WG_CLI = r"C:\Program Files\WireGuard\wg.exe"


def stats(name):
    """Bytes received/sent and last handshake time, or None if the tunnel is down.

    Uses 'wg show <name> transfer' (not 'dump', which would print the private key).
    """
    if not status(name):
        return None
    transfer = run([WG_CLI, "show", name, "transfer"]).split()
    handshake = run([WG_CLI, "show", name, "latest-handshakes"]).split()
    # each line: <peer public key> <numbers...>  — we have one peer (the server)
    return {
        "rx": int(transfer[1]) if len(transfer) >= 3 else 0,
        "tx": int(transfer[2]) if len(transfer) >= 3 else 0,
        "handshake": int(handshake[1]) if len(handshake) >= 2 else 0,
    }


# --- split tunneling ---------------------------------------------------------
SPLIT_MODES = ("all", "include", "exclude")
MAX_ROUTES = 100
HOSTNAME = re.compile(r"^(?=.{1,253}$)([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$")


def parse_route(text):
    """'1.2.3.4', '10.0.0.0/8' or 'example.com' -> list of IPv4 networks."""
    text = text.strip()
    try:
        net = ipaddress.ip_network(text, strict=False)
    except ValueError:
        if not HOSTNAME.match(text):
            raise WgError(f"not an IP, network or domain: {text!r}")
        try:
            infos = socket.getaddrinfo(text, None, socket.AF_INET)
        except OSError:
            raise WgError(f"could not look up {text}")
        return sorted({ipaddress.ip_network(i[4][0]) for i in infos})
    if net.version != 4:
        raise WgError(f"only IPv4 is supported for now: {text}")
    return [net]


def allowed_ips_for(mode, routes):
    """Turn a split-tunnel choice into the AllowedIPs list WireGuard needs."""
    if mode not in SPLIT_MODES:
        raise WgError(f"mode must be one of {SPLIT_MODES}")
    if len(routes) > MAX_ROUTES + 10 * MAX_APP_IPS:
        raise WgError("too many routes")
    nets = [n for r in routes for n in parse_route(r)]

    if mode == "all":
        return ["0.0.0.0/0"]
    if not nets:
        raise WgError("add at least one IP, network or domain")
    if mode == "include":
        return [str(n) for n in ipaddress.collapse_addresses(nets)]

    # exclude: start with "everything" and cut the listed networks out
    remaining = [ipaddress.ip_network("0.0.0.0/0")]
    for ex in ipaddress.collapse_addresses(nets):
        nxt = []
        for n in remaining:
            if ex.subnet_of(n):
                nxt.extend(n.address_exclude(ex))
            elif not n.subnet_of(ex):
                nxt.append(n)  # no overlap: keep it
        remaining = nxt
    return [str(n) for n in ipaddress.collapse_addresses(remaining)]


def split_file(conf_path):
    return Path(conf_path).with_suffix(".split.json")


# --- apps: learn which servers a program talks to ----------------------------
APP_NAME = re.compile(r"^[A-Za-z0-9 ._-]{1,64}$")
MAX_APP_IPS = 300

# PowerShell: every open TCP connection -> {app, ip}
_CONNECTIONS_PS = (
    "$names=@{}; Get-Process | ForEach-Object { $names[$_.Id]=$_.ProcessName }; "
    "Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue | "
    "ForEach-Object { [pscustomobject]@{app=$names[[int]$_.OwningProcess]; ip=$_.RemoteAddress} } | "
    "ConvertTo-Json -Compress"
)


def app_connections():
    """{app name: set of public IPv4 addresses it is connected to right now}"""
    out = run(["powershell", "-NoProfile", "-NonInteractive", "-Command", _CONNECTIONS_PS]).strip()
    rows = json.loads(out) if out else []
    if isinstance(rows, dict):  # PowerShell returns one object, not a list, for 1 row
        rows = [rows]
    apps = {}
    for row in rows:
        name, ip = row.get("app"), row.get("ip")
        if not name or not ip:
            continue
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            continue
        if addr.version == 4 and addr.is_global:  # skip local/LAN/IPv6
            apps.setdefault(name, set()).add(str(addr))
    return apps


def list_apps():
    """Running apps that have internet connections, busiest first."""
    apps = app_connections()
    return sorted(
        ({"name": n, "ips": len(ips)} for n, ips in apps.items()),
        key=lambda a: (-a["ips"], a["name"].lower()),
    )


def _endpoint_ip(text):
    m = re.search(r"^Endpoint\s*=\s*([^:\s]+)", text, flags=re.MULTILINE)
    return m.group(1) if m else None


def get_split(conf_path):
    try:
        data = json.loads(split_file(conf_path).read_text())
    except (OSError, ValueError):
        data = {}
    return {
        "mode": data.get("mode", "all"),
        "routes": data.get("routes", []),
        "apps": data.get("apps", {}),  # {app name: [learned IPs]}
    }


def set_split(conf_path, mode, routes, apps=()):
    """Rewrite AllowedIPs in the client config. Keys and everything else stay.

    apps: program names. Their current connections are learned and added to the
    IPs learned before (apps use more servers over time).
    """
    path = Path(conf_path)
    if not path.exists():
        raise WgError(f"config not found: {path}")
    text = path.read_text()

    learned = {}
    if mode != "all" and apps:
        for name in apps:
            if not APP_NAME.match(name):
                raise WgError(f"bad app name: {name!r}")
        before = get_split(path)["apps"]
        now = app_connections()
        server = _endpoint_ip(text)  # never route the VPN server itself
        for name in apps:
            ips = set(before.get(name, [])) | now.get(name, set())
            ips.discard(server)
            if not ips:
                raise WgError(f"{name} has no connections yet. Open it, use it a bit, then apply again.")
            learned[name] = sorted(ips)[:MAX_APP_IPS]

    app_routes = [ip for ips in learned.values() for ip in ips]
    allowed = allowed_ips_for(mode, routes + app_routes)
    new_text, count = re.subn(
        r"^AllowedIPs\s*=.*$", f"AllowedIPs = {', '.join(allowed)}", text, flags=re.MULTILINE
    )
    if count != 1:
        raise WgError("could not find exactly one AllowedIPs line in the config")
    path.write_text(new_text)
    split_file(path).write_text(json.dumps({"mode": mode, "routes": routes, "apps": learned}))
    return allowed


def generate_keypair():
    """Return (private_key , public_key) as base64 strings , like "wg genkey" | wg pubkey"""
    private = X25519PrivateKey.generate()
    private_bytes = private.private_bytes(
        Encoding.Raw, PrivateFormat.Raw, NoEncryption()
    )
    public_bytes = private.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    return (
        base64.b64encode(private_bytes).decode(),
        base64.b64encode(public_bytes).decode(),
    )


WG_PORT = 51820
TUNNEL_NET = "10.8.0"
# Tunnel addresses : 10.8.0.1 = server, .2 , .3 ...... = clients


def client_config(
    client_private,
    server_public,
    server_ip,
    client_ip=f"{TUNNEL_NET}.2",
    dns="1.1.1.1",
    allowed_ips="0.0.0.0/0",
):
    """Config text for the Windows WireGuard App"""
    return f"""[Interface]
PrivateKey = {client_private}
Address = {client_ip}/32
DNS = {dns}

[Peer]
PublicKey = {server_public}
Endpoint = {server_ip}:{WG_PORT}
AllowedIPs = {allowed_ips}
PersistentKeepalive = 25
"""


def server_config(server_private, peers, out_iface="ens5"):
    """Config text for the Linux server. peers = [(public_key, tunnel_ip), ...]"""
    text = f"""[Interface]
Address = {TUNNEL_NET}.1/24
ListenPort = {WG_PORT}
PrivateKey = {server_private}
PostUp = iptables -t nat -A POSTROUTING -s {TUNNEL_NET}.0/24 -o {out_iface} -j MASQUERADE
PostDown = iptables -t nat -D POSTROUTING -s {TUNNEL_NET}.0/24 -o {out_iface} -j MASQUERADE
"""
    for public_key, tunnel_ip in peers:
        text += f"""
[Peer]
PublicKey = {public_key}
AllowedIPs = {tunnel_ip}/32
"""
    return text


def save_config(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    return path
