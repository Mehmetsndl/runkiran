// ============================================================
//  RÜNKIRAN — Ana oyun döngüsü
//  Tüm sistemler burada oluşturulur ve birbirine bağlanır.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createBaseStats } from './data/stats.js';
import { SceneManager } from './core/SceneManager.js';
import { Input } from './core/Input.js';
import { AudioSystem } from './core/AudioSystem.js';
import { Player } from './entities/Player.js';
import { WaveManager } from './systems/WaveManager.js';
import { TypingSystem } from './systems/TypingSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { XPSystem } from './systems/XPSystem.js';
import { UpgradeManager } from './systems/UpgradeManager.js';
import { HUD } from './ui/HUD.js';
import { LabelLayer } from './ui/LabelLayer.js';
import { FloatingText } from './ui/FloatingText.js';
import { LevelUpUI } from './ui/LevelUpUI.js';
import { LeaderboardUI } from './ui/LeaderboardUI.js';
import { CardsPage } from './ui/CardsPage.js';
import { BuffSystem } from './systems/BuffSystem.js';
import { UPGRADES, FALLBACK_UPGRADES } from './data/upgrades.js';
import { Leaderboard } from './online/Leaderboard.js';
import { trLower } from './utils.js';
import { HYPE, pickHype } from './data/hypeTexts.js';
import { getCharacter } from './data/characters.js';
import { CharacterSelect } from './ui/CharacterSelect.js';
import { ModeMenu } from './ui/ModeMenu.js';
import { getMode } from './data/modes.js';
import { createMode } from './systems/modes/index.js';
import { UltimateSystem } from './systems/UltimateSystem.js';
import { NavalGame } from './naval/NavalGame.js';
import { FetihGame } from './fetih/FetihGame.js';
import { BossLobby } from './boss/BossLobby.js';
import { MiniMap } from './ui/MiniMap.js';
import { connectLocal } from './online/LocalBridge.js';

const LETTER = /^[a-zçğıöşüâîû]$/;

class Game {
  constructor() {
    this.state = 'menu'; // menu | select | playing | paused | levelup | gameover
    this.mode = null;    // aktif oyun modu (start'ta kurulur)
    this.sceneMgr = new SceneManager(document.getElementById('game'));
    this.scene = this.sceneMgr.scene;
    this.camera = this.sceneMgr.camera;

    this.charSelect = null; // aşağıda kurulur
    let savedChar = null;
    try { savedChar = localStorage.getItem('runkiran-karakter'); } catch (_) { /* yok say */ }
    this.character = getCharacter(savedChar);
    this.stats = createBaseStats(this.character);
    this.audio = new AudioSystem();
    this.particles = new ParticleSystem(this);
    this.player = new Player(this, this.character);
    this.input = new Input(this);
    this.labels = new LabelLayer(this, document.getElementById('labels'));
    this.floating = new FloatingText(this, document.getElementById('floating'));
    this.waves = new WaveManager(this);
    this.typing = new TypingSystem(this);
    this.combat = new CombatSystem(this);
    this.xp = new XPSystem(this);
    this.upgrades = new UpgradeManager(this);
    this.ult = new UltimateSystem(this);
    this.buffs = new BuffSystem(this);
    this.hud = new HUD(this);
    this.levelUpUI = new LevelUpUI(this);
    this.minimap = new MiniMap(this);
    this.charSelect = new CharacterSelect(this);
    this.naval = null; // Deniz Savaşı (aşağıda, lider tablosundan sonra kurulur)

    this.moveMode = CONFIG.MOVE.defaultMode;
    this.elapsed = 0;
    this.kills = 0;
    this.hitStop = 0;
    this.killChain = { count: 0, timer: 0 };

    this.ui = {
      menu: document.getElementById('menu'),
      pause: document.getElementById('pause'),
      gameover: document.getElementById('gameover'),
    };
    // Oyun modu seçimi + çevrim içi lider tablosu (seçilen modun tablosu)
    this.modeMenu = new ModeMenu(document.getElementById('modeCards'), (id) => this.selectMode(id));
    this.modeDef = getMode(this.modeMenu.selected);
    document.body.classList.toggle('mode-table', this.modeDef.type === 'table');
    this.leaderboard = new Leaderboard(this.modeDef);
    this._updateStartBtn();
    this.naval = new NavalGame(this);
    this.fetih = new FetihGame(this);
    this.bossLobby = new BossLobby(this);
    this.lbMenu = new LeaderboardUI(document.getElementById('lbMenu'), this.leaderboard, { rows: 8 });
    this.lbOver = new LeaderboardUI(document.getElementById('lbOver'), this.leaderboard, { rows: 8 });
    const nickInput = document.getElementById('nickInput');
    nickInput.value = this.leaderboard.nick;
    nickInput.addEventListener('change', () => this.leaderboard.setNick(nickInput.value));
    this.leaderboard.onChange(() => {
      const u = this.leaderboard.user;
      if (u && !this._placeholderSet) {
        this._placeholderSet = true;
        u.me().then((m) => { if (m.name) nickInput.placeholder = m.name; });
      }
    });
    this._nickInput = nickInput;

    document.getElementById('startBtn').addEventListener('click', () => this.openCharacterSelect());
    // Kart arşivi
    this.cardsPage = new CardsPage(() => { if (this.state === 'cards') this.state = 'menu'; });
    document.getElementById('cardsCount').textContent = `(${UPGRADES.length + FALLBACK_UPGRADES.length} kart)`;
    document.getElementById('cardsBtn').addEventListener('click', (e) => {
      e.currentTarget.blur();
      if (this.state !== 'menu') return;
      this.state = 'cards';
      this.cardsPage.open();
    });
    document.getElementById('restartBtn').addEventListener('click', () => this.restart());
    document.getElementById('resumeBtn').addEventListener('click', () => this.togglePause(false));
    document.getElementById('pauseRestartBtn').addEventListener('click', () => this.restart());
    document.getElementById('pauseMenuBtn').addEventListener('click', () => this.toMainMenu());
    document.getElementById('overMenuBtn').addEventListener('click', () => this.toMainMenu());

    const unlockAudio = () => this.audio.init();
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('blur', () => { if (this.state === 'playing') this.togglePause(true); });
    window.addEventListener('beforeunload', () => { this.naval?.net.leaveQueue(); this.fetih?.net.leaveQueue(); this.bossLobby?.net.leaveQueue(); this.mode?.dispose?.(); });

    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));

    let autostart = false;
    try {
      autostart = sessionStorage.getItem('runkiran-baslat') === '1';
      sessionStorage.removeItem('runkiran-baslat');
    } catch (_) { /* depolama kapalı olabilir */ }
    if (autostart) this.start(this.charSelect.selected);
    else {
      try {
        const m = sessionStorage.getItem('runkiran-menu-mod');
        sessionStorage.removeItem('runkiran-menu-mod');
        if (m) this.modeMenu.select(m);
      } catch (_) { /* yok say */ }
    }
  }

  selectMode(id) {
    this.modeDef = getMode(id);
    document.body.classList.toggle('mode-table', this.modeDef.type === 'table');
    this.leaderboard.setMode(this.modeDef);
    this._updateStartBtn();
  }

  _updateStartBtn() {
    const btn = document.getElementById('startBtn');
    btn.querySelector('.btn-mode').textContent = `${this.modeDef.icon} ${this.modeDef.name}`;
    btn.querySelector('.btn-label').textContent = this.modeDef.type === 'naval' ? 'OYUNCU BUL' : 'KAHRAMANINI SEÇ';
  }

  /** Deniz Savaşı / lobi gibi ekranlardan ana menüye dön */
  backToMenu() {
    this.state = 'menu';
    this.ui.menu.classList.add('visible');
  }

  get enemies() { return this.waves.enemies; }

  // ---------------- Durum yönetimi ----------------
  openCharacterSelect() {
    if (this.state !== 'menu') return;
    this.audio.init();
    this.leaderboard.setNick(this._nickInput.value);
    this._nickInput.blur();
    this.ui.menu.classList.remove('visible');
    if (this.modeDef.type === 'naval') {
      this.naval.openLobby();
      return;
    }
    this.state = 'select';
    this.charSelect.show();
  }

  closeCharacterSelect() {
    if (this.state !== 'select') return;
    this.charSelect.hide();
    this.ui.menu.classList.add('visible');
    this.state = 'menu';
  }

  /** Seçilen karakterle oyunu başlat */
  start(charId) {
    if (this.state !== 'menu' && this.state !== 'select') return;
    this.audio.init();
    this.character = getCharacter(charId);
    this.stats = createBaseStats(this.character);
    this.player.setCharacter(this.character);
    this.player.hp = this.stats.maxHp;
    this.hud.setCharacter(this.character);
    this.ult.reset();
    // Oyun modu
    this.modeDef = getMode(this.modeMenu.selected);
    if (this.modeDef.type === 'table') {
      // Hükümdar Masası (Toprak Fethi): kahramanı seçtikten sonra lobi açılır
      this.charSelect.hide();
      this.ui.menu.classList.remove('visible');
      this.fetih.openLobby(charId);
      return;
    }
    if (this.modeDef.type === 'raid') {
      // Boss Avı: kahramanı seçtikten sonra av lobisi (tek başına ya da arkadaşlarla)
      this.charSelect.hide();
      this.ui.menu.classList.remove('visible');
      this.bossLobby.open(charId);
      return;
    }
    this._beginMode();
  }

  /** Boss Avı lobisi maçı kurunca çağırır */
  startRaid(raid) {
    this.raidOpts = raid;
    this._beginMode();
  }

  _beginMode() {
    this.mode = createMode(this, this.modeDef);
    this.mode.setup();
    this.hud.mountMode(this.mode);
    this.charSelect.hide();
    this.ui.menu.classList.remove('visible');
    this.state = 'playing';
    this.last = performance.now();
  }

  /** Oyunu bırakıp ana menüye dön (seçili mod korunur) */
  toMainMenu() {
    try { sessionStorage.setItem('runkiran-menu-mod', this.modeDef.id); } catch (_) { /* yok say */ }
    location.reload();
  }

  restart() {
    try { sessionStorage.setItem('runkiran-baslat', '1'); } catch (_) { /* yok say */ }
    location.reload();
  }

  togglePause(force) {
    // Çevrim içi Boss Avı: oyun durmaz, yalnızca menü açılır
    if (this.mode?.livePause && (this.state === 'playing')) {
      this.livePaused = force ?? !this.livePaused;
      this.ui.pause.classList.toggle('visible', this.livePaused);
      if (this.livePaused) this.typing.cancel();
      return;
    }
    const pause = force ?? this.state === 'playing';
    if (pause && this.state === 'playing') {
      this.state = 'paused';
      this.ui.pause.classList.add('visible');
    } else if (!pause && this.state === 'paused') {
      this.state = 'playing';
      this.ui.pause.classList.remove('visible');
    }
  }

  toggleMoveMode() {
    if (this.state !== 'playing' || this.player.anchor) return;
    this.moveMode = this.moveMode === 'follow' ? 'click' : 'follow';
    this.player.clickTarget = null;
  }

  openLevelUp() {
    this.state = 'levelup';
    this.typing.cancel();
    this.audio.levelUp();
    this.hud.screenFlash('gold');
    this.levelUpUI.show(this.upgrades.rollChoices(3 + (this.stats.extraChoice || 0)));
  }

  /** Çevrim içi Boss Avı: kartlar oyunu durdurmadan çıkar (ekip savaşmaya devam eder) */
  openLiveLevelUp() {
    this.liveCards = true;
    this.audio.levelUp();
    this.hud.screenFlash('gold');
    this.levelUpUI.show(this.upgrades.rollChoices(3 + (this.stats.extraChoice || 0)), true);
  }

  onUpgradePicked(upgrade) {
    this.upgrades.apply(upgrade);
    this.xp.pendingLevels--;
    this.levelUpUI.hide();
    if (this.xp.pendingLevels > 0) {
      if (this.liveCards) this.openLiveLevelUp(); else this.openLevelUp();
      return;
    }
    this.liveCards = false;
    this.state = 'playing';
    // Güç dalgası: yakındaki düşmanları it
    const pp = this.player.position;
    this.particles.ring(pp, 0xffd84a, 9, 0.6);
    this.particles.burst(pp, [0xffd84a, 0xffffff], 40, { speed: 12, size: 0.25 });
    for (const e of this.enemies) {
      const dx = e.mesh.position.x - pp.x, dz = e.mesh.position.z - pp.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < 9) { e.knock.x += (dx / d) * 22; e.knock.z += (dz / d) * 22; }
    }
    this.sceneMgr.addShake(0.4);
    const at = pp.clone(); at.y += 3.5;
    this.floating.spawn(at, upgrade.name.toLocaleUpperCase('tr-TR') + '!', 'levelup');
  }

  /** end = { result: 'win'|'lose'|'timeup', title, sub } */
  endGame(end) {
    if (this.state === 'gameover') return;
    this.state = 'gameover';
    this.typing.cancel();
    this.endInfo = end;
    const title = document.getElementById('goTitle');
    title.textContent = end.title;
    title.className = end.result === 'lose' ? 'dead' : 'victory';
    document.getElementById('goSub').textContent = end.sub || '';
    if (end.result !== 'lose') {
      this.audio.levelUp();
      this.hud.screenFlash('gold');
    }
    const pp = this.player.position;
    this.particles.burst(pp.clone().setY(1.2), [new THREE.Color(this.character.color).getHex(), 0xffffff, 0xff3b3b], 80, { speed: 14, size: 0.3, life: 1.2 });
    if (end.result === 'lose') this.audio.kill(true);
    this.sceneMgr.addShake(1);
    const sum = this.mode.summary();
    this._summary = sum;
    const boxes = [
      ...sum.stats,
      { label: 'Seviye', value: this.xp.level },
      { label: 'Toplam XP', value: Math.round(this.xp.totalEarned).toLocaleString('tr-TR') },
      { label: 'En Uzun Kombo', value: this.typing.maxStreak },
      { label: 'İsabet', value: `%${Math.round(this.typing.accuracy * 100)}` },
    ];
    const statsEl = document.getElementById('goStats');
    statsEl.replaceChildren(...boxes.map((b) => {
      const d = document.createElement('div');
      const v = document.createElement('b');
      v.textContent = b.value;
      const l = document.createElement('span');
      l.textContent = b.label;
      d.append(v, l);
      return d;
    }));
    document.getElementById('goMode').textContent = `${this.modeDef.icon} ${this.modeDef.name} · ${this.character.icon} ${this.character.name}`;
    setTimeout(() => this.ui.gameover.classList.add('visible'), 700);
    this._submitScore();
  }

  async _submitScore() {
    const statusEl = document.getElementById('saveStatus');
    statusEl.className = 'save-status';
    statusEl.textContent = 'Skor kaydediliyor…';
    const res = await this.leaderboard.submit({
      metrics: this._summary.metrics,
      time: this.elapsed, xp: this.xp.totalEarned, level: this.xp.level, char: this.character.id,
    });
    if (res.saved) {
      const best = res.newBests ?? [];
      statusEl.classList.add('ok');
      statusEl.textContent = best.length
        ? `🏆 Yeni kişisel rekor (${best.join(' ve ')})! ${res.saved === 'local' ? 'Bu tarayıcıya kaydedildi.' : 'Lider tablosuna işlendi.'}`
        : (res.saved === 'local' ? 'Skor bu tarayıcıya kaydedildi.' : 'Skor kaydedildi. Rekorunu geçemedin, tekrar dene!');
      if (res.newKeys?.length === 1) this.lbOver.setTab(res.newKeys[0]);
    } else {
      statusEl.classList.add('err');
      statusEl.textContent = res.reason === 'readonly'
        ? 'Bu sayfada skor kaydetme iznin yok; tabloyu yalnızca görebilirsin.'
        : 'Skor kaydedilemedi. Bağlantını kontrol edip tekrar oyna.';
    }
  }

  // ---------------- Girdi ----------------
  onKeyDown(e) {
    if (this.state === 'cards') {
      if (e.key === 'Escape') this.cardsPage.close();
      return;
    }
    if (this.state === 'menu') {
      if (e.key === 'Enter') { e.preventDefault(); this.openCharacterSelect(); return; }
      if (e.target !== this._nickInput) this.modeMenu.handleKey(e);
      return;
    }
    if (this.state === 'select') {
      this.charSelect.handleKey(e);
      return;
    }
    if (this.state === 'navalLobby') {
      if (e.key === 'Escape') this.naval.closeLobby();
      return;
    }
    if (this.state === 'naval') {
      this.naval.handleKey(e);
      return;
    }
    if (this.state === 'fetih') {
      this.fetih.handleKey(e);
      return;
    }
    if (this.state === 'fetihLobby') {
      if (e.key === 'Escape') this.fetih.closeLobby();
      return;
    }
    if (this.state === 'bossLobby') {
      if (e.key === 'Escape') this.bossLobby.close();
      return;
    }
    if (this.livePaused && this.state === 'playing') {
      if (e.key === 'Escape') this.togglePause(false);
      else if (e.key === 'm' || e.key === 'M') this.toMainMenu();
      return;
    }
    if (this.state === 'playing' && this.mode?.blockInput?.()) {
      if (e.key === 'Escape') this.togglePause(true);
      return;
    }
    if (this.state === 'gameover') {
      if (!this.ui.gameover.classList.contains('visible')) return;
      if (e.key === 'Enter') this.restart();
      else if (e.key === 'm' || e.key === 'M') this.toMainMenu();
      return;
    }
    if (this.state === 'levelup') {
      this.levelUpUI.handleKey(e);
      return;
    }
    if (this.state === 'paused' && !e.repeat) {
      if (e.key === 'm' || e.key === 'M') { this.toMainMenu(); return; }
      if (e.key === 'r' || e.key === 'R') { this.restart(); return; }
    }
    if (e.key === 'Escape') {
      if (this.state === 'playing' && this.typing.target) this.typing.cancel();
      else this.togglePause();
      return;
    }
    if (this.state !== 'playing') return;
    if (this.liveCards && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); this.levelUpUI.handleKey(e); return; }
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (!this.ult.trigger() && !e.repeat) this.hud.ultNotReady();
      return;
    }
    if (this.mode?.onKey?.(e)) { e.preventDefault(); return; }
    if (e.key === 'Backspace') {
      e.preventDefault();
      this.typing.cancel();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    const ch = trLower(e.key);
    if (!LETTER.test(ch)) return;
    e.preventDefault();
    this.typing.handleChar(ch);
  }

  // ---------------- Savaş olayları ----------------
  damageEnemy(e, dmg, opts = {}) {
    if (!e.alive) return;
    const s = this.stats;
    // Kart çarpanları (İlk Kan, Dev Avcısı)
    if (!opts.dot && !opts.helper) {
      if (s.firstStrikeMult && e.hp >= e.maxHp) dmg *= 1 + s.firstStrikeMult;
      if (s.eliteMult && e.def.elite) dmg *= 1 + s.eliteMult;
    }
    e.hp -= dmg;
    this.mode?.onEnemyDamaged?.(e, dmg, opts);
    e.flash = opts.dot ? Math.max(e.flash, 0.4) : 1;

    if (!opts.dot) {
      const pp = this.player.position;
      const dx = e.mesh.position.x - pp.x, dz = e.mesh.position.z - pp.z;
      const d = Math.hypot(dx, dz) || 1;
      const kb = (opts.crit ? 16 : 9) * (e.def.knockback ?? 1) * (s.knockbackMult ?? 1) * (opts.helper ? 0.35 : 1);
      e.knock.x += (dx / d) * kb;
      e.knock.z += (dz / d) * kb;
    }

    const head = e.mesh.position.clone();
    head.y += e.height + 0.6;
    const cls = opts.crit ? 'crit-num' : opts.dot ? 'dot-num' : opts.helper ? 'helper-num' : opts.chain ? 'chain-num' : 'dmg';
    this.floating.spawn(head, `${Math.round(dmg)}${opts.crit ? '!' : ''}`, cls);
    if (!opts.dot) {
      this.particles.burst(head.setY(e.height * 0.6), [e.def.color, 0xffffff], opts.helper ? 4 : 8, { speed: 6, size: 0.18, life: 0.4 });
      if (!opts.helper) {
        this.audio.hit(opts.crit);
        this.sceneMgr.addShake(opts.crit ? 0.2 : 0.07);
      }
    }

    // Durum etkileri: yalnızca kahramanın doğrudan vuruşları
    if (opts.primary || opts.chain) {
      if (s.burnDps > 0) { e.burnT = 3; e.burnDps = s.burnDps; }
      if (s.poisonDps > 0) { e.poisonT = 4; e.poisonStacks = Math.min(5, (e.poisonStacks || 0) + 1); }
      if (s.freezeChance > 0 && e.hp > 0 && Math.random() < s.freezeChance) this.freezeEnemy(e, 1.2);
    }
    // Cellat: canı eşiğin altına düşen düşman infaz edilir
    if (e.hp > 0 && !e.net && !e.def.boss && s.executeThreshold > 0 && e.hp < e.maxHp * s.executeThreshold) {
      e.hp = 0;
      const at = e.mesh.position.clone(); at.y += e.height + 1.4;
      this.floating.spawn(at, 'İNFAZ!', 'crit');
    }

    if (e.hp <= 0) {
      this.killEnemy(e, dmg, opts);
    } else if (opts.primary && !opts.dot) {
      // Hayatta kaldı: yeni kelime ver
      e.word = this.waves.pickWord(e.def.wordTier, e);
      e.typed = 0;
      e.incoming = false;
    }
  }

  /** Düşmanı dondur (Buz Dokunuşu, Buz Patlaması) */
  freezeEnemy(e, secs) {
    e.stunT = Math.max(e.stunT || 0, secs);
    const at = e.mesh.position.clone().setY(e.height * 0.6);
    this.particles.burst(at, [0xbff4ff, 0x7fe3ff, 0xffffff], 10, { speed: 5, size: 0.2, life: 0.5 });
  }

  /** Yanma ve zehir hasarı (yarım saniyede bir sayı gösterilir) */
  _tickStatus(dt) {
    for (const e of [...this.enemies]) {
      if (!e.alive) continue;
      let dps = 0;
      if (e.burnT > 0) {
        e.burnT -= dt;
        dps += e.burnDps;
        if (Math.random() < dt * 14) this.particles.emit(e.mesh.position.x + (Math.random() - 0.5) * 0.6, e.height * (0.4 + Math.random() * 0.6), e.mesh.position.z + (Math.random() - 0.5) * 0.6, Math.random() < 0.5 ? 0xff6a00 : 0xffd84a, 0, 2.5, 0, 0.2, 0.4, -2);
      }
      if (e.poisonT > 0) {
        e.poisonT -= dt;
        dps += this.stats.poisonDps * e.poisonStacks;
        if (Math.random() < dt * 8) this.particles.emit(e.mesh.position.x, e.height * 0.8, e.mesh.position.z, 0x7dff5a, (Math.random() - 0.5), 1.5, (Math.random() - 0.5), 0.18, 0.5, -1);
        if (e.poisonT <= 0) e.poisonStacks = 0;
      }
      if (dps <= 0) continue;
      e.dotAcc = (e.dotAcc || 0) + dps * dt;
      e.dotTick = (e.dotTick || 0) + dt;
      if (e.dotTick >= 0.5) {
        const d = e.dotAcc;
        e.dotTick = 0;
        e.dotAcc = 0;
        this.damageEnemy(e, d, { dot: true });
      }
    }
  }

  killEnemy(e, dmg, opts) {
    const F = CONFIG.FX;
    const pos = e.mesh.position.clone();
    const center = pos.clone().setY(e.height * 0.5);
    const above = pos.clone().setY(e.height + 1.6);
    const big = opts.crit || e.def.elite;

    this.kills++;
    const byHero = !opts.helper && !opts.dot; // yardımcıların ve yanmanın öldürmeleri coşku yazısı tetiklemez
    if (byHero) {
      this.killChain.count++;
      this.killChain.timer = F.multiKillWindow;
    }

    // Abartılı patlama
    this.particles.burst(center, [e.def.color, e.def.color, 0xffffff], F.particlesPerKill * (big ? 2 : 1) * (e.def.elite ? 2 : 1),
      { speed: big ? 15 : 10, size: 0.32 * Math.max(1, e.height * 0.7), life: 0.9 });
    this.particles.burst(center, 0xffffff, 10, { speed: 14, size: 0.14, life: 0.3, gravity: 0 });
    this.particles.ring(pos, big ? 0xffd84a : 0xffffff, big ? 6 : 3.5, 0.45);
    this.sceneMgr.addShake(big ? F.shakeOnCrit : F.shakeOnKill);
    this.audio.kill(big);
    this.hitStop = Math.max(this.hitStop, big ? F.hitStop * 1.6 : F.hitStop * 0.6);

    // Coşku yazıları (data/hypeTexts.js)
    const overkill = dmg >= e.maxHp * 2;
    if (e.def.elite) {
      this.epic(above, pickHype(HYPE.elite));
    } else if (opts.crit && overkill) {
      this.epic(above, pickHype(HYPE.overkill));
    } else if (opts.crit) {
      this.floating.spawn(above, pickHype(HYPE.critKill), 'crit');
      this.sceneMgr.punch(0.05);
    }
    // Art arda öldürme yazısı karenin sonunda gösterilir; aynı anda ölenler tek yazı alır
    if (byHero) this._pendingMulti = above.clone().setY(above.y + 1.2);

    this.xp.drop(pos, e.def.xp);
    const s = this.stats;
    if (s.doubleXpChance > 0 && Math.random() < s.doubleXpChance) this.xp.drop(pos, e.def.xp);
    if (s.ultOnKill > 0) this.ult.charge = Math.min(1, this.ult.charge + s.ultOnKill);
    if (s.killStreak > 0) { this.typing.streak += s.killStreak; this.typing.maxStreak = Math.max(this.typing.maxStreak, this.typing.streak); }
    if (s.frostNova > 0) {
      this.particles.ring(pos, 0x7fe3ff, s.frostNova, 0.4);
      for (const o of this.enemies) {
        if (o !== e && o.alive && Math.hypot(o.mesh.position.x - pos.x, o.mesh.position.z - pos.z) < s.frostNova + o.radius) this.freezeEnemy(o, 1.2);
      }
    }
    this.mode.onEnemyKilled?.(e, pos);

    if (this.stats.lifesteal > 0) {
      this.player.heal(this.stats.lifesteal);
      const at = this.player.position.clone(); at.y += 2.6;
      this.floating.spawn(at, `+${this.stats.lifesteal}`, 'heal');
    }

    this.typing.onEnemyRemoved(e);
    this.waves.remove(e);

    // Patlayan Rün: çevreye hasar (zincirleme patlamalar olabilir)
    const R = this.stats.explodeRadius;
    if (R > 0 && (opts.explosionDepth ?? 0) < 3) {
      this.particles.ring(pos, 0xff6a00, R, 0.4);
      this.particles.burst(center, [0xff6a00, 0xffd84a], 20, { speed: 12, size: 0.3, life: 0.5 });
      const victims = this.enemies.filter((o) => o.alive && o.mesh.position.distanceTo(pos) < R + o.radius);
      const boom = CONFIG.COMBAT.baseDamage * this.stats.damageMult * CONFIG.COMBAT.explosionDamageFactor * (this.stats.explodeDmgMult ?? 1);
      for (const v of victims) {
        this.damageEnemy(v, boom, { explosion: true, explosionDepth: (opts.explosionDepth ?? 0) + 1 });
      }
    }
  }

  /** Bu karedeki öldürmeler için en yüksek "art arda öldürme" yazısını göster */
  _flushMultiKill() {
    if (!this._pendingMulti) return;
    const at = this._pendingMulti;
    this._pendingMulti = null;
    const n = this.killChain.count;
    const shown = this.killChain.shown ?? 0;
    let level = 0;
    for (const k of Object.keys(HYPE.multi).map(Number)) if (k <= n && k > level) level = k;
    let text = level > shown ? HYPE.multi[level] : null;
    if (n > 10 && Math.floor(n / 5) * 5 > Math.max(shown, 10)) {
      level = Math.floor(n / 5) * 5;
      text = `KATLİAM x${n}!`;
    }
    if (!text) return;
    this.killChain.shown = level;
    if (level >= 3) this.epic(at, text);
    else this.floating.spawn(at, text, 'multi');
  }

  /** En büyük coşku anı: dev yazı + sarsıntı + flaş */
  epic(at, text) {
    this.floating.spawn(at, text, 'epic');
    this.sceneMgr.addShake(1);
    this.sceneMgr.punch(0.12);
    this.hitStop = Math.max(this.hitStop, 0.13);
    this.hud.screenFlash('white');
    this.particles.burst(at.clone().setY(1), [0xffd84a, 0xff6a00, 0xffffff], 50, { speed: 18, size: 0.3, life: 1 });
  }

  onPlayerHurt(amount) {
    this.audio.hurt();
    this.sceneMgr.addShake(0.5);
    this.hud.hurt();
    const at = this.player.position.clone(); at.y += 2.6;
    this.floating.spawn(at, `-${amount}`, 'hurt');
    this.particles.burst(this.player.position.clone().setY(1), [0xff3b3b, 0x2f6fff], 14, { speed: 7, size: 0.2 });
    if (this.player.hp <= 0 && this.stats.revive > 0) {
      // Anka Tüyü: bir kez dirilt
      this.stats.revive--;
      this.player.hp = this.stats.maxHp * 0.5;
      this.player.ultInvuln = 2;
      const up = this.player.position.clone(); up.y += 3;
      this.epic(up, 'KÜLLERİNDEN DOĞDU!');
      this.particles.ring(this.player.position, 0xff8a1a, 7, 0.6);
      return;
    }
    if (this.player.hp <= 0) {
      const end = this.mode.onPlayerDeath();
      if (end) this.endGame(end);
    }
  }

  // ---------------- Döngü ----------------
  update(dt) {
    this.elapsed += dt;
    this.input.update();
    this.player.update(dt);
    this.waves.update(dt);
    if (this.state !== 'playing') return; // oyuncu öldüyse
    this._tickStatus(dt);
    const end = this.mode.checkEnd();
    if (end) { this.endGame(end); return; }
    this.combat.update(dt);
    this.ult.update(dt);
    this.buffs.update(dt);
    this.xp.update(dt);
    this.typing.update(dt);
    this.particles.update(dt);

    this._flushMultiKill();
    if (this.killChain.timer > 0) {
      this.killChain.timer -= dt;
      if (this.killChain.timer <= 0) { this.killChain.count = 0; this.killChain.shown = 0; }
    }
    if (this.xp.pendingLevels > 0 && this.state === 'playing' && !this.liveCards) {
      if (this.mode.liveLevel) this.openLiveLevelUp(); else this.openLevelUp();
    }
  }

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const realDt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    let dt = realDt;
    if (this.hitStop > 0) {
      this.hitStop -= realDt;
      dt = realDt * 0.08; // vuruş donması
    }

    if (this.state === 'naval') {
      this.naval.update(realDt);
      this.naval.render();
      return;
    }
    if (this.state === 'fetih') {
      this.fetih.update(realDt);
      this.fetih.render();
      return;
    }
    if (this.state === 'playing') this.update(dt);
    else if (this.state === 'gameover') this.particles.update(realDt);

    this.sceneMgr.update(realDt, this.mode?.cameraFocus ?? this.player.position);
    this.labels.update();
    this.floating.update(realDt);
    this.hud.update();
    this.minimap.update();
    this.sceneMgr.render();
  }
}

// claude.ai dışında, server/server.js ile açıldıysa yerel ağ köprüsüne bağlan
// (Radmin VPN / aynı Wi-Fi üzerinden çok oyunculu + ortak lider tablosu)
if (!window.claude) {
  const local = await connectLocal();
  if (local) window.claude = local;
}

window.game = new Game();
