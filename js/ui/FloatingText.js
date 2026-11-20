// Ekranda uçuşan hasar sayıları ve coşku yazıları (data/hypeTexts.js)
import * as THREE from 'three';

// Sınıf başına davranış: ömür, maksimum pop ölçeği, yükselme hızı
const STYLES = {
  dmg:        { life: 0.8, pop: 1.5, rise: 3.5 },
  'chain-num':{ life: 0.8, pop: 1.4, rise: 3.5 },
  'crit-num': { life: 1.0, pop: 2.0, rise: 4.0 },
  crit:       { life: 1.1, pop: 2.0, rise: 2.5 },
  epic:       { life: 1.6, pop: 1.8, rise: 1.6 },
  streak:     { life: 1.4, pop: 2.0, rise: 1.8 },
  chain:      { life: 1.0, pop: 1.8, rise: 2.5 },
  multi:      { life: 1.2, pop: 2.0, rise: 2.0 },
  miss:       { life: 0.7, pop: 1.3, rise: 2.0 },
  speed:      { life: 0.8, pop: 1.6, rise: 3.0 },
  hurt:       { life: 0.8, pop: 1.5, rise: 3.0 },
  heal:       { life: 0.8, pop: 1.3, rise: 3.0 },
  levelup:    { life: 1.4, pop: 2.2, rise: 2.0 },
};

export class FloatingText {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.items = [];
    this.v = new THREE.Vector3();
  }

  spawn(worldPos, text, cls = 'dmg') {
    const style = STYLES[cls] || STYLES.dmg;
    const el = document.createElement('div');
    el.className = `ft ${cls}`;
    el.textContent = text;
    this.root.appendChild(el);
    const pos = worldPos.clone();
    pos.x += (Math.random() - 0.5) * 0.8;
    pos.z += (Math.random() - 0.5) * 0.8;
    this.items.push({
      el, pos, age: 0, ...style, halfW: el.offsetWidth / 2,
      rot: cls === 'epic' ? (Math.random() - 0.5) * 16 : (Math.random() - 0.5) * 8,
    });
    if (this.items.length > 70) this._kill(0);
  }

  _kill(i) {
    this.items[i].el.remove();
    this.items.splice(i, 1);
  }

  update(dt) {
    const cam = this.game.camera;
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      if (it.age >= it.life) { this._kill(i); continue; }
      it.pos.y += it.rise * dt * Math.max(0.15, 1 - it.age / it.life);

      // Pop: hızlı büyü, sonra normale otur
      let s;
      if (it.age < 0.1) s = 0.3 + (it.pop - 0.3) * (it.age / 0.1);
      else s = it.pop - (it.pop - 1) * Math.min(1, (it.age - 0.1) / 0.25);
      const fade = Math.min(1, Math.max(0, 1 - (it.age - it.life * 0.6) / (it.life * 0.4)));

      this.v.copy(it.pos).project(cam);
      // Büyük yazılar ekran dışına taşmasın
      const m = Math.min(w / 2, it.halfW * s + 12);
      const x = Math.min(w - m, Math.max(m, (this.v.x * 0.5 + 0.5) * w));
      const y = Math.min(h - 140, Math.max(90, (-this.v.y * 0.5 + 0.5) * h));
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${s.toFixed(3)}) rotate(${it.rot}deg)`;
      it.el.style.opacity = fade.toFixed(3);
    }
  }
}
