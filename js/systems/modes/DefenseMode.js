// KALE SAVUNMASI: yaratıklar kaleye yürür ve ona vurur. 10 dalga boyunca kaleyi koru.
import * as THREE from 'three';
import { DEFENSE } from '../../data/defense.js';
import { Castle, GATE_ANGLE } from '../../entities/Castle.js';
import { CastleWorks } from '../CastleWorks.js';
import { CONFIG } from '../../config.js';

export class DefenseMode {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.cfg = DEFENSE;
    this.wave = 0;            // şu anki / son başlayan dalga
    this.cleared = 0;         // temizlenen dalga sayısı
    this.phase = 'prep';      // prep | wave | won
    this.timer = DEFENSE.firstWaveDelay;
    this.queue = [];
    this.spawnTimer = 0;
    this.sides = [];
    this._v = new THREE.Vector3();
  }

  get total() { return this.cfg.waves.length; }

  setup() {
    const g = this.game;
    this.castle = new Castle(g, { maxHp: this.cfg.castleHp });
    g.castle = this.castle;
    // Kahraman burcun tepesinde sabit durur: yürümez, imlece döner ve yazarak savunur
    g.player.anchor = this.castle.playerSpot.clone();
    g.player.position.copy(g.player.anchor);
    g.player.clickTarget = null;
    this.works = new CastleWorks(g, this);
    g.xp.setCurve(this.cfg.xpCurve);
    // Kamera yaratıkların geldiği yola (ekranın sağına) kayar; üstteki arayüz yolu kapatmaz
    this.cameraFocus = Castle.dir(GATE_ANGLE).multiplyScalar(this.cfg.camShift).setY(1.5);
    document.body.classList.add('kale-on');
    g.sceneMgr.camFocus.copy(this.cameraFocus);
    g.sceneMgr.setViewSize(this.cfg.viewSize);
    g.sceneMgr.clearDecor(this.castle.radius + 3.5);
    this._hint = document.getElementById('hintText');
    this._hintOld = this._hint?.textContent;
    if (this._hint) this._hint.textContent = 'Burçtasın · Yaz ve vur · 1–7: dükkân · Space: ulti · Esc: duraklat';
    g.hud.showBanner('KALEYİ KORU!', `Yaratıklar sağdaki yoldan gelecek. Altınla kaleni güçlendir!`);
  }

  _startWave() {
    const g = this.game;
    this.wave++;
    const spec = this.cfg.waves[this.wave - 1];
    this.queue = [];
    for (const [type, n] of Object.entries(spec)) for (let i = 0; i < n; i++) this.queue.push(type);
    // Karıştır, şefler en sona
    this.queue.sort(() => Math.random() - 0.5);
    this.queue.sort((a, b) => (a === 'orkSefi') - (b === 'orkSefi'));
    // Yaratıklar hep aynı yoldan, kapıya doğru gelir
    this.sides = [GATE_ANGLE];
    this.spawnEvery = Math.max(0.32, 1.0 - this.wave * 0.07);
    this.spawnTimer = 0;
    this.phase = 'wave';
    const boss = spec.orkSefi ? ' · Ork Şefi var!' : '';
    g.hud.showBanner(`${this.wave}. DALGA`, `${this.queue.length} yaratık kapıya yürüyor${boss}`);
  }

  _waveCleared() {
    const g = this.game;
    this.cleared = this.wave;
    if (this.wave >= this.total) {
      this.phase = 'won';
      return;
    }
    this.phase = 'prep';
    this.timer = this.cfg.intermission;
    const fix = this.castle.maxHp * this.cfg.repairBetweenWaves;
    this.castle.repair(fix);
    g.player.heal(g.stats.maxHp * 0.15);
    const bonus = this.cfg.waveGold[0] + this.wave * this.cfg.waveGold[1];
    this.works.addGold(bonus, true);
    g.hud.showBanner(`${this.wave}. DALGA PÜSKÜRTÜLDÜ!`, `+${bonus} altın · Surlar +${Math.round(fix)} onarıldı · Sonraki dalga ${this.cfg.intermission} sn`);
    g.particles.ring(this.castle.position, 0x6dff8a, 7, 0.7);
    g.audio.levelUp();
  }

  update(dt) {
    const g = this.game;
    this.castle.update(dt);
    if (this.phase === 'prep') {
      this.timer -= dt;
      if (this.timer <= 0) this._startWave();
    } else if (this.phase === 'wave') {
      this.spawnTimer -= dt;
      const maxAlive = 16 + this.wave * 3;
      if (this.spawnTimer <= 0 && this.queue.length && g.enemies.length < maxAlive) {
        this.spawnTimer = this.spawnEvery;
        const side = this.sides[Math.floor(Math.random() * this.sides.length)];
        g.waves.spawn(this.queue.shift(), {
          center: this.castle.position, radius: this.cfg.spawnRadius, angle: Math.PI / 2 - side, spread: this.cfg.spread, // spawn açısı x=cos,z=sin kullanır
          hpScale: 1 + (this.wave - 1) * this.cfg.hpScalePerWave,
        });
      }
      if (!this.queue.length && g.enemies.length === 0) this._waveCleared();
    }
  }

  /** Yaratıklar doğrudan surlara yürür */
  enemyTarget() {
    return this.castle.position;
  }

  afterEnemies(dt) {
    const c = this.castle;
    const g = this.game;
    this.works.update(dt);
    for (const e of [...g.enemies]) {
      const p = e.mesh.position;
      if (e.spawnT >= 1 && this.works.enemyHitsGuard(e, dt)) { e.atWall = false; continue; }
      e.atWall = c.pushOut(p, e.radius);
      if (e.atWall) {
        if (e.spawnT >= 1) {
          e.attackCd -= dt;
          if (e.attackCd <= 0) {
            e.attackCd = this.cfg.attackInterval * (0.8 + Math.random() * 0.4);
            e.attackPulse = 1;
            c.damage(e.def.damage * this.cfg.castleDamageMult * (1 - (this.castleDmgReduce ?? 0)) * (1 - (g.stats.castleShield ?? 0)) * (1 + (this.wave - 1) * this.cfg.dmgScalePerWave), p);
            if (g.stats.thorns > 0) g.damageEnemy(e, g.stats.thorns, { helper: true });
          }
        }
      } else {
        e.attackCd = Math.min(e.attackCd, 0.4);
      }
    }
  }

  onEnemyKilled(e, pos) { this.works.onKill(e, pos); }

  /** Dükkân kısayolları (1–7) */
  onKey(e) { return this.works.handleKey(e.key); }

  checkEnd() {
    if (this.castle.hp <= 0) {
      return { result: 'lose', title: 'KALE DÜŞTÜ!', sub: `${this.cleared}/${this.total} dalga savunuldu.` };
    }
    if (this.phase === 'won') {
      return { result: 'win', title: 'ZAFER! KALE AYAKTA', sub: `${this.total} dalganın hepsi püskürtüldü.` };
    }
    return null;
  }

  onPlayerDeath() {
    return { result: 'lose', title: 'KALENİN KORUYUCUSU DÜŞTÜ', sub: `${this.cleared}/${this.total} dalga savunuldu.` };
  }

  summary() {
    const g = this.game;
    return {
      metrics: { bestWave: this.cleared, bestXp: g.xp.totalEarned },
      stats: [
        { label: 'Dalga', value: `${this.cleared}/${this.total}` },
        { label: 'Kale Canı', value: `%${Math.round(this.castle.hpRatio * 100)}` },
        { label: 'Kazanılan Altın', value: `${this.works.earned.toLocaleString('tr-TR')} 🪙` },
      ],
    };
  }

  timerText() { return null; }

  mountHud(el) {
    el.hidden = false;
    el.innerHTML = `
      <div class="mh-defense">
        <div class="mh-row"><span class="mh-label">🏰 KALE</span><span class="mh-wave"></span></div>
        <div class="mh-bar"><i></i><span></span></div>
        <div class="mh-note"></div>
      </div>`;
    this.hud = {
      wrap: el.firstElementChild,
      wave: el.querySelector('.mh-wave'),
      fill: el.querySelector('.mh-bar i'),
      text: el.querySelector('.mh-bar span'),
      note: el.querySelector('.mh-note'),
    };
    this._key = '';
    this.works.mountUI(document.getElementById('hud'));
  }

  updateHud() {
    const c = this.castle;
    const h = this.hud;
    const left = this.queue.length + this.game.enemies.length;
    const note = this.phase === 'prep'
      ? `Sonraki dalga: ${Math.ceil(this.timer)} sn`
      : this.phase === 'wave' ? `Kalan yaratık: ${left}` : '';
    const key = `${Math.ceil(c.hp)}|${this.wave}|${note}`;
    if (key === this._key) return;
    this._key = key;
    h.wave.textContent = `Dalga ${Math.max(1, this.wave)}/${this.total}`;
    h.fill.style.width = `${c.hpRatio * 100}%`;
    h.text.textContent = `${Math.ceil(c.hp)} / ${c.maxHp}`;
    h.note.textContent = note;
    h.wrap.classList.toggle('danger', c.hpRatio < 0.3);
  }

  dispose() {
    const g = this.game;
    g.player.anchor = null;
    g.player.position.set(0, 0, 0);
    g.castle = null;
    g.sceneMgr.setViewSize(CONFIG.CAMERA.viewSize);
    g.sceneMgr.clearDecor(0);
    if (this._hint) this._hint.textContent = this._hintOld;
    document.body.classList.remove('kale-on');
    this.works?.dispose();
    this.castle?.dispose();
  }
}
