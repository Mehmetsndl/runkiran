// Oyuncunun yükseltilebilir istatistikleri. Karakter seçimi temel değerleri,
// yetenek kartları da oyun sırasında bu nesneyi değiştirir.
import { CONFIG } from '../config.js';

export function createBaseStats(character) {
  const base = {
    maxHp: CONFIG.PLAYER.maxHp,
    moveSpeed: CONFIG.PLAYER.speed,
    pickupRadius: CONFIG.PLAYER.pickupRadius,
    damageMult: 1,
    critChance: CONFIG.COMBAT.critChance,
    critMult: CONFIG.COMBAT.critMult,
    armor: 0,               // Alınan hasarı bu oranda azaltır (0.25 = %25)
    chainCount: 0,          // Şimşek Zinciri: ek sekme sayısı
    enemySpeedMult: 1,      // Buzul Alan: düşman hız çarpanı
    comboLetterBonus: 0,    // Kanlı Kombo: hatasız harf başına hasar bonusu
    explodeRadius: 0,       // Patlayan Rün
    lifesteal: 0,           // Vampir Dişi
    regen: 0,               // saniyede kendiliğinden dolan can (Şifacı)
    xpMult: 1,
    // ---- kartların kullandığı ek istatistikler (data/upgrades.js) ----
    chainDmgMult: 1, chainRangeMult: 1, explodeDmgMult: 1,
    ultRate: 1, ultOnKill: 0, ultPerLetter: 0,
    executeThreshold: 0, firstStrikeMult: 0, eliteMult: 0, knockbackMult: 1,
    fastCpsMult: 1, fastDmg: 0, missForgive: 0, comboHalf: false,
    longWordBonus: 0, shortWordBonus: 0, cleanWordBonus: 0, killStreak: 0,
    doubleChance: 0, luckyChance: 0, killStack: 0, lowHpDmg: 0,
    burnDps: 0, poisonDps: 0, freezeChance: 0, frostNova: 0,
    meteorEvery: 0, lightningChance: 0,
    doubleXpChance: 0, extraChoice: 0, revive: 0,
    // Kale Savunması
    goldMult: 1, thorns: 0, castleRegen: 0, helperDmgMult: 1, helperRate: 1, killRepair: 0,
    // Süreli kartların geçici etkileri (BuffSystem açıp kapatır)
    archerDmg: 1, archerRate: 1, guardDmg: 1, guardImmortal: 0, catapultRate: 1, oilMult: 1,
    castleShield: 0, goldBoost: 1, killHeal: 0,
  };
  return Object.assign(base, character?.stats ?? {});
}
