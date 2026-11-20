// ============================================================
//  KALE İŞLERİ (Kale Savunması'nın "tycoon" tarafı)
//  - Altın: yaratık öldürünce ve dalga bitince kazanılır
//  - Dükkân: sur yükseltmesi, okçu, muhafız, mancınık, kaynar yağ, hazine, onarım
//  - Yardımcıların yapay zekâsı, mermileri ve 3D modelleri
//  Fiyatlar ve güçler: data/defense.js → SHOP, HELPERS
// ============================================================
import * as THREE from 'three';
import { Castle, GATE_ANGLE, WALL_LEVELS } from '../entities/Castle.js';
import { SHOP, HELPERS } from '../data/defense.js';

const APOTHEM = 12 * Math.cos(Math.PI / 8);
const tmp = new THREE.Vector3();

// ---------------- Küçük modeller ----------------
const MAT = {};
function mat(key, color, extra = {}) {
  if (!MAT[key]) MAT[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...extra });
  return MAT[key];
}
function part(parent, geo, m, x, y, z) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Mızraklı, kalkanlı muhafız */
function buildGuard() {
  const root = new THREE.Group();
  const skin = mat('skin', 0xe0b48a), iron = mat('iron', 0x8a9099, { metalness: 0.5 });
  const tab = new THREE.MeshStandardMaterial({ color: 0x2f6fff, roughness: 0.8, flatShading: true, emissive: 0xff0000, emissiveIntensity: 0 });
  const legs = [];
  for (const x of [-0.16, 0.16]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.62, 0);
    part(leg, new THREE.BoxGeometry(0.2, 0.62, 0.22), mat('trouser', 0x3a3328), 0, -0.31, 0);
    root.add(leg);
    legs.push(leg);
  }
  part(root, new THREE.BoxGeometry(0.62, 0.7, 0.36), iron, 0, 0.98, 0);
  part(root, new THREE.BoxGeometry(0.5, 0.62, 0.38), tab, 0, 0.94, 0.01);
  part(root, new THREE.SphereGeometry(0.2, 10, 8), skin, 0, 1.5, 0);
  part(root, new THREE.CylinderGeometry(0.23, 0.24, 0.24, 10), iron, 0, 1.6, 0);
  part(root, new THREE.ConeGeometry(0.24, 0.22, 10), iron, 0, 1.82, 0);
  // Kalkan (sol kol)
  const shield = part(root, new THREE.BoxGeometry(0.1, 0.62, 0.48), tab, -0.42, 1.0, 0.12);
  part(shield, new THREE.BoxGeometry(0.03, 0.3, 0.12), mat('goldTrim', 0xd9a63a, { metalness: 0.6 }), -0.06, 0, 0);
  // Mızrak (sağ kol, omuzdan döner)
  const arm = new THREE.Group();
  arm.position.set(0.38, 1.22, 0);
  part(arm, new THREE.BoxGeometry(0.16, 0.5, 0.16), iron, 0, -0.22, 0);
  const spear = part(arm, new THREE.CylinderGeometry(0.035, 0.035, 2.2, 5), mat('wood', 0x6a4a2a), 0, -0.4, 0.5);
  spear.rotation.x = Math.PI / 2;
  part(arm, new THREE.ConeGeometry(0.08, 0.3, 5), iron, 0, -0.4, 1.7).rotation.x = Math.PI / 2;
  root.add(arm);
  return { root, arm, legs, mats: [tab] };
}

/** Kukuletalı sur okçusu */
function buildArcher() {
  const root = new THREE.Group();
  const cloth = mat('archerCloth', 0x9a4a22), skin = mat('skin', 0xe0b48a);
  part(root, new THREE.CylinderGeometry(0.22, 0.3, 0.9, 8), cloth, 0, 0.6, 0);
  part(root, new THREE.SphereGeometry(0.18, 10, 8), skin, 0, 1.2, 0);
  part(root, new THREE.ConeGeometry(0.24, 0.5, 8), mat('hood', 0x2a5a26), 0, 1.38, -0.02);
  const arm = new THREE.Group();
  arm.position.set(0, 0.95, 0.15);
  const bow = part(arm, new THREE.TorusGeometry(0.42, 0.03, 4, 12, Math.PI), mat('wood', 0x6a4a2a), 0, 0, 0.25);
  bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
  root.add(arm);
  return { root, arm };
}

/** Ahşap mancınık */
function buildCatapult() {
  const root = new THREE.Group();
  const wood = mat('wood', 0x6a4a2a), dark = mat('woodDark', 0x4a3222), iron = mat('iron', 0x8a9099, { metalness: 0.5 });
  for (const x of [-0.7, 0.7]) {
    part(root, new THREE.BoxGeometry(0.2, 0.2, 2.6), wood, x, 0.45, 0);
    for (const z of [-0.95, 0.95]) {
      const w = part(root, new THREE.CylinderGeometry(0.38, 0.38, 0.14, 12), dark, x * 1.15, 0.38, z);
      w.rotation.z = Math.PI / 2;
    }
    const up = part(root, new THREE.BoxGeometry(0.18, 1.5, 0.18), wood, x, 1.2, -0.1);
    up.rotation.x = 0.15;
  }
  part(root, new THREE.BoxGeometry(1.6, 0.18, 0.2), wood, 0, 0.45, 1.1);
  part(root, new THREE.BoxGeometry(1.6, 0.18, 0.2), wood, 0, 0.45, -1.1);
  part(root, new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), iron, 0, 1.85, -0.2).rotation.z = Math.PI / 2;
  const arm = new THREE.Group();
  arm.position.set(0, 1.85, -0.2);
  part(arm, new THREE.BoxGeometry(0.16, 0.16, 3.0), wood, 0, 0, 0.6);
  part(arm, new THREE.BoxGeometry(0.6, 0.6, 0.6), mat('weight', 0x55524c), 0, -0.35, -0.85);
  const cup = part(arm, new THREE.CylinderGeometry(0.32, 0.22, 0.25, 10), dark, 0, 0.12, 2.0);
  const stone = part(cup, new THREE.DodecahedronGeometry(0.26, 0), mat('rock', 0x7a7670), 0, 0.2, 0);
  root.add(arm);
  arm.rotation.x = -0.55;
  return { root, arm, stone };
}

/** Sur üstünde ateşli yağ kazanı */
function buildCauldron() {
  const root = new THREE.Group();
  const iron = mat('pot', 0x2a2b30, { metalness: 0.6 });
  part(root, new THREE.CylinderGeometry(0.42, 0.32, 0.5, 12), iron, 0, 0.45, 0);
  part(root, new THREE.CircleGeometry(0.38, 12), new THREE.MeshBasicMaterial({ color: 0xffa21a, toneMapped: false }), 0, 0.69, 0).rotation.x = -Math.PI / 2;
  for (const a of [0, 2.1, 4.2]) part(root, new THREE.BoxGeometry(0.06, 0.4, 0.06), iron, Math.cos(a) * 0.3, 0.15, Math.sin(a) * 0.3);
  const fire = part(root, new THREE.ConeGeometry(0.22, 0.35, 6), new THREE.MeshBasicMaterial({ color: 0xff6a00, toneMapped: false }), 0, 0.12, 0);
  return { root, fire };
}

/** Altın sandığı + para yığını */
function buildChest() {
  const root = new THREE.Group();
  const wood = mat('chestWood', 0x7a4a22), gold = mat('goldTrim', 0xd9a63a, { metalness: 0.6 });
  part(root, new THREE.BoxGeometry(0.9, 0.5, 0.6), wood, 0, 0.25, 0);
  const lid = part(root, new THREE.BoxGeometry(0.92, 0.12, 0.62), wood, 0, 0.56, -0.18);
  lid.rotation.x = -0.9;
  part(root, new THREE.BoxGeometry(0.94, 0.06, 0.08), gold, 0, 0.3, 0.3);
  part(root, new THREE.SphereGeometry(0.34, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, 0.45, 0).scale.y = 0.5;
  for (let i = 0; i < 6; i++) part(root, new THREE.CylinderGeometry(0.1, 0.1, 0.04, 8), gold, 0.5 + Math.random() * 0.4, 0.02 + i * 0.04, 0.3 - Math.random() * 0.3);
  return { root };
}

// ============================================================
export class CastleWorks {
  constructor(game, mode) {
    this.game = game;
    this.mode = mode;
    this.castle = mode.castle;
    this.cfg = mode.cfg;
    this.gold = mode.cfg.startGold;
    this.earned = 0;
    this.levels = {};
    this.side = GATE_ANGLE;
    this.guards = [];
    this.archers = [];
    this.catapults = [];
    this.cauldrons = [];
    this.chests = [];
    this.shots = [];
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this._uiKey = '';
    this._buildRoad();
  }

  level(id) { return this.levels[id] || 0; }

  cost(item) {
    const lv = this.level(item.id);
    if (item.costs) return item.costs[lv] ?? Infinity;
    return Math.round(item.cost * Math.pow(item.growth ?? 1, lv));
  }

  canBuy(item) {
    return this.level(item.id) < item.max && this.gold >= this.cost(item);
  }

  addGold(n, show = false) {
    n = Math.round(n);
    this.gold += n;
    this.earned += n;
    if (show) {
      const at = new THREE.Vector3(0, this.castle.towerTopY + 2, 0);
      this.game.floating.spawn(at, `+${n} 🪙`, 'gold');
      this.game.audio.coin();
    }
  }

  onKill(e, pos) {
    const s = this.game.stats;
    const base = this.cfg.goldPer[e.typeId] ?? 2;
    const n = Math.max(1, Math.round(base * s.goldMult * (s.goldBoost ?? 1) * (1 + this.level('hazine') * 0.25)));
    this.addGold(n);
    const at = pos.clone(); at.y += e.height + 2.4;
    this.game.floating.spawn(at, `+${n}🪙`, 'gold');
    if (s.killRepair > 0) this.castle.repair(s.killRepair);
  }

  handleKey(key) {
    const item = SHOP.find((it) => it.key === key);
    if (!item) return false;
    this.buy(item.id);
    return true;
  }

  // ---------------- Satın alma ----------------
  buy(id) {
    const g = this.game;
    const item = SHOP.find((it) => it.id === id);
    if (!item) return false;
    if (!this.canBuy(item)) {
      g.audio.error();
      this.ui?.list.querySelector(`[data-id="${id}"]`)?.classList.add('shake');
      setTimeout(() => this.ui?.list.querySelector(`[data-id="${id}"]`)?.classList.remove('shake'), 300);
      return false;
    }
    this.gold -= this.cost(item);
    const lv = (this.levels[id] = this.level(id) + 1);
    g.audio.build();
    const c = this.castle;
    let title = item.name.toLocaleUpperCase('tr-TR');
    if (id === 'sur') {
      const add = HELPERS.wallHp[lv] ?? 300;
      c.maxHp += add;
      c.hp += add;
      c.setWallLevel(lv);
      this._repositionWallHelpers();
      title = WALL_LEVELS[lv].name.toLocaleUpperCase('tr-TR') + '!';
      for (let i = 0; i < 16; i++) {
        const p = Castle.dir((i / 16) * Math.PI * 2).multiplyScalar(APOTHEM + 1).setY(0.5);
        g.particles.burst(p, [0xb3a994, 0x8a7a65, 0xffffff], 4, { speed: 5, size: 0.35, life: 0.8, up: 0.8 });
      }
      g.sceneMgr.addShake(0.5);
    } else if (id === 'okcu') this._addArcher();
    else if (id === 'muhafiz') this._addGuard();
    else if (id === 'mancinik') this._addCatapult();
    else if (id === 'yag') this._addCauldron();
    else if (id === 'hazine') this._addChest();
    else if (id === 'onarim') {
      c.repair(c.maxHp * 0.3);
      g.particles.ring(c.position, 0x6dff8a, APOTHEM + 1, 0.6);
      title = 'ONARILDI!';
    }
    const at = new THREE.Vector3(0, c.towerTopY + 3.5, 0).addScaledVector(Castle.dir(this.side), 4);
    g.floating.spawn(at, `${item.icon} ${title}`, 'chain');
    this._uiKey = '';
    return true;
  }

  // ---------------- Yol (yaratıkların geldiği tek yön) ----------------
  _buildRoad() {
    const len = 30;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(4.2, len), new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 }));
    road.rotation.x = -Math.PI / 2;
    const holder = new THREE.Group();
    holder.rotation.y = this.side;
    road.position.set(0, 0.025, APOTHEM + 2 + len / 2);
    road.receiveShadow = true;
    holder.add(road);
    // Yol kenarı taşları ve kazıklar
    const stoneGeo = new THREE.DodecahedronGeometry(0.28, 0);
    for (let i = 0; i < 22; i++) {
      for (const sx of [-2.4, 2.4]) {
        const st = new THREE.Mesh(stoneGeo, mat('roadStone', 0x6d665c));
        st.position.set(sx + (Math.random() - 0.5) * 0.4, 0.12, APOTHEM + 3 + i * 1.3);
        st.rotation.set(Math.random(), Math.random(), 0);
        st.scale.setScalar(0.7 + Math.random() * 0.6);
        holder.add(st);
      }
    }
    // Yolun başında uyarı direği
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.4, 6), mat('wood', 0x6a4a2a));
    post.position.set(3.2, 1.2, APOTHEM + 16);
    holder.add(post);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat('bone', 0xe6dfc8));
    skull.position.set(3.2, 2.55, APOTHEM + 16);
    holder.add(skull);
    this.group.add(holder);
    this.road = holder;
  }

  // ---------------- Yardımcılar ----------------
  _addArcher() {
    const taken = new Set(this.archers.map((a) => a.spot));
    const spots = this.castle.towerSpots()
      .map((s, i) => ({ ...s, i, diff: Math.abs(Math.atan2(Math.sin(s.theta - this.side), Math.cos(s.theta - this.side))) }))
      .filter((s) => !taken.has(s.i))
      .sort((a, b) => a.diff - b.diff);
    const s = spots[0];
    if (!s) return;
    this.castle.openTower(s.i); // çatı kalkar, okçu kule tepesinde açıkta durur
    const m = buildArcher();
    m.root.scale.setScalar(1.7);
    this.group.add(m.root);
    this.archers.push({ ...m, spot: s.i, cd: Math.random(), drawT: 0 });
    this._repositionWallHelpers();
    this.game.particles.burst(s.pos.clone(), [0x5cd66a, 0xffffff], 14, { speed: 5, size: 0.2, life: 0.6 });
  }

  _guardPost(i) {
    const d = Castle.dir(this.side), t = Castle.dir(this.side + Math.PI / 2);
    const offs = [[-1.4, 0], [1.4, 0], [-3.3, -0.8], [3.3, -0.8]];
    const [o, r] = offs[i] ?? [0, 0];
    return d.clone().multiplyScalar(APOTHEM + 4.2 + r).addScaledVector(t, o);
  }

  _addGuard() {
    const i = this.guards.length;
    const m = buildGuard();
    const post = this._guardPost(i);
    // Kapıdan çıkıp nöbet yerine yürür
    m.root.position.copy(Castle.dir(this.side).multiplyScalar(APOTHEM + 1.5));
    this.group.add(m.root);
    this.guards.push({ ...m, post, hp: 120, maxHp: 120, alive: true, cd: 0, stab: 0, respawn: 0, flash: 0, t: Math.random() * 5 });
  }

  _addCatapult() {
    const i = this.catapults.length;
    const d = Castle.dir(this.side), t = Castle.dir(this.side + Math.PI / 2);
    const m = buildCatapult();
    m.root.position.copy(d.clone().multiplyScalar(7.6).addScaledVector(t, i === 0 ? 2.8 : -2.8));
    m.root.rotation.y = this.side;
    this.group.add(m.root);
    this.catapults.push({ ...m, cd: 1.5, swing: 0 });
    this.game.particles.burst(m.root.position.clone().setY(1), [0x8a6a4a, 0xffffff], 18, { speed: 6, size: 0.25, life: 0.7 });
  }

  _cauldronSpot(i) {
    const c = this.castle;
    if (i === 0) return Castle.dir(this.side).multiplyScalar(APOTHEM - 0.2).setY(c.wallH + 1.0);
    return c.wallWalkSpot(this.side + (i === 1 ? Math.PI / 4 : -Math.PI / 4), 0);
  }

  _addCauldron() {
    const i = this.cauldrons.length;
    const m = buildCauldron();
    m.root.position.copy(this._cauldronSpot(i));
    this.group.add(m.root);
    this.cauldrons.push({ ...m, i });
  }

  _addChest() {
    const i = this.chests.length;
    const m = buildChest();
    const back = Castle.dir(this.side + Math.PI);
    const t = Castle.dir(this.side + Math.PI / 2);
    m.root.position.copy(back.multiplyScalar(3.4).addScaledVector(t, (i - 1) * 1.3));
    m.root.rotation.y = this.side;
    this.group.add(m.root);
    this.chests.push(m);
    this.game.particles.burst(m.root.position.clone().setY(0.8), [0xffd84a, 0xffffff], 20, { speed: 6, size: 0.2, life: 0.7 });
  }

  _repositionWallHelpers() {
    const spots = this.castle.towerSpots();
    for (const a of this.archers) a.root.position.copy(spots[a.spot].pos);
    for (const k of this.cauldrons) k.root.position.copy(this._cauldronSpot(k.i));
  }

  _enemiesReady() {
    return this.game.enemies.filter((e) => e.alive && e.spawnT >= 1);
  }

  /** Kahramanın yazmakta olduğu ya da büyüsü yolda olan yaratığa yardımcılar dokunmaz */
  static free(e) { return !e.locked && !e.incoming && e.typed === 0; }

  // ---------------- Kare güncellemesi ----------------
  update(dt) {
    const g = this.game, s = g.stats;
    const rate = s.helperRate ?? 1;
    const dmgMult = s.helperDmgMult ?? 1;
    const enemies = this._enemiesReady();
    const c = this.castle;

    if (s.castleRegen > 0 && c.hp > 0) c.repair(s.castleRegen * dt);

    // Okçular
    for (const a of this.archers) {
      a.cd -= dt * rate * (s.archerRate ?? 1);
      a.drawT = Math.max(0, a.drawT - dt);
      a.arm.rotation.x = -a.drawT * 2.2;
      let best = null, bd = HELPERS.okcu.range ** 2;
      for (const e of enemies) {
        if (!CastleWorks.free(e)) continue;
        const d = (e.mesh.position.x - a.root.position.x) ** 2 + (e.mesh.position.z - a.root.position.z) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (best) a.root.rotation.y = Math.atan2(best.mesh.position.x - a.root.position.x, best.mesh.position.z - a.root.position.z);
      if (best && a.cd <= 0) {
        a.cd = HELPERS.okcu.interval;
        a.drawT = 0.3;
        this._shootArrow(a.root.position.clone().setY(a.root.position.y + 1), best, HELPERS.okcu.damage * dmgMult * (s.archerDmg ?? 1));
      }
    }

    // Muhafızlar
    for (const gd of this.guards) this._updateGuard(gd, dt, enemies, rate, dmgMult);

    // Mancınıklar
    for (const k of this.catapults) {
      k.cd -= dt * rate * (s.catapultRate ?? 1);
      if (k.swing > 0) {
        k.swing = Math.max(0, k.swing - dt);
        const f = k.swing > 0.6 ? (0.8 - k.swing) / 0.2 : k.swing / 0.6;
        k.arm.rotation.x = -0.55 + 1.6 * Math.min(1, f);
        k.stone.visible = k.swing < 0.6 && k.swing > 0 ? false : k.cd < HELPERS.mancinik.interval * 0.6;
      } else {
        k.stone.visible = true;
      }
      if (k.cd <= 0) {
        const target = this._densest(enemies, HELPERS.mancinik.range);
        if (target) {
          k.cd = HELPERS.mancinik.interval;
          k.swing = 0.8;
          const from = k.root.position.clone().setY(3.4).addScaledVector(Castle.dir(this.side), 1.2);
          this.shots.push({ kind: 'stone', from, to: target.clone(), t: 0, dur: 1.15, dmg: HELPERS.mancinik.damage * dmgMult, mesh: this._stoneMesh(from) });
          g.audio.thud();
        } else k.cd = 0.5;
      }
    }

    // Kaynar yağ: sura dayananlar haşlanır
    const oil = this.level('yag');
    for (const k of this.cauldrons) {
      k.fire.scale.setScalar(0.8 + Math.random() * 0.4);
      if (Math.random() < dt * 4) g.particles.emit(k.root.position.x, k.root.position.y + 0.8, k.root.position.z, 0xdddddd, (Math.random() - 0.5) * 0.4, 1.2, (Math.random() - 0.5) * 0.4, 0.25, 1, -0.5);
    }
    if (oil > 0) {
      const dps = HELPERS.oilDps[oil] * (s.oilMult ?? 1);
      for (const e of enemies) {
        if (!e.atWall || !CastleWorks.free(e)) continue;
        e.oilAcc = (e.oilAcc || 0) + dps * dt;
        e.oilT = (e.oilT || 0) + dt;
        if (Math.random() < dt * 6) g.particles.emit(e.mesh.position.x, e.height + 0.4, e.mesh.position.z, 0xffa21a, 0, -2, 0, 0.2, 0.4, 6);
        if (e.oilT >= 0.5) {
          const d = e.oilAcc;
          e.oilT = 0; e.oilAcc = 0;
          g.damageEnemy(e, d, { dot: true, helper: true });
        }
      }
    }

    this._updateShots(dt);
    this.updateUI();
  }

  _updateGuard(gd, dt, enemies, rate, dmgMult) {
    const g = this.game;
    const H = HELPERS.muhafiz;
    gd.t += dt;
    if (!gd.alive) {
      gd.respawn -= dt;
      if (gd.respawn <= 0) {
        gd.alive = true;
        gd.hp = gd.maxHp;
        gd.root.visible = true;
        gd.root.position.copy(Castle.dir(this.side).multiplyScalar(APOTHEM + 1.5));
        const at = gd.root.position.clone(); at.y += 2.6;
        g.floating.spawn(at, 'MUHAFIZ GELDİ!', 'heal');
      }
      return;
    }
    gd.flash = Math.max(0, gd.flash - dt * 4);
    gd.mats[0].emissiveIntensity = gd.flash;
    gd.cd -= dt * rate;
    gd.stab = Math.max(0, gd.stab - dt);
    const p = gd.root.position;
    // Nöbet yerine yakın en yakın düşman
    let target = null, bd = H.leash ** 2;
    for (const e of enemies) {
      if (!CastleWorks.free(e)) continue;
      const d = (e.mesh.position.x - gd.post.x) ** 2 + (e.mesh.position.z - gd.post.z) ** 2;
      if (d < bd) { bd = d; target = e; }
    }
    const goal = target ? target.mesh.position : gd.post;
    const dx = goal.x - p.x, dz = goal.z - p.z;
    const dist = Math.hypot(dx, dz);
    const stopAt = target ? H.range + target.radius : 0.15;
    let moving = 0;
    if (dist > stopAt) {
      const step = Math.min(dist - stopAt, H.speed * dt);
      p.x += (dx / dist) * step;
      p.z += (dz / dist) * step;
      moving = 1;
    }
    if (dist > 0.05) gd.root.rotation.y = Math.atan2(dx, dz);
    else gd.root.rotation.y = this.side;
    if (target && dist <= stopAt + 0.2 && gd.cd <= 0 && CastleWorks.free(target)) {
      gd.cd = H.interval;
      gd.stab = 0.25;
      g.damageEnemy(target, H.damage * dmgMult * (g.stats.guardDmg ?? 1), { helper: true });
    }
    // Animasyon: yürüme + mızrak hamlesi
    const sw = Math.sin(gd.t * 10) * moving;
    gd.legs[0].rotation.x = sw * 0.6;
    gd.legs[1].rotation.x = -sw * 0.6;
    gd.arm.position.z = gd.stab > 0 ? Math.sin((gd.stab / 0.25) * Math.PI) * 0.45 : 0;
    gd.arm.rotation.x = target ? -0.15 : 0.1;
    // Yaratıklar muhafızın içinden geçemez; önüne gelen ona vurur
    for (const e of enemies) {
      const ex = e.mesh.position.x - p.x, ez = e.mesh.position.z - p.z;
      const d = Math.hypot(ex, ez) || 0.001;
      const min = e.radius + 0.45;
      if (d < min) {
        e.mesh.position.x = p.x + (ex / d) * min;
        e.mesh.position.z = p.z + (ez / d) * min;
        e.blockedByGuard = gd;
      }
    }
  }

  /** Muhafızla karşılaşan yaratık ona vurur (DefenseMode.afterEnemies çağırır) */
  enemyHitsGuard(e, dt) {
    const gd = e.blockedByGuard;
    e.blockedByGuard = null;
    if (!gd || !gd.alive) return false;
    e.attackCd -= dt;
    if (e.attackCd <= 0) {
      e.attackCd = this.cfg.attackInterval * (0.8 + Math.random() * 0.4);
      e.attackPulse = 1;
      if (!(this.game.stats.guardImmortal > 0)) gd.hp -= e.def.damage * 0.6;
      gd.flash = 1;
      if (gd.hp <= 0) {
        gd.alive = false;
        gd.respawn = 14;
        gd.root.visible = false;
        const at = gd.root.position.clone(); at.y += 1;
        this.game.particles.burst(at, [0x2f6fff, 0x8a9099, 0xffffff], 24, { speed: 8, size: 0.25, life: 0.7 });
        at.y += 1.6;
        this.game.floating.spawn(at, 'MUHAFIZ DÜŞTÜ!', 'miss');
      }
    }
    return true;
  }

  /** En kalabalık yaratık grubunun merkezi */
  _densest(enemies, range) {
    let best = null, bestN = 0;
    for (const e of enemies) {
      if (!CastleWorks.free(e)) continue;
      const r = Math.hypot(e.mesh.position.x, e.mesh.position.z);
      if (r > range) continue;
      let n = 0;
      for (const o of enemies) if (o.mesh.position.distanceToSquared(e.mesh.position) < 9) n++;
      if (n > bestN) { bestN = n; best = e; }
    }
    return best ? best.mesh.position.clone().setY(0) : null;
  }

  _stoneMesh(from) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), mat('rock', 0x7a7670));
    m.position.copy(from);
    m.castShadow = true;
    this.group.add(m);
    return m;
  }

  _shootArrow(from, target, dmg) {
    const m = new THREE.Group();
    part(m, new THREE.CylinderGeometry(0.025, 0.025, 0.9, 4), mat('wood', 0x6a4a2a), 0, 0, 0).rotation.x = Math.PI / 2;
    part(m, new THREE.ConeGeometry(0.06, 0.18, 4), mat('iron', 0x8a9099, { metalness: 0.5 }), 0, 0, 0.5).rotation.x = Math.PI / 2;
    m.position.copy(from);
    this.group.add(m);
    this.shots.push({ kind: 'arrow', mesh: m, target, dmg, life: 2 });
    this.game.audio.arrow();
  }

  _updateShots(dt) {
    const g = this.game;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const sh = this.shots[i];
      let done = false;
      if (sh.kind === 'arrow') {
        sh.life -= dt;
        const t = sh.target;
        const aim = t.alive ? tmp.copy(t.mesh.position).setY(t.height * 0.5) : null;
        if (aim) {
          const d = aim.clone().sub(sh.mesh.position);
          const len = d.length();
          const step = 34 * dt;
          if (len <= step + 0.3) {
            if (CastleWorks.free(t)) g.damageEnemy(t, sh.dmg, { helper: true });
            done = true;
          } else {
            sh.mesh.position.addScaledVector(d, step / len);
            sh.mesh.lookAt(aim);
          }
        } else {
          sh.mesh.position.y -= dt * 10;
          if (sh.mesh.position.y < 0) done = true;
        }
        if (sh.life <= 0) done = true;
      } else {
        sh.t += dt;
        const f = Math.min(1, sh.t / sh.dur);
        sh.mesh.position.lerpVectors(sh.from, sh.to, f);
        sh.mesh.position.y = sh.from.y * (1 - f) + Math.sin(f * Math.PI) * 9;
        sh.mesh.rotation.x += dt * 8;
        if (f >= 1) {
          done = true;
          const R = HELPERS.mancinik.radius;
          g.particles.ring(sh.to, 0xb3a994, R, 0.45);
          g.particles.burst(sh.to.clone().setY(0.4), [0x7a7670, 0x6b5a45, 0xb3a994], 26, { speed: 11, size: 0.3, life: 0.8, up: 0.8 });
          g.sceneMgr.addShake(0.3);
          g.audio.slam(false);
          for (const e of [...g.enemies]) {
            if (e.alive && CastleWorks.free(e) && Math.hypot(e.mesh.position.x - sh.to.x, e.mesh.position.z - sh.to.z) < R + e.radius) {
              g.damageEnemy(e, sh.dmg, { helper: true });
              if (e.alive) { e.knock.x += (e.mesh.position.x - sh.to.x) * 4; e.knock.z += (e.mesh.position.z - sh.to.z) * 4; }
            }
          }
        }
      }
      if (done) {
        this.group.remove(sh.mesh);
        this.shots.splice(i, 1);
      }
    }
  }

  // ---------------- Dükkân arayüzü ----------------
  mountUI(hudEl) {
    const el = document.createElement('div');
    el.id = 'kaleShop';
    el.innerHTML = `
      <div class="ks-head"><span class="ks-gold">🪙 <b>0</b></span><small>Altın · yaratık kes, kazan</small></div>
      <div class="ks-list">${SHOP.map((it) => `
        <button type="button" class="ks-item" data-id="${it.id}">
          <span class="ks-key">${it.key}</span>
          <span class="ks-icon">${it.icon}</span>
          <span class="ks-main"><b>${it.name}</b><small></small><span class="ks-pips"></span></span>
          <span class="ks-cost"></span>
        </button>`).join('')}</div>
      <p class="ks-hint">Tıkla ya da 1–7 tuşuna bas</p>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.ks-item');
      if (!b) return;
      this.buy(b.dataset.id);
      b.blur();
    });
    hudEl.append(el);
    this.ui = { el, gold: el.querySelector('.ks-gold b'), list: el.querySelector('.ks-list') };
    this._uiKey = '';
    this.updateUI();
  }

  updateUI() {
    if (!this.ui) return;
    const key = this.gold + '|' + JSON.stringify(this.levels);
    if (key === this._uiKey) return;
    this._uiKey = key;
    this.ui.gold.textContent = this.gold.toLocaleString('tr-TR');
    for (const it of SHOP) {
      const b = this.ui.list.querySelector(`[data-id="${it.id}"]`);
      const lv = this.level(it.id);
      const maxed = lv >= it.max;
      const cost = this.cost(it);
      b.classList.toggle('maxed', maxed);
      b.classList.toggle('afford', !maxed && this.gold >= cost);
      b.querySelector('.ks-cost').textContent = maxed ? 'TAM' : `${cost}🪙`;
      b.querySelector('small').textContent = maxed ? 'En üst seviye' : it.desc(lv);
      b.title = `${it.name}: ${maxed ? 'En üst seviye' : it.desc(lv)}`;
      b.querySelector('.ks-pips').textContent = it.max === Infinity ? (lv ? `${lv} kez` : '') : '●'.repeat(lv) + '○'.repeat(it.max - lv);
    }
  }

  dispose() {
    this.ui?.el.remove();
    this.game.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}
