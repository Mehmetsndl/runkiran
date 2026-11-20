// ============================================================
//  BOSS VE ÖZEL YETENEKLER
//  enemies.js'teki "ai" alanına göre yaratıklara yetenek verir:
//   spit   : uzaktan ateş topu tükürür (Yavru Ejderha)
//   charge : sopasını kaldırıp oyuncuya hamle yapar, yere vurur (Dev Trol)
//   summon : iskelet çağırır, yerden ruh dalgası patlatır (Kemik Lordu)
//   breath : ateş püskürtür, yavru ejderha çağırır, ateş topu yağdırır (Kızıl Ejderha)
//  Ayrıca boss can çubuğunu ve düşman mermilerini yönetir.
// ============================================================
import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a);

export class BossSystem {
  constructor(game) {
    this.game = game;
    this.shots = [];
    this.bosses = new Set();
    this.v = new THREE.Vector3();
    this.shotGeo = new THREE.IcosahedronGeometry(0.28, 0);
    this.bar = document.createElement('div');
    this.bar.id = 'bossBars';
    document.body.appendChild(this.bar);
  }

  /** Yaratık doğduğunda çağrılır */
  onSpawn(e) {
    const d = e.def;
    if (!d.ai) return;
    e.ab = { cd: rnd(1.5, 3), cd2: rnd(5, 8), phase: 'idle', t: 0 };
    if (d.boss) {
      this.bosses.add(e);
      const g = this.game;
      g.hud.showBanner(`${d.icon ?? '👑'} BOSS: ${d.name.toLocaleUpperCase('tr-TR')}`, BOSS_TAUNT[e.typeId] ?? 'Hazırlan!');
      g.sceneMgr.addShake(1.2);
      g.hud.screenFlash('red');
      this._roar();
      e.ab.cd = 3;
      this._renderBars(true);
    }
  }

  onRemove(e) {
    if (this.bosses.delete(e)) {
      this._renderBars(true);
      if (e.hp <= 0) {
        const g = this.game;
        const at = e.mesh.position.clone(); at.y = e.height + 2;
        g.epic(at, `${e.def.name.toLocaleUpperCase('tr-TR')} DEVRİLDİ!`);
        g.particles.ring(e.mesh.position, 0xffd84a, 12, 0.8);
        g.particles.burst(at.clone().setY(2), [0xffd84a, e.def.color, 0xffffff], 120, { speed: 22, size: 0.4, life: 1.4 });
        g.player.heal(g.stats.maxHp * 0.3);
        const hp = g.player.position.clone(); hp.y += 2.8;
        g.floating.spawn(hp, '+%30 CAN', 'heal');
        g.audio.levelUp();
      }
    }
  }

  _roar() {
    const a = this.game.audio;
    a.noise?.({ dur: 0.7, vol: 0.35, filter: 500 });
    a.tone?.({ freq: 70, type: 'sawtooth', dur: 0.8, vol: 0.25, slide: -30 });
    a.tone?.({ freq: 110, type: 'square', dur: 0.5, vol: 0.12, slide: -60, delay: 0.1 });
  }

  update(dt) {
    const g = this.game;
    for (const e of g.enemies) {
      if (!e.ab || !e.alive || e.spawnT < 1) continue;
      if (e.net) { this._remote(e, dt); continue; }   // Boss Avı: bu bossu host yönetir
      if (e.stunT > 0) { e.override = null; e.moveMult = 1; continue; }
      const tp = this._targetOf(e);
      const dx = tp.x - e.mesh.position.x, dz = tp.z - e.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      this[`_ai_${e.def.ai}`]?.(e, dt, dist, dx, dz);
    }
    this._updateShots(dt);
    this._renderBars(false);
  }

  // ---------------- Yavru Ejderha: ateş topu ----------------
  _ai_spit(e, dt, dist) {
    const A = e.ab;
    A.cd -= dt * (e.rage ?? 1);
    if (A.phase === 'idle' && A.cd <= 0 && dist < 15) { A.phase = 'wind'; A.t = 0.55; e.castT = 0.55; }
    if (A.phase === 'wind') {
      A.t -= dt;
      this._mouthGlow(e, 0xff8a1a, 2);
      if (A.t <= 0) {
        this._fireball(e, (e.def.spitDmg ?? 9) * (e.dmgMult ?? 1), 12);
        e.attackPulse = 1;
        A.phase = 'idle';
        A.cd = (e.def.spitEvery ?? 3.5) * rnd(0.8, 1.2);
      }
    }
  }

  // ---------------- Dev Trol: hamle + yer sarsıntısı ----------------
  _ai_charge(e, dt, dist, dx, dz) {
    const A = e.ab;
    const g = this.game;
    A.cd -= dt * (e.rage ?? 1);
    if (A.phase === 'idle' && A.cd <= 0 && dist < 18) {
      A.phase = 'wind'; A.t = 1.0; e.castT = 1.0; e.moveMult = 0;
      this._ring(e.mesh.position, 0xff3b3b, 3, 1.0);
      g.audio.windup?.();
    } else if (A.phase === 'wind') {
      A.t -= dt;
      if (Math.random() < dt * 30) g.particles.emit(e.mesh.position.x + rnd(-1, 1), 0.2, e.mesh.position.z + rnd(-1, 1), 0x8a7a62, rnd(-1, 1), rnd(2, 4), rnd(-1, 1), 0.25, 0.5, -10);
      if (A.t <= 0) {
        const d = Math.max(0.1, dist);
        const sp = 15;
        e.override = { x: (dx / d) * sp, z: (dz / d) * sp };
        e.mesh.rotation.y = Math.atan2(dx, dz);
        A.phase = 'dash'; A.t = Math.min(1.1, (dist + 3) / sp);
        this._roar();
        this._emit({ k: 'roar' });
      }
    } else if (A.phase === 'dash') {
      A.t -= dt;
      if (Math.random() < dt * 40) g.particles.emit(e.mesh.position.x, 0.2, e.mesh.position.z, 0x9a8a6a, rnd(-2, 2), rnd(1, 3), rnd(-2, 2), 0.3, 0.6, -8);
      if (A.t <= 0) {
        e.override = null;
        e.attackPulse = 1;
        this._slam(e.mesh.position, 4.5, 16 * (e.dmgMult ?? 1), 0xffb347);
        A.phase = 'recover'; A.t = 1.1; e.moveMult = 0.3;
      }
    } else if (A.phase === 'recover') {
      A.t -= dt;
      if (A.t <= 0) { A.phase = 'idle'; A.cd = rnd(4.5, 6.5); e.moveMult = 1; }
    }
  }

  // ---------------- Kemik Lordu: çağırma + ruh dalgası ----------------
  _ai_summon(e, dt, dist) {
    const A = e.ab;
    const g = this.game;
    A.cd -= dt * (e.rage ?? 1); A.cd2 -= dt * (e.rage ?? 1);
    if (A.phase === 'idle' && A.cd <= 0) { A.phase = 'cast'; A.t = 1.3; e.castT = 1.3; e.moveMult = 0; }
    else if (A.phase === 'idle' && A.cd2 <= 0 && dist < 9) {
      A.phase = 'nova'; A.t = 0.9; e.castT = 0.9; e.moveMult = 0;
      this._ring(e.mesh.position, 0x9dff6a, 6.5, 0.9);
    }
    if (A.phase === 'cast') {
      A.t -= dt;
      const p = e.mesh.position;
      if (Math.random() < dt * 40) g.particles.emit(p.x + rnd(-2, 2), 0.1, p.z + rnd(-2, 2), Math.random() < 0.5 ? 0x9dff6a : 0x6a3aff, 0, rnd(3, 6), 0, 0.22, 0.7, 0);
      if (A.t <= 0) {
        const n = 3 + Math.min(3, Math.floor(g.elapsed / 300));
        this._summon(e, 'iskelet', n, 'YÜKSELİN!');
        A.phase = 'idle'; A.cd = rnd(8, 10); e.moveMult = 1;
      }
    } else if (A.phase === 'nova') {
      A.t -= dt;
      if (A.t <= 0) {
        this._slam(e.mesh.position, 6.5, 18 * (e.dmgMult ?? 1), 0x9dff6a);
        A.phase = 'idle'; A.cd2 = rnd(6, 8); e.moveMult = 1;
      }
    }
  }

  // ---------------- Kızıl Ejderha: ateş nefesi + yavrular + ateş yağmuru ----------------
  _ai_breath(e, dt, dist, dx, dz) {
    const A = e.ab;
    const g = this.game;
    A.cd -= dt * (e.rage ?? 1); A.cd2 -= dt * (e.rage ?? 1);
    if (A.phase === 'idle') {
      if (A.cd <= 0 && dist < 14) { A.phase = 'wind'; A.t = 1.0; e.castT = 1.0; e.moveMult = 0.2; this._roar(); this._emit({ k: 'roar' }); }
      else if (A.cd2 <= 0) {
        A.cd2 = rnd(10, 13);
        if (Math.random() < 0.5) {
          this._summon(e, 'yavruEjder', 2, 'YAVRULARIM!');
        } else {
          A.phase = 'volley'; A.t = 0; A.n = 5;
        }
      }
    }
    if (A.phase === 'wind') {
      A.t -= dt;
      this._mouthGlow(e, 0xffd84a, 4);
      if (A.t <= 0) { A.phase = 'fire'; A.t = 1.7; A.dir = Math.atan2(dx, dz); A.tick = 0; e.castT = 1.7; this._emit({ k: 'breath', dur: 1.7 }); }
    } else if (A.phase === 'fire') {
      A.t -= dt;
      // Nefes yavaşça oyuncuya döner
      const want = Math.atan2(dx, dz);
      let diff = want - A.dir;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      A.dir += Math.max(-dt * 0.9, Math.min(dt * 0.9, diff));
      e.mesh.rotation.y = A.dir;
      this._fireTick(e, A, dt);
      if (A.t <= 0) { A.phase = 'idle'; A.cd = rnd(6, 8); e.moveMult = 1; }
    } else if (A.phase === 'volley') {
      A.t -= dt;
      if (A.t <= 0) {
        A.t = 0.35; A.n--;
        this._fireball(e, (e.def.spitDmg ?? 14) * (e.dmgMult ?? 1), 13, rnd(-2.5, 2.5));
        e.attackPulse = 1;
        if (A.n <= 0) { A.phase = 'idle'; A.cd = Math.max(A.cd, 2); }
      }
    }
  }

  // ---------------- yardımcılar ----------------
  _mouth(e) {
    e.mesh.updateMatrixWorld(true);
    const m = e.parts.mouth ?? e.parts.head ?? e.mesh;
    return m.getWorldPosition(this.v).clone();
  }

  _mouthGlow(e, color, n) {
    const m = this._mouth(e);
    for (let k = 0; k < n; k++) this.game.particles.emit(m.x + rnd(-0.2, 0.2), m.y, m.z + rnd(-0.2, 0.2), color, rnd(-0.5, 0.5), rnd(0.5, 1.5), rnd(-0.5, 0.5), 0.2, 0.3, 0);
  }

  /** Ağızdan oyuncuya ateş topu (spreadX: hedef kaydırma) */
  _fireball(e, dmg, speed, spreadX = 0, at = null) {
    const g = this.game;
    const from = this._mouth(e);
    const to = at ? new THREE.Vector3(at.x, 0, at.z) : this._targetOf(e).clone();
    if (!at) { to.x += spreadX; to.z += spreadX * 0.5; }
    to.y = 0.9;
    if (!at && e.def.boss) this._emit({ k: 'fb', x: +to.x.toFixed(2), z: +to.z.toFixed(2), dmg: Math.round(dmg), sp: speed });
    const dir = to.sub(from).normalize();
    const mat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, toneMapped: false });
    const mesh = new THREE.Mesh(this.shotGeo, mat);
    mesh.position.copy(from);
    mesh.scale.setScalar(e.def.boss ? 1.6 : 1);
    g.scene.add(mesh);
    this.shots.push({ mesh, vel: dir.multiplyScalar(speed), life: 3, dmg });
    g.audio.shoot?.();
  }

  _updateShots(dt) {
    const g = this.game;
    const pp = g.player.position;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      const p = s.mesh.position;
      p.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += dt * 8; s.mesh.rotation.y += dt * 6;
      if (Math.random() < 0.9) g.particles.emit(p.x, p.y, p.z, Math.random() < 0.5 ? 0xff8a1a : 0xffd84a, rnd(-0.5, 0.5), rnd(0, 1), rnd(-0.5, 0.5), 0.22, 0.3, 0);
      const hit = Math.hypot(p.x - pp.x, p.z - pp.z) < 0.9 + g.player.radius * 0.5 && p.y < 2.4;
      if (hit || p.y < 0.05 || s.life <= 0) {
        if (hit) this._hurt(s.dmg);
        g.particles.burst(p.clone().setY(Math.max(0.3, p.y)), [0xff3b1a, 0xff8a1a, 0xffd84a], 16, { speed: 7, size: 0.25, life: 0.5 });
        g.scene.remove(s.mesh);
        s.mesh.material.dispose();
        this.shots.splice(i, 1);
      }
    }
  }

  /** Yerde şok dalgası: içindeysen hasar alırsın */
  _slam(pos, radius, dmg, color, remote = false) {
    const g = this.game;
    if (!remote) this._emit({ k: 'slam', x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), r: radius, dmg: Math.round(dmg), c: color });
    g.particles.ring(pos, color, radius, 0.5);
    g.particles.burst(pos.clone().setY(0.3), [color, 0x8a7a62, 0xffffff], 40, { speed: 12, size: 0.3, life: 0.7 });
    g.sceneMgr.addShake(0.8);
    g.audio.slam?.(true);
    const pp = g.player.position;
    if (Math.hypot(pp.x - pos.x, pp.z - pos.z) < radius) this._hurt(dmg);
  }

  _hurt(dmg, fire = false) {
    const g = this.game;
    if (g.state !== 'playing') return;
    const dealt = g.player.takeDamage(dmg);
    if (dealt) {
      g.onPlayerHurt(dealt);
      if (fire) g.particles.burst(g.player.position.clone().setY(1), [0xff3b1a, 0xffd84a], 10, { speed: 5, size: 0.2 });
    }
  }

  /** Yaratığın yürüdüğü/nişan aldığı nokta (Boss Avı'nda en yakın oyuncu olabilir) */
  _targetOf(e) { return this.game.mode?.enemyTarget?.(e) ?? this.game.player.position; }

  /** Boss Avı host'u: görsel / hasar olaylarını diğer oyunculara yolla */
  _emit(f) { this.netFx?.(f); }

  _ring(pos, color, r, life) {
    this.game.particles.ring(pos, color, r, life);
    this._emit({ k: 'ring', x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), r, c: color, l: life });
  }

  /** Bossun etrafında yardımcı yaratık çağır */
  _summon(e, type, n, text, remote = false) {
    const g = this.game;
    const p = e.mesh.position;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = g.waves.spawn(type, { center: p, radius: 2.5, angle: a, spread: 0.3, hpScale: g.mode.hpScale ?? 1 });
      if (s) g.particles.burst(s.mesh.position.clone().setY(0.4), [0x9dff6a, 0xe6dfc8, 0xff8a1a], 14, { speed: 6, size: 0.2 });
    }
    g.particles.ring(p, 0x9dff6a, 4, 0.5);
    g.floating.spawn(p.clone().setY(e.height + 1.5), text, 'crit');
    if (!remote) this._emit({ k: 'summon', type, n, text });
  }

  /** Ateş nefesi: ağızdan koni şeklinde alev; konideki oyuncu yanar */
  _fireTick(e, A, dt) {
    const g = this.game;
    const dir = e.mesh.rotation.y;
    const m = this._mouth(e);
    for (let k = 0; k < 6; k++) {
      const a = dir + rnd(-0.35, 0.35);
      const sp = rnd(10, 16);
      g.particles.emit(m.x, m.y, m.z, [0xff3b1a, 0xff8a1a, 0xffd84a, 0xffffff][k % 4], Math.sin(a) * sp, rnd(-4, -1) * (m.y / 6), Math.cos(a) * sp, rnd(0.25, 0.5), 0.65, 0);
    }
    g.sceneMgr.addShake(0.05);
    A.tick -= dt;
    if (A.tick <= 0) {
      A.tick = 0.35;
      const pp = g.player.position;
      const dx = pp.x - e.mesh.position.x, dz = pp.z - e.mesh.position.z;
      let off = Math.atan2(dx, dz) - dir;
      while (off > Math.PI) off -= Math.PI * 2;
      while (off < -Math.PI) off += Math.PI * 2;
      if (Math.hypot(dx, dz) < 12 * Math.max(1, e.baseScale / 3) && Math.abs(off) < 0.45) this._hurt(Math.round((e.def.spitDmg ?? 12) * 0.6 * (e.dmgMult ?? 1)), true);
    }
  }

  /** Host'un yönettiği boss (istemci tarafı): yalnızca süren ateş nefesi ve hazırlık parıltısı burada */
  _remote(e, dt) {
    const A = e.ab;
    if (A.phase === 'fire') {
      A.t -= dt;
      this._fireTick(e, A, dt);
      if (A.t <= 0) A.phase = 'idle';
    } else if (e.castT > 0 && (e.def.ai === 'breath' || e.def.ai === 'spit')) this._mouthGlow(e, 0xffd84a, 2);
  }

  /** İstemci: host'tan gelen boss olayını kendi dünyasında oynat */
  handleFx(e, f) {
    const g = this.game;
    switch (f.k) {
      case 'fb': this._fireball(e, f.dmg, f.sp, 0, { x: f.x, z: f.z }); e.attackPulse = 1; break;
      case 'slam': this._slam(new THREE.Vector3(f.x, 0, f.z), f.r, f.dmg, f.c, true); e.attackPulse = 1; break;
      case 'ring': g.particles.ring(new THREE.Vector3(f.x, 0, f.z), f.c, f.r, f.l); break;
      case 'summon': this._summon(e, f.type, f.n, f.text, true); break;
      case 'breath': e.ab.phase = 'fire'; e.ab.t = f.dur; e.ab.tick = 0.2; break;
      case 'roar': this._roar(); break;
      default: break;
    }
  }

  _renderBars(force) {
    this._barT = (this._barT ?? 0) + 1;
    if (!force && this._barT % 4) return;
    const list = [...this.bosses].filter((e) => e.alive);
    if (!list.length) { if (this.bar.childElementCount) this.bar.replaceChildren(); return; }
    if (force || this.bar.childElementCount !== list.length) {
      this.bar.innerHTML = list.map((e) => `<div class="boss-bar"><div class="bb-name">${e.def.icon ?? '👑'} ${e.def.name}</div><div class="bb-track"><i></i><b></b></div></div>`).join('');
    }
    [...this.bar.children].forEach((el, i) => {
      const e = list[i];
      const pct = Math.max(0, e.hp / e.maxHp) * 100;
      el.querySelector('i').style.width = `${pct}%`;
      el.querySelector('b').textContent = `${Math.ceil(Math.max(0, e.hp))} / ${Math.round(e.maxHp)}`;
    });
  }
}

const BOSS_TAUNT = {
  trol: 'Sopasını kaldırınca kaç: hamle yapacak!',
  kemikLord: 'Ölüleri diriltiyor · yeşil halkadan uzak dur!',
  ejderKral: 'Ateş nefesinden kaç, yavrularına dikkat!',
};
