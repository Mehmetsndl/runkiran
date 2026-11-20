// ============================================================
//  DENİZ SAVAŞI SAHNESİ
//  - İki kalyon yan yana aynı yöne (+X) seyreder: deniz, köpükler ve
//    uzaktaki adalar geriye akar; pruvada köpük, kıçta dümen suyu.
//  - Arada bir yandan büyük dalga gelir: gemiler yalpalar, köpük sıçrar.
//  - Güvertede mürettebat (oyuncular) rol animasyonlarıyla görünür.
// ============================================================
import * as THREE from 'three';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { groundDecal, shieldDome } from '../systems/GroundFx.js';
import { buildPlayerModel } from '../entities/PlayerModels.js';
import { poseArms, poseEnvelope } from '../entities/poses.js';
import { getCharacter } from '../data/characters.js';
import { TEAM_COLORS } from '../data/naval.js';
import { buildShip, buildDeckCannon, sideZ, SHIP } from './ShipBuilder.js';

const SHIP_Z = 11;          // gemiler z=+11 (takım 0) ve z=-11 (takım 1)
const SAIL_SPEED = 6;       // denizin geriye akış hızı (gemilerin seyir hissi)

// Düşman gemisindeki hedef noktaları (gemi yerel koordinatları)
export const ZONES = [
  { name: 'Pruva', pos: [8.6, 5.0, 0] },
  { name: 'Direk', pos: [0.4, 9.6, 0] },
  { name: 'Kıç', pos: [-8.2, 5.6, 0] },
];
// Savunmacı istasyonlarının etiket noktaları
export const STATIONS = {
  repair: [-1.6, 5.4, 0.6],
  armor: [-8.0, 5.6, 0],
  hull: [8.2, 5.2, 0],
};
// Mürettebat yerleri (gemi yerel): savunmacı ortada, topçular düşman bordasındaki toplarda
const CREW_SLOTS = {
  savunma: [{ x: -1.6, z: 0.7, face: 0 }],
  topcu: [{ x: 3.0, z: -1.25, face: Math.PI }, { x: -3.6, z: -1.25, face: Math.PI }],
};

export class NavalScene {
  constructor(renderer, myTeam) {
    this.renderer = renderer;
    this.myTeam = myTeam;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9cc3e0);
    this.scene.fog = new THREE.Fog(0x9cc3e0, 80, 190);
    this.t = 0;
    this.shots = [];
    this.flashes = [];
    this.effects = [];
    this.crew = [];
    this.shake = 0;
    this.swells = [];
    this.nextSwell = 6 + Math.random() * 4;
    this.onSwell = null; // NavalGame bildirim için

    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 400);
    const side = myTeam === 0 ? 1 : -1;
    this.camBase = new THREE.Vector3(-8, 34, side * 48);
    this.camLook = new THREE.Vector3(0, 2, -side * 3);

    this.scene.add(new THREE.HemisphereLight(0xe4efff, 0x1d3a52, 1.25));
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.3);
    sun.position.set(30, 45, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 140 });
    this.scene.add(sun);

    this._buildSea();
    this._buildFoam();
    this._buildIslands();
    this.ships = [0, 1].map((team) => this._buildShip(team));
    this.particles = new ParticleSystem({ scene: this.scene }, 4000);

    this.onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this.onResize);
  }

  // ---------------- Deniz ----------------
  /** Dalga yüksekliği: seyir yönünde akan dalgalar + yandan gelen büyük dalgalar */
  waveH(x, z) {
    const t = this.t;
    const xs = x + SAIL_SPEED * t;
    let h = Math.sin(xs * 0.12 + t * 1.1) * 0.42 + Math.cos(z * 0.17 + t * 0.8) * 0.32 + Math.sin((xs + z) * 0.3 + t * 2) * 0.12;
    for (const s of this.swells) {
      const d = (z - s.z) / s.width;
      h += s.amp * Math.exp(-d * d) * (0.85 + 0.15 * Math.sin(xs * 0.15));
    }
    return h;
  }

  _buildSea() {
    const geo = new THREE.PlaneGeometry(280, 280, 110, 110);
    geo.rotateX(-Math.PI / 2);
    this.seaBase = geo.attributes.position.array.slice();
    const mat = new THREE.MeshStandardMaterial({ color: 0x1d6a98, roughness: 0.3, metalness: 0.12, flatShading: true });
    this.sea = new THREE.Mesh(geo, mat);
    this.sea.receiveShadow = true;
    this.scene.add(this.sea);
  }

  /** Su üstünde geriye akan köpük lekeleri */
  _buildFoam() {
    const n = 160;
    const geo = new THREE.CircleGeometry(1, 7);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.32, depthWrite: false });
    this.foam = new THREE.InstancedMesh(geo, mat, n);
    this.foam.frustumCulled = false;
    this.foamData = Array.from({ length: n }, () => ({
      x: (Math.random() - 0.5) * 160, z: (Math.random() - 0.5) * 110,
      sx: 1.2 + Math.random() * 3.2, sz: 0.06 + Math.random() * 0.14, r: (Math.random() - 0.5) * 0.12,
    }));
    this.scene.add(this.foam);
    this._dummy = new THREE.Object3D();
  }

  /** Ufukta yavaşça geriye kayan kayalık adalar (hareket hissi) */
  _buildIslands() {
    this.islands = [];
    const rock = new THREE.MeshStandardMaterial({ color: 0x6d6a62, roughness: 1, flatShading: true });
    const green = new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 1, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const s = 4 + Math.random() * 6;
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rock);
      r.scale.set(1.6, 0.6, 1);
      const top = new THREE.Mesh(new THREE.DodecahedronGeometry(s * 0.7, 0), green);
      top.scale.set(1.5, 0.45, 0.9);
      top.position.y = s * 0.35;
      g.add(r, top);
      const side = i % 2 ? 1 : -1;
      g.position.set(-150 + i * 65 + Math.random() * 20, -1, side * (75 + Math.random() * 25));
      this.scene.add(g);
      this.islands.push(g);
    }
  }

  _buildShip(team) {
    const built = buildShip(team, TEAM_COLORS[team]);
    const g = built.group;
    const z = team === 0 ? SHIP_Z : -SHIP_Z;
    g.position.set(0, 0, z);
    g.rotation.y = team === 0 ? 0 : Math.PI;
    // Takım 1 gemisi döndürüldüğünde de pruvası +X'e baksın diye ayna yerine
    // 180° çevirip x eksenini ters çeviriyoruz: iki gemi aynı yöne seyreder.
    if (team === 1) g.scale.set(-1, 1, 1);
    this.scene.add(g);
    return {
      team, group: g, sails: built.sails, muzzles: built.muzzles, M: built.materials,
      armorPlates: [], hullBands: 0, hitShake: 0, phase: team * 1.7, sinking: 0, fireT: 0,
      roll: 0, pitch: 0, heave: 0, sprayT: 0,
    };
  }

  /** Gemi yerel noktasını dünya koordinatına çevir */
  shipPoint(team, local, out = new THREE.Vector3()) {
    const s = this.ships[team];
    s.group.updateMatrixWorld();
    return out.set(...local).applyMatrix4(s.group.matrixWorld);
  }

  // ---------------- Mürettebat ----------------
  /** Oyuncuları güverteye yerleştir. players: [{key, team, role, ch, nick}] */
  setCrew(players) {
    const used = { 0: { savunma: 0, topcu: 0 }, 1: { savunma: 0, topcu: 0 } };
    for (const p of players) {
      const slots = CREW_SLOTS[p.role];
      const slot = slots[Math.min(used[p.team][p.role]++, slots.length - 1)];
      const ship = this.ships[p.team];
      const model = buildPlayerModel(getCharacter(p.ch));
      const scale = 1.9 / model.height;
      const root = new THREE.Group();
      root.position.set(slot.x, SHIP.deckY, slot.z);
      root.rotation.y = slot.face;
      model.root.scale.setScalar(scale);
      root.add(model.root);
      ship.group.add(root);
      let cannon = null;
      if (p.role === 'topcu') {
        cannon = buildDeckCannon(ship.M);
        cannon.position.set(slot.x, SHIP.deckY, -2.1);
        ship.group.add(cannon);
      }
      this.crew.push({
        key: p.key, team: p.team, role: p.role, model, root, cannon, scale,
        pose: null, recoil: 0, t: Math.random() * 10, height: model.height * scale,
      });
    }
  }

  crewOf(key) { return this.crew.find((c) => c.key === key); }

  /** Mürettebatın başının üstü (isim etiketi için) */
  crewHead(c, out = new THREE.Vector3()) {
    c.root.updateMatrixWorld();
    out.set(0, c.height / c.scale + 0.4, 0);
    return c.model.root.localToWorld(out);
  }

  _setPose(c, type, dur) { c.pose = { type, t: dur, dur }; }

  /** Kazananlar sevinir, kaybedenler yıkılır */
  celebrate(winner) {
    for (const c of this.crew) {
      if (winner === -1) continue;
      this._setPose(c, c.team === winner ? 'cheer' : 'slump', 999);
    }
  }

  // ---------------- Efektler ----------------
  /** Top atışı: team gemisinden karşı gemideki bölgeye. by = ateşleyen oyuncu */
  fire(team, zone, { crit = false, barrel = false, onHit, by } = {}) {
    const ship = this.ships[team];
    const c = by ? this.crewOf(by) : null;
    let from;
    if (c?.cannon) {
      c.cannon.updateMatrixWorld();
      from = c.cannon.localToWorld(c.cannon.userData.muzzle.clone());
      c.recoil = 1;
      this._setPose(c, 'point', 0.7);
    } else {
      const m = ship.muzzles[Math.floor(Math.random() * ship.muzzles.length)];
      from = this.shipPoint(team, [m.x, m.y, m.z]);
    }
    const z = ZONES[zone % ZONES.length].pos;
    const to = this.shipPoint(1 - team, [z[0] + (Math.random() - 0.5) * 2, z[1] - 1 + Math.random(), z[2]]);
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(crit || barrel ? 0.42 : 0.3, 10, 8),
      new THREE.MeshStandardMaterial({ color: barrel ? 0xff6a00 : 0x1a1a1a, emissive: barrel ? 0xff4400 : crit ? 0x553300 : 0, metalness: 0.5 })
    );
    ball.position.copy(from);
    this.scene.add(ball);
    this.particles.burst(from, [0xffd84a, 0xff7a1a, 0xffffff], 14, { speed: 8, size: 0.35, life: 0.3, gravity: 0 });
    this.particles.burst(from, [0x9a9a9a, 0xd0d0d0], 12, { speed: 3, size: 0.7, life: 1.2, gravity: 2 });
    this.shots.push({ ball, from, to, t: 0, dur: 0.85 + Math.random() * 0.15, crit, barrel, team, onHit });
  }

  /** Savunmacı eylemi: onar (eller yukarı + yeşil alan), zırh (kalkan kubbesi), gövde (çekiç) */
  repairFx(team, kind, by) {
    const ship = this.ships[team];
    const c = (by && this.crewOf(by)) || this.crew.find((x) => x.team === team && x.role === 'savunma');
    const local = c ? c.root.position.clone() : new THREE.Vector3(...STATIONS.repair);
    const world = this.shipPoint(team, [local.x, local.y + 1, local.z]);
    if (kind === 'armor') {
      if (c) this._setPose(c, 'shield', 1.1);
      this.effects.push(shieldDome(ship.group, new THREE.Vector3(0, 0.5, 0), 9));
      this.particles.burst(world, [0x7fd3ff, 0xffffff], 22, { speed: 6, size: 0.22, life: 0.6, gravity: -4 });
    } else if (kind === 'hull') {
      if (c) this._setPose(c, 'hammer', 1.2);
      this.particles.burst(world, [0xffd84a, 0xffffff], 26, { speed: 7, size: 0.22, life: 0.7, gravity: -2 });
      this._ringFlash(team, 0xffd84a);
    } else {
      if (c) this._setPose(c, 'raise', 1.3);
      this.effects.push(groundDecal(this.scene, local.clone(), { kind: 'heal', color: 0x5dff7a, radius: 2.4, life: 1.4, parent: ship.group, particles: this.particles }));
    }
  }

  /** Zırh seviyesi başına bordaya demir plakalar (durumdan eşitlenir) */
  addArmorPlate(team) {
    const ship = this.ships[team];
    const i = ship.armorPlates.length / 2;
    const x = -5.4 + i * 2.6;
    for (const side of [-1, 1]) {
      const y = 0.75;
      const z = sideZ(x, y) + 0.06;
      const slope = (sideZ(x + 0.3, y) - sideZ(x - 0.3, y)) / 0.6;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.08), ship.M.iron);
      plate.position.set(x, y, side * z);
      plate.rotation.y = side < 0 ? Math.atan(slope) : -Math.atan(slope);
      for (const dx of [-0.9, 0, 0.9]) {
        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), ship.M.gold);
        rivet.position.set(dx, 0, side * 0.05);
        plate.add(rivet);
      }
      plate.castShadow = true;
      ship.group.add(plate);
      ship.armorPlates.push(plate);
    }
  }

  /** Gövde seviyesi başına bordayı saran demir kuşak (durumdan eşitlenir) */
  addHullPlank(team) {
    const ship = this.ships[team];
    const y = 0.25 + ship.hullBands * 0.22;
    for (const side of [-1, 1]) {
      const pts = [];
      for (let x = -8.5; x <= 8.5; x += 0.5) pts.push(new THREE.Vector3(x, y, side * (sideZ(x, y) + 0.05)));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.06, 5), ship.M.team);
      ship.group.add(tube);
    }
    ship.hullBands++;
  }

  _ringFlash(team, color) {
    const ship = this.ships[team];
    const m = new THREE.Mesh(
      new THREE.RingGeometry(9, 10, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(ship.group.position.x, 0.6, ship.group.position.z);
    this.scene.add(m);
    this.flashes.push({ m, t: 0 });
  }

  // ---------------- Güncelleme ----------------
  update(dt, state) {
    this.t += dt;
    const t = this.t;

    // Büyük dalgalar: yandan gelir, iki geminin altından geçer
    this.nextSwell -= dt;
    if (this.nextSwell <= 0) {
      this.nextSwell = 14 + Math.random() * 10;
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.swells.push({ z: -dir * 75, dir, speed: 15, amp: 2.2 + Math.random() * 1.0, width: 6.5, hit: new Set() });
      this.onSwell?.();
    }
    for (let i = this.swells.length - 1; i >= 0; i--) {
      const s = this.swells[i];
      s.z += s.dir * s.speed * dt;
      // Dalga sırtında köpük şeridi
      for (let k = 0; k < 14; k++) {
        const x = (Math.random() - 0.5) * 150;
        const z = s.z + (Math.random() - 0.5) * 2;
        this.particles.emit(x, this.waveH(x, z) + 0.2, z, Math.random() < 0.7 ? 0xffffff : 0xcfeaff,
          -SAIL_SPEED * 0.5, 0.8 + Math.random(), s.dir * 3, 0.35 + Math.random() * 0.3, 0.6, -3);
      }
      if (Math.abs(s.z) > 90) this.swells.splice(i, 1);
    }

    // Deniz yüzeyi
    const pos = this.sea.geometry.attributes.position;
    const b = this.seaBase;
    for (let i = 0; i < pos.count; i++) pos.array[i * 3 + 1] = this.waveH(b[i * 3], b[i * 3 + 2]);
    pos.needsUpdate = true;

    // Köpükler geriye akar
    const d = this._dummy;
    this.foamData.forEach((f, i) => {
      f.x -= SAIL_SPEED * dt;
      if (f.x < -80) { f.x += 160; f.z = (Math.random() - 0.5) * 110; }
      d.position.set(f.x, this.waveH(f.x, f.z) + 0.08, f.z);
      d.rotation.set(0, f.r, 0);
      d.scale.set(f.sx, 1, f.sz);
      d.updateMatrix();
      this.foam.setMatrixAt(i, d.matrix);
    });
    this.foam.instanceMatrix.needsUpdate = true;
    for (const isl of this.islands) {
      isl.position.x -= SAIL_SPEED * 0.35 * dt;
      if (isl.position.x < -180) isl.position.x += 330;
    }

    // Gemiler
    for (const s of this.ships) {
      const ss = state?.ships?.[s.team];
      const ratio = ss ? ss.hp / ss.max : 1;
      s.hitShake = Math.max(0, s.hitShake - dt * 3);
      const lost = state?.over && state.over.winner === 1 - s.team;
      if (lost) s.sinking = Math.min(1, s.sinking + dt * 0.18);
      const g = s.group;
      const z = g.position.z;
      // Dalgaya göre yükselme, yalpa (roll) ve baş-kıç vurma (pitch)
      const hC = this.waveH(0, z), hL = this.waveH(0, z - 2.5), hR = this.waveH(0, z + 2.5);
      const hB = this.waveH(8, z), hS = this.waveH(-8, z);
      const tRoll = Math.atan2(hR - hL, 5) * (s.team === 0 ? 1 : -1);
      const tPitch = Math.atan2(hB - hS, 16) * (s.team === 0 ? 1 : -1);
      s.roll += (tRoll - s.roll) * Math.min(1, dt * 3);
      s.pitch += (tPitch - s.pitch) * Math.min(1, dt * 3);
      s.heave += (hC * 0.8 - s.heave) * Math.min(1, dt * 4);
      g.position.y = s.heave - 0.2 - s.sinking * 7;
      g.rotation.x = s.roll * 0.9 + (1 - ratio) * 0.05 * (s.team === 0 ? 1 : -1) + s.sinking * 0.4 + (Math.random() - 0.5) * s.hitShake * 0.05;
      g.rotation.z = s.pitch * 0.9 + (Math.random() - 0.5) * s.hitShake * 0.05;

      // Büyük dalga gemiye çarpınca köpük sıçrar
      for (const sw of this.swells) {
        if (!sw.hit.has(s.team) && Math.abs(sw.z - z) < 3) {
          sw.hit.add(s.team);
          s.hitShake = Math.max(s.hitShake, 0.5);
          if (s.team === this.myTeam) this.shake = Math.min(1, this.shake + 0.35);
          for (let k = 0; k < 8; k++) {
            const at = this.shipPoint(s.team, [-8 + k * 2.2, 2.5, (s.team === 0 ? 1 : -1) * sw.dir * -2.8]);
            this.particles.burst(at, [0xffffff, 0xd6efff, 0x9fd3f2], 10, { speed: 7, size: 0.3, life: 0.9, up: 0.85 });
          }
        }
      }

      // Pruva köpüğü + dümen suyu (seyir hissi)
      s.sprayT -= dt;
      if (s.sprayT <= 0 && s.sinking < 0.3) {
        s.sprayT = 0.03;
        for (const side of [-1, 1]) {
          const bow = this.shipPoint(s.team, [9.4, 0.3, side * 0.9]);
          this.particles.emit(bow.x, bow.y, bow.z, 0xffffff, -SAIL_SPEED * 0.6, 1.6 + Math.random() * 1.5, side * (s.team === 0 ? 1 : -1) * (2 + Math.random() * 2), 0.22, 0.7, -6);
          const mid = this.shipPoint(s.team, [Math.random() * 14 - 7, 0.1, side * 3.05]);
          this.particles.emit(mid.x, mid.y, mid.z, 0xe8f6ff, -SAIL_SPEED, 0.2, 0, 0.18, 0.6, 0);
        }
        const stern = this.shipPoint(s.team, [-10.4, 0.1, (Math.random() - 0.5) * 3]);
        this.particles.emit(stern.x, stern.y, stern.z, 0xffffff, -SAIL_SPEED * 1.1, 0.3, (Math.random() - 0.5), 0.3, 1.4, 0);
      }

      // Yelken, flama ve sancak dalgalanması
      for (const sail of s.sails) {
        const p = sail.geometry.attributes.position;
        const base = sail.userData.base;
        const isFlag = sail.material === s.M.flag;
        for (let i = 0; i < p.count; i++) {
          if (isFlag) {
            const x = base[i * 3];
            p.array[i * 3 + 2] = base[i * 3 + 2] + Math.sin(t * 7 + x * 3) * 0.18 * Math.abs(x) / 2;
          } else {
            const y = base[i * 3 + 1];
            p.array[i * 3] = base[i * 3] * (1 + Math.sin(t * 1.8 + y * 0.8) * 0.06);
          }
        }
        p.needsUpdate = true;
      }

      // Yangınlar
      if (ratio < 0.6 && !lost) {
        s.fireT -= dt;
        if (s.fireT <= 0) {
          s.fireT = ratio < 0.3 ? 0.03 : 0.09;
          const at = this.shipPoint(s.team, [(Math.random() - 0.5) * 14, 3.2 + Math.random(), (Math.random() - 0.5) * 3]);
          this.particles.emit(at.x, at.y, at.z, Math.random() < 0.6 ? 0xff6a00 : 0xffd84a, (Math.random() - 0.5) - SAIL_SPEED * 0.3, 3 + Math.random() * 2, (Math.random() - 0.5), 0.4, 0.6, 1);
          if (Math.random() < 0.4) this.particles.emit(at.x, at.y + 1, at.z, 0x3a3530, -SAIL_SPEED * 0.5, 2.5, 0, 0.8, 1.6, 0.6);
        }
      }
    }

    // Mürettebat animasyonları
    for (const c of this.crew) {
      c.t += dt;
      const p = c.model.parts;
      let armL = Math.sin(c.t * 1.6) * 0.08, armR = -Math.sin(c.t * 1.6) * 0.08, armLz = 0, armRz = 0, torsoX = 0;
      const sh = this.ships[c.team].hitShake;
      if (c.pose) {
        c.pose.t -= dt;
        if (c.pose.t <= 0) c.pose = null;
        else {
          const k = c.pose.dur > 100 ? 1 : poseEnvelope(c.pose.t, c.pose.dur);
          const a = poseArms(c.pose.type, k, c.pose.dur - c.pose.t);
          if (a) { armL = a.armL ?? armL; armR = a.armR ?? armR; armLz = a.armLz ?? 0; armRz = a.armRz ?? 0; torsoX = a.torsoX ?? 0; }
        }
      }
      if (p.armL) { p.armL.rotation.x = armL; p.armL.rotation.z = armLz; }
      if (p.armR) { p.armR.rotation.x = armR; p.armR.rotation.z = armRz; }
      if (p.torso) p.torso.rotation.x = torsoX + (Math.random() - 0.5) * sh * 0.3;
      if (p.head) p.head.rotation.y = Math.sin(c.t * 0.7) * 0.3;
      if (p.halo) p.halo.rotation.z += dt * 1.5;
      // Ayakta denge: geminin yalpasına karşı hafif eğilme
      c.model.root.rotation.z = -this.ships[c.team].roll * 0.5;
      if (c.cannon) {
        c.recoil = Math.max(0, c.recoil - dt * 2.5);
        const r = Math.sin(Math.min(1, c.recoil) * Math.PI) * 0.55;
        c.cannon.position.z = -2.1 + r;
      }
    }

    // Gülleler
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      s.ball.position.lerpVectors(s.from, s.to, k);
      s.ball.position.y += Math.sin(k * Math.PI) * 5;
      if (s.crit || s.barrel) this.particles.trail(s.ball.position, s.barrel ? 0xff6a00 : 0xffd84a);
      if (k >= 1) {
        const big = s.crit || s.barrel;
        this.particles.burst(s.to, [0xff6a00, 0xffd84a, 0xffffff], big ? 40 : 22, { speed: big ? 13 : 9, size: 0.35, life: 0.6 });
        this.particles.burst(s.to, [0x6b4425, 0x8a5a2b, 0x3e2716], big ? 24 : 14, { speed: 10, size: 0.28, life: 1.1 });
        this.particles.burst(s.to, [0x555555, 0x888888], 10, { speed: 3, size: 0.8, life: 1.4, gravity: 2 });
        this.ships[1 - s.team].hitShake = big ? 1 : 0.6;
        if (1 - s.team === this.myTeam) this.shake = Math.min(1, this.shake + (big ? 0.5 : 0.25));
        else this.shake = Math.min(1, this.shake + (big ? 0.3 : 0.1));
        this.scene.remove(s.ball);
        s.ball.geometry.dispose();
        s.ball.material.dispose();
        this.shots.splice(i, 1);
        s.onHit?.(s.to);
      }
    }

    for (let i = this.effects.length - 1; i >= 0; i--) {
      if (this.effects[i].update(dt)) { this.effects[i].dispose(); this.effects.splice(i, 1); }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      f.m.scale.setScalar(1 + f.t * 0.6);
      f.m.material.opacity = Math.max(0, 0.8 - f.t * 1.2);
      if (f.t > 0.7) {
        this.scene.remove(f.m);
        f.m.geometry.dispose();
        f.m.material.dispose();
        this.flashes.splice(i, 1);
      }
    }

    this.particles.update(dt);

    // Kamera: geminle birlikte hafifçe yalpalar + sarsıntı
    this.shake = Math.max(0, this.shake - dt * 2);
    const s2 = this.shake * this.shake * 0.8;
    const mine = this.ships[this.myTeam];
    this.camera.position.copy(this.camBase);
    this.camera.position.x += Math.sin(t * 0.2) * 1.5 + (Math.random() - 0.5) * s2;
    this.camera.position.y += mine.heave * 0.4 + Math.sin(t * 0.33) * 0.4 + (Math.random() - 0.5) * s2;
    this.camera.lookAt(this.camLook);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    for (const e of this.effects) e.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
  }
}
