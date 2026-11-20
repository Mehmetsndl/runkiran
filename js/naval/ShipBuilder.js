// ============================================================
//  KALYON MODELİ
//  Gövde, kesitlerden (stern → bow) üretilen kavisli bir yüzeydir:
//  pruvaya doğru daralır, sintinesi yuvarlaktır, kıç ve pruvası yükselir.
//  Üzerine: güverte, iki sıra top lombozu, kıç köşkü ve pencereleri,
//  baş kasara, cıvadra, üç direk, kumaş dokulu yelkenler, halatlar, flamalar.
//  Gemi yerel ekseni: +X pruva, -Z düşmana bakan borda, Y yukarı.
// ============================================================
import * as THREE from 'three';

export const SHIP = { L: 20, W: 5.8, deckY: 2.62, qdY: 3.9, fcY: 3.55 };

/** Boyuna profil: u = 0 (kıç) → 1 (pruva) */
export function hullProfile(u) {
  let w;
  if (u < 0.12) w = 0.8 + (u / 0.12) * 0.18;
  else if (u < 0.6) w = 0.98 + Math.sin(((u - 0.12) / 0.48) * Math.PI / 2) * 0.02;
  else w = Math.pow(Math.cos(((u - 0.6) / 0.4) * Math.PI / 2), 0.75);
  const top = 3.3 + 1.0 * Math.pow(Math.max(0, (u - 0.74) / 0.26), 2) + 1.25 * Math.pow(Math.max(0, (0.2 - u) / 0.2), 1.4);
  let bot;
  if (u < 0.06) bot = -0.9 - (u / 0.06) * 0.6;
  else if (u > 0.8) bot = -1.5 + Math.pow((u - 0.8) / 0.2, 1.6) * 2.9;
  else bot = -1.5;
  return { w: Math.max(0.015, w), top, bot };
}

/** Kesitte s ∈ [-1, 1] noktası (s=0 omurga, ±1 küpeşte) */
function sectionPoint(u, s) {
  const { w, top, bot } = hullProfile(u);
  const a = Math.abs(s);
  const ang = (a * Math.PI) / 2;
  const zf = Math.pow(Math.sin(ang), 0.75) * (1 - 0.06 * Math.pow(a, 8));
  const yf = 1 - Math.cos(ang);
  return { y: bot + (top - bot) * yf, z: Math.sign(s) * (SHIP.W / 2) * w * zf };
}

/** Verilen x ve yükseklikte bordanın z uzaklığı (yaklaşık, plaka/lomboz yerleşimi için) */
export function sideZ(x, y) {
  const u = x / SHIP.L + 0.5;
  const { w, top, bot } = hullProfile(Math.min(1, Math.max(0, u)));
  const yf = Math.min(1, Math.max(0, (y - bot) / (top - bot)));
  const ang = Math.acos(1 - yf);
  return (SHIP.W / 2) * w * Math.pow(Math.sin(ang), 0.75);
}

// ---------------- Dokular ----------------
function plankTexture(teamColor) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  // v = (y + 2) / 6  → y = 6v - 2 ; canvas satırı = (1 - v) * 512
  const row = (y) => (1 - (y + 2) / 6) * 512;
  g.fillStyle = '#6b4425';
  g.fillRect(0, 0, 512, 512);
  // Su altı (katran rengi)
  g.fillStyle = '#3b2a1e';
  g.fillRect(0, row(0.15), 512, 512 - row(0.15));
  // Kalaslar
  const r = mulberry(11);
  for (let y = 0; y < 512; y += 14) {
    const shade = 90 + r() * 28;
    g.fillStyle = `rgba(${shade},${shade * 0.62},${shade * 0.36},0.35)`;
    g.fillRect(0, y, 512, 13);
    g.fillStyle = 'rgba(25,14,6,0.55)';
    g.fillRect(0, y + 13, 512, 1.5);
    let x = r() * 120;
    while (x < 512) {
      g.fillRect(x, y, 1.5, 13);
      x += 90 + r() * 140;
    }
  }
  // Siyah şerit (alt kuşak) + takım rengi kuşak + altın çizgiler
  const band = (y0, y1, color) => { g.fillStyle = color; g.fillRect(0, row(y1), 512, row(y0) - row(y1)); };
  band(0.4, 0.62, '#1d1612');
  band(1.42, 1.62, '#' + new THREE.Color(teamColor).getHexString());
  band(1.62, 1.68, '#d9a63a');
  band(1.36, 1.42, '#d9a63a');
  band(2.3, 2.45, '#1d1612');
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function deckTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#a8804e';
  g.fillRect(0, 0, 256, 256);
  const r = mulberry(5);
  for (let y = 0; y < 256; y += 16) {
    const s = 150 + r() * 30;
    g.fillStyle = `rgb(${s},${s * 0.74},${s * 0.46})`;
    g.fillRect(0, y, 256, 15);
    g.fillStyle = 'rgba(40,25,10,0.6)';
    g.fillRect(0, y + 15, 256, 1);
    let x = r() * 60;
    while (x < 256) { g.fillRect(x, y, 1, 15); x += 70 + r() * 90; }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sailTexture(teamColor, emblem) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#f4ecd6');
  grad.addColorStop(1, '#d9ccab');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(120,100,70,0.35)';
  g.lineWidth = 2;
  for (let x = 0; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  g.strokeStyle = 'rgba(120,100,70,0.5)';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 250, 250);
  if (emblem) {
    const col = '#' + new THREE.Color(teamColor).getHexString();
    g.fillStyle = col;
    g.beginPath(); g.arc(128, 128, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f4ecd6';
    g.fillRect(118, 78, 20, 100);
    g.fillRect(88, 108, 80, 20);
    g.strokeStyle = '#d9a63a';
    g.lineWidth = 7;
    g.beginPath(); g.arc(128, 128, 62, 0, Math.PI * 2); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- Gövde geometrisi ----------------
function hullGeometry() {
  const nx = 44, ns = 26;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nx; i++) {
    const u = i / nx;
    const x = (u - 0.5) * SHIP.L;
    for (let j = 0; j <= ns; j++) {
      const s = (j / ns) * 2 - 1;
      const p = sectionPoint(u, s);
      pos.push(x, p.y, p.z);
      uv.push(x * 0.12, (p.y + 2) / 6);
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ns; j++) {
      const a = i * (ns + 1) + j, b = a + ns + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Kıç aynalığı (düz kıç) */
function transomGeometry() {
  const pts = [];
  for (let j = 0; j <= 26; j++) {
    const p = sectionPoint(0, (j / 26) * 2 - 1);
    pts.push(new THREE.Vector2(p.z, p.y));
  }
  const shape = new THREE.Shape(pts);
  const g = new THREE.ShapeGeometry(shape);
  g.rotateY(-Math.PI / 2);
  g.translate(-SHIP.L / 2, 0, 0);
  return g;
}

/** Güverte (üstten görünüm) */
function deckGeometry(y, u0, u1, inset = 0.93) {
  const pts = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    pts.push(new THREE.Vector2((u - 0.5) * SHIP.L, sideZ((u - 0.5) * SHIP.L, y) * inset));
  }
  for (let i = n; i >= 0; i--) {
    const u = u0 + ((u1 - u0) * i) / n;
    pts.push(new THREE.Vector2((u - 0.5) * SHIP.L, -sideZ((u - 0.5) * SHIP.L, y) * inset));
  }
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  // Doku kalasları gemi boyunca uzansın
  const p = g.attributes.position, uvs = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uvs.setXY(i, p.getX(i) * 0.08, p.getZ(i) * 0.5);
  return g;
}

/** Yelken: yz düzleminde, +X yönüne şişkin */
function sailGeometry(w, h, bulge = 0.8) {
  const g = new THREE.PlaneGeometry(w, h, 10, 6);
  g.rotateY(Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / (w / 2), y = p.getY(i) / (h / 2);
    p.setX(i, bulge * (1 - z * z) * (1 - 0.35 * y * y) - bulge * 0.3);
  }
  g.computeVertexNormals();
  return g;
}

// ============================================================
export function buildShip(team, teamColor) {
  const g = new THREE.Group();
  const M = {
    hull: new THREE.MeshStandardMaterial({ map: plankTexture(teamColor), roughness: 0.85, side: THREE.DoubleSide }),
    darkWood: new THREE.MeshStandardMaterial({ color: 0x3e2716, roughness: 0.85 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b4425, roughness: 0.8 }),
    deck: new THREE.MeshStandardMaterial({ map: deckTexture(), roughness: 0.9 }),
    team: new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.6 }),
    teamDark: new THREE.MeshStandardMaterial({ color: new THREE.Color(teamColor).multiplyScalar(0.55), roughness: 0.7 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd9a63a, metalness: 0.7, roughness: 0.35 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x24262b, metalness: 0.6, roughness: 0.45 }),
    sail: new THREE.MeshStandardMaterial({ map: sailTexture(teamColor, false), roughness: 0.95, side: THREE.DoubleSide }),
    sailEmblem: new THREE.MeshStandardMaterial({ map: sailTexture(teamColor, true), roughness: 0.95, side: THREE.DoubleSide }),
    window: new THREE.MeshBasicMaterial({ color: 0xffc35a, toneMapped: false }),
    rope: new THREE.LineBasicMaterial({ color: 0x2b2014, transparent: true, opacity: 0.85 }),
    flag: new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.6, side: THREE.DoubleSide }),
  };
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const { L, deckY, qdY, fcY } = SHIP;

  // ---- Gövde ----
  add(hullGeometry(), M.hull);
  add(transomGeometry(), M.darkWood);
  add(deckGeometry(deckY, 0.03, 0.9), M.deck);
  // Kıç köşkü (yükseltilmiş arka güverte)
  add(deckGeometry(qdY, 0.005, 0.24, 0.95), M.deck);
  add(new THREE.BoxGeometry(0.25, qdY - deckY, sideZ(-L / 2 + 4.8, qdY) * 1.9), M.darkWood, -L / 2 + 4.8, (qdY + deckY) / 2, 0);
  for (const z of [-0.9, 0.9]) add(new THREE.BoxGeometry(0.1, 1.0, 0.6), M.wood, -L / 2 + 4.95, deckY + 0.5, z); // kapılar
  // Baş kasara
  add(deckGeometry(fcY, 0.76, 0.92, 0.95), M.deck);
  add(new THREE.BoxGeometry(0.22, fcY - deckY, sideZ(L * 0.26, fcY) * 1.9), M.darkWood, L * 0.26, (fcY + deckY) / 2, 0);

  // Kıç pencereleri + balkon + fenerler
  for (const [y, n] of [[2.6, 5], [3.55, 4]]) {
    for (let i = 0; i < n; i++) {
      const z = (i - (n - 1) / 2) * 0.82;
      add(new THREE.BoxGeometry(0.06, 0.48, 0.5), M.window, -L / 2 - 0.05, y, z).castShadow = false;
      add(new THREE.BoxGeometry(0.08, 0.6, 0.08), M.gold, -L / 2 - 0.06, y, z + 0.33);
    }
  }
  add(new THREE.BoxGeometry(0.7, 0.08, 4.2), M.gold, -L / 2 - 0.3, 2.22, 0);
  for (const z of [-2.1, 0, 2.1]) {
    add(new THREE.SphereGeometry(0.14, 10, 8), M.window, -L / 2 + 0.2, 5.05, z * 0.95).castShadow = false;
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5), M.iron, -L / 2 + 0.2, 4.75, z * 0.95);
  }

  // Altın küpeşte çizgisi (gövde üst kenarı boyunca)
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const u = 0.005 + (i / 40) * 0.985;
      const p = sectionPoint(u, side);
      pts.push(new THREE.Vector3((u - 0.5) * L, p.y + 0.03, p.z));
    }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.07, 5), M.gold);
  }

  // ---- Top lombozları (iki sıra, iki borda) ----
  const portXs = [];
  for (let x = -6.2; x <= 6.4; x += 1.8) portXs.push(x);
  const rows = [1.05, 1.95];
  const portGeo = new THREE.BoxGeometry(0.5, 0.46, 0.12);
  const lidGeo = new THREE.BoxGeometry(0.44, 0.36, 0.05);
  const barrelGeo = new THREE.CylinderGeometry(0.1, 0.13, 0.9, 8);
  const nPorts = portXs.length * rows.length * 2;
  const ports = new THREE.InstancedMesh(portGeo, M.darkWood, nPorts);
  const lids = new THREE.InstancedMesh(lidGeo, M.teamDark, nPorts);
  const barrels = new THREE.InstancedMesh(barrelGeo, M.iron, portXs.length * rows.length);
  const dummy = new THREE.Object3D();
  const muzzles = [];
  let pi = 0, bi = 0;
  for (const side of [-1, 1]) {
    for (const y of rows) {
      for (const x of portXs) {
        const z = sideZ(x, y) + 0.02;
        const slope = (sideZ(x + 0.2, y) - sideZ(x - 0.2, y)) / 0.4;
        const ry = side < 0 ? Math.atan(slope) : -Math.atan(slope);
        dummy.position.set(x, y, side * z);
        dummy.rotation.set(0, ry, 0);
        dummy.updateMatrix();
        ports.setMatrixAt(pi, dummy.matrix);
        // Açık kapak: lombozun üstünde, dışa doğru kalkık
        dummy.position.set(x, y + 0.3, side * (z + 0.14));
        dummy.rotation.set(side * -0.8, ry, 0);
        dummy.updateMatrix();
        lids.setMatrixAt(pi, dummy.matrix);
        pi++;
        if (side < 0) {
          dummy.position.set(x, y, side * (z + 0.35));
          dummy.rotation.set(Math.PI / 2, 0, 0);
          dummy.updateMatrix();
          barrels.setMatrixAt(bi++, dummy.matrix);
          muzzles.push(new THREE.Vector3(x, y, side * (z + 0.8)));
        }
      }
    }
  }
  for (const im of [ports, lids, barrels]) { im.castShadow = true; g.add(im); }

  // ---- Cıvadra, pruva figürü ----
  const bowX = L / 2 - 0.2;
  const bsLen = 7.5, bsAng = 0.32;
  const bs = add(new THREE.CylinderGeometry(0.1, 0.2, bsLen, 8), M.wood, bowX + Math.cos(bsAng) * bsLen / 2, 4.25 + Math.sin(bsAng) * bsLen / 2, 0);
  bs.rotation.z = -(Math.PI / 2 - bsAng);
  const bsTip = new THREE.Vector3(bowX + Math.cos(bsAng) * bsLen, 4.25 + Math.sin(bsAng) * bsLen, 0);
  const head = add(new THREE.ConeGeometry(0.28, 1.2, 8), M.gold, bowX + 0.25, 3.2, 0);
  head.rotation.z = -Math.PI / 2 - 0.4;

  // ---- Direkler, serenler, yelkenler ----
  const masts = [
    { x: 5.6, base: fcY, h: 14, sails: [[7.0, 3.6, 6.4], [5.8, 3.2, 10.1]], top: 8.4 },
    { x: 0.4, base: deckY, h: 17, sails: [[8.2, 4.0, 6.9], [6.8, 3.6, 11.0], [5.0, 2.4, 14.3]], top: 9.1, emblem: 0 },
    { x: -6.6, base: qdY, h: 11, sails: [], top: 9.6 },
  ];
  const sails = [];
  const tops = [];
  for (const m of masts) {
    const topY = m.base + m.h;
    add(new THREE.CylinderGeometry(0.15, 0.26, m.h * 0.65, 10), M.darkWood, m.x, m.base + m.h * 0.325, 0);
    add(new THREE.CylinderGeometry(0.08, 0.14, m.h * 0.4, 8), M.darkWood, m.x, m.base + m.h * 0.8, 0);
    // Gözcü yuvası
    add(new THREE.CylinderGeometry(0.75, 0.6, 0.28, 12), M.wood, m.x, m.top, 0);
    add(new THREE.TorusGeometry(0.75, 0.04, 4, 16), M.darkWood, m.x, m.top + 0.4, 0).rotation.x = Math.PI / 2;
    tops.push(new THREE.Vector3(m.x, topY, 0));
    m.sails.forEach(([w, h, y], i) => {
      const yard = add(new THREE.CylinderGeometry(0.07, 0.09, w + 0.8, 6), M.darkWood, m.x + 0.15, y + h / 2 + 0.05, 0);
      yard.rotation.x = Math.PI / 2;
      const s = add(sailGeometry(w, h), m.emblem === i ? M.sailEmblem : M.sail, m.x + 0.25, y, 0);
      s.userData.base = s.geometry.attributes.position.array.slice();
      sails.push(s);
    });
    // Flama
    const pen = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.4, 8, 1), M.flag);
    pen.geometry.translate(1.2, 0, 0);
    pen.geometry.attributes.position.array.forEach((v, i, arr) => { if (i % 3 === 1) arr[i] = v * (1 - (arr[i - 1] / 2.4) * 0.85); });
    pen.position.set(m.x, topY + 0.2, 0);
    pen.rotation.y = Math.PI; // rüzgârla geriye doğru
    pen.userData.base = pen.geometry.attributes.position.array.slice();
    g.add(pen);
    sails.push(pen);
  }
  // Mizana yelkeni (üçgen latin yelken)
  {
    const m = masts[2];
    const shape = new THREE.Shape([new THREE.Vector2(-3.6, 0), new THREE.Vector2(2.4, 0), new THREE.Vector2(1.2, 6.2)]);
    const geo = new THREE.ShapeGeometry(shape, 1);
    const s = add(geo, M.sail, m.x - 0.3, qdY + 1.6, 0.18);
    const spar = add(new THREE.CylinderGeometry(0.06, 0.06, 7.4, 6), M.darkWood, m.x - 0.6, qdY + 4.6, 0.2);
    spar.rotation.z = -0.95;
    void s;
  }
  // Flok yelkeni (cıvadradan pruva direğine üçgen)
  {
    const fm = masts[0];
    const a = new THREE.Vector2(bsTip.x, bsTip.y - 0.2);
    const b = new THREE.Vector2(fm.x + 0.3, fm.base + fm.h * 0.72);
    const c = new THREE.Vector2(fm.x + 3.2, fcY + 0.9);
    const geo = new THREE.ShapeGeometry(new THREE.Shape([a, b, c]));
    add(geo, M.sail, 0, 0, 0.05);
  }
  // Sancak (kıç gönderi)
  add(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), M.darkWood, -L / 2 - 0.4, qdY + 1.4, 0).rotation.z = 0.35;
  const ensign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.3, 8, 2), M.flag);
  ensign.geometry.translate(-1.0, 0, 0);
  ensign.position.set(-L / 2 - 0.95, qdY + 2.6, 0);
  ensign.userData.base = ensign.geometry.attributes.position.array.slice();
  g.add(ensign);
  sails.push(ensign);

  // ---- Halatlar (çarmıhlar ve istralyalar) ----
  const lines = [];
  const pushLine = (a, b) => lines.push(a.x, a.y, a.z, b.x, b.y, b.z);
  masts.forEach((m, mi) => {
    const top = new THREE.Vector3(m.x, m.top + 0.1, 0);
    for (const side of [-1, 1]) {
      for (let k = -1; k <= 1; k++) {
        const x = m.x - 0.7 + k * 0.45;
        const u = x / L + 0.5;
        const p = sectionPoint(Math.min(1, Math.max(0, u)), side);
        pushLine(new THREE.Vector3(x, p.y, p.z), top);
      }
      const p2 = sectionPoint(Math.min(1, Math.max(0, (m.x - 1.5) / L + 0.5)), side);
      pushLine(new THREE.Vector3(m.x - 1.5, p2.y, p2.z), tops[mi]);
    }
  });
  pushLine(bsTip, tops[0]);
  pushLine(new THREE.Vector3(bowX, 4.3, 0), new THREE.Vector3(masts[0].x, masts[0].top, 0));
  pushLine(tops[0], new THREE.Vector3(masts[1].x, masts[1].top, 0));
  pushLine(tops[1], new THREE.Vector3(masts[2].x, masts[2].top, 0));
  pushLine(tops[2], new THREE.Vector3(-L / 2 + 0.2, 5, 0));
  const rgeo = new THREE.BufferGeometry();
  rgeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  g.add(new THREE.LineSegments(rgeo, M.rope));

  return { group: g, sails, muzzles, materials: M };
}

/** Güverte topu (topçu mürettebat için): kundak + namlu, -Z'ye bakar */
export function buildDeckCannon(materials) {
  const g = new THREE.Group();
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.9), materials.wood);
  carriage.position.y = 0.3;
  g.add(carriage);
  for (const x of [-0.38, 0.38]) for (const z of [-0.3, 0.3]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10), materials.darkWood);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(x, 0.16, z);
    g.add(wh);
  }
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.5, 10), materials.iron);
  barrel.rotation.x = Math.PI / 2 - 0.12;
  barrel.position.set(0, 0.6, -0.45);
  g.add(barrel);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.muzzle = new THREE.Vector3(0, 0.7, -1.25);
  return g;
}
