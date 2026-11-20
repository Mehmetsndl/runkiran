// Düşman: eklemli low-poly yaratık modeli + üzerinde yazılacak kelime
import * as THREE from 'three';
import { easeOutBack } from '../utils.js';
import { buildEnemyModel } from './EnemyModels.js';

export class Enemy {
  constructor(game, typeId, def, word, position, hpScale) {
    this.game = game;
    this.typeId = typeId;
    this.def = def;
    this.word = word;
    this.typed = 0;          // Doğru yazılmış harf sayısı
    this.locked = false;     // Oyuncu bu düşmana kilitli mi
    this.incoming = false;   // Üzerine büyü uçuyor mu
    this.alive = true;

    this.maxHp = def.hp * hpScale;
    this.hp = this.maxHp;
    this.speed = def.speed * (0.9 + Math.random() * 0.2);
    this.flash = 0;
    this.knock = new THREE.Vector3();
    this.spawnT = 0;
    this.t = Math.random() * 10;
    this.attackPulse = 0;   // kaleye/oyuncuya vuruş animasyonu
    this.stunT = 0;         // sersemleme (Deprem ultisi)
    this.attackCd = 0;

    this.model = buildEnemyModel(def);
    this.parts = this.model.parts;
    this.height = this.model.height;
    this.radius = def.radius * (def.scale ?? 1);
    this.baseScale = def.scale ?? 1;
    this.torsoBaseX = this.parts.torso?.rotation.x ?? 0;
    this.fly = (def.fly ?? 0) * this.baseScale;   // uçanlar yerden bu kadar yüksekte süzülür
    this.height += this.fly;
    this.moveMult = 1;      // boss yetenekleri: 0 = dur, >1 = hızlan
    this.override = null;   // { x, z } sabit yönlü hamle (Trol saldırısı)
    this.castT = 0;         // büyü / nefes hazırlığı (kollar kalkar, ağız açılır)

    const group = new THREE.Group();
    group.add(this.model.root);
    group.position.copy(position);
    group.scale.setScalar(0.01);
    this.mesh = group;
    game.scene.add(group);
  }

  get position() { return this.mesh.position; }

  /** targetPos: yürüdüğü hedef (oyuncu ya da kale) */
  update(dt, playerPos, speedMult) {
    this.t += dt;
    this.spawnT = Math.min(1, this.spawnT + dt * 2.5);
    this.mesh.scale.setScalar(Math.max(0.01, easeOutBack(this.spawnT)));

    // Boss Avı istemcisi: bu bossun konumu host'tan gelir, yumuşakça takip et
    if (this.net) {
      const pos = this.mesh.position;
      const k = 1 - Math.exp(-dt * 9);
      const vx = this.net.x - pos.x, vz = this.net.z - pos.z;
      pos.x += vx * k; pos.z += vz * k;
      let d = this.net.ry - this.mesh.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.mesh.rotation.y += d * k;
      this.knock.set(0, 0, 0);
      this._animate(dt, Math.min(8, Math.hypot(vx, vz) * 4));
      return;
    }

    const pos = this.mesh.position;
    const dx = playerPos.x - pos.x;
    const dz = playerPos.z - pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    if (this.stunT > 0) this.stunT -= dt;
    const stunned = this.stunT > 0;
    let sp = stunned ? 0 : this.speed * speedMult * (this.spawnT < 1 ? 0.3 : 1) * this.moveMult;
    // Uzaktan saldıranlar mesafeyi korur
    let dir = 1;
    if (this.def.keepDist && dist < this.def.keepDist) dir = dist < this.def.keepDist * 0.7 ? -0.6 : 0;
    if (this.override && !stunned) {
      pos.x += this.override.x * dt + this.knock.x * dt;
      pos.z += this.override.z * dt + this.knock.z * dt;
      sp = Math.hypot(this.override.x, this.override.z) * 0.5;
    } else {
      pos.x += (dx / dist) * sp * dir * dt + this.knock.x * dt;
      pos.z += (dz / dist) * sp * dir * dt + this.knock.z * dt;
      if (dir === 0) sp *= 0.25;
    }
    this.knock.multiplyScalar(Math.exp(-dt * 8));
    if (!stunned) { this.mesh.rotation.y = Math.atan2(dx, dz); this.model.root.rotation.z = 0; }
    else this.model.root.rotation.z = Math.sin(this.t * 18) * 0.12; // sersem sallanma

    this._animate(dt, sp);
  }

  _animate(dt, sp) {
    const anim = this.def.anim;
    if (anim === 'quad') this._animQuad(dt, sp);
    else if (anim === 'fly') this._animFly(dt, sp);
    else if (anim === 'float') this._animFloat(dt, sp);
    else this._animBiped(dt, sp);
    if (this.castT > 0) this.castT = Math.max(0, this.castT - dt);
    // Vuruş anında ezilip beyaz parlama
    this.flash = Math.max(0, this.flash - dt * 6);
    const s = this.baseScale;
    this.model.root.scale.set(s * (1 + this.flash * 0.22), s * (1 - this.flash * 0.28), s * (1 + this.flash * 0.22));
    this.model.root.rotation.x = -this.flash * 0.35; // geriye savrulma
    for (const m of this.model.mats) m.emissiveIntensity = this.flash * 1.1;
  }

  /** Dört ayaklı koşu (Kurt) */
  _animQuad(dt, sp) {
    const p = this.parts;
    const ph = this.t * (4 + sp * 2.4);
    const a = Math.sin(ph) * Math.min(1, sp / 2) * 0.9;
    if (p.legFL) { p.legFL.rotation.x = a; p.legBR.rotation.x = a; p.legFR.rotation.x = -a; p.legBL.rotation.x = -a; }
    if (p.body) p.body.position.y = Math.abs(Math.sin(ph)) * 0.08;
    if (p.torso) p.torso.rotation.x = Math.sin(ph * 2) * 0.05;
    if (p.tail) p.tail.rotation.y = Math.sin(this.t * 9) * 0.5;
    if (p.head) p.head.rotation.x = Math.sin(ph) * 0.1 - this.attackPulse * 0.4;
    if (p.jaw) p.jaw.rotation.x = 0.1 + Math.max(0, Math.sin(this.t * 6)) * 0.25 + this.attackPulse * 0.6;
    this.attackPulse = Math.max(0, this.attackPulse - dt * 3);
  }

  /** Kanat çırpan uçan ejderha */
  _animFly(dt, sp) {
    const p = this.parts;
    const king = this.def.king;
    const flap = Math.sin(this.t * (king ? 4.2 : 7.5));
    const bob = Math.sin(this.t * (king ? 2.1 : 3.7));
    this.model.root.position.y = this.fly + bob * 0.25 * this.baseScale - (flap > 0 ? 0 : flap * 0.08);
    if (p.wingL) { p.wingL.rotation.z = flap * 0.75; p.wingR.rotation.z = -flap * 0.75; }
    if (p.wingL) { p.wingL.rotation.y = Math.cos(this.t * 4) * 0.1; p.wingR.rotation.y = -p.wingL.rotation.y; }
    for (let i = 0; i < 4; i++) {
      const t = p[`tail${i}`];
      if (t) { t.rotation.y = Math.sin(this.t * 3 - i * 0.7) * 0.25; t.rotation.x = Math.sin(this.t * 2 - i) * 0.12; }
    }
    if (p.torso) p.torso.rotation.x = -0.12 + flap * 0.04;
    const cast = this.castT > 0 ? 1 : 0;
    if (p.neck) p.neck.rotation.x = -0.7 + Math.sin(this.t * 2.3) * 0.08 - cast * 0.35 + this.attackPulse * 0.5;
    if (p.head) p.head.rotation.x = 0.75 + cast * 0.2 - this.attackPulse * 0.3;
    if (p.jaw) p.jaw.rotation.x = 0.08 + cast * 0.55 + this.attackPulse * 0.7 + Math.max(0, Math.sin(this.t * 3)) * 0.1;
    for (const n of ['legL', 'legR', 'armL', 'armR']) if (p[n]) p[n].rotation.x = 0.7 + Math.sin(this.t * 2 + n.length) * 0.1;
    this.attackPulse = Math.max(0, this.attackPulse - dt * 2.5);
  }

  /** Süzülen büyücü (Kemik Lordu) */
  _animFloat(dt) {
    const p = this.parts;
    this.model.root.position.y = 0.25 + Math.sin(this.t * 2) * 0.12;
    const cast = this.castT > 0 ? 1 : 0;
    if (p.armL) p.armL.rotation.x = -0.3 - cast * 2.3 + Math.sin(this.t * 1.5) * 0.1;
    if (p.armR) p.armR.rotation.x = -0.5 - cast * 2.0 - this.attackPulse * 1.5;
    if (p.armL) p.armL.rotation.z = -cast * 0.4;
    if (p.cape) p.cape.rotation.z = Math.sin(this.t * 1.7) * 0.06;
    if (p.halo) { p.halo.rotation.y += dt * (cast ? 6 : 1.4); p.halo.position.y = 1.0 + cast * 0.6; }
    if (p.orb) p.orb.scale.setScalar(1 + Math.sin(this.t * 6) * 0.15 + cast * 0.6);
    if (p.head) p.head.rotation.y = Math.sin(this.t * 1.1) * 0.3;
    if (p.jaw) p.jaw.rotation.x = 0.1 + cast * 0.4 + Math.max(0, Math.sin(this.t * 9)) * 0.1 * cast;
    this.attackPulse = Math.max(0, this.attackPulse - dt * 3);
  }

  _animBiped(dt, sp) {
    const p = this.parts;
    const phase = this.t * (2 + sp * 2.2);
    const swing = Math.sin(phase);
    const stride = Math.min(1, sp / 2) * 0.7;

    if (p.legL) p.legL.rotation.x = swing * stride;
    if (p.legR) p.legR.rotation.x = -swing * stride;
    if (p.armL) p.armL.rotation.x = -swing * stride * 0.8;
    // Sağ kol silahı tutar: ileri doğru sallanan saldırı pozu
    if (p.armR) p.armR.rotation.x = -0.6 + swing * stride * 0.5 + Math.sin(this.t * 3) * 0.1;
    if (this.attackPulse > 0) {
      this.attackPulse = Math.max(0, this.attackPulse - dt * 3);
      if (p.armR) p.armR.rotation.x = -2.4 * Math.sin(this.attackPulse * Math.PI);
      if (p.torso) p.torso.rotation.x = this.torsoBaseX + 0.3 * Math.sin(this.attackPulse * Math.PI);
    }
    if (p.body) p.body.position.y = Math.abs(swing) * 0.06 * this.height * stride;
    if (p.torso) p.torso.rotation.z = swing * 0.06;
    if (p.head) p.head.rotation.y = Math.sin(this.t * 1.7) * 0.25;
    if (p.jaw) p.jaw.rotation.x = 0.15 + Math.max(0, Math.sin(this.t * (this.typeId === 'iskelet' ? 14 : 4))) * 0.25;
    if (p.cape) p.cape.rotation.x = 0.15 + Math.abs(swing) * 0.25;
    if (p.tail) p.tail.rotation.y = Math.sin(this.t * 10) * 0.5;
    if (p.wingL) { const f = Math.sin(this.t * 22) * 0.5; p.wingL.rotation.z = f; p.wingR.rotation.z = -f; }
    // Hazırlık (Trol hamlesi): sopayı kaldırır
    if (this.castT > 0 && p.armR) { p.armR.rotation.x = -2.6; if (p.torso) p.torso.rotation.x = this.torsoBaseX - 0.25; }
  }

  dispose() {
    this.game.scene.remove(this.mesh);
    for (const m of this.model.mats) m.dispose();
    for (const m of this.model.extraMats) m.dispose();
  }
}
