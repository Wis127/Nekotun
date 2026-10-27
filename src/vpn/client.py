import getpass
import socket
from protocol import send_msg , recv_msg

with socket.create_connection(("127.0.0.1", 9000)) as s:
    send_msg(s,input("username:").encode())
    send_msg(s,getpass.getpass("password:").encode())

    reply = recv_msg(s)
    if reply != b"OK":
        print("login failed")
        raise SystemExit(1)
    print("logged in!")

    while True:
        text = input("> ")
        if text == "quit":
            break
        send_msg(s,text.encode())
        data = recv_msg(s)
        if data is None:
            print("server closed the connection")
            break
        print("echo:",data.decode())
