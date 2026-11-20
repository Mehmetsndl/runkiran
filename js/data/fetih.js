// ============================================================
//  HÜKÜMDAR MASASI · PARSEL FETHİ AYARLARI
//  Masanın üstü 10×10 parsellik bir harita. Her hükümdarın TEK bir ordusu
//  vardır. Boş parselleri altınla sahiplenir, maden / kamp / sur kurar,
//  kampta birlik yetiştirir. Saldırıda iki ordu karşılaşır ve KELİME
//  YARIŞI başlar: aynı kelimeyi önce ve hatasız yazan o kelimeyi kazanır,
//  rakibinin ordusundan birlik öldürür. Savunan daha çok kelime kazanırsa
//  parsel elinde kalır.
// ============================================================

export const FETIH = {
  size: 10,
  startGold: 14,
  turnTime: 45,           // insan oyuncunun tur süresi (sn)
  maxRounds: 18,          // dolarsa en çok parseli olan kazanır
  attacks: 2,             // tur başına saldırı hakkı
  claimCost: 3,           // boş parseli sahiplenme (orman/cevher +1)
  baseIncome: 4,
  parcelIncome: 0.5,      // her parsel yarım altın
  wallCost: [0, 5, 9, 14],
  wallReq: 3,             // sur seviyesi × 3 = saldırmak için gereken en düşük ordu seviyesi
  campCost: [0, 8, 12, 18],
  mineCost: [0, 6, 9, 14],
  mineIncome: [0, 3, 6, 10],
  lootPer: { mine: 4, camp: 3, wall: 2 },
  capitalLoot: 0.5,
  battle: {
    words: 7,             // kelime yarışı uzunluğu
    wordTime: 7,          // bir kelime için en fazla süre (sn)
    pause: 0.7,           // kelimeler arası kısa ara
    killBase: 1,          // kazanılan kelime başına öldürme: 1 + ordu seviyesi / killPerLevel
    killPerLevel: 10,
  },
  // Yapay zekâ yazma hızı: kelime başına 0.5 + harf × perChar sn (× beceri), ara sıra hata yapar
  ai: { perChar: 0.36, typo: 0.14, think: 0.5 },
  bandit: { perChar: 0.5 },
  queues: {
    f4: { need: 4, name: '4 Kişilik', desc: '4 gerçek hükümdar toplanınca başlar.' },
    f2: { need: 2, name: '2 Kişilik (+2 YZ)', desc: '2 oyuncu, boş koltuklara yapay zekâ oturur.' },
  },
};

// Birlikler: lvl = ordu seviyesine katkı, camp = gereken kamp seviyesi
export const UNITS = [
  { id: 'piyade',   name: 'Piyade',   icon: '🗡️', lvl: 1, cost: 2,  camp: 1, text: 'Ucuz kalabalık. Ordu sayısını büyütür.' },
  { id: 'okcu',     name: 'Okçu',     icon: '🏹', lvl: 2, cost: 4,  camp: 1, text: 'Ok yağmuru: savaş başında her 2 okçu 1 düşman öldürür.' },
  { id: 'atli',     name: 'Atlı',     icon: '🐎', lvl: 3, cost: 6,  camp: 2, text: 'Sağlam seviye: surları aşmak için ideal.' },
  { id: 'buyucu',   name: 'Büyücü',   icon: '🔮', lvl: 3, cost: 8,  camp: 2, text: 'Kazandığın her kelimede her 2 büyücü +1 düşman yakar.' },
  { id: 'mancinik', name: 'Mancınık', icon: '🪨', lvl: 4, cost: 10, camp: 3, text: 'Saldırırken her mancınık savunanın sur avantajını 1 kelime azaltır.' },
  { id: 'dev',      name: 'Dev',      icon: '🗿', lvl: 5, cost: 13, camp: 3, text: 'En yüksek seviye: öldürme gücünü ve sur sınırını yükseltir.' },
];
export const UNIT_BY_ID = Object.fromEntries(UNITS.map((u) => [u.id, u]));
export const UNIT_INDEX = Object.fromEntries(UNITS.map((u, i) => [u.id, i]));

export const TERRAIN = {
  cayir:  { name: 'Çayır',  icon: '🌱', color: 0x7aa84a, color2: 0x86b454, claim: 0, pass: true },
  orman:  { name: 'Orman',  icon: '🌲', color: 0x3d7a34, color2: 0x46853a, claim: 1, pass: true },
  cevher: { name: 'Cevher', icon: '💎', color: 0x8a7a62, color2: 0x96866c, claim: 1, pass: true, ore: true },
  harabe: { name: 'Harabe', icon: '🏚️', color: 0x9a8a6a, color2: 0xa49474, claim: 0, pass: true },
  dag:    { name: 'Dağ',    icon: '⛰️', color: 0x7d7f84, color2: 0x7d7f84, claim: 0, pass: false },
  gol:    { name: 'Göl',    icon: '🌊', color: 0x2f6f9a, color2: 0x2f6f9a, claim: 0, pass: false },
  kale:   { name: 'Kale',   icon: '🏰', color: 0x8a8070, color2: 0x8a8070, claim: 0, pass: true },
  hazine: { name: 'Hazine', icon: '👑', color: 0xc9a24a, color2: 0xd2ab52, claim: 0, pass: true },
};

export const SEAT_COLORS = [0x3f7bff, 0xe0303a, 0x3fbf5a, 0xe8a33a];
export const SEAT_CSS = ['#3f7bff', '#e0303a', '#3fbf5a', '#e8a33a'];
export const SEAT_NAMES = ['Mavi', 'Kızıl', 'Yeşil', 'Altın'];
export const CAPITAL_CELLS = [[1, 8], [1, 1], [8, 1], [8, 8]];

export const FETIH_PASSIVES = {
  buyucu:  { text: 'Büyücüler 2 altın ucuz; 1 büyücüyle başlar.', unitDiscount: { buyucu: 2 }, startUnits: { buyucu: 1 } },
  tepegoz: { text: 'Devler 3 altın ucuz; kalesi 2. seviye surla başlar.', unitDiscount: { dev: 3 }, startWall: 2 },
  okcu:    { text: 'Okçular 1 altın ucuz; 3 okçuyla başlar.', unitDiscount: { okcu: 1 }, startUnits: { okcu: 3 } },
  sovalye: { text: 'Atlılar 2 altın ucuz; kampı 2. seviyeden başlar.', unitDiscount: { atli: 2 }, startCamp: 2 },
  sifaci:  { text: 'Savaşta kaybettiği birliklerin yarısı iyileşip geri döner.', saveChance: 0.5 },
};

// ---------- Harita üretimi (tohumdan, herkeste aynı) ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function buildMap(seed) {
  const N = FETIH.size;
  for (let attempt = 0; attempt < 40; attempt++) {
    const r = rng(seed + attempt * 7919);
    const cells = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) cells.push({ id: y * N + x, x, y, terrain: 'cayir', garrison: 0, loot: 0 });
    const at = (x, y) => cells[y * N + x];
    const nearCap = (x, y) => CAPITAL_CELLS.some(([cx, cy]) => Math.abs(cx - x) <= 1 && Math.abs(cy - y) <= 1);
    for (let y = 0; y < N / 2; y++) for (let x = 0; x < N / 2; x++) {
      if (nearCap(x, y)) continue;
      const v = r();
      let t = 'cayir';
      if (v < 0.07) t = 'dag'; else if (v < 0.1) t = 'gol'; else if (v < 0.24) t = 'orman'; else if (v < 0.36) t = 'cevher'; else if (v < 0.42) t = 'harabe';
      for (const [mx, my] of [[x, y], [N - 1 - x, y], [x, N - 1 - y], [N - 1 - x, N - 1 - y]]) at(mx, my).terrain = t;
    }
    CAPITAL_CELLS.forEach(([cx, cy]) => {
      at(cx, cy).terrain = 'kale';
      at(cx < N / 2 ? cx + 1 : cx - 1, cy).terrain = 'cevher';
    });
    for (const [x, y] of [[4, 4], [5, 4], [4, 5], [5, 5]]) { const c = at(x, y); c.terrain = 'hazine'; c.garrison = 6; c.loot = 18; c.wall = 1; }
    for (const c of cells) if (c.terrain === 'harabe') { c.garrison = 2 + Math.floor(r() * 3); c.loot = 6 + Math.floor(r() * 6); }
    const ok = CAPITAL_CELLS.every(([cx, cy]) => {
      const seen = new Set([cy * N + cx]);
      const q = [[cx, cy]];
      while (q.length) {
        const [x, y] = q.shift();
        if (at(x, y).terrain === 'hazine') return true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
          const id = ny * N + nx;
          if (seen.has(id) || !TERRAIN[at(nx, ny).terrain].pass) continue;
          seen.add(id);
          q.push([nx, ny]);
        }
      }
      return false;
    });
    if (ok) {
      for (const c of cells) c.adj = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([dx, dy]) => [c.x + dx, c.y + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < N && y < N).map(([x, y]) => y * N + x);
      return cells;
    }
  }
  throw new Error('harita kurulamadı');
}

export function armyLevel(units) { return UNITS.reduce((a, u, i) => a + (units[i] || 0) * u.lvl, 0); }
export function armyCount(units) { return units.reduce((a, n) => a + (n || 0), 0); }
/** Kazanılan kelime başına öldürme */
export function killsPerWord(units) {
  const b = FETIH.battle;
  return b.killBase + Math.floor(armyLevel(units) / b.killPerLevel) + Math.floor((units[UNIT_INDEX.buyucu] || 0) / 2);
}

// Kelime yarışı havuzu: gerçek, akıcı yazılan 4-7 harfli kelimeler
export const RACE_WORDS = [
  'kale', 'kral', 'taht', 'ordu', 'kılıç', 'kalkan', 'mızrak', 'zırh', 'miğfer', 'sancak', 'bayrak', 'surlar',
  'savaş', 'zafer', 'akın', 'fetih', 'hücum', 'yağma', 'ganimet', 'hazine', 'altın', 'gümüş', 'maden', 'cevher',
  'okçu', 'atlı', 'piyade', 'şövalye', 'büyücü', 'devler', 'mancınık', 'kuşatma', 'kapı', 'kule', 'hendek',
  'köprü', 'orman', 'çayır', 'nehir', 'dağlar', 'vadi', 'harabe', 'kervan', 'pazar', 'demirci', 'örs', 'çekiç',
  'balta', 'topuz', 'gürz', 'yayla', 'ok', 'yay', 'sadak', 'eyer', 'dizgin', 'nal', 'tuğ', 'davul', 'zurna',
  'meşale', 'mum', 'ateş', 'duman', 'kül', 'rüzgar', 'fırtına', 'yıldız', 'şafak', 'gece', 'gölge', 'iksir',
  'tılsım', 'rün', 'asa', 'parşömen', 'harita', 'pusula', 'casus', 'elçi', 'vezir', 'paşa', 'sultan', 'hakan',
  'bey', 'beylik', 'otağ', 'çadır', 'kamp', 'nöbet', 'muhafız', 'tuzak', 'pusu', 'akıncı', 'yiğit', 'cesur',
  'sadık', 'hain', 'isyan', 'barış', 'antlaşma', 'vergi', 'tahıl', 'ambar', 'değirmen', 'kuyu', 'çeşme', 'avlu',
  'burç', 'mazgal', 'zindan', 'zincir', 'anahtar', 'kilit', 'sandık', 'kese', 'sikke', 'mühür', 'ferman', 'divan',
  'meydan', 'arena', 'düello', 'galip', 'mağlup', 'kahraman', 'efsane', 'destan', 'ozan', 'saz', 'şölen', 'kadeh',
];
