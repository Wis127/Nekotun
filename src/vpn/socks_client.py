import argparse
import getpass
import socket
import ssl
import struct
import threading

from vpn import mux
from vpn.protocol import pipe, recv_exact, recv_msg, send_msg

parser = argparse.ArgumentParser(description="Local SOCKS5 proxy for the VPN")
parser.add_argument(
    "--mux", action="store_true", help="share one tunnel for all connections"
)
args = parser.parse_args()


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


def login_with_token():
    """Open a connection to the server and log in with the token"""
    s = connect_server()
    send_msg(s, b"TOKEN")
    send_msg(s, TOKEN)
    if recv_msg(s) != b"OK":
        s.close()
        raise ConnectionError("token rejected")
    return s


def open_tunnel(target):
    s = login_with_token()
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


mux_tunnel = None
mux_lock = threading.Lock()  # protects everything below
browsers = {}  # stream id  -> browser socket
pending = {}  # stream id -> [Event,ok?] waiting for OPEN_OK
next_id = 1


def close_browser(sid):
    with mux_lock:
        browser = browsers.pop(sid, None)
    if browser:
        browser.close()


def mux_reader(tunnel):
    """The single reader: route every envelope from the server by stream id"""
    global mux_tunnel
    try:
        while True:
            msg = tunnel.recv()
            if msg is None:
                break
            sid, kind, payload = msg
            if kind in (mux.OPEN_OK, mux.OPEN_FAIL):
                with mux_lock:
                    slot = pending.pop(sid, None)
                    browser = browsers.get(sid)
                if slot is None:
                    continue
                ok = kind == mux.OPEN_OK
                if ok and browser:
                    try:
                        browser.sendall(OK_REPLY)  # sent here , so its before any data
                    except OSError:
                        ok = False
                slot[1] = ok
                slot[0].set()  # wake up the waiting handle_mux
            elif kind == mux.DATA:
                with mux_lock:
                    browser = browsers.get(sid)
                if browser:
                    try:
                        browser.sendall(payload)
                    except OSError:
                        close_browser(sid)
            elif kind == mux.CLOSE:
                close_browser(sid)
    except OSError:
        pass
    finally:
        print("shared tunnel close")
        with mux_lock:
            if mux_tunnel is tunnel:
                mux_tunnel = None  # Next browser connection reconnects
            for slot in pending.values():
                slot[0].set()
            pending.clear()
            for browser in browsers.values():
                browser.close()
            browsers.clear()


def get_mux_tunnel():
    """return the shared tunnel, connecting it the first time"""
    global mux_tunnel
    with mux_lock:
        if mux_tunnel is None:
            s = login_with_token()
            send_msg(s, b"MUX")
            s.settimeout(None)
            mux_tunnel = mux.Tunnel(s)
            threading.Thread(target=mux_reader, args=(mux_tunnel,), daemon=True).start()
            print("shared tunnel opened")
        return mux_tunnel


def handle_mux(browser, target):
    global next_id
    tunnel = get_mux_tunnel()
    slot = [threading.Event(), False]
    with mux_lock:
        sid = next_id
        next_id += 1
        pending[sid] = slot
        browsers[sid] = browser
    tunnel.send(sid, mux.OPEN, target.encode())

    if not slot[0].wait(15) or not slot[1]:
        with mux_lock:
            pending.pop(sid, None)
            browsers.pop(sid, None)
        try:
            tunnel.send(sid, mux.CLOSE)
        except OSError:
            pass
        raise ConnectionError(f"server could not reach  {target}")

    print("->", target, f"(stream{sid})")
    tunnel.pump(sid, browser)  # browser -> tunnel, sends CLOSE at the end
    close_browser(sid)


def handle_browser(browser):
    try:
        target = socks_handshake(browser)
        if args.mux:
            handle_mux(browser, target)
            return
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
