// Oyuncu karakteri: modeli seçilen karaktere göre kurulur, tamamen fare ile hareket eder.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { lerpAngle } from '../utils.js';
import { buildPlayerModel } from './PlayerModels.js';
import { poseArms, poseEnvelope } from './poses.js';

export class Player {
  constructor(game, character) {
    this.game = game;
    this.mesh = new THREE.Group();
    game.scene.add(this.mesh);

    // Zemindeki halkalar
    const ringMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    this.pickupRing = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), ringMat(0x7fe3ff, 0.18));
    this.pickupRing.rotation.x = -Math.PI / 2;
    this.pickupRing.position.y = 0.03;
    this.aura = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.2, 6), ringMat(0x9fe8ff, 0.25));
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.position.y = 0.04;
    this.aura.visible = false;
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24), ringMat(0xffd84a, 0.9));
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.05;
    this.marker.visible = false;
    game.scene.add(this.pickupRing, this.aura, this.marker);

    this.hp = CONFIG.PLAYER.maxHp;
    this.velocity = new THREE.Vector3();
    this.facing = 0;
    this.invuln = 0;
    this.hurtFlash = 0;
    this.attackType = null;
    this.attackT = 0;
    this.attackDur = 1;
    this.clickTarget = null;
    this.dash = null;    // Şövalye atılması
    this.spinT = 0;      // dönerek kesme animasyonu
    this.t = 0;
    this._tmp = new THREE.Vector3();
    this._desired = new THREE.Vector3();

    this.setCharacter(character);
  }

  get position() { return this.mesh.position; }

  /** Karakter modelini değiştir (seçim ekranından sonra) */
  setCharacter(character) {
    if (this.model) this.mesh.remove(this.model.root);
    this.character = character;
    this.model = buildPlayerModel(character);
    this.parts = this.model.parts;
    this.height = this.model.height;
    this.radius = character.radius ?? CONFIG.PLAYER.radius;
    this.mesh.add(this.model.root);
  }

  update(dt) {
    const { input, stats, moveMode } = this.game;
    const pos = this.mesh.position;
    this.t += dt;

    // --- Fare ile hedef belirleme ---
    let target = null;
    let stopDist = CONFIG.MOVE.arriveDist;
    if (moveMode === 'follow') {
      if (input.hasPointer) target = input.groundPoint;
      stopDist = CONFIG.MOVE.deadZone;
    } else {
      if (input.mouseDown && input.hasPointer) this.clickTarget = input.groundPoint.clone();
      target = this.clickTarget;
    }

    // Atılma: normal hareketi devre dışı bırakır
    if (this.dash) {
      this._updateDash(dt);
      this._animate(dt, 0, stats.moveSpeed);
      this._updateRings(dt, stats, moveMode);
      return;
    }

    this._desired.set(0, 0, 0);
    // Kale Savunması: kahraman burcun tepesinde sabit durur, yalnızca imlece döner
    if (this.anchor) {
      target = null;
      pos.copy(this.anchor);
      this.velocity.set(0, 0, 0);
      if (input.hasPointer) {
        const dx = input.groundPoint.x - pos.x, dz = input.groundPoint.z - pos.z;
        if (dx * dx + dz * dz > 1) this.facing = Math.atan2(dx, dz);
      }
    }
    if (target) {
      const d = this._tmp.subVectors(target, pos);
      d.y = 0;
      const dist = d.length();
      if (dist > stopDist) {
        const k = Math.min(1, (dist - stopDist) / 1.5 + 0.35);
        this._desired.copy(d).multiplyScalar((stats.moveSpeed * k) / dist);
      } else if (moveMode === 'click') {
        this.clickTarget = null;
      }
    }
    // Ağır karakterler (Tepegöz) daha geç hızlanır
    const accel = stats.moveSpeed < 6 ? 5 : 12;
    // Tepegöz topuzu kaldırırken neredeyse durur
    if (this.attackType === 'slam' && this.attackT > 0) this._desired.multiplyScalar(0.15);
    this.velocity.lerp(this._desired, 1 - Math.exp(-dt * accel));
    if (!this.anchor) pos.addScaledVector(this.velocity, dt);
    const lim = CONFIG.ARENA_SIZE / 2 - 1.5;
    pos.x = Math.max(-lim, Math.min(lim, pos.x));
    pos.z = Math.max(-lim, Math.min(lim, pos.z));

    const speed = this.velocity.length();
    if (speed > 0.4) this.facing = Math.atan2(this.velocity.x, this.velocity.z);
    this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, this.facing, 1 - Math.exp(-dt * 14));

    this._animate(dt, speed, stats.moveSpeed);

    if (stats.regen > 0 && this.hp > 0) this.heal(stats.regen * dt);
    if (this.parts.halo) this.parts.halo.rotation.z += dt * 1.5;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 4);
    for (const m of this.model.mats) m.emissiveIntensity = this.hurtFlash * 1.2;
    this.mesh.visible = this.invuln <= 0 || Math.floor(this.t * 20) % 2 === 0;
    this._updateRings(dt, stats, moveMode);
  }

  _updateRings(dt, stats, moveMode) {
    const pos = this.mesh.position;
    // --- Zemin halkaları ---
    this.pickupRing.position.set(pos.x, pos.y + 0.05, pos.z);
    this.pickupRing.visible = !this.anchor;
    this.pickupRing.scale.setScalar(stats.pickupRadius);
    this.aura.visible = stats.enemySpeedMult < 1;
    this.aura.position.set(pos.x, pos.y + 0.06, pos.z);
    this.aura.rotation.z += dt * 0.6;

    this.marker.visible = moveMode === 'click' && !!this.clickTarget;
    if (this.marker.visible) {
      this.marker.position.x = this.clickTarget.x;
      this.marker.position.z = this.clickTarget.z;
      this.marker.scale.setScalar(1 + Math.sin(this.t * 10) * 0.15);
    }
  }

  _animate(dt, speed, maxSpeed) {
    const p = this.parts;
    const moving = Math.min(1, speed / Math.max(1, maxSpeed));
    const heavy = this.character.model === 'cyclops';
    const freq = heavy ? 6 : 11;
    const swing = Math.sin(this.t * freq) * moving;

    if (p.legL) p.legL.rotation.x = swing * 0.7;
    if (p.legR) p.legR.rotation.x = -swing * 0.7;
    let armL = -swing * 0.5;
    let armR = swing * 0.5;
    let torsoX = 0;
    const bob = Math.abs(Math.sin(this.t * freq)) * moving * (heavy ? 0.18 : 0.08);
    this.model.root.position.y = bob;
    // Dev yürürken iki yana yalpalar
    this.model.root.rotation.z = Math.sin(this.t * freq) * moving * (heavy ? 0.07 : 0.03);

    // --- Saldırı pozları ---
    if (this.attackT > 0) {
      this.attackT = Math.max(0, this.attackT - dt);
      const e = this.attackDur - this.attackT; // geçen süre
      if (this.attackType === 'slam') {
        const windup = this.character.slam?.windup ?? 0.28;
        if (e < windup) {
          const k = e / windup;
          armL = armR = -2.9 * k;
          torsoX = -0.25 * k;
        } else {
          const k = Math.min(1, (e - windup) / 0.07);
          armL = armR = -2.9 + 3.6 * k;
          torsoX = -0.25 + 0.6 * k;
        }
      } else if (this.attackType === 'arrow') {
        const k = Math.sin(Math.min(1, e / this.attackDur) * Math.PI);
        armL = -1.55 * Math.max(k, 0.6);
        armR = -1.3 * k;
      } else {
        const k = Math.sin(Math.min(1, e / this.attackDur) * Math.PI);
        armR = -1.6 * k;
      }
    }
    // Yetenek pozu (ultiler): kolları ve gövdeyi geçersiz kılar
    let armLz = 0, armRz = 0;
    if (this.pose) {
      this.pose.t -= dt;
      if (this.pose.t <= 0) this.pose = null;
      else {
        const k = poseEnvelope(this.pose.t, this.pose.dur);
        const a = poseArms(this.pose.type, k, this.pose.dur - this.pose.t);
        if (a) {
          if (a.armL != null) armL = armL * (1 - k) + a.armL;
          if (a.armR != null) armR = armR * (1 - k) + a.armR;
          armLz = a.armLz ?? 0;
          armRz = a.armRz ?? 0;
          torsoX = torsoX * (1 - k) + (a.torsoX ?? 0);
        }
      }
    }
    if (p.armL) p.armL.rotation.z = armLz;
    if (p.armR) p.armR.rotation.z = armRz;
    if (p.armL) p.armL.rotation.x = armL;
    if (p.armR) p.armR.rotation.x = armR;
    if (p.torso) p.torso.rotation.x = torsoX;
    // Şövalye dönerek kesme (ultide sürekli döner)
    if (this.whirl) {
      this.model.root.rotation.y += dt * 22;
      if (p.armR) { p.armR.rotation.x = -1.5; p.armR.rotation.z = -0.4; }
    } else if (this.spinT > 0) {
      this.spinT = Math.max(0, this.spinT - dt);
      this.model.root.rotation.y = (1 - this.spinT / 0.32) * Math.PI * 2;
      if (p.armR) p.armR.rotation.x = -1.5;
      if (p.armR) p.armR.rotation.z = -0.4;
    } else {
      this.model.root.rotation.y = 0;
    }
    if (this.dash && p.armR) p.armR.rotation.x = -1.2;
    if (p.cape) p.cape.rotation.x = 0.12 + moving * 0.35 + (this.dash ? 0.6 : 0);
    if (p.orb) p.orb.scale.setScalar(1 + (this.attackType === 'bolt' ? this.attackT * 3 : 0));
    if (p.head && !heavy) p.head.rotation.y = Math.sin(this.t * 0.9) * 0.15;
  }

  /** Şövalye: hedefe doğru atıl, varınca onArrive çağrılır */
  startDash(to, speed, onArrive) {
    const from = this.mesh.position.clone();
    const dist = from.distanceTo(to);
    this.dash = { from, to: to.clone(), t: 0, dur: Math.min(0.32, Math.max(0.07, dist / speed)), onArrive };
    this.facing = Math.atan2(to.x - from.x, to.z - from.z);
    this.mesh.rotation.y = this.facing;
    this.velocity.set(0, 0, 0);
  }

  _updateDash(dt) {
    const d = this.dash;
    d.t += dt;
    const k = Math.min(1, d.t / d.dur);
    const e = 1 - (1 - k) * (1 - k);
    this.mesh.position.lerpVectors(d.from, d.to, e);
    const lim = CONFIG.ARENA_SIZE / 2 - 1.5;
    this.mesh.position.x = Math.max(-lim, Math.min(lim, this.mesh.position.x));
    this.mesh.position.z = Math.max(-lim, Math.min(lim, this.mesh.position.z));
    this.model.root.rotation.x = 0.35; // öne eğik hücum pozu
    const p = this.mesh.position;
    this.game.particles.emit(p.x, 1 + Math.random(), p.z, this.character.color === '#d9e1ea' ? 0xd9e1ea : 0xffffff,
      (Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2, 0.22, 0.3, 0);
    if (k >= 1) {
      this.model.root.rotation.x = 0;
      const cb = d.onArrive;
      this.dash = null;
      this.spinT = 0.32;
      cb?.();
    }
  }

  /** Yetenek pozu başlat (ör. 'raise' = iki el göğe) */
  setPose(type, dur) {
    this.pose = { type, t: dur, dur };
  }

  /** Saldırı animasyonunu başlat */
  attack(type) {
    this.attackType = type;
    this.attackDur = type === 'slam' ? (this.character.slam?.windup ?? 0.28) + 0.3 : type === 'dash' ? 0 : 0.3;
    this.attackT = this.attackDur;
  }

  castPointWorld(out = new THREE.Vector3()) {
    this.mesh.updateMatrixWorld(true);
    return (this.parts.castPoint ?? this.mesh).getWorldPosition(out);
  }

  /** Zırh uygulanmış hasarı döndürür, dokunulmazsa false */
  takeDamage(amount) {
    if (this.invuln > 0 || this.dash || this.spinT > 0 || this.ultInvuln > 0) return false;
    const dealt = Math.max(1, Math.round(amount * (1 - (this.game.stats.armor || 0))));
    this.hp -= dealt;
    this.invuln = CONFIG.PLAYER.invulnTime;
    this.hurtFlash = 1;
    return dealt;
  }

  heal(amount) {
    this.hp = Math.min(this.game.stats.maxHp, this.hp + amount);
  }
}
