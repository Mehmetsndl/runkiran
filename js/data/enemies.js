// ============================================================
//  DÜŞMAN TÜRLERİ
//  Yeni yaratık eklemek için buraya bir giriş ekle, modelini
//  entities/EnemyModels.js içindeki BUILDERS'a yaz ve waves.js
//  içinde bir dalganın "types" listesine anahtarını ekle.
//   model  : EnemyModels.js içindeki kurucu anahtarı
//   scale  : model büyüklüğü
//   radius : çarpışma yarıçapı (ölçekten önce)
// ============================================================
export const ENEMY_TYPES = {
  goblin: {
    name: 'Goblin', model: 'goblin',
    color: 0x5cbf3a, eyeColor: 0xffee55,
    radius: 0.4, scale: 1.25,
    hp: 8, speed: 3.4, damage: 7, xp: 1,
    wordTier: 'easy', knockback: 1.2,
  },
  iskelet: {
    name: 'İskelet', model: 'iskelet',
    color: 0xe6dfc8, eyeColor: 0xff3b3b,
    radius: 0.4, scale: 1.15,
    hp: 10, speed: 2.6, damage: 10, xp: 2,
    wordTier: 'medium', knockback: 1,
  },
  ork: {
    name: 'Ork', model: 'ork',
    color: 0x6f8f3a, eyeColor: 0xffaa00,
    radius: 0.65, scale: 1.2,
    hp: 22, speed: 1.9, damage: 16, xp: 4,
    wordTier: 'hard', knockback: 0.6,
  },
  orkSefi: {
    name: 'Ork Şefi', model: 'orkSefi',
    color: 0x4d6b2c, eyeColor: 0xff2222,
    radius: 0.65, scale: 1.75,
    hp: 60, speed: 1.6, damage: 28, xp: 15,
    wordTier: 'hard', knockback: 0.3,
    elite: true,
  },
  // ---- Hızlı mini yaratıklar ----
  cin: {
    name: 'Cin', model: 'cin',
    color: 0xd8342a, eyeColor: 0xfff36a,
    radius: 0.32, scale: 1.0,
    hp: 5, speed: 6.4, damage: 5, xp: 1,
    wordTier: 'easy', knockback: 1.6,
  },
  kurt: {
    name: 'Kurt', model: 'kurt', anim: 'quad',
    color: 0x6d6a72, eyeColor: 0xffcc33,
    radius: 0.45, scale: 1.15,
    hp: 12, speed: 5.0, damage: 9, xp: 2,
    wordTier: 'medium', knockback: 1.1,
  },
  // ---- Ejderhalar ----
  yavruEjder: {
    name: 'Yavru Ejderha', model: 'ejder', anim: 'fly', fly: 1.5,
    color: 0x2f9a6a, eyeColor: 0xffe14a, belly: 0xd9c27a,
    radius: 0.55, scale: 1.0,
    hp: 24, speed: 2.6, damage: 12, xp: 5,
    wordTier: 'medium', knockback: 0.7,
    ai: 'spit', keepDist: 8.5, spitEvery: 3.6, spitDmg: 9,
  },
  // ---- BOSSLAR ----
  trol: {
    name: 'Dev Trol', model: 'trol',
    color: 0x6a8a9a, eyeColor: 0xff5a1a,
    radius: 0.7, scale: 2.5,
    hp: 260, speed: 1.6, damage: 30, xp: 45,
    wordTier: 'hard', knockback: 0.12,
    elite: true, boss: true, ai: 'charge', icon: '🪨',
  },
  kemikLord: {
    name: 'Kemik Lordu', model: 'lich', anim: 'float',
    color: 0x3a2a5a, eyeColor: 0x9dff6a, bone: 0xe6dfc8,
    radius: 0.6, scale: 2.2,
    hp: 340, speed: 1.4, damage: 26, xp: 60,
    wordTier: 'hard', knockback: 0.1,
    elite: true, boss: true, ai: 'summon', keepDist: 7, icon: '💀',
  },
  ejderKral: {
    name: 'Kızıl Ejderha', model: 'ejder', anim: 'fly', fly: 2.6, king: true,
    color: 0xb3221c, eyeColor: 0xffd84a, belly: 0xe8a33a,
    radius: 0.6, scale: 3.0,
    hp: 450, speed: 2.1, damage: 34, xp: 90,
    wordTier: 'hard', knockback: 0.08,
    elite: true, boss: true, ai: 'breath', keepDist: 8, spitDmg: 14, icon: '🐉',
  },
};
