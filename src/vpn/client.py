import socket
from protocol import send_msg , recv_msg

with socket.create_connection(("127.0.0.1", 9000)) as s:
    for text in ["hi", "how are you", "bye"]:
        send_msg(s, text.encode())   # 3 sends, no pause

    for _ in range(3):
            data = recv_msg(s)
            if data is None:
                print("server closed the connection")
                break
            print(data.decode())
