// ============================================================
//  YARATIK MODELLERİ
//  Her yaratık, Three.js primitiflerinden kurulmuş eklemli bir
//  low-poly modeldir. Bacak ve kollar ayrı "eklem" gruplarına
//  bağlı olduğu için yürüme animasyonu yapılabilir.
//
//  Yeni yaratık: BUILDERS içine bir fonksiyon ekle ve enemies.js
//  içinde "model" alanına anahtarını yaz.
//  Model ön yüzü +Z yönüne bakar, orijin ayak hizasındadır.
// ============================================================
import * as THREE from 'three';

// Ortak geometri önbelleği (her yaratık için yeniden üretilmesin)
const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

/** Bir yaratığın parçalarını toplayan küçük yardımcı */
class Kit {
  constructor() {
    this.root = new THREE.Group();
    this.mats = [];      // vuruş parlaması için standart materyaller
    this.extraMats = []; // yalnızca dispose edilecekler
    this.parts = {};
  }

  mat(color, opts = {}) {
    const m = new THREE.MeshStandardMaterial({
      color, roughness: opts.roughness ?? 0.75, metalness: opts.metalness ?? 0,
      flatShading: true, emissive: 0xffffff, emissiveIntensity: 0,
    });
    this.mats.push(m);
    return m;
  }

  glow(color) {
    const m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    this.extraMats.push(m);
    return m;
  }

  mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    (parent || this.root).add(m);
    return m;
  }

  /** Dönme noktası (eklem) */
  joint(name, parent, x, y, z) {
    const j = new THREE.Group();
    j.position.set(x, y, z);
    (parent || this.root).add(j);
    this.parts[name] = j;
    return j;
  }
}

// ------------------------------------------------------------
//  GOBLİN: küçük, kambur, sivri kulaklı, paslı hançerli
// ------------------------------------------------------------
function buildGoblin(def) {
  const k = new Kit();
  const skin = k.mat(def.color);
  const cloth = k.mat(0x6b4a2b);
  const dark = k.mat(0x3a2a1a);
  const steel = k.mat(0x9aa0a6, { metalness: 0.6, roughness: 0.35 });
  const eye = k.glow(def.eyeColor);

  const body = k.joint('body', null, 0, 0, 0);

  // Bacaklar
  for (const s of [-1, 1]) {
    const leg = k.joint(s < 0 ? 'legL' : 'legR', body, s * 0.13, 0.4, 0);
    k.mesh(geo('gob-leg', () => new THREE.BoxGeometry(0.14, 0.38, 0.14)), dark, leg, 0, -0.19, 0);
    k.mesh(geo('gob-foot', () => new THREE.BoxGeometry(0.16, 0.08, 0.26)), skin, leg, 0, -0.36, 0.05);
  }
  // Gövde (öne eğik)
  const torso = k.joint('torso', body, 0, 0.42, 0);
  torso.rotation.x = 0.25;
  k.mesh(geo('gob-torso', () => new THREE.CapsuleGeometry(0.22, 0.22, 3, 7)), cloth, torso, 0, 0.22, 0);
  k.mesh(geo('gob-belt', () => new THREE.CylinderGeometry(0.235, 0.235, 0.07, 7)), dark, torso, 0, 0.12, 0);

  // Kafa
  const head = k.joint('head', torso, 0, 0.62, 0.08);
  k.mesh(geo('gob-head', () => new THREE.IcosahedronGeometry(0.25, 0)), skin, head, 0, 0, 0);
  const earGeo = geo('gob-ear', () => new THREE.ConeGeometry(0.08, 0.42, 4));
  for (const s of [-1, 1]) {
    const ear = k.mesh(earGeo, skin, head, s * 0.3, 0.06, -0.02);
    ear.rotation.z = -s * (Math.PI / 2 - 0.3);
    k.mesh(geo('gob-eye', () => new THREE.SphereGeometry(0.05, 6, 4)), eye, head, s * 0.1, 0.05, 0.21);
  }
  const nose = k.mesh(geo('gob-nose', () => new THREE.ConeGeometry(0.06, 0.22, 4)), skin, head, 0, -0.02, 0.27);
  nose.rotation.x = Math.PI / 2;

  // Kollar + hançer
  for (const s of [-1, 1]) {
    const arm = k.joint(s < 0 ? 'armL' : 'armR', torso, s * 0.28, 0.42, 0);
    k.mesh(geo('gob-arm', () => new THREE.BoxGeometry(0.1, 0.4, 0.1)), skin, arm, 0, -0.2, 0);
    if (s > 0) {
      const blade = k.mesh(geo('gob-dagger', () => new THREE.BoxGeometry(0.04, 0.05, 0.38)), steel, arm, 0, -0.4, 0.15);
      blade.rotation.x = -0.3;
    }
  }
  return { ...k, height: 1.25 };
}

// ------------------------------------------------------------
//  İSKELET: kemik uzuvlar, kaburga halkaları, kızıl göz çukurları
// ------------------------------------------------------------
function buildSkeleton(def) {
  const k = new Kit();
  const bone = k.mat(def.color, { roughness: 0.6 });
  const dark = k.mat(0x1a1414);
  const rust = k.mat(0x8a5a3a, { metalness: 0.5, roughness: 0.5 });
  const eye = k.glow(def.eyeColor);

  const body = k.joint('body', null, 0, 0, 0);
  const limb = (len) => geo(`sk-limb-${len}`, () => new THREE.CylinderGeometry(0.045, 0.04, len, 5));
  const knob = geo('sk-knob', () => new THREE.SphereGeometry(0.07, 6, 4));

  for (const s of [-1, 1]) {
    const leg = k.joint(s < 0 ? 'legL' : 'legR', body, s * 0.12, 0.82, 0);
    k.mesh(limb(0.4), bone, leg, 0, -0.2, 0);
    k.mesh(knob, bone, leg, 0, -0.41, 0);
    k.mesh(limb(0.38), bone, leg, 0, -0.6, 0);
    k.mesh(geo('sk-foot', () => new THREE.BoxGeometry(0.1, 0.05, 0.2)), bone, leg, 0, -0.8, 0.05);
  }
  k.mesh(geo('sk-pelvis', () => new THREE.BoxGeometry(0.34, 0.12, 0.16)), bone, body, 0, 0.84, 0);

  const torso = k.joint('torso', body, 0, 0.88, 0);
  k.mesh(geo('sk-spine', () => new THREE.CylinderGeometry(0.035, 0.035, 0.55, 5)), bone, torso, 0, 0.27, -0.05);
  const ribGeo = geo('sk-rib', () => new THREE.TorusGeometry(0.17, 0.03, 4, 9));
  [0.22, 0.34, 0.46].forEach((y, i) => {
    const rib = k.mesh(ribGeo, bone, torso, 0, y, 0);
    rib.rotation.x = Math.PI / 2;
    rib.scale.setScalar(1 - i * 0.05 + (i === 1 ? 0.08 : 0));
  });

  const head = k.joint('head', torso, 0, 0.72, 0);
  k.mesh(geo('sk-skull', () => new THREE.IcosahedronGeometry(0.2, 1)), bone, head, 0, 0.04, 0);
  const jaw = k.joint('jaw', head, 0, -0.1, 0.04);
  k.mesh(geo('sk-jaw', () => new THREE.BoxGeometry(0.2, 0.07, 0.17)), bone, jaw, 0, -0.03, 0.02);
  for (const s of [-1, 1]) {
    k.mesh(geo('sk-socket', () => new THREE.SphereGeometry(0.06, 6, 4)), dark, head, s * 0.08, 0.06, 0.15);
    k.mesh(geo('sk-pupil', () => new THREE.SphereGeometry(0.028, 5, 3)), eye, head, s * 0.08, 0.06, 0.2);
  }

  for (const s of [-1, 1]) {
    const arm = k.joint(s < 0 ? 'armL' : 'armR', torso, s * 0.24, 0.52, 0);
    k.mesh(limb(0.36), bone, arm, 0, -0.18, 0);
    k.mesh(limb(0.34), bone, arm, 0, -0.52, 0.02);
    if (s > 0) {
      const sword = k.mesh(geo('sk-sword', () => new THREE.BoxGeometry(0.05, 0.08, 0.75)), rust, arm, 0, -0.7, 0.3);
      sword.rotation.x = -0.2;
      k.mesh(geo('sk-guard', () => new THREE.BoxGeometry(0.22, 0.05, 0.05)), rust, arm, 0, -0.68, 0);
    }
  }
  return { ...k, height: 1.8 };
}

// ------------------------------------------------------------
//  ORK: iri gövde, dişler, omuz zırhı, balta
//  opts.chief: boynuzlu miğfer + pelerin (Ork Şefi)
// ------------------------------------------------------------
function buildOrc(def, opts = {}) {
  const k = new Kit();
  const skin = k.mat(def.color);
  const leather = k.mat(0x4a3322);
  const iron = k.mat(0x8a8f96, { metalness: 0.6, roughness: 0.4 });
  const tusk = k.mat(0xf1e6c8, { roughness: 0.4 });
  const eye = k.glow(def.eyeColor);

  const body = k.joint('body', null, 0, 0, 0);

  for (const s of [-1, 1]) {
    const leg = k.joint(s < 0 ? 'legL' : 'legR', body, s * 0.24, 0.62, 0);
    k.mesh(geo('ork-leg', () => new THREE.BoxGeometry(0.28, 0.6, 0.3)), leather, leg, 0, -0.3, 0);
    k.mesh(geo('ork-boot', () => new THREE.BoxGeometry(0.32, 0.14, 0.42)), iron, leg, 0, -0.58, 0.05);
  }

  const torso = k.joint('torso', body, 0, 0.62, 0);
  torso.rotation.x = 0.12;
  k.mesh(geo('ork-torso', () => new THREE.BoxGeometry(0.9, 0.72, 0.58)), skin, torso, 0, 0.38, 0);
  k.mesh(geo('ork-belt', () => new THREE.BoxGeometry(0.94, 0.14, 0.62)), leather, torso, 0, 0.08, 0);
  k.mesh(geo('ork-buckle', () => new THREE.BoxGeometry(0.18, 0.12, 0.05)), iron, torso, 0, 0.08, 0.32);
  const padGeo = geo('ork-pad', () => new THREE.SphereGeometry(0.2, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2));
  for (const s of [-1, 1]) k.mesh(padGeo, iron, torso, s * 0.52, 0.7, 0);

  const head = k.joint('head', torso, 0, 0.9, 0.14);
  k.mesh(geo('ork-head', () => new THREE.BoxGeometry(0.46, 0.4, 0.42)), skin, head, 0, 0.1, 0);
  k.mesh(geo('ork-brow', () => new THREE.BoxGeometry(0.5, 0.08, 0.12)), skin, head, 0, 0.2, 0.2);
  const jaw = k.joint('jaw', head, 0, -0.06, 0.04);
  k.mesh(geo('ork-jaw', () => new THREE.BoxGeometry(0.5, 0.16, 0.42)), skin, jaw, 0, -0.06, 0.02);
  for (const s of [-1, 1]) {
    k.mesh(geo('ork-tusk', () => new THREE.ConeGeometry(0.045, 0.2, 5)), tusk, jaw, s * 0.15, 0.08, 0.22);
    k.mesh(geo('ork-eye', () => new THREE.BoxGeometry(0.08, 0.05, 0.03)), eye, head, s * 0.11, 0.13, 0.215);
  }

  if (opts.troll) {
    torso.rotation.x = 0.38;
    const moss = k.mat(0x4a6a2a);
    k.mesh(geo('trol-hump', () => new THREE.IcosahedronGeometry(0.42, 0)), skin, torso, 0, 0.62, -0.25);
    k.mesh(geo('trol-moss', () => new THREE.IcosahedronGeometry(0.3, 0)), moss, torso, 0.18, 0.85, -0.3);
    k.mesh(geo('trol-nose', () => new THREE.ConeGeometry(0.1, 0.3, 5)), skin, head, 0, 0.06, 0.3).rotation.x = Math.PI / 2;
  }
  if (opts.chief) {
    k.mesh(geo('ork-helm', () => new THREE.CylinderGeometry(0.27, 0.3, 0.16, 8)), iron, head, 0, 0.34, 0);
    const hornGeo = geo('ork-horn', () => new THREE.ConeGeometry(0.07, 0.45, 6));
    for (const s of [-1, 1]) {
      const horn = k.mesh(hornGeo, tusk, head, s * 0.3, 0.45, 0);
      horn.rotation.z = -s * 0.7;
    }
    const cape = k.mesh(geo('ork-cape', () => new THREE.BoxGeometry(0.85, 1.0, 0.05)), k.mat(0x5a0f14), torso, 0, 0.25, -0.33);
    cape.rotation.x = 0.15;
    k.parts.cape = cape;
  }

  for (const s of [-1, 1]) {
    const arm = k.joint(s < 0 ? 'armL' : 'armR', torso, s * 0.58, 0.6, 0);
    k.mesh(geo('ork-arm', () => new THREE.BoxGeometry(0.24, 0.62, 0.26)), skin, arm, 0, -0.3, 0);
    k.mesh(geo('ork-bracer', () => new THREE.BoxGeometry(0.28, 0.16, 0.3)), leather, arm, 0, -0.5, 0);
    if (s > 0 && opts.troll) {
      const club = k.joint('weapon', arm, 0, -0.62, 0.05);
      club.rotation.x = -0.5;
      const wood = k.mat(0x5a3a22);
      const c = k.mesh(geo('trol-club', () => new THREE.CylinderGeometry(0.17, 0.06, 1.3, 7)), wood, club, 0, 0, 0.55);
      c.rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) {
        const sp = k.mesh(geo('trol-spike', () => new THREE.ConeGeometry(0.05, 0.16, 4)), iron, club, Math.cos(i * 1.6) * 0.17, Math.sin(i * 1.6) * 0.17, 1.0);
        sp.rotation.z = i * 1.6 - Math.PI / 2;
      }
    } else if (s > 0) {
      const axe = k.joint('weapon', arm, 0, -0.62, 0.05);
      axe.rotation.x = -0.5;
      k.mesh(geo('ork-haft', () => new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6)), leather, axe, 0, 0, 0.3).rotation.x = Math.PI / 2;
      k.mesh(geo('ork-blade', () => new THREE.BoxGeometry(0.06, 0.42, 0.3)), iron, axe, 0, 0.18, 0.75);
    }
  }
  return { ...k, height: 1.95 };
}

// ------------------------------------------------------------
//  CİN: minik, kırmızı, boynuzlu, yarasa kanatlı hızlı koşucu
// ------------------------------------------------------------
function buildImp(def) {
  const k = new Kit();
  const skin = k.mat(def.color);
  const dark = k.mat(0x3a0c0c);
  const horn = k.mat(0xf1e6c8, { roughness: 0.4 });
  const eye = k.glow(def.eyeColor);
  const body = k.joint('body', null, 0, 0, 0);
  for (const s of [-1, 1]) {
    const leg = k.joint(s < 0 ? 'legL' : 'legR', body, s * 0.1, 0.3, 0);
    k.mesh(geo('imp-leg', () => new THREE.BoxGeometry(0.1, 0.3, 0.1)), dark, leg, 0, -0.15, 0);
    k.mesh(geo('imp-foot', () => new THREE.ConeGeometry(0.07, 0.18, 4)), skin, leg, 0, -0.28, 0.06).rotation.x = Math.PI / 2;
  }
  const torso = k.joint('torso', body, 0, 0.32, 0);
  torso.rotation.x = 0.35;
  k.mesh(geo('imp-torso', () => new THREE.IcosahedronGeometry(0.2, 0)), skin, torso, 0, 0.15, 0);
  const head = k.joint('head', torso, 0, 0.42, 0.05);
  k.mesh(geo('imp-head', () => new THREE.IcosahedronGeometry(0.22, 0)), skin, head, 0, 0, 0);
  for (const s of [-1, 1]) {
    const h = k.mesh(geo('imp-horn', () => new THREE.ConeGeometry(0.05, 0.22, 5)), horn, head, s * 0.12, 0.2, 0);
    h.rotation.z = -s * 0.5;
    k.mesh(geo('imp-eye', () => new THREE.SphereGeometry(0.055, 6, 4)), eye, head, s * 0.09, 0.03, 0.18);
  }
  const jaw = k.joint('jaw', head, 0, -0.1, 0.1);
  k.mesh(geo('imp-jaw', () => new THREE.BoxGeometry(0.2, 0.05, 0.1)), dark, jaw, 0, 0, 0.02);
  for (const s of [-1, 1]) {
    const arm = k.joint(s < 0 ? 'armL' : 'armR', torso, s * 0.2, 0.22, 0);
    k.mesh(geo('imp-arm', () => new THREE.BoxGeometry(0.07, 0.26, 0.07)), skin, arm, 0, -0.13, 0);
    const wing = k.joint(s < 0 ? 'wingL' : 'wingR', torso, s * 0.08, 0.25, -0.15);
    const w = k.mesh(geo('imp-wing', () => new THREE.ConeGeometry(0.2, 0.05, 3)), dark, wing, s * 0.2, 0.08, 0);
    w.rotation.z = -s * 1.2;
  }
  const tail = k.joint('tail', body, 0, 0.32, -0.15);
  k.mesh(geo('imp-tail', () => new THREE.CylinderGeometry(0.02, 0.03, 0.4, 4)), skin, tail, 0, 0, -0.2).rotation.x = Math.PI / 2 + 0.5;
  k.mesh(geo('imp-tailtip', () => new THREE.ConeGeometry(0.06, 0.1, 4)), dark, tail, 0, 0.1, -0.4).rotation.x = -1;
  return { ...k, height: 0.95 };
}

// ------------------------------------------------------------
//  KURT: dört ayaklı, uzun burun, kuyruk
// ------------------------------------------------------------
function buildWolf(def) {
  const k = new Kit();
  const fur = k.mat(def.color);
  const dark = k.mat(0x3a383e);
  const fang = k.mat(0xf1e6c8, { roughness: 0.4 });
  const eye = k.glow(def.eyeColor);
  const body = k.joint('body', null, 0, 0, 0);
  const torso = k.joint('torso', body, 0, 0.62, 0);
  k.mesh(geo('wolf-body', () => new THREE.BoxGeometry(0.42, 0.42, 1.0)), fur, torso, 0, 0, 0);
  k.mesh(geo('wolf-mane', () => new THREE.BoxGeometry(0.5, 0.5, 0.36)), dark, torso, 0, 0.04, 0.32);
  const legs = { legFL: [-0.15, 0.4], legFR: [0.15, 0.4], legBL: [-0.15, -0.38], legBR: [0.15, -0.38] };
  for (const [n, [x, z]] of Object.entries(legs)) {
    const leg = k.joint(n, body, x, 0.5, z);
    k.mesh(geo('wolf-leg', () => new THREE.BoxGeometry(0.12, 0.48, 0.12)), dark, leg, 0, -0.24, 0);
    k.mesh(geo('wolf-paw', () => new THREE.BoxGeometry(0.15, 0.06, 0.18)), fur, leg, 0, -0.47, 0.03);
  }
  const head = k.joint('head', torso, 0, 0.18, 0.55);
  k.mesh(geo('wolf-head', () => new THREE.BoxGeometry(0.34, 0.3, 0.32)), fur, head, 0, 0.02, 0.05);
  k.mesh(geo('wolf-snout', () => new THREE.BoxGeometry(0.18, 0.14, 0.3)), fur, head, 0, -0.02, 0.32);
  k.mesh(geo('wolf-nose', () => new THREE.BoxGeometry(0.08, 0.06, 0.05)), dark, head, 0, 0.04, 0.48);
  const jaw = k.joint('jaw', head, 0, -0.08, 0.2);
  k.mesh(geo('wolf-jaw', () => new THREE.BoxGeometry(0.16, 0.05, 0.28)), dark, jaw, 0, -0.02, 0.1);
  for (const s of [-1, 1]) {
    k.mesh(geo('wolf-fang', () => new THREE.ConeGeometry(0.02, 0.07, 4)), fang, jaw, s * 0.05, 0.03, 0.22).rotation.x = Math.PI;
    const ear = k.mesh(geo('wolf-ear', () => new THREE.ConeGeometry(0.07, 0.18, 4)), dark, head, s * 0.11, 0.24, -0.02);
    ear.rotation.z = -s * 0.2;
    k.mesh(geo('wolf-eye', () => new THREE.BoxGeometry(0.06, 0.04, 0.02)), eye, head, s * 0.09, 0.08, 0.21);
  }
  const tail = k.joint('tail', torso, 0, 0.12, -0.5);
  tail.rotation.x = -0.6;
  k.mesh(geo('wolf-tail', () => new THREE.ConeGeometry(0.09, 0.55, 5)), fur, tail, 0, 0, -0.26).rotation.x = -Math.PI / 2;
  return { ...k, height: 1.0 };
}

// ------------------------------------------------------------
//  EJDERHA: kanatlı, uzun boyunlu, eklemli kuyruk
//  def.king: dikenli sırt, taç boynuzlar (Kızıl Ejderha)
// ------------------------------------------------------------
function wingGeo() {
  return geo('drg-wing', () => {
    const g = new THREE.BufferGeometry();
    const v = [0, 0, 0, 1.7, 0.15, -0.15, 1.3, 0, -0.9, 0, 0, 0, 1.3, 0, -0.9, 0.6, 0, -1.0, 0, 0, 0, 0.6, 0, -1.0, 0.05, 0, -0.55];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  });
}
function buildDragon(def) {
  const k = new Kit();
  const scale = k.mat(def.color, { roughness: 0.55 });
  const belly = k.mat(def.belly ?? 0xd9c27a);
  const membrane = k.mat(new THREE.Color(def.color).multiplyScalar(0.6).getHex(), { roughness: 0.8 });
  membrane.side = THREE.DoubleSide;
  const horn = k.mat(0xf1e6c8, { roughness: 0.4 });
  const eye = k.glow(def.eyeColor);
  const body = k.joint('body', null, 0, 0, 0);
  const torso = k.joint('torso', body, 0, 0.7, 0);
  const tg = k.mesh(geo('drg-torso', () => new THREE.CapsuleGeometry(0.32, 0.7, 4, 8)), scale, torso, 0, 0, 0);
  tg.rotation.x = Math.PI / 2;
  const bl = k.mesh(geo('drg-belly', () => new THREE.CapsuleGeometry(0.26, 0.6, 3, 7)), belly, torso, 0, -0.1, 0.02);
  bl.rotation.x = Math.PI / 2;
  // Boyun + kafa
  const neck = k.joint('neck', torso, 0, 0.12, 0.5);
  neck.rotation.x = -0.7;
  k.mesh(geo('drg-neck', () => new THREE.CylinderGeometry(0.14, 0.2, 0.6, 7)), scale, neck, 0, 0.28, 0);
  const head = k.joint('head', neck, 0, 0.6, 0);
  head.rotation.x = 0.75;
  k.mesh(geo('drg-head', () => new THREE.BoxGeometry(0.34, 0.26, 0.4)), scale, head, 0, 0, 0.05);
  k.mesh(geo('drg-snout', () => new THREE.BoxGeometry(0.24, 0.16, 0.3)), scale, head, 0, 0.0, 0.36);
  const jaw = k.joint('jaw', head, 0, -0.1, 0.12);
  k.mesh(geo('drg-jaw', () => new THREE.BoxGeometry(0.22, 0.07, 0.42)), belly, jaw, 0, -0.03, 0.18);
  k.parts.mouth = k.joint('mouth', head, 0, -0.04, 0.55);
  for (const s of [-1, 1]) {
    const h = k.mesh(geo('drg-horn', () => new THREE.ConeGeometry(0.05, 0.34, 5)), horn, head, s * 0.12, 0.2, -0.14);
    h.rotation.x = -1.0; h.rotation.z = -s * 0.25;
    k.mesh(geo('drg-eye', () => new THREE.SphereGeometry(0.045, 6, 4)), eye, head, s * 0.15, 0.08, 0.16);
  }
  if (def.king) {
    for (let i = 0; i < 5; i++) {
      const sp = k.mesh(geo('drg-spike', () => new THREE.ConeGeometry(0.07, 0.22, 4)), horn, torso, 0, 0.32, 0.35 - i * 0.18);
      sp.rotation.x = -0.3;
    }
    for (const s of [-1, 1]) {
      const h2 = k.mesh(geo('drg-horn2', () => new THREE.ConeGeometry(0.04, 0.26, 5)), horn, head, s * 0.18, 0.12, -0.06);
      h2.rotation.z = -s * 1.0;
    }
  }
  // Kanatlar
  for (const s of [-1, 1]) {
    const wing = k.joint(s < 0 ? 'wingL' : 'wingR', torso, s * 0.22, 0.22, 0.15);
    const holder = new THREE.Group();
    holder.scale.x = s;
    wing.add(holder);
    k.mesh(wingGeo(), membrane, holder, 0, 0, 0);
    const bone = k.mesh(geo('drg-wbone', () => new THREE.BoxGeometry(1.7, 0.06, 0.06)), scale, holder, 0.85, 0.08, -0.08);
    bone.rotation.y = 0.09;
  }
  // Bacaklar
  for (const [n, x, z] of [['legL', -0.2, -0.25], ['legR', 0.2, -0.25], ['armL', -0.18, 0.3], ['armR', 0.18, 0.3]]) {
    const leg = k.joint(n, body, x, 0.55, z);
    k.mesh(geo('drg-leg', () => new THREE.BoxGeometry(0.12, 0.4, 0.14)), scale, leg, 0, -0.2, 0);
    k.mesh(geo('drg-claw', () => new THREE.ConeGeometry(0.07, 0.14, 4)), horn, leg, 0, -0.42, 0.06).rotation.x = Math.PI / 2;
  }
  // Kuyruk zinciri
  let parent = torso;
  let z = -0.55;
  for (let i = 0; i < 4; i++) {
    const t = k.joint(`tail${i}`, parent, 0, i === 0 ? 0 : 0, z);
    const r = 0.18 - i * 0.04;
    k.mesh(geo(`drg-tail${i}`, () => new THREE.ConeGeometry(r, 0.5, 6)), scale, t, 0, 0, -0.22).rotation.x = -Math.PI / 2;
    parent = t;
    z = -0.42;
  }
  k.mesh(geo('drg-tailtip', () => new THREE.ConeGeometry(0.12, 0.2, 3)), horn, parent, 0, 0, -0.5).rotation.x = -Math.PI / 2;
  return { ...k, height: 1.5 };
}

// ------------------------------------------------------------
//  KEMİK LORDU: süzülen cüppe, taçlı kafatası, asa, dönen rünler
// ------------------------------------------------------------
function buildLich(def) {
  const k = new Kit();
  const robe = k.mat(def.color);
  const trim = k.mat(0xc9a24a, { metalness: 0.6, roughness: 0.35 });
  const bone = k.mat(def.bone ?? 0xe6dfc8, { roughness: 0.6 });
  const eye = k.glow(def.eyeColor);
  const orbM = k.glow(def.eyeColor);
  const body = k.joint('body', null, 0, 0, 0);
  const torso = k.joint('torso', body, 0, 0.35, 0);
  const skirt = k.mesh(geo('lich-robe', () => new THREE.ConeGeometry(0.5, 1.1, 8, 1, true)), robe, torso, 0, 0.35, 0);
  robe.side = THREE.DoubleSide;
  k.parts.cape = skirt;
  k.mesh(geo('lich-chest', () => new THREE.CylinderGeometry(0.28, 0.34, 0.5, 8)), robe, torso, 0, 0.95, 0);
  k.mesh(geo('lich-belt', () => new THREE.CylinderGeometry(0.35, 0.35, 0.08, 8)), trim, torso, 0, 0.72, 0);
  const head = k.joint('head', torso, 0, 1.38, 0);
  k.mesh(geo('sk-skull', () => new THREE.IcosahedronGeometry(0.2, 1)), bone, head, 0, 0.04, 0);
  k.mesh(geo('lich-hood', () => new THREE.ConeGeometry(0.32, 0.5, 8, 1, true)), robe, head, 0, 0.12, -0.04);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.mesh(geo('lich-crown', () => new THREE.ConeGeometry(0.035, 0.16, 4)), trim, head, Math.sin(a) * 0.17, 0.26, Math.cos(a) * 0.17);
  }
  const jaw = k.joint('jaw', head, 0, -0.1, 0.04);
  k.mesh(geo('sk-jaw', () => new THREE.BoxGeometry(0.2, 0.07, 0.17)), bone, jaw, 0, -0.03, 0.02);
  for (const s of [-1, 1]) k.mesh(geo('lich-eye', () => new THREE.SphereGeometry(0.045, 6, 4)), eye, head, s * 0.08, 0.06, 0.17);
  for (const s of [-1, 1]) {
    const arm = k.joint(s < 0 ? 'armL' : 'armR', torso, s * 0.34, 1.12, 0);
    k.mesh(geo('lich-sleeve', () => new THREE.ConeGeometry(0.14, 0.55, 6)), robe, arm, 0, -0.25, 0).rotation.x = Math.PI;
    k.mesh(geo('lich-hand', () => new THREE.SphereGeometry(0.06, 5, 4)), bone, arm, 0, -0.55, 0);
    if (s > 0) {
      k.mesh(geo('lich-staff', () => new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5)), trim, arm, 0, -0.45, 0.05);
      const orb = k.mesh(geo('lich-orb', () => new THREE.IcosahedronGeometry(0.13, 0)), orbM, arm, 0, 0.38, 0.05);
      k.parts.orb = orb;
    }
  }
  // Etrafında dönen rün taşları
  const halo = k.joint('halo', body, 0, 1.0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = k.mesh(geo('lich-rune', () => new THREE.OctahedronGeometry(0.08, 0)), orbM, halo, Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85);
    r.castShadow = false;
  }
  return { ...k, height: 1.75 };
}

const BUILDERS = {
  goblin: (def) => buildGoblin(def),
  iskelet: (def) => buildSkeleton(def),
  ork: (def) => buildOrc(def),
  orkSefi: (def) => buildOrc(def, { chief: true }),
  trol: (def) => buildOrc(def, { troll: true }),
  cin: (def) => buildImp(def),
  kurt: (def) => buildWolf(def),
  ejder: (def) => buildDragon(def),
  lich: (def) => buildLich(def),
};

export function buildEnemyModel(def) {
  const build = BUILDERS[def.model] ?? BUILDERS.goblin;
  const model = build(def);
  const scale = def.scale ?? 1;
  model.root.scale.setScalar(scale);
  model.height *= scale;
  return model;
}
