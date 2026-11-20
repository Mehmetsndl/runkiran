// Can, XP, süre, kombo, yazma paneli, dalga afişi ve yetenek ikonları
import { CONFIG } from '../config.js';
import { UPGRADES, FALLBACK_UPGRADES } from '../data/upgrades.js';
import { trUpper } from '../utils.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.g = game;
    this.hpFill = $('hpfill');
    this.hpText = $('hptext');
    this.xpFill = $('xpfill');
    this.levelText = $('leveltext');
    this.timer = $('timer');
    this.kills = $('kills');
    this.combo = $('combo');
    this.comboNum = $('comboNum');
    this.comboBonus = $('comboBonus');
    this.typingWord = $('typingWord');
    this.modeText = $('modeText');
    this.banner = $('banner');
    this.build = $('buildIcons');
    this.vignette = $('vignette');
    this.flash = $('flash');
    this.muteBtn = $('muteBtn');
    this.charTag = $('charTag');
    this.modeInfo = $('modeInfo');
    this.ultEl = $('ult');
    this.ultIcon = $('ultIcon');
    this.ultText = $('ultText');
    this.ultName = $('ultName');
    this.mode = null;

    this.muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      game.audio.muted = !game.audio.muted;
      this.muteBtn.textContent = game.audio.muted ? '🔇' : '🔊';
      this.muteBtn.blur();
    });

    this._lastStreak = 0;
    this._typingKey = null;
    this._mode = null;
    this._time = -1;
  }

  update() {
    const g = this.g, p = g.player, s = g.stats;

    this.hpFill.style.width = `${Math.max(0, (p.hp / s.maxHp) * 100)}%`;
    this.hpText.textContent = `${Math.max(0, Math.ceil(p.hp))} / ${Math.round(s.maxHp)}`;
    this.xpFill.style.width = `${Math.min(100, (g.xp.xp / g.xp.toNext) * 100)}%`;
    this.levelText.textContent = `Seviye ${g.xp.level}`;

    const modeClock = this.mode?.timerText();
    const sec = Math.floor(g.elapsed);
    if (modeClock) {
      if (modeClock !== this._time) { this._time = modeClock; this.timer.textContent = modeClock; }
    } else if (sec !== this._time) {
      this._time = sec;
      this.timer.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    }
    if (this.mode && g.state !== 'menu') this.mode.updateHud();

    // Ulti halkası
    const u = g.ult;
    if (u?.ult) {
      this.ultEl.style.setProperty('--p', (u.charge * 100).toFixed(1));
      const txt = u.ready ? 'SPACE' : `${Math.ceil(u.remaining)} sn`;
      if (txt !== this._ultTxt) { this._ultTxt = txt; this.ultText.textContent = txt; }
      this.ultEl.classList.toggle('ready', u.ready);
    }
    this.kills.textContent = `💀 ${g.kills}`;

    // Kombo sayacı
    const streak = g.typing.streak;
    if (streak !== this._lastStreak) {
      this.comboNum.textContent = streak;
      this.combo.classList.remove('pop', 'break');
      void this.combo.offsetWidth;
      if (streak > this._lastStreak) this.combo.classList.add('pop');
      else if (this._lastStreak >= 3) this.combo.classList.add('break');
      this.combo.classList.toggle('hot', streak >= 10);
      this.combo.classList.toggle('inferno', streak >= 25);
      this._lastStreak = streak;
    }
    const bonus = s.comboLetterBonus * Math.min(streak, CONFIG.COMBAT.comboLetterCap);
    this.comboBonus.textContent = bonus > 0 ? `+%${Math.round(bonus * 100)} hasar` : '';

    // Yazma paneli
    const t = g.typing.target;
    const gh = !t && g.typing.ghost && performance.now() - g.typing.ghost.at < 3000 ? g.typing.ghost : null;
    const key = t ? `${t.word}|${t.typed}` : gh ? `g|${gh.word}|${gh.typed}` : '';
    if (key !== this._typingKey) {
      this._typingKey = key;
      if (gh) {
        // Hedef başka bir şeyle öldü: kalan harfleri cezasız bitirebilirsin
        this.typingWord.innerHTML =
          `<span class="done">${trUpper(gh.word.slice(0, gh.typed))}</span><span class="rest ghost">${trUpper(gh.word.slice(gh.typed))}</span><em class="ghost-tag">hedef düştü · kombo güvende</em>`;
        this.typingWord.classList.remove('idle');
      } else if (t) {
        this.typingWord.innerHTML =
          `<span class="done">${trUpper(t.word.slice(0, t.typed))}</span><span class="rest">${trUpper(t.word.slice(t.typed))}</span>`;
        this.typingWord.classList.remove('idle');
      } else {
        this.typingWord.textContent = 'Bir kelimenin ilk harfine bas';
        this.typingWord.classList.add('idle');
      }
    }

    const mk = g.moveMode + (g.player.anchor ? '!' : '');
    if (mk !== this._mode) {
      this._mode = mk;
      this.modeText.textContent = g.player.anchor ? '🏰 Burçta sabitsin: imlecle nişan al' : g.moveMode === 'follow' ? '🖱️ Hareket: İmleci Takip Et' : '🖱️ Hareket: Tıkla ve Git';
    }
  }

  /** Oyun modunun üst-orta panelini kur */
  mountMode(mode) {
    this.mode = mode;
    this.modeInfo.replaceChildren();
    mode.mountHud(this.modeInfo);
  }

  castleHit() { this._retrigger(this.modeInfo, 'hit'); }

  ultReady() { this._retrigger(this.ultEl, 'flashready'); }
  ultNotReady() { this._retrigger(this.ultEl, 'deny'); }

  setCharacter(c) {
    if (c.ult) {
      this.ultIcon.textContent = c.ult.icon;
      this.ultName.textContent = c.ult.name;
      this.ultEl.hidden = false;
    } else this.ultEl.hidden = true;
    this.charTag.textContent = `${c.icon} ${c.name}`;
    this.charTag.style.setProperty('--cc', c.color);
  }

  refreshBuild() {
    const levels = this.g.upgrades.levels;
    const all = [...UPGRADES, ...FALLBACK_UPGRADES];
    this.build.innerHTML = all
      .filter((u) => levels[u.id] && u.maxLevel !== Infinity && !u.timed)
      .map((u) => `<div class="bicon" title="${u.name}">${u.icon}<sub>${levels[u.id]}</sub></div>`)
      .join('');
  }

  showBanner(title, sub) {
    this.banner.querySelector('.b-title').textContent = title;
    this.banner.querySelector('.b-sub').textContent = sub;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
  }

  flashError() { this._retrigger(this.typingWord.parentElement, 'error'); }
  hurt() { this._retrigger(this.vignette, 'hit'); }
  screenFlash(cls = 'white') {
    this.flash.className = '';
    void this.flash.offsetWidth;
    this.flash.className = cls;
  }

  _retrigger(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
}
