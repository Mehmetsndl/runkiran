// ============================================================
//  BOSS AVI AYARLARI
//  Tek başına ya da arkadaşlarla (2-4 kişi) aynı bossa karşı.
//  Bossun canı oyuncu sayısına göre artar; herkesin vuruşu ortak cana işler.
// ============================================================
export const BOSS_RAID = {
  timeLimit: 420,          // 7 dakika içinde yenilmezse kaybedersin
  enrageAt: 330,           // 5:30'dan sonra boss öfkelenir (hasar ×1.6, yetenekler hızlanır)
  perPlayerHp: 0.7,        // her ek oyuncu için boss canı +%70
  reviveTime: 8,           // çevrim içi: düşen oyuncu 8 sn sonra %50 canla kalkar
  phases: [0.66, 0.33],    // canın bu oranlarında yeni faz: yetenekler hızlanır, herkese kart
  addsEvery: 13,           // bu kadar saniyede bir yardımcı yaratık grubu
  queues: {
    b2: { need: 2, name: '2 Kişilik Av', desc: '2 avcı toplanınca başlar.' },
    b3: { need: 3, name: '3 Kişilik Av', desc: '3 avcı toplanınca başlar.' },
    b4: { need: 4, name: '4 Kişilik Av', desc: '4 avcı toplanınca başlar.' },
  },
  difficulties: {
    kolay: { name: 'Kolay', hp: 0.7, dmg: 0.75, icon: '🟢' },
    normal: { name: 'Normal', hp: 1, dmg: 1, icon: '🟡' },
    zor: { name: 'Zor', hp: 1.45, dmg: 1.35, icon: '🔴' },
  },
};

/** Boss Avı'nda çıkılabilecek bosslar (ENEMY_TYPES anahtarı + av ayarları) */
export const RAID_BOSSES = [
  {
    id: 'trol', name: 'Dev Trol', icon: '🪨', hp: 1400, stars: 1,
    desc: 'Sopasını kaldırınca hamle yapar, yere vurup şok dalgası çıkarır.',
    adds: { goblin: 3, cin: 2 },
  },
  {
    id: 'kemikLord', name: 'Kemik Lordu', icon: '💀', hp: 1700, stars: 2,
    desc: 'Ölüleri diriltir, yeşil ruh halkası patlatır. Halkadan uzak dur.',
    adds: { iskelet: 3, cin: 1 },
  },
  {
    id: 'ejderKral', name: 'Kızıl Ejderha', icon: '🐉', hp: 2100, stars: 3,
    desc: 'Ateş püskürtür, ateş topu yağdırır, yavru ejderha çağırır.',
    adds: { cin: 3, kurt: 2 },
  },
];
export const RAID_BOSS_BY_ID = Object.fromEntries(RAID_BOSSES.map((b) => [b.id, b]));
