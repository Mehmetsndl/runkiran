// ============================================================
//  SAVAŞ SİSTEMİ
//  Hasar hesabı + karaktere göre saldırı türü:
//   bolt  : güdümlü büyü küresi (Büyücü)
//   slam  : yere vurup önündeki şeride alan hasarı (Tepegöz)
//   arrow : yolundaki her düşmanı delen ok (Elf Okçu)
//  Her saldırı Şimşek Zinciri yükseltmesiyle de çalışır.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { HYPE, pickHype } from '../data/hypeTexts.js';

export class CombatSystem {
  constructor(game) {
    this.game = game;
    this.projectiles = [];  // büyü küreleri ve oklar
    this.pendingSlams = []; // topuz havadayken bekleyen vuruşlar
    this.quakes = [];       // yerde ilerleyen sarsıntı dalgaları
    this.bolts = [];        // şimşek görselleri
    this.strikes = [];      // kart etkileri: yıldırım, göktaşı
    this.meteorGeo = new THREE.IcosahedronGeometry(0.7, 1);
    this.meteorMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, toneMapped: false });

    this.coreGeo = new THREE.IcosahedronGeometry(0.28, 0);
    this.glowGeo = new THREE.SphereGeometry(0.55, 12, 10);
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xe8fbff, toneMapped: false });
    this.critCoreMat = new THREE.MeshBasicMaterial({ color: 0xfff3a0, toneMapped: false });
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0x3fc8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    this.critGlowMat = new THREE.MeshBasicMaterial({ color: 0xff9d00, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    this.boltGeo = new THREE.BoxGeometry(0.14, 0.14, 1);
    this.beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2);

    // Ok: gövde + uç + tüy (+Z yönüne bakar)
    this.arrowShaft = new THREE.CylinderGeometry(0.035, 0.035, 1.3, 5).rotateX(Math.PI / 2);
    this.arrowHead = new THREE.ConeGeometry(0.09, 0.28, 5).rotateX(Math.PI / 2).translate(0, 0, 0.75);
    this.arrowFletch = new THREE.BoxGeometry(0.22, 0.02, 0.22).translate(0, 0, -0.55);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0xf5e6c8, toneMapped: false });
    this.arrowCritMat = new THREE.MeshBasicMaterial({ color: 0xffd84a, toneMapped: false });
    this.fletchMat = new THREE.MeshBasicMaterial({ color: 0x5cd66a, toneMapped: false, side: THREE.DoubleSide });

    // Sarsıntı şeridi (yerde parlayan çatlak)
    this.quakeGeo = new THREE.BoxGeometry(1, 0.04, 1).translate(0, 0, 0.5);

    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  get character() { return this.game.character; }

  /** Kelime başına tetiklenen kart etkileri: Çift Atış, Gök Gürültüsü, Göktaşı */
  _cardProcs(target, dmg, crit) {
    const g = this.game, s = g.stats;
    this.wordCount = (this.wordCount || 0) + 1;
    if (s.doubleChance && Math.random() < s.doubleChance) {
      let other = null, bd = 1e9;
      for (const e of g.enemies) {
        if (!e.alive || e === target || e.spawnT < 1) continue;
        const d = e.mesh.position.distanceToSquared(target.mesh.position);
        if (d < bd) { bd = d; other = e; }
      }
      if (other) {
        const from = g.player.castPointWorld(new THREE.Vector3());
        this.bolt(from, other.mesh.position.clone().setY(other.height * 0.5));
        g.damageEnemy(other, dmg * 0.7, { crit, chain: true });
      }
    }
    if (s.lightningChance && Math.random() < s.lightningChance) {
      this.strikes.push({ kind: 'lightning', pos: target.mesh.position.clone().setY(0), t: 0.12, radius: 2.8, dmg: dmg * 0.8 });
    }
    if (s.meteorEvery && this.wordCount % s.meteorEvery === 0) {
      this.strikes.push({ kind: 'meteor', pos: target.mesh.position.clone().setY(0), t: 0.55, radius: 3.6, dmg: dmg * 2.5, mesh: null });
    }
  }

  /** Gökten düşen kart etkilerini işle */
  _updateStrikes(dt) {
    const g = this.game;
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const k = this.strikes[i];
      if (k.kind === 'meteor') {
        if (!k.mesh) {
          k.mesh = new THREE.Mesh(this.meteorGeo, this.meteorMat);
          k.dur = k.t;
          g.scene.add(k.mesh);
        }
        const f = 1 - Math.max(0, k.t) / k.dur;
        k.mesh.position.set(k.pos.x - 7 * (1 - f), 18 * (1 - f * f) + 0.3, k.pos.z - 5 * (1 - f));
        g.particles.emit(k.mesh.position.x, k.mesh.position.y, k.mesh.position.z, Math.random() < 0.5 ? 0xff7a1a : 0xffd84a, 0, 1, 0, 0.35, 0.35, 0);
      }
      k.t -= dt;
      if (k.t > 0) continue;
      this.strikes.splice(i, 1);
      if (k.mesh) g.scene.remove(k.mesh);
      if (k.kind === 'lightning') {
        this.bolt(k.pos.clone().setY(16), k.pos.clone().setY(0.3));
        this.bolt(k.pos.clone().setY(16).add(new THREE.Vector3(0.6, 0, 0.4)), k.pos.clone().setY(0.3));
        g.particles.ring(k.pos, 0xbff4ff, k.radius, 0.35);
        g.particles.burst(k.pos.clone().setY(0.5), [0xbff4ff, 0xffffff], 18, { speed: 9, size: 0.2, life: 0.4 });
        g.sceneMgr.addShake(0.2);
        g.audio.hit(true);
      } else {
        g.particles.ring(k.pos, 0xff6a00, k.radius, 0.45);
        g.particles.burst(k.pos.clone().setY(0.5), [0xff6a00, 0xffd84a, 0x3a2a1a], 30, { speed: 13, size: 0.32, life: 0.8 });
        g.sceneMgr.addShake(0.45);
        g.audio.slam(true);
        const at = k.pos.clone(); at.y += 3;
        g.floating.spawn(at, 'GÖKTAŞI!', 'chain');
      }
      for (const e of [...g.enemies]) {
        if (e.alive && Math.hypot(e.mesh.position.x - k.pos.x, e.mesh.position.z - k.pos.z) < k.radius + e.radius) {
          g.damageEnemy(e, k.dmg, { chain: true });
        }
      }
    }
  }

  /** Kelime tamamlandığında çağrılır */
  fire(target, { cps, streak, clean = false }) {
    const g = this.game, s = g.stats, C = CONFIG.COMBAT;
    let dmg = C.baseDamage * s.damageMult * (1 + s.comboLetterBonus * Math.min(streak, C.comboLetterCap));
    const fast = cps >= C.fastTypingCps * (s.fastCpsMult ?? 1);
    const crit = Math.random() < s.critChance + (fast ? C.fastCritBonus : 0);
    if (crit) dmg *= s.critMult;
    // Kart çarpanları
    const len = target.word?.length ?? 4;
    if (fast && s.fastDmg) dmg *= 1 + s.fastDmg;
    if (len >= 5 && s.longWordBonus) dmg *= 1 + s.longWordBonus;
    if (len <= 4 && s.shortWordBonus) dmg *= 1 + s.shortWordBonus;
    if (clean && s.cleanWordBonus) dmg *= 1 + s.cleanWordBonus;
    if (s.lowHpDmg && g.player.hp < s.maxHp * 0.3) dmg *= 1 + s.lowHpDmg;
    if (s.killStack) dmg *= 1 + Math.floor(g.kills / 20) * 0.02 * s.killStack;
    if (s.luckyChance && Math.random() < s.luckyChance) {
      dmg *= 3;
      const at = target.mesh.position.clone(); at.y += target.height + 2.2;
      g.floating.spawn(at, 'KADER! x3', 'crit');
    }
    this._cardProcs(target, dmg, crit);

    const type = this.character.attack;
    if (type === 'slam') this._startSlam(target, dmg, crit);
    else if (type === 'arrow') this._fireArrow(target, dmg, crit);
    else if (type === 'dash') this._startDash(target, dmg, crit);
    else if (type === 'beam') this._fireBeam(target, dmg, crit);
    else this._fireBolt(target, dmg, crit);

    g.player.attack(type);
    if (fast) {
      const at = g.player.position.clone();
      at.y += g.player.height + 0.6;
      g.floating.spawn(at, pickHype(HYPE.fast), 'speed');
    }
  }

  // ---------------- BÜYÜ KÜRESİ ----------------
  _fireBolt(target, dmg, crit) {
    const g = this.game;
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(this.coreGeo, crit ? this.critCoreMat : this.coreMat));
    mesh.add(new THREE.Mesh(this.glowGeo, crit ? this.critGlowMat : this.glowMat));
    if (crit) mesh.scale.setScalar(1.5);
    g.player.castPointWorld(mesh.position);
    g.scene.add(mesh);
    this.projectiles.push({
      kind: 'bolt', mesh, target, dmg, crit,
      speed: CONFIG.COMBAT.projectileSpeed,
      aim: target.mesh.position.clone().setY(target.height * 0.5),
    });
    g.audio.shoot();
  }

  // ---------------- DELİCİ OK ----------------
  _fireArrow(target, dmg, crit) {
    const g = this.game;
    const mesh = new THREE.Group();
    const mat = crit ? this.arrowCritMat : this.arrowMat;
    mesh.add(new THREE.Mesh(this.arrowShaft, mat), new THREE.Mesh(this.arrowHead, mat), new THREE.Mesh(this.arrowFletch, this.fletchMat));
    if (crit) mesh.scale.setScalar(1.4);
    g.player.castPointWorld(mesh.position);
    mesh.position.y = Math.max(mesh.position.y, 1);
    g.scene.add(mesh);
    this.projectiles.push({
      kind: 'arrow', mesh, target, dmg, crit,
      speed: 46, dir: new THREE.Vector3(), passed: false, travel: 0, afterTravel: 0,
      hit: new Set(), aim: target.mesh.position.clone().setY(target.height * 0.5),
    });
    g.audio.arrow();
  }

  // ---------------- IŞIK HÜZMESİ (Şifacı) ----------------
  _fireBeam(target, dmg, crit) {
    const g = this.game;
    const from = g.player.castPointWorld(new THREE.Vector3());
    const to = target.mesh.position.clone().setY(target.height * 0.55);
    this.beamFx(from, to, crit ? 0xffd84a : 0xfff6c0, crit ? 0.32 : 0.2);
    g.particles.burst(to, [0xfff6c0, 0xffd84a, 0xffffff], 14, { speed: 7, size: 0.18, life: 0.4 });
    g.audio.beam();
    g.damageEnemy(target, dmg, { crit, primary: true });
    const heal = this.character.beam?.heal ?? 3;
    if (g.player.hp < g.stats.maxHp) {
      g.player.heal(heal);
      g.particles.burst(g.player.position.clone().setY(g.player.position.y + 1.2), 0x6dff8a, 5, { speed: 3, size: 0.12, life: 0.4, gravity: 4 });
    }
    this._chain(target, dmg, crit, new Set([target]));
  }

  /** Düz ışık hüzmesi görseli (Şifacı saldırısı ve ultiler) */
  beamFx(from, to, color, width = 0.22, life = 0.25) {
    const g = this.game;
    const len = from.distanceTo(to);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(this.beamGeo, mat);
    mesh.position.copy(from).lerp(to, 0.5);
    mesh.lookAt(to);
    mesh.scale.set(width, width, len);
    const group = new THREE.Group();
    group.add(mesh);
    g.scene.add(group);
    this.bolts.push({ group, mat, life, beam: true, maxLife: life, mesh, width });
  }

  /** Hedefsiz, dümdüz giden delici ok (Ok Yağmuru ultisi) */
  fireStraightArrow(dir, dmg, crit) {
    const g = this.game;
    const mesh = new THREE.Group();
    const mat = crit ? this.arrowCritMat : this.arrowMat;
    mesh.add(new THREE.Mesh(this.arrowShaft, mat), new THREE.Mesh(this.arrowHead, mat), new THREE.Mesh(this.arrowFletch, this.fletchMat));
    mesh.position.copy(g.player.position).setY(g.player.position.y + 1.2).addScaledVector(dir, 0.6);
    g.scene.add(mesh);
    const ghost = { alive: false, incoming: false, mesh, height: 0 }; // hedefi olmayan ok
    this.projectiles.push({
      kind: 'arrow', mesh, target: ghost, dmg, crit,
      speed: 42, dir: dir.clone().normalize(), passed: true, travel: 0, afterTravel: 0,
      hit: new Set(), aim: new THREE.Vector3(), straight: true,
    });
  }

  // ---------------- HÜCUM KESİĞİ (Şövalye) ----------------
  _startDash(target, dmg, crit) {
    const g = this.game;
    const pp = g.player.position;
    const tp = target.mesh.position;
    const dx = tp.x - pp.x, dz = tp.z - pp.z;
    const dist = Math.hypot(dx, dz) || 1;
    const stop = target.radius + g.player.radius + 0.2;
    const k = Math.max(0, dist - stop) / dist;
    const to = new THREE.Vector3(pp.x + dx * k, 0, pp.z + dz * k);
    g.audio.dash();
    if (g.player.anchor) return this._slashWave(target, dmg, crit);
    g.player.startDash(to, this.character.dash?.speed ?? 60, () => this._spinSlash(target, dmg, crit));
  }

  /** Kale Savunması: Şövalye burçtan atılamaz, hedefe uçan bir kılıç dalgası yollar */
  _slashWave(target, dmg, crit) {
    const g = this.game;
    const from = g.player.castPointWorld(new THREE.Vector3());
    const to = target.mesh.position.clone().setY(target.height * 0.5);
    g.player.spinT = 0.32;
    this.beamFx(from, to, crit ? 0xffd84a : 0xe8f4ff, crit ? 0.5 : 0.34, 0.2);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      g.particles.emit(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, from.z + (to.z - from.z) * k,
        crit ? 0xffd84a : 0xe8f4ff, (Math.random() - 0.5) * 3, 1, (Math.random() - 0.5) * 3, 0.2, 0.3, 0);
    }
    this._spinSlash(target, dmg, crit, target.mesh.position.clone().setY(0), 0.7);
  }

  _spinSlash(target, dmg, crit, center = null, radiusMult = 1) {
    const g = this.game;
    const R = (this.character.dash?.radius ?? 3.4) * radiusMult;
    const at = center ?? g.player.position.clone();
    const hits = g.enemies.filter((e) => e.alive && e.mesh.position.distanceTo(at) < R + e.radius);
    if (target.alive && !hits.includes(target)) hits.push(target);

    // Görsel: kılıç yayı + kıvılcımlar
    g.particles.ring(at, crit ? 0xffd84a : 0xe8f4ff, R, 0.3);
    g.particles.ring(at, 0xffffff, R * 0.6, 0.2);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const r = R * (0.6 + Math.random() * 0.4);
      g.particles.emit(at.x + Math.cos(a) * r, 1 + Math.random() * 0.6, at.z + Math.sin(a) * r,
        crit ? 0xffd84a : 0xe8f4ff, -Math.sin(a) * 9, 1, Math.cos(a) * 9, 0.18, 0.3, -6);
    }
    g.sceneMgr.addShake(0.3);
    g.audio.slash(crit);

    for (const e of hits) {
      if (!e.alive) continue;
      const primary = e === target;
      g.damageEnemy(e, primary ? dmg : dmg * 0.75, { crit, primary });
      const ox = e.mesh.position.x - at.x, oz = e.mesh.position.z - at.z;
      const od = Math.hypot(ox, oz) || 1;
      const kb = 14 * (e.def.knockback ?? 1);
      e.knock.x += (ox / od) * kb;
      e.knock.z += (oz / od) * kb;
    }
    if (hits.length >= 4) {
      const p = at.clone(); p.y += 3;
      g.floating.spawn(p, `BİÇİLDİ x${hits.length}!`, 'chain');
    }
    if (target.alive && target.incoming) target.incoming = false;
    this._chain(target, dmg, crit, new Set(hits));
  }

  // ---------------- YER SARSINTISI ----------------
  _startSlam(target, dmg, crit) {
    const windup = this.character.slam?.windup ?? 0.28;
    this.pendingSlams.push({ target, dmg, crit, t: windup });
    this.game.audio.windup();
  }

  _slam(s) {
    const g = this.game;
    const cfg = this.character.slam ?? { length: 9, width: 3.6 };
    const pp = g.player.position;
    const dir = this._a.set(Math.sin(g.player.facing), 0, Math.cos(g.player.facing));
    let reach = cfg.length;
    if (s.target.alive) {
      dir.subVectors(s.target.mesh.position, pp).setY(0);
      reach = Math.max(cfg.length, Math.min(g.player.anchor ? 20 : 14, dir.length() + 1.5));
      dir.normalize();
      g.player.facing = Math.atan2(dir.x, dir.z);
    }
    const origin = pp.clone().setY(0);
    const half = cfg.width / 2;

    // Şeritteki düşmanları topla
    const hits = [];
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const rx = e.mesh.position.x - pp.x, rz = e.mesh.position.z - pp.z;
      const along = rx * dir.x + rz * dir.z;
      const perp = Math.abs(rx * dir.z - rz * dir.x);
      if (along > -1.2 && along < reach && perp < half + e.radius) hits.push({ e, along });
    }
    if (s.target.alive && !hits.some((h) => h.e === s.target)) hits.push({ e: s.target, along: 1 });

    // Görsel + ses: ses ve sarsıntı her zaman, vuruş zamanında
    this.quakes.push({ origin, dir: dir.clone(), reach, width: cfg.width, dist: 0, nextBurst: 0.8, mesh: this._quakeMesh(origin, dir, cfg.width), life: 0.9 });
    g.particles.ring(origin, 0xffb347, 4.5, 0.5);
    g.particles.burst(origin, [0x6b5a45, 0x8a7a65, 0xffb347], 30, { speed: 10, size: 0.3, life: 0.8, up: 0.7 });
    g.sceneMgr.addShake(0.55);
    g.sceneMgr.punch(0.06);
    g.hitStop = Math.max(g.hitStop, 0.05);
    g.audio.slam(s.crit);

    // Hasar: yakından uzağa doğru (dalga hissi), hepsi aynı karede
    hits.sort((a, b) => a.along - b.along);
    const struck = new Set();
    for (const { e } of hits) {
      if (!e.alive) continue;
      struck.add(e);
      const primary = e === s.target;
      g.damageEnemy(e, primary ? s.dmg : s.dmg * 0.85, { crit: s.crit, primary });
      const kb = 16 * (e.def.knockback ?? 1);
      e.knock.x += dir.x * kb;
      e.knock.z += dir.z * kb;
    }
    if (struck.size >= 4) {
      const at = origin.clone().addScaledVector(dir, reach * 0.5);
      at.y += 3;
      g.floating.spawn(at, `EZİLDİ x${struck.size}!`, 'chain');
    }
    if (s.target.incoming && s.target.alive) { s.target.incoming = false; }
    this._chain(s.target, s.dmg, s.crit, struck);
  }

  _quakeMesh(origin, dir, width) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(this.quakeGeo, mat);
    m.position.set(origin.x, 0.03, origin.z);
    m.rotation.y = Math.atan2(dir.x, dir.z);
    m.scale.set(width * 0.6, 1, 0.01);
    this.game.scene.add(m);
    return m;
  }

  // ---------------- GÜNCELLEME ----------------
  update(dt) {
    const g = this.game;
    this._updateStrikes(dt);

    for (let i = this.pendingSlams.length - 1; i >= 0; i--) {
      const s = this.pendingSlams[i];
      s.t -= dt;
      if (s.t <= 0) {
        this.pendingSlams.splice(i, 1);
        this._slam(s);
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const done = p.kind === 'arrow' ? this._updateArrow(p, dt) : this._updateBolt(p, dt);
      if (done) {
        g.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.quakes.length - 1; i >= 0; i--) {
      const q = this.quakes[i];
      q.dist = Math.min(q.reach, q.dist + dt * 45);
      q.life -= dt;
      q.mesh.scale.z = q.dist;
      q.mesh.material.opacity = Math.max(0, Math.min(0.8, q.life));
      while (q.nextBurst < q.dist) {
        const at = this._b.copy(q.origin).addScaledVector(q.dir, q.nextBurst);
        at.x += (Math.random() - 0.5) * q.width * 0.6;
        at.z += (Math.random() - 0.5) * q.width * 0.6;
        at.y = 0.2;
        g.particles.burst(at, [0x6b5a45, 0x9a8a72, 0x4a3d30, 0xffb347], 7, { speed: 7, size: 0.32, life: 0.7, up: 0.85 });
        q.nextBurst += 1.1;
      }
      if (q.life <= 0) {
        g.scene.remove(q.mesh);
        q.mesh.material.dispose();
        this.quakes.splice(i, 1);
      }
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      if (b.beam) {
        const k = Math.max(0, b.life / b.maxLife);
        b.mat.opacity = k;
        b.mesh.scale.x = b.mesh.scale.y = b.width * (0.4 + k * 0.6);
      } else b.mat.opacity = Math.max(0, b.life / 0.25) * (Math.random() > 0.3 ? 1 : 0.4);
      if (b.life <= 0) {
        g.scene.remove(b.group);
        b.mat.dispose();
        this.bolts.splice(i, 1);
      }
    }
  }

  _updateBolt(p, dt) {
    const g = this.game;
    if (p.target.alive) p.aim.copy(p.target.mesh.position).setY(p.target.height * 0.5);
    const dir = this._a.subVectors(p.aim, p.mesh.position);
    const dist = dir.length();
    p.speed += 45 * dt;
    const step = p.speed * dt;
    if (dist <= step + 0.4) {
      g.particles.burst(p.aim, p.crit ? 0xffd84a : 0x7fe3ff, 12, { speed: 7, size: 0.18, life: 0.35 });
      if (p.target.alive) {
        g.damageEnemy(p.target, p.dmg, { crit: p.crit, primary: true });
        this._chain(p.target, p.dmg, p.crit, new Set([p.target]));
      }
      return true;
    }
    p.mesh.position.addScaledVector(dir, step / dist);
    p.mesh.rotation.x += dt * 12;
    p.mesh.rotation.y += dt * 9;
    g.particles.trail(p.mesh.position, p.crit ? 0xffb300 : 0x5fd8ff);
    return false;
  }

  _updateArrow(p, dt) {
    const g = this.game;
    const pos = p.mesh.position;
    // Hedefe varana kadar güdümlü, sonra dümdüz devam eder
    if (!p.passed) {
      if (p.target.alive) p.aim.copy(p.target.mesh.position).setY(p.target.height * 0.5);
      else p.passed = true;
      if (!p.passed) p.dir.subVectors(p.aim, pos).normalize();
    }
    if (p.dir.lengthSq() === 0) p.dir.set(0, 0, 1);
    const step = p.speed * dt;
    pos.addScaledVector(p.dir, step);
    if (p.passed) pos.y = Math.max(0.8, pos.y - (p.straight && pos.y > 1.2 ? step * 0.6 : dt * 1.5));
    p.travel += step;
    if (p.passed) p.afterTravel += step;
    this._b.copy(pos).add(p.dir);
    p.mesh.lookAt(this._b);
    g.particles.trail(pos, p.crit ? 0xffd84a : 0xbfffcf);

    // Yolundaki her düşmanı del
    for (const e of g.enemies) {
      if (!e.alive || p.hit.has(e)) continue;
      const dx = e.mesh.position.x - pos.x, dz = e.mesh.position.z - pos.z;
      if (dx * dx + dz * dz > (e.radius + 0.75) ** 2) continue;
      p.hit.add(e);
      const primary = e === p.target;
      const at = e.mesh.position.clone().setY(e.height * 0.5);
      g.particles.burst(at, p.crit ? 0xffd84a : 0xbfffcf, 8, { speed: 6, size: 0.15, life: 0.3 });
      g.damageEnemy(e, primary ? p.dmg : p.dmg * 0.8, { crit: p.crit, primary, pierce: !primary });
      if (primary) {
        p.passed = true;
        this._chain(e, p.dmg, p.crit, new Set(p.hit));
      }
    }
    if (p.hit.size === 3 && !p.shownPierce) {
      p.shownPierce = true;
      const at = pos.clone(); at.y += 2.5;
      g.floating.spawn(at, 'DELİP GEÇTİ!', 'chain');
    }

    const lim = CONFIG.ARENA_SIZE / 2;
    const out = Math.abs(pos.x) > lim || Math.abs(pos.z) > lim;
    if ((p.straight ? p.travel > 26 : p.afterTravel > 12) || p.travel > 60 || out) {
      if (p.target.alive && p.target.incoming) p.target.incoming = false;
      return true;
    }
    return false;
  }

  /** Şimşek Zinciri: hedeften en yakın düşmanlara sekme */
  _chain(source, baseDmg, crit, already) {
    const g = this.game;
    const n = g.stats.chainCount;
    if (!n) return;
    const range = CONFIG.COMBAT.chainRange * (g.stats.chainRangeMult ?? 1);
    const hit = new Set(already);
    let from = source.mesh.position.clone();
    let dmg = baseDmg;
    let count = 0;
    for (let k = 0; k < n; k++) {
      let next = null, bestD = range ** 2;
      for (const e of g.enemies) {
        if (!e.alive || hit.has(e)) continue;
        const d = e.mesh.position.distanceToSquared(from);
        if (d < bestD) { bestD = d; next = e; }
      }
      if (!next) break;
      hit.add(next);
      count++;
      dmg *= CONFIG.COMBAT.chainDamageFactor;
      const to = next.mesh.position.clone();
      const hitDmg = dmg * (g.stats.chainDmgMult ?? 1);
      this.bolt(from, to);
      g.damageEnemy(next, hitDmg, { crit, chain: true });
      from = to;
    }
    if (count >= 2) {
      const at = from.clone();
      at.y += 3;
      g.floating.spawn(at, HYPE.chain.replace('{n}', count + 1), 'chain');
    }
  }

  /** Zikzak şimşek görseli */
  bolt(a, b) {
    const g = this.game;
    const mat = new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 1, toneMapped: false, depthWrite: false });
    const group = new THREE.Group();
    const segs = 7;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y = 1.1;
      if (i > 0 && i < segs) {
        p.x += (Math.random() - 0.5) * 1.0;
        p.z += (Math.random() - 0.5) * 1.0;
        p.y += (Math.random() - 0.5) * 0.6;
      }
      pts.push(p);
    }
    for (let i = 0; i < segs; i++) {
      const m = new THREE.Mesh(this.boltGeo, mat);
      const len = pts[i].distanceTo(pts[i + 1]);
      m.position.lerpVectors(pts[i], pts[i + 1], 0.5);
      m.lookAt(pts[i + 1]);
      m.scale.set(1, 1, len);
      group.add(m);
    }
    g.scene.add(group);
    this.bolts.push({ group, mat, life: 0.25 });
    g.particles.burst(pts[segs], 0xbff4ff, 8, { speed: 6, size: 0.14, life: 0.3 });
  }
}
