// ============================================================
//  YETENEK KARTLARI (60+ kart)
//  Yeni kart eklemek için UPGRADES dizisine bir nesne ekle:
//   id       : benzersiz anahtar
//   name     : kartta görünen ad
//   icon     : emoji
//   rarity   : RARITIES anahtarı (çıkma olasılığını ve etiketini belirler)
//   cat      : kategori (Kartlar sayfasındaki filtre için)
//   maxLevel : en fazla kaç kez alınabilir
//   desc(lv) : alınacak seviye için açıklama (HTML kullanılabilir)
//   apply(stats, game, lv) : etkiyi uygula
//   modes    : (isteğe bağlı) yalnızca bu oyun modlarında çıkar, ör. ['kale']
//   notModes : (isteğe bağlı) bu modlarda çıkmaz
//   requires : (isteğe bağlı) önce alınması gereken kartın id'si
//  Kartların kullandığı istatistikler data/stats.js içinde tanımlı.
// ============================================================

// chance: her kart yuvası için önce nadirlik bu olasılıklarla seçilir, sonra o
// nadirlikteki kartlardan biri rastgele gelir. (Havuzdaki kart sayısı olasılığı değiştirmez.)
export const RARITIES = {
  yaygin:   { label: 'Sıradan',  chance: 0.62 },
  nadir:    { label: 'Nadir',    chance: 0.28 },
  destansi: { label: 'Destansı', chance: 0.085 },
  efsanevi: { label: 'Efsanevi', chance: 0.015 },
};

export const CATEGORIES = {
  saldiri: '⚔️ Saldırı',
  kritik: '🎯 Kritik',
  yazma: '⌨️ Yazma',
  buyu: '✨ Büyü & Durum',
  hayatta: '❤️ Hayatta Kalma',
  ulti: '🌟 Ulti',
  gelisim: '💎 Gelişim',
  kale: '🏰 Kale',
  sure: '⏱️ Süreli',
};

const pct = (v) => `%${Math.round(v * 100)}`;

export const UPGRADES = [
  // ---------------- SALDIRI ----------------
  {
    id: 'keskinCelik', name: 'Keskin Çelik', icon: '🗡️', rarity: 'yaygin', cat: 'saldiri', maxLevel: 5,
    desc: () => 'Tüm hasar <b>+%25</b>.',
    apply: (s) => { s.damageMult += 0.25; },
  },
  {
    id: 'bilemeTasi', name: 'Bileme Taşı', icon: '🪨', rarity: 'yaygin', cat: 'saldiri', maxLevel: 5,
    desc: () => 'Tüm hasar <b>+%12</b>. Küçük ama birikir.',
    apply: (s) => { s.damageMult += 0.12; },
  },
  {
    id: 'ilkKan', name: 'İlk Kan', icon: '🩸', rarity: 'nadir', cat: 'saldiri', maxLevel: 3,
    desc: (lv) => `Canı tam olan düşmanlara <b>+%40</b> hasar. (Toplam ${pct(lv * 0.4)})`,
    apply: (s) => { s.firstStrikeMult += 0.4; },
  },
  {
    id: 'devAvcisi', name: 'Dev Avcısı', icon: '🏹', rarity: 'nadir', cat: 'saldiri', maxLevel: 3,
    desc: (lv) => `Boss'lara (Ork Şefi) <b>+%50</b> hasar. (Toplam ${pct(lv * 0.5)})`,
    apply: (s) => { s.eliteMult += 0.5; },
  },
  {
    id: 'kocbasi', name: 'Koçbaşı', icon: '🐏', rarity: 'yaygin', cat: 'saldiri', maxLevel: 3,
    desc: () => 'Vuruşların düşmanları <b>%50 daha uzağa</b> savurur.',
    apply: (s) => { s.knockbackMult += 0.5; },
  },
  {
    id: 'ciftAtis', name: 'Çift Atış', icon: '🎭', rarity: 'destansi', cat: 'saldiri', maxLevel: 3,
    desc: (lv) => `Kelime bitince <b>%15</b> şansla başka bir düşmana da bedava vurursun. (Şans ${pct(lv * 0.15)})`,
    apply: (s) => { s.doubleChance += 0.15; },
  },
  {
    id: 'ruhHasadi', name: 'Ruh Hasadı', icon: '👻', rarity: 'destansi', cat: 'saldiri', maxLevel: 3,
    desc: (lv) => `Her <b>20 öldürmede</b> kalıcı olarak <b>+%2</b> hasar. (20 öldürme başına ${pct(lv * 0.02)})`,
    apply: (s) => { s.killStack += 1; },
  },
  {
    id: 'sonNefes', name: 'Son Nefes', icon: '😤', rarity: 'nadir', cat: 'saldiri', maxLevel: 2, notModes: ['kale'],
    desc: () => 'Canın <b>%30</b>\'un altındayken hasarın <b>+%50</b>.',
    apply: (s) => { s.lowHpDmg += 0.5; },
  },
  {
    id: 'cellat', name: 'Cellat', icon: '🪓', rarity: 'destansi', cat: 'saldiri', maxLevel: 3,
    desc: (lv) => `Canı <b>${pct(lv * 0.08)}</b>'in altına düşen düşmanları anında <b>infaz</b> edersin.`,
    apply: (s) => { s.executeThreshold += 0.08; },
  },
  {
    id: 'kaderZari', name: 'Kader Zarı', icon: '🎲', rarity: 'efsanevi', cat: 'saldiri', maxLevel: 2,
    desc: (lv) => `Her kelimede <b>%10</b> şansla <b>3 KAT</b> hasar. (Şans ${pct(lv * 0.1)})`,
    apply: (s) => { s.luckyChance += 0.1; },
  },
  {
    id: 'savasNarasi', name: 'Savaş Narası', icon: '📯', rarity: 'efsanevi', cat: 'saldiri', maxLevel: 2,
    desc: () => 'Tüm hasar <b>+%40</b> ve kritik şansı <b>+%5</b>.',
    apply: (s) => { s.damageMult += 0.4; s.critChance += 0.05; },
  },

  // ---------------- KRİTİK ----------------
  {
    id: 'kartalGozu', name: 'Kartal Gözü', icon: '🎯', rarity: 'nadir', cat: 'kritik', maxLevel: 4,
    desc: () => 'Kritik vuruş şansı <b>+%10</b>.',
    apply: (s) => { s.critChance += 0.10; },
  },
  {
    id: 'sansliZar', name: 'Şanslı Nal', icon: '🍀', rarity: 'yaygin', cat: 'kritik', maxLevel: 4,
    desc: () => 'Kritik vuruş şansı <b>+%5</b>.',
    apply: (s) => { s.critChance += 0.05; },
  },
  {
    id: 'devVurusu', name: 'Dev Vuruşu', icon: '🔨', rarity: 'nadir', cat: 'kritik', maxLevel: 3,
    desc: () => 'Kritik hasar çarpanı <b>+0.75x</b>.',
    apply: (s) => { s.critMult += 0.75; },
  },
  {
    id: 'olumculDarbe', name: 'Ölümcül Darbe', icon: '☠️', rarity: 'efsanevi', cat: 'kritik', maxLevel: 2,
    desc: () => 'Kritik hasar çarpanı <b>+1.5x</b>.',
    apply: (s) => { s.critMult += 1.5; },
  },
  {
    id: 'zayifNokta', name: 'Zayıf Nokta', icon: '🔍', rarity: 'yaygin', cat: 'kritik', maxLevel: 3,
    desc: () => 'Kritik hasar çarpanı <b>+0.3x</b>.',
    apply: (s) => { s.critMult += 0.3; },
  },

  // ---------------- YAZMA ----------------
  {
    id: 'kanliKombo', name: 'Kanlı Kombo', icon: '💢', rarity: 'destansi', cat: 'yazma', maxLevel: 3,
    desc: (lv) => `Hatasız yazılan her harf hasarı <b>%10</b> artırır. (Harf başına toplam %${lv * 10}, hata yapınca sıfırlanır)`,
    apply: (s) => { s.comboLetterBonus += 0.10; },
  },
  {
    id: 'ritim', name: 'Ritim', icon: '🥁', rarity: 'yaygin', cat: 'yazma', maxLevel: 5,
    desc: () => 'Hatasız yazılan her harf hasarı <b>%4</b> artırır (kombo bonusu).',
    apply: (s) => { s.comboLetterBonus += 0.04; },
  },
  {
    id: 'hizliParmaklar', name: 'Hızlı Parmaklar', icon: '🖐️', rarity: 'yaygin', cat: 'yazma', maxLevel: 3,
    desc: () => '"Hızlı yazdın" bonusunu almak için gereken hız <b>%12</b> düşer.',
    apply: (s) => { s.fastCpsMult *= 0.88; },
  },
  {
    id: 'yildirimParmak', name: 'Yıldırım Parmak', icon: '⚡', rarity: 'nadir', cat: 'yazma', maxLevel: 3,
    desc: (lv) => `Hızlı yazılan kelimeler <b>+%25</b> hasar verir. (Toplam ${pct(lv * 0.25)})`,
    apply: (s) => { s.fastDmg += 0.25; },
  },
  {
    id: 'sogukkanlilik', name: 'Soğukkanlılık', icon: '🧊', rarity: 'nadir', cat: 'yazma', maxLevel: 3,
    desc: (lv) => `Hata yaptığında <b>%25</b> şansla kombo bozulmaz. (Şans ${pct(lv * 0.25)})`,
    apply: (s) => { s.missForgive += 0.25; },
  },
  {
    id: 'komboUstasi', name: 'Kombo Ustası', icon: '🔗', rarity: 'destansi', cat: 'yazma', maxLevel: 1,
    desc: () => 'Hata yapınca kombo sıfırlanmaz, sadece <b>yarıya</b> düşer.',
    apply: (s) => { s.comboHalf = true; },
  },
  {
    id: 'uzunSoz', name: 'Uzun Söz', icon: '📜', rarity: 'yaygin', cat: 'yazma', maxLevel: 4,
    desc: () => '5 ve daha uzun harfli kelimeler <b>+%15</b> hasar verir.',
    apply: (s) => { s.longWordBonus += 0.15; },
  },
  {
    id: 'kisaVeOz', name: 'Kısa ve Öz', icon: '✂️', rarity: 'yaygin', cat: 'yazma', maxLevel: 4,
    desc: () => '4 ve daha kısa harfli kelimeler <b>+%15</b> hasar verir.',
    apply: (s) => { s.shortWordBonus += 0.15; },
  },
  {
    id: 'kelimeCambazi', name: 'Kelime Cambazı', icon: '🤹', rarity: 'nadir', cat: 'yazma', maxLevel: 4,
    desc: () => 'Tek harf bile yanlış yazmadan bitirdiğin kelimeler <b>+%12</b> hasar verir.',
    apply: (s) => { s.cleanWordBonus += 0.12; },
  },
  {
    id: 'kanliHasat', name: 'Kanlı Hasat', icon: '🌾', rarity: 'nadir', cat: 'yazma', maxLevel: 3,
    desc: (lv) => `Her öldürme kombona <b>+${lv * 2}</b> harf ekler.`,
    apply: (s) => { s.killStreak += 2; },
  },

  // ---------------- BÜYÜ & DURUM ----------------
  {
    id: 'simsekZinciri', name: 'Şimşek Zinciri', icon: '⛓️', rarity: 'destansi', cat: 'buyu', maxLevel: 3,
    desc: (lv) => `Doğru yazılan kelimeler sekerek <b>2 düşmana daha</b> vurur. (Toplam sekme: ${lv * 2})`,
    apply: (s) => { s.chainCount += 2; },
  },
  {
    id: 'firtinaCagrisi', name: 'Fırtına Çağrısı', icon: '🌩️', rarity: 'efsanevi', cat: 'buyu', maxLevel: 1,
    desc: () => '<b>+4 sekme</b> ve sekmeler <b>%20</b> daha güçlü.',
    apply: (s) => { s.chainCount += 4; s.chainDmgMult += 0.2; },
  },
  {
    id: 'yuksekGerilim', name: 'Yüksek Gerilim', icon: '🔋', rarity: 'nadir', cat: 'buyu', maxLevel: 3, requires: 'simsekZinciri',
    desc: () => 'Sekmelerin hasarı <b>+%25</b>.',
    apply: (s) => { s.chainDmgMult += 0.25; },
  },
  {
    id: 'uzunMenzil', name: 'Uzun Menzil', icon: '📡', rarity: 'yaygin', cat: 'buyu', maxLevel: 3, requires: 'simsekZinciri',
    desc: () => 'Sekmelerin menzili <b>+%30</b>.',
    apply: (s) => { s.chainRangeMult += 0.3; },
  },
  {
    id: 'buzulAlan', name: 'Buzul Alan', icon: '❄️', rarity: 'nadir', cat: 'buyu', maxLevel: 2,
    desc: () => 'Düşmanların hareket hızı <b>%30</b> yavaşlar.',
    apply: (s) => { s.enemySpeedMult *= 0.7; },
  },
  {
    id: 'agirToprak', name: 'Ağır Toprak', icon: '🟫', rarity: 'yaygin', cat: 'buyu', maxLevel: 3,
    desc: () => 'Düşmanların hareket hızı <b>%10</b> yavaşlar.',
    apply: (s) => { s.enemySpeedMult *= 0.9; },
  },
  {
    id: 'buzDokunusu', name: 'Buz Dokunuşu', icon: '🥶', rarity: 'nadir', cat: 'buyu', maxLevel: 3,
    desc: (lv) => `Vuruşların <b>%10</b> şansla hedefi <b>1.2 sn</b> dondurur. (Şans ${pct(lv * 0.1)})`,
    apply: (s) => { s.freezeChance += 0.1; },
  },
  {
    id: 'buzPatlamasi', name: 'Buz Patlaması', icon: '💠', rarity: 'destansi', cat: 'buyu', maxLevel: 2,
    desc: (lv) => `Ölen düşmanlar çevresindeki (${2.5 + lv} m) yaratıkları <b>dondurur</b>.`,
    apply: (s, g, lv) => { s.frostNova = 2.5 + lv; },
  },
  {
    id: 'alevUcu', name: 'Alev Ucu', icon: '🔥', rarity: 'nadir', cat: 'buyu', maxLevel: 3,
    desc: (lv) => `Vurduğun düşman <b>3 sn yanar</b>: saniyede ${lv * 4} hasar.`,
    apply: (s) => { s.burnDps += 4; },
  },
  {
    id: 'zehirliUc', name: 'Zehirli Uç', icon: '🧪', rarity: 'nadir', cat: 'buyu', maxLevel: 3,
    desc: (lv) => `Vuruşlar zehir bırakır (5 kata kadar birikir): kat başına saniyede ${lv * 2} hasar.`,
    apply: (s) => { s.poisonDps += 2; },
  },
  {
    id: 'patlayanRun', name: 'Patlayan Rün', icon: '💥', rarity: 'efsanevi', cat: 'buyu', maxLevel: 3,
    desc: (lv) => `Ölen düşmanlar <b>patlar</b> ve çevresine hasar verir. (Yarıçap: ${2.5 + lv} m)`,
    apply: (s, game, lv) => { s.explodeRadius = 2.5 + lv; },
  },
  {
    id: 'barutKokusu', name: 'Barut Kokusu', icon: '🧨', rarity: 'nadir', cat: 'buyu', maxLevel: 3, requires: 'patlayanRun',
    desc: () => 'Patlamaların hasarı <b>+%50</b>.',
    apply: (s) => { s.explodeDmgMult += 0.5; },
  },
  {
    id: 'simsekCarpmasi', name: 'Gök Gürültüsü', icon: '🌪️', rarity: 'destansi', cat: 'buyu', maxLevel: 3,
    desc: (lv) => `Her kelimede <b>%12</b> şansla hedefin üstüne yıldırım düşer, çevresindekiler de çarpılır. (Şans ${pct(lv * 0.12)})`,
    apply: (s) => { s.lightningChance += 0.12; },
  },
  {
    id: 'goktasiCagrisi', name: 'Göktaşı Çağrısı', icon: '☄️', rarity: 'efsanevi', cat: 'buyu', maxLevel: 2,
    desc: (lv) => `Her <b>${lv === 1 ? 12 : 8}. kelimede</b> hedefe dev bir göktaşı düşer.`,
    apply: (s, g, lv) => { s.meteorEvery = lv === 1 ? 12 : 8; },
  },

  // ---------------- HAYATTA KALMA ----------------
  {
    id: 'kutsalKalkan', name: 'Kutsal Kalkan', icon: '🛡️', rarity: 'yaygin', cat: 'hayatta', maxLevel: 5, notModes: ['kale'],
    desc: () => 'Maksimum can <b>+25</b> ve canın tamamen dolar.',
    apply: (s, game) => { s.maxHp += 25; game.player.heal(s.maxHp); },
  },
  {
    id: 'demirDeri', name: 'Demir Deri', icon: '🦾', rarity: 'yaygin', cat: 'hayatta', maxLevel: 5, notModes: ['kale'],
    desc: () => 'Maksimum can <b>+15</b>.',
    apply: (s, game) => { s.maxHp += 15; game.player.heal(15); },
  },
  {
    id: 'zirhPlakasi', name: 'Zırh Plakası', icon: '🥋', rarity: 'nadir', cat: 'hayatta', maxLevel: 4, notModes: ['kale'],
    desc: () => 'Alınan hasar <b>%8</b> azalır.',
    apply: (s) => { s.armor = Math.min(0.7, s.armor + 0.08); },
  },
  {
    id: 'yenilenme', name: 'Yenilenme', icon: '🌿', rarity: 'yaygin', cat: 'hayatta', maxLevel: 4, notModes: ['kale'],
    desc: () => 'Saniyede <b>+0.6</b> can yenilenir.',
    apply: (s) => { s.regen += 0.6; },
  },
  {
    id: 'vampirDisi', name: 'Vampir Dişi', icon: '🦇', rarity: 'nadir', cat: 'hayatta', maxLevel: 3, notModes: ['kale'],
    desc: () => 'Her öldürme <b>+2 can</b> yeniler.',
    apply: (s) => { s.lifesteal += 2; },
  },
  {
    id: 'ruzgarCizmeleri', name: 'Rüzgâr Çizmeleri', icon: '👢', rarity: 'yaygin', cat: 'hayatta', maxLevel: 3, notModes: ['kale'],
    desc: () => 'Hareket hızı <b>+%15</b>.',
    apply: (s) => { s.moveSpeed *= 1.15; },
  },
  {
    id: 'anka', name: 'Anka Tüyü', icon: '🪶', rarity: 'efsanevi', cat: 'hayatta', maxLevel: 1, notModes: ['kale'],
    desc: () => 'Ölünce <b>bir kez</b> canının yarısıyla dirilirsin.',
    apply: (s) => { s.revive += 1; },
  },

  // ---------------- ULTİ ----------------
  {
    id: 'sabirsizRuh', name: 'Sabırsız Ruh', icon: '⏳', rarity: 'nadir', cat: 'ulti', maxLevel: 4,
    desc: () => 'Ulti <b>%15</b> daha hızlı dolar.',
    apply: (s) => { s.ultRate += 0.15; },
  },
  {
    id: 'efsaneKani', name: 'Efsane Kanı', icon: '🌟', rarity: 'destansi', cat: 'ulti', maxLevel: 3,
    desc: (lv) => `Her öldürme ultini <b>%1</b> doldurur. (Toplam %${lv})`,
    apply: (s) => { s.ultOnKill += 0.01; },
  },
  {
    id: 'murekkepRuhu', name: 'Mürekkep Ruhu', icon: '🖋️', rarity: 'nadir', cat: 'ulti', maxLevel: 3,
    desc: (lv) => `Doğru yazılan her harf ultini <b>%0.2</b> doldurur. (Toplam %${(lv * 0.2).toFixed(1)})`,
    apply: (s) => { s.ultPerLetter += 0.002; },
  },
  {
    id: 'yildizKirigi', name: 'Yıldız Kırığı', icon: '💫', rarity: 'yaygin', cat: 'ulti', maxLevel: 5,
    desc: () => 'Ultin anında <b>%35</b> dolar.',
    apply: (s, game) => { game.ult.charge = Math.min(1, game.ult.charge + 0.35); },
  },

  // ---------------- GELİŞİM ----------------
  {
    id: 'bilgeKitabi', name: 'Bilge Kitabı', icon: '📖', rarity: 'yaygin', cat: 'gelisim', maxLevel: 3,
    desc: () => 'Kazanılan XP <b>+%20</b>.',
    apply: (s) => { s.xpMult += 0.2; },
  },
  {
    id: 'alimGozlugu', name: 'Âlimin Gözlüğü', icon: '👓', rarity: 'yaygin', cat: 'gelisim', maxLevel: 5,
    desc: () => 'Kazanılan XP <b>+%10</b>.',
    apply: (s) => { s.xpMult += 0.1; },
  },
  {
    id: 'altinKristal', name: 'Altın Kristal', icon: '💎', rarity: 'yaygin', cat: 'gelisim', maxLevel: 3,
    desc: (lv) => `Ölen düşmanlar <b>%15</b> şansla iki kat kristal düşürür. (Şans ${pct(lv * 0.15)})`,
    apply: (s) => { s.doubleXpChance += 0.15; },
  },
  {
    id: 'ruhMiknatisi', name: 'Ruh Mıknatısı', icon: '🧲', rarity: 'yaygin', cat: 'gelisim', maxLevel: 3, notModes: ['kale'],
    desc: () => 'XP kristali toplama alanı <b>+%50</b>.',
    apply: (s) => { s.pickupRadius *= 1.5; },
  },
  {
    id: 'bereket', name: 'Bereket', icon: '🃏', rarity: 'efsanevi', cat: 'gelisim', maxLevel: 1,
    desc: () => 'Seviye atlayınca <b>3 yerine 4 kart</b> arasından seçersin.',
    apply: (s) => { s.extraChoice = 1; },
  },

  // ---------------- KALE (yalnızca Kale Savunması) ----------------
  {
    id: 'tasUstasi', name: 'Taş Ustası', icon: '🧱', rarity: 'nadir', cat: 'kale', maxLevel: 4, modes: ['kale'],
    desc: () => 'Surların maksimum canı <b>+100</b> ve surlar <b>%40</b> onarılır.',
    apply: (s, game) => { const c = game.castle; if (c) { c.maxHp += 100; c.repair(c.maxHp * 0.4); } },
  },
  {
    id: 'kutsalSancak', name: 'Kutsal Sancak', icon: '🚩', rarity: 'destansi', cat: 'kale', maxLevel: 2, modes: ['kale'],
    desc: () => 'Sura vuran yaratıklar <b>%25 daha az</b> hasar verir.',
    apply: (s, game) => { if (game.mode?.cfg) game.mode.castleDmgReduce = (game.mode.castleDmgReduce ?? 0) + 0.25; },
  },
  {
    id: 'hazineAvcisi', name: 'Hazine Avcısı', icon: '🪙', rarity: 'yaygin', cat: 'kale', maxLevel: 4, modes: ['kale'],
    desc: () => 'Öldürmelerden kazanılan altın <b>+%25</b>.',
    apply: (s) => { s.goldMult += 0.25; },
  },
  {
    id: 'altinYagmuru', name: 'Altın Yağmuru', icon: '💰', rarity: 'yaygin', cat: 'kale', maxLevel: 99, modes: ['kale'],
    desc: () => 'Anında <b>+90 altın</b>.',
    apply: (s, game) => { game.mode?.works?.addGold(90, true); },
  },
  {
    id: 'dikenliSurlar', name: 'Dikenli Surlar', icon: '🌵', rarity: 'nadir', cat: 'kale', maxLevel: 3, modes: ['kale'],
    desc: (lv) => `Sura vuran her yaratık <b>${lv * 8}</b> hasar yer.`,
    apply: (s) => { s.thorns += 8; },
  },
  {
    id: 'surOnarici', name: 'Duvarcı Loncası', icon: '👷', rarity: 'nadir', cat: 'kale', maxLevel: 3, modes: ['kale'],
    desc: (lv) => `Surlar saniyede <b>${(lv * 1.5).toFixed(1)}</b> can onarılır.`,
    apply: (s) => { s.castleRegen += 1.5; },
  },
  {
    id: 'kutsalTas', name: 'Kutsal Taş', icon: '🔮', rarity: 'destansi', cat: 'kale', maxLevel: 3, modes: ['kale'],
    desc: (lv) => `Her öldürme surları <b>${lv * 2}</b> onarır.`,
    apply: (s) => { s.killRepair += 2; },
  },
  {
    id: 'ustaOkcular', name: 'Usta Askerler', icon: '🎖️', rarity: 'nadir', cat: 'kale', maxLevel: 3, modes: ['kale'],
    desc: () => 'Muhafız, okçu ve mancınıkların hasarı <b>+%30</b>.',
    apply: (s) => { s.helperDmgMult += 0.3; },
  },
  {
    id: 'mancinikUstasi', name: 'Savaş Davulu', icon: '🪘', rarity: 'destansi', cat: 'kale', maxLevel: 3, modes: ['kale'],
    desc: () => 'Muhafız, okçu ve mancınıklar <b>%20</b> daha hızlı saldırır.',
    apply: (s) => { s.helperRate += 0.2; },
  },
];

// ---------------- SÜRELİ KARTLAR ----------------
// Seçildiği an etkisi başlar, süre bitince kalkar (systems/BuffSystem.js).
// add: istatistiğe eklenir/çıkarılır, mul: çarpılır/bölünür. Aynı kart tekrar gelirse süre yenilenir.
const TIMED = [
  { id: 'okFirtinasi', name: 'Ok Fırtınası', icon: '🏹', rarity: 'nadir', modes: ['kale'], dur: 20,
    text: 'Okçular <b>2 kat hasar</b> vurur ve <b>%50</b> hızlı atar.', mul: { archerDmg: 2, archerRate: 1.5 } },
  { id: 'demirDuvar', name: 'Demir Duvar', icon: '🧱', rarity: 'nadir', modes: ['kale'], dur: 20,
    text: 'Surlar <b>%60 daha az</b> hasar alır.', add: { castleShield: 0.6 } },
  { id: 'muhafizOfkesi', name: 'Muhafız Öfkesi', icon: '⚔️', rarity: 'nadir', modes: ['kale'], dur: 20,
    text: 'Muhafızlar <b>2 kat hasar</b> vurur ve <b>ölümsüz</b> olur.', mul: { guardDmg: 2 }, add: { guardImmortal: 1 } },
  { id: 'tasYagmuru', name: 'Taş Yağmuru', icon: '🪨', rarity: 'destansi', modes: ['kale'], dur: 15,
    text: 'Mancınıklar <b>3 kat hızlı</b> taş fırlatır.', mul: { catapultRate: 3 } },
  { id: 'kizginYag', name: 'Kızgın Yağ', icon: '🫕', rarity: 'yaygin', modes: ['kale'], dur: 20,
    text: 'Kaynar yağ <b>3 kat</b> yakar.', mul: { oilMult: 3 } },
  { id: 'altinSaati', name: 'Altın Saati', icon: '⏰', rarity: 'yaygin', modes: ['kale'], dur: 30,
    text: 'Öldürmelerden <b>2 kat altın</b> kazanırsın.', mul: { goldBoost: 2 } },
  { id: 'adrenalin', name: 'Adrenalin', icon: '💉', rarity: 'yaygin', dur: 15,
    text: 'Tüm hasar <b>+%60</b>.', add: { damageMult: 0.6 } },
  { id: 'keskinGoz', name: 'Şahin Bakışı', icon: '🦅', rarity: 'yaygin', dur: 15,
    text: 'Kritik şansı <b>+%30</b>.', add: { critChance: 0.3 } },
  { id: 'zamanYavaslar', name: 'Zaman Yavaşlar', icon: '⌛', rarity: 'nadir', dur: 12,
    text: 'Düşmanlar <b>%50 yavaş</b> yürür.', mul: { enemySpeedMult: 0.5 } },
  { id: 'ultiCoskusu', name: 'Ulti Coşkusu', icon: '🌠', rarity: 'nadir', dur: 20,
    text: 'Ulti <b>3 kat hızlı</b> dolar.', mul: { ultRate: 3 } },
  { id: 'alevRuhu', name: 'Alev Ruhu', icon: '☀️', rarity: 'yaygin', dur: 20,
    text: 'Her vuruş düşmanı <b>yakar</b> (saniyede +8 hasar).', add: { burnDps: 8 } },
  { id: 'kristalAkini', name: 'Kristal Akını', icon: '💠', rarity: 'yaygin', dur: 30,
    text: 'Kazanılan XP <b>2 kat</b>.', mul: { xpMult: 2 } },
  { id: 'firtinaBulutu', name: 'Fırtına Bulutu', icon: '☁️', rarity: 'nadir', dur: 20,
    text: 'Kelimeler <b>+3 düşmana</b> daha seker.', add: { chainCount: 3 } },
  { id: 'kanHirsi', name: 'Kan Hırsı', icon: '🧛', rarity: 'yaygin', notModes: ['kale'], dur: 20,
    text: 'Her öldürme <b>+4 can</b> yeniler.', add: { lifesteal: 4 } },
  { id: 'savasTanrisi', name: 'Savaş Tanrısı', icon: '🔱', rarity: 'efsanevi', dur: 15,
    text: 'Hasar <b>2 kat</b>, kritik şansı <b>+%25</b>, ulti <b>2 kat</b> hızlı dolar.', mul: { damageMult: 2, ultRate: 2 }, add: { critChance: 0.25 } },
];
for (const t of TIMED) {
  const card = {
    ...t, cat: 'sure', maxLevel: 99, timed: true,
    desc: () => `<b>${t.dur} sn</b> boyunca: ${t.text}`,
    apply: (s, game) => game.buffs.add(card),
  };
  UPGRADES.push(card);
}

// Tüm kartlar maksimuma ulaşınca boşlukları dolduran kartlar
export const FALLBACK_UPGRADES = [
  {
    id: 'sifaliIksir', name: 'Şifalı İksir', icon: '🍷', rarity: 'yaygin', cat: 'hayatta', maxLevel: Infinity, notModes: ['kale'],
    desc: () => "Canının <b>%40</b>'ını yeniler.",
    apply: (s, game) => { game.player.heal(s.maxHp * 0.4); },
  },
  {
    id: 'hazineSandigi', name: 'Hazine Sandığı', icon: '🧰', rarity: 'yaygin', cat: 'kale', maxLevel: Infinity, modes: ['kale'],
    desc: () => 'Anında <b>+60 altın</b> ve surlar <b>%10</b> onarılır.',
    apply: (s, game) => { game.mode?.works?.addGold(60, true); game.castle?.repair(game.castle.maxHp * 0.1); },
  },
];

/** Bir kart bu modda çıkabilir mi? */
export function cardAllowed(u, mode) {
  return (!u.modes || u.modes.includes(mode)) && !(u.notModes ?? []).includes(mode);
}
