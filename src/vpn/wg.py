import base64
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
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise WgError(
            result.stderr.strip()
            or result.stdout.strip()
            or f"exit {result.returncode}"
        )
    return result.stdout


def connect(conf_path):
    """Start the tunnel. Tunnel name = file (client.conf ->
    client0)."""
    path = Path(conf_path).resolve()
    if not path.exists():
        raise WgError(f"config not found: {path}")
    run([WG_EXE, "/installtunnelservice", str(path)])


def disconnect(name):
    run([WG_EXE, "/uninstalltunnelservice", name])


def status(name):
    """Return True if the tunnel service is running."""
    result = subprocess.run(
        ["sc", "query", f"WireGuardTunnel${name}"], capture_output=True, text=True
    )
    return "RUNNING" in result.stdout


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
PrivateKey= {client_private}
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


if __name__ == "__main__":
    # usage : uv run python -m vpn.wg 203.0.113.10
    import sys

    server_ip = sys.argv[1] if len(sys.argv) > 1 else "203.0.113.10"
    # placeholder until aws

    server_priv, server_pub = generate_keypair()
    client_priv, client_pub = generate_keypair()

    s = save_config(
        "wg-configs/wg0.conf",
        server_config(server_priv, [(client_pub, f"{TUNNEL_NET},2")]),
    )

    c = save_config(
        "wg-configs/client.conf", client_config(client_priv, server_pub, server_ip)
    )
    print("wrote", s)
    print("wrote", c)
