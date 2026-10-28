from asyncio.timeouts import Timeout
from operator import add
import socket
from this import d
import threading
from protocol import send_msg, recv_msg
from auth import check_login
import time
import ssl #

MAX_FAILS = 5
LOCK_SECONDS = 60

failed = {}
# username -> (fail_count,locked_until)
failed_lock = threading.Lock()

def is_locker(username):
    with failed_lock:
        count , until= failed.get(username,(0,0))
        return time.time() < until


def record_fail(username):
    with failed_lock:
        count, until = failed.get(username,(0,0))
        count += 1
        if count >= MAX_FAILS:
            until = time.time() + LOCK_SECONDS
            count = 0
    # fresh start after the lock ends
            print(f"{username} locked for {LOCK_SECONDS}s")
            failed[username]= (count,until)


def record_success(username):
    with failed_lock:
        failed.pop(username,None)




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

def login(conn):
    """Return the username if login succeeds , else None"""
    username=recv_msg(conn)
    password=recv_msg(conn)
    if username is None or password is None:
        return None
    username = username.decode()

    if is_locked(username):
        send_msg(conn,b"DENIED")
        return None

    if check_login(username,password.decode()):
        record_success(username)
        send_msg(conn,b"OK")
        conn.settimeout(None) #No timeout after login
        return username
    record_fail(username)
    time.sleep(1)
    send_msg(conn,b"DENIED")
    return None

def handle_client(raw_conn, addr):
    raw_conn.settimeout(10)
    try:
        conn = tls.wrap_socket(raw_conn,server_side=True)
    except (ssl.SSLError,OSError) as e:
        print(addr,"TLS failed",e)
        raw_conn.close()
        return
    add_client(addr)
    try:
        with conn:
            user = login(conn)
            if user is None:
                return
            print(addr,"logged in as",user)
            while True:
                data = recv_msg(conn)
                if data is None:          # b"" means the client left
                    break
                print(addr, "says:", data.decode())
                send_msg(conn,data) # SAY it back
    except TimeoutError:
        print(addr,"Timed Out")
    except  ConnectionResetError as e :
        print(e)
    finally:
        remove_client(addr)  # client closed suddenly (e.g. killed terminal)
        print("disconnected:", addr)
        conn.close()


while True: # threading process
        conn, addr = server.accept()  # accept a connection
        t = threading.Thread(target=handle_client, args=(conn, addr), daemon=True) # make a thread to handle the client
        t.start() # start the thread in which the request will process
        # forget...
