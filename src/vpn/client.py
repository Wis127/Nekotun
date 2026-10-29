import getpass
import socket
import ssl
from protocol import send_msg , recv_msg

tls = ssl.create_default_context(cafile="cert.pem")


with socket.create_connection(("127.0.0.1", 9000)) as raw:
    with tls.wrap_socket(raw,server_hostname="localhost") as s:
        send_msg(s,input("username:").encode())
        send_msg(s,getpass.getpass("password:").encode())

        reply = recv_msg(s)
        if reply != b"OK":
            print("login failed")
            raise SystemExit(1)
        print("logged in!")

        send_msg(s,b"example.com:80")
        if recv_msg(s) != b"OK":
            print("connection failed")
            raise SystemExit(1)

        s.sendall(b"GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n")
        while True:
            chunk = s.recv(4096)
            if not chunk:
                break
            print(chunk.decode(errors="replace"), end="")
