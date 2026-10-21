"""Command line: vpn setup | connect | disconnect | status | remove."""

from __future__ import annotations

import argparse
import getpass
import sys

from vpn import winvpn

DEFAULT_NAME = "PyVPN"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="vpn", description="Manage a Windows built-in VPN connection.")
    parser.add_argument("--name", default=DEFAULT_NAME, help=f"VPN profile name (default: {DEFAULT_NAME})")
    sub = parser.add_subparsers(dest="command", required=True)

    setup = sub.add_parser("setup", help="create the VPN profile")
    setup.add_argument("--server", required=True, help="server IP address or hostname")
    setup.add_argument("--type", default="Ikev2", choices=winvpn.TUNNEL_TYPES, help="protocol (default: Ikev2)")
    setup.add_argument("--psk", action="store_true", help="prompt for an L2TP pre-shared key")

    connect = sub.add_parser("connect", help="connect (asks for the password)")
    connect.add_argument("--user", required=True, help="VPN username")

    sub.add_parser("disconnect", help="disconnect")
    sub.add_parser("status", help="show profile settings and connection state")
    sub.add_parser("remove", help="delete the VPN profile")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "setup":
            psk = getpass.getpass("L2TP pre-shared key: ") if args.psk else None
            winvpn.add_profile(args.name, args.server, args.type, psk)
            print(f"Created VPN profile '{args.name}' -> {args.server} ({args.type})")
        elif args.command == "connect":
            password = getpass.getpass(f"Password for {args.user}: ")
            print(f"Connecting to '{args.name}'...")
            winvpn.connect(args.name, args.user, password)
            print("Connected.")
        elif args.command == "disconnect":
            winvpn.disconnect(args.name)
            print("Disconnected.")
        elif args.command == "status":
            for key, value in winvpn.get_profile(args.name).items():
                print(f"{key:>22}: {value}")
        elif args.command == "remove":
            winvpn.remove_profile(args.name)
            print(f"Removed VPN profile '{args.name}'")
    except winvpn.VpnError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0
