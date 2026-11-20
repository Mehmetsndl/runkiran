// ============================================================
//  DENİZ SAVAŞI AYARLARI
//  Her takımda 3 kişi: 1 Savunmacı (gemiyi onarır, güçlendirir),
//  2 Topçu (düşman gemisine top atar). Roller rastgele dağıtılır.
// ============================================================
export const NAVAL = {
  shipHp: 1500,
  duration: 240,              // maç süresi (sn); bitince canı (yüzde) fazla olan kazanır
  countdown: 3,
  queues: {
    v6: { need: 6, name: '6 Kişilik (3v3)', desc: '6 gerçek oyuncu toplanınca başlar.' },
    v3: { need: 3, name: '3 Kişilik (3 oyuncu + 3 AI)', desc: '3 oyuncu bir takım olur, rakip takım yapay zekâ.' },
  },

  // Topçu: kelime bitince top ateşlenir
  fire: { base: 16, perLetter: 4, critMult: 1.6, fastCps: 7, critChance: 0.1, barrelMult: 3, maxPerShot: 140 },
  // Savunmacı istasyonları
  repair: { amount: 26 },                       // 🔧 Onar (kısa kelime)
  armor: { step: 0.07, max: 0.35 },             // 🛡️ Zırh (uzun kelime), kalıcı
  hull: { maxHp: 80, heal: 60, max: 5 },        // ⚓ Gövde (uzun kelime): maks. can +80
  // Barut fıçısı: arada bir düşman gemisinde belirir, ilk vuran 3 kat hasar verir
  barrel: { every: 18, life: 9 },

  // Yapay zekâ oyuncular (saniye aralıkları)
  ai: {
    attackEvery: [2.2, 3.6],
    defendEvery: [2.4, 3.8],
  },

  // Kelimeler
  barrelWords: ['barut', 'fıçı', 'patla', 'kıvılcım', 'bomba'],
};

export const TEAM_NAMES = ['Mavi Kalyon', 'Kızıl Kalyon'];
export const TEAM_COLORS = [0x2f6fff, 0xd8323a];
export const ROLE_INFO = {
  savunma: { name: 'Savunmacı', icon: '🛡️', help: 'Kendi gemindeki kelimeleri yaz: Onar, Zırh, Gövde.' },
  topcu: { name: 'Topçu', icon: '💣', help: 'Düşman gemisinin üzerindeki kelimeleri yaz, top ateşle.' },
};
