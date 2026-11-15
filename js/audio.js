'use strict';
// ============================================================
//  音效与音乐：全部由 WebAudio 实时合成，无外部素材
// ============================================================
const Sfx = {
  ctx: null, master: null, sfxGain: null, musicGain: null, noiseBuf: null,
  volume: 0.7, musicVolume: 0.55, sfxVolume: 0.8,
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.volume; this.master.connect(c.destination);
    this.sfxGain = c.createGain(); this.sfxGain.gain.value = this.sfxVolume; this.sfxGain.connect(this.master);
    this.musicGain = c.createGain(); this.musicGain.gain.value = this.musicVolume; this.musicGain.connect(this.master);
    // 混响感：反馈延迟
    this.delay = c.createDelay(1.5); this.delay.delayTime.value = 0.42;
    this.fb = c.createGain(); this.fb.gain.value = 0.42;
    this.dlp = c.createBiquadFilter(); this.dlp.type = 'lowpass'; this.dlp.frequency.value = 1800;
    this.delay.connect(this.dlp); this.dlp.connect(this.fb); this.fb.connect(this.delay);
    this.delayOut = c.createGain(); this.delayOut.gain.value = 0.5;
    this.dlp.connect(this.delayOut); this.delayOut.connect(this.musicGain);
    const len = c.sampleRate;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    Music.onUnlock();
  },
  setVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volume;
    this.musicGain.gain.value = this.musicVolume;
    this.sfxGain.gain.value = this.sfxVolume;
  },
  tone(o) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(); const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f || 440, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.dur || 0.15));
    const v = o.vol ?? 0.3, a = o.attack ?? 0.004, dur = o.dur || 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.out || this.sfxGain);
    if (o.send) g.connect(this.delay);
    osc.start(t); osc.stop(t + dur + 0.05);
  },
  noise(o) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = o.rate || 1;
    const f = c.createBiquadFilter(); f.type = o.filter || 'lowpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f || 2000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.dur || 0.1));
    const g = c.createGain(); const v = o.vol ?? 0.3, dur = o.dur || 0.1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    if (o.send) g.connect(this.delay);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  },
  play(name, p = 1) {
    if (!this.ctx) return;
    const r = U.rand(0.94, 1.06) * p;
    switch (name) {
      case 'jump': this.noise({ f: 900 * r, f2: 2400, filter: 'bandpass', q: 2, dur: 0.09, vol: 0.12 }); break;
      case 'djump':
        this.noise({ f: 1400 * r, f2: 3600, filter: 'bandpass', q: 1.5, dur: 0.16, vol: 0.14 });
        this.tone({ f: 660 * r, f2: 990, type: 'triangle', dur: 0.15, vol: 0.06 }); break;
      case 'land': this.noise({ f: 500, f2: 150, dur: 0.07, vol: 0.12 }); break;
      case 'walljump': this.noise({ f: 1200 * r, f2: 600, filter: 'bandpass', q: 3, dur: 0.08, vol: 0.14 }); break;
      case 'slash': this.noise({ f: 3800 * r, f2: 900, filter: 'bandpass', q: 0.8, dur: 0.13, vol: 0.18 }); break;
      case 'clink':
        this.tone({ f: 1900 * r, type: 'square', dur: 0.06, vol: 0.05, lp: 4000 });
        this.noise({ f: 5000, filter: 'highpass', dur: 0.05, vol: 0.08 }); break;
      case 'hit':
        this.noise({ f: 1800 * r, f2: 300, dur: 0.12, vol: 0.28 });
        this.tone({ f: 180 * r, f2: 70, type: 'sine', dur: 0.12, vol: 0.3 }); break;
      case 'kill':
        this.noise({ f: 2400 * r, f2: 120, dur: 0.35, vol: 0.3 });
        this.tone({ f: 260 * r, f2: 50, type: 'triangle', dur: 0.3, vol: 0.25 }); break;
      case 'hurt':
        this.tone({ f: 120, f2: 40, type: 'sawtooth', dur: 0.35, vol: 0.3, lp: 900 });
        this.noise({ f: 3000, f2: 200, dur: 0.3, vol: 0.35 }); break;
      case 'dash': this.noise({ f: 600 * r, f2: 4000, filter: 'bandpass', q: 0.7, dur: 0.2, vol: 0.2 }); break;
      case 'focus': this.tone({ f: 220, f2: 440, type: 'sine', dur: 0.85, vol: 0.08, attack: 0.2 }); break;
      case 'heal':
        [523, 659, 784].forEach((f, i) => this.tone({ f, type: 'sine', dur: 0.5, vol: 0.12, delay: i * 0.06, send: true })); break;
      case 'amber': this.tone({ f: 1500 * r, f2: 2200, type: 'sine', dur: 0.08, vol: 0.06 }); break;
      case 'item':
        [392, 523, 659, 784, 1046].forEach((f, i) => this.tone({ f, type: 'triangle', dur: 0.9, vol: 0.12, delay: i * 0.09, send: true })); break;
      case 'bench':
        [262, 330, 392, 523].forEach((f, i) => this.tone({ f, type: 'sine', dur: 1.2, vol: 0.1, delay: i * 0.12, send: true })); break;
      case 'break':
        this.noise({ f: 1200, f2: 80, dur: 0.5, vol: 0.4 });
        this.tone({ f: 90, f2: 40, type: 'sine', dur: 0.4, vol: 0.35 }); break;
      case 'rock': this.noise({ f: 2600 * r, f2: 700, filter: 'bandpass', q: 2, dur: 0.12, vol: 0.18 }); break;
      case 'spit': this.noise({ f: 700 * r, f2: 300, filter: 'bandpass', q: 4, dur: 0.15, vol: 0.18 }); break;
      case 'roar':
        this.tone({ f: 70, f2: 45, type: 'sawtooth', dur: 1.4, vol: 0.3, lp: 600, attack: 0.1 });
        this.tone({ f: 105, f2: 60, type: 'sawtooth', dur: 1.3, vol: 0.2, lp: 500, attack: 0.1 });
        this.noise({ f: 400, f2: 100, dur: 1.2, vol: 0.25, attack: 0.1 }); break;
      case 'slam':
        this.tone({ f: 80, f2: 30, type: 'sine', dur: 0.5, vol: 0.5 });
        this.noise({ f: 900, f2: 60, dur: 0.45, vol: 0.4 }); break;
      case 'gate':
        this.tone({ f: 60, f2: 40, type: 'square', dur: 0.6, vol: 0.15, lp: 300 });
        this.noise({ f: 300, f2: 80, dur: 0.6, vol: 0.3 }); break;
      case 'orb': this.tone({ f: 500 * r, f2: 900, type: 'sine', dur: 0.25, vol: 0.06 }); break;
      case 'charge': this.tone({ f: 200, f2: 800, type: 'sawtooth', dur: 0.5, vol: 0.06, lp: 1500 }); break;
      case 'death':
        this.tone({ f: 300, f2: 40, type: 'triangle', dur: 1.4, vol: 0.3 });
        this.noise({ f: 1500, f2: 100, dur: 1.2, vol: 0.25 }); break;
      case 'menu': this.tone({ f: 880, type: 'sine', dur: 0.06, vol: 0.06 }); break;
      case 'select': this.tone({ f: 660, f2: 1320, type: 'triangle', dur: 0.12, vol: 0.08 }); break;
      case 'buy': [784, 1046, 1318].forEach((f, i) => this.tone({ f, type: 'sine', dur: 0.3, vol: 0.08, delay: i * 0.05 })); break;
      case 'deny': this.tone({ f: 200, f2: 150, type: 'square', dur: 0.15, vol: 0.06, lp: 800 }); break;
      case 'talk': this.tone({ f: U.rand(300, 420), type: 'triangle', dur: 0.04, vol: 0.03 }); break;
      case 'cast':
        this.noise({ f: 300 * r, f2: 2400, filter: 'bandpass', q: 1, dur: 0.3, vol: 0.3 });
        this.tone({ f: 160, f2: 90, type: 'sawtooth', dur: 0.3, vol: 0.12, lp: 900 }); break;
      case 'seal':
        [523, 784, 1046, 1568].forEach((f, i) => this.tone({ f, type: 'sine', dur: 0.8, vol: 0.08, delay: i * 0.05, send: true }));
        this.noise({ f: 2000, f2: 200, dur: 0.8, vol: 0.3 }); break;
      case 'shade': this.tone({ f: 330, f2: 660, type: 'sine', dur: 1.0, vol: 0.12, send: true }); break;
    }
  },
};

// ------------------------------------------------------------
//  生成式氛围音乐：区域持续低音 + 五声音阶的稀疏拨弦
// ------------------------------------------------------------
const Music = {
  track: null, pending: null, drones: [], noteT: 0, step: 0, bossBeat: 0,
  TRACKS: {
    title: { root: 98, scale: [0, 3, 7, 10, 12, 15], tempo: 1.6, drone: 0.05, bright: 900 },
    moss: { root: 110, scale: [0, 2, 5, 7, 9, 12, 14], tempo: 1.3, drone: 0.045, bright: 1100 },
    ruin: { root: 98, scale: [0, 3, 5, 7, 10, 12, 15], tempo: 1.5, drone: 0.05, bright: 800 },
    deep: { root: 82.4, scale: [0, 1, 5, 7, 8, 12, 13], tempo: 1.8, drone: 0.055, bright: 650 },
    frost: { root: 123.5, scale: [0, 2, 3, 7, 10, 12, 14, 19], tempo: 1.7, drone: 0.04, bright: 1800 },
    kiln: { root: 87.3, scale: [0, 1, 4, 5, 7, 8, 11, 12], tempo: 1.4, drone: 0.05, bright: 1000 },
    boss: { root: 73.4, scale: [0, 3, 6, 7, 10, 12], tempo: 0.25, drone: 0.06, bright: 1400, boss: true },
    end: { root: 130.8, scale: [0, 4, 7, 9, 12, 16, 19], tempo: 0.9, drone: 0.04, bright: 1600 },
    none: null,
  },
  onUnlock() { if (this.pending) { const p = this.pending; this.pending = null; this.track = null; this.play(p); } },
  play(name) {
    if (this.track === name) return;
    if (!Sfx.ctx) { this.pending = name; return; }
    this.track = name;
    const c = Sfx.ctx, t = c.currentTime;
    for (const d of this.drones) {
      d.g.gain.cancelScheduledValues(t);
      d.g.gain.setValueAtTime(d.g.gain.value, t);
      d.g.gain.linearRampToValueAtTime(0, t + 1.5);
      d.osc.stop(t + 1.6);
    }
    this.drones = [];
    const T = this.TRACKS[name];
    if (!T) return;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = T.bright * 0.4; lp.Q.value = 4;
    lp.connect(Sfx.musicGain);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = c.createGain(); lfoG.gain.value = T.bright * 0.25; lfo.connect(lfoG); lfoG.connect(lp.frequency);
    lfo.start();
    const mk = (f, type, vol) => {
      const osc = c.createOscillator(); osc.type = type; osc.frequency.value = f;
      const g = c.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(vol, t + 2.5);
      osc.connect(g); g.connect(lp); osc.start();
      this.drones.push({ osc, g });
    };
    mk(T.root / 2, 'sawtooth', T.drone);
    mk(T.root / 2 * 1.006, 'sawtooth', T.drone);
    mk(T.root * 1.5, 'triangle', T.drone * 0.5);
    this.drones.push({ osc: lfo, g: lfoG });
    this.noteT = 0.5; this.step = 0;
  },
  update(dt) {
    if (!Sfx.ctx || !this.track) return;
    const T = this.TRACKS[this.track]; if (!T) return;
    this.noteT -= dt;
    if (this.noteT > 0) return;
    if (T.boss) {
      // Boss：脉动低音 + 不和谐上方音
      this.step++;
      const pat = [0, 0, 7, 0, 3, 0, 6, 5];
      const semi = pat[this.step % pat.length];
      Sfx.tone({ f: T.root * Math.pow(2, semi / 12), type: 'sawtooth', dur: 0.22, vol: 0.09, lp: 700, out: Sfx.musicGain });
      if (this.step % 4 === 0) Sfx.noise({ f: 180, f2: 50, dur: 0.25, vol: 0.25 });
      if (this.step % 8 === 4) Sfx.noise({ f: 3000, filter: 'highpass', dur: 0.08, vol: 0.06 });
      if (this.step % 16 === 0) {
        const n = U.pick(T.scale) + 24;
        Sfx.tone({ f: T.root * Math.pow(2, n / 12), type: 'triangle', dur: 1.6, vol: 0.05, send: true, out: Sfx.musicGain });
      }
      this.noteT = T.tempo;
      return;
    }
    this.noteT = T.tempo * U.rand(0.6, 1.6);
    if (Math.random() < 0.25) return;
    const n = U.pick(T.scale) + (Math.random() < 0.3 ? 24 : 12);
    const f = T.root * Math.pow(2, n / 12);
    Sfx.tone({ f, type: 'triangle', dur: U.rand(1.2, 2.4), vol: U.rand(0.025, 0.05), attack: 0.01, send: true, out: Sfx.musicGain });
    if (Math.random() < 0.3) {
      const n2 = U.pick(T.scale) + 12;
      Sfx.tone({ f: T.root * Math.pow(2, n2 / 12), type: 'sine', dur: 2.5, vol: 0.02, attack: 0.3, send: true, out: Sfx.musicGain, delay: 0.2 });
    }
  },
};
