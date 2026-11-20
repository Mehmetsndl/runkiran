// ============================================================
//  DENİZ SAVAŞI SİMÜLASYONU
//  Yalnızca maçın "host"u (sunucu oyuncusu) çalıştırır. Diğer oyuncular
//  eylemlerini (top atışı, onarım...) host'a yollar; host bunları uygular,
//  yapay zekâ oyuncularını oynatır ve durumu herkese yayınlar.
//  Host düşerse sıradaki oyuncu son durumdan devam eder (load()).
// ============================================================
import { NAVAL } from '../data/naval.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class NavalSim {
  constructor(players) {
    this.players = players; // [{key, nick, team, role, ai}]
    this.state = {
      t: 0,
      ships: [0, 1].map(() => ({ hp: NAVAL.shipHp, max: NAVAL.shipHp, armor: 0, hull: 0 })),
      barrel: null,
      over: null,
      impact: {},  // oyuncu anahtarı → hasar + onarım
      seq: 0,
    };
    this.aiTimers = {};
    this.barrelTimer = NAVAL.barrel.every;
    this.fx = []; // bu karede üretilen görsel olaylar
  }

  load(state) {
    this.state = JSON.parse(JSON.stringify(state));
    this.state.impact = this.state.impact || {};
  }

  player(key) { return this.players.find((p) => p.key === key); }

  /** Bir oyuncunun eylemini uygula. Dönen fx herkese yayınlanır. */
  apply(key, a) {
    const st = this.state;
    if (st.over) return null;
    const p = this.player(key);
    if (!p || !a) return null;
    const own = st.ships[p.team];
    const enemy = st.ships[1 - p.team];
    let fx = null;

    if (a.k === 'fire' && p.role === 'topcu') {
      let dmg = Math.min(NAVAL.fire.maxPerShot, Math.max(0, Number(a.dmg) || 0));
      const barrelHit = a.barrel && st.barrel && st.barrel.id === a.barrel && st.barrel.target === 1 - p.team;
      if (barrelHit) {
        dmg = Math.min(NAVAL.fire.maxPerShot * NAVAL.fire.barrelMult, dmg * NAVAL.fire.barrelMult);
        st.barrel = null;
      }
      const dealt = Math.round(dmg * (1 - enemy.armor));
      enemy.hp = Math.max(0, enemy.hp - dealt);
      st.impact[key] = (st.impact[key] || 0) + dealt;
      fx = { k: 'fire', by: key, team: p.team, amt: dealt, crit: !!a.crit, zone: a.zone | 0, barrel: !!barrelHit };
    } else if (p.role === 'savunma') {
      if (a.k === 'repair') {
        const before = own.hp;
        own.hp = Math.min(own.max, own.hp + NAVAL.repair.amount);
        const healed = Math.round(own.hp - before);
        st.impact[key] = (st.impact[key] || 0) + healed;
        fx = { k: 'repair', by: key, team: p.team, amt: healed };
      } else if (a.k === 'armor' && own.armor < NAVAL.armor.max - 1e-6) {
        own.armor = Math.min(NAVAL.armor.max, own.armor + NAVAL.armor.step);
        st.impact[key] = (st.impact[key] || 0) + 30;
        fx = { k: 'armor', by: key, team: p.team, amt: Math.round(own.armor * 100) };
      } else if (a.k === 'hull' && own.hull < NAVAL.hull.max) {
        own.hull++;
        own.max += NAVAL.hull.maxHp;
        own.hp = Math.min(own.max, own.hp + NAVAL.hull.heal);
        st.impact[key] = (st.impact[key] || 0) + NAVAL.hull.heal;
        fx = { k: 'hull', by: key, team: p.team, amt: own.hull };
      }
    }
    if (fx) {
      st.seq++;
      this.fx.push(fx);
      this._checkOver();
    }
    return fx;
  }

  update(dt) {
    const st = this.state;
    if (st.over) return;
    st.t += dt;

    // Yapay zekâ oyuncular
    for (const p of this.players) {
      if (!p.ai) continue;
      const range = p.role === 'topcu' ? NAVAL.ai.attackEvery : NAVAL.ai.defendEvery;
      if (this.aiTimers[p.key] == null) this.aiTimers[p.key] = rand(...range) + 1.5;
      this.aiTimers[p.key] -= dt;
      if (this.aiTimers[p.key] > 0) continue;
      this.aiTimers[p.key] = rand(...range);
      if (p.role === 'topcu') {
        const len = 3 + Math.floor(Math.random() * 3);
        let dmg = NAVAL.fire.base + NAVAL.fire.perLetter * len;
        const crit = Math.random() < 0.12;
        if (crit) dmg *= NAVAL.fire.critMult;
        const barrel = st.barrel && st.barrel.target === 1 - p.team && Math.random() < 0.35 ? st.barrel.id : null;
        this.apply(p.key, { k: 'fire', dmg, crit, zone: Math.floor(Math.random() * 3), barrel });
      } else {
        const own = st.ships[p.team];
        const ratio = own.hp / own.max;
        let k = 'repair';
        if (ratio > 0.8 && own.armor < NAVAL.armor.max && Math.random() < 0.5) k = 'armor';
        else if (ratio > 0.6 && own.hull < NAVAL.hull.max && Math.random() < 0.3) k = 'hull';
        this.apply(p.key, { k });
      }
    }

    // Barut fıçısı
    if (st.barrel && st.t > st.barrel.until) st.barrel = null;
    this.barrelTimer -= dt;
    if (this.barrelTimer <= 0) {
      this.barrelTimer = NAVAL.barrel.every;
      st.barrel = { id: (st.seq + 1) * 7 + Math.floor(Math.random() * 1000), target: Math.random() < 0.5 ? 0 : 1, until: st.t + NAVAL.barrel.life };
      st.seq++;
    }

    if (st.t >= NAVAL.duration) {
      const r0 = st.ships[0].hp / st.ships[0].max;
      const r1 = st.ships[1].hp / st.ships[1].max;
      st.over = { winner: r0 === r1 ? -1 : r0 > r1 ? 0 : 1, reason: 'time' };
      st.seq++;
    }
  }

  _checkOver() {
    const st = this.state;
    if (st.over) return;
    const dead = st.ships.findIndex((s) => s.hp <= 0);
    if (dead >= 0) {
      st.over = { winner: 1 - dead, reason: 'sunk' };
      st.seq++;
    }
  }

  /** Yayınlanacak durum (küçük tutulur) */
  snapshot() {
    const st = this.state;
    return {
      t: Math.round(st.t * 10) / 10,
      ships: st.ships.map((s) => ({ hp: Math.round(s.hp), max: s.max, armor: Math.round(s.armor * 100) / 100, hull: s.hull })),
      barrel: st.barrel,
      over: st.over,
      impact: st.impact,
      seq: st.seq,
      ai: this.players.filter((p) => p.ai).map((p) => p.key),
    };
  }

  takeFx() {
    const out = this.fx;
    this.fx = [];
    return out;
  }
}
