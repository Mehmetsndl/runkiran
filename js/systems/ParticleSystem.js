// Tek InstancedMesh ile binlerce küp partikül + genişleyen şok dalgası halkaları
import * as THREE from 'three';

export class ParticleSystem {
  constructor(game, max = 2500) {
    this.game = game;
    this.max = max;
    this.cursor = 0;

    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ toneMapped: false }),
      max
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.spin = new Float32Array(max);

    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.color.set(0xffffff));
    }
    game.scene.add(this.mesh);

    // Şok dalgası halkaları
    this.rings = [];
    this.ringCursor = 0;
    const ringGeo = new THREE.RingGeometry(0.82, 1, 48);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
      }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      game.scene.add(m);
      this.rings.push({ mesh: m, life: 0, maxLife: 1, radius: 1 });
    }
  }

  emit(x, y, z, color, vx, vy, vz, size, life, grav) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.life[i] = this.maxLife[i] = life;
    this.size[i] = size;
    this.grav[i] = grav;
    this.spin[i] = (Math.random() * 2 - 1) * 14;
    this.mesh.setColorAt(i, this.color.set(color));
    this.colorDirty = true;
  }

  /** Patlama: rastgele yönlere saçılan küpler */
  burst(p, color, count, o = {}) {
    const speed = o.speed ?? 8, size = o.size ?? 0.25, life = o.life ?? 0.7, grav = o.gravity ?? -22, up = o.up ?? 0.5;
    const y = p.y ?? 0.5;
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      const h = 0.5 + Math.random() * 0.5;
      const c = Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color;
      this.emit(
        p.x, y, p.z, c,
        Math.cos(a) * s * h, s * (up + Math.random() * (1 - up)), Math.sin(a) * s * h,
        size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), grav
      );
    }
  }

  /** Mermi izi */
  trail(p, color) {
    this.emit(
      p.x + (Math.random() - 0.5) * 0.2, p.y, p.z + (Math.random() - 0.5) * 0.2, color,
      (Math.random() - 0.5), Math.random(), (Math.random() - 0.5),
      0.16, 0.25, 0
    );
  }

  /** Yerde genişleyen şok dalgası */
  ring(p, color, radius = 4, life = 0.45) {
    const r = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % this.rings.length;
    r.mesh.material.color.set(color);
    r.mesh.position.set(p.x, 0.08, p.z);
    r.mesh.visible = true;
    r.life = r.maxLife = life;
    r.radius = radius;
  }

  update(dt) {
    const d = this.dummy;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        d.position.set(0, -100, 0);
        d.scale.setScalar(0);
        d.updateMatrix();
        this.mesh.setMatrixAt(i, d.matrix);
        continue;
      }
      const i3 = i * 3;
      this.vel[i3 + 1] += this.grav[i] * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.05) { // zemine sekme
        this.pos[i3 + 1] = 0.05;
        this.vel[i3 + 1] *= -0.4;
        this.vel[i3] *= 0.7;
        this.vel[i3 + 2] *= 0.7;
      }
      const k = this.life[i] / this.maxLife[i];
      const age = this.maxLife[i] - this.life[i];
      d.position.set(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2]);
      d.rotation.set(age * this.spin[i], age * this.spin[i] * 0.7, 0);
      d.scale.setScalar(this.size[i] * Math.sqrt(k));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.colorDirty) {
      this.mesh.instanceColor.needsUpdate = true;
      this.colorDirty = false;
    }

    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      if (r.life <= 0) { r.mesh.visible = false; continue; }
      const t = 1 - r.life / r.maxLife;
      r.mesh.scale.setScalar(r.radius * (1 - Math.pow(1 - t, 3)));
      r.mesh.material.opacity = (1 - t) * 0.9;
    }
  }
}
