// ============================================================
//  BETİMLEYİCİ POZLAR (yetenek animasyonları)
//  Hem ana oyundaki kahraman hem Deniz Savaşı'ndaki mürettebat kullanır.
//  poseArms(tür, k, t) → kol/gövde açıları; k = 0..1 pozun gücü,
//  t = geçen süre (titreşimli pozlar için).
// ============================================================
export function poseEnvelope(remaining, dur, rise = 0.15, fall = 0.2) {
  const elapsed = dur - remaining;
  const up = Math.min(1, elapsed / rise);
  const down = Math.min(1, remaining / fall);
  const k = Math.min(up, down);
  return k * k * (3 - 2 * k); // yumuşak geçiş
}

export function poseArms(type, k, t) {
  switch (type) {
    case 'raise': // iki el göğe (şifa, büyü)
      return { armL: -2.9 * k, armR: -2.9 * k, armLz: 0.4 * k, armRz: -0.4 * k, torsoX: -0.18 * k };
    case 'bowUp': // yayı göğe doğrult
      return { armL: -2.6 * k, armR: -2.1 * k, armLz: 0.1 * k, armRz: -0.2 * k, torsoX: -0.3 * k };
    case 'point': // "Ateş!" komutu
      return { armL: -0.4 * k, armR: -1.7 * k, armLz: 0, armRz: -0.15 * k, torsoX: 0.18 * k };
    case 'hammer': // çekiç sallama
      return { armL: -0.8 * k, armR: (-2.3 + Math.max(0, Math.sin(t * 14)) * 1.9) * k, armLz: 0, armRz: 0, torsoX: (0.2 + Math.max(0, Math.sin(t * 14)) * 0.25) * k };
    case 'shield': // kollar öne, kalkan kurma
      return { armL: -1.6 * k, armR: -1.6 * k, armLz: 0.7 * k, armRz: -0.7 * k, torsoX: -0.05 * k };
    case 'cheer': // zafer sevinci
      return { armL: (-2.8 + Math.sin(t * 9) * 0.35) * k, armR: (-2.8 - Math.sin(t * 9) * 0.35) * k, armLz: 0.5 * k, armRz: -0.5 * k, torsoX: -0.2 * k };
    case 'slump': // yenilgi
      return { armL: 0.2 * k, armR: 0.2 * k, armLz: 0, armRz: 0, torsoX: 0.55 * k };
    default:
      return null;
  }
}
