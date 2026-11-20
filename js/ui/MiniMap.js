// ============================================================
//  MİNİ HARİTA
//  Sağ üstte, kahramanı merkeze alan küçük harita. Ekrandaki yönle aynı
//  döner (yukarı = kameranın baktığı yön).
//   ▲ sen · 🟢 ekip arkadaşı · 🔴 yaratık · 🟣 elit · 🟠 boss
//   🔷 yerdeki XP kristali · 🏰 kale (Kale Savunması)
//  Haritaya tıklayınca büyür / küçülür (yazarken harf tuşları kullanıldığı için tuş yok).
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const SIZES = [170, 250];
const RANGE = [42, 60]; // haritanın yarıçapı (dünya birimi)

export class MiniMap {
  constructor(game) {
    this.game = game;
    this.big = 0;
    try { this.big = Number(localStorage.getItem('runkiran-minimap') || 0) ? 1 : 0; } catch (_) { /* yok say */ }
    this.wrap = document.createElement('div');
    this.wrap.id = 'minimap';
    this.wrap.title = 'Mini harita · büyütmek / küçültmek için tıkla';
    this.canvas = document.createElement('canvas');
    this.legend = document.createElement('div');
    this.legend.className = 'mm-legend';
    this.legend.innerHTML = '<span><i class="me"></i>Sen</span><span><i class="en"></i>Yaratık</span><span><i class="xp"></i>XP</span>';
    this.wrap.append(this.canvas, this.legend);
    document.getElementById('hud').appendChild(this.wrap);
    this.ctx = this.canvas.getContext('2d');
    this.wrap.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.big = 1 - this.big;
      try { localStorage.setItem('runkiran-minimap', String(this.big)); } catch (_) { /* yok say */ }
      this._resize();
    });
    this.right = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.frame = 0;
    this._resize();
  }

  _resize() {
    const s = SIZES[this.big];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = s * dpr;
    this.canvas.height = s * dpr;
    this.canvas.style.width = `${s}px`;
    this.canvas.style.height = `${s}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.size = s;
    this.wrap.classList.toggle('big', !!this.big);
  }

  update() {
    const g = this.game;
    const show = ['playing', 'paused', 'levelup'].includes(g.state) && !!g.mode;
    if (this.wrap.hidden === show) this.wrap.hidden = !show;
    if (!show) return;
    if (++this.frame % 2) return;
    this._draw();
  }

  _draw() {
    const g = this.game;
    const ctx = this.ctx;
    const S = this.size, H = S / 2;
    const R = RANGE[this.big];
    const k = (H - 6) / R;
    // Ekran yönü: kameranın sağ ve ileri vektörleri (yere izdüşürülmüş)
    const cam = g.camera;
    cam.updateMatrixWorld();
    this.right.setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
    this.fwd.set(this.right.z, 0, -this.right.x); // ekranın yukarısı = kameranın baktığı yön
    const pp = g.player.position;
    const to = (x, z) => {
      const dx = x - pp.x, dz = z - pp.z;
      return [H + (dx * this.right.x + dz * this.right.z) * k, H - (dx * this.fwd.x + dz * this.fwd.z) * k];
    };
    const inside = (sx, sy, m = 4) => sx > m && sy > m && sx < S - m && sy < S - m;

    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(H, H, H - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(12, 10, 8, 0.78)';
    ctx.fillRect(0, 0, S, S);
    // Izgara halkaları
    ctx.strokeStyle = 'rgba(255, 216, 74, 0.10)';
    ctx.lineWidth = 1;
    for (const r of [R / 3, (R * 2) / 3]) { ctx.beginPath(); ctx.arc(H, H, r * k, 0, Math.PI * 2); ctx.stroke(); }
    // Arena sınırı
    const L = CONFIG.ARENA_SIZE / 2;
    ctx.strokeStyle = 'rgba(255, 90, 60, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    [[-L, -L], [L, -L], [L, L], [-L, L]].forEach(([x, z], i) => { const [sx, sy] = to(x, z); if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); });
    ctx.closePath();
    ctx.stroke();
    // Kale
    if (g.castle) {
      const [cx, cy] = to(0, 0);
      ctx.fillStyle = 'rgba(255, 179, 71, 0.25)';
      ctx.strokeStyle = '#ffb347';
      ctx.beginPath(); ctx.arc(cx, cy, (g.castle.radius ?? 6) * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // XP kristalleri
    for (const c of g.xp.crystals ?? []) {
      const [sx, sy] = to(c.mesh.position.x, c.mesh.position.z);
      if (!inside(sx, sy)) continue;
      ctx.fillStyle = c.value > 1 ? '#bff4ff' : '#4fd8ff';
      const r = c.value > 1 ? 2.6 : 1.7;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    // Yaratıklar
    const t = performance.now() / 1000;
    const bosses = [];
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const [sx, sy] = to(e.mesh.position.x, e.mesh.position.z);
      if (e.def.boss) { bosses.push([sx, sy, e]); continue; }
      if (!inside(sx, sy)) continue;
      ctx.fillStyle = e.def.elite ? '#c77dff' : e.locked ? '#ffd84a' : '#ff4a3a';
      ctx.beginPath();
      ctx.arc(sx, sy, e.def.elite ? 3.6 : e.radius > 0.5 ? 2.8 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Ekip arkadaşları (Boss Avı)
    for (const gh of g.mode?.ghosts?.values?.() ?? []) {
      if (gh.gone) continue;
      const [sx, sy] = to(gh.pos.x, gh.pos.z);
      if (!inside(sx, sy)) continue;
      ctx.fillStyle = gh.dead ? '#6a7a6a' : '#5aff7a';
      ctx.strokeStyle = '#0a2a10';
      ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // Bosslar: büyük, nabız atan; menzil dışındaysa kenarda ok
    for (const [sx, sy] of bosses) {
      if (inside(sx, sy, 8)) {
        const r = 6 + Math.sin(t * 6) * 1.5;
        ctx.fillStyle = '#ff8a1a';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        const a = Math.atan2(sy - H, sx - H);
        const ex = H + Math.cos(a) * (H - 10), ey = H + Math.sin(a) * (H - 10);
        ctx.save();
        ctx.translate(ex, ey); ctx.rotate(a);
        ctx.fillStyle = '#ff8a1a';
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    // Kahraman: bakış yönünü gösteren ok
    const face = g.player.mesh.rotation.y;
    const fx = Math.sin(face), fz = Math.cos(face);
    const ang = Math.atan2(-(fx * this.fwd.x + fz * this.fwd.z), fx * this.right.x + fz * this.right.z);
    ctx.save();
    ctx.translate(H, H);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffd84a';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5.5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5.5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // Toplama menzili
    ctx.strokeStyle = 'rgba(127, 227, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(H, H, (g.stats.pickupRadius ?? 2) * k, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // Çerçeve
    ctx.strokeStyle = 'rgba(255, 179, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(H, H, H - 1, 0, Math.PI * 2); ctx.stroke();
  }
}
