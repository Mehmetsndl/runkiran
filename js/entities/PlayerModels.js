// ============================================================
//  OYUNCU KARAKTER MODELLERİ
//  Her kurucu { root, parts, mats, height } döndürür.
//  parts: legL, legR, armL, armR, torso, castPoint (mermi çıkış noktası)
//  Model +Z yönüne bakar, orijin ayak hizasındadır.
// ============================================================
import * as THREE from 'three';

class Kit {
  constructor() {
    this.root = new THREE.Group();
    this.parts = {};
    this.mats = [];
  }
  mat(color, o = {}) {
    const m = new THREE.MeshStandardMaterial({
      color, roughness: o.roughness ?? 0.7, metalness: o.metalness ?? 0,
      flatShading: o.flat ?? true, emissive: o.emissive ?? 0xff0000, emissiveIntensity: o.emissiveIntensity ?? 0,
    });
    if (!o.emissive) this.mats.push(m); // vuruş parlaması için
    return m;
  }
  glow(color) { return new THREE.MeshBasicMaterial({ color, toneMapped: false }); }
  mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    (parent || this.root).add(m);
    return m;
  }
  joint(name, parent, x, y, z) {
    const j = new THREE.Group();
    j.position.set(x, y, z);
    (parent || this.root).add(j);
    if (name) this.parts[name] = j;
    return j;
  }
}

// ------------------------------------------------------------
//  BÜYÜCÜ: mavi cüppe, sivri şapka, kristal küreli asa
// ------------------------------------------------------------
function buildWizard() {
  const k = new Kit();
  const robe = k.mat(0x2f6fff, { roughness: 0.5, flat: false });
  const skin = k.mat(0xf1c9a5);
  const hat = k.mat(0x1b2a6b);
  const wood = k.mat(0x6b4a2b);
  const beard = k.mat(0xe8e8f0);

  const torso = k.joint('torso', null, 0, 0, 0);
  k.mesh(new THREE.CylinderGeometry(0.42, 0.62, 1.4, 16), robe, torso, 0, 0.72, 0);
  k.mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 16), k.mat(0xffd84a, { metalness: 0.5 }), torso, 0, 0.95, 0);
  k.mesh(new THREE.SphereGeometry(0.3, 14, 10), skin, torso, 0, 1.62, 0);
  k.mesh(new THREE.ConeGeometry(0.22, 0.45, 8), beard, torso, 0, 1.38, 0.17).rotation.x = Math.PI;
  k.mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 18), hat, torso, 0, 1.84, 0);
  const cone = k.mesh(new THREE.ConeGeometry(0.4, 0.95, 14), hat, torso, 0, 2.3, -0.04);
  cone.rotation.x = -0.18;

  const armL = k.joint('armL', torso, -0.48, 1.3, 0);
  k.mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.6, 8), robe, armL, 0, -0.28, 0);
  const armR = k.joint('armR', torso, 0.48, 1.3, 0);
  k.mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.6, 8), robe, armR, 0, -0.28, 0);
  k.mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.1, 6), wood, armR, 0.12, -0.2, 0.18);
  const orb = k.mesh(
    new THREE.IcosahedronGeometry(0.2, 1),
    k.mat(0x7fe3ff, { emissive: 0x3fc8ff, emissiveIntensity: 2 }),
    armR, 0.12, 0.9, 0.18
  );
  k.parts.castPoint = orb;
  k.parts.orb = orb;
  return { ...k, height: 2.6 };
}

// ------------------------------------------------------------
//  TEPEGÖZ: tek dev göz, tek boynuz, kalın gövde, çivili topuz
// ------------------------------------------------------------
function buildCyclops() {
  const k = new Kit();
  const skin = k.mat(0xb08a6a);
  const hide = k.mat(0x5a3d26);
  const wood = k.mat(0x6b4425);
  const bone = k.mat(0xeee2c4, { roughness: 0.4 });
  const iron = k.mat(0x80868e, { metalness: 0.6, roughness: 0.4 });

  for (const s of [-1, 1]) {
    const leg = k.joint(s < 0 ? 'legL' : 'legR', null, s * 0.42, 1.05, 0);
    k.mesh(new THREE.BoxGeometry(0.46, 1.0, 0.5), skin, leg, 0, -0.48, 0);
    k.mesh(new THREE.BoxGeometry(0.52, 0.16, 0.7), hide, leg, 0, -0.98, 0.1);
  }
  k.mesh(new THREE.BoxGeometry(1.15, 0.45, 0.8), hide, null, 0, 1.08, 0); // peştamal

  const torso = k.joint('torso', null, 0, 1.15, 0);
  k.mesh(new THREE.IcosahedronGeometry(0.78, 1), skin, torso, 0, 0.62, 0).scale.set(1, 0.95, 0.75); // göbek
  k.mesh(new THREE.BoxGeometry(1.5, 0.55, 0.85), skin, torso, 0, 1.12, -0.02); // omuzlar
  const strap = k.mesh(new THREE.BoxGeometry(0.16, 1.5, 0.95), hide, torso, 0, 0.75, 0);
  strap.rotation.z = 0.7;

  const head = k.joint('head', torso, 0, 1.6, 0.08);
  k.mesh(new THREE.IcosahedronGeometry(0.46, 1), skin, head, 0, 0.1, 0);
  k.mesh(new THREE.SphereGeometry(0.21, 14, 10), k.mat(0xffffff, { roughness: 0.2, flat: false }), head, 0, 0.16, 0.36);
  k.mesh(new THREE.SphereGeometry(0.11, 10, 8), k.mat(0xc75b12, { flat: false }), head, 0, 0.16, 0.52);
  const pupil = k.mesh(new THREE.SphereGeometry(0.05, 8, 6), k.glow(0x1a0a00), head, 0, 0.16, 0.6);
  k.parts.castPoint = pupil;
  k.mesh(new THREE.BoxGeometry(0.62, 0.1, 0.18), skin, head, 0, 0.42, 0.33).rotation.x = 0.3; // kaş
  k.mesh(new THREE.BoxGeometry(0.34, 0.06, 0.05), k.glow(0x2a0a0a), head, 0, -0.14, 0.44); // ağız
  for (const s of [-1, 1]) k.mesh(new THREE.ConeGeometry(0.04, 0.12, 4), bone, head, s * 0.1, -0.08, 0.44); // dişler
  k.mesh(new THREE.ConeGeometry(0.1, 0.42, 6), bone, head, 0, 0.66, -0.05).rotation.x = -0.3; // boynuz

  for (const s of [-1, 1]) {
    const arm = k.joint(s < 0 ? 'armL' : 'armR', torso, s * 0.9, 1.15, 0);
    k.mesh(new THREE.BoxGeometry(0.4, 1.1, 0.42), skin, arm, 0, -0.5, 0);
    k.mesh(new THREE.IcosahedronGeometry(0.28, 0), skin, arm, 0, -1.12, 0.02);
    k.mesh(new THREE.BoxGeometry(0.46, 0.22, 0.48), hide, arm, 0, -0.75, 0);
    if (s > 0) {
      const club = k.joint('weapon', arm, 0, -1.12, 0.1);
      club.rotation.x = Math.PI / 2;
      k.mesh(new THREE.CylinderGeometry(0.32, 0.12, 1.7, 8), wood, club, 0, 0.75, 0);
      const spike = new THREE.ConeGeometry(0.07, 0.24, 4);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const sp = k.mesh(spike, iron, club, Math.cos(a) * 0.3, 1.2 + (i % 2) * 0.25, Math.sin(a) * 0.3);
        sp.rotation.z = -Math.cos(a) * Math.PI / 2;
        sp.rotation.x = Math.sin(a) * Math.PI / 2;
      }
    }
  }
  return { ...k, height: 3.3 };
}

// ------------------------------------------------------------
//  ELF OKÇU: kapüşonlu yeşil pelerin, sivri kulaklar, yay ve sadak
// ------------------------------------------------------------
function buildElf() {
  const k = new Kit();
  const cloak = k.mat(0x2f6b3a);
  const tunic = k.mat(0x5cd66a);
  const leather = k.mat(0x6b4a2b);
  const skin = k.mat(0xf3d6b8);
  const hair = k.mat(0xf0d878);
  const wood = k.mat(0x8a5a2b);

  for (const s of [-1, 1]) {
    const leg = k.joint(s < 0 ? 'legL' : 'legR', null, s * 0.13, 0.82, 0);
    k.mesh(new THREE.BoxGeometry(0.15, 0.8, 0.16), leather, leg, 0, -0.38, 0);
    k.mesh(new THREE.BoxGeometry(0.17, 0.1, 0.3), leather, leg, 0, -0.78, 0.06);
  }
  const torso = k.joint('torso', null, 0, 0.82, 0);
  k.mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.7, 8), tunic, torso, 0, 0.34, 0);
  k.mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.08, 8), leather, torso, 0, 0.1, 0);
  const cape = k.mesh(new THREE.ConeGeometry(0.42, 1.2, 8, 1, true), cloak, torso, 0, 0.35, -0.08);
  cape.material.side = THREE.DoubleSide;

  const head = k.joint('head', torso, 0, 0.88, 0);
  k.mesh(new THREE.SphereGeometry(0.2, 12, 10), skin, head, 0, 0, 0);
  k.mesh(new THREE.SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair, head, 0, 0.03, -0.02);
  const hood = k.mesh(new THREE.ConeGeometry(0.27, 0.55, 8), cloak, head, 0, 0.14, -0.1);
  hood.rotation.x = -0.6;
  for (const s of [-1, 1]) {
    const ear = k.mesh(new THREE.ConeGeometry(0.04, 0.26, 4), skin, head, s * 0.2, 0.04, -0.02);
    ear.rotation.z = -s * 1.1;
    k.mesh(new THREE.SphereGeometry(0.03, 6, 4), k.glow(0x2fd67a), head, s * 0.07, 0.03, 0.18);
  }

  // Sadak (sırtta)
  const quiver = k.mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), leather, torso, 0.14, 0.5, -0.24);
  quiver.rotation.z = -0.4;
  for (let i = 0; i < 3; i++) {
    k.mesh(new THREE.ConeGeometry(0.04, 0.12, 4), k.mat(0xffffff), torso, 0.24 + i * 0.03, 0.86 + i * 0.02, -0.24 - i * 0.02);
  }

  const armL = k.joint('armL', torso, -0.3, 0.62, 0);
  k.mesh(new THREE.BoxGeometry(0.1, 0.52, 0.1), tunic, armL, 0, -0.24, 0);
  const bow = k.joint('weapon', armL, 0, -0.52, 0.08);
  const limb = k.mesh(new THREE.TorusGeometry(0.62, 0.035, 5, 18, Math.PI), wood, bow, 0, 0, 0);
  limb.rotation.set(0, Math.PI / 2, Math.PI / 2);
  k.mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.24, 3), k.mat(0xf5f0e0), bow, 0, 0, -0.0);
  k.parts.castPoint = bow;

  const armR = k.joint('armR', torso, 0.3, 0.62, 0);
  k.mesh(new THREE.BoxGeometry(0.1, 0.52, 0.1), tunic, armR, 0, -0.24, 0);
  return { ...k, height: 1.95 };
}

// ------------------------------------------------------------
//  ŞÖVALYE: plaka zırh, sorguçlu miğfer, armalı kalkan, uzun kılıç
// ------------------------------------------------------------
function buildKnight() {
  const k = new Kit();
  const steel = k.mat(0xc9d1da, { metalness: 0.75, roughness: 0.3 });
  const darkSteel = k.mat(0x6c7580, { metalness: 0.7, roughness: 0.4 });
  const cloth = k.mat(0xb3202a);
  const gold = k.mat(0xffc83d, { metalness: 0.7, roughness: 0.3 });
  const leather = k.mat(0x4a3322);

  for (const s of [-1, 1]) {
    const leg = k.joint(s < 0 ? 'legL' : 'legR', null, s * 0.17, 0.85, 0);
    k.mesh(new THREE.BoxGeometry(0.2, 0.82, 0.22), darkSteel, leg, 0, -0.4, 0);
    k.mesh(new THREE.BoxGeometry(0.23, 0.12, 0.34), steel, leg, 0, -0.8, 0.05);
    k.mesh(new THREE.SphereGeometry(0.1, 6, 4), steel, leg, 0, -0.4, 0.1);
  }
  const torso = k.joint('torso', null, 0, 0.85, 0);
  k.mesh(new THREE.BoxGeometry(0.7, 0.75, 0.42), steel, torso, 0, 0.42, 0);
  k.mesh(new THREE.BoxGeometry(0.42, 0.55, 0.05), cloth, torso, 0, 0.36, 0.23); // tabard
  k.mesh(new THREE.BoxGeometry(0.14, 0.14, 0.02), gold, torso, 0, 0.45, 0.26);   // arma
  k.mesh(new THREE.BoxGeometry(0.74, 0.12, 0.46), leather, torso, 0, 0.06, 0);
  const cape = k.mesh(new THREE.BoxGeometry(0.66, 1.05, 0.04), cloth, torso, 0, 0.25, -0.24);
  cape.rotation.x = 0.12;
  k.parts.cape = cape;
  for (const s of [-1, 1]) k.mesh(new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), steel, torso, s * 0.42, 0.72, 0);

  const head = k.joint('head', torso, 0, 0.98, 0);
  k.mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.42, 10), steel, head, 0, 0.1, 0);
  k.mesh(new THREE.ConeGeometry(0.23, 0.18, 10), steel, head, 0, 0.4, 0);
  k.mesh(new THREE.BoxGeometry(0.34, 0.04, 0.05), k.glow(0x111111), head, 0, 0.14, 0.22); // vizör
  const plume = k.mesh(new THREE.ConeGeometry(0.08, 0.6, 6), cloth, head, 0, 0.62, -0.12);
  plume.rotation.x = -0.9;

  // Sol kol: kalkan
  const armL = k.joint('armL', torso, -0.46, 0.66, 0);
  k.mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), darkSteel, armL, 0, -0.28, 0);
  const shield = k.joint('shield', armL, -0.05, -0.38, 0.18);
  k.mesh(new THREE.BoxGeometry(0.08, 0.72, 0.56), cloth, shield, 0, 0, 0);
  k.mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), gold, shield, -0.01, 0.02, 0);
  k.mesh(new THREE.BoxGeometry(0.1, 0.1, 0.42), gold, shield, -0.01, 0.12, 0);
  k.mesh(new THREE.ConeGeometry(0.28, 0.3, 4), cloth, shield, 0, -0.5, 0).rotation.set(Math.PI, Math.PI / 4, 0);

  // Sağ kol: kılıç
  const armR = k.joint('armR', torso, 0.46, 0.66, 0);
  k.mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), darkSteel, armR, 0, -0.28, 0);
  const sword = k.joint('weapon', armR, 0, -0.6, 0.05);
  sword.rotation.x = Math.PI / 2;
  k.mesh(new THREE.BoxGeometry(0.08, 1.25, 0.03), k.mat(0xeef3f8, { metalness: 0.9, roughness: 0.15 }), sword, 0, 0.75, 0);
  k.mesh(new THREE.BoxGeometry(0.4, 0.07, 0.08), gold, sword, 0, 0.12, 0);
  k.mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), leather, sword, 0, -0.02, 0);
  const tip = k.mesh(new THREE.SphereGeometry(0.04, 4, 3), k.glow(0xffffff), sword, 0, 1.38, 0);
  k.parts.castPoint = tip;
  return { ...k, height: 2.25 };
}

// ------------------------------------------------------------
//  ŞİFACI: beyaz-altın cüppe, başının üstünde ışık halesi, güneş diskli asa
// ------------------------------------------------------------
function buildHealer() {
  const k = new Kit();
  const robe = k.mat(0xf4f0e6, { roughness: 0.6, flat: false });
  const gold = k.mat(0xffc83d, { metalness: 0.6, roughness: 0.3 });
  const skin = k.mat(0xe8c4a0);
  const hair = k.mat(0x6b3a1e);
  const wood = k.mat(0xd8c7a0);

  const torso = k.joint('torso', null, 0, 0, 0);
  k.mesh(new THREE.CylinderGeometry(0.34, 0.6, 1.45, 14), robe, torso, 0, 0.73, 0);
  k.mesh(new THREE.CylinderGeometry(0.61, 0.61, 0.08, 14), gold, torso, 0, 0.06, 0);
  k.mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 14), gold, torso, 0, 1.0, 0);
  k.mesh(new THREE.BoxGeometry(0.12, 1.1, 0.04), gold, torso, 0, 0.62, 0.38).rotation.x = -0.18; // ön şerit
  const head = k.joint('head', torso, 0, 1.62, 0);
  k.mesh(new THREE.SphereGeometry(0.26, 14, 10), skin, head, 0, 0, 0);
  k.mesh(new THREE.SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), hair, head, 0, 0.04, -0.03);
  k.mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.6, 10), hair, head, 0, -0.32, -0.16);
  const halo = k.mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 24), k.glow(0xfff1a0), head, 0, 0.42, -0.02);
  halo.rotation.x = Math.PI / 2;
  k.parts.halo = halo;

  const armL = k.joint('armL', torso, -0.4, 1.28, 0);
  k.mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.6, 8), robe, armL, 0, -0.28, 0);
  const armR = k.joint('armR', torso, 0.4, 1.28, 0);
  k.mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.6, 8), robe, armR, 0, -0.28, 0);
  k.mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.0, 6), wood, armR, 0.1, -0.25, 0.16);
  const sun = k.joint(null, armR, 0.1, 0.82, 0.16);
  k.mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 20), gold, sun, 0, 0, 0);
  const core = k.mesh(new THREE.IcosahedronGeometry(0.12, 1), k.mat(0xfff6c0, { emissive: 0xffd84a, emissiveIntensity: 2.5 }), sun, 0, 0, 0);
  k.parts.castPoint = core;
  k.parts.orb = core;
  return { ...k, height: 2.4 };
}

const BUILDERS = { wizard: buildWizard, cyclops: buildCyclops, elf: buildElf, knight: buildKnight, healer: buildHealer };

export function buildPlayerModel(character) {
  const build = BUILDERS[character.model] ?? buildWizard;
  const model = build();
  model.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return model;
}
