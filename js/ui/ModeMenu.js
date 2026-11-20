// Ana menüdeki oyun modu kartları. Seçilen mod hatırlanır ve lider tablosu ona göre değişir.
import { MODES } from '../data/modes.js';

const MODE_KEY = 'runkiran-mod';

export class ModeMenu {
  constructor(root, onChange) {
    this.root = root;
    this.onChange = onChange;
    let saved = null;
    try { saved = localStorage.getItem(MODE_KEY); } catch (_) { /* yok say */ }
    this.selected = MODES.some((m) => m.id === saved) ? saved : MODES[0].id;

    root.innerHTML = MODES.map((m, i) => `
      <button type="button" class="mode-card" data-id="${m.id}" style="--mc:${m.color}">
        <span class="mode-key">${i + 1}</span>
        <span class="mode-icon">${m.icon}</span>
        <span class="mode-name">${m.name}</span>
        <span class="mode-desc">${m.desc}</span>
        <ul class="mode-rules">${m.rules.map((r) => `<li>${r}</li>`).join('')}</ul>
      </button>`).join('');
    root.addEventListener('click', (e) => {
      const card = e.target.closest('.mode-card');
      if (card) { this.select(card.dataset.id); card.blur(); }
    });
    this.select(this.selected, true);
  }

  select(id, silent = false) {
    if (!MODES.some((m) => m.id === id)) return;
    this.selected = id;
    for (const c of this.root.querySelectorAll('.mode-card')) {
      const on = c.dataset.id === id;
      c.classList.toggle('selected', on);
      c.setAttribute('aria-pressed', on);
    }
    try { localStorage.setItem(MODE_KEY, id); } catch (_) { /* yok say */ }
    if (!silent) this.onChange?.(id);
  }

  /** Menüde 1/2/3 veya sol/sağ ok ile mod değiştir */
  handleKey(e) {
    const i = ['1', '2', '3', '4', '5'].indexOf(e.key);
    if (i >= 0 && i < MODES.length) { this.select(MODES[i].id); return true; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const idx = MODES.findIndex((m) => m.id === this.selected);
      const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + MODES.length) % MODES.length;
      this.select(MODES[next].id);
      return true;
    }
    return false;
  }
}
