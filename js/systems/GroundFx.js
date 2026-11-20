// ============================================================
//  ZEMİN EFEKTLERİ: yeşil şifa alanı, rün çemberi, kalkan kubbesi
//  Canvas ile çizilen dokular; bir kez üretilir, tekrar kullanılır.
// ============================================================
import * as THREE from 'three';

const cache = {};

/** Merkezden dışa parlayan halka dokusu (şifa alanı) */
function glowTexture(hex) {
  const key = 'glow' + hex;
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const col = new THREE.Color(hex);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, `rgba(${rgb},0.55)`);
  grad.addColorStop(0.65, `rgba(${rgb},0.25)`);
  grad.addColorStop(0.9, `rgba(${rgb},0.9)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  // Artı işaretleri (şifa sembolü)
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = 128 + Math.cos(a) * 70, y = 128 + Math.sin(a) * 70;
    g.fillRect(x - 9, y - 3, 18, 6);
    g.fillRect(x - 3, y - 9, 6, 18);
  }
  g.fillRect(128 - 16, 128 - 5, 32, 10);
  g.fillRect(128 - 5, 128 - 16, 10, 32);
  return (cache[key] = new THREE.CanvasTexture(c));
}

/** Rün çemberi (büyü) */
function runeTexture(hex) {
  const key = 'rune' + hex;
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const col = '#' + new THREE.Color(hex).getHexString();
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = 5;
  g.shadowColor = col;
  g.shadowBlur = 10;
  for (const r of [118, 98, 60]) { g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
  // Yıldız
  g.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    const x = 128 + Math.cos(a) * 98, y = 128 + Math.sin(a) * 98;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  // Halka üstünde rün işaretleri
  g.font = 'bold 18px serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈ';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    g.save();
    g.translate(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108);
    g.rotate(a + Math.PI / 2);
    g.fillText(runes[i], 0, 0);
    g.restore();
  }
  return (cache[key] = new THREE.CanvasTexture(c));
}

/**
 * Yere serilen, zamanla sönen efekt.
 * Dönen nesne { update(dt) → bitti mi, dispose() }
 * opts: kind ('heal'|'rune'), color, radius, life, spin, parent (varsayılan sahne),
 *       particles (ParticleSystem) → yükselen kıvılcımlar
 */
export function groundDecal(scene, pos, opts = {}) {
  const { kind = 'heal', color = 0x5dff7a, radius = 4, life = 1.6, spin = 0.6, particles = null } = opts;
  const tex = kind === 'rune' ? runeTexture(color) : glowTexture(color);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(pos);
  mesh.position.y += 0.06;
  (opts.parent ?? scene).add(mesh);

  // Kenarda yükselen ışık sütunu (silindir)
  let pillar = null;
  if (kind === 'heal') {
    pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.98, radius, 2.2, 32, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })
    );
    pillar.position.copy(mesh.position);
    pillar.position.y += 1.1;
    (opts.parent ?? scene).add(pillar);
  }

  let t = 0;
  const world = new THREE.Vector3();
  return {
    update(dt) {
      t += dt;
      const k = t / life;
      const grow = Math.min(1, t / 0.25);
      const fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      mesh.scale.setScalar(0.3 + 0.7 * grow * (1 + Math.sin(t * 6) * 0.03));
      mesh.rotation.z += dt * spin;
      mat.opacity = Math.max(0, fade);
      if (pillar) {
        pillar.scale.set(grow, 0.6 + grow * 0.4, grow);
        pillar.material.opacity = 0.18 * Math.max(0, fade);
      }
      if (particles && fade > 0.2) {
        mesh.getWorldPosition(world);
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * radius * grow;
          particles.emit(world.x + Math.cos(a) * r, world.y + 0.1, world.z + Math.sin(a) * r,
            Math.random() < 0.7 ? color : 0xffffff, 0, 2.5 + Math.random() * 2, 0, 0.14, 0.9, 1.5);
        }
      }
      return t >= life;
    },
    dispose() {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mat.dispose();
      if (pillar) { pillar.removeFromParent(); pillar.geometry.dispose(); pillar.material.dispose(); }
    },
  };
}

/** Yarı saydam kalkan kubbesi (zırh) */
export function shieldDome(parent, pos, radius = 8, color = 0x7fd3ff, life = 1.2) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, wireframe: false, toneMapped: false });
  const wire = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, wireframe: true, depthWrite: false, toneMapped: false });
  const geo = new THREE.SphereGeometry(radius, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(geo, mat);
  const net = new THREE.Mesh(geo, wire);
  dome.scale.set(1.25, 0.55, 0.62);
  net.scale.copy(dome.scale);
  dome.position.copy(pos);
  net.position.copy(pos);
  parent.add(dome, net);
  let t = 0;
  return {
    update(dt) {
      t += dt;
      const k = t / life;
      const s = Math.min(1, t / 0.2);
      dome.scale.set(1.25 * s, 0.55 * s, 0.62 * s);
      net.scale.copy(dome.scale);
      mat.opacity = 0.3 * (1 - k);
      wire.opacity = 0.5 * (1 - k);
      return t >= life;
    },
    dispose() {
      dome.removeFromParent(); net.removeFromParent();
      geo.dispose(); mat.dispose(); wire.dispose();
    },
  };
}
