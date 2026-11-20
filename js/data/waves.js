// ============================================================
//  DALGALAR (WAVES)
//  start      : dalganın başladığı saniye
//  spawnEvery : kaç saniyede bir doğum yapılır
//  batch      : her doğumda kaç yaratık
//  maxAlive   : sahnedeki en fazla yaratık
//  types      : { düşmanTürü: ağırlık }
//  elite      : { type, every (sn), immediate (dalga başında hemen doğsun mu) }
//  Son dalga bitmez; zorluk config.js'teki hpScalePerMinute ile artmaya devam eder.
// ============================================================
//  boss       : dalga başında doğan boss (dizi olabilir)
//  swarm      : { type, every, count } aynı yönden gelen sürü (ör. 8 cin birden)
export const WAVES = [
  {
    start: 0, title: '1. Dalga', subtitle: 'Goblin Sürüsü',
    spawnEvery: 1.6, batch: 1, maxAlive: 8,
    types: { goblin: 1 },
  },
  {
    start: 30, title: '2. Dalga', subtitle: 'Cinler Koşuyor!',
    spawnEvery: 1.4, batch: 2, maxAlive: 12,
    types: { goblin: 3, cin: 2 },
    swarm: { type: 'cin', every: 25, count: 5 },
  },
  {
    start: 70, title: '3. Dalga', subtitle: 'Mezarlıktan Yükselenler',
    spawnEvery: 1.3, batch: 2, maxAlive: 14,
    types: { goblin: 2, cin: 2, iskelet: 3 },
  },
  {
    start: 115, title: '4. Dalga', subtitle: 'Ork Akını · Ork Şefi geliyor!',
    spawnEvery: 1.15, batch: 2, maxAlive: 17,
    types: { goblin: 2, cin: 2, iskelet: 3, ork: 2 },
    elite: { type: 'orkSefi', every: 40, immediate: true },
  },
  {
    start: 175, title: '👑 BOSS', subtitle: 'Dağlar titriyor… Dev Trol!',
    spawnEvery: 1.4, batch: 2, maxAlive: 14,
    types: { goblin: 2, cin: 3, iskelet: 2 },
    boss: 'trol',
  },
  {
    start: 240, title: '6. Dalga', subtitle: 'Kurt Sürüsü',
    spawnEvery: 1.0, batch: 3, maxAlive: 22,
    types: { cin: 2, iskelet: 2, ork: 2, kurt: 4 },
    swarm: { type: 'kurt', every: 22, count: 5 },
    elite: { type: 'orkSefi', every: 35 },
  },
  {
    start: 310, title: '7. Dalga', subtitle: 'Gökyüzü kararıyor: Yavru Ejderhalar!',
    spawnEvery: 1.0, batch: 3, maxAlive: 24,
    types: { cin: 3, iskelet: 2, ork: 2, kurt: 2, yavruEjder: 2 },
    elite: { type: 'orkSefi', every: 30 },
  },
  {
    start: 400, title: '👑 BOSS', subtitle: 'Kemik Lordu ölüleri diriltiyor!',
    spawnEvery: 1.1, batch: 3, maxAlive: 22,
    types: { cin: 3, iskelet: 3, kurt: 2, yavruEjder: 1 },
    boss: 'kemikLord',
  },
  {
    start: 470, title: '9. Dalga', subtitle: 'Cin Fırtınası',
    spawnEvery: 0.8, batch: 3, maxAlive: 28,
    types: { cin: 6, kurt: 3, ork: 2, yavruEjder: 2 },
    swarm: { type: 'cin', every: 14, count: 9 },
    elite: { type: 'orkSefi', every: 30 },
  },
  {
    start: 560, title: '10. Dalga', subtitle: 'Ejder Yuvası',
    spawnEvery: 0.85, batch: 3, maxAlive: 28,
    types: { cin: 3, iskelet: 2, ork: 3, kurt: 2, yavruEjder: 4 },
    swarm: { type: 'kurt', every: 20, count: 6 },
    elite: { type: 'orkSefi', every: 25 },
  },
  {
    start: 660, title: '👑 BOSS', subtitle: 'KIZIL EJDERHA uyandı!',
    spawnEvery: 1.0, batch: 3, maxAlive: 24,
    types: { cin: 4, kurt: 2, ork: 2, yavruEjder: 2 },
    boss: 'ejderKral',
  },
  {
    start: 760, title: 'Kıyamet', subtitle: 'Her şey aynı anda geliyor',
    spawnEvery: 0.7, batch: 4, maxAlive: 32,
    types: { cin: 4, iskelet: 3, ork: 3, kurt: 3, yavruEjder: 3 },
    swarm: { type: 'cin', every: 15, count: 10 },
    elite: { type: 'orkSefi', every: 20, immediate: true },
  },
  {
    start: 870, title: '👑 ÇİFTE BOSS', subtitle: 'Trol ve Kemik Lordu birlikte!',
    spawnEvery: 0.8, batch: 3, maxAlive: 28,
    types: { cin: 4, iskelet: 3, kurt: 3, yavruEjder: 2 },
    boss: ['trol', 'kemikLord'],
  },
  {
    start: 990, title: 'Sonsuz Gece', subtitle: 'Hayatta kalabildiğin kadar...',
    spawnEvery: 0.6, batch: 4, maxAlive: 36,
    types: { cin: 4, iskelet: 3, ork: 4, kurt: 3, yavruEjder: 4 },
    swarm: { type: 'kurt', every: 14, count: 7 },
    elite: { type: 'orkSefi', every: 18, immediate: true },
    // Bu dalgadan sonra her bossEvery saniyede sıradaki boss gelir
    bossCycle: { every: 150, list: ['ejderKral', 'trol', 'kemikLord', ['ejderKral', 'trol']] },
  },
];

// ============================================================
//  AKIN MODU DALGALARI (3 dakika)
//  Hayatta Kalma ile aynı biçim; daha hızlı ve kalabalık.
// ============================================================
export const BLITZ_WAVES = [
  {
    start: 0, title: 'AKIN BAŞLADI!', subtitle: '3 dakikan var',
    spawnEvery: 0.9, batch: 2, maxAlive: 12,
    types: { goblin: 3, iskelet: 1 },
  },
  {
    start: 50, title: 'Sel Büyüyor', subtitle: 'İskeletler ve orklar katılıyor',
    spawnEvery: 0.8, batch: 2, maxAlive: 16,
    types: { goblin: 3, iskelet: 2, ork: 1 },
  },
  {
    start: 110, title: 'Son Dakika!', subtitle: 'Ork Şefi sahada',
    spawnEvery: 0.65, batch: 3, maxAlive: 20,
    types: { goblin: 3, iskelet: 3, ork: 2 },
    elite: { type: 'orkSefi', every: 30, immediate: true },
  },
  {
    start: 160, title: 'Son 20 Saniye!', subtitle: 'Hepsini kes!',
    spawnEvery: 0.5, batch: 3, maxAlive: 24,
    types: { goblin: 4, iskelet: 3, ork: 2 },
  },
];
