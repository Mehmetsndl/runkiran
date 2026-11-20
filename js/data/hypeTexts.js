// ============================================================
//  COŞKU (DOPAMİN) YAZILARI
//  Ekranda uçuşan büyük yazılar buradan seçilir.
//  Dizilerde her seferinde rastgele biri gelir.
// ============================================================
export const HYPE = {
  // Kritik vuruşla öldürme
  critKill: ['KRİTİK!', 'PARAMPARÇA!', 'UN UFAK!', 'TAM İSABET!', 'EZİLDİ!', 'ÇATIR ÇUTUR!'],

  // Kritik + canının 2 katı hasarla öldürme (ekranı en çok sarsan)
  overkill: ['YOK EDİLDİ!', 'TOZ OLDU!', 'BUHAR OLDU!', 'İMHA!', 'GÖKTEN İNDİ!'],

  // Elit (Ork Şefi) öldürme
  elite: ['ŞEF DÜŞTÜ!', 'DEV AVCISI!', 'EFSANEVİ!', 'TAHT SARSILDI!'],

  // Kısa süre içinde art arda öldürme sayısı
  multi: {
    2: 'ÇİFTE!',
    3: 'ÜÇLÜ KATLİAM!',
    4: 'DÖRTLÜ!',
    5: 'DURDURULAMAZ!',
    7: 'KIYAMET!',
    10: 'TANRISAL!',
  },

  // Hatasız art arda yazılan harf sayısı
  streak: {
    10: 'ISINDIN!',
    20: 'ALEV ALDIN!',
    35: 'KUSURSUZ!',
    50: 'KLAVYE USTASI!',
    75: 'RÜN EFENDİSİ!',
    100: 'ÖLÜMSÜZ!',
  },

  // Kelime çok hızlı yazıldığında
  fast: ['HIZLI!', 'ŞİMŞEK PARMAK!', 'SERİ!', 'IŞIK HIZI!'],

  // Şimşek Zinciri birden fazla düşmana sekince ({n} = vurulan sayısı)
  chain: 'ZİNCİR x{n}!',
};

export const pickHype = (list) => list[Math.floor(Math.random() * list.length)];
