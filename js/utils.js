// Küçük yardımcı fonksiyonlar
export const rand = (a, b) => a + Math.random() * (b - a);
export const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** { anahtar: ağırlık } nesnesinden ağırlıklı rastgele seçim */
export function pickWeighted(weights) {
  let total = 0;
  for (const k in weights) total += weights[k];
  let r = Math.random() * total;
  for (const k in weights) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return Object.keys(weights)[0];
}

export function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Türkçe kurallarına göre büyük/küçük harf (i ↔ İ, ı ↔ I) */
export const trUpper = (s) => s.toLocaleUpperCase('tr-TR');
export const trLower = (s) => s.toLocaleLowerCase('tr-TR');

/** Tekrarlanabilir rastgele sayı üreteci (sahne dekoru için) */
export function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
