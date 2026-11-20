// ============================================================
//  BOSS AVI MODU
//  Tek başına ya da 2-4 kişi aynı bossa karşı. Çevrim içinde host bossu
//  yönetir (konum, yetenekler, ortak can); diğer oyuncular bossun kopyasını
//  host'tan gelen konuma göre çizer, yetenek olaylarını kendi dünyasında
//  oynatır ve verdikleri hasarı host'a yollar. Yardımcı yaratıklar herkesin
//  kendi dünyasında doğar. Düşen oyuncu birkaç saniye sonra kalkar; herkes
//  aynı anda düşerse ya da süre biterse av başarısız olur.
// ============================================================
import * as THREE from 'three';
import { ENEMY_TYPES } from '../../data/enemies.js';
import { BOSS_RAID, RAID_BOSS_BY_ID } from '../../data/bossRaid.js';
import { getCharacter } from '../../data/characters.js';
import { buildPlayerModel } from '../../entities/PlayerModels.js';
import { pickWeighted } from '../../utils.js';
import { fmtClock } from './TimedWaveMode.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class BossRaidMode {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.raid = game.raidOpts ?? {
      boss: 'trol', diff: 'normal', online: false, channel: null, myKey: 'me', hostKey: 'me',
      players: [{ key: 'me', name: game.leaderboard.nick || 'Avcı', ch: game.character.id }], match: { id: 'solo' },
    };
    this.info = RAID_BOSS_BY_ID[this.raid.boss] ?? RAID_BOSS_BY_ID.trol;
    this.diff = BOSS_RAID.difficulties[this.raid.diff] ?? BOSS_RAID.difficulties.normal;
    this.online = !!this.raid.online;
    this.myKey = this.raid.myKey;
    this.hostKey = this.raid.hostKey;
    this.isHost = !this.online || this.hostKey === this.myKey;
    this.livePause = this.online;
    this.phase = 0;
    this.enraged = false;
    this.addsT = 6;
    this.dmgBy = {};          // host: oyuncu → boss'a verdiği hasar
    this.myDmg = 0;
    this.pendingDmg = 0;
    this.fxQueue = [];
    this.pubT = 0;
    this.sendT = 0;
    this.targetT = 0;
    this.targetKey = this.myKey;
    this.dead = false;
    this.reviveT = 0;
    this.over = null;
    this.endAt = 0;
    this.lastSeen = {};
    this.ghosts = new Map();
    this.seq = 0;
    this.unsubs = [];
  }

  get hpScale() { return 1 + (this.game.elapsed / 60) * 0.25; }

  /** Kamera kahraman ile bossun arasına (kahramana yakın) bakar */
  get cameraFocus() {
    const pp = this.game.player.position;
    const f = this._focus ?? (this._focus = new THREE.Vector3());
    const b = this.boss;
    if (!b?.alive) return f.copy(pp);
    const bp = b.mesh.position;
    const d = Math.hypot(bp.x - pp.x, bp.z - pp.z);
    const w = d < 22 ? 0.35 : 0.12;
    return f.set(pp.x + (bp.x - pp.x) * w, 0, pp.z + (bp.z - pp.z) * w);
  }

  setup() {
    const g = this.game;
    const n = this.raid.players.length;
    const base = ENEMY_TYPES[this.info.id];
    const bdef = {
      ...base,
      hp: Math.round(this.info.hp * this.diff.hp * (1 + BOSS_RAID.perPlayerHp * (n - 1))),
      damage: Math.round(base.damage * this.diff.dmg),
      spitDmg: (base.spitDmg ?? 12) * this.diff.dmg,
      xp: 0,
    };
    // Oyuncular yan yana başlar, boss karşıda
    const seat = Math.max(0, this.raid.players.findIndex((p) => p.key === this.myKey));
    g.player.position.set((seat - (n - 1) / 2) * 3, 0, 4);
    const boss = g.waves.spawn(this.info.id, { def: bdef, hpScale: 1 });
    boss.mesh.position.set(0, 0, -14);
    boss.raidBoss = true;
    boss.dmgMult = 1;
    this.boss = boss;
    if (!this.isHost) boss.net = { x: 0, z: -14, ry: 0 };
    this._wireNet();
    for (const p of this.raid.players) if (p.key !== this.myKey) this._addGhost(p);
    this._view = g.sceneMgr.viewSize;
    g.sceneMgr.setViewSize(this._view * 1.18);
    this._hint = document.getElementById('hintText');
    this._hintOld = this._hint?.textContent;
    if (this._hint) this._hint.textContent = 'Boss Avı · Yaz ve vur · Space: ulti · Esc: menü';
    g.hud.showBanner(`${this.info.icon} ${this.info.name.toLocaleUpperCase('tr-TR')}`, this.online ? `${n} avcı · ${this.diff.name} · ortak can` : `Tek başına · ${this.diff.name}`);
  }

  // ---------------- ağ ----------------
  _wireNet() {
    const ch = this.raid.channel;
    if (!this.online || !ch) return;
    this.channel = ch;
    if (this.isHost) this.game.waves.bosses.netFx = (f) => this.fxQueue.push(f);
    this.unsubs.push(
      ch.onAction((peer, a) => this._onAction(peer, a)),
      ch.onFx((list, peer) => { if (!this.isHost && peer === this.hostKey) for (const f of list) this._onFx(f); }),
    );
  }

  _onAction(peer, a) {
    if (!this.isHost || !a) return;
    if (a.t === 'dmg') {
      const n = Math.max(0, Math.min(5000, Number(a.n) || 0));
      this.dmgBy[peer] = (this.dmgBy[peer] ?? 0) + n;
      if (this.boss?.alive && n > 0) this.game.damageEnemy(this.boss, n, { dot: true, helper: true, remote: true });
    }
  }

  _onFx(f) {
    if (!this.boss?.alive) return;
    if (f.k === 'phase') this._applyPhase(f.n);
    else if (f.k === 'enrage') this._enrage();
    else this.game.waves.bosses.handleFx(this.boss, f);
  }

  _me() {
    const p = this.game.player;
    return {
      x: +p.position.x.toFixed(2), z: +p.position.z.toFixed(2), ry: +p.mesh.rotation.y.toFixed(2),
      hp: Math.max(0, Math.round(p.hp)), mhp: Math.round(this.game.stats.maxHp), dead: this.dead, dmg: Math.round(this.myDmg),
    };
  }

  _publish(dt) {
    if (!this.channel) return;
    if (this.fxQueue.length) { this.channel.sendFx(this.fxQueue); this.fxQueue = []; }
    this.pubT -= dt;
    if (this.pubT > 0) return;
    this.pubT = this.isHost ? 0.1 : 0.15;
    const patch = { me: this._me() };
    if (this.isHost) {
      const b = this.boss;
      this.dmgBy[this.myKey] = this.myDmg;
      patch.st = {
        seq: ++this.seq, t: Math.round(this.game.elapsed),
        b: b ? { x: +b.mesh.position.x.toFixed(2), z: +b.mesh.position.z.toFixed(2), ry: +b.mesh.rotation.y.toFixed(2), hp: Math.max(0, Math.round(b.hp)), mx: Math.round(b.maxHp), ct: +b.castT.toFixed(2), ap: +b.attackPulse.toFixed(2), dead: !b.alive } : null,
        ph: this.phase, en: this.enraged, over: this.over, dmg: this.dmgBy,
      };
    }
    this.channel.publish(patch);
  }

  _readHost() {
    if (this.isHost || !this.channel) return;
    const st = this.channel.presenceOf(this.hostKey)?.st;
    if (!st || st.seq === this._lastSeq) return;
    this._lastSeq = st.seq;
    this.hostDmg = st.dmg ?? {};
    const b = this.boss;
    if (st.b && b?.alive) {
      if (b.net) { b.net.x = st.b.x; b.net.z = st.b.z; b.net.ry = st.b.ry; }
      b.castT = Math.max(b.castT, st.b.ct);
      if (st.b.ap > b.attackPulse + 0.3) b.attackPulse = st.b.ap;
      b.maxHp = st.b.mx;
      if (st.b.hp < b.hp) b.hp = Math.max(1, st.b.hp);
      if (st.b.dead) {
        b.net = null;
        b.hp = 0;
        this.game.killEnemy(b, 1, {});
      }
    }
    if (st.ph > this.phase) this._applyPhase(st.ph);
    if (st.en && !this.enraged) this._enrage();
    if (st.over && !this.over) this._finish(st.over);
  }

  /** Host ayrılırsa sıradaki oyuncu bossu devralır */
  _watchHost(dt) {
    if (this.isHost || !this.channel) return;
    this._hostT = (this._hostT ?? 0) - dt;
    if (this._hostT > 0) return;
    this._hostT = 1;
    const present = this.channel.presentKeys();
    const now = performance.now();
    if (present.has(this.hostKey)) { this.lastSeen[this.hostKey] = now; return; }
    this.lastSeen[this.hostKey] ??= now;
    if (now - this.lastSeen[this.hostKey] < 5000) return;
    const next = this.raid.players.map((p) => p.key).find((k) => k !== this.hostKey && present.has(k));
    if (!next) return;
    this.hostKey = next;
    this._removeGhostsMissing(present);
    if (next === this.myKey) {
      this.isHost = true;
      if (this.boss?.alive) {
        this.boss.net = null;
        this.boss.ab = { cd: 2, cd2: 5, phase: 'idle', t: 0 };
      }
      this.game.waves.bosses.netFx = (f) => this.fxQueue.push(f);
      this.game.floating.spawn(this.game.player.position.clone().setY(3), 'AVIN LİDERİ SENSİN', 'multi');
    }
  }

  // ---------------- müttefikler ----------------
  _addGhost(p) {
    const g = this.game;
    const model = buildPlayerModel(getCharacter(p.ch));
    const group = new THREE.Group();
    group.add(model.root);
    group.position.set(0, 0, 4);
    g.scene.add(group);
    const label = document.createElement('div');
    label.className = 'label ally';
    label.innerHTML = `<div class="word">${esc(p.name)}</div><div class="hpbar"><i></i></div>`;
    document.getElementById('labels').appendChild(label);
    this.ghosts.set(p.key, { p, group, model, label, hpEl: label.querySelector('i'), pos: group.position, target: { x: 0, z: 4, ry: 0 }, dead: false, hp: 1, mhp: 1, t: Math.random() * 5 });
  }

  _removeGhostsMissing(present) {
    for (const [k, gh] of this.ghosts) if (!present.has(k)) gh.gone = true;
  }

  _updateGhosts(dt) {
    if (!this.channel) return;
    const k = 1 - Math.exp(-dt * 10);
    const present = this.channel.presentKeys();
    for (const [key, gh] of this.ghosts) {
      const me = this.channel.presenceOf(key)?.me;
      gh.gone = !present.has(key);
      if (me) { gh.target = me; gh.dead = !!me.dead; gh.hp = me.hp; gh.mhp = me.mhp || 1; gh.dmg = me.dmg; }
      const vx = gh.target.x - gh.pos.x, vz = gh.target.z - gh.pos.z;
      gh.pos.x += vx * k; gh.pos.z += vz * k;
      gh.group.rotation.y += (((gh.target.ry - gh.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;
      gh.t += dt;
      const moving = Math.hypot(vx, vz) > 0.05;
      gh.model.root.position.y = moving ? Math.abs(Math.sin(gh.t * 9)) * 0.12 : 0;
      gh.model.root.rotation.z = gh.dead ? 1.45 : 0;
      gh.group.visible = !gh.gone;
    }
  }

  _placeLabels() {
    const cam = this.game.camera;
    const w = window.innerWidth, h = window.innerHeight;
    const v = this._v ?? (this._v = new THREE.Vector3());
    for (const gh of this.ghosts.values()) {
      v.copy(gh.pos); v.y += 2.6;
      v.project(cam);
      if (gh.gone || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { gh.label.style.display = 'none'; continue; }
      gh.label.style.display = '';
      gh.label.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -100%)`;
      gh.hpEl.style.width = `${Math.max(0, (gh.hp / gh.mhp) * 100)}%`;
      gh.label.classList.toggle('dead', gh.dead);
    }
  }

  // ---------------- oyun ----------------
  update(dt) {
    const g = this.game;
    this._readHost();
    this._watchHost(dt);
    this._updateGhosts(dt);
    if (this.over) { this._publish(dt); return; }

    // Yardımcı yaratıklar (herkesin kendi dünyasında)
    this.addsT -= dt;
    if (this.addsT <= 0 && this.boss?.alive) {
      this.addsT = BOSS_RAID.addsEvery * (this.enraged ? 0.7 : 1);
      if (g.enemies.length < 14) {
        const n = 2 + this.phase + (this.enraged ? 1 : 0);
        const angle = Math.random() * Math.PI * 2;
        for (let i = 0; i < n; i++) g.waves.spawn(pickWeighted(this.info.adds), { hpScale: this.hpScale, angle, spread: 1.2, radius: 20 });
      }
    }

    if (this.isHost && this.boss?.alive) {
      // Fazlar ve öfke
      const r = this.boss.hp / this.boss.maxHp;
      const next = BOSS_RAID.phases.filter((p) => r <= p).length;
      if (next > this.phase) { this._applyPhase(next); this.fxQueue.push({ k: 'phase', n: next }); }
      if (!this.enraged && g.elapsed >= BOSS_RAID.enrageAt) { this._enrage(); this.fxQueue.push({ k: 'enrage' }); }
      // Hedef: bossa en yakın ayakta oyuncu
      this.targetT -= dt;
      if (this.targetT <= 0) {
        this.targetT = 2.5;
        const bp = this.boss.mesh.position;
        let best = null, bd = Infinity;
        const cands = [{ key: this.myKey, pos: g.player.position, dead: this.dead }, ...[...this.ghosts].map(([key, gh]) => ({ key, pos: gh.pos, dead: gh.dead || gh.gone }))];
        for (const c of cands) {
          if (c.dead) continue;
          const d = Math.hypot(c.pos.x - bp.x, c.pos.z - bp.z) + Math.random() * 2;
          if (d < bd) { bd = d; best = c.key; }
        }
        this.targetKey = best ?? this.myKey;
      }
      // Kaybetme: süre bitti ya da herkes aynı anda yerde
      if (g.elapsed >= BOSS_RAID.timeLimit) this._finish({ result: 'lose', reason: 'time' });
      else if (this.online && this.dead && [...this.ghosts.values()].every((gh) => gh.dead || gh.gone)) this._finish({ result: 'lose', reason: 'wipe' });
    }

    // Düşen oyuncu kalkar
    if (this.dead) {
      this.reviveT -= dt;
      g.player.model.root.rotation.z = 1.45;
      if (this.reviveT <= 0) this._revive();
    }

    // Hasarı toplu yolla
    this.sendT -= dt;
    if (!this.isHost && this.channel && this.pendingDmg > 0 && this.sendT <= 0) {
      this.sendT = 0.1;
      this.channel.sendAction({ t: 'dmg', n: Math.round(this.pendingDmg * 10) / 10 });
      this.pendingDmg = 0;
    }
    this._publish(dt);
  }

  _applyPhase(n) {
    const g = this.game;
    while (this.phase < n) {
      this.phase++;
      const b = this.boss;
      if (b?.alive) {
        b.rage = (b.rage ?? 1) + 0.3;
        b.speed *= 1.12;
        g.particles.ring(b.mesh.position, 0xff3b3b, 10, 0.8);
        g.particles.burst(b.mesh.position.clone().setY(2), [0xff3b3b, 0xffd84a, 0xffffff], 70, { speed: 18, size: 0.35, life: 1 });
      }
      g.waves.bosses._roar();
      g.sceneMgr.addShake(1.2);
      g.hud.screenFlash('red');
      g.hud.showBanner(`⚠️ ${this.phase + 1}. FAZ`, `${this.info.name} öfkeleniyor · herkese bir kart seçimi ve %25 can`);
      g.player.heal(g.stats.maxHp * 0.25);
      g.xp.pendingLevels += 1;
    }
  }

  _enrage() {
    const g = this.game;
    this.enraged = true;
    const b = this.boss;
    if (b?.alive) { b.rage = (b.rage ?? 1) + 0.4; b.dmgMult = 1.6; b.speed *= 1.2; }
    g.hud.showBanner('🔥 ÖFKE!', `Boss çıldırdı · ${fmtClock(BOSS_RAID.timeLimit - g.elapsed)} kaldı`);
    g.hud.screenFlash('red');
    g.waves.bosses._roar();
  }

  /** Çevrim içinde kart seçimi oyunu durdurmaz (ekip savaşmaya devam eder); tek başına normal kart ekranı açılır */
  get liveLevel() { return this.online; }

  enemyTarget(e) {
    if (e === this.boss && this.isHost && this.targetKey !== this.myKey) {
      const gh = this.ghosts.get(this.targetKey);
      if (gh && !gh.dead && !gh.gone) return gh.pos;
    }
    return this.game.player.position;
  }

  afterEnemies() {}

  onEnemyDamaged(e, dmg, opts) {
    if (e !== this.boss) return;
    if (!opts.remote) {
      this.myDmg += dmg;
      if (!this.isHost) this.pendingDmg += dmg;
    }
    if (e.net && e.hp <= 0) e.hp = 1; // ölümüne host karar verir
  }

  onEnemyKilled(e) {
    if (e !== this.boss) return;
    this.killedAt = this.game.elapsed;
    if (this.isHost) this._finish({ result: 'win', t: Math.round(this.game.elapsed) });
  }

  _finish(over) {
    if (this.over) return;
    this.over = over;
    this.endAt = this.game.elapsed + (over.result === 'win' ? 2.8 : 1.2);
    if (this.isHost && this.channel) { this.pubT = 0; this._publish(0); }
  }

  checkEnd() {
    if (!this.over || this.game.elapsed < this.endAt) return null;
    const n = this.raid.players.length;
    if (this.over.result === 'win') {
      return { result: 'win', title: `${this.info.name.toLocaleUpperCase('tr-TR')} DEVRİLDİ!`, sub: `${fmtClock(this.over.t ?? this.game.elapsed)} sürede · ${n > 1 ? `${n} kişilik ekip` : 'tek başına'} · ${this.diff.name}` };
    }
    return { result: 'lose', title: 'AV BAŞARISIZ', sub: this.over.reason === 'time' ? 'Süre doldu, boss kaçtı.' : this.over.reason === 'wipe' ? 'Bütün ekip aynı anda düştü.' : 'Boss seni yendi.' };
  }

  onPlayerDeath() {
    const g = this.game;
    if (!this.online) {
      this._finish({ result: 'lose', reason: 'dead' });
      return { result: 'lose', title: 'AV BAŞARISIZ', sub: `${this.info.name} seni yendi. Tekrar dene!` };
    }
    if (this.dead) return null;
    this.dead = true;
    this.reviveT = BOSS_RAID.reviveTime;
    g.player.hp = 0;
    g.player.invuln = 999;
    g.player.anchor = g.player.position.clone();
    g.typing.cancel();
    g.hud.showBanner('💀 DÜŞTÜN', `${BOSS_RAID.reviveTime} sn sonra kalkacaksın · ekibin savaşıyor`);
    return null;
  }

  _revive() {
    const g = this.game;
    this.dead = false;
    g.player.anchor = null;
    g.player.hp = g.stats.maxHp * 0.5;
    g.player.invuln = 2;
    g.player.model.root.rotation.z = 0;
    g.particles.ring(g.player.position, 0x7dff9a, 5, 0.6);
    g.particles.burst(g.player.position.clone().setY(1), [0x7dff9a, 0xffffff], 30, { speed: 9, size: 0.25 });
    g.audio.heal?.();
    g.floating.spawn(g.player.position.clone().setY(3), 'AYAĞA KALKTI!', 'heal');
  }

  blockInput() { return this.dead; }

  summary() {
    const g = this.game;
    const won = this.over?.result === 'win';
    const stats = [
      { label: 'Boss', value: `${this.info.icon} ${this.info.name}` },
      { label: 'Süre', value: fmtClock(this.killedAt ?? g.elapsed) },
      { label: 'Boss\'a hasarın', value: Math.round(this.myDmg).toLocaleString('tr-TR') },
    ];
    if (this.online) {
      const total = Object.values(this._dmgTable()).reduce((a, n) => a + n, 0) || 1;
      stats.push({ label: 'Ekipteki payın', value: `%${Math.round((this.myDmg / total) * 100)}` });
    }
    return { metrics: { wins: won ? 1 : 0, bestDmg: Math.round(this.myDmg) }, stats };
  }

  timerText() { return `⏳ ${fmtClock(Math.max(0, BOSS_RAID.timeLimit - this.game.elapsed))}`; }

  _dmgTable() {
    const t = { ...(this.isHost ? this.dmgBy : this.hostDmg ?? {}) };
    t[this.myKey] = this.myDmg;
    for (const [k, gh] of this.ghosts) if (gh.dmg != null) t[k] = Math.max(t[k] ?? 0, gh.dmg);
    return t;
  }

  mountHud(el) {
    el.hidden = false;
    el.innerHTML = `<div class="mh-raid"><div class="mh-row"><span class="mh-label">${this.info.icon} ${this.info.name}</span><span class="mh-wave"></span></div><div class="mh-party"></div></div>`;
    this.hud = { wave: el.querySelector('.mh-wave'), party: el.querySelector('.mh-party'), root: el.querySelector('.mh-raid') };
  }

  updateHud() {
    this._placeLabels();
    if (!this.hud) return;
    this._hudT = (this._hudT ?? 0) + 1;
    if (this._hudT % 6) return;
    const g = this.game;
    this.hud.wave.textContent = `${this.phase + 1}. faz${this.enraged ? ' · 🔥 ÖFKE' : ''}`;
    this.hud.root.classList.toggle('danger', this.enraged);
    const table = this._dmgTable();
    const rows = this.raid.players.map((p) => {
      const me = p.key === this.myKey;
      const gh = this.ghosts.get(p.key);
      const hp = me ? g.player.hp : gh?.hp ?? 0;
      const mhp = me ? g.stats.maxHp : gh?.mhp ?? 1;
      const dead = me ? this.dead : gh?.dead;
      const gone = !me && gh?.gone;
      return `<div class="mp-row${me ? ' me' : ''}${dead ? ' dead' : ''}${gone ? ' gone' : ''}">
        <span class="mp-name">${getCharacter(p.ch).icon} ${esc(p.name)}${p.key === this.hostKey && this.online ? ' 👑' : ''}</span>
        <span class="mp-hp"><i style="width:${Math.max(0, Math.min(100, (hp / mhp) * 100))}%"></i></span>
        <span class="mp-dmg">${dead ? `💀 ${me ? Math.ceil(this.reviveT) + ' sn' : ''}` : gone ? 'ayrıldı' : `⚔️ ${Math.round(table[p.key] ?? 0)}`}</span>
      </div>`;
    }).join('');
    if (rows !== this._rows) { this._rows = rows; this.hud.party.innerHTML = rows; }
  }

  dispose() {
    for (const u of this.unsubs) u?.();
    this.channel?.leave();
    this.channel = null;
    for (const gh of this.ghosts.values()) { gh.label.remove(); this.game.scene.remove(gh.group); }
    if (this._hint) this._hint.textContent = this._hintOld;
    if (this._view) this.game.sceneMgr.setViewSize(this._view);
  }
}
