import socket
import threading

HOST = "127.0.0.1"  # For now only this computer.
PORT = 9000

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)  # tcp
server.bind((HOST, PORT))

server.listen(5)  # server started
print("waiting...")

def handle_client(conn, addr):
    print("connected:", addr)
    with conn:
        while True:
            data = conn.recv(2048)
            if not data:          # b"" means the client left
                break
            print(addr, "says:", data.decode())
            conn.sendall(data)    # SAY it back
    print("disconnected:", addr)
    conn.close()


while True: # threading process
        conn, addr = server.accept()  # accept a connection
        t = threading.Thread(target=handle_client, args=(conn, addr), daemon=True) # make a thread to handle the client
        t.start() # start the thread in which the request will process
        # forget...
