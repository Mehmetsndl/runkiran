// Düşmanları tutar, hareket ettirir, birbirinden ayırır ve oyuncuya temas hasarını uygular.
// NE ZAMAN ve NEREDE doğacaklarına aktif oyun modu karar verir (systems/modes/).
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { drawWord } from '../data/words.js';
import { Enemy } from '../entities/Enemy.js';
import { BossSystem } from './BossSystem.js';

export class WaveManager {
  constructor(game) {
    this.game = game;
    this.enemies = [];
    this.bosses = new BossSystem(game);
  }

  update(dt) {
    const g = this.game;
    g.mode.update(dt);

    // Hareket: hedefi mod belirler (oyuncu ya da kale)
    const speedMult = g.stats.enemySpeedMult * (g.mode.speedMult ?? 1);
    this.bosses.update(dt);
    for (const e of this.enemies) e.update(dt, g.mode.enemyTarget(e), speedMult);

    // Birbirlerinin içine girmesinler
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i].mesh.position;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j].mesh.position;
        const dx = b.x - a.x, dz = b.z - a.z;
        const min = list[i].radius + list[j].radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          const nx = dx / d, nz = dz / d;
          a.x -= nx * push; a.z -= nz * push;
          b.x += nx * push; b.z += nz * push;
        }
      }
    }

    g.mode.afterEnemies(dt);

    // Oyuncuya temas hasarı
    const pp = g.player.position;
    const pr = g.player.radius;
    for (const e of this.enemies) {
      if (e.spawnT < 1) continue;
      const dx = e.mesh.position.x - pp.x, dz = e.mesh.position.z - pp.z;
      const dist = Math.hypot(dx, dz);
      if (dist < e.radius + pr) {
        const dealt = g.player.takeDamage(e.def.damage);
        if (dealt) g.onPlayerHurt(dealt);
        const n = dist || 1;
        e.knock.x += (dx / n) * 10;
        e.knock.z += (dz / n) * 10;
        e.attackPulse = 1;
      }
    }
  }

  /**
   * Yaratık doğur.
   * opts: center (Vector3, varsayılan oyuncu), radius, angle (+spread), hpScale
   */
  spawn(typeId, opts = {}) {
    const def = opts.def ?? ENEMY_TYPES[typeId];
    if (!def) return null;
    const pos = this._findSpawnPos(opts);
    const enemy = new Enemy(this.game, typeId, def, this.pickWord(def.wordTier), pos, opts.hpScale ?? 1);
    this.enemies.push(enemy);
    this.game.labels.add(enemy);
    this.bosses.onSpawn(enemy);
    return enemy;
  }

  /** Ekranda ilk harfi kullanılmayan bir kelime seç (Typing of the Dead tarzı) */
  pickWord(tier, exclude = null) {
    const used = new Set();
    for (const e of this.enemies) if (e.alive && e !== exclude) used.add(e.word[0]);
    return drawWord(tier, used);
  }

  _findSpawnPos({ center, radius, angle, spread = Math.PI * 2 } = {}) {
    const pp = this.game.player.position;
    const c = center ?? pp;
    const R = radius ?? CONFIG.WAVES.spawnRadius;
    const lim = CONFIG.ARENA_SIZE / 2 - 2;
    const p = new THREE.Vector3();
    for (let i = 0; i < 12; i++) {
      const a = angle != null ? angle + (Math.random() - 0.5) * spread : Math.random() * Math.PI * 2;
      const r = R + Math.random() * 6;
      p.set(
        Math.max(-lim, Math.min(lim, c.x + Math.cos(a) * r)),
        0,
        Math.max(-lim, Math.min(lim, c.z + Math.sin(a) * r))
      );
      if (p.distanceTo(pp) >= CONFIG.WAVES.minSpawnDist) break;
    }
    return p;
  }

  remove(enemy) {
    enemy.alive = false;
    const i = this.enemies.indexOf(enemy);
    if (i >= 0) this.enemies.splice(i, 1);
    this.game.labels.remove(enemy);
    this.bosses.onRemove(enemy);
    enemy.dispose();
  }
}
