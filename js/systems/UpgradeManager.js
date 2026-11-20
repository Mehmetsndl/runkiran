// Yetenek kartı seçimi (nadirliğe göre ağırlıklı) ve uygulanması
import { UPGRADES, FALLBACK_UPGRADES, RARITIES, cardAllowed } from '../data/upgrades.js';

export class UpgradeManager {
  constructor(game) {
    this.game = game;
    this.levels = {};
  }

  level(id) { return this.levels[id] || 0; }

  /**
   * Kart yuvaları: her yuva için önce nadirlik zarı atılır (RARITIES.chance),
   * sonra o nadirlikteki uygun kartlardan biri seçilir. Bir teklifte en fazla
   * bir süreli kart çıkar.
   */
  rollChoices(n = 3) {
    const mode = this.game.modeDef?.id;
    const pool = UPGRADES.filter((u) => this.level(u.id) < u.maxLevel && cardAllowed(u, mode) && (!u.requires || this.level(u.requires) > 0));
    const choices = [];
    while (choices.length < n) {
      const avail = Object.keys(RARITIES).filter((r) => pool.some((u) => u.rarity === r));
      if (!avail.length) break;
      let total = 0;
      for (const r of avail) total += RARITIES[r].chance;
      let x = Math.random() * total;
      let rarity = avail[avail.length - 1];
      for (const r of avail) { x -= RARITIES[r].chance; if (x <= 0) { rarity = r; break; } }
      const group = pool.filter((u) => u.rarity === rarity);
      const pick = group[Math.floor(Math.random() * group.length)];
      choices.push(pick);
      pool.splice(pool.indexOf(pick), 1);
      if (pick.timed) for (let i = pool.length - 1; i >= 0; i--) if (pool[i].timed) pool.splice(i, 1);
    }
    for (const f of FALLBACK_UPGRADES) if (choices.length < n && cardAllowed(f, mode)) choices.push(f);
    return choices;
  }

  apply(upgrade) {
    const lv = this.level(upgrade.id) + 1;
    this.levels[upgrade.id] = lv;
    upgrade.apply(this.game.stats, this.game, lv);
    this.game.hud.refreshBuild();
  }
}
