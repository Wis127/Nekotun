import sys


def main() -> None:
    from vpn.cli import main as cli_main

    sys.exit(cli_main())
