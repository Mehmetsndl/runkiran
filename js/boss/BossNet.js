// ============================================================
//  BOSS AVI AĞI (Deniz Savaşı ağının kopyası; konu adları 'bs-')
//  LOBİ: kuyruğa giren her oyuncu presence'ına { nv: { q, t, nick, st:'q' } } yazar.
//        Kuyruk herkeste aynı sırayla (giriş zamanı, peer) dizilir. Yeterli kişi
//        toplanınca kuyruğun BAŞINDAKİ oyuncu maçı kurar: takımları/rolleri
//        rastgele dağıtır ve 'bs-match' olayını yayınlar.
//  MAÇ:  Herkes maça özel odaya (join) girer. Host durumu presence ile yayınlar,
//        diğerleri eylemlerini 'bs-act' ile host'a yollar, host 'bs-fx' ile
//        görsel olayları duyurur. Host ayrılırsa listedeki sıradaki oyuncu devralır.
// ============================================================
import { BOSS_RAID } from '../data/bossRaid.js';

export class BossNet {
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
    this.room.on('bs-match', (msg) => this._onMatch(msg), () => {});
    this._emit();
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) fn(); }
  onMatch(fn) { this.matchHandlers.add(fn); return () => this.matchHandlers.delete(fn); }

  get myPeer() {
    return this.room?.peers().find((p) => p.sameTab)?.peer ?? null;
  }

  /** Kuyruğa gir */
  async joinQueue(q, nick, ch, boss = '', diff = '') {
    await this.ready;
    if (!this.online) return false;
    this.queueId = q;
    this.forming = false;
    await this.room.presence({ bs: { q, t: Date.now(), nick: nick.slice(0, 16), ch: String(ch || ''), st: 'q', boss, diff } }).catch(() => {});
    this._emit();
    return true;
  }

  async leaveQueue() {
    this.queueId = null;
    if (this.online) await this.room.presence({ bs: null }).catch(() => {});
    this._emit();
  }

  /** Bir kuyruktaki oyuncular (herkeste aynı sırayla) */
  queueList(q) {
    if (!this.online) return [];
    return this.room.peers()
      .filter((p) => p.kind === 'viewer' && p.presence?.bs?.st === 'q' && p.presence.bs.q === q)
      .map((p) => ({ peer: p.peer, nick: String(p.presence.bs.nick || 'İsimsiz').slice(0, 16), ch: String(p.presence.bs.ch || ''), t: Number(p.presence.bs.t) || 0, boss: String(p.presence.bs.boss || ''), diff: String(p.presence.bs.diff || ''), me: p.sameTab }))
      .sort((a, b) => a.t - b.t || (a.peer < b.peer ? -1 : 1));
  }

  lobbyCount() {
    return this.online ? this.room.peers().filter((p) => p.kind === 'viewer').length : 0;
  }

  _checkForm() {
    const q = this.queueId;
    if (!q || this.forming) return;
    const need = BOSS_RAID.queues[q].need;
    const list = this.queueList(q);
    if (list.length < need || !list[0].me) return;
    // Bu oyuncu kuyruğun başında: maçı kur
    this.forming = true;
    const humans = list.slice(0, need);
    const match = buildMatch(q, humans.map((h) => ({ key: h.peer, nick: h.nick, ch: h.ch })), humans[0].boss, humans[0].diff);
    const send = () => this.room.emit('bs-match', match).catch(() => {});
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
    this.room.presence({ bs: { st: 'm', match: m.id } }).catch(() => {});
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

/** Maç kurulumu: yalnızca insanlar (ortak av). Boss'u kuyruğun başındaki oyuncu seçer. */
export function buildMatch(q, humans, boss, diff) {
  const players = humans.map((h) => ({ ...h, ai: false }));
  return { id: 'bs-' + Math.random().toString(36).slice(2, 10), q, players, host: humans[0]?.key ?? null, boss: boss || 'trol', diff: diff || 'normal', seed: Math.floor(Math.random() * 1e9) };
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
  publish(patch) { return this.room.presence(patch).catch(() => {}); }
  presenceOf(key) { return this.room.peers().find((x) => x.peer === key)?.presence ?? null; }
  sendAction(a) { return this.room.emit('bs-act', a).catch(() => {}); }
  sendFx(list) { return this.room.emit('bs-fx', { list }).catch(() => {}); }
  onAction(fn) { return this.room.on('bs-act', (m) => fn(m.peer, m.data), () => {}); }
  onFx(fn) { return this.room.on('bs-fx', (m) => fn(m.data?.list ?? [], m.peer), () => {}); }
  onPeers(fn) { return this.room.onPeers(fn, () => {}); }
  leave() { return this.room.leave().catch(() => {}); }
}
