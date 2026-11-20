// ============================================================
//  RÜNKIRAN YEREL AĞ SUNUCUSU
//  Radmin VPN, Hamachi ya da aynı Wi-Fi üzerinden arkadaşlarınla oynamak için.
//  Ek paket gerekmez, yalnızca Node.js (18+):
//
//      node server/server.js          (varsayılan port 8000)
//      node server/server.js 9000     (başka port)
//
//  Ne yapar:
//   - Oyun dosyalarını sunar (http://<adres>:8000)
//   - WebSocket (/ws) ile claude.ai'daki "oda" ve "veritabanı" özelliklerinin
//     yerel karşılığını sağlar: lobi, kuyruk, maç odaları, ortak lider tablosu.
//   - Skorlar server/veriler.json dosyasında saklanır.
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = Number(process.argv[2] || process.env.PORT || 8000);
const ROOT = path.resolve(__dirname, '..');
// Skorlar oyun klasörünün DIŞINDA, kullanıcının ana klasöründe tutulur:
// oyunun yeni sürümünü başka bir klasöre açsan da tablo silinmez.
//   Windows: C:\Users\<ad>\RunkiranVerileri\skorlar.json
const DATA_DIR = process.env.RUNKIRAN_DATA || path.join(os.homedir(), 'RunkiranVerileri');
const DATA_FILE = path.join(DATA_DIR, 'skorlar.json');
const BACKUP_FILE = DATA_FILE + '.yedek';
const OLD_FILE = path.join(__dirname, 'veriler.json'); // eski sürümlerin dosyası

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

// ---------------- Statik dosyalar ----------------
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || file.startsWith(__dirname)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Bulunamadı'); }
    // İnternet olmadan da çalışsın: Three.js'i CDN yerine projedeki kopyadan yükle
    if (p === '/index.html' && fs.existsSync(path.join(ROOT, 'vendor', 'three.module.js'))) {
      buf = Buffer.from(buf.toString('utf8').replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^"']+\/build\/three\.module\.js/, '/vendor/three.module.js'));
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});

// ---------------- Basit WebSocket (RFC 6455) ----------------
class Socket {
  constructor(sock) {
    this.sock = sock;
    this.buf = Buffer.alloc(0);
    this.alive = true;
    this.onmessage = null;
    this.onclose = null;
    sock.on('data', (d) => this._data(d));
    sock.on('close', () => this._closed());
    sock.on('error', () => this._closed());
  }
  _closed() {
    if (!this.alive) return;
    this.alive = false;
    this.onclose?.();
  }
  _data(d) {
    this.buf = Buffer.concat([this.buf, d]);
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const op = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) return this.close(); // 1 MB üstü mesaj kabul edilmez
      const need = off + (masked ? 4 : 0) + len;
      if (this.buf.length < need) return;
      let payload = this.buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) {
        const mask = this.buf.subarray(off, off + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      this.buf = this.buf.subarray(need);
      if (op === 0x1) this.onmessage?.(payload.toString('utf8'));
      else if (op === 0x8) return this.close();
      else if (op === 0x9) this._frame(0xa, payload);
    }
  }
  _frame(op, payload) {
    if (!this.alive) return;
    const len = payload.length;
    let head;
    if (len < 126) head = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    try { this.sock.write(Buffer.concat([head, payload])); } catch (_) { this._closed(); }
  }
  send(obj) { this._frame(0x1, Buffer.from(JSON.stringify(obj), 'utf8')); }
  ping() { this._frame(0x9, Buffer.alloc(0)); }
  close() {
    try { this._frame(0x8, Buffer.alloc(0)); this.sock.end(); } catch (_) { /* yok say */ }
    this._closed();
  }
}

// ---------------- Odalar ----------------
const clients = new Set();
const rooms = new Map(); // oda adı → Map(peer → { client, presence, updatedAt })
const LOBBY = '';

function roomPeers(name) {
  const r = rooms.get(name);
  if (!r) return [];
  return [...r.entries()].map(([peer, m]) => ({ peer, by: m.client.uid, presence: m.presence, updatedAt: m.updatedAt }));
}
function broadcastPeers(name) {
  const r = rooms.get(name);
  if (!r) return;
  const peers = roomPeers(name);
  for (const m of r.values()) m.client.ws.send({ t: 'peers', room: name, peers });
}
function joinRoom(c, name) {
  if (!rooms.has(name)) rooms.set(name, new Map());
  const r = rooms.get(name);
  if (!r.has(c.peer)) r.set(c.peer, { client: c, presence: {}, updatedAt: Date.now() });
  c.rooms.add(name);
  broadcastPeers(name);
}
function leaveRoom(c, name) {
  const r = rooms.get(name);
  if (!r) return;
  r.delete(c.peer);
  c.rooms.delete(name);
  if (!r.size && name !== LOBBY) rooms.delete(name);
  else broadcastPeers(name);
}

// ---------------- Veritabanı (skorlar) ----------------
let docs = {};
let loadOk = true;
function readJson(f) {
  try { const d = JSON.parse(fs.readFileSync(f, 'utf8')); return d && typeof d === 'object' ? d : null; } catch (_) { return null; }
}
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* yok say */ }
if (fs.existsSync(DATA_FILE)) {
  // Ana dosya bozuksa yedekten aç; ikisi de bozuksa dosyaya dokunmadan sakla (üzerine yazma!)
  docs = readJson(DATA_FILE) ?? readJson(BACKUP_FILE);
  if (!docs) {
    loadOk = false;
    docs = {};
    try { fs.copyFileSync(DATA_FILE, DATA_FILE + '.bozuk-' + Date.now()); loadOk = true; } catch (_) { /* yok say */ }
  }
} else {
  // İlk açılış: eski sürümün skorlarını taşı, yoksa boş tabloyu hemen oluştur
  docs = readJson(OLD_FILE) ?? readJson(BACKUP_FILE) ?? {};
}
let saveTimer = null;
let dirty = false;
function writeNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!loadOk) return;
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(docs, null, 1));
    if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, BACKUP_FILE);
    fs.renameSync(tmp, DATA_FILE); // yarım yazılmış dosya asla kalmaz
    dirty = false;
  } catch (e) {
    console.error('  ! Skorlar kaydedilemedi:', e.message);
  }
}
function save() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 300);
}
if (!fs.existsSync(DATA_FILE)) writeNow();
// Pencere kapatılırken (Ctrl+C) bekleyen kaydı diske yaz
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  try { process.on(sig, () => { if (dirty) writeNow(); process.exit(0); }); } catch (_) { /* platformda yok */ }
}
process.on('exit', () => { if (dirty) writeNow(); });
const colOf = (p) => p.split('/').slice(0, -1).join('/');
function colDocs(col) {
  const out = [];
  for (const [p, data] of Object.entries(docs)) if (colOf(p) === col) out.push({ id: p.split('/').pop(), data });
  return out;
}
function pushCol(col) {
  const list = colDocs(col);
  for (const c of clients) if (c.subs.has(col)) c.ws.send({ t: 'dbcol', col, docs: list });
}
/** Kurallar: her oyuncu yalnızca <koleksiyon>/<kendi id'si> belgesini yazabilir */
const canWrite = (c, p) => p.split('/').length === 2 && p.split('/')[1] === c.uid && /^[A-Za-z0-9_-]+$/.test(p.split('/')[0]);

// ---------------- Bağlantılar ----------------
server.on('upgrade', (req, sock) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws') return sock.destroy();
  const key = req.headers['sec-websocket-key'];
  if (!key) return sock.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', ''].join('\r\n'));
  sock.setNoDelay(true);

  const ws = new Socket(sock);
  const c = { ws, peer: crypto.randomBytes(6).toString('hex'), uid: null, rooms: new Set(), subs: new Set() };
  clients.add(c);

  ws.onmessage = (text) => {
    let m;
    try { m = JSON.parse(text); } catch (_) { return; }
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'hello':
        c.uid = String(m.uid || 'u_' + c.peer).slice(0, 40);
        ws.send({ t: 'welcome', peer: c.peer, uid: c.uid });
        joinRoom(c, LOBBY);
        break;
      case 'join': if (typeof m.room === 'string' && m.room.length < 60) joinRoom(c, m.room); break;
      case 'leave': leaveRoom(c, m.room); break;
      case 'presence': {
        const r = rooms.get(m.room);
        const me = r?.get(c.peer);
        if (!me || typeof m.patch !== 'object') break;
        const next = { ...me.presence };
        for (const [k, v] of Object.entries(m.patch)) { if (v === null) delete next[k]; else next[k] = v; }
        if (JSON.stringify(next).length > 4096) break;
        me.presence = next;
        me.updatedAt = Date.now();
        broadcastPeers(m.room);
        break;
      }
      case 'emit': {
        const r = rooms.get(m.room);
        if (!r?.has(c.peer) || typeof m.topic !== 'string') break;
        if (JSON.stringify(m.data ?? null).length > 4096) break;
        for (const x of r.values()) x.client.ws.send({ t: 'msg', room: m.room, topic: m.topic, data: m.data, peer: c.peer, by: c.uid });
        break;
      }
      case 'dbsub': if (typeof m.col === 'string') { c.subs.add(m.col); ws.send({ t: 'dbcol', col: m.col, docs: colDocs(m.col) }); } break;
      case 'dbget': ws.send({ t: 'dbres', id: m.id, data: docs[m.path] ?? null }); break;
      case 'dbset': {
        if (!canWrite(c, m.path) || typeof m.data !== 'object') { ws.send({ t: 'dbres', id: m.id, error: 'invalid_argument' }); break; }
        if (m.merge && !docs[m.path]) { ws.send({ t: 'dbres', id: m.id, error: 'invalid_argument' }); break; }
        docs[m.path] = m.merge ? { ...docs[m.path], ...m.data } : m.data;
        save();
        ws.send({ t: 'dbres', id: m.id, ok: true });
        pushCol(colOf(m.path));
        break;
      }
      default: break;
    }
  };
  ws.onclose = () => {
    clients.delete(c);
    for (const name of [...c.rooms]) leaveRoom(c, name);
  };
});

// Kopan bağlantıları temizle
setInterval(() => { for (const c of clients) c.ws.ping(); }, 20000);

server.listen(PORT, '0.0.0.0', () => {
  const ips = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) ips.push({ name, ip: a.address });
  }
  console.log('\n  ⚔️  RÜNKIRAN yerel sunucusu çalışıyor\n');
  console.log(`  Bu bilgisayarda:   http://localhost:${PORT}`);
  for (const { name, ip } of ips) {
    const tag = ip.startsWith('26.') ? '  ← Radmin VPN' : ip.startsWith('25.') ? '  ← Hamachi' : '';
    console.log(`  Arkadaşların için: http://${ip}:${PORT}   (${name})${tag}`);
  }
  console.log(`\n  Skorlar: ${DATA_FILE}`);
  console.log('  Kapatmak için bu pencerede Ctrl+C.\n');
});
