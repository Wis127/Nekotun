import struct
import threading

from vpn.protocol import recv_msg, send_msg

# Envelope types
OPEN, OPEN_OK, OPEN_FAIL, DATA, CLOSE = range(1, 6)

HEAD = struct.Struct("!IB")  # Stream id(4 bytes) + type (1 btye)


class Tunnel:
    """One TLS sockket shared by many streams"""

    def __init__(self, sock):
        self.sock = sock
        self.write_lock = threading.Lock()

    def send(self, stream_id, kind, payload=b""):
        frame = HEAD.pack(stream_id, kind) + payload
        with self.write_lock:
            send_msg(self.sock, frame)

    def recv(self):
        """Return (stream id, kind , payload) or None if the tunnel closed"""
        frame = recv_msg(self.sock)
        if frame is None or len(frame) < HEAD.size:
            return None
        stream_id, kind = HEAD.unpack_from(frame)
        return stream_id, kind, frame[HEAD.size :]

    def pump(self, stream_id, src):
        """Read from normal socket , send it as DATA envelopes CLOSE at the end"""
        try:
            while True:
                data = src.recv(16384)
                if not data:
                    break
                self.send(stream_id, DATA, data)
        except OSError:
            pass
        finally:
            try:
                self.send(stream_id, CLOSE)
            except OSError:
                pass
