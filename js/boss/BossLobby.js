// ============================================================
//  BOSS AVI LOBİSİ
//  Kahraman seçiminden sonra açılır: adını yaz, bossu ve zorluğu seç,
//  tek başına başla ya da 2/3/4 kişilik av kuyruğuna gir.
//  Kuyruk dolunca başındaki oyuncunun seçtiği boss ile maç kurulur.
// ============================================================
import { BOSS_RAID, RAID_BOSSES, RAID_BOSS_BY_ID } from '../data/bossRaid.js';
import { CHARACTERS, getCharacter } from '../data/characters.js';
import { BossNet, buildMatch } from './BossNet.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class BossLobby {
  constructor(game) {
    this.game = game;
    this.net = new BossNet();
    this.el = document.createElement('div');
    this.el.id = 'bossLobby';
    this.el.className = 'overlay';
    document.body.appendChild(this.el);
    this.charId = CHARACTERS[0].id;
    this.boss = 'trol';
    this.diff = 'normal';
    try {
      this.boss = localStorage.getItem('runkiran-boss') || 'trol';
      this.diff = localStorage.getItem('runkiran-boss-zorluk') || 'normal';
    } catch (_) { /* yok say */ }
    if (!RAID_BOSS_BY_ID[this.boss]) this.boss = 'trol';
    if (!BOSS_RAID.difficulties[this.diff]) this.diff = 'normal';
    this._build();
    this.net.onChange(() => this._render());
    this.net.onMatch((m) => this._startMatch(m));
  }

  get nick() { return (this.nameInput?.value || this.game.leaderboard.nick || '').trim().slice(0, 16); }

  _build() {
    const q = BOSS_RAID.queues;
    this.el.innerHTML = `
      <div class="panel nv-lobby bs-lobby">
        <h2>🐉 BOSS AVI</h2>
        <p class="sub">Tek başına ya da arkadaşlarınla aynı bossa karşı savaş. Herkesin yazdığı kelime <b>ortak can çubuğundan</b> düşer.
          Boss her fazda güçlenir, 7 dakika içinde yenmelisin. Arkadaşların da bu sayfayı açıp aynı kuyruğa girmeli.</p>
        <label class="nv-name-row">⚔️ Avcı adın
          <input id="bsNameInput" type="text" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Adını yaz (av ekibi bunu görür)" />
        </label>
        <p class="ft-char bs-char"></p>
        <div class="bs-bosses">${RAID_BOSSES.map((b) => `
          <button type="button" class="bs-boss" data-boss="${b.id}">
            <span class="bs-icon">${b.icon}</span><b>${b.name}</b>
            <span class="bs-stars">${'★'.repeat(b.stars)}${'☆'.repeat(3 - b.stars)}</span>
            <small>${b.desc}</small>
          </button>`).join('')}
        </div>
        <div class="bs-diffs">${Object.entries(BOSS_RAID.difficulties).map(([id, d]) => `
          <button type="button" class="btn small ghost bs-diff" data-diff="${id}">${d.icon} ${d.name}</button>`).join('')}
        </div>
        <div class="nv-practice">
          <div><b>🗡️ Tek Başına</b><p>Seçtiğin bossa hemen meydan oku.</p></div>
          <button type="button" class="btn small" id="bsSoloBtn">HEMEN BAŞLA</button>
        </div>
        <div class="nv-queues bs-queues">
          ${Object.entries(q).map(([id, d]) => `
            <div class="nv-q" data-q="${id}">
              <div class="nv-q-head"><b>${d.name}</b><span class="nv-q-count">0/${d.need}</span></div>
              <p>${d.desc}</p>
              <ol class="nv-q-list"></ol>
              <button type="button" class="btn small nv-q-btn" data-q="${id}">KUYRUĞA GİR</button>
            </div>`).join('')}
        </div>
        <p class="nv-status" id="bsStatus"></p>
        <button type="button" class="btn ghost" id="bsBackBtn">ANA MENÜ</button>
      </div>`;
    this.nameInput = this.el.querySelector('#bsNameInput');
    const saveName = () => {
      const v = this.nameInput.value.trim().slice(0, 16);
      this.game.leaderboard.setNick(v);
      const mi = document.getElementById('nickInput');
      if (mi) mi.value = v;
      if (this.net.queueId && v) this.net.joinQueue(this.net.queueId, v, this.charId, this.boss, this.diff);
    };
    this.nameInput.addEventListener('change', saveName);
    this.nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { saveName(); this.nameInput.blur(); } e.stopPropagation(); });
    const needName = () => {
      if (this.nick) return false;
      this.nameInput.focus();
      this.nameInput.classList.remove('nv-need'); void this.nameInput.offsetWidth; this.nameInput.classList.add('nv-need');
      this.el.querySelector('#bsStatus').textContent = '✍️ Önce avcı adını yaz.';
      return true;
    };
    this.el.addEventListener('click', (e) => {
      const bb = e.target.closest('.bs-boss');
      if (bb) { this.boss = bb.dataset.boss; this._saveChoice(); this._render(); return; }
      const db = e.target.closest('.bs-diff');
      if (db) { this.diff = db.dataset.diff; this._saveChoice(); this._render(); db.blur(); return; }
      const qb = e.target.closest('.nv-q-btn');
      if (!qb) return;
      const id = qb.dataset.q;
      if (this.net.queueId === id) this.net.leaveQueue();
      else if (!needName()) { saveName(); this.net.joinQueue(id, this.nick, this.charId, this.boss, this.diff); }
      qb.blur();
    });
    this.el.querySelector('#bsSoloBtn').addEventListener('click', () => {
      if (needName()) return;
      saveName();
      const m = buildMatch('solo', [{ key: 'me', nick: this.nick, ch: this.charId }], this.boss, this.diff);
      m.local = true;
      this._startMatch(m);
    });
    this.el.querySelector('#bsBackBtn').addEventListener('click', () => this.close());
  }

  _saveChoice() {
    try {
      localStorage.setItem('runkiran-boss', this.boss);
      localStorage.setItem('runkiran-boss-zorluk', this.diff);
    } catch (_) { /* yok say */ }
    if (this.net.queueId) this.net.joinQueue(this.net.queueId, this.nick, this.charId, this.boss, this.diff);
  }

  open(charId) {
    if (charId) this.charId = charId;
    this.game.state = 'bossLobby';
    this.el.classList.add('visible');
    this.nameInput.value = (this.game.leaderboard.nick || '').trim();
    const c = getCharacter(this.charId);
    this.el.querySelector('.bs-char').innerHTML = `${c.icon} <b>${c.name}</b> ile avlanıyorsun`;
    if (!this.nameInput.value) setTimeout(() => this.nameInput.focus(), 50);
    this.net.ready.then(() => this._render());
    this._render();
  }

  close() {
    this.net.leaveQueue();
    this.el.classList.remove('visible');
    this.game.backToMenu();
  }

  _render() {
    if (!this.el.classList.contains('visible')) return;
    for (const b of this.el.querySelectorAll('.bs-boss')) b.classList.toggle('on', b.dataset.boss === this.boss);
    for (const b of this.el.querySelectorAll('.bs-diff')) b.classList.toggle('on', b.dataset.diff === this.diff);
    const net = this.net;
    for (const card of this.el.querySelectorAll('.nv-q')) {
      const id = card.dataset.q;
      const need = BOSS_RAID.queues[id].need;
      const list = net.queueList(id);
      card.querySelector('.nv-q-count').textContent = `${list.length}/${need}`;
      card.querySelector('.nv-q-list').replaceChildren(...list.slice(0, 6).map((p, i) => {
        const li = document.createElement('li');
        const ch = CHARACTERS.find((c) => c.id === p.ch);
        const boss = RAID_BOSS_BY_ID[p.boss];
        li.textContent = `${ch?.icon ?? ''} ${p.nick}${p.me ? ' (sen)' : ''}${i === 0 && boss ? ` · ${boss.icon} ${boss.name}` : ''}`;
        if (i < need) li.className = 'in';
        return li;
      }));
      const inQ = net.queueId === id;
      card.classList.toggle('joined', inQ);
      const btn = card.querySelector('.nv-q-btn');
      btn.textContent = inQ ? 'KUYRUKTAN ÇIK' : 'KUYRUĞA GİR';
      btn.disabled = !net.online || (net.queueId && !inQ);
    }
    const st = this.el.querySelector('#bsStatus');
    if (!net.online) st.textContent = 'Arkadaşlarla av oyunun claude.ai sürümünde ya da yerel sunucuyla (baslat.bat) çalışır. Şimdilik tek başına avlanabilirsin.';
    else if (net.queueId) {
      const need = BOSS_RAID.queues[net.queueId].need;
      const list = net.queueList(net.queueId);
      const head = RAID_BOSS_BY_ID[list[0]?.boss];
      st.textContent = `Avcılar aranıyor… ${list.length}/${need}. ${head ? `Boss: ${head.icon} ${head.name} (kuyruğun başındaki seçti).` : ''}`;
    } else st.textContent = `${window.claude?.__local ? '🖧 Yerel ağ · ' : ''}Lobide ${net.lobbyCount()} kişi var. Bir kuyruğa gir ya da tek başına başla.`;
  }

  async _startMatch(m) {
    this.el.classList.remove('visible');
    const channel = m.local ? null : await this.net.joinMatch(m.id);
    const myKey = m.local ? 'me' : this.net.myPeer;
    this.game.startRaid({
      match: m, channel, myKey, boss: RAID_BOSS_BY_ID[m.boss] ? m.boss : 'trol', diff: BOSS_RAID.difficulties[m.diff] ? m.diff : 'normal',
      players: m.players.map((p) => ({ key: p.key, name: p.nick, ch: p.ch || 'buyucu' })),
      hostKey: m.local ? 'me' : m.host,
      online: !m.local && !!channel && m.players.length > 1,
    });
  }
}
export { esc };
