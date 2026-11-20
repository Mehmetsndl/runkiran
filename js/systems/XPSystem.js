// XP kristalleri: düşer, mıknatıslanır, otomatik toplanır; seviye atlamayı sayar.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { rand } from '../utils.js';

export class XPSystem {
  constructor(game) {
    this.game = game;
    this.crystals = [];
    this.level = 1;
    this.xp = 0;
    this.curve = CONFIG.XP;   // modlar kendi eğrisini verebilir (setCurve)
    this.toNext = CONFIG.XP.baseToLevel;
    this.pendingLevels = 0;
    this.totalEarned = 0; // bu oyunda kazanılan toplam XP (lider tablosu)

    this.geo = new THREE.OctahedronGeometry(0.28);
    this.mat = new THREE.MeshStandardMaterial({ color: 0x5fe0ff, emissive: 0x23a8ff, emissiveIntensity: 1.4, roughness: 0.2 });
    this.bigMat = new THREE.MeshStandardMaterial({ color: 0xd28bff, emissive: 0x9b30ff, emissiveIntensity: 1.6, roughness: 0.2 });
    this._dir = new THREE.Vector3();
    this._target = new THREE.Vector3();
  }

  drop(pos, value) {
    if (value >= 5) this._spawn(pos, value, true);
    else for (let i = 0; i < value; i++) this._spawn(pos, 1, false);
  }

  _spawn(pos, value, big) {
    const mesh = new THREE.Mesh(this.geo, big ? this.bigMat : this.mat);
    mesh.scale.setScalar(big ? 1.9 : 1);
    mesh.position.set(pos.x, 0.8, pos.z);
    this.game.scene.add(mesh);
    const a = Math.random() * Math.PI * 2;
    const sp = rand(2, 5);
    this.crystals.push({
      mesh, value, grounded: false, magnet: false, speed: 0, t: rand(0, 6),
      vel: new THREE.Vector3(Math.cos(a) * sp, rand(5, 8), Math.sin(a) * sp),
    });
  }

  update(dt) {
    const g = this.game;
    const p = g.player.position;
    const R = g.stats.pickupRadius;
    for (let i = this.crystals.length - 1; i >= 0; i--) {
      const c = this.crystals[i];
      const m = c.mesh;
      c.t += dt;
      m.rotation.y += dt * 3;
      if (!c.magnet) {
        if (!c.grounded) {
          c.vel.y -= 25 * dt;
          m.position.addScaledVector(c.vel, dt);
          if (m.position.y <= 0.5) { m.position.y = 0.5; c.grounded = true; }
        } else {
          m.position.y = 0.5 + Math.sin(c.t * 3) * 0.12;
        }
        const dx = p.x - m.position.x, dz = p.z - m.position.z;
        if (dx * dx + dz * dz < R * R || (g.player.anchor && c.grounded && c.t > 0.4)) { c.magnet = true; c.speed = 3; }
      } else {
        c.speed += 45 * dt;
        this._target.set(p.x, p.y + 1, p.z);
        const dir = this._dir.subVectors(this._target, m.position);
        const dist = dir.length();
        if (dist < 0.8) {
          this._collect(c);
          g.scene.remove(m);
          this.crystals.splice(i, 1);
          continue;
        }
        m.position.addScaledVector(dir, Math.min(dist, c.speed * dt) / dist);
      }
    }
  }

  /** Seviye eğrisini değiştir (ör. Kale Savunması daha seyrek kart verir) */
  setCurve(curve) {
    this.curve = curve;
    this.toNext = curve.baseToLevel;
  }

  _collect(c) {
    const g = this.game;
    const gain = c.value * g.stats.xpMult;
    this.xp += gain;
    this.totalEarned += gain;
    g.audio.pickup();
    g.particles.burst(c.mesh.position, c.value >= 5 ? 0xd28bff : 0x7fe3ff, 4, { speed: 3, size: 0.12, life: 0.25 });
    while (this.xp >= this.toNext) {
      this.xp -= this.toNext;
      this.level++;
      this.toNext = Math.ceil(this.toNext * this.curve.growth + this.curve.flatGrowth);
      this.pendingLevels++;
    }
  }
}
