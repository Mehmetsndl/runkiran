// ============================================================
//  SÜRELİ ETKİLER (süreli kartlar)
//  Kartın add / mul değerlerini istatistiklere uygular, süre bitince geri alır.
//  Aynı kart etkisi sürerken tekrar seçilirse yalnızca süresi yenilenir.
//  Ekranın sol üstünde, karakter etiketinin altında geri sayımla gösterilir.
// ============================================================
export class BuffSystem {
  constructor(game) {
    this.game = game;
    this.active = [];
    this.el = document.createElement('div');
    this.el.id = 'buffTray';
    document.getElementById('topleft')?.append(this.el);
  }

  _apply(card, sign) {
    const s = this.game.stats;
    for (const [k, v] of Object.entries(card.add ?? {})) s[k] = (s[k] ?? 0) + v * sign;
    for (const [k, v] of Object.entries(card.mul ?? {})) s[k] = (s[k] ?? 1) * (sign > 0 ? v : 1 / v);
  }

  add(card) {
    const g = this.game;
    const cur = this.active.find((b) => b.card.id === card.id);
    if (cur) {
      cur.t = card.dur;
    } else {
      this._apply(card, 1);
      this.active.push({ card, t: card.dur });
    }
    const at = g.player.position.clone(); at.y += g.player.height + 3.2;
    g.floating.spawn(at, `${card.icon} ${card.name.toLocaleUpperCase('tr-TR')} · ${card.dur} SN`, 'chain');
    g.particles.ring(g.player.position, 0xffd84a, 4, 0.5);
    this._render(true);
  }

  update(dt) {
    let changed = false;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      b.t -= dt;
      if (b.t <= 0) {
        this._apply(b.card, -1);
        this.active.splice(i, 1);
        changed = true;
      }
    }
    this._render(changed);
  }

  clear() {
    for (const b of this.active) this._apply(b.card, -1);
    this.active = [];
    this._render(true);
  }

  _render(rebuild) {
    if (rebuild) {
      this.el.innerHTML = this.active.map((b) => `
        <div class="buff" data-id="${b.card.id}" title="${b.card.name}">
          <span class="buff-icon">${b.card.icon}</span>
          <span class="buff-meta"><b>${b.card.name}</b><i><em></em></i></span>
          <span class="buff-t"></span>
        </div>`).join('');
    }
    for (const b of this.active) {
      const el = this.el.querySelector(`[data-id="${b.card.id}"]`);
      if (!el) continue;
      el.querySelector('.buff-t').textContent = `${Math.ceil(b.t)}s`;
      el.querySelector('em').style.width = `${(b.t / b.card.dur) * 100}%`;
      el.classList.toggle('ending', b.t < 3);
    }
  }
}
