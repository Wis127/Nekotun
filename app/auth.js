// Login against the Python server (server.py) — same protocol as socks_client.py:
//   TLS → [4-byte length][data] messages → "PASS", user, password → "OK" + token
const tls = require("tls");
const fs = require("fs");
const path = require("path");
const { app, safeStorage } = require("electron");

const SERVER = { host: "16.4.103.77", port: 9000 };
const CERT = path.join(__dirname, "certs", "server-cert.pem"); // the server's PUBLIC cert
const TOKEN_TTL_MS = 60 * 60 * 1000; // server.py: TOKEN_TTL = 3600
const SESSION_FILE = () => path.join(app.getPath("userData"), "session.bin");

// --- tiny version of protocol.py -------------------------------------------
function connect() {
  return new Promise((resolve, reject) => {
    let ca;
    try {
      ca = fs.readFileSync(CERT);
    } catch {
      return reject(new Error("Server certificate missing (app/certs/server-cert.pem)"));
    }
    // ca = trust ONLY our server's cert. Hostname/IP is still checked.
    const sock = tls.connect({ ...SERVER, ca, timeout: 10000 }, () => resolve(makeConn(sock)));
    sock.once("error", reject);
    sock.once("timeout", () => {
      sock.destroy();
      reject(new Error("Server did not answer (timeout)"));
    });
  });
}

function makeConn(sock) {
  let buf = Buffer.alloc(0);
  let waiting = null; // one pending recv at a time
  let closed = false;

  function tryDeliver() {
    if (!waiting) return;
    if (buf.length >= 4) {
      const n = buf.readUInt32BE(0);
      if (buf.length >= 4 + n) {
        const msg = buf.subarray(4, 4 + n);
        buf = buf.subarray(4 + n);
        const w = waiting;
        waiting = null;
        return w.resolve(msg);
      }
    }
    if (closed) {
      const w = waiting;
      waiting = null;
      w.resolve(null); // like recv_msg returning None
    }
  }

  sock.on("data", (d) => {
    buf = Buffer.concat([buf, d]);
    tryDeliver();
  });
  sock.on("close", () => {
    closed = true;
    tryDeliver();
  });
  sock.on("error", () => {});

  return {
    send(data) {
      const body = Buffer.from(data);
      const head = Buffer.alloc(4);
      head.writeUInt32BE(body.length);
      sock.write(Buffer.concat([head, body]));
    },
    recv() {
      return new Promise((resolve) => {
        waiting = { resolve };
        tryDeliver();
      });
    },
    close() {
      sock.destroy();
    },
  };
}

function friendly(err) {
  const code = err && err.code;
  if (code === "ECONNREFUSED") return "Server is not running (connection refused)";
  if (code === "ETIMEDOUT" || code === "EHOSTUNREACH") return "Can't reach the server";
  if (code && code.startsWith("ERR_TLS") || /certificate|altnames/i.test(err.message))
    return "Server certificate doesn't match — check app/certs/server-cert.pem";
  return err.message || String(err);
}

// --- saved session (token is encrypted by Windows, never given to the page) --
function saveSession(s) {
  if (!safeStorage.isEncryptionAvailable()) return;
  fs.writeFileSync(SESSION_FILE(), safeStorage.encryptString(JSON.stringify(s)));
}

function loadSession() {
  try {
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(SESSION_FILE())));
  } catch {
    return null;
  }
}

function clearSession() {
  fs.rmSync(SESSION_FILE(), { force: true });
}

let current = null; // { user, token, expires } — lives only in this process

function publicInfo(s) {
  return { user: s.user, expires: s.expires, server: `${SERVER.host}:${SERVER.port}` };
}

// --- what the page can ask for ----------------------------------------------
async function login(username, password, remember) {
  if (typeof username !== "string" || typeof password !== "string" || !username || !password)
    return { ok: false, error: "Enter a username and password" };
  let c;
  try {
    c = await connect();
    c.send("PASS");
    c.send(username);
    c.send(password);
    const reply = await c.recv();
    if (!reply || reply.toString() !== "OK")
      return { ok: false, error: "Wrong username or password (5 wrong tries locks it for 60s)" };
    const token = await c.recv();
    if (!token) return { ok: false, error: "Server closed the connection" };
    current = { user: username, token: token.toString(), expires: Date.now() + TOKEN_TTL_MS };
    if (remember) saveSession(current);
    else clearSession();
    return { ok: true, session: publicInfo(current) };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  } finally {
    if (c) c.close();
  }
}

// On startup: is a remembered token still accepted by the server?
async function restore() {
  const s = current || loadSession();
  if (!s || Date.now() > s.expires) {
    clearSession();
    return null;
  }
  let c;
  try {
    c = await connect();
    c.send("TOKEN");
    c.send(s.token);
    const reply = await c.recv();
    if (!reply || reply.toString() !== "OK") {
      clearSession();
      return null;
    }
    current = s;
    return publicInfo(s);
  } catch {
    return null; // server unreachable: ask to log in again
  } finally {
    if (c) c.close();
  }
}

// Change password: the server checks the old one (with lockout), then stores the new one.
async function changePassword(oldPassword, newPassword) {
  if (!current) return { ok: false, error: "Sign in first" };
  if (typeof oldPassword !== "string" || typeof newPassword !== "string" || !oldPassword)
    return { ok: false, error: "Enter your current password" };
  if (newPassword.length < 8) return { ok: false, error: "New password must be at least 8 characters" };
  let c;
  try {
    c = await connect();
    c.send("CHANGE");
    c.send(current.user);
    c.send(oldPassword);
    c.send(newPassword);
    const reply = await c.recv();
    if (!reply)
      return { ok: false, error: "The server doesn't support password changes yet. Upload the new server.py and restart nekotun." };
    const text = reply.toString();
    if (text === "WEAK") return { ok: false, error: "New password must be 8+ characters and different from the old one" };
    if (text !== "OK") return { ok: false, error: "Current password is wrong (5 wrong tries locks it for 60s)" };
    const token = await c.recv();
    if (!token) return { ok: false, error: "Server closed the connection" };
    const remembered = loadSession() !== null;
    current = { user: current.user, token: token.toString(), expires: Date.now() + TOKEN_TTL_MS };
    if (remembered) saveSession(current); // old saved token no longer works
    return { ok: true, session: publicInfo(current) };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  } finally {
    if (c) c.close();
  }
}

function logout() {
  current = null;
  clearSession();
  return true;
}

module.exports = { login, restore, logout, changePassword };
