import socket
import threading
from protocol import send_msg, recv_msg


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

def handle_client(conn, addr):
    print("connected:", addr)
    add_client(addr)
    try:
        with conn:
            while True:
                data = recv_msg(conn)
                if data is None:          # b"" means the client left
                    break
                print(addr, "says:", data.decode())
                send_msg(conn,data) # SAY it back
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
