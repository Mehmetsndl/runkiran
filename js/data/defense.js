// ============================================================
//  KALE SAVUNMASI AYARLARI
//  waves: her dalganın içeriği { düşmanTürü: adet }
//  Dalga sayısını artırmak için listeye yeni satır eklemen yeterli.
// ============================================================
export const DEFENSE = {
  castleHp: 500,
  viewSize: 22,            // kale modunda kamera daha geniş görür (normalde 12)
  camShift: 9,             // kamera yaratıkların geldiği yöne bu kadar kayar
  spread: 0.28,            // yaratıkların geldiği yolun genişliği (radyan)
  // Kart (seviye) eğrisi: bu modda ilerleme çoğunlukla dükkândan gelir, kartlar seyrek çıkar.
  // Bir oyunda ~6-7 kart. (Normal modlar: 5 → ×1.3 + 2)
  xpCurve: { baseToLevel: 14, growth: 1.5, flatGrowth: 8 },
  startGold: 80,           // başlangıç altını
  waveGold: [30, 10],      // dalga bitince: 30 + dalga × 10 altın
  goldPer: { goblin: 3, iskelet: 5, ork: 10, orkSefi: 40 },
  firstWaveDelay: 5,       // oyunun başında hazırlık süresi (sn)
  intermission: 7,         // dalgalar arası mola (sn)
  repairBetweenWaves: 0.1, // her dalga sonunda kalenin maks. canının %10'u onarılır
  spawnRadius: 36,         // kaleye uzaklık (yaratıklar hep aynı yoldan, kapıya doğru gelir)
  attackInterval: 1.3,     // kaleye vuran yaratığın vuruş aralığı (sn)
  castleDamageMult: 0.6,   // yaratık hasarının kaleye uygulanan oranı
  hpScalePerWave: 0.17,    // her dalgada düşman canı %17 artar
  dmgScalePerWave: 0.06,   // her dalgada sura vuruş hasarı %6 artar
  waves: [
    { goblin: 10 },
    { goblin: 12, iskelet: 4 },
    { goblin: 14, iskelet: 7 },
    { goblin: 12, iskelet: 9, ork: 3 },
    { goblin: 14, iskelet: 10, ork: 4, orkSefi: 1 },
    { goblin: 16, iskelet: 12, ork: 6 },
    { goblin: 18, iskelet: 14, ork: 7, orkSefi: 1 },
    { goblin: 20, iskelet: 16, ork: 9, orkSefi: 1 },
    { goblin: 22, iskelet: 18, ork: 11, orkSefi: 2 },
    { goblin: 26, iskelet: 20, ork: 14, orkSefi: 3 },
  ],
};

// ============================================================
//  KALE DÜKKÂNI (altınla alınan yükseltmeler ve yardımcılar)
//  key    : kısayol tuşu
//  max    : en fazla kaç kez alınabilir (Infinity = sınırsız)
//  costs  : seviyeye göre fiyat listesi  ya da  cost + growth (her alımda çarpılır)
// ============================================================
export const SHOP = [
  { id: 'sur', key: '1', icon: '🧱', name: 'Sur Yükseltmesi', max: 3, costs: [180, 380, 650],
    desc: (lv) => ['Sağlam Sur: daha yüksek duvar, payandalar, +250 can', 'Demir Sur: demir kazıklar, sancaklar, +300 can', 'Altın Kale: altın kenarlı mermer surlar, +400 can'][lv] ?? 'En üst seviye' },
  { id: 'okcu', key: '2', icon: '🏹', name: 'Sur Okçusu', max: 6, cost: 110, growth: 1.45,
    desc: () => 'Kule tepesine okçu yerleşir, uzaktan ok yağdırır' },
  { id: 'muhafiz', key: '3', icon: '🛡️', name: 'Muhafız', max: 4, cost: 90, growth: 1.5,
    desc: () => 'Kapı önünde mızraklı muhafız: yaklaşanları deşer' },
  { id: 'mancinik', key: '4', icon: '🪨', name: 'Mancınık', max: 2, costs: [260, 500],
    desc: () => 'Avluya mancınık kurulur: kalabalığa dev taş fırlatır' },
  { id: 'yag', key: '5', icon: '🔥', name: 'Kaynar Yağ', max: 3, costs: [160, 290, 450],
    desc: (lv) => `Sura dayananlar haşlanır: saniyede ${HELPERS.oilDps[lv + 1] ?? HELPERS.oilDps[3]} hasar` },
  { id: 'hazine', key: '6', icon: '💰', name: 'Hazine Odası', max: 3, costs: [120, 220, 360],
    desc: () => 'Öldürmelerden gelen altın +%25' },
  { id: 'onarim', key: '7', icon: '🔧', name: 'Onarım', max: Infinity, cost: 60, growth: 1.18,
    desc: () => 'Surları anında %30 onarır' },
];

/** Yardımcıların gücü (kart: Usta Askerler / Savaş Davulu ile artar) */
export const HELPERS = {
  okcu: { damage: 4, interval: 1.7, range: 22 },
  muhafiz: { damage: 6, interval: 1.1, range: 1.4, leash: 5, speed: 4.5 },
  mancinik: { damage: 16, interval: 5.5, radius: 2.8, range: 30 },
  oilDps: [0, 3, 5, 8],
  wallHp: [0, 250, 300, 400],
};

