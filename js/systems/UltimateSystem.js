// ============================================================
//  ULTİ SİSTEMİ
//  Her karakterin ultisi kendi süresinde (characters.js → ult.cooldown) dolar
//  ve Space ile kullanılır. Etkiler aşağıda karakter id'sine göre yazılı.
//  Yeni karakter eklerken ULTS içine aynı id ile bir fonksiyon ekle.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { groundDecal } from './GroundFx.js';

export class UltimateSystem {
  constructor(game) {
    this.game = game;
    this.charge = 0;     // 0..1
    this.active = [];    // süreli etkiler (meteorlar, kasırga)
    this._v = new THREE.Vector3();
    this.meteorGeo = new THREE.IcosahedronGeometry(0.55, 1);
    this.meteorMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, toneMapped: false });
  }

  get ult() { return this.game.character.ult; }
  get ready() { return this.charge >= 1; }
  get remaining() { return Math.max(0, (1 - this.charge) * (this.ult?.cooldown ?? 30)); }

  reset() {
    this.charge = 0;
    for (const a of this.active) a.dispose?.();
    this.active = [];
  }

  update(dt) {
    const wasReady = this.ready;
    if (this.ult) this.charge = Math.min(1, this.charge + (dt / this.ult.cooldown) * (this.game.stats.ultRate ?? 1));
    if (!wasReady && this.ready) {
      this.game.audio.pickup();
      this.game.hud.ultReady();
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      if (this.active[i].update(dt)) {
        this.active[i].dispose?.();
        this.active.splice(i, 1);
      }
    }
  }

  trigger() {
    const g = this.game;
    if (!this.ready || g.state !== 'playing' || !this.ult) return false;
    const fn = ULTS[g.character.id];
    if (!fn) return false;
    this.charge = 0;
    g.audio.ult();
    g.hud.screenFlash('gold');
    g.sceneMgr.punch(0.1);
    const at = g.player.position.clone();
    at.y += g.player.height + 4.5;
    g.floating.spawn(at, this.ult.name.toLocaleUpperCase('tr-TR') + '!', 'epic');
    fn(this, g);
    return true;
  }

  // ---------- yardımcılar ----------
  baseDamage(mult) {
    const s = this.game.stats;
    let dmg = CONFIG.COMBAT.baseDamage * s.damageMult * mult;
    const crit = Math.random() < s.critChance;
    if (crit) dmg *= s.critMult;
    return { dmg, crit };
  }

  enemiesWithin(center, r) {
    // Yalnızca yatay mesafe (kahraman burcun tepesindeyken de doğru çalışsın)
    return this.game.enemies.filter((e) => e.alive && Math.hypot(e.mesh.position.x - center.x, e.mesh.position.z - center.z) < r + e.radius);
  }

  /** Kale Savunmasında alan ultileri sur dibine kadar uzanır */
  reach(r) {
    return this.game.player.anchor ? Math.max(r, this.game.castle ? this.game.castle.radius + 4 : r) : r;
  }

  pushOut(e, from, force) {
    const dx = e.mesh.position.x - from.x, dz = e.mesh.position.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    const kb = force * (e.def.knockback ?? 1);
    e.knock.x += (dx / d) * kb;
    e.knock.z += (dz / d) * kb;
  }
}

// ============================================================
//  ULTİ ETKİLERİ
// ============================================================
const ULTS = {
  // ☄️ Büyücü: Meteor Yağmuru
  buyucu(sys, g) {
    const pp = g.player.position;
    // Asayı göğe kaldırır, ayaklarının altında mor rün çemberi döner
    g.player.setPose('raise', 1.4);
    sys.active.push(groundDecal(g.scene, pp.clone(), { kind: 'rune', color: 0xb65cff, radius: 4.5, life: 2, spin: 1.2, particles: g.particles }));
    const targets = sys.enemiesWithin(pp, 20)
      .sort((a, b) => a.mesh.position.distanceTo(pp) - b.mesh.position.distanceTo(pp))
      .slice(0, 12);
    if (!targets.length) {
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        targets.push({ ghost: true, mesh: { position: pp.clone().add(new THREE.Vector3(Math.cos(a) * 6, 0, Math.sin(a) * 6)) } });
      }
    }
    targets.forEach((t, i) => {
      const land = t.mesh.position.clone().setY(0);
      const mesh = new THREE.Mesh(sys.meteorGeo, sys.meteorMat);
      const start = land.clone().add(new THREE.Vector3(-6, 18, -4));
      mesh.position.copy(start);
      mesh.visible = false;
      g.scene.add(mesh);
      let t0 = -i * 0.09;
      sys.active.push({
        update(dt) {
          t0 += dt;
          if (t0 < 0) return false;
          mesh.visible = true;
          const k = Math.min(1, t0 / 0.45);
          mesh.position.lerpVectors(start, land, k * k);
          mesh.rotation.x += dt * 10;
          g.particles.emit(mesh.position.x, mesh.position.y, mesh.position.z, Math.random() < 0.5 ? 0xff7a1a : 0xffd84a,
            (Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2, 0.35, 0.35, 0);
          if (k < 1) return false;
          // Çarpma
          g.particles.ring(land, 0xff6a00, 3.2, 0.4);
          g.particles.burst(land.clone().setY(0.5), [0xff6a00, 0xffd84a, 0x3a2a1a], 26, { speed: 12, size: 0.3, life: 0.7 });
          g.sceneMgr.addShake(0.25);
          g.audio.slam(false);
          for (const e of sys.enemiesWithin(land, 2.6)) {
            const { dmg, crit } = sys.baseDamage(t.ghost ? 1.5 : 3);
            g.damageEnemy(e, dmg, { crit, ult: true });
            sys.pushOut(e, land, 12);
          }
          return true;
        },
        dispose() { g.scene.remove(mesh); },
      });
    });
  },

  // 🌋 Tepegöz: Deprem
  tepegoz(sys, g) {
    const pp = g.player.position.clone().setY(0);
    g.player.attack('slam');
    const scale = sys.reach(11) / 11;
    let t = 0;
    let rings = 0;
    sys.active.push({
      update(dt) {
        t += dt;
        // Topuz inince (hazırlık süresi kadar sonra) üç dalga halinde sarsıntı
        const windup = g.character.slam?.windup ?? 0.28;
        while (t > windup + rings * 0.18 && rings < 3) {
          const R = (4 + rings * 3.5) * scale;
          g.particles.ring(pp, rings === 0 ? 0xffb347 : 0xff6a00, R, 0.5);
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            g.particles.burst(new THREE.Vector3(pp.x + Math.cos(a) * R, 0.3, pp.z + Math.sin(a) * R),
              [0x6b5a45, 0x9a8a72, 0xffb347], 3, { speed: 7, size: 0.35, life: 0.8, up: 0.9 });
          }
          if (rings === 0) {
            g.sceneMgr.addShake(1);
            g.audio.slam(true);
            g.hitStop = Math.max(g.hitStop, 0.1);
            for (const e of sys.enemiesWithin(pp, sys.reach(11))) {
              const { dmg, crit } = sys.baseDamage(2.5);
              e.stunT = 3;
              g.damageEnemy(e, dmg, { crit, ult: true });
              sys.pushOut(e, pp, 18);
            }
          }
          rings++;
        }
        return rings >= 3;
      },
    });
  },

  // 🌧️ Elf Okçu: Ok Yağmuru
  okcu(sys, g) {
    g.player.setPose('bowUp', 0.7);
    sys.active.push(groundDecal(g.scene, g.player.position.clone(), { kind: 'rune', color: 0x5cd66a, radius: 3.5, life: 1, spin: 2 }));
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const { dmg, crit } = sys.baseDamage(1.4);
      g.combat.fireStraightArrow(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), dmg, crit);
    }
    g.particles.ring(g.player.position, 0x5cd66a, 5, 0.4);
    g.audio.arrow();
  },

  // 🌪️ Şövalye: Çelik Kasırga
  sovalye(sys, g) {
    const p = g.player;
    const duration = 3.5;
    let t = 0;
    let tick = 0;
    const speedBoost = g.stats.moveSpeed * 0.35;
    g.stats.moveSpeed += speedBoost;
    p.ultInvuln = duration;
    sys.active.push({
      update(dt) {
        t += dt;
        tick -= dt;
        p.ultInvuln = Math.max(0, duration - t);
        p.whirl = true; // sürekli dönme animasyonu
        if (tick <= 0) {
          tick = 0.35;
          const at = p.position.clone().setY(0);
          const R = sys.reach(4.8);
          g.particles.ring(at, 0xe8f4ff, R, 0.25);
          if (p.anchor) g.particles.ring(at, 0xffffff, R - 2.5, 0.25);
          g.audio.slash(false);
          for (const e of sys.enemiesWithin(at, R)) {
            const { dmg, crit } = sys.baseDamage(1.1);
            g.damageEnemy(e, dmg, { crit, ult: true });
            sys.pushOut(e, at, 9);
          }
        }
        return t >= duration;
      },
      dispose() {
        g.stats.moveSpeed -= speedBoost;
        p.ultInvuln = 0;
        p.whirl = false;
      },
    });
  },

  // 💖 Şifacı: Kutsal Işık
  sifaci(sys, g) {
    const p = g.player;
    const pp = p.position.clone();
    // Ellerini göğe kaldırır, ayaklarının altında yeşil şifa alanı açılır
    p.setPose('raise', 1.8);
    sys.active.push(groundDecal(g.scene, pp.clone(), { kind: 'heal', color: 0x5dff7a, radius: 5, life: 2, particles: g.particles }));
    p.heal(g.stats.maxHp * 0.6);
    if (g.castle) g.castle.repair(g.castle.maxHp * 0.2);
    g.audio.heal();
    const at = pp.clone(); at.y += p.height + 0.4;
    g.floating.spawn(at, `+${Math.round(g.stats.maxHp * 0.6)}`, 'heal');
    // Gökten ışık sütunu
    g.combat.beamFx(pp.clone().setY(pp.y + 16), pp.clone(), 0xfff6c0, 1.6, 0.8);
    g.particles.ring(pp, 0xfff1a0, 8, 0.6);
    g.particles.ring(pp, 0x6dff8a, 5, 0.5);
    g.particles.burst(pp.clone().setY(pp.y + 1), [0xfff6c0, 0x6dff8a, 0xffffff], 50, { speed: 12, size: 0.22, life: 0.9, gravity: 2 });
    if (p.anchor) g.particles.ring(pp.clone().setY(0), 0xfff1a0, sys.reach(8), 0.6);
    for (const e of sys.enemiesWithin(pp, sys.reach(8))) {
      const { dmg, crit } = sys.baseDamage(1.5);
      g.damageEnemy(e, dmg, { crit, ult: true });
      sys.pushOut(e, pp, 20);
    }
  },
};
