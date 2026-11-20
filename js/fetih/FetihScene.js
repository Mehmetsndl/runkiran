// ============================================================
//  PARSEL FETHİ 3D SAHNESİ
//  Kare masanın üstü 10×10 parsellik bir harita: çayır, orman, cevher,
//  harabe, dağ, göl, kaleler ve ortada hazine. Parsel sahibinin renkli
//  çerçevesi ve sancağı, kamp çadırları, madenler, sur duvarları,
//  birlik figürleri. Yürüyen ordular, ok/büyü atışları, ele geçirme.
// ============================================================
import * as THREE from 'three';
import { FETIH, TERRAIN, UNITS, SEAT_COLORS, buildMap } from '../data/fetih.js';
import { buildHall, buildMiniCastle, TABLE_Y } from './Hall.js';
import { buildPlayerModel } from '../entities/PlayerModels.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';

const CELL = 1.3;
const TILE = 1.22;
const TOP = TABLE_Y + 0.16;
const SEAT_ROT = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const NEUTRAL = 0x8a8a8a;

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o });
const M = {
  trunk: mat(0x5a3b22), leaf: mat(0x2f6a2a), leaf2: mat(0x3f8a34), rock: mat(0x8a8780), snow: mat(0xf2f2f2),
  crystal: new THREE.MeshBasicMaterial({ color: 0x7fe3ff, toneMapped: false }), goldOre: new THREE.MeshBasicMaterial({ color: 0xffd84a, toneMapped: false }),
  gold: mat(0xd9a63a, { metalness: 0.6, roughness: 0.35 }), stone: mat(0xb8b0a0), ruin: mat(0xa8a090), wood: mat(0x6a4a2a),
  tent: mat(0xe8dcc0), water: new THREE.MeshStandardMaterial({ color: 0x2f6f9a, roughness: 0.15, metalness: 0.3 }),
  skin: mat(0xe0b48a), iron: mat(0x8a9099, { metalness: 0.5 }), cart: mat(0x4a3222), dark: mat(0x1a1410),
};

export const cellPos = (id) => {
  const N = FETIH.size;
  return { x: ((id % N) - (N - 1) / 2) * CELL, z: (Math.floor(id / N) - (N - 1) / 2) * CELL };
};

/** Birlik figürü (türüne göre) */
function buildUnit(id, color) {
  const g = new THREE.Group();
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  const team = mat(color);
  if (id === 'atli') {
    add(new THREE.BoxGeometry(0.14, 0.13, 0.32), M.wood, 0, 0.17, 0);
    add(new THREE.BoxGeometry(0.08, 0.14, 0.1), M.wood, 0, 0.27, 0.15);
    for (const [x, z] of [[0.05, 0.11], [-0.05, 0.11], [0.05, -0.11], [-0.05, -0.11]]) add(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 4), M.wood, x, 0.06, z);
    add(new THREE.ConeGeometry(0.07, 0.2, 6), team, 0, 0.33, -0.02);
    add(new THREE.SphereGeometry(0.045, 6, 5), M.skin, 0, 0.46, -0.02);
  } else if (id === 'mancinik') {
    add(new THREE.BoxGeometry(0.26, 0.06, 0.3), M.wood, 0, 0.06, 0);
    const arm = add(new THREE.BoxGeometry(0.04, 0.04, 0.4), M.wood, 0, 0.2, 0);
    arm.rotation.x = -0.6;
    add(new THREE.BoxGeometry(0.1, 0.1, 0.1), team, 0, 0.12, -0.12);
  } else if (id === 'dev') {
    add(new THREE.SphereGeometry(0.15, 8, 6), mat(0x8a6a4a), 0, 0.22, 0).scale.y = 1.3;
    add(new THREE.SphereGeometry(0.08, 6, 5), mat(0x8a6a4a), 0, 0.45, 0);
    add(new THREE.BoxGeometry(0.2, 0.08, 0.12), team, 0, 0.18, 0.05);
  } else {
    const col = id === 'okcu' ? mat(0x3d7a34) : id === 'buyucu' ? mat(0x6a3aa8) : team;
    add(new THREE.ConeGeometry(0.09, 0.28, 6), col, 0, 0.14, 0);
    add(new THREE.SphereGeometry(0.055, 6, 5), M.skin, 0, 0.32, 0);
    if (id === 'buyucu') add(new THREE.ConeGeometry(0.07, 0.16, 6), mat(0x6a3aa8), 0, 0.42, 0);
    else if (id === 'okcu') add(new THREE.TorusGeometry(0.1, 0.012, 4, 8, Math.PI), M.wood, 0.08, 0.22, 0).rotation.y = Math.PI / 2;
    else add(new THREE.ConeGeometry(0.06, 0.07, 6), M.iron, 0, 0.38, 0);
    if (id !== 'okcu' && id !== 'buyucu') add(new THREE.BoxGeometry(0.03, 0.1, 0.09), team, -0.08, 0.16, 0.02); // kalkan
    // takım rengi kuşak
    add(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 6), team, 0, 0.1, 0);
  }
  return g;
}

function decorate(terrain, g, r) {
  const add = (geo, m, x, y, z, s = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.setScalar(s); o.castShadow = true; g.add(o); return o; };
  if (terrain === 'orman') {
    for (let k = 0; k < 5; k++) {
      const x = (r() - 0.5) * 0.9, z = (r() - 0.5) * 0.9, s = 0.7 + r() * 0.5;
      add(new THREE.CylinderGeometry(0.03, 0.04, 0.14, 5), M.trunk, x, 0.07 * s, z, s);
      add(new THREE.ConeGeometry(0.17, 0.42, 6), r() < 0.5 ? M.leaf : M.leaf2, x, 0.32 * s, z, s);
    }
  } else if (terrain === 'cevher') {
    for (let k = 0; k < 3; k++) add(new THREE.DodecahedronGeometry(0.16, 0), M.rock, (r() - 0.5) * 0.8, 0.1, (r() - 0.5) * 0.8, 0.8 + r() * 0.5);
    for (let k = 0; k < 4; k++) add(new THREE.OctahedronGeometry(0.07), r() < 0.5 ? M.crystal : M.goldOre, (r() - 0.5) * 0.8, 0.08, (r() - 0.5) * 0.8);
  } else if (terrain === 'harabe') {
    for (const [x, z, h] of [[-0.3, -0.25, 0.35], [0.28, -0.3, 0.2], [-0.25, 0.3, 0.15]]) add(new THREE.CylinderGeometry(0.07, 0.08, h, 8), M.ruin, x, h / 2, z);
    add(new THREE.BoxGeometry(0.4, 0.05, 0.12), M.ruin, 0.15, 0.03, 0.2).rotation.y = 0.6;
  } else if (terrain === 'dag') {
    add(new THREE.ConeGeometry(0.5, 1.0, 5), M.rock, 0, 0.5, 0);
    add(new THREE.ConeGeometry(0.2, 0.3, 5), M.snow, 0, 0.88, 0);
    add(new THREE.ConeGeometry(0.3, 0.55, 5), M.rock, 0.33, 0.27, 0.3);
  } else if (terrain === 'gol') {
    const w = add(new THREE.BoxGeometry(TILE - 0.08, 0.04, TILE - 0.08), M.water, 0, 0.01, 0);
    w.castShadow = false;
  } else if (terrain === 'hazine') {
    add(new THREE.CylinderGeometry(0.4, 0.45, 0.22, 8), M.stone, 0, 0.11, 0);
    add(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.gold, 0, 0.22, 0);
  }
}

export class FetihScene {
  constructor(renderer, players, chars, mySeat, seed) {
    this.renderer = renderer;
    this.map = buildMap(seed);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x150e0a);
    this.scene.fog = new THREE.Fog(0x150e0a, 34, 66);
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.3, 140);
    this.camBase = new THREE.Vector3(0, 19.5, 12.5);
    this.camLook = new THREE.Vector3(0, 0, 1.1);
    this.t = 0;
    this.shake = 0;
    this.fx = [];
    this.candles = buildHall(this.scene);
    this.world = new THREE.Group();
    this.world.rotation.y = SEAT_ROT[mySeat];   // kendi kalen hep sol altta
    this.scene.add(this.world);
    this.particles = new ParticleSystem({ scene: this.scene }, 1800);
    this.raycaster = new THREE.Raycaster();
    this.pickables = [];
    let s = seed;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    this.tiles = this.map.map((m) => this._buildTile(m, r));
    this.heroes = players.map((p, i) => this._buildHero(i, chars[i]));
    this.marks = {};
    this.hover = -1;
    this._onResize = () => { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); };
    window.addEventListener('resize', this._onResize);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.camLook);
  }

  _buildTile(m, r) {
    const T = TERRAIN[m.terrain];
    const p = cellPos(m.id);
    const g = new THREE.Group();
    g.position.set(p.x, TABLE_Y, p.z);
    const checker = (m.x + m.y) % 2 === 0;
    const base = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.16, TILE), mat(checker ? T.color : T.color2, { emissive: 0xffffff, emissiveIntensity: 0 }));
    base.position.y = 0.08;
    base.receiveShadow = true;
    base.userData.cell = m.id;
    g.add(base);
    this.pickables.push(base);
    // Sahip çerçevesi
    const frameMat = new THREE.MeshBasicMaterial({ color: NEUTRAL, toneMapped: false });
    const frame = new THREE.Group();
    for (const [x, z, w, d] of [[0, TILE / 2 - 0.04, TILE, 0.08], [0, -TILE / 2 + 0.04, TILE, 0.08], [TILE / 2 - 0.04, 0, 0.08, TILE], [-TILE / 2 + 0.04, 0, 0.08, TILE]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), frameMat);
      b.position.set(x, 0.175, z);
      frame.add(b);
    }
    frame.visible = false;
    g.add(frame);
    // İşaret (seçim / hedef) — parselin üstünde yarı saydam renk
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(TILE, TILE), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    mark.rotation.x = -Math.PI / 2;
    mark.position.y = 0.2;
    g.add(mark);
    const deco = new THREE.Group();
    deco.position.y = 0.16;
    g.add(deco);
    let castle = null;
    if (m.terrain === 'kale') {
      castle = buildMiniCastle(NEUTRAL);
      castle.root.scale.setScalar(0.3);
      deco.add(castle.root);
    } else decorate(m.terrain, deco, r);
    // Binalar (sync'te güncellenir)
    const build = new THREE.Group();
    build.position.y = 0.16;
    g.add(build);
    // Sancak
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 4), M.wood);
    pole.position.set(-0.5, 0.44, -0.5);
    const flagGeo = new THREE.PlaneGeometry(0.28, 0.18, 4, 1);
    flagGeo.translate(0.14, 0, 0);
    const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: NEUTRAL, side: THREE.DoubleSide }));
    flag.position.set(-0.5, 0.62, -0.5);
    flag.userData.base = flagGeo.attributes.position.array.slice();
    pole.visible = flag.visible = false;
    g.add(pole, flag);
    const army = new THREE.Group();
    army.position.y = 0.16;
    g.add(army);
    this.world.add(g);
    return { id: m.id, g, base, frame, frameMat, mark, deco, castle, build, flag, pole, army, key: '' };
  }

  _buildHero(seat, character) {
    const model = buildPlayerModel(character);
    const s = character.model === 'cyclops' ? 1.0 : 1.2;
    model.root.scale.setScalar(s);
    // Masanın kendi köşesinde (kalesinin dışında)
    const corner = [[-1, 1], [-1, -1], [1, -1], [1, 1]][seat];
    model.root.position.set(corner[0] * 9.4, 0, corner[1] * 9.4);
    model.root.rotation.y = Math.atan2(-corner[0], -corner[1]);
    this.world.add(model.root);
    return { model, scale: s, cast: 0, cheer: 0, dead: 0 };
  }

  // ---------------- yardımcılar ----------------
  cellWorld(id, y = 0.3) {
    const p = cellPos(id);
    return this.world.localToWorld(new THREE.Vector3(p.x, TOP + y, p.z));
  }

  project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight };
  }

  pick(cx, cy) {
    const ndc = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    return hit ? hit.object.userData.cell : -1;
  }

  setMarks(marks, hover = -1) { this.marks = marks; this.hover = hover; }

  // ---------------- durum yansıtma ----------------
  /** cells: çözülmüş parsel durumları */
  sync(cells, players) {
    cells.forEach((c, i) => {
      const t = this.tiles[i];
      const key = `${c.owner}|${c.camp}|${c.mine}|${c.wall}|${c.units.join(',')}|${c.loot > 0 ? 1 : 0}`;
      if (key === t.key) return;
      t.key = key;
      const color = c.owner >= 0 ? SEAT_COLORS[c.owner] : NEUTRAL;
      t.frame.visible = c.owner >= 0;
      t.frameMat.color.setHex(color);
      t.flag.visible = t.pole.visible = c.owner >= 0 && this.map[i].terrain !== 'kale';
      t.flag.material.color.setHex(color);
      if (t.castle) t.castle.root.traverse((o) => { if (o.isMesh && o.geometry.type === 'ConeGeometry') o.material.color.setHex(c.owner >= 0 ? color : 0x555555); });
      // Binalar
      t.build.clear();
      const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; t.build.add(o); return o; };
      for (let k = 0; k < c.camp && this.map[i].terrain !== 'kale'; k++) {
        add(new THREE.ConeGeometry(0.14, 0.24, 4), M.tent, 0.3 - k * 0.2, 0.12, 0.35).rotation.y = Math.PI / 4;
      }
      if (c.camp && this.map[i].terrain !== 'kale') add(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 6), mat(0xff6a00, { emissive: 0xff6a00, emissiveIntensity: 0.6 }), 0.35, 0.03, 0.05);
      if (c.mine) {
        add(new THREE.BoxGeometry(0.26, 0.2, 0.08), M.dark, 0.25, 0.1, -0.3);
        add(new THREE.BoxGeometry(0.32, 0.05, 0.12), M.wood, 0.25, 0.22, -0.3);
        for (let k = 0; k < c.mine; k++) add(new THREE.BoxGeometry(0.14, 0.08, 0.1), M.cart, 0.45 - k * 0.17, 0.05, -0.1);
        for (let k = 0; k < c.mine; k++) add(new THREE.OctahedronGeometry(0.05), M.goldOre, 0.45 - k * 0.17, 0.12, -0.1);
      }
      if (c.wall) {
        const h = 0.1 + c.wall * 0.09;
        const wm = c.wall >= 3 ? M.stone : c.wall === 2 ? mat(0x9a948a) : M.wood;
        for (const [x, z, w, d] of [[0, TILE / 2 - 0.1, TILE - 0.12, 0.07], [0, -TILE / 2 + 0.1, TILE - 0.12, 0.07], [TILE / 2 - 0.1, 0, 0.07, TILE - 0.12], [-TILE / 2 + 0.1, 0, 0.07, TILE - 0.12]]) add(new THREE.BoxGeometry(w, h, d), wm, x, h / 2, z);
        if (c.wall >= 2) for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) add(new THREE.CylinderGeometry(0.07, 0.08, h + 0.12, 6), wm, x * (TILE / 2 - 0.1), (h + 0.12) / 2, z * (TILE / 2 - 0.1));
      }
      if (c.loot > 0 && c.owner < 0) {
        add(new THREE.BoxGeometry(0.2, 0.12, 0.14), M.wood, -0.3, 0.06, 0.32);
        add(new THREE.OctahedronGeometry(0.06), M.goldOre, -0.3, 0.17, 0.32);
      }
      // Birlikler: türlere göre en fazla 6 figür
      t.army.clear();
      const types = UNITS.map((u, k) => ({ u, n: c.units[k] })).filter((x) => x.n > 0);
      const figs = [];
      for (const x of types) for (let k = 0; k < Math.min(x.n, types.length > 2 ? 1 : 3); k++) figs.push(x.u.id);
      figs.slice(0, 6).forEach((id, k) => {
        const f = buildUnit(id, color);
        const col = k % 3, row = Math.floor(k / 3);
        f.position.set(-0.28 + col * 0.28, 0, 0.05 + row * 0.28);
        f.rotation.y = Math.PI + (Math.random() - 0.5) * 0.6;
        f.userData.ph = Math.random() * 6;
        t.army.add(f);
      });
    });
    (players ?? []).forEach((p, i) => { if (!p.alive && !this.heroes[i].dead) this.heroes[i].dead = 0.0001; });
  }

  // ---------------- efektler ----------------
  march(from, to, units, owner, speed = 1) {
    const a = this.cellWorld(from, 0), b = this.cellWorld(to, 0);
    const group = new THREE.Group();
    const color = owner >= 0 ? SEAT_COLORS[owner] : NEUTRAL;
    let k = 0;
    UNITS.forEach((u, i) => { for (let j = 0; j < Math.min(units[i], 2) && k < 6; j++, k++) { const f = buildUnit(u.id, color); f.position.set((k % 3 - 1) * 0.25, 0, Math.floor(k / 3) * 0.25); group.add(f); } });
    group.position.copy(a);
    group.lookAt(b.x, a.y, b.z);
    this.scene.add(group);
    const dur = 0.9 / speed;
    let t = 0;
    this.fx.push({
      update: (dt) => {
        t += dt;
        const f = Math.min(1, t / dur);
        group.position.lerpVectors(a, b, f);
        group.position.y = a.y + Math.abs(Math.sin(f * Math.PI * 6)) * 0.06;
        if (Math.random() < dt * 20) this.particles.emit(group.position.x, a.y + 0.05, group.position.z, 0x8a7a65, (Math.random() - 0.5), 0.5, (Math.random() - 0.5), 0.1, 0.5, 1);
        if (f >= 1) { this.scene.remove(group); return true; }
        return false;
      },
    });
    if (owner >= 0) this.heroes[owner].cast = 1;
  }

  /** Bilinen kelime: saldırandan hedefe atış (birlik türüne göre) */
  shot(from, to, unitId) {
    const a = this.cellWorld(from, 0.5), b = this.cellWorld(to, 0.3);
    const color = unitId === 'buyucu' ? 0xb65cff : unitId === 'mancinik' || unitId === 'dev' ? 0x8a8070 : unitId === 'atli' ? 0xffd84a : 0xd8c29a;
    const mesh = unitId === 'mancinik' || unitId === 'dev'
      ? new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), mat(0x8a8070))
      : unitId === 'buyucu' ? new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color, toneMapped: false }))
        : new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 4), M.wood);
    mesh.position.copy(a);
    this.scene.add(mesh);
    const arc = unitId === 'mancinik' ? 2.5 : 1.2;
    let t = 0;
    this.fx.push({
      update: (dt) => {
        t += dt;
        const f = Math.min(1, t / 0.4);
        const p = new THREE.Vector3().lerpVectors(a, b, f);
        p.y += Math.sin(f * Math.PI) * arc;
        if (unitId === 'piyade' || unitId === 'okcu' || unitId === 'atli') { mesh.lookAt(p); mesh.rotateX(Math.PI / 2); }
        mesh.position.copy(p);
        if (unitId === 'buyucu') this.particles.emit(p.x, p.y, p.z, color, 0, 0.3, 0, 0.12, 0.3, 0);
        if (f >= 1) {
          this.scene.remove(mesh);
          this.particles.burst(b, [color, 0xffffff], 12, { speed: 5, size: 0.12, life: 0.4 });
          this.particles.ring(this.cellWorld(to, -0.1), color, 0.9, 0.3);
          this.shake = Math.min(1, this.shake + 0.15);
          return true;
        }
        return false;
      },
    });
  }

  /** Bilinemeyen kelime: bizim birliğimiz düşer */
  miss(from) {
    this.particles.burst(this.cellWorld(from, 0.3), [0xff3b3b, 0x6a2a1a], 10, { speed: 4, size: 0.12, life: 0.5 });
  }

  capture(id, owner) {
    const color = owner >= 0 ? SEAT_COLORS[owner] : NEUTRAL;
    this.particles.burst(this.cellWorld(id, 0.5), [color, 0xffffff, 0xffd84a], 34, { speed: 7, size: 0.16, life: 0.8, up: 0.6 });
    this.particles.ring(this.cellWorld(id, -0.1), color, 1.3, 0.5);
    this.shake = Math.min(1, this.shake + 0.35);
    if (owner >= 0) this.heroes[owner].cheer = 1;
  }

  coins(id) {
    const p = this.cellWorld(id, 0.3);
    for (let k = 0; k < 18; k++) this.particles.emit(p.x, p.y, p.z, 0xffd84a, (Math.random() - 0.5) * 3, 3 + Math.random() * 2, (Math.random() - 0.5) * 3, 0.1, 0.8, 8);
  }

  dust(id, color = 0xb3a994) {
    this.particles.burst(this.cellWorld(id, 0.2), [color, 0x8a7a65, 0xffffff], 16, { speed: 4, size: 0.14, life: 0.6, up: 0.7 });
    this.particles.ring(this.cellWorld(id, -0.1), color, 0.9, 0.4);
  }

  // ---------------- kare ----------------
  update(dt) {
    this.t += dt;
    for (let i = this.fx.length - 1; i >= 0; i--) if (this.fx[i].update(dt)) this.fx.splice(i, 1);
    this.particles.update(dt);
    for (const c of this.candles) {
      const f = 0.85 + Math.sin(this.t * 11 + c.ph) * 0.1 + Math.random() * 0.08;
      c.fl.scale.set(f, f * 1.6, f);
      c.light.intensity = (c.big ? 20 : 14) * f;
    }
    const pulse = 0.28 + Math.sin(this.t * 6) * 0.15;
    for (const t of this.tiles) {
      const mk = this.marks[t.id];
      const col = { sel: 0xffd84a, atk: 0xff3a2a, move: 0x6dff8a, claim: 0x7fe3ff, battle: 0xff2a2a, no: 0x555555 }[mk] ?? 0xffffff;
      t.mark.material.color.setHex(col);
      t.mark.material.opacity = mk ? (mk === 'sel' ? 0.35 : mk === 'no' ? 0.25 : pulse) : this.hover === t.id ? 0.14 : 0;
      if (t.flag.visible) {
        const fp = t.flag.geometry.attributes.position, base = t.flag.userData.base;
        for (let k = 0; k < fp.count; k++) fp.array[k * 3 + 2] = Math.sin(this.t * 6 - base[k * 3] * 14 + t.id) * 0.03 * (base[k * 3] / 0.28);
        fp.needsUpdate = true;
      }
      for (const f of t.army.children) f.position.y = Math.abs(Math.sin(this.t * 2 + f.userData.ph)) * 0.02;
      if (mk === 'battle' && Math.random() < dt * 6) {
        const p = this.cellWorld(t.id, 0.3);
        this.particles.emit(p.x, p.y, p.z, Math.random() < 0.5 ? 0xffd84a : 0xffffff, (Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2, 0.08, 0.3, 5);
      }
    }
    for (const h of this.heroes) {
      const pr = h.model.parts;
      h.cast = Math.max(0, h.cast - dt * 1.4);
      h.cheer = Math.max(0, h.cheer - dt * 0.7);
      const lift = Math.sin(Math.min(1, h.cast) * Math.PI);
      const cheer = h.cheer > 0 ? Math.abs(Math.sin(this.t * 10)) * Math.min(1, h.cheer * 2) : 0;
      if (pr.armR) pr.armR.rotation.x = -2.6 * Math.max(lift, cheer);
      if (pr.armL) pr.armL.rotation.x = -2.6 * cheer - lift;
      h.model.root.position.y = Math.sin(this.t * 1.8) * 0.03 + cheer * 0.2;
      if (h.dead > 0) { h.dead = Math.min(1, h.dead + dt * 0.8); h.model.root.rotation.x = -h.dead * 0.6; h.model.root.position.y = -h.dead * 0.5; }
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * this.shake * 0.35;
    this.camera.position.copy(this.camBase);
    this.camera.position.x += (Math.random() - 0.5) * sh;
    this.camera.position.y += (Math.random() - 0.5) * sh;
    this.camera.lookAt(this.camLook);
  }

  render() { this.renderer.render(this.scene, this.camera); }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
  }
}
