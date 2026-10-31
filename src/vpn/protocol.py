import struct

HEADER_SIZE = 4  # length prefix is 4 bytes


def recv_exact(sock, n):
    """Read Excatly n bytes. Return None if the other side closed"""
    buf = b""  # byte object
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf


def send_msg(sock, data):
    header = struct.pack("!I", len(data))
    sock.sendall(header + data)


def recv_msg(sock):
    header = recv_exact(sock, HEADER_SIZE)
    if header is None:
        return None
    (length,) = struct.unpack("!I", header)
    return recv_exact(sock, length)


def pipe(src, dst):
    """Copy bytes from src to dst until one side closes"""
    try:
        while True:
            data = src.recv(4096)
            if not data:
                break
            dst.sendall(data)
    except OSError:
        pass
    finally:
        src.close()
        dst.close()
