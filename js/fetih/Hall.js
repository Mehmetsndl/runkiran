// ============================================================
//  SALON: taş duvarlar, sütunlar, mumlar, ahşap masa ve küçük kale modeli
//  (Hükümdar Masası sahnesinin ortak parçaları)
// ============================================================
import * as THREE from 'three';
import { SEAT_COLORS } from '../data/fetih.js';

export const TABLE_Y = 1.85;

export function woodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#6a4424';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#62401f' : '#704a28';
    g.fillRect(0, i * 32, 512, 30);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, i * 32 + 30, 512, 2);
  }
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(30,15,5,${Math.random() * 0.25})`;
    g.beginPath();
    const y = Math.random() * 512;
    g.moveTo(0, y);
    g.bezierCurveTo(170, y + Math.random() * 8 - 4, 340, y + Math.random() * 8 - 4, 512, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2622';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const s = 36 + Math.random() * 14;
    g.fillStyle = `rgb(${s},${s - 4},${s - 8})`;
    g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 14);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Küçük kale (oyuncu rengi çatılar) */
export function buildMiniCastle(color) {
  const root = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xa49c8c, roughness: 0.9, flatShading: true, emissive: 0xff2200, emissiveIntensity: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x6f685e, roughness: 0.95, flatShading: true });
  const roof = new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true });
  const add = (geo, mat, x, y, z, parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  add(new THREE.CylinderGeometry(1.9, 2.1, 0.25, 8), dark, 0, 0.12, 0);
  // Alçak surlar
  for (let i = 0; i < 4; i++) {
    const w = add(new THREE.BoxGeometry(2.6, 0.7, 0.25), stone, 0, 0.55, 1.35);
    w.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), (i * Math.PI) / 2);
    w.rotation.y = (i * Math.PI) / 2;
  }
  // Burç
  add(new THREE.BoxGeometry(1.2, 1.6, 1.2), stone, 0, 1.05, 0);
  add(new THREE.ConeGeometry(0.95, 0.9, 4), roof, 0, 2.3, 0).rotation.y = Math.PI / 4;
  // 4 kule (can azaldıkça yıkılır)
  const towers = [];
  for (const [x, z] of [[1.35, 1.35], [-1.35, 1.35], [-1.35, -1.35], [1.35, -1.35]]) {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    add(new THREE.CylinderGeometry(0.38, 0.44, 1.35, 10), stone, 0, 0.8, 0, t);
    add(new THREE.ConeGeometry(0.5, 0.7, 10), roof, 0, 1.83, 0, t);
    root.add(t);
    towers.push(t);
  }
  // Sancak
  add(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), dark, 0, 3.1, 0);
  const flagGeo = new THREE.PlaneGeometry(0.7, 0.42, 6, 1);
  flagGeo.translate(0.35, 0, 0);
  const flag = add(flagGeo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }), 0, 3.45, 0);
  flag.userData.base = flagGeo.attributes.position.array.slice();
  // Pencere ışıkları
  const glow = new THREE.MeshBasicMaterial({ color: 0xffc35a, toneMapped: false });
  for (const [x, z, ry] of [[0, 0.61, 0], [0.61, 0, Math.PI / 2], [-0.61, 0, Math.PI / 2], [0, -0.61, 0]]) {
    const w = add(new THREE.BoxGeometry(0.18, 0.3, 0.04), glow, x, 1.3, z);
    w.rotation.y = ry;
    w.castShadow = false;
  }
  return { root, towers, flag, stone };
}


/** Salonu ve masayı sahneye kur; mum ışıklarını döndürür */
export function buildHall(scene) {
  const self = { scene, candles: [] };
  function _lights() {
      this.scene.add(new THREE.HemisphereLight(0x8a7a9a, 0x2a1a0e, 0.55));
      const moon = new THREE.DirectionalLight(0xb8c4ff, 0.7);
      moon.position.set(-12, 22, 8);
      moon.castShadow = true;
      moon.shadow.mapSize.set(2048, 2048);
      const c = moon.shadow.camera;
      c.left = -16; c.right = 16; c.top = 16; c.bottom = -16; c.near = 1; c.far = 60;
      this.scene.add(moon);
      this.candles = [];
      const candleGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.5, 8);
      const candleMat = new THREE.MeshStandardMaterial({ color: 0xefe6cf, roughness: 0.6 });
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false });
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const x = Math.sign(Math.sin(a)) * 6.95, z = Math.sign(Math.cos(a)) * 6.95;
        const cnd = new THREE.Mesh(candleGeo, candleMat);
        cnd.position.set(x, TABLE_Y + 0.25, z);
        cnd.castShadow = true;
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), flameMat);
        fl.position.set(x, TABLE_Y + 0.6, z);
        fl.scale.y = 1.6;
        const light = new THREE.PointLight(0xffa04a, 14, 14, 1.6);
        light.position.set(x, TABLE_Y + 1.1, z);
        this.scene.add(cnd, fl, light);
        this.candles.push({ fl, light, ph: Math.random() * 10 });
      }
      // Salonun duvar meşaleleri
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const l = new THREE.PointLight(0xff7a2a, 20, 22, 1.5);
        l.position.set(Math.sin(a) * 19, 5, Math.cos(a) * 19);
        this.scene.add(l);
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), flameMat);
        f.position.copy(l.position);
        this.scene.add(f);
        this.candles.push({ fl: f, light: l, ph: Math.random() * 10, big: true });
      }
    }


  function _room() {
      const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.95 }));
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      this.scene.add(floor);
      // Salon duvarı (silindir) ve sütunlar
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(21, 21, 14, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a3029, roughness: 1, side: THREE.BackSide }));
      wall.position.y = 7;
      this.scene.add(wall);
      const colMat = new THREE.MeshStandardMaterial({ color: 0x5a5048, roughness: 0.9, flatShading: true });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 14, 10), colMat);
        col.position.set(Math.sin(a) * 19.6, 7, Math.cos(a) * 19.6);
        this.scene.add(col);
      }
      // Duvardaki sancaklar
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI;
        const ban = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 5), new THREE.MeshStandardMaterial({ color: SEAT_COLORS[i], roughness: 0.8, side: THREE.DoubleSide }));
        ban.position.set(Math.sin(a) * 20.5, 7.5, Math.cos(a) * 20.5);
        ban.lookAt(0, 7.5, 0);
        this.scene.add(ban);
      }
    }


  _lights.call(self);
  _room.call(self);
  // Kare savaş masası (üstü harita)
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.8 });
  const W = 14.8;
  const top = new THREE.Mesh(new THREE.BoxGeometry(W, 0.45, W), wood);
  top.position.y = TABLE_Y - 0.22;
  top.castShadow = top.receiveShadow = true;
  scene.add(top);
  for (const [x, z, w, d] of [[0, W / 2, W + 0.5, 0.5], [0, -W / 2, W + 0.5, 0.5], [W / 2, 0, 0.5, W + 0.5], [-W / 2, 0, 0.5, W + 0.5]]) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.32, d), dark);
    rim.position.set(x, TABLE_Y - 0.02, z);
    rim.castShadow = true;
    scene.add(rim);
  }
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, TABLE_Y - 0.4, 0.7), dark);
    leg.position.set(x * (W / 2 - 0.8), (TABLE_Y - 0.4) / 2, z * (W / 2 - 0.8));
    leg.castShadow = true;
    scene.add(leg);
  }
  return self.candles;
}
