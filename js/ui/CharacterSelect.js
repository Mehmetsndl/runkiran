// Karakter seçim ekranı: dönen 3D önizleme, özellik çubukları, artı/eksiler.
// Fare ile tıkla veya 1/2/3 ile seç, Enter ile başla, Esc ile geri dön.
import * as THREE from 'three';
import { CHARACTERS } from '../data/characters.js';
import { buildPlayerModel } from '../entities/PlayerModels.js';
import { FETIH_PASSIVES as PASSIVES } from '../data/fetih.js';

const PICK_KEY = 'runkiran-karakter';
const PREVIEW = 220;

export class CharacterSelect {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('charselect');
    this.cardsEl = this.el.querySelector('.char-cards');
    this.goBtn = document.getElementById('charGoBtn');
    this.backBtn = document.getElementById('charBackBtn');
    this.open = false;
    let saved = null;
    try { saved = localStorage.getItem(PICK_KEY); } catch (_) { /* yok say */ }
    this.selected = CHARACTERS.some((c) => c.id === saved) ? saved : CHARACTERS[0].id;

    this._buildCards();
    this.cardsEl.addEventListener('click', (e) => {
      const card = e.target.closest('.char-card');
      if (card) this.select(card.dataset.id);
    });
    this.cardsEl.addEventListener('dblclick', (e) => {
      if (e.target.closest('.char-card')) this.confirm();
    });
    this.goBtn.addEventListener('click', () => this.confirm());
    this.backBtn.addEventListener('click', () => this.game.closeCharacterSelect());
  }

  get character() { return CHARACTERS.find((c) => c.id === this.selected); }

  _buildCards() {
    this.cardsEl.innerHTML = CHARACTERS.map((c, i) => `
      <button type="button" class="char-card" data-id="${c.id}" style="--cc:${c.color}">
        <span class="card-key">${i + 1}</span>
        <canvas width="${PREVIEW}" height="${PREVIEW}" aria-hidden="true"></canvas>
        <span class="char-name">${c.name}</span>
        <span class="char-title">${c.icon} ${c.title}</span>
        <span class="char-bars">
          ${Object.entries(c.bars).map(([k, v]) => `
            <span class="bar-row"><span class="bar-label">${k}</span>
              <span class="bar">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= v ? 'on' : ''}"></i>`).join('')}</span>
            </span>`).join('')}
        </span>
        <span class="char-ability"><b>${c.ability.name}</b>${c.ability.text}</span>
        ${c.ult ? `<span class="char-ult"><b>${c.ult.icon} ULTİ: ${c.ult.name} <em>${c.ult.cooldown} sn</em></b>${c.ult.text}</span>` : ''}
        <span class="char-table"><b>👑 Hükümdar Masası'nda</b>${PASSIVES[c.id]?.text ?? ''}</span>
        <span class="char-traits">
          ${c.pros.map((t) => `<span class="pro">＋ ${t}</span>`).join('')}
          ${c.cons.map((t) => `<span class="con">－ ${t}</span>`).join('')}
        </span>
      </button>`).join('');
    this.canvases = [...this.cardsEl.querySelectorAll('canvas')].map((cv) => cv.getContext('2d'));
    this.select(this.selected);
  }

  /** Önizleme sahnesi ilk açılışta kurulur (tek WebGL bağlamı, 3 kart) */
  _setupPreview() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(PREVIEW, PREVIEW);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x3a2a1a, 1.4));
    const key = new THREE.DirectionalLight(0xffe2b8, 2.2);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fe3ff, 1.2);
    rim.position.set(-4, 3, -3);
    this.scene.add(rim);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    this.models = CHARACTERS.map((c) => {
      const m = buildPlayerModel(c);
      m.root.visible = false;
      this.scene.add(m.root);
      return m;
    });
    this.t = 0;
  }

  show() {
    this._setupPreview();
    this.open = true;
    this.shownAt = performance.now();
    this.el.classList.add('visible');
    this.select(this.selected);
    this._last = performance.now();
    const loop = (now) => {
      if (!this.open) return;
      this.t += (now - this._last) / 1000;
      this._last = now;
      this._renderPreviews();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  hide() {
    this.open = false;
    this.el.classList.remove('visible');
  }

  _renderPreviews() {
    CHARACTERS.forEach((c, i) => {
      const m = this.models[i];
      this.models.forEach((o) => { o.root.visible = o === m; });
      const isSel = c.id === this.selected;
      m.root.rotation.y = this.t * (isSel ? 1.2 : 0.5) + i;
      // Seçili karakter yürüme animasyonu yapar
      const swing = isSel ? Math.sin(this.t * 7) : 0;
      if (m.parts.legL) m.parts.legL.rotation.x = swing * 0.5;
      if (m.parts.legR) m.parts.legR.rotation.x = -swing * 0.5;
      if (m.parts.armL) m.parts.armL.rotation.x = -swing * 0.4;
      if (m.parts.armR) m.parts.armR.rotation.x = swing * 0.4;
      const h = m.height;
      this.camera.position.set(0, h * 0.62, h * 2.3 + 1.2);
      this.camera.lookAt(0, h * 0.48, 0);
      this.renderer.render(this.scene, this.camera);
      const ctx = this.canvases[i];
      ctx.clearRect(0, 0, PREVIEW, PREVIEW);
      ctx.drawImage(this.renderer.domElement, 0, 0);
    });
  }

  select(id) {
    if (!CHARACTERS.some((c) => c.id === id)) return;
    this.selected = id;
    for (const card of this.cardsEl.querySelectorAll('.char-card')) {
      const on = card.dataset.id === id;
      card.classList.toggle('selected', on);
      card.setAttribute('aria-pressed', on);
    }
    this.goBtn.textContent = '';
    this.goBtn.append(`${this.character.name.toLocaleUpperCase('tr-TR')} İLE BAŞLA `);
    const small = document.createElement('small');
    small.textContent = '(Enter)';
    this.goBtn.append(small);
    try { localStorage.setItem(PICK_KEY, id); } catch (_) { /* yok say */ }
  }

  handleKey(e) {
    const i = ['1', '2', '3', '4', '5'].indexOf(e.key);
    if (i >= 0 && i < CHARACTERS.length) this.select(CHARACTERS[i].id);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const idx = CHARACTERS.findIndex((c) => c.id === this.selected);
      const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + CHARACTERS.length) % CHARACTERS.length;
      this.select(CHARACTERS[next].id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat && performance.now() - this.shownAt > 250) this.confirm();
    } else if (e.key === 'Escape') {
      this.game.closeCharacterSelect();
    }
  }

  confirm() {
    this.game.start(this.selected);
  }
}
