// ============================================================
//  KART ARŞİVİ: iki deste
//   - Yetenek Kartları (aksiyon modlarında seviye atlayınca)
//  Nadirlik ve kategoriye göre süzülebilir, adla aranabilir.
// ============================================================
import { UPGRADES, FALLBACK_UPGRADES, RARITIES, CATEGORIES } from '../data/upgrades.js';

const ORDER = ['efsanevi', 'destansi', 'nadir', 'yaygin'];
const strip = (html) => html.replace(/<[^>]+>/g, '');
const pct = (v) => (v * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 });

// ---------------- Yetenek kartları ----------------
const UP_ALL = [...UPGRADES, ...FALLBACK_UPGRADES.map((u) => ({ ...u, fallback: true }))];
const upById = Object.fromEntries(UP_ALL.map((u) => [u.id, u]));
const UP_ITEMS = UP_ALL.map((u) => {
  const tags = [];
  if (u.timed) tags.push(`<span class="cp-tag timed">⏱️ ${u.dur} sn süreli</span>`);
  if (u.fallback) tags.push('<span class="cp-tag">Yedek kart: diğerleri bitince çıkar</span>');
  if (u.modes) tags.push('<span class="cp-tag mode">🏰 Yalnızca Kale Savunması</span>');
  if (u.notModes) tags.push('<span class="cp-tag off">Kale Savunması\'nda çıkmaz</span>');
  if (u.requires) tags.push(`<span class="cp-tag req">Önce: ${upById[u.requires]?.icon ?? ''} ${upById[u.requires]?.name ?? u.requires}</span>`);
  const lv = u.timed ? 'Tekrar gelirse süre yenilenir' : u.maxLevel === Infinity || u.maxLevel >= 99 ? 'Sınırsız alınır' : u.maxLevel === 1 ? 'Tek seferlik' : `En fazla ${u.maxLevel} kez`;
  return { name: u.name, icon: u.icon, rarity: u.rarity, cat: u.cat, desc: u.desc(1), meta: `${CATEGORIES[u.cat] ?? ''} · ${lv}`, tags: tags.join('') };
});

const SOURCES = {
  yetenek: {
    tab: '⚔️ Yetenek Kartları',
    items: UP_ITEMS,
    cats: CATEGORIES,
    sub: () => `${UP_ITEMS.length} kart · Hayatta Kalma, Kale Savunması ve Akın'da seviye atladığında 3 kart çıkar, birini seçersin. Her kart yuvasının nadirlik olasılığı:
      ${ORDER.map((r) => `<b class="cp-r r-${r}">${RARITIES[r].label} %${pct(RARITIES[r].chance)}</b>`).join(' · ')}.
      ⏱️ Süreli kartlar seçildiği an başlar, süre bitince etkisi kalkar.`,
  },
};

export class CardsPage {
  constructor(onClose) {
    this.el = document.getElementById('cardsPage');
    this.onClose = onClose;
    this.source = 'yetenek';
    this.rarity = 'all';
    this.cat = 'all';
    this.query = '';
    this.el.innerHTML = `
      <div class="cp-wrap panel">
        <div class="cp-head">
          <div>
            <h2>KART ARŞİVİ</h2>
            <p class="sub cp-sub"></p>
          </div>
          <button type="button" class="btn ghost cp-close">KAPAT <small>(Esc)</small></button>
        </div>
        <div class="cp-filters">
          <div class="cp-chips" data-group="rarity"></div>
          <div class="cp-chips" data-group="cat"></div>
          <input class="cp-search" type="search" placeholder="Kart ara…" autocomplete="off" spellcheck="false" />
        </div>
        <div class="cp-grid"></div>
        <p class="cp-empty" hidden>Bu filtrede kart yok.</p>
      </div>`;
    this.grid = this.el.querySelector('.cp-grid');
    this.empty = this.el.querySelector('.cp-empty');
    this.el.querySelector('.cp-close').addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
      const tab = e.target.closest('.cp-tabs button');
      if (tab) { this.setSource(tab.dataset.src); tab.blur(); return; }
      const b = e.target.closest('.cp-chips button');
      if (!b) return;
      const group = b.parentElement.dataset.group;
      this[group] = b.dataset.v;
      for (const x of b.parentElement.children) x.classList.toggle('on', x === b);
      this.render();
    });
    this.search = this.el.querySelector('.cp-search');
    this.search.addEventListener('input', () => { this.query = this.search.value.trim().toLocaleLowerCase('tr-TR'); this.render(); });
    this.setSource('yetenek');
  }

  setSource(src) {
    this.source = src;
    this.rarity = 'all';
    this.cat = 'all';
    const S = SOURCES[src];
    for (const b of this.el.querySelectorAll('.cp-tabs button')) b.classList.toggle('on', b.dataset.src === src);
    this.el.querySelector('.cp-sub').innerHTML = S.sub();
    const counts = Object.fromEntries(ORDER.map((r) => [r, S.items.filter((u) => u.rarity === r).length]));
    this.el.querySelector('[data-group="rarity"]').innerHTML = `
      <button type="button" data-v="all" class="on">Tümü <i>${S.items.length}</i></button>
      ${ORDER.map((r) => `<button type="button" data-v="${r}" class="r-${r}">${RARITIES[r].label} <i>${counts[r]}</i></button>`).join('')}`;
    this.el.querySelector('[data-group="cat"]').innerHTML = `
      <button type="button" data-v="all" class="on">Hepsi</button>
      ${Object.entries(S.cats).map(([k, v]) => `<button type="button" data-v="${k}">${v}</button>`).join('')}`;
    this.render();
  }

  get isOpen() { return this.el.classList.contains('visible'); }

  open(src) {
    if (src && src !== this.source) this.setSource(src);
    this.el.classList.add('visible');
    this.el.querySelector('.cp-wrap').scrollTop = 0;
  }

  close() {
    if (!this.isOpen) return;
    this.el.classList.remove('visible');
    this.search.blur();
    this.onClose?.();
  }

  render() {
    const list = SOURCES[this.source].items
      .filter((u) => this.rarity === 'all' || u.rarity === this.rarity)
      .filter((u) => this.cat === 'all' || u.cat === this.cat)
      .filter((u) => !this.query || (u.name + ' ' + strip(u.desc)).toLocaleLowerCase('tr-TR').includes(this.query))
      .sort((a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name, 'tr'));
    this.empty.hidden = list.length > 0;
    this.grid.innerHTML = list.map((u) => `
        <article class="cp-card r-${u.rarity}"${u.color ? ` style="--tc:${u.color}"` : ''}>
          <span class="cp-rarity">${RARITIES[u.rarity].label}</span>
          <span class="cp-icon">${u.icon}</span>
          <h4>${u.name}</h4>
          <p class="cp-desc">${u.desc}</p>
          <p class="cp-meta">${u.meta}</p>
          ${u.tags}
        </article>`).join('');
  }
}
