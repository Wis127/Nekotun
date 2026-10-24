import socket

HOST = "127.0.0.1"  # For now only this computer.
PORT = 9000

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)  # tcp
server.bind((HOST, PORT))

server.listen(1)  # server started
print("waiting...")

conn, addr = server.accept()
print("connected:", addr)

data = conn.recv(2048)
print(data.decode())

conn.close()
