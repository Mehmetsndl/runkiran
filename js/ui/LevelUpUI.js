// Seviye atlayınca beliren 3 yetenek kartı (fare ile tıkla veya 1/2/3 tuşu)
import { RARITIES } from '../data/upgrades.js';

export class LevelUpUI {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('levelup');
    this.cardsEl = this.el.querySelector('.cards');
    this.choices = [];
    this.lockUntil = 0;
    this.cardsEl.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (card) this.pick(Number(card.dataset.i));
    });
  }

  show(choices, live = false) {
    this.choices = choices;
    this.el.classList.toggle('live', live);
    const up = this.game.upgrades;
    this.cardsEl.innerHTML = choices.map((u, i) => {
      const lv = up.level(u.id);
      const lvText = u.timed ? `⏱️ ${u.dur} SN SÜRELİ` : u.maxLevel === Infinity ? 'TÜKETİLEBİLİR' : lv === 0 ? 'YENİ!' : `Sv. ${lv} → ${lv + 1}`;
      return `
        <button class="card r-${u.rarity}" data-i="${i}" style="--d:${i * 0.08}s">
          <span class="card-key">${i + 1}</span>
          <span class="card-icon">${u.icon}</span>
          <span class="card-name">${u.name}</span>
          <span class="card-level">${lvText}</span>
          <span class="card-desc">${u.desc(lv + 1)}</span>
          <span class="card-rarity">${RARITIES[u.rarity].label}</span>
        </button>`;
    }).join('');
    const sub = this.el.querySelector('.sub');
    if (sub) sub.textContent = live
      ? `Savaş sürüyor! Kartını seç: tıkla ya da ${choices.map((_, i) => i + 1).join(' / ')} · yazmaya devam edebilirsin`
      : `Bir yetenek seç — tıkla veya ${choices.map((_, i) => i + 1).join(' / ')}`;
    const h = this.el.querySelector('h2');
    if (h) h.textContent = live ? '🃏 YENİ KART!' : 'SEVİYE ATLADIN!';
    this.el.classList.add('visible');
    // Yazarken yanlışlıkla kart seçilmesin diye kısa kilit
    this.lockUntil = performance.now() + 450;
  }

  hide() {
    this.el.classList.remove('visible');
  }

  handleKey(e) {
    const i = ['1', '2', '3', '4'].indexOf(e.key);
    if (i >= 0 && i < this.choices.length) this.pick(i);
  }

  pick(i) {
    if (performance.now() < this.lockUntil) return;
    const choice = this.choices[i];
    if (!choice) return;
    this.choices = [];
    this.game.onUpgradePicked(choice);
  }
}
