// ============================================================
//  DENİZ SAVAŞI KONTROLCÜSÜ
//  Lobi (kuyruk/antrenman) → 3-2-1 geri sayım → maç → sonuç.
//  Kelime yazma: Topçu düşman gemisindeki hedefleri, Savunmacı kendi
//  gemisindeki istasyonları yazar. Host simülasyonu çalıştırır.
// ============================================================
import * as THREE from 'three';
import { NAVAL, TEAM_NAMES, ROLE_INFO } from '../data/naval.js';
import { getWordPool } from '../data/words.js';
import { CONFIG } from '../config.js';
import { NavalSim } from './NavalSim.js';
import { NavalScene, ZONES, STATIONS } from './NavalScene.js';
import { NavalNet, buildMatch } from './NavalNet.js';
import { trLower, trUpper, randItem } from '../utils.js';

const LETTER = /^[a-zçğıöşüâîû]$/;
const fmtClock = (s) => {
  const t = Math.max(0, Math.ceil(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class NavalGame {
  constructor(game) {
    this.game = game;
    this.net = new NavalNet();
    this.root = document.getElementById('navalRoot');
    this.lobbyEl = document.getElementById('navalLobby');
    this.active = false;
    this._buildLobby();
    this.net.onChange(() => this._renderLobby());
    this.net.onMatch((m) => this.startMatch(m));
  }

  /** Oyuncunun kendi yazdığı ad (hazır isim yok) */
  get nick() { return (this.nameInput?.value || this.game.leaderboard.nick || '').trim().slice(0, 16); }

  /** Ad yazılmadıysa uyar ve kutuya odaklan */
  _needName() {
    if (this.nick) return false;
    this.nameInput.focus();
    this.nameInput.classList.remove('nv-need');
    void this.nameInput.offsetWidth;
    this.nameInput.classList.add('nv-need');
    this.lobbyEl.querySelector('#nvStatus').textContent = '✍️ Önce kaptan adını yaz, sonra kuyruğa gir.';
    return true;
  }

  // ================= LOBİ =================
  _buildLobby() {
    const q = NAVAL.queues;
    this.lobbyEl.innerHTML = `
      <div class="panel nv-lobby">
        <h2>⚓ DENİZ SAVAŞI</h2>
        <p class="sub">İki kalyon, iki takım. Her takımda <b>1 Savunmacı</b> gemiyi onarır ve güçlendirir,
          <b>2 Topçu</b> düşman gemisini topa tutar. Takımlar ve roller rastgele dağıtılır.</p>
        <label class="nv-name-row">⚓ Kaptan adın
          <input id="nvNameInput" type="text" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Adını yaz (maçta herkes bunu görür)" />
        </label>
        <div class="nv-queues">
          ${Object.entries(q).map(([id, d]) => `
            <div class="nv-q" data-q="${id}">
              <div class="nv-q-head"><b>${d.name}</b><span class="nv-q-count">0/${d.need}</span></div>
              <p>${d.desc}</p>
              <ol class="nv-q-list"></ol>
              <button type="button" class="btn small nv-q-btn" data-q="${id}">KUYRUĞA GİR</button>
            </div>`).join('')}
        </div>
        <div class="nv-practice">
          <div><b>🤖 Antrenman</b><p>Sen + 2 yapay zekâ, rakip 3 yapay zekâ. Beklemeden hemen başlar.</p></div>
          <button type="button" class="btn small" id="nvPracticeBtn">HEMEN BAŞLA</button>
        </div>
        <p class="nv-status" id="nvStatus"></p>
        <button type="button" class="btn ghost" id="nvBackBtn">ANA MENÜ</button>
      </div>`;
    this.nameInput = this.lobbyEl.querySelector('#nvNameInput');
    const saveName = () => {
      const v = this.nameInput.value.trim().slice(0, 16);
      this.game.leaderboard.setNick(v);
      const menuInput = document.getElementById('nickInput');
      if (menuInput) menuInput.value = v;
      // Kuyruktaysan yeni adı hemen herkese göster
      if (this.net.queueId && v) this.net.joinQueue(this.net.queueId, v, this.game.charSelect.selected);
    };
    this.nameInput.addEventListener('change', saveName);
    this.nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { saveName(); this.nameInput.blur(); } e.stopPropagation(); });
    this.lobbyEl.addEventListener('click', (e) => {
      const qb = e.target.closest('.nv-q-btn');
      if (qb) {
        const id = qb.dataset.q;
        if (this.net.queueId === id) this.net.leaveQueue();
        else if (!this._needName()) { saveName(); this.net.joinQueue(id, this.nick, this.game.charSelect.selected); }
        qb.blur();
      }
    });
    this.lobbyEl.querySelector('#nvPracticeBtn').addEventListener('click', () => { if (!this._needName()) { saveName(); this.startPractice(); } });
    this.lobbyEl.querySelector('#nvBackBtn').addEventListener('click', () => this.closeLobby());
  }

  _renderLobby() {
    if (!this.lobbyEl.classList.contains('visible')) return;
    const net = this.net;
    for (const card of this.lobbyEl.querySelectorAll('.nv-q')) {
      const id = card.dataset.q;
      const need = NAVAL.queues[id].need;
      const list = net.queueList(id);
      card.querySelector('.nv-q-count').textContent = `${list.length}/${need}`;
      const ol = card.querySelector('.nv-q-list');
      ol.replaceChildren(...list.slice(0, 8).map((p, i) => {
        const li = document.createElement('li');
        li.textContent = p.nick + (p.me ? ' (sen)' : '');
        if (i < need) li.className = 'in';
        return li;
      }));
      const inQ = net.queueId === id;
      card.classList.toggle('joined', inQ);
      const btn = card.querySelector('.nv-q-btn');
      btn.textContent = inQ ? 'KUYRUKTAN ÇIK' : 'KUYRUĞA GİR';
      btn.disabled = !net.online || (net.queueId && !inQ);
    }
    const st = this.lobbyEl.querySelector('#nvStatus');
    if (!net.online) {
      st.textContent = 'Çevrim içi eşleştirme, oyunun claude.ai sürümünde ya da yerel sunucuyla (server/server.js) açıldığında çalışır. Şimdilik antrenman yapabilirsin.';
    } else if (net.queueId) {
      const need = NAVAL.queues[net.queueId].need;
      const n = net.queueList(net.queueId).length;
      st.textContent = `Oyuncu aranıyor… ${n}/${need}. ${need - n > 0 ? `${need - n} kişi daha gerekiyor.` : 'Maç kuruluyor!'}`;
    } else {
      st.textContent = `${window.claude?.__local ? '🖧 Yerel ağ · ' : ''}Lobide ${net.lobbyCount()} kişi var. Bir kuyruğa gir ya da antrenman yap.`;
    }
  }

  openLobby() {
    this.game.state = 'navalLobby';
    this.lobbyEl.classList.add('visible');
    this.nameInput.value = (this.game.leaderboard.nick || '').trim();
    if (!this.nameInput.value) setTimeout(() => this.nameInput.focus(), 50);
    this.net.ready.then(() => this._renderLobby());
    this._renderLobby();
  }

  closeLobby() {
    this.net.leaveQueue();
    this.lobbyEl.classList.remove('visible');
    this.game.backToMenu();
  }

  startPractice() {
    const m = buildMatch('solo', [{ key: 'me', nick: this.nick, ch: this.game.charSelect.selected }]);
    m.local = true;
    this.startMatch(m);
  }

  // ================= MAÇ =================
  async startMatch(match) {
    if (this.active) return;
    this.active = true;
    this.lobbyEl.classList.remove('visible');
    const g = this.game;
    g.state = 'naval';
    document.body.classList.add('naval-on');

    this.match = match;
    this.channel = match.local ? null : await this.net.joinMatch(match.id);
    this.myKey = match.local ? 'me' : this.net.myPeer;
    this.players = match.players.map((p) => ({ ...p }));
    // Host sırası: maçı kuran önce, sonra diğer insanlar
    this.hostOrder = [match.host, ...this.players.filter((p) => !p.ai && p.key !== match.host).map((p) => p.key)].filter(Boolean);
    this.me = this.players.find((p) => p.key === this.myKey) ?? this.players[0];
    this.myTeam = this.me.team;
    this.role = this.me.role;

    this.scene = new NavalScene(g.sceneMgr.renderer, this.myTeam);
    this.scene.setCrew(this.players);
    this.scene.onSwell = () => this._feed('🌊 Büyük dalga geliyor! Gemiler yalpalayacak.', 'sys');
    this.sim = null;
    this.state = new NavalSim(this.players).snapshot();
    this.lastSeq = -1;
    this.isHost = false;
    this.hostKey = null;
    this.lastSeen = {};
    this.startedAt = performance.now();
    this.countdown = NAVAL.countdown + 0.6;
    this.fxQueue = [];
    this.fxTimer = 0;
    this.pubTimer = 0;
    this.ended = false;
    this.streak = 0;
    this.target = null;
    this.armorPlatesShown = [0, 0];
    this.hullShown = [0, 0];

    if (this.channel) {
      this.unsubs = [
        this.channel.onAction((peer, a) => { if (this.isHost && this.sim) this._applyAndPlay(peer, a); }),
        this.channel.onFx((list, peer) => { if (!this.isHost && peer === this.hostKey) for (const fx of list) this._playFx(fx); }),
      ];
    } else this.unsubs = [];

    this._buildHud();
    this._buildTargets();
    this._showCountdown();
  }

  _buildHud() {
    const mine = this.myTeam, enemy = 1 - mine;
    this.root.hidden = false;
    this.root.innerHTML = `
      <div id="navalLabels"></div>
      <div class="nv-top">
        <div class="nv-ship mine t${mine}"><span class="nv-name">${mine === 0 ? '🔵' : '🔴'} ${TEAM_NAMES[mine]} <em>senin gemin</em></span>
          <div class="nv-bar"><i></i><span></span></div><small class="nv-sub"></small></div>
        <div class="nv-clock">04:00</div>
        <div class="nv-ship enemy t${enemy}"><span class="nv-name">${enemy === 0 ? '🔵' : '🔴'} ${TEAM_NAMES[enemy]}</span>
          <div class="nv-bar"><i></i><span></span></div><small class="nv-sub"></small></div>
      </div>
      <div class="nv-roster mine"></div>
      <div class="nv-roster enemy"></div>
      <div class="nv-feed"></div>
      <div class="nv-bottom">
        <div class="nv-role">${ROLE_INFO[this.role].icon} <b>${ROLE_INFO[this.role].name}</b> · ${ROLE_INFO[this.role].help}</div>
        <div class="nv-word idle">Bir kelimenin ilk harfine bas</div>
      </div>
      <div class="nv-count" hidden></div>
      <div class="nv-result overlay"></div>`;
    const $ = (s) => this.root.querySelector(s);
    this.ui = {
      labels: $('#navalLabels'),
      bars: [$('.nv-ship.mine'), $('.nv-ship.enemy')],
      clock: $('.nv-clock'),
      rosters: [$('.nv-roster.mine'), $('.nv-roster.enemy')],
      feed: $('.nv-feed'),
      word: $('.nv-word'),
      count: $('.nv-count'),
      result: $('.nv-result'),
    };
    this._renderRosters();
    // Güvertedeki her oyuncunun başının üstünde küçük isim etiketi
    this.plates = this.scene.crew.map((c) => {
      const p = this.players.find((x) => x.key === c.key);
      const el = document.createElement('div');
      el.className = `nv-plate t${c.team}${c.key === this.myKey ? ' me' : ''}`;
      el.textContent = `${ROLE_INFO[c.role].icon} ${p?.nick ?? ''}`;
      this.ui.labels.append(el);
      return { c, el };
    });
  }

  _renderRosters() {
    const aiNow = new Set(this.state?.ai ?? []);
    [this.myTeam, 1 - this.myTeam].forEach((team, i) => {
      const el = this.ui.rosters[i];
      el.innerHTML = `<h4>${team === this.myTeam ? 'Takımın' : 'Rakip'}</h4>` + this.players.filter((p) => p.team === team).map((p) => {
        const ai = p.ai || aiNow.has(p.key);
        const imp = Math.round(this.state?.impact?.[p.key] ?? 0);
        return `<div class="nv-pl${p.key === this.myKey ? ' me' : ''}">${ROLE_INFO[p.role].icon} <span>${esc(p.nick)}${ai ? ' 🤖' : ''}</span><small>${imp}</small></div>`;
      }).join('');
    });
  }

  _showCountdown() {
    const c = this.ui.count;
    c.hidden = false;
    const roleI = ROLE_INFO[this.role];
    c.innerHTML = `<div class="nv-count-team t${this.myTeam}">${TEAM_NAMES[this.myTeam]}</div>
      <div class="nv-count-role">${roleI.icon} ${roleI.name}</div>
      <div class="nv-count-num"></div>
      <div class="nv-count-help">${roleI.help}</div>`;
    this._countNum = c.querySelector('.nv-count-num');
  }

  // ---------------- Kelime hedefleri ----------------
  _buildTargets() {
    this.targets = [];
    if (this.role === 'topcu') {
      ZONES.forEach((z, i) => this.targets.push({ id: 'z' + i, kind: 'zone', zone: i, team: 1 - this.myTeam, local: z.pos, icon: '🎯', title: z.name }));
    } else {
      this.targets.push(
        { id: 'repair', kind: 'repair', team: this.myTeam, local: STATIONS.repair, icon: '🔧', title: 'Onar' },
        { id: 'armor', kind: 'armor', team: this.myTeam, local: STATIONS.armor, icon: '🛡️', title: 'Zırh' },
        { id: 'hull', kind: 'hull', team: this.myTeam, local: STATIONS.hull, icon: '⚓', title: 'Gövde' },
      );
    }
    for (const t of this.targets) {
      t.el = document.createElement('div');
      t.el.className = 'nv-label';
      this.ui.labels.append(t.el);
      t.word = this._pickWord(t);
      t.typed = 0;
      t.key = '';
    }
  }

  _pickWord(t) {
    const used = new Set(this.targets.filter((o) => o !== t && o.word).map((o) => o.word[0]));
    let pool;
    if (t.kind === 'barrel') pool = NAVAL.barrelWords.filter((w) => CONFIG.TYPING.allowTurkishChars || !/[çğıöşü]/.test(w));
    else if (t.kind === 'repair') pool = getWordPool('easy');
    else if (t.kind === 'zone') pool = [...getWordPool('medium'), ...getWordPool('hard')];
    else pool = getWordPool('hard');
    for (let i = 0; i < 30; i++) {
      const w = randItem(pool);
      if (!used.has(w[0])) return w;
    }
    return randItem(pool);
  }

  _targetEnabled(t) {
    const own = this.state.ships[this.myTeam];
    if (t.kind === 'armor') return own.armor < NAVAL.armor.max - 1e-6;
    if (t.kind === 'hull') return own.hull < NAVAL.hull.max;
    return true;
  }

  _syncBarrel() {
    const b = this.state.barrel;
    const want = this.role === 'topcu' && b && b.target === 1 - this.myTeam ? b.id : null;
    const cur = this.targets.find((t) => t.kind === 'barrel');
    if (cur && cur.barrelId !== want) {
      cur.el.remove();
      this.targets.splice(this.targets.indexOf(cur), 1);
      if (this.target === cur) this.target = null;
    }
    if (want && (!cur || cur.barrelId !== want)) {
      const t = { id: 'barrel', kind: 'barrel', barrelId: want, team: 1 - this.myTeam, local: [2.5, 3.6, 0.6], icon: '💥', title: 'BARUT 3x', key: '' };
      t.el = document.createElement('div');
      t.el.className = 'nv-label barrel';
      this.ui.labels.append(t.el);
      this.targets.push(t);
      t.word = this._pickWord(t);
      t.typed = 0;
      this._feed('💥 Düşman gemisinde BARUT FIÇISI! İlk vuran 3 kat hasar verir.', 'barrel');
    }
  }

  handleKey(e) {
    if (this.ended) {
      if (e.key === 'Enter') this._resultAction('lobby');
      if (e.key === 'Escape') this._resultAction('menu');
      return;
    }
    if (this.countdown > 0) return;
    if (e.key === 'Backspace' || e.key === 'Escape') {
      e.preventDefault();
      if (this.target) { this.target.typed = 0; this.target = null; }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    const ch = trLower(e.key);
    if (!LETTER.test(ch)) return;
    e.preventDefault();
    const g = this.game;
    // Önek eşleşmesi: aynı harfle başlayan hedeflerde sonraki harfler kararı verir
    const cur = this.target;
    const prefix = (cur ? cur.word.slice(0, cur.typed) : '') + ch;
    let t = cur && cur.word.startsWith(prefix) ? cur : null;
    if (!t) t = this.targets.find((o) => o !== cur && this._targetEnabled(o) && o.word.startsWith(prefix)) ?? null;
    if (!t) return this._miss();
    if (cur && cur !== t) cur.typed = 0;
    if (!cur) this.wordStart = performance.now();
    this.target = t;
    t.typed = prefix.length;
    this.streak++;
    g.audio.type(this.streak);
    if (t.typed >= t.word.length) this._complete();
  }

  _miss() {
    this.streak = 0;
    this.game.audio.error();
    this.scene.shake = Math.min(1, this.scene.shake + 0.1);
    this.ui.word.classList.remove('error');
    void this.ui.word.offsetWidth;
    this.ui.word.classList.add('error');
  }

  _complete() {
    const t = this.target;
    this.target = null;
    const secs = Math.max(0.05, (performance.now() - this.wordStart) / 1000);
    const cps = (t.word.length - 1) / secs;
    const len = [...t.word].length;
    let a;
    if (t.kind === 'zone' || t.kind === 'barrel') {
      const F = NAVAL.fire;
      let dmg = F.base + F.perLetter * len;
      const crit = cps >= F.fastCps || Math.random() < F.critChance;
      if (crit) dmg *= F.critMult;
      a = { k: 'fire', dmg: Math.round(dmg), crit, zone: t.kind === 'barrel' ? 1 : t.zone, barrel: t.kind === 'barrel' ? t.barrelId : null };
      // Anında görsel (tahmini hasarla)
      const est = Math.round(dmg * (1 - this.state.ships[1 - this.myTeam].armor) * (t.kind === 'barrel' ? F.barrelMult : 1));
      this.scene.fire(this.myTeam, a.zone, { by: this.myKey, crit, barrel: t.kind === 'barrel', onHit: (p) => this._floatAt(p, `${est}${crit ? '!' : ''}`, crit || t.kind === 'barrel' ? 'crit-num' : 'dmg') });
      this.game.audio.slam(crit);
      if (t.kind === 'barrel') {
        t.el.remove();
        this.targets.splice(this.targets.indexOf(t), 1);
      }
    } else {
      a = { k: t.kind };
      this.scene.repairFx(this.myTeam, t.kind, this.myKey);
      this.game.audio.heal();
    }
    if (t.kind !== 'barrel') {
      t.word = this._pickWord(t);
      t.typed = 0;
    }
    this._send(a);
  }

  _send(a) {
    if (this.isHost && this.sim) this._applyAndPlay(this.myKey, a);
    else if (this.channel) this.channel.sendAction(a);
  }

  /** Host: eylemi uygula, kendi ekranında oynat (kendi eylemimiz zaten oynatıldı) */
  _applyAndPlay(key, a) {
    const fx = this.sim.apply(key, a);
    if (fx && key !== this.myKey) this._playFx(fx);
    else if (fx) this._feedFx(fx);
  }

  /** Başkasının eylemini ekranda oynat */
  _playFx(fx) {
    if (fx.by === this.myKey) { this._feedFx(fx); return; }
    if (fx.k === 'fire') {
      this.scene.fire(fx.team, fx.zone, {
        by: fx.by, crit: fx.crit, barrel: fx.barrel,
        onHit: (p) => this._floatAt(p, `${fx.amt}${fx.crit ? '!' : ''}`, fx.crit || fx.barrel ? 'crit-num' : 'dmg'),
      });
      this.game.audio.slam(fx.crit);
    } else {
      this.scene.repairFx(fx.team, fx.k, fx.by);
    }
    this._feedFx(fx);
  }

  _feedFx(fx) {
    const p = this.players.find((x) => x.key === fx.by);
    const name = p ? p.nick : '?';
    const ally = fx.team === this.myTeam;
    const cls = ally ? 'ally' : 'foe';
    if (fx.k === 'fire') this._feed(`${fx.barrel ? '💥' : '💣'} ${name} → ${fx.amt} hasar${fx.barrel ? ' (BARUT!)' : fx.crit ? ' (kritik)' : ''}`, cls);
    else if (fx.k === 'repair') this._feed(`🔧 ${name} onardı +${fx.amt}`, cls);
    else if (fx.k === 'armor') this._feed(`🛡️ ${name}: zırh %${fx.amt}`, cls);
    else if (fx.k === 'hull') this._feed(`⚓ ${name}: gövde Sv.${fx.amt}`, cls);
  }

  _feed(text, cls = '') {
    const d = document.createElement('div');
    d.className = 'nv-f ' + cls;
    d.textContent = text;
    this.ui.feed.prepend(d);
    while (this.ui.feed.children.length > 6) this.ui.feed.lastChild.remove();
  }

  _floatAt(worldPos, text, cls) {
    const v = worldPos.clone().project(this.scene.camera);
    const el = document.createElement('div');
    el.className = `ft ${cls} nv-float`;
    el.textContent = text;
    el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    this.ui.labels.append(el);
    setTimeout(() => el.remove(), 1000);
  }

  // ---------------- Host / ağ ----------------
  _updateHost(now) {
    if (!this.channel) {
      if (!this.isHost) { this.isHost = true; this.hostKey = this.myKey; this.sim = new NavalSim(this.players); }
      return;
    }
    const present = this.channel.presentKeys();
    for (const k of present) this.lastSeen[k] = now;
    const grace = now - this.startedAt < 7000;
    const host = this.hostOrder.find((k) => present.has(k)) ?? this.myKey;
    if (host !== this.hostKey) {
      this.hostKey = host;
      const becameHost = host === this.myKey;
      if (becameHost && !this.isHost) {
        this.sim = new NavalSim(this.players);
        if (this.lastSeq >= 0) this.sim.load(this.state);
        if (this.lastSeq >= 0) this._feed('📡 Maçın yönetimi sana geçti.', 'sys');
      }
      this.isHost = becameHost;
    }
    // Host: gelmeyen ya da ayrılan oyuncuların yerini yapay zekâ alır
    if (this.isHost && this.sim && !grace) {
      for (const p of this.sim.players) {
        if (p.ai || p.key === this.myKey) continue;
        if (now - (this.lastSeen[p.key] ?? this.startedAt) > 5000) {
          p.ai = true;
          this._feed(`🤖 ${p.nick} bağlantıyı kaybetti, yerini yapay zekâ aldı.`, 'sys');
        }
      }
    }
  }

  update(dt) {
    if (!this.active) return;
    const now = performance.now();
    this._updateHost(now);

    if (this.countdown > 0) {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown - 0.6);
      const txt = n > 0 ? String(n) : 'SAVAŞ!';
      if (this._countNum.textContent !== txt) {
        this._countNum.textContent = txt;
        this._countNum.classList.remove('pop');
        void this._countNum.offsetWidth;
        this._countNum.classList.add('pop');
        if (n > 0) this.game.audio.tone({ freq: 440, type: 'square', dur: 0.12, vol: 0.15 });
        else this.game.audio.levelUp();
      }
      if (this.countdown <= 0) this.ui.count.hidden = true;
    } else if (this.isHost && this.sim) {
      this.sim.update(dt);
      for (const fx of this.sim.takeFx()) {
        if (fx.by !== this.myKey && this.players.find((p) => p.key === fx.by)?.ai) this._playFx(fx);
        this.fxQueue.push(fx);
      }
      this.state = this.sim.snapshot();
      this.fxTimer -= dt;
      if (this.channel && this.fxQueue.length && this.fxTimer <= 0) {
        this.channel.sendFx(this.fxQueue.splice(0, 12));
        this.fxTimer = 0.15;
      }
      if (!this.channel) this.fxQueue.length = 0;
      this.pubTimer -= dt;
      if (this.channel && (this.pubTimer <= 0 || this.state.over)) {
        this.channel.publishState(this.state);
        this.pubTimer = 0.2;
      }
      this.lastSeq = this.state.seq;
    } else if (this.channel) {
      const st = this.channel.hostState(this.hostKey);
      if (st && typeof st === 'object' && Array.isArray(st.ships)) {
        this.state = st;
        this.lastSeq = st.seq ?? 0;
      }
    }

    this._syncBarrel();
    this._syncShipUpgrades();
    this.scene.update(dt, this.state);
    this._renderHud();
    if (this.state.over && !this.ended) this._end();
  }

  _syncShipUpgrades() {
    // Başkalarının zırh/gövde yükseltmeleri kaçırıldıysa görselleri eşitle
    this.state.ships.forEach((s, team) => {
      const plates = Math.round(s.armor / NAVAL.armor.step);
      const ship = this.scene.ships[team];
      while (ship.armorPlates.length / 2 < plates) this.scene.addArmorPlate(team);
      while (ship.hullPlanks < s.hull) this.scene.addHullPlank(team);
    });
  }

  _renderHud() {
    const st = this.state;
    [this.myTeam, 1 - this.myTeam].forEach((team, i) => {
      const s = st.ships[team];
      const el = this.ui.bars[i];
      el.querySelector('i').style.width = `${Math.max(0, (s.hp / s.max) * 100)}%`;
      el.querySelector('.nv-bar span').textContent = `${Math.max(0, Math.round(s.hp))} / ${s.max}`;
      el.querySelector('.nv-sub').textContent = `🛡️ Zırh %${Math.round(s.armor * 100)} · ⚓ Gövde Sv.${s.hull}`;
      el.classList.toggle('low', s.hp / s.max < 0.3);
    });
    this.ui.clock.textContent = fmtClock(NAVAL.duration - st.t);
    this.ui.clock.classList.toggle('urgent', NAVAL.duration - st.t < 30);

    // Hedef etiketleri
    const cam = this.scene.camera;
    const w = window.innerWidth, h = window.innerHeight;
    const v = new THREE.Vector3();
    for (const { c, el } of this.plates) {
      this.scene.crewHead(c, v).project(cam);
      el.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -100%)`;
    }
    for (const t of this.targets) {
      this.scene.shipPoint(t.team, t.local, v);
      v.y += 1.2;
      v.project(cam);
      t.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -100%)`;
      const on = this._targetEnabled(t);
      let title = t.title;
      if (t.kind === 'armor') title = on ? `Zırh %${Math.round(st.ships[this.myTeam].armor * 100)}` : 'Zırh MAKS';
      if (t.kind === 'hull') title = on ? `Gövde Sv.${st.ships[this.myTeam].hull}` : 'Gövde MAKS';
      const key = `${t.word}|${t.typed}|${on}|${title}|${this.target === t}`;
      if (key !== t.key) {
        t.key = key;
        t.el.innerHTML = `<small>${t.icon} ${esc(title)}</small><span class="w"><span class="done">${esc(trUpper(t.word.slice(0, t.typed)))}</span>${esc(trUpper(t.word.slice(t.typed)))}</span>`;
        t.el.classList.toggle('locked', this.target === t);
        t.el.classList.toggle('off', !on);
      }
    }
    const tw = this.target ? `${this.target.word}|${this.target.typed}` : '';
    if (tw !== this._tw) {
      this._tw = tw;
      if (this.target) {
        this.ui.word.innerHTML = `<span class="done">${esc(trUpper(this.target.word.slice(0, this.target.typed)))}</span>${esc(trUpper(this.target.word.slice(this.target.typed)))}`;
        this.ui.word.classList.remove('idle');
      } else {
        this.ui.word.textContent = this.role === 'topcu' ? 'Düşman gemisindeki bir kelimeye başla' : 'Gemindeki bir istasyonun kelimesine başla';
        this.ui.word.classList.add('idle');
      }
    }
    this._rosterT = (this._rosterT ?? 0) - 1;
    if (this._rosterT <= 0) { this._rosterT = 20; this._renderRosters(); }
  }

  render() {
    if (this.active) this.scene.render();
  }

  // ---------------- Bitiş ----------------
  async _end() {
    this.ended = true;
    this.target = null;
    const st = this.state;
    const won = st.over.winner === this.myTeam;
    const draw = st.over.winner === -1;
    this._renderRosters();
    this.scene.celebrate(st.over.winner);
    const title = draw ? 'BERABERE' : won ? 'ZAFER! DÜŞMAN BATTI' : 'GEMİMİZ BATTI';
    const sub = st.over.reason === 'time' ? 'Süre doldu: canı yüzdece fazla olan gemi kazandı.' : '';
    const rows = this.players.slice().sort((a, b) => (st.impact?.[b.key] ?? 0) - (st.impact?.[a.key] ?? 0))
      .map((p) => `<tr class="t${p.team}${p.key === this.myKey ? ' me' : ''}"><td>${p.team === 0 ? '🔵' : '🔴'}</td><td>${esc(p.nick)}${p.ai || st.ai?.includes(p.key) ? ' 🤖' : ''}</td><td>${ROLE_INFO[p.role].icon} ${ROLE_INFO[p.role].name}</td><td>${Math.round(st.impact?.[p.key] ?? 0)}</td></tr>`).join('');
    this.ui.result.innerHTML = `
      <div class="panel nv-res">
        <h2 class="${won ? 'victory' : draw ? '' : 'dead'}">${title}</h2>
        <p class="go-sub">${sub}</p>
        <table><thead><tr><th></th><th>Kaptan</th><th>Rol</th><th>Katkı</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="save-status" id="nvSave">Skor kaydediliyor…</p>
        <div class="char-actions static">
          <button type="button" class="btn ghost" data-act="menu">ANA MENÜ <small>(Esc)</small></button>
          <button type="button" class="btn" data-act="lobby">YENİ MAÇ <small>(Enter)</small></button>
        </div>
      </div>`;
    this.ui.result.classList.add('visible');
    this.ui.result.querySelectorAll('button[data-act]').forEach((b) => b.addEventListener('click', () => this._resultAction(b.dataset.act)));
    if (won) { this.game.audio.levelUp(); } else this.game.audio.kill(true);

    // Lider tablosu (Deniz Savaşı)
    const res = await this.game.leaderboard.submit({
      metrics: { wins: won ? 1 : 0, bestImpact: st.impact?.[this.myKey] ?? 0 },
      time: st.t, xp: 0, level: null, char: null,
    });
    const s = this.ui.result.querySelector('#nvSave');
    if (s) s.textContent = res.saved ? (res.saved === 'local' ? 'Skor bu tarayıcıya kaydedildi.' : 'Skor lider tablosuna işlendi.') : 'Skor kaydedilemedi.';
  }

  _resultAction(act) {
    this.dispose();
    if (act === 'lobby') this.openLobby();
    else this.game.backToMenu();
  }

  dispose() {
    if (!this.active) return;
    this.active = false;
    for (const u of this.unsubs ?? []) u();
    this.channel?.leave();
    this.channel = null;
    this.scene?.dispose();
    this.scene = null;
    this.root.innerHTML = '';
    this.root.hidden = true;
    document.body.classList.remove('naval-on');
    this.net.room?.presence({ nv: null }).catch(() => {});
  }
}
