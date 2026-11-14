import argparse
import json
from pathlib import Path

from vpn import wg

CONF_DIR = Path(__file__).resolve().parents[2] / "wg-configs"  # C:\codes\VPN\wg-configs


def cmd_keys(args):
    priv, pub = wg.generate_keypair()
    print("private:", priv)
    print("public:", pub)


def cmd_config(args):
    server_file = CONF_DIR / "wg0.conf"
    client_file = CONF_DIR / f"{args.name}.conf"
    if not args.force and (server_file.exists() or client_file.exists()):
        raise wg.WgError("Configs already exist (use --force to replace them)")
    server_priv, server_pub = wg.generate_keypair()
    client_priv, client_pub = wg.generate_keypair()
    s = wg.save_config(
        CONF_DIR / "wg0.conf",
        wg.server_config(server_priv, [(client_pub, f"{wg.TUNNEL_NET}.2")]),
    )
    c = wg.save_config(
        CONF_DIR / f"{args.name}.conf",
        wg.client_config(client_priv, server_pub, args.server),
    )
    print("wrote", s, "(copy to the server)")
    print("wrote", c, "(for this PC)")


def cmd_up(args):
    wg.connect(CONF_DIR / f"{args.name}.conf")
    print("connected:", args.name)


def cmd_down(args):
    wg.disconnect(args.name)
    print("disconnected:", args.name)


def cmd_status(args):
    print(args.name, "is", "UP" if wg.status(args.name) else "DOWN")


def cmd_stats(args):
    """Print traffic counters as JSON (used by the app)."""
    print(json.dumps(wg.stats(args.name)))


def cmd_split(args):
    """Show or change split tunneling. Reconnects if the VPN is on."""
    conf = CONF_DIR / f"{args.name}.conf"
    if args.mode is None:
        print(json.dumps(wg.get_split(conf)))
        return
    routes = [r for r in (args.route or []) if r.strip()]
    if len(routes) > wg.MAX_ROUTES:
        raise wg.WgError(f"too many routes (max {wg.MAX_ROUTES})")
    apps = [a for a in (args.app or []) if a.strip()]
    allowed = wg.set_split(conf, args.mode, routes, apps)
    if wg.status(args.name):  # new AllowedIPs only apply after reconnecting
        wg.disconnect(args.name)
        wg.connect(conf)
    print(json.dumps({**wg.get_split(conf), "allowed": len(allowed)}))


def cmd_dns(args):
    """Show or change DNS (e.g. 'shield' = ad blocking). Reconnects if the VPN is on."""
    conf = CONF_DIR / f"{args.name}.conf"
    if args.set is None:
        print(json.dumps(wg.get_dns(conf)))
        return
    result = wg.set_dns(conf, args.set)
    if wg.status(args.name):  # the new DNS only applies after reconnecting
        wg.disconnect(args.name)
        wg.connect(conf)
    print(json.dumps(result))


def cmd_apps(args):
    """Running apps with internet connections (JSON, used by the app picker)."""
    print(json.dumps(wg.list_apps()))


def main():
    parser = argparse.ArgumentParser(prog="vpn", description="Python WireGuard Vpn")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("wg-keys", help="make a key pair").set_defaults(func=cmd_keys)
    p = sub.add_parser("wg-config", help="make server + client configs")
    p.add_argument("--server", required=True, help="server public IP")
    p.add_argument("--force", action="store_true", help="replace existing configs")
    p.set_defaults(func=cmd_config)

    p = sub.add_parser("wg-dns", help="show or set DNS / ad blocking")
    p.add_argument("--set", choices=list(wg.DNS_CHOICES), help="shield | cloudflare | google | quad9")
    p.set_defaults(func=cmd_dns)

    sub.add_parser("wg-apps", help="apps with connections (JSON)").set_defaults(func=cmd_apps)
    sub.add_parser("wg-stats", help="traffic counters (JSON)").set_defaults(func=cmd_stats)

    p = sub.add_parser("wg-split", help="show or set split tunneling")
    p.add_argument("--mode", choices=wg.SPLIT_MODES, help="all | include | exclude")
    p.add_argument("--route", action="append", help="IP, network or domain (repeat)")
    p.add_argument("--app", action="append", help="program name, e.g. Discord (repeat)")
    p.set_defaults(func=cmd_split)

    for name, func, text in [
        ("wg-up", cmd_up, "connect"),
        ("wg-down", cmd_down, "disconnect"),
        ("wg-status", cmd_status, "show status"),
    ]:
        sub.add_parser(name, help=text).set_defaults(func=func)

    for p in sub.choices.values():  # every command gets --name
        p.add_argument("--name", default="client", help="tunnel name")

    args = parser.parse_args()
    try:
        args.func(args)
    except wg.WgError as e:
        print("error:", e)
        raise SystemExit(1)
