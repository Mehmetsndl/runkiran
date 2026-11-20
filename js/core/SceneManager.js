// Sahne, izometrik ortografik kamera, ışıklar, arena ve ekran sarsıntısı
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { seeded } from '../utils.js';

export class SceneManager {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x120f18);

    const v = CONFIG.CAMERA.viewSize;
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(-v * aspect, v * aspect, v, -v, 0.1, 400);
    this.camOffset = new THREE.Vector3(...CONFIG.CAMERA.offset);
    this.camFocus = new THREE.Vector3();
    this.camera.position.copy(this.camOffset);
    this.camera.lookAt(0, 0, 0);

    this.shake = 0;
    this.zoomPunch = 0;
    this.shakeVec = new THREE.Vector3();
    this._look = new THREE.Vector3();

    this.decor = [];
    this.viewSize = CONFIG.CAMERA.viewSize;
    this._setupLights();
    this._buildArena();
    window.addEventListener('resize', () => this.resize());
  }

  _setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xa8b8ff, 0x2a1d14, 1.1));
    const sun = new THREE.DirectionalLight(0xffdcae, 2.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -32; c.right = 32; c.top = 32; c.bottom = -32; c.near = 1; c.far = 120;
    sun.shadow.bias = -0.0006;
    this.sun = sun;
    this.sunOffset = new THREE.Vector3(14, 30, 8);
    this.scene.add(sun, sun.target);
  }

  _groundTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#2b2925';
    g.fillRect(0, 0, 256, 256);
    const r = seeded(7);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const s = 52 + r() * 16;
        g.fillStyle = `rgb(${s},${s - 3},${s - 9})`;
        g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
      }
    }
    for (let k = 0; k < 900; k++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.18})`;
      g.fillRect(r() * 256, r() * 256, 2, 2);
    }
    for (let k = 0; k < 40; k++) {
      g.fillStyle = `rgba(70,110,50,${0.25 + r() * 0.3})`; // yosun
      g.beginPath();
      g.arc(r() * 256, r() * 256, 2 + r() * 6, 0, Math.PI * 2);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(CONFIG.ARENA_SIZE / 8, CONFIG.ARENA_SIZE / 8);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  _buildArena() {
    const size = CONFIG.ARENA_SIZE;
    const half = size / 2;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ map: this._groundTexture(), roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Surlar ve köşe kuleleri
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4540, roughness: 0.9 });
    const wallGeo = new THREE.BoxGeometry(size + 2, 3, 2);
    for (let i = 0; i < 4; i++) {
      const w = new THREE.Mesh(wallGeo, wallMat);
      const a = (i * Math.PI) / 2;
      w.position.set(Math.sin(a) * (half + 1), 1.5, Math.cos(a) * (half + 1));
      w.rotation.y = a;
      w.castShadow = w.receiveShadow = true;
      this.scene.add(w);
    }
    const towerGeo = new THREE.CylinderGeometry(3, 3.4, 7, 10);
    const roofGeo = new THREE.ConeGeometry(3.6, 3, 10);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b2222 });
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const t = new THREE.Mesh(towerGeo, wallMat);
      t.position.set(x * (half + 1), 3.5, z * (half + 1));
      t.castShadow = true;
      const r = new THREE.Mesh(roofGeo, roofMat);
      r.position.set(x * (half + 1), 8.5, z * (half + 1));
      this.scene.add(t, r);
    }

    // Dekor: ağaçlar, kayalar, mezar taşları (çarpışmasız)
    const rnd = seeded(1234);
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.2, 6);
    const leafGeo = new THREE.ConeGeometry(1.2, 2.6, 7);
    const rockGeo = new THREE.DodecahedronGeometry(0.8, 0);
    const graveGeo = new THREE.BoxGeometry(0.7, 1.0, 0.25);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3222 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f4d2b, flatShading: true });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5d5d63, flatShading: true });
    const graveMat = new THREE.MeshStandardMaterial({ color: 0x77736b });

    for (let i = 0; i < 160; i++) {
      const x = (rnd() - 0.5) * (size - 6);
      const z = (rnd() - 0.5) * (size - 6);
      if (Math.hypot(x, z) < 9) continue;
      const kind = rnd();
      const s = 0.7 + rnd() * 0.8;
      if (kind < 0.45) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.6;
        const leaves = new THREE.Mesh(leafGeo, leafMat);
        leaves.position.y = 2.3;
        trunk.castShadow = leaves.castShadow = true;
        tree.add(trunk, leaves);
        tree.position.set(x, 0, z);
        tree.scale.setScalar(s);
        this.scene.add(tree);
        this.decor.push(tree);
      } else if (kind < 0.8) {
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(x, 0.3 * s, z);
        rock.scale.set(s, s * 0.6, s);
        rock.rotation.y = rnd() * 6;
        rock.castShadow = rock.receiveShadow = true;
        this.scene.add(rock);
        this.decor.push(rock);
      } else {
        const grave = new THREE.Mesh(graveGeo, graveMat);
        grave.position.set(x, 0.5, z);
        grave.rotation.set((rnd() - 0.5) * 0.3, rnd() * 6, (rnd() - 0.5) * 0.2);
        grave.castShadow = true;
        this.scene.add(grave);
        this.decor.push(grave);
      }
    }
  }

  /** Belli bir yarıçap içindeki dekorları gizle (ör. kale alanı); 0 = hepsini geri getir */
  clearDecor(radius = 0) {
    for (const d of this.decor) d.visible = Math.hypot(d.position.x, d.position.z) >= radius;
  }

  /** Kamera görüş alanı (yarı yükseklik, dünya birimi) */
  setViewSize(v) {
    this.viewSize = v;
    this.resize();
  }

  /** Ekran sarsıntısı ekle (0..1) */
  addShake(amount) {
    this.shake = Math.min(1, this.shake + amount);
  }

  /** Kısa yakınlaştırma darbesi */
  punch(amount) {
    this.zoomPunch = Math.min(0.25, this.zoomPunch + amount);
  }

  update(dt, focus) {
    this.camFocus.lerp(focus, 1 - Math.exp(-dt * 8));
    this.shake = Math.max(0, this.shake - dt * CONFIG.FX.shakeDecay);
    const s = this.shake * this.shake * CONFIG.FX.shakeMax;
    this.shakeVec.set((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s * 0.5, (Math.random() * 2 - 1) * s);

    this.camera.position.copy(this.camFocus).add(this.camOffset).add(this.shakeVec);
    this._look.copy(this.camFocus).add(this.shakeVec);
    this.camera.lookAt(this._look);

    this.zoomPunch = Math.max(0, this.zoomPunch - dt * 0.8);
    this.camera.zoom = 1 + this.zoomPunch;
    this.camera.updateProjectionMatrix();

    this.sun.position.copy(this.camFocus).add(this.sunOffset);
    this.sun.target.position.copy(this.camFocus);
  }

  resize() {
    const v = this.viewSize;
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = -v * aspect;
    this.camera.right = v * aspect;
    this.camera.top = v;
    this.camera.bottom = -v;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
