// ============================================================
//  TOPRAK FETHİ AĞI (Deniz Savaşı ağının kopyası; konu adları 'ft-')
//  LOBİ: kuyruğa giren her oyuncu presence'ına { nv: { q, t, nick, st:'q' } } yazar.
//        Kuyruk herkeste aynı sırayla (giriş zamanı, peer) dizilir. Yeterli kişi
//        toplanınca kuyruğun BAŞINDAKİ oyuncu maçı kurar: takımları/rolleri
//        rastgele dağıtır ve 'ft-match' olayını yayınlar.
//  MAÇ:  Herkes maça özel odaya (join) girer. Host durumu presence ile yayınlar,
//        diğerleri eylemlerini 'ft-act' ile host'a yollar, host 'ft-fx' ile
//        görsel olayları duyurur. Host ayrılırsa listedeki sıradaki oyuncu devralır.
// ============================================================
import { FETIH } from '../data/fetih.js';
import { CHARACTERS } from '../data/characters.js';

export class FetihNet {
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
    this.room.on('ft-match', (msg) => this._onMatch(msg), () => {});
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
    await this.room.presence({ ft: { q, t: Date.now(), nick: nick.slice(0, 16), ch: String(ch || ''), st: 'q' } }).catch(() => {});
    this._emit();
    return true;
  }

  async leaveQueue() {
    this.queueId = null;
    if (this.online) await this.room.presence({ ft: null }).catch(() => {});
    this._emit();
  }

  /** Bir kuyruktaki oyuncular (herkeste aynı sırayla) */
  queueList(q) {
    if (!this.online) return [];
    return this.room.peers()
      .filter((p) => p.kind === 'viewer' && p.presence?.ft?.st === 'q' && p.presence.ft.q === q)
      .map((p) => ({ peer: p.peer, nick: String(p.presence.ft.nick || 'İsimsiz').slice(0, 16), ch: String(p.presence.ft.ch || ''), t: Number(p.presence.ft.t) || 0, me: p.sameTab }))
      .sort((a, b) => a.t - b.t || (a.peer < b.peer ? -1 : 1));
  }

  lobbyCount() {
    return this.online ? this.room.peers().filter((p) => p.kind === 'viewer').length : 0;
  }

  _checkForm() {
    const q = this.queueId;
    if (!q || this.forming) return;
    const need = FETIH.queues[q].need;
    const list = this.queueList(q);
    if (list.length < need || !list[0].me) return;
    // Bu oyuncu kuyruğun başında: maçı kur
    this.forming = true;
    const humans = list.slice(0, need);
    const match = buildMatch(q, humans.map((h) => ({ key: h.peer, nick: h.nick, ch: h.ch })));
    const send = () => this.room.emit('ft-match', match).catch(() => {});
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
    this.room.presence({ ft: { st: 'm', match: m.id } }).catch(() => {});
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

/** Maç kurulumu: insanlar + boş koltuklara yapay zekâ, koltuklar rastgele */
export function buildMatch(q, humans) {
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const seats = shuffle([...humans]).map((h) => ({ ...h, ai: false }));
  const used = new Set(seats.map((s) => s.ch));
  let k = 1;
  while (seats.length < 4) {
    const free = CHARACTERS.filter((c) => !used.has(c.id));
    const ch = (free.length ? free : CHARACTERS)[Math.floor(Math.random() * (free.length || CHARACTERS.length))].id;
    used.add(ch);
    seats.push({ key: `ai-${k}`, nick: `Yapay Zekâ ${k}`, ai: true, ch });
    k++;
  }
  // İnsanlar koltuklara rastgele dağılır (YZ'ler de araya karışır)
  const order = shuffle(seats);
  const host = humans.length ? humans[0].key : null;
  return { id: 'ft-' + Math.random().toString(36).slice(2, 10), q, players: order, host, seed: Math.floor(Math.random() * 1e9) };
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
  sendAction(a) { return this.room.emit('ft-act', a).catch(() => {}); }
  sendFx(list) { return this.room.emit('ft-fx', { list }).catch(() => {}); }
  onAction(fn) { return this.room.on('ft-act', (m) => fn(m.peer, m.data), () => {}); }
  onFx(fn) { return this.room.on('ft-fx', (m) => fn(m.data?.list ?? [], m.peer), () => {}); }
  onPeers(fn) { return this.room.onPeers(fn, () => {}); }
  leave() { return this.room.leave().catch(() => {}); }
}
