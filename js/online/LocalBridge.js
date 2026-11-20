// ============================================================
//  YEREL AĞ KÖPRÜSÜ
//  Oyun server/server.js ile açıldıysa, claude.ai'ın sağladığı
//  window.claude.use('room' | 'db' | 'user') arayüzünü aynı biçimde
//  yerel sunucu üzerinden sağlar. Böylece Deniz Savaşı eşleştirmesi ve
//  lider tablosu Radmin VPN / aynı Wi-Fi üzerinde de çalışır.
// ============================================================

const UID_KEY = 'runkiran-uid';

function localUid() {
  try {
    let id = localStorage.getItem(UID_KEY);
    if (!id) {
      id = 'u_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      localStorage.setItem(UID_KEY, id);
    }
    return id;
  } catch (_) {
    return 'u_' + Math.random().toString(36).slice(2, 12);
  }
}

/** Sunucu varsa bağlan ve claude benzeri nesneyi döndür; yoksa null */
export async function connectLocal(timeoutMs = 1500) {
  if (location.protocol === 'file:') return null;
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  let ws;
  try { ws = new WebSocket(url); } catch (_) { return null; }
  const opened = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    ws.onopen = () => { clearTimeout(timer); resolve(true); };
    ws.onerror = () => { clearTimeout(timer); resolve(false); };
  });
  if (!opened) { try { ws.close(); } catch (_) { /* yok say */ } return null; }
  return new LocalClient(ws).ready;
}

class LocalClient {
  constructor(ws) {
    this.ws = ws;
    this.uid = localUid();
    this.peer = null;
    this.rooms = new Map();      // ad → RoomState
    this.cols = new Map();       // koleksiyon → { docs, listeners:Set }
    this.pending = new Map();    // istek id → resolve
    this.reqId = 0;
    this.connected = true;
    ws.onmessage = (ev) => this._msg(JSON.parse(ev.data));
    ws.onclose = () => { this.connected = false; };
    this.ready = new Promise((resolve) => { this._resolveReady = resolve; });
    this.lobby = this._room('');
    this._send({ t: 'hello', uid: this.uid });
  }

  _send(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }

  _msg(m) {
    if (m.t === 'welcome') {
      this.peer = m.peer;
      const api = this._api();
      this._resolveReady(api);
    } else if (m.t === 'peers') {
      this.rooms.get(m.room)?.setPeers(m.peers);
    } else if (m.t === 'msg') {
      this.rooms.get(m.room)?.deliver(m);
    } else if (m.t === 'dbcol') {
      const c = this._col(m.col);
      c.docs = m.docs;
      c.loaded = true;
      for (const fn of c.listeners) fn();
    } else if (m.t === 'dbres') {
      const r = this.pending.get(m.id);
      if (r) { this.pending.delete(m.id); r(m); }
    }
  }

  _request(m) {
    const id = ++this.reqId;
    return new Promise((resolve) => { this.pending.set(id, resolve); this._send({ ...m, id }); });
  }

  _col(col) {
    if (!this.cols.has(col)) {
      this.cols.set(col, { docs: [], listeners: new Set(), loaded: false });
      this._send({ t: 'dbsub', col });
    }
    return this.cols.get(col);
  }

  _room(name) {
    if (!this.rooms.has(name)) this.rooms.set(name, new RoomState(this, name));
    return this.rooms.get(name);
  }

  // ---------------- claude benzeri arayüz ----------------
  _api() {
    const self = this;
    const lobby = this.lobby.api();
    lobby.join = async (name) => {
      const r = self._room(name);
      self._send({ t: 'join', room: name });
      return r.api();
    };
    const user = {
      id: async () => self.uid,
      me: async () => ({ id: self.uid, name: '', email: null, isOwner: false, canEdit: false, avatarUrl: '', color: '#888' }),
      isOwner: async () => false,
      canEdit: async () => false,
      can: async () => true,
      profiles: async (ids) => Object.fromEntries([].concat(ids).map((id) => [id, { id, name: '', avatarUrl: '', color: '#888', email: null, isMe: id === self.uid, guest: false }])),
      name: async () => '',
      search: async () => [],
    };
    const db = {
      collection: (col) => self._query(col),
      doc: (p) => self._docRef(p),
    };
    return {
      __local: true,
      use: async (n) => (n === 'room' ? lobby : n === 'db' ? db : n === 'user' ? user : null),
    };
  }

  _query(col, field = null, dir = 'asc', n = 1000) {
    const self = this;
    const snapOf = (d) => ({ id: d.id, exists: true, data: () => d.data, metadata: { fromCache: false, hasPendingWrites: false } });
    const compute = () => {
      let list = [...self._col(col).docs];
      if (field) {
        list = list.filter((d) => d.data[field] != null);
        list.sort((a, b) => (a.data[field] - b.data[field]) * (dir === 'desc' ? -1 : 1));
      }
      const docs = list.slice(0, n).map(snapOf);
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
    };
    return {
      orderBy: (f, d = 'asc') => self._query(col, f, d, n),
      limit: (k) => self._query(col, field, dir, k),
      where: () => self._query(col, field, dir, n),
      get: async () => compute(),
      onSnapshot(next) {
        const c = self._col(col);
        const fn = () => next(compute());
        c.listeners.add(fn);
        if (c.loaded) setTimeout(fn, 0);
        return () => c.listeners.delete(fn);
      },
      doc: (id) => self._docRef(`${col}/${id}`),
    };
  }

  _docRef(p) {
    const self = this;
    const col = p.split('/').slice(0, -1).join('/');
    const id = p.split('/').pop();
    const snap = (data) => ({ id, exists: data != null, data: () => data ?? undefined, metadata: { fromCache: false, hasPendingWrites: false } });
    const write = async (data, merge) => {
      const r = await self._request({ t: 'dbset', path: p, data, merge });
      if (r.error) throw { code: r.error, message: 'Yazılamadı' };
    };
    return {
      id, path: p,
      get: async () => snap((await self._request({ t: 'dbget', path: p })).data),
      set: (data) => write(data, false),
      update: (data) => write(data, true),
      delete: async () => {},
      onSnapshot(next) {
        const c = self._col(col);
        const fn = () => next(snap(c.docs.find((d) => d.id === id)?.data ?? null));
        c.listeners.add(fn);
        if (c.loaded) setTimeout(fn, 0);
        return () => c.listeners.delete(fn);
      },
    };
  }
}

/** Bir odanın (lobi ya da maç odası) yerel durumu */
class RoomState {
  constructor(client, name) {
    this.client = client;
    this.name = name;
    this.snapshot = Object.freeze([]);
    this.peerFns = new Set();
    this.topics = {};
    this.myPresence = {};
  }

  setPeers(list) {
    const me = this.client.peer;
    this.snapshot = Object.freeze(list.map((p) => Object.freeze({
      peer: p.peer, by: p.by, isMe: p.peer === me, sameTab: p.peer === me, kind: 'viewer', guest: false,
      presence: Object.freeze(p.presence || {}), updatedAt: p.updatedAt,
    })));
    for (const fn of this.peerFns) fn({ peers: this.snapshot, joined: [], left: [], updated: [] });
  }

  deliver(m) {
    const me = this.client.peer;
    for (const fn of this.topics[m.topic] || []) {
      fn({ topic: m.topic, data: m.data, peer: m.peer, by: m.by, isMe: m.peer === me, sameTab: m.peer === me, kind: 'viewer', guest: false });
    }
  }

  api() {
    const c = this.client;
    const name = this.name;
    return {
      name,
      emit: async (topic, data) => c._send({ t: 'emit', room: name, topic, data }),
      on: (topic, fn) => {
        (this.topics[topic] ||= []).push(fn);
        return () => { this.topics[topic] = this.topics[topic].filter((x) => x !== fn); };
      },
      presence: async (patch) => {
        for (const [k, v] of Object.entries(patch)) { if (v === null) delete this.myPresence[k]; else this.myPresence[k] = v; }
        c._send({ t: 'presence', room: name, patch });
      },
      peers: () => this.snapshot,
      onPeers: (fn) => {
        this.peerFns.add(fn);
        setTimeout(() => fn({ peers: this.snapshot, joined: this.snapshot, left: [], updated: [] }), 0);
        return () => this.peerFns.delete(fn);
      },
      connected: () => c.connected,
      onConnection: (fn) => { setTimeout(() => fn(c.connected), 0); return () => {}; },
      leave: async () => {
        c._send({ t: 'leave', room: name });
        this.peerFns.clear();
        this.topics = {};
      },
    };
  }
}
