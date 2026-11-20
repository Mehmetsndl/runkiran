// ============================================================
//  OYNANABİLİR KARAKTERLER
//  Yeni karakter eklemek için:
//   1) Buraya bir nesne ekle (stats, attack, model, bars...)
//   2) entities/PlayerModels.js içine "model" anahtarıyla bir kurucu yaz
//   3) Yeni bir saldırı türü gerekiyorsa CombatSystem.fire() içine ekle
//
//  attack : 'bolt'  = güdümlü büyü küresi
//           'slam'  = yere vurup önündeki şeride alan hasarı
//           'arrow' = yolundaki her düşmanı delen ok
//           'dash'  = hedefe atılıp etrafını biçen kılıç
//           'beam'  = anında vuran ışık hüzmesi (vurdukça can kazandırır)
//  stats  : data/stats.js içindeki temel değerlerin üzerine yazılır
//  bars   : seçim ekranındaki 1-5 arası özellik çubukları
//  ult    : Space ile kullanılan ulti; cooldown = dolma süresi (sn),
//           etkisi systems/UltimateSystem.js içinde karakter id'sine göre yazılı
// ============================================================
export const CHARACTERS = [
  {
    id: 'buyucu',
    name: 'Büyücü',
    title: 'Rün Ustası',
    icon: '🔮',
    color: '#4aa3ff',
    model: 'wizard',
    attack: 'bolt',
    radius: 0.6,
    stats: { maxHp: 100, moveSpeed: 7.5, damageMult: 1, chainCount: 1 },
    ability: {
      name: 'Rün Küresi',
      text: 'Kelime bitince hedefe güdümlü bir büyü küresi uçar ve yakındaki 1 düşmana daha seker.',
    },
    pros: ['Büyüleri hedefi asla ıskalamaz', 'Başlangıçta 1 sekme'],
    cons: ['Kalabalığa karşı alan hasarı zayıf'],
    bars: { Can: 3, Hız: 3, Hasar: 3, Alan: 2 },
    ult: { name: 'Meteor Yağmuru', icon: '☄️', cooldown: 35, text: 'Gökten çevrendeki 12 yaratığa kadar meteor yağdırır. Her meteor çarptığı yerde patlar.' },
  },
  {
    id: 'tepegoz',
    name: 'Tepegöz',
    title: 'Tek Gözlü Dev',
    icon: '👁️',
    color: '#e0a040',
    model: 'cyclops',
    attack: 'slam',
    radius: 1.0,
    stats: { maxHp: 180, moveSpeed: 4.8, damageMult: 1.3, pickupRadius: 3, armor: 0.25 },
    slam: { length: 9, width: 3.6, windup: 0.28 },
    ability: {
      name: 'Yer Sarsıntısı',
      text: 'Dev topuzunu hedefe doğru yere vurur. 9 metrelik şeritteki bütün yaratıklar ezilir ve savrulur.',
    },
    pros: ['180 can ve %25 zırh', 'Tek vuruşta bütün sırayı ezer'],
    cons: ['Çok yavaş ve ağır yürür', 'Vurmadan önce topuzu kaldırması zaman alır'],
    bars: { Can: 5, Hız: 1, Hasar: 5, Alan: 4 },
    ult: { name: 'Deprem', icon: '🌋', cooldown: 40, text: 'Yeri yarar: 11 metre içindeki herkes ağır hasar alır, savrulur ve 3 saniye sersemler.' },
  },
  {
    id: 'okcu',
    name: 'Elf Okçu',
    title: 'Orman Gölgesi',
    icon: '🏹',
    color: '#5cd66a',
    model: 'elf',
    attack: 'arrow',
    radius: 0.5,
    stats: { maxHp: 70, moveSpeed: 9.5, damageMult: 0.9, critChance: 0.2, critMult: 2.6, pickupRadius: 4.5 },
    ability: {
      name: 'Delici Ok',
      text: 'Ok hedefe uçar ve yolundaki bütün yaratıkları deler geçer. Kritik vuruş şansı yüksektir.',
    },
    pros: ['En hızlı karakter', '%20 kritik şansı ve geniş toplama alanı'],
    cons: ['Yalnızca 70 can, iki üç darbede düşer'],
    bars: { Can: 1, Hız: 5, Hasar: 3, Alan: 3 },
    ult: { name: 'Ok Yağmuru', icon: '🌧️', cooldown: 25, text: 'Dört bir yana 16 delici ok birden atar.' },
  },
  {
    id: 'sovalye',
    name: 'Şövalye',
    title: 'Demir Yemin',
    icon: '🛡️',
    color: '#d9e1ea',
    model: 'knight',
    attack: 'dash',
    radius: 0.65,
    stats: { maxHp: 130, moveSpeed: 7, damageMult: 1.15, armor: 0.15 },
    dash: { radius: 3.4, speed: 60 },
    ability: {
      name: 'Hücum Kesiği',
      text: 'Hedefe şimşek gibi atılır, vardığı yerde kılıcıyla dönerek etrafındaki herkesi biçer. Atılırken hasar almaz.',
    },
    pros: ['Atılırken dokunulmaz, kuşatmadan kaçar', '130 can ve %15 zırh'],
    cons: ['Kendini yaratıkların ortasına atar', 'Uzak hedefe atılmak riskli olabilir'],
    bars: { Can: 4, Hız: 3, Hasar: 4, Alan: 3 },
    ult: { name: 'Çelik Kasırga', icon: '🌪️', cooldown: 30, text: '3.5 saniye boyunca dokunulmaz olur, dönerek çevresini biçer ve daha hızlı koşar.' },
  },
  {
    id: 'sifaci',
    name: 'Şifacı',
    title: 'Işığın Rahibesi',
    icon: '✨',
    color: '#ffe680',
    model: 'healer',
    attack: 'beam',
    radius: 0.55,
    stats: { maxHp: 110, moveSpeed: 7.2, damageMult: 0.95, regen: 1.2, lifesteal: 0 },
    beam: { heal: 3 },
    ability: {
      name: 'Işık Hüzmesi',
      text: 'Hedefi anında bir ışık hüzmesiyle vurur. Her isabet 3 can yeniler, ayrıca saniyede 1.2 can kendiliğinden dolar.',
    },
    pros: ['Sürekli kendini iyileştirir', 'Hüzme anında vurur, ıskalamaz'],
    cons: ['Hasarı düşük', 'Alan hasarı yok'],
    bars: { Can: 3, Hız: 3, Hasar: 2, Alan: 1 },
    ult: { name: 'Kutsal Işık', icon: '💖', cooldown: 45, text: 'Canının %60\'ını basar (Kale modunda kaleyi de %20 onarır) ve 8 metre içindeki yaratıkları yakıp iter.' },
  },
];

export const getCharacter = (id) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
