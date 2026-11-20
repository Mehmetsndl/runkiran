// Düşmanların üzerindeki kelime etiketleri (3D konumdan ekrana yansıtılan DOM)
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { trUpper } from '../utils.js';

export class LabelLayer {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.map = new Map();
    this.v = new THREE.Vector3();
  }

  add(enemy) {
    const el = document.createElement('div');
    el.className = 'label' + (enemy.def.elite ? ' elite' : '') + (enemy.def.boss ? ' boss' : '');
    el.innerHTML = '<div class="word"></div><div class="hpbar"><i></i></div>';
    this.root.appendChild(el);
    this.map.set(enemy, { el, wordEl: el.firstChild, hpEl: el.lastChild.firstChild, key: '' });
  }

  remove(enemy) {
    const entry = this.map.get(enemy);
    if (!entry) return;
    entry.el.remove();
    this.map.delete(enemy);
  }

  shake(enemy) {
    const entry = this.map.get(enemy);
    if (!entry) return;
    entry.el.classList.remove('shake');
    void entry.el.offsetWidth;
    entry.el.classList.add('shake');
  }

  update() {
    const cam = this.game.camera;
    const w = window.innerWidth, h = window.innerHeight;
    for (const [e, entry] of this.map) {
      this.v.copy(e.mesh.position);
      this.v.y += e.height * e.mesh.scale.y + 0.5;
      this.v.project(cam);
      if (Math.abs(this.v.x) > 1.15 || Math.abs(this.v.y) > 1.15) {
        entry.el.style.display = 'none';
        continue;
      }
      entry.el.style.display = '';
      const x = (this.v.x * 0.5 + 0.5) * w;
      const y = (-this.v.y * 0.5 + 0.5) * h;
      entry.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;

      const key = `${e.word}|${e.typed}|${e.locked}|${e.incoming}|${Math.ceil(e.hp)}`;
      if (key !== entry.key) {
        entry.key = key;
        const done = trUpper(e.word.slice(0, e.typed));
        const rest = trUpper(e.word.slice(e.typed));
        entry.wordEl.innerHTML = `<span class="done">${done}</span><span class="rest">${rest}</span>`;
        entry.el.classList.toggle('locked', e.locked);
        entry.el.classList.toggle('incoming', e.incoming);
        const multiHit = e.maxHp > CONFIG.COMBAT.baseDamage * this.game.stats.damageMult || e.hp < e.maxHp;
        entry.el.classList.toggle('showhp', multiHit);
        entry.hpEl.style.width = `${Math.max(0, (e.hp / e.maxHp) * 100)}%`;
        entry.el.style.zIndex = e.locked ? 10 : 1;
      }
    }
  }
}
