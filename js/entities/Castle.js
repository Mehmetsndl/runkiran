// ============================================================
//  KALE (Kale Savunması modu)
//  Sekizgen surlar + 8 kule, ana kapı (kapı kuleleri, demir parmaklık,
//  asma köprü), ortada burç (oyuncu tepesinde durur) ve bahçeli avlu:
//  çim, taş yollar, çiçek tarhları, çitler, ağaçlar, kuyu, banklar, meşaleler.
//  Yaratıklar surlara dayanır; kalenin canı = surların canı.
// ============================================================
import * as THREE from 'three';

const R_CORNER = 12;                              // sur köşelerinin merkeze uzaklığı
const APOTHEM = R_CORNER * Math.cos(Math.PI / 8); // sur yüzünün merkeze uzaklığı (~11.1)
// Sur seviyeleri: yükseklik, taş rengi, çatı rengi (Kale Savunması → Sur Yükseltmesi)
export const WALL_LEVELS = [
  { name: 'Taş Sur',     h: 3.8, stone: 0x9a948a, dark: 0x6f6a62, roof: 0x8e2a22 },
  { name: 'Sağlam Sur',  h: 4.4, stone: 0xaaa497, dark: 0x5e5a54, roof: 0x9b3324 },
  { name: 'Demir Sur',   h: 5.0, stone: 0x8d939b, dark: 0x4c5058, roof: 0x3a4250 },
  { name: 'Altın Kale',  h: 5.6, stone: 0xdcd5c6, dark: 0xa89f8c, roof: 0x2a4fae },
];
const WALL_T = 1.4;
const KEEP_H = 5.0;
export const GATE_ANGLE = (3 * Math.PI) / 4;      // kapı ekranın sağına, yaratıkların geldiği yola bakar

export class Castle {
  constructor(game, { maxHp }) {
    this.game = game;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.radius = APOTHEM + WALL_T / 2 + 0.2;     // yaratıkların durduğu sınır
    this.position = new THREE.Vector3(0, 0, 0);
    this.playerSpot = new THREE.Vector3(0, KEEP_H + 0.25, 0);
    this.flash = 0;
    this.t = 0;
    this.smokeT = 0;
    this.torches = [];
    this.flags = [];
    this.wallLevel = 0;
    this.openTowers = new Set(); // çatısı kaldırılıp okçu platformu yapılan kuleler

    const M = this.M = {
      stone: new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.92, flatShading: true, emissive: 0xff2200, emissiveIntensity: 0 }),
      wall: new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.92, flatShading: true, emissive: 0xff2200, emissiveIntensity: 0 }),
      wallDark: new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 0.95, flatShading: true, emissive: 0xff2200, emissiveIntensity: 0 }),
      wallRoof: new THREE.MeshStandardMaterial({ color: 0x8e2a22, roughness: 0.7, flatShading: true }),
      banner: new THREE.MeshStandardMaterial({ color: 0xb3242a, roughness: 0.8, side: THREE.DoubleSide }),
      stoneDark: new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 0.95, flatShading: true, emissive: 0xff2200, emissiveIntensity: 0 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x8e2a22, roughness: 0.7, flatShading: true }),
      wood: new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.85 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x2a2b30, metalness: 0.6, roughness: 0.45 }),
      grass: new THREE.MeshStandardMaterial({ color: 0x4f8a3c, roughness: 1 }),
      path: new THREE.MeshStandardMaterial({ color: 0xb3a994, roughness: 0.95 }),
      soil: new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 1 }),
      hedge: new THREE.MeshStandardMaterial({ color: 0x2f5e2a, roughness: 1, flatShading: true }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x3d7a34, roughness: 1, flatShading: true }),
      water: new THREE.MeshStandardMaterial({ color: 0x2c6e9a, roughness: 0.2, metalness: 0.2 }),
      glow: new THREE.MeshBasicMaterial({ color: 0xffc35a, toneMapped: false }),
      flame: new THREE.MeshBasicMaterial({ color: 0xff8a1a, toneMapped: false }),
      flag: new THREE.MeshStandardMaterial({ color: 0x2f6fff, roughness: 0.6, side: THREE.DoubleSide }),
      gold: new THREE.MeshStandardMaterial({ color: 0xd9a63a, metalness: 0.6, roughness: 0.35 }),
    };
    this.flashMats = [M.stone, M.stoneDark, M.wall, M.wallDark];

    const g = this.group = new THREE.Group();
    this.fort = new THREE.Group(); // surlar + kuleler + kapı (yükseltmede yeniden kurulur)
    g.add(this.fort);
    this._buildFort();
    this._keep();
    this._courtyard();
    game.scene.add(g);
  }

  get wallH() { return WALL_LEVELS[this.wallLevel].h; }
  get wallTopY() { return this.wallH + 0.13; }
  get towerTopY() { return this.wallH + 2.73; }

  /** Kule tepeleri (okçular buraya yerleşir) */
  towerSpots() {
    const out = [];
    for (let i = 0; i < 8; i++) {
      const theta = (i * Math.PI) / 4 + Math.PI / 8;
      out.push({ theta, pos: Castle.dir(theta).multiplyScalar(R_CORNER).setY(this.towerTopY) });
    }
    return out;
  }

  /** Bir sur yüzünün yürüyüş yolu ortası */
  wallWalkSpot(theta, along = 0) {
    const t = Castle.dir(theta + Math.PI / 2);
    return Castle.dir(theta).multiplyScalar(APOTHEM - 0.1).addScaledVector(t, along).setY(this.wallTopY);
  }

  /** Kuleyi okçu platformuna çevir (çatısını kaldır) */
  openTower(i) {
    if (this.openTowers.has(i)) return;
    this.openTowers.add(i);
    this.setWallLevel(this.wallLevel);
  }

  /** Sur Yükseltmesi: surları yeni seviyede yeniden kur (görünüm değişir) */
  setWallLevel(lv) {
    this.wallLevel = Math.max(0, Math.min(WALL_LEVELS.length - 1, lv));
    this.fort.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.fort.clear();
    this.torches = this.torches.filter((t) => !t.fort);
    this._buildFort();
  }

  _buildFort() {
    const L = WALL_LEVELS[this.wallLevel];
    this.M.wall.color.setHex(L.stone);
    this.M.wallDark.color.setHex(L.dark);
    this.M.wallRoof.color.setHex(L.roof);
    this._parent = this.fort;
    this._inFort = true;
    this._walls();
    this._gate();
    this._parent = null;
    this._inFort = false;
  }

  _add(geo, mat, x, y, z, parent = this._parent ?? this.group) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /** Yön açısı θ için birim vektör (θ=0 → +z) */
  static dir(theta) { return new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta)); }

  // ---------------- Surlar ve kuleler ----------------
  _walls() {
    const M = this.M;
    const H = this.wallH;
    const lv = this.wallLevel;
    const segLen = 2 * R_CORNER * Math.sin(Math.PI / 8);
    const merlons = [];
    const spikes = [];
    for (let i = 0; i < 8; i++) {
      const theta = (i * Math.PI) / 4;
      const d = Castle.dir(theta);
      const isGate = Math.abs(theta - GATE_ANGLE) < 0.01;
      const parts = isGate ? [[-segLen / 4 - 0.85, segLen / 2 - 1.7], [segLen / 4 + 0.85, segLen / 2 - 1.7]] : [[0, segLen]];
      for (const [off, len] of parts) {
        const wall = new THREE.Group();
        wall.position.copy(d.clone().multiplyScalar(APOTHEM));
        wall.rotation.y = theta;
        this.fort.add(wall);
        this._add(new THREE.BoxGeometry(len, H, WALL_T), M.wall, off, H / 2, 0, wall);
        this._add(new THREE.BoxGeometry(len, 0.25, WALL_T + 0.3), M.wallDark, off, H, 0, wall); // yürüyüş yolu
        // Mazgallar (dış kenar)
        const n = Math.max(2, Math.floor(len / 1.1));
        for (let k = 0; k < n; k++) {
          const x = off - len / 2 + 0.45 + (k * (len - 0.9)) / (n - 1);
          const p = new THREE.Vector3(x, H + 0.45, WALL_T / 2 + 0.05).applyEuler(wall.rotation).add(wall.position);
          merlons.push({ p, ry: theta });
        }
        // Dış yüzde taş sıraları (koyu kuşak)
        this._add(new THREE.BoxGeometry(len, 0.18, 0.05), M.wallDark, off, 1.2, WALL_T / 2 + 0.02, wall).castShadow = false;
        this._add(new THREE.BoxGeometry(len, 0.18, 0.05), M.wallDark, off, 2.5, WALL_T / 2 + 0.02, wall).castShadow = false;
        // --- Yükseltme görünümleri ---
        if (lv >= 1) {
          // Payandalar ve demir kuşaklar
          for (const bx of [-len / 3, len / 3]) {
            const b = this._add(new THREE.BoxGeometry(0.7, H * 0.75, 0.7), M.wallDark, off + bx, H * 0.375, WALL_T / 2 + 0.3, wall);
            b.rotation.x = -0.12;
          }
          this._add(new THREE.BoxGeometry(len, 0.14, 0.06), M.iron, off, H - 0.5, WALL_T / 2 + 0.04, wall).castShadow = false;
        }
        if (lv >= 2) {
          // Duvar dibinde demir kazıklar + asılı sancaklar
          spikes.push(...Array.from({ length: Math.floor(len / 0.7) }, (_, k) =>
            new THREE.Vector3(off - len / 2 + 0.35 + k * 0.7, 0.45, WALL_T / 2 + 0.55).applyEuler(wall.rotation).add(wall.position)).map((p) => ({ p, ry: theta })));
          if (len > 3) {
            const ban = this._add(new THREE.PlaneGeometry(0.9, 1.8), M.banner, off, H - 1.3, WALL_T / 2 + 0.06, wall);
            ban.castShadow = false;
            this._add(new THREE.BoxGeometry(0.5, 0.5, 0.05), M.gold, off, H - 1.15, WALL_T / 2 + 0.08, wall).castShadow = false;
          }
        }
        if (lv >= 3) {
          // Altın kenar şeridi
          this._add(new THREE.BoxGeometry(len, 0.12, WALL_T + 0.34), M.gold, off, H + 0.15, 0, wall).castShadow = false;
        }
      }
    }
    if (spikes.length) {
      const sp = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 1.1, 5), M.iron, spikes.length);
      const dd = new THREE.Object3D();
      spikes.forEach((m, i) => { dd.position.copy(m.p); dd.rotation.set(0.9, m.ry, 0, 'YXZ'); dd.updateMatrix(); sp.setMatrixAt(i, dd.matrix); });
      this.fort.add(sp);
    }
    const merGeo = new THREE.BoxGeometry(0.6, 0.7, 0.45);
    const inst = new THREE.InstancedMesh(merGeo, M.wall, merlons.length);
    const dm = new THREE.Object3D();
    merlons.forEach((m, i) => { dm.position.copy(m.p); dm.rotation.set(0, m.ry, 0); dm.updateMatrix(); inst.setMatrixAt(i, dm.matrix); });
    inst.castShadow = true;
    this.fort.add(inst);

    // Köşe kuleleri
    const towerGeo = new THREE.CylinderGeometry(1.5, 1.75, H + 2.4, 12);
    const capGeo = new THREE.CylinderGeometry(1.8, 1.8, 0.35, 12);
    const roofGeo = new THREE.ConeGeometry(2.0, 2.6, 12);
    const slitGeo = new THREE.BoxGeometry(0.16, 0.7, 0.1);
    const merTower = new THREE.BoxGeometry(0.55, 0.55, 0.35);
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 5);
    const flagGeo = new THREE.PlaneGeometry(0.8, 0.5);
    const out0 = (t) => Castle.dir(t);
    for (let i = 0; i < 8; i++) {
      const theta = (i * Math.PI) / 4 + Math.PI / 8;
      const p = Castle.dir(theta).multiplyScalar(R_CORNER);
      this._add(towerGeo, M.wall, p.x, (H + 2.4) / 2, p.z);
      this._add(capGeo, lv >= 3 ? M.gold : M.wallDark, p.x, H + 2.55, p.z);
      if (this.openTowers.has(i)) {
        // Okçu kulesi: çatı yok, mazgallı açık platform + sancak
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const mm = this._add(merTower, M.wall, p.x + Math.sin(a) * 1.6, H + 3.0, p.z + Math.cos(a) * 1.6);
          mm.rotation.y = a;
        }
        this._add(poleGeo, M.wood, p.x - out0(theta).x * 1.2, H + 3.9, p.z - out0(theta).z * 1.2);
        const fl = this._add(flagGeo, M.banner, p.x - out0(theta).x * 1.2 + 0.4, H + 4.8, p.z - out0(theta).z * 1.2);
        fl.castShadow = false;
      } else {
        this._add(roofGeo, M.wallRoof, p.x, H + 4.0, p.z);
      }
      // Mazgal pencereleri (dışa bakan)
      const out = Castle.dir(theta);
      const s = this._add(slitGeo, M.iron, p.x + out.x * 1.62, H - 0.3, p.z + out.z * 1.62);
      s.rotation.y = theta;
      s.castShadow = false;
      // Meşale
      if (i % 2 === 0) this._torch(p.clone().add(Castle.dir(theta).multiplyScalar(-1.7)).setY(H + 0.6));
    }
  }

  // ---------------- Ana kapı ----------------
  _gate() {
    const M = this.M;
    const H = this.wallH;
    const gate = new THREE.Group();
    gate.position.copy(Castle.dir(GATE_ANGLE).multiplyScalar(APOTHEM));
    gate.rotation.y = GATE_ANGLE;
    this.fort.add(gate);
    for (const x of [-2.25, 2.25]) {
      this._add(new THREE.BoxGeometry(2.0, H + 2.8, 2.4), M.wall, x, (H + 2.8) / 2, 0.2, gate);
      this._add(new THREE.BoxGeometry(2.3, 0.3, 2.7), M.wallDark, x, H + 2.95, 0.2, gate);
      for (const mx of [-0.7, 0, 0.7]) this._add(new THREE.BoxGeometry(0.45, 0.6, 0.45), M.wall, x + mx, H + 3.4, 1.35, gate);
      this._torch(new THREE.Vector3(x * 0.82, 3.1, 1.55).applyEuler(gate.rotation).add(gate.position));
    }
    // Kemer üstü + kapı boşluğu
    this._add(new THREE.BoxGeometry(2.6, 1.4, 2.0), M.wall, 0, H + 0.1, 0.1, gate);
    this._add(new THREE.BoxGeometry(2.5, 3.1, 0.2), new THREE.MeshBasicMaterial({ color: 0x14100c }), 0, 1.55, 0.2, gate).castShadow = false;
    // Demir parmaklık
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 3.0, 0.08), M.iron, 9);
    const dm = new THREE.Object3D();
    for (let i = 0; i < 7; i++) { dm.position.set(-1.05 + i * 0.35, 1.9, 0.75); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); bars.setMatrixAt(i, dm.matrix); }
    for (let i = 0; i < 2; i++) { dm.position.set(0, 1.0 + i * 1.3, 0.75); dm.rotation.set(0, 0, Math.PI / 2); dm.scale.set(1, 0.85, 1); dm.updateMatrix(); bars.setMatrixAt(7 + i, dm.matrix); }
    gate.add(bars);
    // Asma köprü + zincirler
    this._add(new THREE.BoxGeometry(2.6, 0.18, 3.6), M.wood, 0, 0.1, 2.6, gate);
    for (const x of [-1.15, 1.15]) {
      const ch = this._add(new THREE.CylinderGeometry(0.03, 0.03, 4.4, 4), M.iron, x, 2.2, 2.4, gate);
      ch.rotation.x = 0.85;
    }
    // Kapı üstünde arma
    this._add(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 16), M.gold, 0, H + 0.2, 1.15, gate).rotation.x = Math.PI / 2;
  }

  // ---------------- Burç (oyuncu tepesinde) ----------------
  _keep() {
    const M = this.M;
    const S = 4.8;
    this._add(new THREE.BoxGeometry(S, KEEP_H, S), M.stone, 0, KEEP_H / 2, 0);
    this._add(new THREE.BoxGeometry(S + 0.6, 0.35, S + 0.6), M.stoneDark, 0, KEEP_H + 0.05, 0);
    this._add(new THREE.BoxGeometry(S + 0.3, 0.6, S + 0.3), M.stoneDark, 0, 0.3, 0);
    // Tepe mazgalları
    const mg = new THREE.BoxGeometry(0.55, 0.65, 0.4);
    for (let side = 0; side < 4; side++) {
      for (let k = 0; k < 5; k++) {
        const t = -S / 2 + 0.3 + (k * (S - 0.6)) / 4;
        const m = this._add(mg, M.stone, 0, KEEP_H + 0.55, 0);
        const off = S / 2 + 0.1;
        if (side === 0) m.position.set(t, KEEP_H + 0.55, off);
        if (side === 1) m.position.set(t, KEEP_H + 0.55, -off);
        if (side === 2) { m.position.set(off, KEEP_H + 0.55, t); m.rotation.y = Math.PI / 2; }
        if (side === 3) { m.position.set(-off, KEEP_H + 0.55, t); m.rotation.y = Math.PI / 2; }
      }
    }
    // Köşe kulecikleri + sancaklar
    // Kameraya bakan köşede kulecik yok (avluyu ve kahramanı kapatmasın)
    for (const [sx, sz] of [[1, -1], [-1, 1], [-1, -1]]) {
      const x = sx * (S / 2), z = sz * (S / 2);
      this._add(new THREE.CylinderGeometry(0.7, 0.8, KEEP_H + 1.4, 10), M.stone, x, (KEEP_H + 1.4) / 2, z);
      this._add(new THREE.ConeGeometry(0.95, 1.6, 10), M.roof, x, KEEP_H + 2.2, z);
      this._add(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), M.wood, x, KEEP_H + 3.9, z);
      const geo = new THREE.PlaneGeometry(1.2, 0.7, 6, 1);
      geo.translate(0.6, 0, 0);
      const flag = new THREE.Mesh(geo, M.flag);
      flag.position.set(x, KEEP_H + 4.3, z);
      flag.userData.base = geo.attributes.position.array.slice();
      this.group.add(flag);
      this.flags.push(flag);
    }
    // Kapı + pencereler (kalenin girişine bakan yüz)
    const face = Castle.dir(GATE_ANGLE);
    const door = this._add(new THREE.BoxGeometry(1.4, 2.2, 0.15), M.wood, face.x * (S / 2 + 0.05), 1.4, face.z * (S / 2 + 0.05));
    door.lookAt(face.x * 10, 1.4, face.z * 10);
    for (const [y, xo] of [[2.6, -1.1], [2.6, 1.1], [4.0, 0]]) {
      for (const [nx, nz, ry] of [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, 0], [-1, 0, Math.PI / 2]]) {
        const w = this._add(new THREE.BoxGeometry(0.4, 0.75, 0.1), M.glow, nx * (S / 2 + 0.03) + (nz ? xo : 0), y, nz * (S / 2 + 0.03) + (nx ? xo : 0));
        w.rotation.y = ry;
        w.castShadow = false;
      }
    }
    // Oyuncunun durduğu platform (taş zemin)
    this._add(new THREE.CylinderGeometry(1.4, 1.4, 0.1, 20), M.path, 0, KEEP_H + 0.25, 0).castShadow = false;
    this._torch(new THREE.Vector3(face.x * (S / 2 + 0.2) + 0.9, 3.0, face.z * (S / 2 + 0.2) - 0.9));
  }

  // ---------------- Bahçeli avlu ----------------
  _courtyard() {
    const M = this.M;
    const lawn = this._add(new THREE.CircleGeometry(APOTHEM - 0.5, 8), M.grass, 0, 0.03, 0);
    lawn.rotation.x = -Math.PI / 2;
    lawn.rotation.z = Math.PI / 8;
    lawn.castShadow = false;

    // Taş yollar: kapıdan burca ve çapraz
    for (const a of [GATE_ANGLE, GATE_ANGLE + Math.PI / 2, GATE_ANGLE + Math.PI, GATE_ANGLE - Math.PI / 2]) {
      const len = APOTHEM - 3;
      const d = Castle.dir(a);
      const p = this._add(new THREE.BoxGeometry(1.6, 0.06, len), M.path, d.x * (len / 2 + 2.5), 0.06, d.z * (len / 2 + 2.5));
      p.rotation.y = a;
      p.castShadow = false;
    }
    const ring = this._add(new THREE.RingGeometry(3.6, 4.6, 32), M.path, 0, 0.065, 0);
    ring.rotation.x = -Math.PI / 2;
    ring.castShadow = false;

    // Dört çeyrekte çiçek tarhları, çitler, ağaçlar
    const flowers = [];
    const colors = [0xe0303a, 0xffd84a, 0xb65cff, 0xffffff, 0xff8ac8];
    for (let q = 0; q < 4; q++) {
      const a = GATE_ANGLE + Math.PI / 4 + (q * Math.PI) / 2;
      const d = Castle.dir(a);
      const tang = Castle.dir(a + Math.PI / 2);
      // Tarh (ahşap çerçeveli toprak)
      const c = d.clone().multiplyScalar(6.6);
      const bed = new THREE.Group();
      bed.position.copy(c);
      bed.rotation.y = a;
      this.group.add(bed);
      this._add(new THREE.BoxGeometry(3.2, 0.3, 1.6), M.wood, 0, 0.15, 0, bed);
      this._add(new THREE.BoxGeometry(3.0, 0.32, 1.4), M.soil, 0, 0.17, 0, bed).castShadow = false;
      for (let k = 0; k < 18; k++) {
        const lp = new THREE.Vector3((Math.random() - 0.5) * 2.8, 0.42, (Math.random() - 0.5) * 1.2).applyEuler(bed.rotation).add(c);
        flowers.push({ p: lp, c: colors[(q + k) % colors.length] });
      }
      // Alçak çit (tarhın iki yanında)
      for (const s of [-1, 1]) {
        const hp = c.clone().add(tang.clone().multiplyScalar(s * 2.6));
        const h = this._add(new THREE.BoxGeometry(0.6, 0.6, 2.2), M.hedge, hp.x, 0.3, hp.z);
        h.rotation.y = a;
      }
      // Ağaç (köşeye yakın)
      const tp = d.clone().multiplyScalar(8.8).add(tang.clone().multiplyScalar(q % 2 ? 1.6 : -1.6));
      this._add(new THREE.CylinderGeometry(0.15, 0.22, 1.4, 6), M.wood, tp.x, 0.7, tp.z);
      if (q % 2) this._add(new THREE.ConeGeometry(0.7, 2.8, 7), M.hedge, tp.x, 2.6, tp.z); // selvi
      else this._add(new THREE.IcosahedronGeometry(1.05, 0), M.leaf, tp.x, 2.0, tp.z);
      // Bank (yol kenarında)
      const bp = d.clone().multiplyScalar(4.9).add(tang.clone().multiplyScalar(1.7));
      const bench = this._add(new THREE.BoxGeometry(1.2, 0.12, 0.4), M.wood, bp.x, 0.45, bp.z);
      bench.rotation.y = a + Math.PI / 2;
    }
    const fGeo = new THREE.SphereGeometry(0.11, 6, 4);
    const fInst = new THREE.InstancedMesh(fGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), flowers.length);
    const dm = new THREE.Object3D();
    const col = new THREE.Color();
    flowers.forEach((f, i) => {
      dm.position.copy(f.p); dm.updateMatrix();
      fInst.setMatrixAt(i, dm.matrix);
      fInst.setColorAt(i, col.set(f.c));
    });
    this.group.add(fInst);

    // Kuyu (burcun yan tarafında)
    const wp = Castle.dir(GATE_ANGLE + Math.PI / 2).multiplyScalar(3.2).add(Castle.dir(GATE_ANGLE).multiplyScalar(-0.2));
    this._add(new THREE.CylinderGeometry(0.75, 0.8, 0.8, 14, 1, true), M.stone, wp.x, 0.4, wp.z).material.side = THREE.DoubleSide;
    this._add(new THREE.CircleGeometry(0.7, 14), M.water, wp.x, 0.45, wp.z).rotation.x = -Math.PI / 2;
    for (const s of [-1, 1]) this._add(new THREE.BoxGeometry(0.12, 1.6, 0.12), M.wood, wp.x + s * 0.7, 1.1, wp.z);
    const wr = this._add(new THREE.ConeGeometry(1.1, 0.7, 4), M.roof, wp.x, 2.2, wp.z);
    wr.rotation.y = Math.PI / 4;
    // Saman balyaları ve fıçılar (kapı yanında)
    const gp = Castle.dir(GATE_ANGLE + Math.PI).multiplyScalar(8.2);
    const side = Castle.dir(GATE_ANGLE + Math.PI / 2);
    for (let k = 0; k < 3; k++) {
      const p = gp.clone().add(side.clone().multiplyScalar(2.6 + k * 0.7));
      this._add(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 10), M.wood, p.x, 0.4, p.z);
    }
    const hay = gp.clone().add(side.clone().multiplyScalar(-3.0));
    this._add(new THREE.BoxGeometry(1.2, 0.7, 0.8), new THREE.MeshStandardMaterial({ color: 0xd8b85a, roughness: 1 }), hay.x, 0.35, hay.z).rotation.y = GATE_ANGLE;
  }

  _torch(pos) {
    const flame = this._add(new THREE.SphereGeometry(0.16, 8, 6), this.M.flame, pos.x, pos.y + 0.25, pos.z);
    flame.castShadow = false;
    this._add(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 5), this.M.wood, pos.x, pos.y, pos.z);
    this.torches.push({ flame, phase: Math.random() * 10, fort: !!this._inFort });
  }

  /**
   * Bir noktayı surların dışına it (sekizgen sur yüzleri + köşe kuleleri).
   * Sura dayanmışsa true döner (yaratık saldırabilir).
   */
  pushOut(p, er) {
    let touched = false;
    const step = Math.PI / 4;
    const phi = Math.atan2(p.x, p.z);
    const i = Math.round(phi / step);
    const th = i * step;
    const nx = Math.sin(th), nz = Math.cos(th);
    const isGate = Math.abs(((th - GATE_ANGLE) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) < 0.01;
    const A = APOTHEM + WALL_T / 2 + (isGate ? 0.9 : 0) + er;
    const dot = p.x * nx + p.z * nz;
    if (dot < A + 0.15) {
      if (dot < A) { p.x += nx * (A - dot); p.z += nz * (A - dot); }
      touched = true;
    }
    for (let k = 0; k < 8; k++) {
      const a = k * step + Math.PI / 8;
      const tx = Math.sin(a) * R_CORNER, tz = Math.cos(a) * R_CORNER;
      const dx = p.x - tx, dz = p.z - tz;
      const d = Math.hypot(dx, dz) || 0.001;
      const min = 1.75 + er;
      if (d < min + 0.15) {
        if (d < min) { p.x = tx + (dx / d) * min; p.z = tz + (dz / d) * min; }
        touched = true;
      }
    }
    return touched;
  }

  get hpRatio() { return Math.max(0, this.hp / this.maxHp); }

  /** Sura hasar ver; from = vuranın konumu (taş parçaları oradan saçılır) */
  damage(amount, from) {
    if (this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.flash = 1;
    const g = this.game;
    if (from) {
      const dir = new THREE.Vector3().subVectors(from, this.position).setY(0).normalize();
      const at = dir.multiplyScalar(APOTHEM + WALL_T / 2);
      at.y = 0.8 + Math.random() * 2.2;
      g.particles.burst(at, [0x9a948a, 0x6f6a62, 0xffb347], 8, { speed: 6, size: 0.25, life: 0.6 });
    }
    g.sceneMgr.addShake(0.05);
    g.hud.castleHit();
  }

  repair(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  update(dt) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 7);
    for (const m of this.flashMats) m.emissiveIntensity = this.flash * 0.12;

    for (const f of this.flags) {
      const p = f.geometry.attributes.position;
      const base = f.userData.base;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3];
        p.array[i * 3 + 2] = Math.sin(this.t * 6 - x * 4) * 0.15 * (x / 1.2);
      }
      p.needsUpdate = true;
    }
    for (const tc of this.torches) {
      const s = 0.85 + Math.sin(this.t * 13 + tc.phase) * 0.12 + Math.random() * 0.1;
      tc.flame.scale.set(s, s * 1.3, s);
    }

    // Surlar zayıfladıkça duman ve alev
    if (this.hpRatio < 0.5) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = this.hpRatio < 0.25 ? 0.05 : 0.14;
        const a = Math.random() * Math.PI * 2;
        const at = Castle.dir(a).multiplyScalar(APOTHEM).setY(this.wallH + 0.3);
        this.game.particles.emit(at.x, at.y, at.z, this.hpRatio < 0.25 ? 0xff6a00 : 0x3a3530,
          (Math.random() - 0.5), 3 + Math.random() * 2, (Math.random() - 0.5), 0.5, 1.3, 0.5);
      }
    }
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of Object.values(this.M)) m.dispose();
  }
}
