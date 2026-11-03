import argparse
from pathlib import Path

from vpn import wg

CONF_DIR = Path("wg-configs")


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


def main():
    parser = argparse.ArgumentParser(prog="vpn", description="Python WireGuard Vpn")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("wg-keys", help="make a key pair").set_defaults(func=cmd_keys)
    p = sub.add_parser("wg-config", help="make server + client configs")
    p.add_argument("--server", required=True, help="server public IP")
    p.add_argument("--force", action="store_true", help="replace existing configs")
    p.set_defaults(func=cmd_config)

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
