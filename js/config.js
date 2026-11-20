// ============================================================
//  RÜNKIRAN — Genel Ayarlar
//  Oyunun dengesini buradan ayarlayabilirsin.
// ============================================================
export const CONFIG = {
  ARENA_SIZE: 140,

  CAMERA: {
    viewSize: 12,            // Ortografik kameranın yarı yüksekliği (dünya birimi)
    offset: [22, 26, 22],    // İzometrik açı için kamera ofseti
  },

  PLAYER: {
    maxHp: 100,
    speed: 7.5,
    radius: 0.6,
    pickupRadius: 3.5,
    invulnTime: 0.6,         // Hasar aldıktan sonraki dokunulmazlık süresi (sn)
  },

  MOVE: {
    defaultMode: 'follow',   // 'follow' = imleci takip et | 'click' = tıkla & git
    deadZone: 1.0,           // Takip modunda imlece bu mesafeden yakınsa dur
    arriveDist: 0.25,
  },

  COMBAT: {
    baseDamage: 12,
    critChance: 0.08,
    critMult: 2.2,
    fastTypingCps: 7,        // Saniyede bu kadar harf ve üstü = hız bonusu
    fastCritBonus: 0.35,     // Hızlı yazınca eklenen kritik şansı
    comboLetterCap: 25,      // Kanlı Kombo bonusunun sayacağı maksimum harf
    projectileSpeed: 26,
    chainRange: 9,
    chainDamageFactor: 0.75,
    explosionDamageFactor: 0.6,
  },

  WAVES: {
    spawnRadius: 26,
    minSpawnDist: 18,
    hpScalePerMinute: 0.2,   // Her dakika düşman canı %20 artar
  },

  TYPING: {
    // Klavyende ç, ğ, ı, ö, ş, ü yoksa false yap: bu harfleri içeren kelimeler elenir.
    allowTurkishChars: true,
  },

  FX: {
    shakeMax: 0.9,
    shakeDecay: 2.2,
    shakeOnKill: 0.28,
    shakeOnCrit: 0.5,
    hitStop: 0.07,           // Öldürmede kısa "donma" efekti (sn)
    particlesPerKill: 26,
    multiKillWindow: 1.2,    // Bu süre içindeki öldürmeler zincir sayılır
  },

  XP: {
    baseToLevel: 5,
    growth: 1.3,
    flatGrowth: 2,
  },
};
