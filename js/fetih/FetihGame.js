// ============================================================
//  HÜKÜMDAR MASASI · PARSEL FETHİ KONTROLCÜSÜ
//  Kahraman seçimi → lobi (kuyruk ya da antrenman) → maç → sonuç.
//  Host simülasyonu çalıştırır ve durumu yayınlar; diğerleri eylem yollar.
//  Arayüz: oyuncu levhaları, bölge etiketleri, eylem çubuğu, düello ekranı,
//  ittifak teklifleri, savaş kaydı.
// ============================================================
import { FETIH, TERRAIN, UNITS, SEAT_CSS, SEAT_NAMES, FETIH_PASSIVES, CAPITAL_CELLS, buildMap, armyLevel, armyCount, killsPerWord } from '../data/fetih.js';
import { CHARACTERS, getCharacter } from '../data/characters.js';
import { FetihSim, decodeCell, wordTime } from './FetihSim.js';
import { FetihScene } from './FetihScene.js';
import { FetihNet, buildMatch } from './FetihNet.js';
import { trLower, trUpper } from '../utils.js';

const LETTER = /^[a-zçğıöşüâîû]$/;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

export class FetihGame {
  constructor(game) {
    this.game = game;
    this.net = new FetihNet();
    this.root = document.getElementById('tableRoot');
    this.lobbyEl = document.getElementById('fetihLobby');
    this.active = false;
    this.charId = CHARACTERS[0].id;
    this._buildLobby();
    this.net.onChange(() => this._renderLobby());
    this.net.onMatch((m) => this.startMatch(m));
  }

  get nick() { return (this.nameInput?.value || this.game.leaderboard.nick || '').trim().slice(0, 16); }

  // ================= LOBİ =================
  _buildLobby() {
    const q = FETIH.queues;
    this.lobbyEl.innerHTML = `
      <div class="panel nv-lobby ft-lobby">
        <h2>👑 HÜKÜMDAR MASASI</h2>
        <p class="sub">Masanın üstü 10×10 parsellik bir harita. Parsel sahiplen, <b>maden</b> kur, tek ordunu büyüt.
          Saldırı bir <b>kelime yarışıdır</b>: iki taraf aynı kelimeyi yazar, önce ve hatasız yazan kazanır. Kalesi düşen elenir.</p>
        <label class="nv-name-row">👑 Hükümdar adın
          <input id="ftNameInput" type="text" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Adını yaz (masada herkes bunu görür)" />
        </label>
        <p class="ft-char"></p>
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
          <div><b>🤖 Tek Başına</b><p>Sen + 3 yapay zekâ hükümdar. Beklemeden hemen başlar.</p></div>
          <button type="button" class="btn small" id="ftPracticeBtn">HEMEN BAŞLA</button>
        </div>
        <p class="nv-status" id="ftStatus"></p>
        <button type="button" class="btn ghost" id="ftBackBtn">ANA MENÜ</button>
      </div>`;
    this.nameInput = this.lobbyEl.querySelector('#ftNameInput');
    const saveName = () => {
      const v = this.nameInput.value.trim().slice(0, 16);
      this.game.leaderboard.setNick(v);
      const mi = document.getElementById('nickInput');
      if (mi) mi.value = v;
      if (this.net.queueId && v) this.net.joinQueue(this.net.queueId, v, this.charId);
    };
    this.nameInput.addEventListener('change', saveName);
    this.nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { saveName(); this.nameInput.blur(); } e.stopPropagation(); });
    const needName = () => {
      if (this.nick) return false;
      this.nameInput.focus();
      this.nameInput.classList.remove('nv-need'); void this.nameInput.offsetWidth; this.nameInput.classList.add('nv-need');
      this.lobbyEl.querySelector('#ftStatus').textContent = '✍️ Önce hükümdar adını yaz.';
      return true;
    };
    this.lobbyEl.addEventListener('click', (e) => {
      const qb = e.target.closest('.nv-q-btn');
      if (!qb) return;
      const id = qb.dataset.q;
      if (this.net.queueId === id) this.net.leaveQueue();
      else if (!needName()) { saveName(); this.net.joinQueue(id, this.nick, this.charId); }
      qb.blur();
    });
    this.lobbyEl.querySelector('#ftPracticeBtn').addEventListener('click', () => {
      if (needName()) return;
      saveName();
      const m = buildMatch('solo', [{ key: 'me', nick: this.nick, ch: this.charId }]);
      m.local = true;
      this.startMatch(m);
    });
    this.lobbyEl.querySelector('#ftBackBtn').addEventListener('click', () => this.closeLobby());
  }

  openLobby(charId) {
    if (charId) this.charId = charId;
    this.game.state = 'fetihLobby';
    this.lobbyEl.classList.add('visible');
    this.nameInput.value = (this.game.leaderboard.nick || '').trim();
    const c = getCharacter(this.charId);
    this.lobbyEl.querySelector('.ft-char').innerHTML = `${c.icon} <b>${c.name}</b> · ${FETIH_PASSIVES[c.id]?.text ?? ''}`;
    if (!this.nameInput.value) setTimeout(() => this.nameInput.focus(), 50);
    this.net.ready.then(() => this._renderLobby());
    this._renderLobby();
  }

  closeLobby() {
    this.net.leaveQueue();
    this.lobbyEl.classList.remove('visible');
    this.game.backToMenu();
  }

  _renderLobby() {
    if (!this.lobbyEl.classList.contains('visible')) return;
    const net = this.net;
    for (const card of this.lobbyEl.querySelectorAll('.nv-q')) {
      const id = card.dataset.q;
      const need = FETIH.queues[id].need;
      const list = net.queueList(id);
      card.querySelector('.nv-q-count').textContent = `${list.length}/${need}`;
      card.querySelector('.nv-q-list').replaceChildren(...list.slice(0, 6).map((p, i) => {
        const li = document.createElement('li');
        const ch = CHARACTERS.find((c) => c.id === p.ch);
        li.textContent = `${ch?.icon ?? ''} ${p.nick}${p.me ? ' (sen)' : ''}`;
        if (i < need) li.className = 'in';
        return li;
      }));
      const inQ = net.queueId === id;
      card.classList.toggle('joined', inQ);
      const btn = card.querySelector('.nv-q-btn');
      btn.textContent = inQ ? 'KUYRUKTAN ÇIK' : 'KUYRUĞA GİR';
      btn.disabled = !net.online || (net.queueId && !inQ);
    }
    const st = this.lobbyEl.querySelector('#ftStatus');
    if (!net.online) st.textContent = 'Çevrim içi eşleştirme oyunun claude.ai sürümünde ya da yerel sunucuyla (baslat.bat) çalışır. Şimdilik tek başına oynayabilirsin.';
    else if (net.queueId) {
      const need = FETIH.queues[net.queueId].need;
      const n = net.queueList(net.queueId).length;
      st.textContent = `Hükümdarlar aranıyor… ${n}/${need}. ${need - n > 0 ? `${need - n} kişi daha gerekiyor.` : 'Masa kuruluyor!'}`;
    } else st.textContent = `${window.claude?.__local ? '🖧 Yerel ağ · ' : ''}Lobide ${net.lobbyCount()} kişi var. Bir kuyruğa gir ya da tek başına başla.`;
  }

  // ================= MAÇ =================
  async startMatch(match) {
    if (this.active) return;
    this.active = true;
    this.lobbyEl.classList.remove('visible');
    const g = this.game;
    g.state = 'fetih';
    document.body.classList.add('table-on');
    this.root.hidden = false;
    this.match = match;
    this.seed = match.seed ?? 1;
    this.map = buildMap(this.seed);
    this.channel = match.local ? null : await this.net.joinMatch(match.id);
    this.myKey = match.local ? 'me' : this.net.myPeer;
    this.players = match.players.map((p) => ({ key: p.key, name: p.nick, char: p.ch || 'buyucu', ai: !!p.ai }));
    this.mySeat = Math.max(0, this.players.findIndex((p) => p.key === this.myKey));
    this.hostOrder = [match.host, ...this.players.filter((p) => !p.ai && p.key !== match.host).map((p) => p.key)].filter(Boolean);
    this.hostKey = match.local ? 'me' : match.host;
    this.isHost = this.hostKey === this.myKey;
    this.sim = this.isHost ? new FetihSim(this.players, this.seed) : null;
    this.chars = this.players.map((p) => getCharacter(p.char));
    this.scene = new FetihScene(g.sceneMgr.renderer, this.players, this.chars, this.mySeat, this.seed);
    this.snap = null;
    this.view = null;
    this.sel = -1;
    this.target = -1;
    this.hold = 0;
    this.pubT = 0;
    this.lastSeen = {};
    this.log = [];
    this.ended = false;
    this.paused = false;
    this.typed = 0;
    this.typedKey = '';
    this.sentKey = '';
    this.failFlash = 0;
    this._buildHud();
    if (this.channel) {
      this.unsubs = [
        this.channel.onAction((peer, a) => { if (this.isHost && this.sim) this._hostAct(peer, a); }),
        this.channel.onFx((list, peer) => { if (!this.isHost && peer === this.hostKey) this._playFx(list); }),
      ];
    } else this.unsubs = [];
    this._banner('👑 MASA KURULDU', `Sen ${SEAT_NAMES[this.mySeat]} krallıksın · kalen sol alt köşede`);
    this._log('🎲 Masaya 4 hükümdar oturdu. Önce yanındaki boş parselleri sahiplen!');
    if (this.sim) this._apply(this.sim.snapshot(), true);
  }

  _hostAct(peer, a) {
    const pi = this.players.findIndex((p) => p.key === peer);
    if (pi >= 0) this.sim.act(pi, a);
  }

  _send(a) {
    if (this.isHost) this.sim.act(this.mySeat, a);
    else this.channel?.sendAction(a);
  }

  // ================= ARAYÜZ =================
  _buildHud() {
    this.root.innerHTML = `
      <div class="ft-top"><div class="ft-turn"></div><div class="ft-sub"></div></div>
      <div class="ft-players">${this.players.map((p, i) => `
        <div class="ft-pl" data-i="${i}" style="--pc:${SEAT_CSS[i]}">
          <div class="ft-pl-head"><span>${this.chars[i].icon}</span><b>${esc(p.name)}</b>${p.ai ? '<em>YZ</em>' : ''}${i === this.mySeat ? '<em class="me">sen</em>' : ''}</div>
          <div class="ft-pl-stats"></div>
        </div>`).join('')}
        <div class="ft-guide">
          <b>📘 Nasıl oynanır?</b>
          <ol>
            <li><b>🚩</b> Parlayan boş parsele tıkla → <b>Enter</b> ile sahiplen</li>
            <li><b>⛏️</b> 💎 cevherde maden kur, her tur altın getirir</li>
            <li><b>🗡️</b> Altınla alttaki <b>ORDUN</b> çubuğundan birlik al. Tek ordun var, her yerde savaşır</li>
            <li><b>⚔️</b> Komşu düşman parsele tıkla → <b>Enter</b>. İki taraf aynı kelimeyi yazar, <i>önce ve hatasız yazan kazanır</i></li>
            <li><b>🛡️</b> Sana saldırılınca sen de yaz! Hızlıysan parselin elinde kalır</li>
            <li><b>🧱</b> Sur: saldırmak için sur × 3 ordu seviyesi gerekir, savunana kelime avantajı verir</li>
          </ol>
        </div>
      </div>
      <div class="ft-labels">${this.map.map((m) => `<div class="ft-lab" data-c="${m.id}" hidden></div>`).join('')}</div>
      <div class="ft-tip" hidden></div>
      <div class="ft-log"><h4>📜 Savaş Kaydı</h4><ol></ol></div>
      <div class="ft-battle" hidden></div>
      <div class="ft-panel"></div>
      <div class="ft-floats"></div>
      <div class="tb-banner"><div class="b-title"></div><div class="b-sub"></div></div>
      <div class="tb-pause overlay"><div class="panel small"><h2>DURAKLATILDI</h2>
        <p class="go-sub">Çevrim içi maçta oyun durmaz.</p>
        <div class="pause-btns"><button type="button" class="btn" data-act="resume">DEVAM ET <small>(Esc)</small></button>
        <button type="button" class="btn ghost" data-act="menu">MASADAN AYRIL <small>(M)</small></button></div></div></div>
      <div class="tb-result overlay"></div>`;
    const $ = (s) => this.root.querySelector(s);
    this.ui = {
      turn: $('.ft-turn'), sub: $('.ft-sub'), pls: [...this.root.querySelectorAll('.ft-pl')], guide: $('.ft-guide'),
      labs: [...this.root.querySelectorAll('.ft-lab')], tip: $('.ft-tip'), log: $('.ft-log ol'),
      battle: $('.ft-battle'), panel: $('.ft-panel'), floats: $('.ft-floats'), banner: $('.tb-banner'),
      pause: $('.tb-pause'), result: $('.tb-result'),
    };
    this._onMove = (e) => { this.mouse = { x: e.clientX, y: e.clientY }; };
    this._onClick = (e) => {
      if (e.target.closest('.ft-panel, .ft-players, .ft-battle, .overlay, .ft-log')) return;
      this._clickCell(this.scene.pick(e.clientX, e.clientY));
    };
    this._onCtx = (e) => { if (this.active) { e.preventDefault(); this._clearSel(); } };
    window.addEventListener('pointermove', this._onMove);
    this.root.addEventListener('click', this._onClick);
    this.root.addEventListener('contextmenu', this._onCtx);
    this.root.style.pointerEvents = 'auto';
    this.ui.panel.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b || b.disabled) return;
      b.blur();
      this._panelAction(b.dataset.a, b.dataset);
    });
    this.ui.pause.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      if (b.dataset.act === 'resume') this._togglePause(false); else this._leave();
    });
  }

  _banner(title, sub = '') {
    const b = this.ui.banner;
    b.querySelector('.b-title').textContent = title;
    b.querySelector('.b-sub').textContent = sub;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }

  _log(html) {
    this.log.unshift(html);
    this.log = this.log.slice(0, 9);
    this.ui.log.innerHTML = this.log.map((l) => `<li>${l}</li>`).join('');
  }

  _name(i) {
    if (i < 0) return '<b class="ft-neutral">Haydutlar</b>';
    return `<b style="color:${SEAT_CSS[i]}">${esc(this.players[i].name)}</b>`;
  }
  _plain(i) { return i < 0 ? 'Haydutlar' : this.players[i].name; }

  _float(cell, text, cls) {
    const el = document.createElement('div');
    el.className = `tb-float ${cls}`;
    el.textContent = text;
    const p = this.scene.project(this.scene.cellWorld(cell, 1.0));
    el.style.left = `${p.x + (Math.random() - 0.5) * 16}px`;
    el.style.top = `${p.y}px`;
    this.ui.floats.append(el);
    setTimeout(() => el.remove(), 1400);
  }

  get myTurn() {
    const s = this.view;
    return !!s && !this.ended && s.ph === 'play' && s.turn === this.mySeat && s.P[this.mySeat].alive;
  }

  cell(i) { return this.view.cells[i]; }
  cellName(i) { const m = this.map[i]; return `${TERRAIN[m.terrain].icon} ${TERRAIN[m.terrain].name} (${String.fromCharCode(65 + m.x)}${m.y + 1})`; }
  bordersMine(i) { return this.map[i].adj.some((j) => this.cell(j).owner === this.mySeat); }
  costOf(i, kind) {
    const c = this.cell(i);
    if (kind === 'wall') return FETIH.wallCost[c.wall + 1] ?? null;
    if (kind === 'camp') return FETIH.campCost[c.camp + 1] ?? null;
    if (kind === 'mine') return TERRAIN[this.map[i].terrain].ore ? FETIH.mineCost[c.mine + 1] ?? null : null;
    return null;
  }
  unitCost(ui) { return Math.max(1, UNITS[ui].cost - (FETIH_PASSIVES[this.players[this.mySeat].char]?.unitDiscount?.[UNITS[ui].id] ?? 0)); }
  myArmy() { return this.view.P[this.mySeat].u; }
  defArmy(i) { const c = this.cell(i); if (c.owner >= 0) return this.view.P[c.owner].u; const z = UNITS.map(() => 0); z[0] = c.gar; return z; }
  isEmpty(i) { const c = this.cell(i); return c.owner < 0 && c.gar === 0 && c.wall === 0; }
  canClaimHere(i) { return this.isEmpty(i) && TERRAIN[this.map[i].terrain].pass && this.bordersMine(i); }

  /** Saldırı yapılamıyorsa nedeni ('' = yapılabilir) */
  attackBlock(i) {
    const s = this.view, c = this.cell(i), army = this.myArmy();
    if (c.owner === this.mySeat || !TERRAIN[this.map[i].terrain].pass || this.isEmpty(i)) return 'x';
    if (!this.bordersMine(i)) return 'Bu parsele komşu bir parselin olmalı.';
    if (!armyCount(army)) return 'Ordun yok: alttan birlik al.';
    const need = c.wall * FETIH.wallReq;
    if (armyLevel(army) < need) return `Ordu seviyen ${armyLevel(army)}, bu sur için en az ${need} gerekir. Okçu, atlı, mancınık ya da dev ekle.`;
    if (s.atk <= 0) return 'Bu tur saldırı hakkın kalmadı.';
    return '';
  }

  // ---------------- seçim ----------------
  _clearSel() { this.sel = -1; this._renderPanel(); this._marks(); }

  _clickCell(i) {
    if (i < 0 || !this.view) { this._clearSel(); return; }
    this.sel = i;
    this.game.audio.type(this.cell(i).owner === this.mySeat ? 3 : 5);
    this._renderPanel();
    this._marks();
  }

  _marks() {
    const s = this.view;
    if (!s) return;
    const marks = {};
    if (s.B) { marks[s.B.to] = 'battle'; if (s.B.from >= 0) marks[s.B.from] = 'sel'; }
    else if (this.myTurn) {
      s.cells.forEach((c, i) => {
        if (!TERRAIN[this.map[i].terrain].pass || c.owner === this.mySeat || !this.bordersMine(i)) return;
        if (this.isEmpty(i)) marks[i] = 'claim';
        else marks[i] = this.attackBlock(i) === '' ? 'atk' : 'no';
      });
      if (this.sel >= 0) marks[this.sel] = this.cell(this.sel).owner === this.mySeat || this.isEmpty(this.sel) ? 'sel' : 'battle';
    }
    this.scene.setMarks(marks, this.hoverC ?? -1);
  }

  _panelAction(a, d) {
    if (a === 'end') { this._send({ t: 'end' }); this._clearSel(); return; }
    if (a === 'cancel') { this._clearSel(); return; }
    if (!this.myTurn) return;
    if (a === 'claim') { this._send({ t: 'claim', c: this.sel }); this.sel = -1; }
    else if (a === 'build') this._send({ t: 'build', c: this.sel, b: d.b });
    else if (a === 'recruit') this._send({ t: 'recruit', u: Number(d.u), n: Number(d.n) });
    else if (a === 'attack') {
      if (this.sel < 0) return;
      this._send({ t: 'attack', to: this.sel });
      this.sel = -1;
    }
  }

  /** Enter: seçili parseldeki ana eylem */
  _primary() {
    if (this.sel < 0) return;
    if (this.canClaimHere(this.sel)) this._panelAction('claim', {});
    else if (this.attackBlock(this.sel) === '') this._panelAction('attack', {});
  }

  _armyHtml(units) {
    const parts = UNITS.map((u, k) => (units[k] ? `<span class="ft-u" title="${u.name}">${u.icon}<b>${units[k]}</b></span>` : '')).join('');
    return parts || '<span class="ft-none">ordu yok</span>';
  }

  _renderPanel() {
    const s = this.view;
    if (!s) return;
    const me = s.P[this.mySeat];
    const top = `<div class="fp-top"><span class="ft-gold">🪙 ${me.gold} <small>+${me.inc}/tur</small></span>
      ${this.myTurn ? `<span class="ft-orders">⚔️ Saldırı hakkı ${s.atk}</span>` : ''}
      ${this.myTurn ? '<button type="button" class="btn small ghost ft-end" data-a="end">TURU BİTİR <small>(Space)</small></button>' : ''}</div>`;
    if (!me.alive) { this.ui.panel.innerHTML = `${top}<p class="ft-hint">Kalen düştü. Masadaki savaşı izliyorsun.</p>`; return; }
    let body = '';
    if (this.sel < 0) body = `<p class="ft-hint">${this.myTurn ? 'Mavi parlayan parseli sahiplen, kırmızı parlayana saldır. Parsele tıkla, <b>Enter</b>.' : s.B ? 'Savaş sürüyor…' : 'Sıranı bekle. Sana saldırılırsa kelimeyi rakibinden önce yaz!'}</p>`;
    else body = this._cellPanel(this.sel);
    this.ui.panel.innerHTML = top + body + this._armyBar();
  }

  /** Her zaman görünen ordu çubuğu: birlikler + yetiştirme */
  _armyBar() {
    const s = this.view;
    const me = s.P[this.mySeat];
    const can = this.myTurn;
    const units = me.u;
    return `<div class="fp-armybar">
      <div class="fpa-head"><b>🗡️ ORDUN</b> <span>${armyCount(units)} birlik · seviye <b>${armyLevel(units)}</b> · kelime başına ${killsPerWord(units)} öldürür</span>${me.camp ? `<span class="fpa-camp">⛺ Kamp ${me.camp}</span>` : ''}</div>
      <div class="fp-units">${UNITS.map((u, k) => {
        const cost = this.unitCost(k);
        const locked = me.camp < u.camp;
        return `<div class="fp-unit${locked ? ' locked' : ''}" title="${u.text}">
          <span class="fpu-i">${u.icon}<em>${units[k]}</em></span><span class="fpu-n"><b>${u.name}</b><small>Sv ${u.lvl}</small></span>
          ${locked ? `<span class="fpu-lock">🔒 Kamp ${u.camp}</span>` : `<button type="button" class="btn small" data-a="recruit" data-u="${k}" data-n="1" ${can && me.gold >= cost ? '' : 'disabled'}>+1 <small>${cost}🪙</small></button>
          <button type="button" class="btn small ghost" data-a="recruit" data-u="${k}" data-n="5" ${can && me.gold >= cost * 5 ? '' : 'disabled'}>+5</button>`}
        </div>`;
      }).join('')}</div></div>`;
  }

  _cellPanel(i) {
    const s = this.view;
    const c = this.cell(i), m = this.map[i], T = TERRAIN[m.terrain];
    const me = s.P[this.mySeat];
    const can = this.myTurn;
    const owner = c.owner >= 0 ? `<i style="color:${SEAT_CSS[c.owner]}">${esc(this.players[c.owner].name)}</i>` : c.gar ? 'Haydutlar' : 'Sahipsiz';
    const blds = [c.camp ? `⛺ Kamp ${c.camp}` : '', c.mine ? `⛏️ Maden ${c.mine} (+${FETIH.mineIncome[c.mine]}🪙)` : '', c.wall ? `🧱 Sur ${c.wall}` : '', c.loot ? `💰 Ganimet ${c.loot}` : ''].filter(Boolean).join(' · ');
    let html = `<div class="fp-head"><b>${this.cellName(i)}</b> <span>${owner}</span>${blds ? ` <span class="fp-blds">${blds}</span>` : ''}
      <button type="button" class="btn small ghost fp-x" data-a="cancel">✕</button></div>`;
    if (!T.pass) return html + '<p class="ft-hint">Bu araziden geçilemez.</p>';
    if (this.isEmpty(i)) {
      const cost = FETIH.claimCost + T.claim;
      const ok = can && this.bordersMine(i) && me.gold >= cost;
      return html + `<div class="fp-acts"><button type="button" class="btn small" data-a="claim" ${ok ? '' : 'disabled'}>🚩 SAHİPLEN <small>${cost}🪙 · Enter</small></button>
        <span class="ft-hint">${!this.bordersMine(i) ? 'Önce bu parsele komşu bir parselin olmalı.' : c.loot ? `İçinde ${c.loot}🪙 ganimet var!` : T.ore ? 'Cevherli: maden kurulabilir.' : ''}</span></div>`;
    }
    if (c.owner !== this.mySeat) {
      const def = this.defArmy(i);
      const block = this.attackBlock(i);
      const shield = Math.max(0, c.wall - (this.myArmy()[UNITS.findIndex((u) => u.id === 'mancinik')] || 0));
      const loot = c.loot + c.mine * FETIH.lootPer.mine + c.camp * FETIH.lootPer.camp + c.wall * FETIH.lootPer.wall;
      const typer = c.owner < 0 ? 'Haydutlar yavaş yazar' : this.players[c.owner].ai ? 'Yapay zekâ yazacak' : `${esc(this.players[c.owner].name)} kendisi yazacak`;
      return html + `<div class="fp-vs"><div><div class="fp-army">${this._armyHtml(this.myArmy())}</div><small>Senin ordun · seviye ${armyLevel(this.myArmy())}</small></div><b class="ftb-vs">VS</b>
        <div><div class="fp-army">${this._armyHtml(def)}</div><small>${c.owner >= 0 ? 'Bütün ordusu savunur' : 'Haydut garnizonu'}${c.wall ? ` · 🧱 sur ${c.wall}` : ''}</small></div></div>
        ${Math.floor(def[1] / 2) ? `<p class="ft-hint">🏹 Okçu yağmuru: savaş başında <b>${Math.floor(def[1] / 2)}</b> birliğin düşer.</p>` : ''}
        <p class="ft-hint">⚡ ${FETIH.battle.words + shield} kelimelik yarış · ${typer}${shield ? ` · sur avantajı: savunan <b>${shield}</b> kelime önde başlar` : ''}${loot ? ` · ganimet ~${loot}🪙` : ''}</p>
        <div class="fp-acts"><button type="button" class="btn small ft-atk" data-a="attack" ${block === '' ? '' : 'disabled'}>⚔️ SALDIR <small>(Enter)</small></button>
        <span class="ft-hint">${block === 'x' ? '' : block}</span></div>`;
    }
    // Kendi parselim
    const btn = (kind, label) => {
      const cost = this.costOf(i, kind);
      if (cost == null) return '';
      return `<button type="button" class="btn small ghost" data-a="build" data-b="${kind}" ${can && me.gold >= cost ? '' : 'disabled'}>${label} <small>${cost}🪙</small></button>`;
    };
    return html + `<div class="fp-acts">
      ${btn('camp', c.camp ? `⛺ KAMP ${c.camp}→${c.camp + 1}` : '⛺ KAMP KUR')}
      ${T.ore ? btn('mine', c.mine ? `⛏️ MADEN ${c.mine}→${c.mine + 1}` : '⛏️ MADEN KUR') : ''}
      ${btn('wall', c.wall ? `🧱 SUR ${c.wall}→${c.wall + 1}` : '🧱 SUR KUR')}
      <span class="ft-hint">${c.camp ? 'Kamp seviyesi yeni birlikleri açar.' : T.ore ? 'Maden her tur altın getirir.' : 'Sur bu parseli korur.'}</span>
    </div>`;
  }

  _renderPlayers() {
    const s = this.view;
    s.P.forEach((p, i) => {
      const el = this.ui.pls[i];
      const own = s.cells.filter((c) => c.owner === i).length;
      el.classList.toggle('turn', s.turn === i && !s.over);
      el.classList.toggle('dead', !p.alive);
      el.querySelector('.ft-pl-stats').innerHTML = p.alive
        ? `<span>🪙 ${p.gold} <small>+${p.inc}</small></span><span>🗺️ ${own}</span><span>⚔️ ${armyCount(p.u)} <small>sv${armyLevel(p.u)}</small></span>`
        : `<span>💀 Elendi · ${p.place}.</span>`;
    });
  }

  _renderTop() {
    const s = this.view;
    const cur = s.turn;
    if (s.over) this.ui.turn.textContent = 'MASA DAĞILDI';
    else if (s.B) this.ui.turn.innerHTML = `⚔️ ${this.cellName(s.B.to)} kuşatması`;
    else if (cur === this.mySeat) this.ui.turn.innerHTML = `👑 SENİN SIRAN <span class="ft-clock">${clock(s.tl)}</span>`;
    else this.ui.turn.innerHTML = `${this.chars[cur].icon} ${esc(this.players[cur].name)} ${this.players[cur].ai ? 'düşünüyor…' : 'oynuyor…'} <span class="ft-clock">${this.players[cur].ai ? '' : clock(s.tl)}</span>`;
    this.ui.turn.style.setProperty('--pc', SEAT_CSS[cur]);
    this.ui.sub.textContent = `Tur ${s.round}/${FETIH.maxRounds} · ${s.round >= FETIH.maxRounds - 3 ? 'son turlar: en çok parseli olan kazanır!' : 'kalesi düşen elenir'}`;
  }

  _placeLabels() {
    const s = this.view;
    if (!s) return;
    this.ui.labs.forEach((el, i) => {
      const c = s.cells[i];
      const n = armyCount(c.units);
      if (!n && !c.wall) { if (!el.hidden) el.hidden = true; return; }
      el.hidden = false;
      const p = this.scene.project(this.scene.cellWorld(i, 0.75));
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -50%)`;
      const key = `${c.owner}|${n}|${c.wall}`;
      if (el.dataset.k !== key) {
        el.dataset.k = key;
        el.style.setProperty('--oc', c.owner >= 0 ? SEAT_CSS[c.owner] : '#8a8a8a');
        el.innerHTML = `${n ? `⚔️<b>${n}</b>` : ''}${c.wall ? `<i>🧱${c.wall}</i>` : ''}`;
      }
    });
    if (this.mouse) {
      const r = this.scene.pick(this.mouse.x, this.mouse.y);
      if (r !== this.hoverC) { this.hoverC = r; this._marks(); }
      if (r >= 0 && !s.B) {
        const c = s.cells[r], m = this.map[r], T = TERRAIN[m.terrain];
        this.ui.tip.hidden = false;
        this.ui.tip.style.transform = `translate(${this.mouse.x + 16}px, ${this.mouse.y + 14}px)`;
        const owner = c.owner >= 0 ? `<i style="color:${SEAT_CSS[c.owner]}">${esc(this.players[c.owner].name)}</i>` : c.gar ? `Haydutlar (${c.gar})` : 'Sahipsiz';
        const act = this.myTurn && c.owner !== this.mySeat && T.pass && this.bordersMine(r) ? (this.isEmpty(r) ? '🚩 tıkla, Enter: sahiplen' : this.attackBlock(r) === '' ? '⚔️ tıkla, Enter: saldır' : '') : '';
        this.ui.tip.innerHTML = `<b>${this.cellName(r)}</b><span>${owner}</span>
          ${c.camp || c.mine || c.wall ? `<span>${c.camp ? `⛺${c.camp} ` : ''}${c.mine ? `⛏️${c.mine} ` : ''}${c.wall ? `🧱${c.wall}` : ''}</span>` : ''}
          ${c.loot ? `<span>💰 ${c.loot} ganimet</span>` : ''}${!T.pass ? '<span>geçilemez</span>' : ''}${act ? `<span class="ft-tip-act">${act}</span>` : ''}`;
      } else this.ui.tip.hidden = true;
    }
  }

  // ---------------- savaş (kelime yarışı) ----------------
  _battleKey(B) { return `${B.id}|${B.i}`; }
  mySide(B) { return B.a === this.mySeat ? 0 : B.d === this.mySeat ? 1 : -1; }

  _renderBattle() {
    const s = this.view;
    const B = s.B;
    const el = this.ui.battle;
    if (!B) { el.hidden = true; this.ui.panel.hidden = false; return; }
    el.hidden = false;
    this.ui.panel.hidden = true;
    const side = this.mySide(B);
    const key = this._battleKey(B);
    if (this.typedKey !== key) { this.typedKey = key; this.typed = 0; }
    const word = trUpper(B.w);
    const waiting = B.delay > 0.05;
    const chips = Array.from({ length: B.n }, (_, k) => {
      const r = B.res[k];
      const cls = r === 1 ? 'ok' : r === 2 ? 'bad' : r === 0 ? 'saved' : k === B.i && !B.end ? 'cur' : '';
      return `<span class="ftb-chip ${cls}">${r === 1 ? '⚔️' : r === 2 ? '🛡️' : r === 0 ? '·' : k + 1}</span>`;
    }).join('');
    const pa = B.prog[0] / Math.max(1, B.w.length), pd = B.prog[1] / Math.max(1, B.w.length);
    const aName = esc(this._plain(B.a)), dName = esc(this._plain(B.d));
    const myProg = side >= 0 ? this.typed : 0;
    const lead = B.ap > B.dp ? 'a' : B.dp > B.ap ? 'd' : '';
    el.style.setProperty('--ac', SEAT_CSS[B.a]);
    el.style.setProperty('--dc', B.d >= 0 ? SEAT_CSS[B.d] : '#9a9a9a');
    el.innerHTML = `
      <div class="ftb-title"><span>⚔️ ${this.cellName(B.to)} kuşatması</span><span>Kelime ${Math.min(B.i + 1, B.n)}/${B.n}</span></div>
      <div class="ftb-score">
        <div class="ftb-side a ${lead === 'a' ? 'lead' : ''}"><b>${aName}</b><small>Saldıran · ⚔️ ${armyCount(B.aU)}/${B.aU0}</small></div>
        <div class="ftb-pts"><span class="a">${B.ap}</span><i>:</i><span class="d">${B.dp}</span></div>
        <div class="ftb-side d ${lead === 'd' ? 'lead' : ''}"><b>${dName}</b><small>Savunan · ${B.d >= 0 ? '⚔️' : '🏚️'} ${armyCount(B.dU)}/${B.dU0}${B.sh ? ` · 🧱+${B.sh}` : ''}</small></div>
      </div>
      <div class="ftb-chips">${chips}</div>
      ${B.end ? `<div class="ftb-word big">${armyCount(B.aU) > 0 && (B.ap > B.dp || (B.d < 0 && armyCount(B.dU) === 0)) ? '🏴 PARSEL DÜŞTÜ' : '🛡️ SAVUNULDU'}</div>` : `
      <div class="ftb-word big ${this.failFlash > 0 ? 'err' : ''} ${waiting ? 'wait' : ''}">${waiting ? '<span class="rest">HAZIR…</span>' : `<span class="done">${word.slice(0, myProg)}</span><span class="rest">${word.slice(myProg)}</span>`}</div>
      <div class="ftb-race">
        <div class="ftb-bar a"><span>${aName}</span><i style="width:${(side === 0 ? myProg / B.w.length : pa) * 100}%"></i></div>
        <div class="ftb-bar d"><span>${dName}</span><i style="width:${(side === 1 ? myProg / B.w.length : pd) * 100}%"></i></div>
      </div>
      <div class="ftb-time"><i style="width:${waiting ? 100 : (B.t / Math.max(0.1, B.wt)) * 100}%"></i></div>`}
      <div class="ftb-hint">${side === 0 ? '⚡ <b>YAZ!</b> Önce bitirirsen kelime senin. Yanlış harf yazarsan baştan başlarsın.' : side === 1 ? '🛡️ <b>SAVUN! YAZ!</b> Saldırandan önce yazarsan parselin elinde kalır.' : 'İzliyorsun · önce yazan kazanır'}</div>`;
  }

  handleKey(e) {
    if (this.ended) {
      if (e.key === 'Enter') this._resultAction('lobby');
      else if (e.key === 'm' || e.key === 'M' || e.key === 'Escape') this._resultAction('menu');
      return;
    }
    if (this.paused) {
      if (e.key === 'Escape') this._togglePause(false);
      else if (e.key === 'm' || e.key === 'M') this._leave();
      return;
    }
    const s = this.view;
    if (!s) return;
    if (s.B && this.mySide(s.B) >= 0) {
      if (e.key === 'Escape') { this._togglePause(true); return; }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      const ch = trLower(e.key);
      if (!LETTER.test(ch)) return;
      e.preventDefault();
      if (s.B.delay > 0.05 || s.B.end) return;
      const key = this._battleKey(s.B);
      if (this.sentKey === key) return;
      const w = s.B.w;
      if (!w) return;
      if (this.typedKey !== key) { this.typedKey = key; this.typed = 0; }
      if (w[this.typed] === ch) {
        this.typed++;
        this.game.audio.type(this.typed);
        if (this.typed >= w.length) { this.sentKey = key; this._send({ t: 'bw', b: s.B.id, i: s.B.i }); }
        else this._send({ t: 'bp', b: s.B.id, i: s.B.i, n: this.typed });
      } else {
        // Hata: kelimeyi baştan yaz
        this.typed = 0;
        this.failFlash = 0.35;
        this.game.audio.error();
        this._send({ t: 'bp', b: s.B.id, i: s.B.i, n: 0 });
      }
      this._renderBattle();
      return;
    }
    if (e.key === 'Escape') { if (this.sel >= 0) this._clearSel(); else this._togglePause(true); return; }
    if (!this.myTurn) return;
    if (e.key === 'Enter') { e.preventDefault(); this._primary(); return; }
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); this._panelAction('end', {}); }
  }

  _togglePause(on) { this.paused = on; this.ui.pause.classList.toggle('visible', on); }

  // ---------------- olaylar ----------------
  _playFx(list) {
    const sc = this.scene;
    const a = this.game.audio;
    for (const f of list) {
      switch (f.k) {
        case 'turn':
          if (f.p === this.mySeat) { this._banner('👑 SENİN SIRAN', `Tur ${f.round} · +${f.inc} altın`); a.levelUp(); }
          this._log(`🔔 ${this._name(f.p)} sırası (+${f.inc} 🪙)`);
          this.sel = -1;
          break;
        case 'claim':
          sc.dust(f.c, 0x7fe3ff); a.coin?.();
          this._float(f.c, f.loot ? `🚩 +${f.loot}🪙` : '🚩', 'heal');
          if (f.loot) sc.coins(f.c);
          this._log(`🚩 ${this._name(f.p)} ${this.cellName(f.c)} sahiplendi${f.loot ? ` ve ${f.loot}🪙 buldu` : ''}`);
          break;
        case 'build': {
          const label = { camp: '⛺ Kamp', mine: '⛏️ Maden', wall: '🧱 Sur' }[f.b];
          sc.dust(f.c); a.build?.();
          this._float(f.c, `${label} ${f.lv}`, 'wall');
          this._log(`🔨 ${this._name(f.p)} ${this.cellName(f.c)}: ${label} ${f.lv}`);
          break;
        }
        case 'recruit':
          sc.dust(f.c, 0xffd84a); a.coin?.();
          this._float(f.c, `+${f.n} ${UNITS[f.u].icon}`, 'heal');
          this._log(`${UNITS[f.u].icon} ${this._name(f.p)} ${f.n} ${UNITS[f.u].name.toLocaleLowerCase('tr-TR')} yetiştirdi`);
          break;
        case 'march':
          if (f.from >= 0) sc.march(f.from, f.to, f.units, f.p);
          a.dash();
          break;
        case 'battle':
          this._log(`⚔️ ${this._name(f.a)} → ${this.cellName(f.to)} (${this._name(f.d)}) · ${f.aN} vs ${f.dN} birlik`);
          if (f.a === this.mySeat) { this._banner('⚔️ KELİME YARIŞI!', `Önce yazan kazanır${f.shield ? ` · sur: savunan ${f.shield} önde` : ''}`); a.ult(); }
          else if (f.d === this.mySeat) { this._banner('🛡️ SALDIRI ALTINDASIN!', `${this.players[f.a].name} geliyor · kelimeleri ondan önce yaz!`); a.ult(); }
          this.lastBattle = f;
          this.sentKey = '';
          this.sel = -1;
          break;
        case 'volley':
          if (this.lastBattle) {
            if (f.a) { sc.shot(this.lastBattle.from, this.lastBattle.to, 'okcu'); this._float(this.lastBattle.to, `🏹 -${f.a}`, 'dmg'); }
            if (f.d && this.lastBattle.from >= 0) { sc.shot(this.lastBattle.to, this.lastBattle.from, 'okcu'); this._float(this.lastBattle.from, `🏹 -${f.d}`, 'dmg'); }
          }
          break;
        case 'word': {
          const B = this.lastBattle;
          if (!B) break;
          const from = B.from >= 0 ? B.from : B.to;
          const me = B.a === this.mySeat ? 0 : B.d === this.mySeat ? 1 : -1;
          if (f.win === 0) { sc.shot(from, B.to, 'atli'); this._float(B.to, f.killed ? `-${f.killed}` : '⚔️', 'dmg'); }
          else if (f.win === 1) { sc.shot(B.to, from, 'okcu'); this._float(from, f.killed ? `-${f.killed}` : '🛡️', 'dmg'); }
          else this._float(B.to, '⏳ berabere', 'wall');
          if (me >= 0) { if (f.win === me) a.hit(true); else if (f.win >= 0) a.error(); }
          else a.hit(false);
          break;
        }
        case 'capture':
          sc.capture(f.c, f.p);
          if (f.loot) sc.coins(f.c);
          a.slam(true);
          this._float(f.c, f.loot ? `🏴 +${f.loot}🪙` : '🏴 ALINDI', 'heal');
          this._log(`🏴 ${this._name(f.p)} ${this.cellName(f.c)} aldı (${f.ap}-${f.dp})${f.loot ? ` · ${f.loot}🪙` : ''}`);
          if (f.p === this.mySeat) this._banner('🏴 FETİH!', `${f.ap}-${f.dp} kazandın${f.loot ? ` · ganimet ${f.loot} altın` : ''}`);
          else if (f.prev === this.mySeat) this._banner('💔 PARSEL KAYBI', `${this.cellName(f.c)} düştü (${f.ap}-${f.dp})`);
          break;
        case 'repelled':
          this._float(f.c, '🛡️ SAVUNULDU', 'wall');
          this._log(`🛡️ ${this._name(f.d)} ${this.cellName(f.c)} parselini korudu (${f.ap}-${f.dp})`);
          if (f.d === this.mySeat) this._banner('🛡️ SAVUNDUN!', `${f.dp}-${f.ap} · parsel senin`);
          else if (f.a === this.mySeat) this._banner('❌ PÜSKÜRTÜLDÜN', `${f.ap}-${f.dp} · ${this.cellName(f.c)} alınamadı`);
          a.slam(false);
          break;
        case 'elim':
          a.kill(true);
          this._banner(f.p === this.mySeat ? 'KALEN DÜŞTÜ!' : `${trUpper(this.players[f.p].name)} ELENDİ!`, `Fatih: ${this.players[f.by].name} · ${f.gold}🪙 hazine`);
          this._log(`💀 ${this._name(f.p)} elendi! Parselleri sahipsiz kaldı.`);
          break;
        case 'timeout': this._log(`⏰ ${this._name(f.p)} süresi doldu`); break;
        default: break;
      }
    }
  }

  _apply(snap, force = false) {
    // Sahnede ordular başkentte, haydut garnizonları kendi parselinde görünür
    const caps = CAPITAL_CELLS.map(([x, y]) => y * FETIH.size + x);
    snap.cells = snap.C.map((s, i) => {
      const c = decodeCell(s);
      const own = caps.indexOf(i);
      if (own >= 0 && c.owner === own && snap.P[own].alive) c.units = snap.P[own].u.slice();
      else { c.units = UNITS.map(() => 0); c.units[0] = c.gar; }
      return c;
    });
    this.snap = snap;
    if (force || this.hold <= 0) this._show(snap);
  }

  _show(snap) {
    this.view = snap;
    this.scene.sync(snap.cells, snap.P);
    this._renderTop();
    this._renderPlayers();
    this._renderBattle();
    if (this.sel >= 0 && snap.B) this.sel = -1;
    this._renderPanel();
    this._marks();
    if (snap.over && !this.ended) this._end();
  }

  // ================= DÖNGÜ =================
  update(dt) {
    if (!this.active) return;
    this.scene.update(dt);
    this.failFlash = Math.max(0, this.failFlash - dt);
    if (this.isHost && this.sim) {
      this.sim.update(dt);
      const fx = this.sim.takeFx();
      if (fx.length) { this._playFx(fx); this.channel?.sendFx(fx); }
      this.pubT -= dt;
      const B = this.sim.battle;
      const changed = this.sim.seq !== this.snap?.seq;
      if (changed || this.pubT <= 0) {
        this.pubT = B ? 0.15 : 1;
        const snap = this.sim.snapshot();
        this.channel?.publishState({ ...snap, host: true });
        this._apply(snap);
      }
      this._watchPeers(dt);
    } else if (this.channel) {
      const st = this.channel.hostState(this.hostKey);
      if (st && st.seq != null && (st.seq !== this.snap?.seq || st.tl !== this.snap?.tl || st.B?.t !== this.snap?.B?.t || st.B?.delay !== this.snap?.B?.delay)) this._apply({ ...st });
      this._watchHost(dt);
    }
    if (this.hold > 0) {
      this.hold -= dt;
      if (this.hold <= 0 && this.snap) this._show(this.snap);
    } else if (this.snap && this.view !== this.snap) this._show(this.snap);
    this._placeLabels();
  }

  _watchPeers(dt) {
    if (!this.channel) return;
    this._peerT = (this._peerT ?? 0) - dt;
    if (this._peerT > 0) return;
    this._peerT = 1;
    const present = this.channel.presentKeys();
    const now = performance.now();
    this.players.forEach((p, i) => {
      if (p.ai || p.key === this.myKey) return;
      if (present.has(p.key)) { this.lastSeen[p.key] = now; return; }
      this.lastSeen[p.key] ??= now;
      if (now - this.lastSeen[p.key] > 6000) {
        p.ai = true;
        this.sim.players[i].ai = true;
        this._log(`🤖 ${this._name(i)} bağlantıyı kaybetti, yerini yapay zekâ aldı.`);
      }
    });
  }

  _watchHost(dt) {
    this._hostT = (this._hostT ?? 0) - dt;
    if (this._hostT > 0) return;
    this._hostT = 1;
    const present = this.channel.presentKeys();
    const now = performance.now();
    if (present.has(this.hostKey)) { this.lastSeen[this.hostKey] = now; return; }
    this.lastSeen[this.hostKey] ??= now;
    if (now - this.lastSeen[this.hostKey] < 5000) return;
    const next = this.hostOrder.find((k) => present.has(k));
    if (!next) return;
    const old = this.players.findIndex((p) => p.key === this.hostKey);
    if (old >= 0) this.players[old].ai = true;
    this.hostKey = next;
    this._log('🔁 Masa sahibi değişti.');
    if (next === this.myKey && this.snap) {
      this.isHost = true;
      this.sim = FetihSim.fromSnapshot(this.snap, this.players);
    }
  }

  render() { if (this.active) this.scene.render(); }

  // ================= BİTİŞ =================
  async _end() {
    this.ended = true;
    const s = this.view;
    const me = s.P[this.mySeat];
    const won = s.over.winner === this.mySeat;
    if (s.over.winner >= 0) this.scene.heroes[s.over.winner].cheer = 6;
    const order = s.P.map((p, i) => ({ ...p, i })).sort((a, b) => (a.place || 9) - (b.place || 9));
    const rows = order.map((p) => `<tr class="${p.i === this.mySeat ? 'me' : ''}"><td>${p.place || '-'}.</td><td style="color:${SEAT_CSS[p.i]}">${this.chars[p.i].icon} ${esc(p.name)}${p.ai ? ' 🤖' : ''}</td>
      <td>${s.cells.filter((c) => c.owner === p.i).length}</td><td>${p.cap}</td><td>${p.kills}</td></tr>`).join('');
    this.ui.result.innerHTML = `
      <div class="panel tb-res">
        <h2 class="${won ? 'victory' : 'dead'}">${won ? '👑 TAHT SENİN!' : `${me.place || '-'}. OLDUN`}</h2>
        <p class="go-sub">${s.over.reason === 'rounds' ? `${FETIH.maxRounds} tur doldu: en çok parseli olan kazandı.` : 'Bütün rakip kaleler düştü.'} Kazanan: ${esc(this.players[s.over.winner]?.name ?? '-')}</p>
        <table><thead><tr><th>#</th><th>Hükümdar</th><th>Parsel</th><th>Fetih</th><th>Öldürdüğü birlik</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="save-status" id="ftSave">Skor kaydediliyor…</p>
        <div class="go-btns">
          <button type="button" class="btn" data-act="lobby">YENİ MASA <small>(Enter)</small></button>
          <button type="button" class="btn ghost" data-act="menu">ANA MENÜ <small>(M)</small></button>
        </div>
      </div>`;
    this.ui.result.classList.add('visible');
    this.ui.result.querySelectorAll('button[data-act]').forEach((b) => b.addEventListener('click', () => this._resultAction(b.dataset.act)));
    if (won) this.game.audio.levelUp(); else this.game.audio.kill(true);
    const res = await this.game.leaderboard.submit({ metrics: { wins: won ? 1 : 0, bestDmg: me.kills }, time: s.round, xp: 0, level: null, char: this.players[this.mySeat].char });
    const el = this.ui.result.querySelector('#ftSave');
    if (el) el.textContent = res.saved ? (res.saved === 'local' ? 'Skor bu tarayıcıya kaydedildi.' : 'Skor lider tablosuna işlendi.') : 'Skor kaydedilemedi.';
  }

  _resultAction(act) {
    this.dispose();
    if (act === 'lobby') this.openLobby(); else this.game.toMainMenu();
  }

  _leave() { this.dispose(); this.game.toMainMenu(); }

  dispose() {
    if (!this.active) return;
    this.active = false;
    for (const u of this.unsubs ?? []) u();
    this.channel?.leave();
    this.channel = null;
    window.removeEventListener('pointermove', this._onMove);
    this.scene?.dispose();
    this.scene = null;
    this.root.innerHTML = '';
    this.root.hidden = true;
    this.root.style.pointerEvents = '';
    document.body.classList.remove('table-on');
    this.net.room?.presence({ ft: null }).catch(() => {});
  }
}
