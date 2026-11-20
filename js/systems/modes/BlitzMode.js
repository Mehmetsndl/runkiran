// AKIN: 3 dakikalık zamana karşı mod. Skor = öldürme sayısı.
import { BLITZ_WAVES } from '../../data/waves.js';
import { TimedWaveMode, fmtClock } from './TimedWaveMode.js';

const DURATION = 180;

export class BlitzMode extends TimedWaveMode {
  constructor(game, def) {
    super(game, def, BLITZ_WAVES);
    this.hpScalePerMinute = 0.1;
    this.duration = DURATION;
  }

  setup() {
    this.game.stats.xpMult *= 1.5;
  }

  get remaining() { return Math.max(0, this.duration - this.game.elapsed); }

  checkEnd() {
    if (this.remaining > 0) return null;
    return { result: 'timeup', title: 'SÜRE DOLDU!', sub: `${this.game.kills} yaratık kestin.` };
  }

  onPlayerDeath() {
    return { result: 'lose', title: 'AKINDA DÜŞTÜN', sub: `Kalan süre: ${fmtClock(this.remaining)}` };
  }

  summary() {
    const g = this.game;
    return {
      metrics: { bestKills: g.kills, bestXp: g.xp.totalEarned },
      stats: [
        { label: 'Öldürme', value: g.kills },
        { label: 'Süre', value: fmtClock(Math.min(g.elapsed, this.duration)) },
      ],
    };
  }

  timerText() { return fmtClock(this.remaining); }

  mountHud(el) {
    el.hidden = false;
    el.innerHTML = '<div class="mh-blitz"><span class="mh-label">⚔️ AKIN</span><b class="mh-clock">03:00</b></div>';
    this.clockEl = el.querySelector('.mh-clock');
    this.wrap = el.firstChild;
    this._last = '';
  }

  updateHud() {
    const t = fmtClock(this.remaining);
    if (t !== this._last) {
      this._last = t;
      this.clockEl.textContent = t;
      this.wrap.classList.toggle('urgent', this.remaining <= 20);
    }
  }
}
