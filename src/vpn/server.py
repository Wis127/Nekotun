import ipaddress
import secrets
import socket
import ssl
import threading
import time

from vpn.auth import check_login
from vpn.protocol import pipe, recv_msg, send_msg

TOKEN_TTL = 3600  # tokens last 1 hour
tokens = {}  # tokens = username , expires at :)
tokens_lock = threading.Lock()


def new_toke(username):
    token = secrets.token_hex(32).encode()
    with tokens_lock:
        tokens[token] = (username, time.time() + TOKEN_TTL)
    return token


def check_token(token):
    """Retunr the username if the token is valid , else None"""
    with tokens_lock:
        entry = tokens.get(token)
        if entry is None:
            return None
        username, expires = entry
        if time.time() > expires:
            del tokens[token]  # expired token : throw it away
            return None
        return username


def open_target(target):
    """Connect to host:port . refuse private/local adresses"""
    host, _, port = target.rpartition(":")
    port = int(port)
    family, _, _, _, sockaddr = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)[
        0
    ]
    ip = ipaddress.ip_address(sockaddr[0])
    if not ip.is_global:
        raise PermissionError(f"blocked {ip}")
    remote = socket.create_connection((str(ip), port), timeout=10)
    remote.settimeout(None)
    return remote


MAX_FAILS = 5
LOCK_SECONDS = 60

failed = {}
# username -> (fail_count,locked_until)
failed_lock = threading.Lock()


def is_locked(username):
    with failed_lock:
        count, until = failed.get(username, (0, 0))
        return time.time() < until


def record_fail(username):
    with failed_lock:
        count, until = failed.get(username, (0, 0))
        count += 1
        if count >= MAX_FAILS:
            until = time.time() + LOCK_SECONDS
            count = 0  # fresh start after the lock ends
            print(f"{username} locked for {LOCK_SECONDS}s")
        failed[username] = (count, until)


def record_success(username):
    with failed_lock:
        failed.pop(username, None)


HOST = "127.0.0.1"  # For now only this computer.
PORT = 9000

clients = []
clients_lock = threading.Lock()


def add_client(addr):
    with clients_lock:
        clients.append(addr)
        print(f"+{addr} joined | online {len(clients)}")


def remove_client(addr):
    with clients_lock:
        clients.remove(addr)
        print(f"-{addr} left | online {len(clients)}")


server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)  # tcp
server.bind((HOST, PORT))


server.listen(5)  # server started
print("waiting...")

tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
tls.load_cert_chain("cert.pem", "key.pem")


def login(conn):
    """Return the username if login succeeds , else None"""
    kind = recv_msg(conn)

    if kind == b"TOKEN":
        token = recv_msg(conn)
        user = check_token(token) if token else None
        if user is None:
            send_msg(conn, b"DENIED")
            return None
        send_msg(conn, b"OK")
        conn.settimeout(None)
        return user

    if kind != b"PASS":
        return None

    username = recv_msg(conn)
    password = recv_msg(conn)
    if username is None or password is None:
        return None
    username = username.decode()

    if is_locked(username):
        send_msg(conn, b"DENIED")
        return None

    if check_login(username, password.decode()):
        record_success(username)
        send_msg(conn, b"OK")
        conn.settimeout(None)  # No timeout after login
        return username
    record_fail(username)
    time.sleep(1)
    send_msg(conn, b"DENIED")
    return None


def handle_client(raw_conn, addr):
    raw_conn.settimeout(10)
    try:
        conn = tls.wrap_socket(raw_conn, server_side=True)
    except (ssl.SSLError, OSError) as e:
        print(addr, "TLS failed", e)
        raw_conn.close()
        return
    add_client(addr)
    try:
        with conn:
            user = login(conn)
            if user is None:
                return
            print(addr, "logged in as", user)
            target = recv_msg(conn)
            if target is None:
                return
            target = target.decode()
            try:
                remote = open_target(target)
            except (OSError, ValueError) as e:
                print(addr, "Connection Failed", e)
                send_msg(conn, b"FAIL")
                return
            send_msg(conn, b"OK")
            print(addr, user, "->", target)

            threading.Thread(target=pipe, args=(remote, conn), daemon=True).start()
            pipe(conn, remote)
    except TimeoutError:
        print(addr, "Timed Out")
    except ConnectionResetError as e:
        print(e)
    finally:
        remove_client(addr)  # client closed suddenly (e.g. killed terminal)
        print("disconnected:", addr)
        conn.close()


while True:  # threading process
    conn, addr = server.accept()  # accept a connection
    t = threading.Thread(
        target=handle_client, args=(conn, addr), daemon=True
    )  # make a thread to handle the client
    t.start()  # start the thread in which the request will process
    # forget...
