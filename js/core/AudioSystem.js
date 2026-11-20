// Ses dosyası gerektirmeyen, WebAudio ile sentezlenen efektler
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._lastPickup = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, len);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get ok() { return this.ctx && !this.muted; }

  tone({ freq = 440, type = 'square', dur = 0.08, vol = 0.3, slide = 0, delay = 0 }) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.4, filter = 1200, delay = 0 }) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filter, t);
    f.frequency.exponentialRampToValueAtTime(80, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  type(streak) { this.tone({ freq: 520 + Math.min(streak, 20) * 30, type: 'square', dur: 0.035, vol: 0.08 }); }
  error() { this.tone({ freq: 140, type: 'sawtooth', dur: 0.16, vol: 0.22, slide: -60 }); }
  shoot() { this.tone({ freq: 900, type: 'triangle', dur: 0.14, vol: 0.18, slide: -600 }); }
  arrow() {
    this.noise({ dur: 0.12, vol: 0.18, filter: 5000 });
    this.tone({ freq: 1400, type: 'triangle', dur: 0.1, vol: 0.1, slide: -900 });
  }
  dash() {
    this.noise({ dur: 0.18, vol: 0.25, filter: 4000 });
    this.tone({ freq: 300, type: 'sawtooth', dur: 0.15, vol: 0.12, slide: 500 });
  }
  slash(crit) {
    this.noise({ dur: 0.25, vol: 0.4, filter: 6000 });
    this.tone({ freq: crit ? 1800 : 1300, type: 'triangle', dur: 0.2, vol: 0.12, slide: -800 });
    this.tone({ freq: 110, type: 'sine', dur: 0.2, vol: 0.4, slide: -40 });
  }
  beam() {
    this.tone({ freq: 880, type: 'sine', dur: 0.18, vol: 0.14, slide: 400 });
    this.tone({ freq: 1320, type: 'triangle', dur: 0.12, vol: 0.06, delay: 0.02 });
  }
  ult() {
    this.noise({ dur: 0.6, vol: 0.4, filter: 2500 });
    [262, 392, 523, 784].forEach((f, i) => this.tone({ freq: f, type: 'sawtooth', dur: 0.3, vol: 0.12, delay: i * 0.05 }));
  }
  heal() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ freq: f, type: 'sine', dur: 0.35, vol: 0.14, delay: i * 0.06 })); }
  windup() { this.tone({ freq: 90, type: 'sawtooth', dur: 0.28, vol: 0.12, slide: 80 }); }
  slam(crit) {
    this.noise({ dur: 0.7, vol: 0.75, filter: 700 });
    this.tone({ freq: 70, type: 'sine', dur: 0.5, vol: 0.7, slide: -40 });
    if (crit) this.tone({ freq: 160, type: 'square', dur: 0.2, vol: 0.2, slide: -100, delay: 0.03 });
  }
  hit(crit) {
    this.noise({ dur: 0.08, vol: 0.25, filter: 3000 });
    this.tone({ freq: crit ? 220 : 320, type: 'square', dur: 0.07, vol: 0.12, slide: -100 });
  }
  kill(big) {
    this.noise({ dur: big ? 0.5 : 0.25, vol: big ? 0.6 : 0.35, filter: big ? 900 : 1600 });
    this.tone({ freq: big ? 90 : 120, type: 'sine', dur: big ? 0.4 : 0.22, vol: 0.5, slide: -60 });
  }
  pickup() {
    const now = performance.now();
    if (now - this._lastPickup < 45) return;
    this._lastPickup = now;
    this.tone({ freq: 1100 + Math.random() * 400, type: 'sine', dur: 0.06, vol: 0.08 });
  }
  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.2, vol: 0.22, delay: i * 0.08 }));
  }
  coin() {
    this.tone({ freq: 1568, type: 'square', dur: 0.05, vol: 0.06 });
    this.tone({ freq: 2093, type: 'square', dur: 0.08, vol: 0.06, delay: 0.05 });
  }
  build() {
    this.noise({ dur: 0.18, vol: 0.25, filter: 700 });
    [392, 523, 659].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.16, vol: 0.16, delay: 0.05 + i * 0.07 }));
  }
  thud() { this.tone({ freq: 120, type: 'sine', dur: 0.2, vol: 0.18, slide: -50 }); }
  hurt() { this.tone({ freq: 200, type: 'sawtooth', dur: 0.22, vol: 0.3, slide: -120 }); }
}
