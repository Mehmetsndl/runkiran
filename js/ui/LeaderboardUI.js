// Lider tablosu görünümü: seçili oyun modunun sekmeleri, canlı güncellenir.
import { CHARACTERS } from '../data/characters.js';
import { DEFENSE } from '../data/defense.js';

const charIcon = (id) => CHARACTERS.find((c) => c.id === id)?.icon ?? '';
const fmtTime = (s) => {
  const t = Math.floor(s || 0);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const fmtNum = (n) => Math.round(n || 0).toLocaleString('tr-TR');

const FORMATS = {
  time: (v) => fmtTime(v),
  xp: (v) => `${fmtNum(v)} XP`,
  num: (v) => fmtNum(v),
  wave: (v) => (v >= DEFENSE.waves.length ? '🏆 Zafer' : `${v}/${DEFENSE.waves.length}`),
};

const STATUS = {
  connecting: 'Bağlanıyor…',
  online: '● Çevrim içi',
  readonly: '● Yalnızca izleme',
  offline: '○ Yerel kayıtlar',
};

export class LeaderboardUI {
  constructor(root, board, { rows = 10 } = {}) {
    this.root = root;
    this.board = board;
    this.maxRows = rows;
    this.tab = null;
    this._modeId = null;
    this._token = 0;

    root.classList.add('lb');
    root.innerHTML = `
      <div class="lb-head"><h3>Lider Tablosu</h3><span class="lb-status"></span></div>
      <div class="lb-mode"></div>
      <div class="lb-cols"></div>
      <ol class="lb-list"></ol>
      <p class="lb-note"></p>`;
    this.statusEl = root.querySelector('.lb-status');
    this.modeEl = root.querySelector('.lb-mode');
    this.tabsEl = root.querySelector('.lb-cols');
    this.listEl = root.querySelector('.lb-list');
    this.noteEl = root.querySelector('.lb-note');
    this.tabsEl.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      this.setTab(b.dataset.tab);
      b.blur();
    });
    board.onChange(() => this.render());
  }

  setTab(key) {
    this.tab = key;
    this.render();
  }

  _syncMode() {
    const mode = this.board.mode;
    if (mode.id === this._modeId) return;
    this._modeId = mode.id;
    this.tab = mode.lb.tabs[0].key;
    this.modeEl.textContent = `${mode.icon} ${mode.name}`;
    this.modeEl.style.setProperty('--mc', mode.color);
    this.tabsEl.innerHTML = mode.lb.tabs
      .map((t) => `<button type="button" data-tab="${t.key}" title="Bu sütuna göre sırala">${t.label}<i></i></button>`).join('');
    this.tabsEl.insertAdjacentHTML('afterbegin', '<span class="lb-c-rank">#</span><span class="lb-c-name">Kahraman</span>');
  }

  async render() {
    const token = ++this._token;
    const b = this.board;
    this._syncMode();
    const tab = b.tabs.find((t) => t.key === this.tab) ?? b.tabs[0];
    for (const btn of this.tabsEl.querySelectorAll('button')) {
      const on = btn.dataset.tab === tab.key;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on);
      btn.querySelector('i').textContent = on ? ' ▼' : '';
    }
    this.statusEl.textContent = b.status === 'online' && window.claude?.__local ? '● Yerel ağ' : STATUS[b.status];
    this.statusEl.dataset.status = b.status;

    const rows = b.rowsFor(tab.key).slice(0, this.maxRows);
    const names = await b.names(rows.filter((r) => !r.nick).map((r) => r.id));
    if (token !== this._token) return; // daha yeni bir çizim başladı

    this.listEl.replaceChildren();
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'lb-empty';
      li.textContent = b.status === 'connecting' ? 'Skorlar yükleniyor…' : 'Bu modda henüz skor yok. İlk kaydı sen bırak!';
      this.listEl.append(li);
    }
    rows.forEach((r, i) => {
      const li = document.createElement('li');
      const isMe = r.id === b.uid && b.status !== 'offline';
      li.className = 'lb-row' + (isMe ? ' me' : '') + (i < 3 ? ` top${i + 1}` : '');
      const rank = document.createElement('span');
      rank.className = 'lb-rank';
      rank.textContent = i + 1;
      const name = document.createElement('span');
      name.className = 'lb-name';
      const icon = charIcon(r[tab.key + 'Char'] ?? r[b.tabs[0].key + 'Char']);
      name.textContent = (icon ? icon + ' ' : '') + (r.nick || names[r.id]?.name || 'İsimsiz Kahraman');
      if (isMe) {
        const tag = document.createElement('em');
        tag.textContent = 'sen';
        name.append(' ', tag);
      }
      const cells = b.tabs.map((t) => {
        const val = document.createElement('span');
        val.className = 'lb-val' + (t.key === tab.key ? ' sorted' : '');
        const v = r[t.key];
        val.textContent = v == null || (v === 0 && !t.sum) ? '—' : (FORMATS[t.fmt] ?? FORMATS.num)(v);
        return val;
      });
      const lv = r[tab.key + 'Level'] ?? r[b.tabs[0].key + 'Level'];
      if (lv != null) {
        const sub = document.createElement('small');
        sub.textContent = `Sv. ${lv}`;
        name.append(sub);
      }
      li.append(rank, name, ...cells);
      this.listEl.append(li);
    });

    const myRank = b.rank(tab.key);
    if (b.status === 'offline') {
      this.noteEl.textContent = 'Çevrim içi tablo, oyunun yayınlanmış sürümünde çalışır. Şimdilik skorlar bu tarayıcıda tutuluyor.';
    } else if (b.status === 'readonly') {
      this.noteEl.textContent = 'Tabloyu görebiliyorsun ama skor kaydetme iznin yok.';
    } else if (b.me) {
      const lifetime = `Bu modda toplam ${fmtNum(b.me.lifetimeXp)} XP · ${b.me.runs || 0} oyun`;
      this.noteEl.textContent = myRank ? `Sıralaman: #${myRank} · ${lifetime}` : `İlk ${b.rowsFor(tab.key).length} içinde değilsin · ${lifetime}`;
    } else {
      this.noteEl.textContent = b.status === 'online' ? 'Bir oyun bitir, skorun otomatik kaydedilsin.' : '';
    }
  }
}
