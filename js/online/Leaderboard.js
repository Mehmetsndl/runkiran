// ============================================================
//  ÇEVRİM İÇİ LİDER TABLOSU (her oyun modu için ayrı)
//  Yayınlanan sayfada claude.ai'ın paylaşımlı veritabanını (db) kullanır:
//    <mod koleksiyonu>/<oyuncuId>  → her oyuncunun o moddaki tek satırı
//  Koleksiyon ve skor alanları data/modes.js içindeki lb tanımından gelir.
//  Herkes tabloyu okur, her oyuncu yalnızca kendi satırını yazar.
//  Sayfa yerelde açılırsa (db yoksa) skorlar tarayıcıda saklanır.
// ============================================================

const LOCAL_PREFIX = 'runkiran-yerel-skorlar-';
const NICK_KEY = 'runkiran-takma-ad';
const TOP = 50;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* depolama kapalı */ } },
};

export class Leaderboard {
  constructor(mode) {
    this.status = 'connecting'; // connecting | online | readonly | offline
    this.mode = mode;
    this.db = null;
    this.user = null;
    this.uid = null;
    this.rows = {};
    this.me = null;
    this.listeners = new Set();
    this.unsubs = [];
    this.nick = (store.get(NICK_KEY) || '').slice(0, 16);
    this._init();
  }

  get tabs() { return this.mode.lb.tabs; }
  get collection() { return this.mode.lb.collection; }

  onChange(fn) { this.listeners.add(fn); fn(); }
  _emit() { for (const fn of this.listeners) fn(); }

  async _init() {
    const c = window.claude;
    if (!c || typeof c.use !== 'function') return this._goOffline();
    const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
    if (!db) return this._goOffline();

    this.db = db;
    this.user = user;
    this.uid = user ? await user.id() : null;
    const canWrite = user ? await user.can('data.write') : null;
    this.status = !this.uid || canWrite === false ? 'readonly' : 'online';
    this._subscribe();
  }

  /** Menüde mod değişince o modun tablosuna geç */
  setMode(mode) {
    if (mode.id === this.mode.id) return;
    this.mode = mode;
    this.rows = {};
    this.me = null;
    if (this.status === 'offline') this._loadLocal();
    else if (this.db) this._subscribe();
    this._emit();
  }

  _subscribe() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    const col = this.db.collection(this.collection);
    const onErr = () => { if (this.status === 'online') { this.status = 'readonly'; this._emit(); } };
    for (const tab of this.tabs) {
      this.unsubs.push(col.orderBy(tab.key, 'desc').limit(TOP).onSnapshot((snap) => {
        this.rows[tab.key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        this._emit();
      }, onErr));
    }
    if (this.uid) {
      this.unsubs.push(this.db.doc(`${this.collection}/${this.uid}`).onSnapshot((snap) => {
        this.me = snap.exists ? snap.data() : null;
        this._emit();
      }, () => {}));
    }
    this._emit();
  }

  _goOffline() {
    this.status = 'offline';
    this.uid = 'yerel';
    this._loadLocal();
    this._emit();
  }

  _loadLocal() {
    let list = [];
    try { list = JSON.parse(store.get(LOCAL_PREFIX + this.mode.id) || '[]'); } catch (_) { list = []; }
    this.local = list;
    this.rows = { all: list.map((r, i) => ({ id: 'yerel-' + i, ...r })) };
  }

  /**
   * Tek tablo: tüm sorgulardan gelen satırlar oyuncu başına birleştirilir ve
   * istenen alana göre (eşitlikte diğer alanlara göre) sıralanır.
   */
  rowsFor(key) {
    const byId = new Map();
    for (const list of Object.values(this.rows)) for (const r of list) byId.set(r.id, r);
    const keys = [key, ...this.tabs.map((t) => t.key).filter((k) => k !== key)];
    return [...byId.values()]
      .filter((r) => this.tabs.some((t) => (r[t.key] ?? 0) > 0))
      .sort((a, b) => {
        for (const k of keys) { const d = (b[k] ?? 0) - (a[k] ?? 0); if (d) return d; }
        return 0;
      });
  }

  /** Sıralamadaki yerin (1'den başlar) ya da null */
  rank(key) {
    if (this.status === 'offline') return null;
    const i = this.rowsFor(key).findIndex((r) => r.id === this.uid);
    return i >= 0 ? i + 1 : null;
  }

  async names(ids) {
    if (!this.user || !ids.length) return {};
    try { return await this.user.profiles(ids); } catch (_) { return {}; }
  }

  async setNick(nick) {
    nick = nick.trim().slice(0, 16);
    if (nick === this.nick) return;
    this.nick = nick;
    store.set(NICK_KEY, nick);
    if (this.status === 'online' && this.me) {
      try { await this.db.doc(`${this.collection}/${this.uid}`).update({ nick }); } catch (_) { /* sonraki skorla yazılır */ }
    }
  }

  /**
   * Oyun bitince çağrılır.
   * run = { metrics: { skorAlanı: değer }, time, xp, level, char }
   * Dönen: { saved: 'online'|'local'|false, newKeys, newBests (etiketler), reason }
   */
  async submit(run) {
    const metrics = {};
    for (const tab of this.tabs) {
      const v = run.metrics[tab.key] ?? 0;
      metrics[tab.key] = tab.fmt === 'time' ? Math.round(v * 10) / 10 : Math.round(v);
    }
    const labelOf = (k) => this.tabs.find((t) => t.key === k)?.label.replace(/^\S+\s/, '') ?? k;

    if (this.status === 'offline') {
      const prevBest = (k) => Math.max(0, ...this.local.map((r) => r[k] ?? 0));
      const sumKeys = this.tabs.filter((t) => t.sum).map((t) => t.key);
      const newKeys = Object.keys(metrics).filter((k) => !sumKeys.includes(k) && metrics[k] > prevBest(k));
      // Toplanan alanlar (galibiyet) yerelde tek satırda birikir
      if (sumKeys.length) {
        const mine = this.local.find((r) => r.mine) ?? { nick: this.nick || 'Sen', mine: true };
        for (const k of Object.keys(metrics)) {
          if (sumKeys.includes(k)) mine[k] = (mine[k] ?? 0) + metrics[k];
          else if (metrics[k] > (mine[k] ?? -1)) { mine[k] = metrics[k]; mine[k + 'At'] = Math.round(run.time); }
        }
        const list = [mine, ...this.local.filter((r) => !r.mine)];
        store.set(LOCAL_PREFIX + this.mode.id, JSON.stringify(list));
        this._loadLocal();
        this._emit();
        return { saved: 'local', newKeys, newBests: newKeys.map(labelOf) };
      }
      const entry = { nick: this.nick || 'Sen', at: Date.now() };
      for (const k of Object.keys(metrics)) {
        entry[k] = metrics[k];
        entry[k + 'Char'] = run.char;
        entry[k + 'Level'] = run.level;
        entry[k + 'At'] = Math.round(run.time);
      }
      const list = [...this.local, entry].sort((a, b) => b[this.tabs[0].key] - a[this.tabs[0].key] || b[this.tabs[1].key] - a[this.tabs[1].key]).slice(0, TOP);
      store.set(LOCAL_PREFIX + this.mode.id, JSON.stringify(list));
      this._loadLocal();
      this._emit();
      return { saved: 'local', newKeys, newBests: newKeys.map(labelOf) };
    }
    if (this.status === 'connecting') return { saved: false, reason: 'connecting' };
    if (this.status !== 'online') return { saved: false, reason: 'readonly' };

    const ref = this.db.doc(`${this.collection}/${this.uid}`);
    let prev = {};
    try {
      const snap = await ref.get();
      if (snap.exists) prev = snap.data();
    } catch (_) { prev = this.me || {}; }

    const body = {
      nick: this.nick,
      lifetimeXp: (prev.lifetimeXp || 0) + Math.round(run.xp),
      runs: (prev.runs || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    const newKeys = [];
    for (const k of Object.keys(metrics)) {
      if (this.tabs.find((t) => t.key === k)?.sum) {
        body[k] = (prev[k] ?? 0) + metrics[k];
        body[k + 'At'] = Math.round(run.time);
        continue;
      }
      const better = metrics[k] > (prev[k] ?? -1);
      if (better && metrics[k] > 0) newKeys.push(k);
      const src = better ? { v: metrics[k], c: run.char, l: run.level, a: Math.round(run.time) }
        : { v: prev[k], c: prev[k + 'Char'], l: prev[k + 'Level'], a: prev[k + 'At'] };
      body[k] = src.v;
      body[k + 'Char'] = src.c ?? null;
      body[k + 'Level'] = src.l ?? null;
      body[k + 'At'] = src.a ?? null;
    }
    try {
      await ref.set(body);
      return { saved: 'online', newKeys, newBests: newKeys.map(labelOf) };
    } catch (e) {
      if (e?.code === 'invalid_argument') { this.status = 'readonly'; this._emit(); }
      return { saved: false, reason: e?.code || 'unavailable' };
    }
  }
}
