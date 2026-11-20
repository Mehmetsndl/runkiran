// ============================================================
//  ZAMANA BAĞLI DALGA MODU (Hayatta Kalma ve Akın'ın temeli)
//  Bir mod sınıfının uyguladığı arayüz:
//    setup()            oyun başlarken
//    update(dt)         doğumlar ve mod kuralları
//    enemyTarget(e)     yaratığın yürüyeceği nokta
//    afterEnemies(dt)   hareketten sonra ek kurallar (kale çarpışması vb.)
//    checkEnd()         null ya da { result, title, sub }
//    onPlayerDeath()    oyuncu ölünce dönen bitiş bilgisi
//    summary()          { metrics: lider tablosu değerleri, stats: oyun sonu kutuları }
//    timerText()        sağ üstteki saat (isteğe bağlı)
//    mountHud(el) / updateHud()  ekranın üst ortasındaki mod paneli
// ============================================================
import { CONFIG } from '../../config.js';
import { pickWeighted } from '../../utils.js';

export const fmtClock = (s) => {
  const t = Math.max(0, Math.floor(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export class TimedWaveMode {
  constructor(game, def, waves) {
    this.game = game;
    this.def = def;
    this.waves = waves;
    this.waveIndex = -1;
    this.spawnTimer = 0;
    this.eliteTimer = 0;
    this.hpScalePerMinute = CONFIG.WAVES.hpScalePerMinute;
  }

  setup() {}

  get hpScale() {
    return 1 + (this.game.elapsed / 60) * this.hpScalePerMinute;
  }

  update(dt) {
    const g = this.game;
    while (this.waveIndex + 1 < this.waves.length && g.elapsed >= this.waves[this.waveIndex + 1].start) {
      this.waveIndex++;
      const w = this.waves[this.waveIndex];
      g.hud.showBanner(w.title, w.subtitle);
      this.eliteTimer = w.elite?.immediate ? w.elite.every : 0;
      this.swarmTimer = 0;
      if (w.boss) this._spawnBoss(w.boss);
      if (w.bossCycle) { this.cycleT = 0; this.cycleI = 0; }
    }
    const wave = this.waves[Math.max(0, this.waveIndex)];

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = wave.spawnEvery;
      for (let i = 0; i < wave.batch; i++) {
        if (g.enemies.length >= wave.maxAlive) break;
        g.waves.spawn(pickWeighted(wave.types), { hpScale: this.hpScale });
      }
    }
    // Sürü: aynı yönden bir anda gelen hızlı yaratıklar
    if (wave.swarm) {
      this.swarmTimer = (this.swarmTimer ?? 0) + dt;
      if (this.swarmTimer >= wave.swarm.every) {
        this.swarmTimer = 0;
        const angle = Math.random() * Math.PI * 2;
        const n = wave.swarm.count + Math.floor(g.elapsed / 300);
        for (let i = 0; i < n; i++) g.waves.spawn(wave.swarm.type, { hpScale: this.hpScale, angle, spread: 0.6 });
        g.hud.showBanner('⚠️ SÜRÜ!', `${n} ${wave.swarm.type === 'cin' ? 'cin' : 'kurt'} aynı yönden koşuyor`);
      }
    }
    // Sonsuz dalgada bosslar sırayla geri gelir
    if (wave.bossCycle) {
      this.cycleT += dt;
      if (this.cycleT >= wave.bossCycle.every) {
        this.cycleT = 0;
        const list = wave.bossCycle.list;
        this._spawnBoss(list[this.cycleI % list.length]);
        this.cycleI++;
      }
    }
    if (wave.elite) {
      this.eliteTimer += dt;
      if (this.eliteTimer >= wave.elite.every) {
        this.eliteTimer = 0;
        g.waves.spawn(wave.elite.type, { hpScale: this.hpScale });
      }
    }
  }

  /** Boss(lar)ı oyuncudan uzakta doğur */
  _spawnBoss(ids) {
    const g = this.game;
    for (const id of [].concat(ids)) g.waves.spawn(id, { hpScale: this.bossHpScale, radius: 24 });
  }

  /** Bosslar biraz daha yavaş güçlenir (yoksa çok uzun sürer) */
  get bossHpScale() { return 1 + (this.game.elapsed / 60) * this.hpScalePerMinute * 0.75; }

  /** 8. dakikadan sonra yaratıklar dakikada %3 hızlanır (en çok %45) */
  get speedMult() {
    const m = this.game.elapsed / 60;
    return 1 + Math.min(0.45, Math.max(0, m - 8) * 0.03);
  }

  enemyTarget() { return this.game.player.position; }
  afterEnemies() {}
  checkEnd() { return null; }

  onPlayerDeath() {
    return { result: 'lose', title: 'DÜŞTÜN, RÜNKIRAN', sub: '' };
  }

  summary() {
    const g = this.game;
    return {
      metrics: { bestTime: g.elapsed, bestXp: g.xp.totalEarned },
      stats: [
        { label: 'Hayatta Kalma', value: fmtClock(g.elapsed) },
        { label: 'Öldürme', value: g.kills },
      ],
    };
  }

  timerText() { return null; }
  mountHud(el) { el.hidden = true; }
  updateHud() {}
  dispose() {}
}
