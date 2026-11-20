// ============================================================
//  DENİZ SAVAŞI AĞI (claude.ai "room" yeteneği)
//  LOBİ: kuyruğa giren her oyuncu presence'ına { nv: { q, t, nick, st:'q' } } yazar.
//        Kuyruk herkeste aynı sırayla (giriş zamanı, peer) dizilir. Yeterli kişi
//        toplanınca kuyruğun BAŞINDAKİ oyuncu maçı kurar: takımları/rolleri
//        rastgele dağıtır ve 'nv-match' olayını yayınlar.
//  MAÇ:  Herkes maça özel odaya (join) girer. Host durumu presence ile yayınlar,
//        diğerleri eylemlerini 'nv-act' ile host'a yollar, host 'nv-fx' ile
//        görsel olayları duyurur. Host ayrılırsa listedeki sıradaki oyuncu devralır.
// ============================================================
import { NAVAL } from '../data/naval.js';
import { CHARACTERS } from '../data/characters.js';

export class NavalNet {
  constructor() {
    this.room = null;
    this.online = false;
    this.ready = this._init();
    this.listeners = new Set();
    this.queueId = null;
    this.matchHandlers = new Set();
    this.seenMatches = new Set();
    this.forming = false;
  }

  async _init() {
    const c = window.claude;
    if (!c || typeof c.use !== 'function') return;
    try {
      this.room = await c.use('room');
    } catch (_) { this.room = null; }
    if (!this.room) return;
    this.online = true;
    this.room.onPeers(() => { this._checkForm(); this._emit(); }, () => { this.online = false; this._emit(); });
    this.room.on('nv-match', (msg) => this._onMatch(msg), () => {});
    this._emit();
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) fn(); }
  onMatch(fn) { this.matchHandlers.add(fn); return () => this.matchHandlers.delete(fn); }

  get myPeer() {
    return this.room?.peers().find((p) => p.sameTab)?.peer ?? null;
  }

  /** Kuyruğa gir */
  async joinQueue(q, nick, ch) {
    await this.ready;
    if (!this.online) return false;
    this.queueId = q;
    this.forming = false;
    await this.room.presence({ nv: { q, t: Date.now(), nick: nick.slice(0, 16), ch: String(ch || ''), st: 'q' } }).catch(() => {});
    this._emit();
    return true;
  }

  async leaveQueue() {
    this.queueId = null;
    if (this.online) await this.room.presence({ nv: null }).catch(() => {});
    this._emit();
  }

  /** Bir kuyruktaki oyuncular (herkeste aynı sırayla) */
  queueList(q) {
    if (!this.online) return [];
    return this.room.peers()
      .filter((p) => p.kind === 'viewer' && p.presence?.nv?.st === 'q' && p.presence.nv.q === q)
      .map((p) => ({ peer: p.peer, nick: String(p.presence.nv.nick || 'İsimsiz').slice(0, 16), ch: String(p.presence.nv.ch || ''), t: Number(p.presence.nv.t) || 0, me: p.sameTab }))
      .sort((a, b) => a.t - b.t || (a.peer < b.peer ? -1 : 1));
  }

  lobbyCount() {
    return this.online ? this.room.peers().filter((p) => p.kind === 'viewer').length : 0;
  }

  _checkForm() {
    const q = this.queueId;
    if (!q || this.forming) return;
    const need = NAVAL.queues[q].need;
    const list = this.queueList(q);
    if (list.length < need || !list[0].me) return;
    // Bu oyuncu kuyruğun başında: maçı kur
    this.forming = true;
    const humans = list.slice(0, need);
    const match = buildMatch(q, humans.map((h) => ({ key: h.peer, nick: h.nick, ch: h.ch })));
    const send = () => this.room.emit('nv-match', match).catch(() => {});
    send();
    setTimeout(send, 500);
    setTimeout(send, 1200);
    this._onMatch({ data: match, isMe: true, sameTab: true });
  }

  _onMatch(msg) {
    const m = msg.data;
    if (!m || typeof m.id !== 'string' || !Array.isArray(m.players) || this.seenMatches.has(m.id)) return;
    const me = this.myPeer;
    if (!m.players.some((p) => p.key === me)) return;
    this.seenMatches.add(m.id);
    this.queueId = null;
    this.room.presence({ nv: { st: 'm', match: m.id } }).catch(() => {});
    for (const fn of this.matchHandlers) fn(m);
  }

  /** Maç odasına gir */
  async joinMatch(id) {
    if (!this.online) return null;
    try {
      return new MatchChannel(await this.room.join(id), this.myPeer);
    } catch (_) {
      return null;
    }
  }
}

/** Maç kurulumu: takımlar ve roller rastgele */
export function buildMatch(q, humans) {
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // Yapay zekâ oyuncuları açıkça "Yapay Zekâ" olarak adlandırılır; insanlar kendi adını yazar
  const aiNames = [1, 2, 3, 4, 5, 6].map((n) => `Yapay Zekâ ${n}`);
  let pool = shuffle([...humans]).map((h) => ({ ...h, ai: false }));
  let teams;
  if (q === 'v6') {
    teams = [pool.slice(0, 3), pool.slice(3, 6)];
  } else {
    // v3 ve antrenman: insanlar mavi takımda, boşluklar ve rakip takım yapay zekâ
    const ai = (n, k) => ({ key: `ai-${n}`, nick: aiNames[k % aiNames.length], ai: true, ch: CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id });
    const t0 = [...pool];
    let k = 0;
    while (t0.length < 3) t0.push(ai(k, k++));
    teams = [t0, [ai(10, k++), ai(11, k++), ai(12, k++)]];
  }
  const players = [];
  teams.forEach((members, team) => {
    const def = Math.floor(Math.random() * members.length);
    members.forEach((m, i) => players.push({ ...m, team, role: i === def ? 'savunma' : 'topcu' }));
  });
  const host = humans.length ? humans[0].key : null;
  return { id: 'nv-' + Math.random().toString(36).slice(2, 10), q, players, host };
}

/** Bir maçın odası: durum (presence), eylemler ve görsel olaylar */
class MatchChannel {
  constructor(room, myPeer) {
    this.room = room;
    this.myPeer = myPeer;
  }
  peers() { return this.room.peers(); }
  presentKeys() { return new Set(this.room.peers().map((p) => p.peer)); }
  hostState(hostKey) {
    const p = this.room.peers().find((x) => x.peer === hostKey);
    return p?.presence?.st ?? null;
  }
  publishState(st) { return this.room.presence({ st }).catch(() => {}); }
  sendAction(a) { return this.room.emit('nv-act', a).catch(() => {}); }
  sendFx(list) { return this.room.emit('nv-fx', { list }).catch(() => {}); }
  onAction(fn) { return this.room.on('nv-act', (m) => fn(m.peer, m.data), () => {}); }
  onFx(fn) { return this.room.on('nv-fx', (m) => fn(m.data?.list ?? [], m.peer), () => {}); }
  onPeers(fn) { return this.room.onPeers(fn, () => {}); }
  leave() { return this.room.leave().catch(() => {}); }
}
