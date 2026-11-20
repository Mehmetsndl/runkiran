// ============================================================
//  KELİME HAVUZLARI
//  Yalnızca gerçek Türkçe kelimeler. Kelimeler harf sayısına göre
//  otomatik ayrılır:
//   easy   : 3 harf  (Goblin, Cin)
//   medium : 4 harf  (İskelet, Kurt)
//   hard   : 5 harf  (Ork, Ejderha)
//   epic   : 6-7 harf (Boss Avı)
//  Kelime çekme "torba" usulüdür: torba boşalana kadar aynı kelime
//  tekrar gelmez, torba bitince karıştırılıp yeniden dolar.
//  Yeni kelime eklemek için aşağıdaki listeye yazman yeterli.
// ============================================================
import { CONFIG } from '../config.js';

const WORDS = `
ada ağa ahu akı ala alt ana ant arı arp art aşı aşk ata ayı baş bel ben bey bez bin bir boy boz buz can cam cep cin
çam çan çay çit çok dağ dal dam dar dev diş dil don dut düş efe eğe fal fes fil gaz gem göl göz gül gün güz hal han
hap hat hız hoş huy ilk iri kar kaş kaz kel kes kil kin kir koç kol kor koz kul kum kuş kül küp lal laf mal mat mum
muz nal nar ney not oba oda ova oya pas pay pil pul put raf ray rün saç saf sal saz sel ses sır sis son suç şah şal
şan şef şiş şok tam tan taş tay tek tel ter tez tok top toz tuğ tül tüy tuz ulu üst var vur yağ yak yan yar yaş yay
yaz yel yem yer yol yön yük yün yüz zar zil zor zam kat kap kan kır kış kız kök köy ruh rol aba acı ark asa bal bay
bit bol boş but çağ çiğ çim çöl çöp din dip diz dua düz ela fer gam gök göç haz her hür ırk kek kep kıl kın küf mor
nem nur oto ölü örs pak pek pis sağ sap set sim soy süt şut tat tav tef tip tiz ton tur tüp üye zan zat kuğu
alev ateş kale zırh büyü kurt ölüm yara taht okçu şato kral hain cadı ordu kuyu yele nara gürz pala ayak ayva baba
bina cami ceza dere deve dost elma emir ekim emek gece gemi hava ışık ilaç ince kafa kalp kamp kapı kara kask keçi
kedi kule kuzu lale masa meşe ocak oyun ozan örgü para pars peri saat sopa soba tava uçak ufuk ulak uyku vadi vali
yaka yama zeka akın arka avcı ayna boğa cüce çakı çene çivi dede dolu elçi erik eser ezgi fare gaga inci inek kaya
kese kupa küpe leke lira orak öykü öfke pusu taze tepe zarf akıl alay anıt arpa aşçı avlu baca bant bere boru burç
çatı kova otağ sürü şifa uğur ulus uzun yurt tırpan muma kuşak toka dana kömür fıçı kılıf mavi ekin harp tuğra
oduncu avuç yumak elek tava kına
zafer kılıç savaş kemik iksir ejder zehir gölge balta lanet mezar bıçak tuzak hücum yağma kaşif vahşi bulut balık
çadır çarşı çiçek çizme duman gümüş ırmak kemer kilit kitap koyun limon maske mısır mühür nehir pamuk sabah sapan
saray sefer şahin şeker tahta tarla tilki yayla yemek yılan aslan buzul çanta çoban dalga demir dilek duvar ekmek
fener fırın güneş hırka hisar horoz kalem kamış kanat kaşık kiler kumaş kürek meyve nöbet pabuç saman sepet simit
şapka şehir tabak tarak tohum tuğla turna tüfek yolcu araba biber bilek cesur çayır çekiç çelik defne deniz dilim
elmas evren fidan geyik gözcü hasat hilal incir kabak kafes kavak kavga kazan keman kirpi köprü lamba lokma maden
martı mumya nişan orman otlak pençe sihir şafak tören tulum vatan vezir yamaç yaban yazıt yokuş cüzdan ağaç arena
bahar bando bekçi bölük çakal çekim çığlık dümen erzak fırça gemici hamam kavun kepek kurşun lider mangal mermi
sınır sırma şimşek tekne tımar umut yıldız zırhlı akrep dağcı ateşli hançer kovan
hazine süvari toprak yaprak yengeç kartal mağara mızrak rüzgar sandık sancak şerbet yumruk zeytin zindan zincir
buğday cevher ceylan çember değnek fincan hançer harita hendek kalkan kaplan kement kervan kulübe kumsal mahzen
meşale peynir pusula rehber sandal sincap sultan şelale tılsım yağmur yelken zambak zümrüt akıncı ambar bayrak
cellat çömlek değirmen dizgin düello efsane eşkıya fırtına gezgin hükümdar kahraman kuşatma mancınık muhafız
otağcı parşömen şövalye tapınak yabani yeniçeri zebani büyücü canavar dikenli gözetleme hayalet kalabalık
kaptan kemancı korsan kundak madalya mücevher okyanus palmiye papağan sağanak sarnıç savaşçı seyyah tebeşir
uçurum yumurta yıldırım ziyafet akbaba anahtar ateşböceği avcılar bağdaş bakırcı baltacı bekçiler bozkır
cadılar çakmak çarık çelenk çıngırak dağlar demirci denizci derviş dolunay dörtnala erguvan fanus fıskiye
gergedan gökkuşağı güvercin haydut hırsız ırgat kafile kahin kanatlı kandil kaval kavanoz kayık kazma kervansaray
keskin kırbaç kısrak kitabe konak korucu kuyruk kuzgun lagün lapa leylek meydan mihrap minare misket nakkaş
nalbant ozanlar pazar pelerin pınar sabun sadak saksı sarık semer serdar sırık sofra sokak süngü şamdan şarkı
tabya tacir tahıl tarçın telve tencere testere tırnak topçu tutsak uğultu yaşmak yatağan yaver yazgı yeleç
yokuşlar yorgan zanaat zemberek zırhçı zurna
ağıl ahır akça alem anne asır aşık atak atlı ayaz ayar bacı batı boya cila cins çalı çapa çark çift çile çini
dama deha dize doğa dört düet ekip ekşi esir eşik etek fiil gazi genç gıda gram güve hala harç hece hile imza inat
ivme izci kama kart kasa kazı kıta koca kola köle kura kurs kuru kutu küre mana mera meze mide mola moda nane nota
oluk onur ölçü örtü pide plan raks reis roka sade saka salı seda sera sıra sima soru şaka şart şema şiir şişe tane
tapu tura uçuk usta uyum üzüm veda vida yalı yazı yeni yeti yüce ağız akşam bakır başak buhar cadde damla delik
demet desen dolap fakir filiz geçit gelin gurur hamur hedef hücre irmik kadeh kalıp kavuk kayak kepçe keşif kızak
kilim kiraz liman lokum ördek palto salon soğan tavuk tavla vagon yavru yedek yüzük zalim zirve tabut ucuz zevk
`;

const TR_CHARS = /[çğıöşü]/;
const LEN = (w) => [...w].length;
const TIERS = {
  easy: (n) => n === 3,
  medium: (n) => n === 4,
  hard: (n) => n === 5,
  epic: (n) => n === 6 || n === 7,
};

const ALL = [...new Set(WORDS.split(/\s+/).map((w) => w.trim().toLocaleLowerCase('tr-TR')).filter(Boolean))];

export const WORD_POOLS = Object.fromEntries(Object.entries(TIERS).map(([t, ok]) => [t, ALL.filter((w) => ok(LEN(w)))]));

const cache = {};
export function getWordPool(tier) {
  if (cache[tier]) return cache[tier];
  const pool = WORD_POOLS[tier] ?? WORD_POOLS.easy;
  let result = pool;
  if (!CONFIG.TYPING.allowTurkishChars) {
    const filtered = pool.filter((w) => !TR_CHARS.test(w));
    if (filtered.length) result = filtered;
  }
  cache[tier] = result;
  return result;
}

// ---------- Torba: tekrar etmeyen rastgele kelime ----------
const bags = {};
function refill(tier) {
  const b = getWordPool(tier).slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  bags[tier] = b;
}

/**
 * Torbadan bir kelime çek. avoidFirst: ilk harfi bu kümede olanları atla
 * (ekranda aynı harfle başlayan iki kelime olmasın). Uygun kelime kalmazsa
 * torbanın sonundaki ilk kelime verilir.
 */
export function drawWord(tier, avoidFirst = null) {
  if (!bags[tier]?.length) refill(tier);
  const b = bags[tier];
  if (avoidFirst?.size) {
    for (let i = b.length - 1; i >= Math.max(0, b.length - 40); i--) {
      if (!avoidFirst.has(b[i][0])) return b.splice(i, 1)[0];
    }
  }
  return b.pop();
}
