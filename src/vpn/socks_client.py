import getpass
import socket
import ssl
import struct
import threading

from vpn.protocol import pipe, recv_exact, recv_msg, send_msg

SERVER = ("127.0.0.1", 9000)  # VPN SERVER
LISTEN = ("127.0.0.1", 1080)  # where the browser connects

tls = ssl.create_default_context(cafile="cert.pem")
USERNAME = input("username: ")
PASSWORD = getpass.getpass("password: ")

OK_REPLY = b"\x05\x00\x00\x01" + bytes(6)  # SOCKS "success"
FAIL_REPLY = b"\x05\x01\x00\x01" + bytes(6)  # SOCKS "general failure"


def read(sock, n):
    """LIKE recv_exact , but raises instead of returning None"""
    data = recv_exact(sock, n)
    if data is None:
        raise ConnectionError("browser closed")
    return data


def connect_server():
    raw = socket.create_connection(SERVER, timeout=10)
    return tls.wrap_socket(raw, server_hostname="localhost")


def get_token(username, password):
    """Log in with the password once. Return a token , or None"""
    with connect_server() as s:
        send_msg(s, b"PASS")
        send_msg(s, username.encode())
        send_msg(s, password.encode())
        if recv_msg(s) != b"OK":
            return None
        return recv_msg(s)


def open_tunnel(target):
    s = connect_server()
    send_msg(s, b"TOKEN")
    send_msg(s, TOKEN)
    if recv_msg(s) != b"OK":
        s.close()
        raise ConnectionError("token rejected")
    send_msg(s, target.encode())
    if recv_msg(s) != b"OK":
        s.close()
        raise ConnectionError(f"server could not reach {target}")
        s.settimeout(None)
        return s


def socks_handshake(browser):
    """Talk SOCKS5 with the browser. Return 'host:port' it wants."""
    # 1. Greetings:version + list of login methods
    ver, nmethods = read(browser, 2)
    if ver != 5:
        raise ConnectionError("not SOCKS5")
    read(browser, nmethods)  # skip the method list
    browser.sendall(b"\x05\x00")  # version 5 , no password needed"

    # 2 . Request: version , command , reserved address type
    _, cmd, _, atyp = read(browser, 4)
    if cmd != 1:
        raise ConnectionError("only CONNECT is supported")
    if atyp == 1:  # IPV4: 4 bytes
        host = socket.inet_ntoa(read(browser, 4))
    elif atyp == 3:  # domain:1 length byte + name
        length = read(browser, 1)[0]
        host = read(browser, length).decode()
    elif atyp == 4:
        host = socket.inet_ntop(socket.AF_INET6, read(browser, 16))
    else:
        raise ConnectionError("unknown address type")
    (port,) = struct.unpack("!H", read(browser, 2))
    return f"{host}:{port}"


def handle_browser(browser):
    try:
        target = socks_handshake(browser)
        tunnel = open_tunnel(target)
    except (OSError, ValueError) as e:
        print("failed", e)
        try:
            browser.sendall(FAIL_REPLY)
        except OSError:
            pass
        browser.close()
        return

    browser.sendall(OK_REPLY)
    print("->", target)
    threading.Thread(target=pipe, args=(tunnel, browser), daemon=True).start()
    pipe(browser, tunnel)


TOKEN = get_token(USERNAME, PASSWORD)
if TOKEN is None:
    print("login failed")
    raise SystemExit(1)
del PASSWORD
print("logged in!")


with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind(LISTEN)
    listener.listen(20)
    print(f"SOCKS5 proxy on {LISTEN[0]}:{LISTEN[1]}")
    while True:
        browser, _ = listener.accept()
        threading.Thread(target=handle_browser, args=(browser,), daemon=True).start()


# Why it happens

# At the bottom you run del PASSWORD after logging in. Ruff checks function bodies as if they run after the whole file, and by then PASSWORD is gone. So every function that reads PASSWORD gets the warning.

# It would also fail when you run it. You have two open_tunnel functions, and Python keeps the last one. That's the old one that logs in with PASSWORD. So:

# login → del PASSWORD → browser connects → open_tunnel() reads PASSWORD → NameError

# NameError isn't caught by except (OSError, ValueError), so that thread dies
