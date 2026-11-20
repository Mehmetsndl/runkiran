// ============================================================
//  PARSEL FETHİ KURALLARI (host'ta çalışır; görselden bağımsız)
//  Her hükümdarın TEK bir ordusu var (parsellere dağılmaz).
//  Tur: gelir → sahiplen / kur / birlik yetiştir / saldır (2) → bitir.
//  Saldırı = KELİME YARIŞI: iki taraf aynı kelimeyi görür, önce ve hatasız
//  yazan kelimeyi kazanır ve rakip ordudan birlik öldürür. Saldıran,
//  savunandan (+ sur avantajı) daha çok kelime kazanırsa parseli alır;
//  yoksa savunan parseli korur. Sur seviyesi × 3'ten düşük ordu seviyesiyle
//  o parsele saldırılamaz.
// ============================================================
import { FETIH, TERRAIN, UNITS, UNIT_INDEX, CAPITAL_CELLS, FETIH_PASSIVES, buildMap, armyLevel, armyCount, killsPerWord, RACE_WORDS } from '../data/fetih.js';

const U = UNITS.length;
const zero = () => new Array(U).fill(0);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const b36 = (n, w) => Math.max(0, Math.min(36 ** w - 1, n | 0)).toString(36).padStart(w, '0');

export function wordTime() { return FETIH.battle.wordTime; }

/** Parsel durumunu kısa metne çevir (ağ için) ve geri aç */
export function encodeCell(c) { return `${c.owner + 1}${c.camp}${c.mine}${c.wall}${b36(c.loot, 2)}${b36(c.gar, 1)}`; }
export function decodeCell(s) {
  return { owner: Number(s[0]) - 1, camp: Number(s[1]), mine: Number(s[2]), wall: Number(s[3]), loot: parseInt(s.slice(4, 6), 36), gar: parseInt(s[6], 36) };
}

/** Saldırı için kelime havuzu: kısa ve orta kelimeler karışık */
function battleWords(n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    // İlk kelimeler kısa, sonra uzar
    const maxLen = k < 2 ? 5 : k < 5 ? 6 : 8;
    let w;
    for (let tr = 0; tr < 20; tr++) { w = pick(RACE_WORDS); if (!out.includes(w) && w.length >= 3 && w.length <= maxLen) break; }
    out.push(w);
  }
  return out;
}

export class FetihSim {
  /** players: [{ key, name, char, ai }] — koltuk sırası (0..3); seed: harita tohumu */
  constructor(players, seed) {
    this.seed = seed;
    this.map = buildMap(seed);
    this.players = players.map((p, i) => ({
      ...p, idx: i, gold: FETIH.startGold, alive: true, place: 0, units: zero(),
      passive: FETIH_PASSIVES[p.char] ?? {}, kills: 0, captured: 0, lost: 0, held: 0,
      skill: rnd(0.88, 1.15),
    }));
    this.cells = this.map.map((m) => ({ owner: -1, camp: 0, mine: 0, wall: m.wall ?? 0, loot: m.loot ?? 0, gar: m.garrison ?? 0 }));
    this.capitals = CAPITAL_CELLS.map(([x, y]) => y * FETIH.size + x);
    for (const p of this.players) {
      const c = this.cells[this.capitals[p.idx]];
      c.owner = p.idx;
      c.camp = p.passive.startCamp ?? 1;
      c.wall = p.passive.startWall ?? 1;
      p.units[0] = 4;
      for (const [u, n] of Object.entries(p.passive.startUnits ?? {})) p.units[UNIT_INDEX[u]] += n;
      const ore = this.map[this.capitals[p.idx]].adj.find((j) => this.map[j].terrain === 'cevher');
      if (ore != null) this.cells[ore].owner = p.idx;
    }
    this.turn = Math.floor(Math.random() * 4);
    this.round = 1;
    this.phase = 'play';
    this.battle = null;
    this.over = null;
    this.seq = 0;
    this.fx = [];
    this.elimCount = 0;
    this.battleSeq = 0;
    this._startTurn();
  }

  // ---------------- yardımcılar ----------------
  get cur() { return this.players[this.turn]; }
  alivePlayers() { return this.players.filter((p) => p.alive); }
  owned(pi) { return this.cells.map((c, i) => ({ c, i })).filter((x) => x.c.owner === pi); }
  income(pi) {
    const own = this.owned(pi);
    if (!own.length) return 0;
    return FETIH.baseIncome + Math.floor(own.length * FETIH.parcelIncome) + own.reduce((a, x) => a + FETIH.mineIncome[x.c.mine], 0);
  }
  campLevel(pi) { return this.owned(pi).reduce((a, x) => Math.max(a, x.c.camp), 0); }
  unitCost(pi, ui) { return Math.max(1, UNITS[ui].cost - (this.players[pi].passive.unitDiscount?.[UNITS[ui].id] ?? 0)); }
  claimCost(ci) { return FETIH.claimCost + TERRAIN[this.map[ci].terrain].claim; }
  nextCost(ci, kind) {
    const c = this.cells[ci];
    if (kind === 'wall') return FETIH.wallCost[c.wall + 1] ?? null;
    if (kind === 'camp') return FETIH.campCost[c.camp + 1] ?? null;
    if (kind === 'mine') return TERRAIN[this.map[ci].terrain].ore ? FETIH.mineCost[c.mine + 1] ?? null : null;
    return null;
  }
  wallNeed(ci) { return this.cells[ci].wall * FETIH.wallReq; }
  bordersOwn(pi, ci) { return this.map[ci].adj.some((j) => this.cells[j].owner === pi); }
  _fx(e) { this.fx.push(e); this.seq++; }
  takeFx() { const f = this.fx; this.fx = []; return f; }

  // ---------------- tur ----------------
  _startTurn() {
    const p = this.cur;
    const inc = this.income(p.idx);
    p.gold += inc;
    this.attacksLeft = FETIH.attacks;
    this.turnLeft = FETIH.turnTime;
    this.aiTimer = FETIH.ai.think + 0.3;
    this.aiClaims = 0;
    this.aiHumanHits = 0;
    this._fx({ k: 'turn', p: p.idx, round: this.round, inc });
  }

  _endTurn() {
    if (this.over || this.battle) return;
    let next = this.turn;
    for (let k = 0; k < 4; k++) { next = (next + 1) % 4; if (this.players[next].alive) break; }
    if (next <= this.turn) this.round++;
    this.turn = next;
    if (this.round > FETIH.maxRounds) { this._finishByScore(); return; }
    this._startTurn();
  }

  _finishByScore() {
    const ranked = this.alivePlayers().sort((a, b) => this.owned(b.idx).length - this.owned(a.idx).length || armyLevel(b.units) - armyLevel(a.units) || b.gold - a.gold);
    ranked.forEach((p, i) => { p.place = i + 1; });
    this.phase = 'over';
    this.over = { winner: ranked[0]?.idx ?? -1, reason: 'rounds' };
    this._fx({ k: 'over', winner: this.over.winner, reason: 'rounds' });
  }

  // ---------------- eylemler ----------------
  act(pi, a) {
    if (this.over || !a) return false;
    if (this.battle) {
      if (a.t === 'bw') return this._battleWord(pi, a);
      if (a.t === 'bp') return this._battleProg(pi, a);
      return false;
    }
    if (pi !== this.turn || !this.players[pi]?.alive) return false;
    switch (a.t) {
      case 'claim': return this._claim(pi, a.c | 0);
      case 'build': return this._build(pi, a.c | 0, a.b);
      case 'recruit': return this._recruit(pi, a.u | 0, Math.max(1, a.n | 0));
      case 'attack': return this._attack(pi, a.to | 0);
      case 'end': this._endTurn(); return true;
      default: return false;
    }
  }

  canClaim(pi, ci) {
    const c = this.cells[ci], m = this.map[ci];
    return !!c && c.owner < 0 && c.gar === 0 && c.wall === 0 && TERRAIN[m.terrain].pass && this.bordersOwn(pi, ci) && this.players[pi].gold >= this.claimCost(ci);
  }

  _claim(pi, ci) {
    if (!this.canClaim(pi, ci)) return false;
    const cost = this.claimCost(ci);
    this.players[pi].gold -= cost;
    const c = this.cells[ci];
    c.owner = pi;
    const loot = c.loot;
    c.loot = 0;
    if (loot) this.players[pi].gold += loot;
    this._fx({ k: 'claim', p: pi, c: ci, cost, loot });
    return true;
  }

  _build(pi, ci, kind) {
    const c = this.cells[ci];
    if (!c || c.owner !== pi || !['wall', 'camp', 'mine'].includes(kind)) return false;
    const cost = this.nextCost(ci, kind);
    if (cost == null || this.players[pi].gold < cost) return false;
    this.players[pi].gold -= cost;
    c[kind]++;
    this._fx({ k: 'build', p: pi, c: ci, b: kind, lv: c[kind] });
    return true;
  }

  _recruit(pi, ui, n) {
    const p = this.players[pi];
    if (!UNITS[ui] || this.campLevel(pi) < UNITS[ui].camp) return false;
    const cost = this.unitCost(pi, ui);
    n = Math.min(n, Math.floor(p.gold / cost));
    if (n <= 0) return false;
    p.gold -= n * cost;
    p.units[ui] += n;
    this._fx({ k: 'recruit', p: pi, c: this.capitals[pi], u: ui, n });
    return true;
  }

  /** Hedefe komşu kendi parselin (orduyu oradan yürütmek için) */
  _launchCell(pi, to) {
    const adj = this.map[to].adj.filter((j) => this.cells[j].owner === pi);
    if (!adj.length) return -1;
    const cap = this.capitals[pi];
    return adj.sort((a, b) => this._dist(a, cap) - this._dist(b, cap))[0];
  }

  /** Saldırı yapılamıyorsa neden (boş metin = yapılabilir) */
  attackBlock(pi, to) {
    const p = this.players[pi], b = this.cells[to];
    if (!b || b.owner === pi || !TERRAIN[this.map[to].terrain].pass) return 'x';
    if (!this.bordersOwn(pi, to)) return 'Bu parsele komşu bir parselin olmalı.';
    if (b.owner < 0 && b.gar === 0 && b.wall === 0) return 'Boş parsel: saldırmana gerek yok, sahiplen.';
    if (!armyCount(p.units)) return 'Ordun yok: önce birlik yetiştir.';
    if (armyLevel(p.units) < this.wallNeed(to)) return `Ordu seviyen ${armyLevel(p.units)}, bu sur için en az ${this.wallNeed(to)} gerekir.`;
    if (this.attacksLeft <= 0) return 'Bu tur saldırı hakkın kalmadı.';
    return '';
  }
  canAttack(pi, to) { return this.attackBlock(pi, to) === ''; }

  _attack(pi, to) {
    if (!this.canAttack(pi, to)) return false;
    const b = this.cells[to];
    const att = this.players[pi];
    const from = this._launchCell(pi, to);
    this.attacksLeft--;
    const d = b.owner;
    const dU = d >= 0 ? this.players[d].units.slice() : (() => { const z = zero(); z[0] = b.gar; return z; })();
    const shield = Math.max(0, b.wall - (att.units[UNIT_INDEX.mancinik] || 0));
    const n = FETIH.battle.words + shield;
    this.battle = {
      id: ++this.battleSeq, a: pi, d, from, to, words: battleWords(n), i: 0, res: [],
      aU: att.units.slice(), dU, aU0: armyCount(att.units), dU0: armyCount(dU),
      shield, wall: b.wall, ap: 0, dp: shield, t: 0, wt: FETIH.battle.wordTime, delay: 1.6,
      prog: [0, 0], fin: [null, null], lost: [0, 0],
    };
    this._fx({ k: 'march', p: pi, from, to, units: att.units.slice(), kind: 'attack' });
    this._fx({ k: 'battle', b: this.battle.id, a: pi, d, from, to, n, shield, wall: b.wall, aN: armyCount(att.units), dN: armyCount(dU) });
    this.phase = 'battle';
    // Ok yağmuru: her 2 okçu savaş başında 1 düşman öldürür
    const B = this.battle;
    const va = Math.floor((B.aU[UNIT_INDEX.okcu] || 0) / 2), vd = Math.floor((B.dU[UNIT_INDEX.okcu] || 0) / 2);
    if (va) this._kill(B, 1, va);
    if (vd) this._kill(B, 0, vd);
    if (va || vd) this._fx({ k: 'volley', b: B.id, a: va, d: vd });
    if (armyCount(B.aU) === 0 || (d < 0 && armyCount(B.dU) === 0)) { B.ending = true; B.delay = 1.6; B.words = B.words.slice(0, 1); }
    this._prepWord();
    return true;
  }

  /** side: 0 = saldıran, 1 = savunan. Bu tarafın ordusundan n birlik öldür (zayıftan güçlüye). */
  _kill(B, side, n) {
    const units = side === 0 ? B.aU : B.dU;
    const owner = side === 0 ? this.players[B.a] : B.d >= 0 ? this.players[B.d] : null;
    let killed = 0;
    for (let j = 0; j < U && n > 0; j++) {
      while (units[j] > 0 && n > 0) {
        n--;
        if (owner?.passive.saveChance && Math.random() < owner.passive.saveChance) continue; // şifacı iyileştirdi
        units[j]--; killed++;
      }
    }
    B.lost[side] += killed;
    const killer = side === 0 ? (B.d >= 0 ? this.players[B.d] : null) : this.players[B.a];
    if (killer) killer.kills += killed;
    if (owner) owner.lost += killed;
    return killed;
  }

  /** Bir taraf yapay zekâ / haydut mu? Öyleyse yazma süresini hesapla. */
  _sideAi(B, side) {
    const pi = side === 0 ? B.a : B.d;
    if (pi < 0) return { per: this.map[B.to].terrain === 'hazine' ? FETIH.bandit.perChar * 0.85 : FETIH.bandit.perChar, skill: 1, typo: 0.2 };
    const p = this.players[pi];
    return p.ai && p.alive ? { per: FETIH.ai.perChar, skill: p.skill, typo: FETIH.ai.typo } : null;
  }

  _prepWord() {
    const B = this.battle;
    if (!B) return;
    const w = B.words[B.i];
    B.t = B.wt;
    B.prog = [0, 0];
    B.done = [false, false];
    for (const side of [0, 1]) {
      const ai = this._sideAi(B, side);
      if (!ai) { B.fin[side] = null; continue; }
      let at = 0.55 + w.length * ai.per * ai.skill * rnd(0.85, 1.15);
      if (Math.random() < ai.typo) at += rnd(0.6, 1.4);   // yazım hatası: baştan yazar
      B.fin[side] = at;
    }
  }

  _side(pi, B) { if (pi === B.a) return 0; if (pi === B.d) return 1; return -1; }

  /** İnsan oyuncu kelimeyi hatasız bitirdi */
  _battleWord(pi, a) {
    const B = this.battle;
    if (!B || a.b !== B.id || a.i !== B.i || B.delay > 0) return false;
    const side = this._side(pi, B);
    if (side < 0 || B.fin[side] != null || this.players[pi].ai) return false;
    this._winWord(side);
    return true;
  }

  /** İnsan oyuncunun ilerlemesi (rakibin ekranında çubuk olarak görünür) */
  _battleProg(pi, a) {
    const B = this.battle;
    if (!B || a.b !== B.id || a.i !== B.i) return false;
    const side = this._side(pi, B);
    if (side < 0) return false;
    B.prog[side] = Math.max(0, Math.min(B.words[B.i].length, a.n | 0));
    return true;
  }

  _winWord(side) {
    const B = this.battle;
    const w = B.words[B.i];
    let killed = 0;
    if (side === 0) { B.ap++; killed = this._kill(B, 1, killsPerWord(B.aU)); } else if (side === 1) {
      B.dp++;
      killed = this._kill(B, 0, killsPerWord(B.dU));
    }
    B.res.push(side === 0 ? 1 : side === 1 ? 2 : 0);
    this._fx({ k: 'word', b: B.id, i: B.i, win: side, w, killed, ap: B.ap, dp: B.dp });
    B.i++;
    B.delay = FETIH.battle.pause;
    const left = B.words.length - B.i;
    const done = armyCount(B.aU) === 0 || (B.d < 0 && armyCount(B.dU) === 0)
      || B.ap > B.dp + left || B.dp >= B.ap + left || left <= 0;
    if (done) { B.delay = 0.9; B.ending = true; } else this._prepWord();
  }

  _finishBattle() {
    const B = this.battle;
    this.battle = null;
    this.phase = 'play';
    const target = this.cells[B.to];
    const att = this.players[B.a];
    att.units = B.aU.slice();
    if (B.d >= 0) this.players[B.d].units = B.dU.slice();
    const won = armyCount(B.aU) > 0 && (B.ap > B.dp || (B.d < 0 && armyCount(B.dU) === 0));
    if (won) {
      const prev = target.owner;
      const loot = target.loot + target.mine * FETIH.lootPer.mine + target.camp * FETIH.lootPer.camp + target.wall * FETIH.lootPer.wall;
      target.owner = B.a;
      target.gar = 0;
      target.loot = 0;
      if (target.wall > 0) target.wall--;       // yıkılan sur bir seviye düşer
      if (target.mine > 0) target.mine--;       // yağmalanan maden bir seviye düşer
      att.gold += loot;
      att.captured++;
      this._fx({ k: 'capture', b: B.id, c: B.to, p: B.a, prev, loot, ap: B.ap, dp: B.dp, lost: B.lost });
      if (prev >= 0 && this.capitals[prev] === B.to) this._eliminate(prev, B.a);
    } else {
      if (B.d < 0) target.gar = armyCount(B.dU);
      else this.players[B.d].held++;
      this._fx({ k: 'repelled', b: B.id, c: B.to, from: B.from, d: B.d, a: B.a, ap: B.ap, dp: B.dp, lost: B.lost, units: B.aU.slice() });
    }
  }

  _eliminate(pi, by) {
    const p = this.players[pi];
    if (!p.alive) return;
    p.alive = false;
    this.elimCount++;
    p.place = 5 - this.elimCount;
    const take = Math.floor(p.gold * FETIH.capitalLoot);
    this.players[by].gold += take;
    p.gold = 0;
    p.units = zero();
    for (const c of this.cells) if (c.owner === pi) c.owner = -1;  // geri kalan parseller sahipsiz kalır
    this._fx({ k: 'elim', p: pi, by, gold: take });
    const alive = this.alivePlayers();
    if (alive.length <= 1) {
      if (alive[0]) alive[0].place = 1;
      this.phase = 'over';
      this.over = { winner: alive[0]?.idx ?? -1, reason: 'conquest' };
      this._fx({ k: 'over', winner: this.over.winner, reason: 'conquest' });
    }
  }

  // ---------------- zaman ----------------
  update(dt) {
    if (this.over) return;
    const B = this.battle;
    if (B) {
      if (B.delay > 0) {
        B.delay -= dt;
        if (B.delay <= 0 && B.ending) this._finishBattle();
        return;
      }
      B.t -= dt;
      const el = B.wt - B.t;
      // Yapay zekâ / haydut tarafı kelimeyi bitirdi mi? (ilk biten kazanır)
      const f0 = B.fin[0], f1 = B.fin[1];
      const due = [f0 != null && el >= f0, f1 != null && el >= f1];
      if (due[0] || due[1]) {
        const side = due[0] && due[1] ? (f0 <= f1 ? 0 : 1) : due[0] ? 0 : 1;
        this._winWord(side);
        return;
      }
      if (B.t <= 0) this._winWord(-1);   // kimse yazamadı: berabere
      return;
    }
    const p = this.cur;
    if (p.ai) {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) { this.aiTimer = FETIH.ai.think; this._aiStep(p.idx); }
    } else {
      this.turnLeft -= dt;
      if (this.turnLeft <= 0) { this._fx({ k: 'timeout', p: p.idx }); this._endTurn(); }
    }
  }

  // ================= YAPAY ZEKÂ =================
  _dist(a, b) { return Math.abs(this.map[a].x - this.map[b].x) + Math.abs(this.map[a].y - this.map[b].y); }

  /** Kabaca kazanma şansı */
  _winChance(pi, to) {
    const c = this.cells[to];
    const p = this.players[pi];
    const shield = Math.max(0, c.wall - (p.units[UNIT_INDEX.mancinik] || 0));
    let base = c.owner < 0 ? 0.88 : this.players[c.owner].ai ? 0.5 : 0.5;
    base -= shield * 0.14;
    const myN = armyCount(p.units), theirN = c.owner < 0 ? c.gar : armyCount(this.players[c.owner].units);
    base += Math.max(-0.15, Math.min(0.15, (killsPerWord(p.units) - 1) * 0.05 - (theirN > myN * 1.5 ? 0.1 : 0)));
    if (myN < 3) base -= 0.2;
    // Rakip tek kelimede ordumu silebiliyorsa saldırma
    const theirU = c.owner < 0 ? [c.gar, 0, 0, 0, 0, 0] : this.players[c.owner].units;
    if (killsPerWord(theirU) * 2 >= myN) base -= 0.35;
    return base;
  }

  _aiStep(pi) {
    const p = this.players[pi];
    const own = this.owned(pi);
    const cap = this.capitals[pi];
    const capC = this.cells[cap];
    // 1) Saldırı fırsatı
    if (this.attacksLeft > 0 && armyCount(p.units) >= 3) {
      let best = null;
      const seen = new Set();
      for (const x of own) for (const j of this.map[x.i].adj) {
        if (seen.has(j)) continue;
        seen.add(j);
        if (!this.canAttack(pi, j)) continue;
        const t = this.cells[j];
        if (t.owner >= 0 && !this.players[t.owner].ai && this.aiHumanHits >= 1) continue;
        const ch = this._winChance(pi, j);
        if (ch < 0.42) continue;
        let v = 3 + t.loot * 0.4 + t.mine * 3 + t.camp * 2 + (TERRAIN[this.map[j].terrain].ore ? 2 : 0);
        if (t.owner >= 0 && this.capitals[t.owner] === j) v += 12;
        if (t.owner >= 0 && this.round < 4) v -= 3;
        const s = v * ch;
        if (!best || s > best.s) best = { s, to: j };
      }
      if (best && best.s > 2.4) {
        const t = this.cells[best.to];
        if (t.owner >= 0 && !this.players[t.owner].ai) this.aiHumanHits++;
        this._attack(pi, best.to);
        return;
      }
    }
    // 2) Ekonomi: maden kur/geliştir
    const mineSpots = own.map((x) => ({ x, cost: this.nextCost(x.i, 'mine') })).filter((m) => m.cost != null).sort((a, b) => a.cost - b.cost);
    if (mineSpots.length && p.gold >= mineSpots[0].cost) { this._build(pi, mineSpots[0].x.i, 'mine'); return; }
    const saving = mineSpots.length && this.round < 9 && armyCount(p.units) >= 5 ? mineSpots[0].cost : 0;
    // 3) Başkent suru
    if (capC.wall < 2 && this.round > 4) {
      const cost = this.nextCost(cap, 'wall');
      if (cost != null && p.gold >= cost) { this._build(pi, cap, 'wall'); return; }
    }
    // 4) Boş parsel sahiplen (önce cevher / ganimet)
    const claimable = [];
    for (const x of own) for (const j of this.map[x.i].adj) if (this.canClaim(pi, j) && !claimable.includes(j)) claimable.push(j);
    if (claimable.length && this.aiClaims < (this.round < 4 ? 2 : 1) && p.gold >= this.claimCost(claimable[0]) + 2) {
      this.aiClaims++;
      claimable.sort((a, b) => (TERRAIN[this.map[b].terrain].ore ? 1 : 0) - (TERRAIN[this.map[a].terrain].ore ? 1 : 0) || this.cells[b].loot - this.cells[a].loot);
      this._claim(pi, claimable[0]);
      return;
    }
    // 5) Kamp geliştir
    if (capC.camp < 3 && p.gold >= (this.nextCost(cap, 'camp') ?? 99) + 6 && this.round > 3) { this._build(pi, cap, 'camp'); return; }
    // 6) Birlik yetiştir
    const camp = this.campLevel(pi);
    const budget = p.gold - saving;
    if (camp && budget >= 2) {
      for (let ui = U - 1; ui >= 0; ui--) {
        if (UNITS[ui].camp > camp) continue;
        const cost = this.unitCost(pi, ui);
        if (budget >= cost * (ui > 1 ? 1.4 : 1)) { this._recruit(pi, ui, Math.max(1, Math.floor(budget / cost / (ui > 1 ? 2 : 1)))); return; }
      }
    }
    this._endTurn();
  }

  // ================= DURUM =================
  snapshot() {
    const B = this.battle;
    let bs = null;
    if (B) {
      const el = B.wt - B.t;
      const w = B.words[B.i] ?? '';
      // Yapay zekâ ilerlemesi: süreye göre harf sayısı
      const prog = [0, 1].map((s) => (B.fin[s] != null ? Math.min(w.length - 1, Math.floor((Math.max(0, el - 0.4) / Math.max(0.1, B.fin[s] - 0.4)) * w.length)) : B.prog[s]));
      bs = { id: B.id, a: B.a, d: B.d, from: B.from, to: B.to, w, n: B.words.length, i: B.i, res: B.res, aU: B.aU, dU: B.dU, aU0: B.aU0, dU0: B.dU0,
        sh: B.shield, wall: B.wall, ap: B.ap, dp: B.dp, t: Math.max(0, B.t), wt: B.wt, delay: Math.max(0, B.delay), end: !!B.ending, prog: prog.map((x) => Math.max(0, x)) };
    }
    return {
      seq: this.seq, seed: this.seed, ph: this.phase, turn: this.turn, round: this.round,
      atk: this.attacksLeft, tl: Math.max(0, Math.round(this.turnLeft)),
      P: this.players.map((p) => ({ key: p.key, name: p.name, char: p.char, ai: !!p.ai, gold: p.gold, alive: p.alive, place: p.place, inc: this.income(p.idx), kills: p.kills, cap: p.captured, held: p.held, u: p.units, camp: this.campLevel(p.idx) })),
      C: this.cells.map(encodeCell),
      B: bs,
      over: this.over,
    };
  }

  /** Host değişince son durumdan simülasyonu yeniden kur (yarım kalan savaş iptal olur) */
  static fromSnapshot(snap, players) {
    const sim = new FetihSim(players, snap.seed);
    sim.fx = [];
    snap.P.forEach((sp, i) => Object.assign(sim.players[i], { gold: sp.gold, alive: sp.alive, place: sp.place, kills: sp.kills, captured: sp.cap, held: sp.held ?? 0, units: sp.u.slice(), ai: players[i].ai }));
    snap.C.forEach((s, i) => Object.assign(sim.cells[i], decodeCell(s)));
    sim.turn = snap.turn; sim.round = snap.round; sim.attacksLeft = snap.atk; sim.turnLeft = snap.tl;
    sim.elimCount = sim.players.filter((p) => !p.alive).length;
    sim.phase = snap.over ? 'over' : 'play';
    sim.over = snap.over;
    sim.seq = snap.seq + 1;
    return sim;
  }
}
