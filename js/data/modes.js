// ============================================================
//  OYUN MODLARI
//  Yeni mod eklemek için:
//   1) Buraya bir tanım ekle (lider tablosu koleksiyonu ve sekmeleriyle)
//   2) systems/modes/ altında bir mod sınıfı yaz ve
//      systems/modes/index.js içindeki MODE_CLASSES'a kaydet
//
//  lb.collection : çevrim içi tablo koleksiyonunun adı
//  lb.tabs       : tablonun sütunları (tek tabloda yan yana; ilki varsayılan sıralama); key = skor alanı, fmt = gösterim biçimi,
//                  sum: true ise en iyi değer yerine toplam tutulur (ör. galibiyet)
//  type: 'naval' : kahraman seçimi yerine Deniz Savaşı lobisini açar
//  type: 'table' : kahraman seçiminden sonra Hükümdar Masası (Toprak Fethi) lobisi açılır
// ============================================================
export const MODES = [
  {
    id: 'hayatta',
    name: 'Hayatta Kalma',
    icon: '💀',
    color: '#e0303a',
    desc: 'Bitmeyen dalgalara karşı olabildiğince uzun dayan.',
    rules: ['Yaratıklar her dakika güçlenir, yeni türler katılır', 'Bosslar: Dev Trol, Kemik Lordu, Kızıl Ejderha', 'Ölünce oyun biter'],
    lb: {
      collection: 'scores',
      tabs: [
        { key: 'bestTime', label: '⏱ Süre', fmt: 'time' },
        { key: 'bestXp', label: '💎 Toplam XP', fmt: 'xp' },
      ],
    },
  },
  {
    id: 'kale',
    name: 'Kale Savunması',
    icon: '🏰',
    color: '#ffb347',
    desc: 'Burçta dur, bahçeli kaleni 10 dalga boyunca yazarak koru.',
    rules: ['Kahraman burçta sabit durur, imleçle nişan alır', 'Surlar yıkılırsa kaybedersin', 'Dalga aralarında surlar biraz onarılır'],
    lb: {
      collection: 'scoresKale',
      tabs: [
        { key: 'bestWave', label: '🏰 Dalga', fmt: 'wave' },
        { key: 'bestXp', label: '💎 Toplam XP', fmt: 'xp' },
      ],
    },
  },
  {
    id: 'akin',
    name: 'Akın',
    icon: '⚔️',
    color: '#b65cff',
    desc: '3 dakika, sel gibi yaratık. Olabildiğince çok kes.',
    rules: ['Süre bitince oyun biter', 'Yaratıklar hızlı ve kalabalık gelir', 'XP %50 fazla, daha sık kart seçersin'],
    lb: {
      collection: 'scoresAkin',
      tabs: [
        { key: 'bestKills', label: '⚔️ Öldürme', fmt: 'num' },
        { key: 'bestXp', label: '💎 Toplam XP', fmt: 'xp' },
      ],
    },
  },
  {
    id: 'deniz',
    name: 'Deniz Savaşı',
    icon: '⚓',
    color: '#2fb8d6',
    type: 'naval',
    desc: '3v3 çevrim içi kalyon savaşı. Top at ya da gemini koru.',
    rules: ['Roller rastgele: 1 Savunmacı, 2 Topçu', '6 kişi ya da 3 kişi + 3 yapay zekâ', 'Beklemeden antrenman da yapabilirsin'],
    lb: {
      collection: 'scoresDeniz',
      tabs: [
        { key: 'wins', label: '🏆 Galibiyet', fmt: 'num', sum: true },
        { key: 'bestImpact', label: '⭐ Katkı', fmt: 'num' },
      ],
    },
  },
  {
    id: 'boss',
    name: 'Boss Avı',
    icon: '🐉',
    color: '#c0392b',
    type: 'raid',
    desc: 'Tek başına ya da 2-4 arkadaşınla dev bir bossu yazarak devir.',
    rules: ['Dev Trol, Kemik Lordu ya da Kızıl Ejderha', 'Herkesin vuruşu ortak cana işler · fazlarda kart', '7 dakika içinde yen · düşen ekip arkadaşı kalkar'],
    lb: {
      collection: 'scoresBoss',
      tabs: [
        { key: 'wins', label: '🏆 Devrilen Boss', fmt: 'num', sum: true },
        { key: 'bestDmg', label: '⚔️ En Çok Hasar', fmt: 'num' },
      ],
    },
  },
  {
    id: 'masa',
    name: 'Hükümdar Masası',
    icon: '👑',
    color: '#d9a63a',
    type: 'table',
    desc: 'Masa üstünde 10×10 parsel: sahiplen, maden kur, tek ordunu büyüt, kelime yarışıyla komşunu fethet.',
    rules: ['Savaş = kelime yarışı: aynı kelimeyi önce ve hatasız yazan kazanır', 'Saldırıldığında sen de yazarsın; hızlıysan parselin elinde kalır', 'Sur × 3 ordu seviyesi gerekir · kalesi düşen elenir · 4 kişi çevrim içi'],
    lb: {
      collection: 'scoresMasa',
      tabs: [
        { key: 'wins', label: '👑 Galibiyet', fmt: 'num', sum: true },
        { key: 'bestDmg', label: '⚔️ Öldürülen', fmt: 'num' },
      ],
    },
  },
];

export const getMode = (id) => MODES.find((m) => m.id === id) ?? MODES[0];
