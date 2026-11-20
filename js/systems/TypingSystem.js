// Typing of the Dead mekaniği: ilk harf = kilitlen, kelimeyi bitir = büyü fırlat.
import * as THREE from 'three';
import { HYPE } from '../data/hypeTexts.js';

export class TypingSystem {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.streak = 0;        // Hatasız art arda harf sayısı (Kanlı Kombo için)
    this.maxStreak = 0;
    this.totalKeys = 0;
    this.correctKeys = 0;
    this.wordStart = 0;
    this.t = 0;

    // Kilitli hedefin altındaki altın halka
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    game.scene.add(this.ring);
  }

  get accuracy() {
    return this.totalKeys ? this.correctKeys / this.totalKeys : 1;
  }

  /**
   * Yazılan harfler bir "önek" olarak tutulur. Her harfte, öneki hâlâ
   * tutan yaratıklar arasından seçim yapılır: aynı harfle başlayan iki
   * kelime varsa (gürz / güzel) ikinci, üçüncü harf hangisine uyuyorsa
   * kilit sessizce ona geçer. Hata yalnızca hiçbir kelime uymuyorsa sayılır.
   */
  handleChar(ch) {
    const g = this.game;
    this.totalKeys++;

    const t = this.target && this.target.alive ? this.target : null;
    const prefix = (t ? t.word.slice(0, t.typed) : '') + ch;

    // 0) Yazdığın yaratık başka bir şeyle (patlama, yanma...) öldüyse kelimenin
    //    kalanını cezasız yazabilirsin: kombo bozulmaz
    if (!t && this.ghost) {
      const gh = this.ghost;
      if (performance.now() - gh.at < 3000 && gh.word[gh.typed] === ch) {
        gh.typed++;
        gh.at = performance.now();
        this._correct();
        if (gh.typed >= gh.word.length) this.ghost = null;
        return;
      }
      this.ghost = null;
    }

    // 1) Mevcut hedef uyuyorsa onunla devam
    if (t && t.word.startsWith(prefix)) {
      t.typed++;
      this._correct();
      if (t.typed >= t.word.length) this._complete();
      return;
    }

    // 2) Öneke uyan başka bir yaratık var mı? En yakınını seç
    const pp = g.player.position;
    let best = null, bestD = Infinity;
    for (const e of g.enemies) {
      if (!e.alive || e.incoming || e.spawnT < 0.3 || e === t || !e.word.startsWith(prefix)) continue;
      const d = e.mesh.position.distanceToSquared(pp);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) {
      this._miss(t);
      return;
    }
    if (t) { t.typed = 0; t.locked = false; } // eski hedef bırakılır (ceza yok)
    else { this.wordStart = performance.now(); this.wordMisses = 0; }
    this.target = best;
    best.locked = true;
    best.typed = prefix.length;
    this._correct();
    if (best.typed >= best.word.length) this._complete();
  }

  _correct() {
    this.correctKeys++;
    this.streak++;
    this.maxStreak = Math.max(this.maxStreak, this.streak);
    const upl = this.game.stats.ultPerLetter;
    if (upl > 0) this.game.ult.charge = Math.min(1, this.game.ult.charge + upl);
    this.game.audio.type(this.streak);
    const milestone = HYPE.streak[this.streak];
    if (milestone) {
      const g = this.game;
      const at = g.player.position.clone();
      at.y += 3.2;
      g.floating.spawn(at, milestone, 'streak');
      g.sceneMgr.addShake(0.25);
      g.sceneMgr.punch(0.05);
      g.audio.levelUp();
    }
  }

  _miss(target) {
    const g = this.game;
    const hadStreak = this.streak >= 5;
    this.wordMisses = (this.wordMisses || 0) + 1;
    const s = g.stats;
    if (s.missForgive > 0 && Math.random() < s.missForgive) {
      g.audio.error();
      const at = (target ? target.mesh.position : g.player.position).clone();
      at.y += (target ? target.height : 2) + 1;
      g.floating.spawn(at, 'SOĞUKKANLI!', 'chain');
      if (target) g.labels.shake(target);
      return;
    }
    this.streak = s.comboHalf ? Math.floor(this.streak / 2) : 0;
    g.audio.error();
    g.sceneMgr.addShake(0.12);
    g.hud.flashError();
    const at = (target ? target.mesh.position : g.player.position).clone();
    at.y += (target ? target.height : 2) + 1;
    g.floating.spawn(at, hadStreak ? 'KOMBO KIRILDI!' : target ? 'HATA!' : 'ISKA!', 'miss');
    if (target) g.labels.shake(target);
  }

  _complete() {
    const t = this.target;
    const secs = Math.max(0.05, (performance.now() - this.wordStart) / 1000);
    const cps = (t.word.length - 1) / secs; // ilk harf kilitlenme anı
    t.incoming = true;
    t.locked = false;
    this.target = null;
    this.game.combat.fire(t, { cps, streak: this.streak, clean: !this.wordMisses });
    this.wordMisses = 0;
  }

  cancel() {
    if (!this.target) return;
    this.target.typed = 0;
    this.target.locked = false;
    this.target = null;
  }

  onEnemyRemoved(enemy) {
    if (this.target === enemy) {
      // Hedefin elinden alındı: kalan harfler ceza saymasın
      if (enemy.typed > 0 && enemy.typed < enemy.word.length) {
        this.ghost = { word: enemy.word, typed: enemy.typed, at: performance.now() };
      }
      this.target = null;
    }
  }

  update(dt) {
    this.t += dt;
    const t = this.target;
    if (t && t.alive) {
      this.ring.visible = true;
      this.ring.position.set(t.mesh.position.x, 0.06, t.mesh.position.z);
      this.ring.scale.setScalar(t.radius * 1.9 * (1 + Math.sin(this.t * 12) * 0.08));
    } else {
      this.ring.visible = false;
    }
  }
}
