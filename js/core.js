'use strict';
// ============================================================
//  烬灯 Emberlight —— 核心：常量、工具、输入、粒子、物理、相机
// ============================================================
const TILE = 32, VW = 960, VH = 540;
const FONT = '"Microsoft YaHei","PingFang SC","Noto Sans CJK SC","Source Han Sans SC",sans-serif';
const SERIF = '"STSong","Songti SC","SimSun","Noto Serif CJK SC","Source Han Serif SC",serif';

const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  sign: v => (v < 0 ? -1 : v > 0 ? 1 : 0),
  approach(v, t, d) { return v < t ? Math.min(v + d, t) : Math.max(v - d, t); },
  overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; },
  dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); },
  rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  },
  hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
  ease: t => t * t * (3 - 2 * t),
  easeOut: t => 1 - (1 - t) * (1 - t),
  fmtTime(s) {
    s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60;
    return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(ss).padStart(2, '0');
  },
  makeCanvas(w, h) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c;
  },
};

// ------------------------------------------------------------
//  输入（键盘 + 手柄）
// ------------------------------------------------------------
const Input = {
  keys: Object.create(null),
  cur: Object.create(null),
  prev: Object.create(null),
  binds: {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    jump: ['KeyZ', 'Space', 'KeyK'],
    attack: ['KeyX', 'KeyJ'],
    dash: ['KeyC', 'KeyL', 'ShiftLeft', 'ShiftRight'],
    focus: ['KeyV', 'KeyI'],
    cast: ['KeyF', 'KeyU'],
    map: ['Tab', 'KeyM'],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'KeyZ', 'Space', 'KeyK'],
    back: ['Escape', 'Backspace', 'KeyX', 'KeyJ'],
  },
  device: 'kb',
  init() {
    const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);
    addEventListener('keydown', e => {
      if (!e.repeat) this.press(e.code); this.device = 'kb';
      if (block.has(e.code)) e.preventDefault();
      Sfx.unlock();
    });
    addEventListener('keyup', e => { this.release(e.code); });
    addEventListener('blur', () => { this.keys = Object.create(null); this.seen = Object.create(null); this.late = Object.create(null); });
    addEventListener('mousedown', () => Sfx.unlock());
    addEventListener('touchstart', () => Sfx.unlock(), { passive: true });
  },
  // 按下后至少保留一个逻辑帧，避免快速轻点（尤其触屏）被漏掉
  seen: Object.create(null), late: Object.create(null),
  press(code) { this.keys[code] = true; this.seen[code] = false; delete this.late[code]; },
  release(code) { if (this.keys[code] && this.seen[code] === false) this.late[code] = true; else this.keys[code] = false; },
  update() {
    this.prev = this.cur;
    const c = Object.create(null);
    for (const a in this.binds) {
      const list = this.binds[a];
      for (let i = 0; i < list.length; i++) if (this.keys[list[i]]) { c[a] = true; break; }
    }
    const pads = (typeof navigator !== 'undefined' && navigator.getGamepads) ? navigator.getGamepads() : [];
    for (const p of pads || []) {
      if (!p || !p.buttons) continue;
      const b = i => p.buttons[i] && p.buttons[i].pressed;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      let any = false;
      if (ax < -0.45 || b(14)) { c.left = true; any = true; }
      if (ax > 0.45 || b(15)) { c.right = true; any = true; }
      if (ay < -0.55 || b(12)) { c.up = true; any = true; }
      if (ay > 0.55 || b(13)) { c.down = true; any = true; }
      if (b(0)) { c.jump = true; c.confirm = true; any = true; }
      if (b(2)) { c.attack = true; any = true; }
      if (b(5) || b(7)) { c.dash = true; any = true; }
      if (b(1)) { c.focus = true; c.back = true; any = true; }
      if (b(3)) { c.cast = true; any = true; }
      if (b(9)) { c.pause = true; any = true; }
      if (b(8) || b(4)) { c.map = true; any = true; }
      if (any) this.device = 'pad';
    }
    this.cur = c;
    for (const k in this.keys) if (this.keys[k]) this.seen[k] = true;
    for (const k in this.late) { this.keys[k] = false; delete this.late[k]; }
  },
  down(a) { return !!this.cur[a]; },
  pressed(a) { return !!this.cur[a] && !this.prev[a]; },
  released(a) { return !this.cur[a] && !!this.prev[a]; },
  // 菜单用：带自动连发的方向
  _rep: {},
  repeat(a, dt) {
    if (!this.cur[a]) { this._rep[a] = 0; return false; }
    if (!this.prev[a]) { this._rep[a] = 0.35; return true; }
    this._rep[a] -= dt;
    if (this._rep[a] <= 0) { this._rep[a] = 0.09; return true; }
    return false;
  },
};

// ------------------------------------------------------------
//  粒子
// ------------------------------------------------------------
class Particles {
  constructor() { this.list = []; }
  add(p) {
    p.life = p.life ?? 0.5; p.max = p.life;
    p.vx = p.vx ?? 0; p.vy = p.vy ?? 0; p.size = p.size ?? 3;
    p.color = p.color ?? '#fff'; p.grav = p.grav ?? 0; p.drag = p.drag ?? 1;
    p.shape = p.shape ?? 'circle'; p.glow = p.glow ?? false; p.rot = p.rot ?? Math.random() * 6.28; p.vr = p.vr ?? 0;
    p.shrink = p.shrink ?? true;
    this.list.push(p);
    if (this.list.length > 1800) this.list.shift();
    return p;
  }
  burst(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.angle !== undefined ? o.angle + U.rand(-(o.spread ?? Math.PI), o.spread ?? Math.PI) : U.rand(0, Math.PI * 2);
      const s = U.rand(o.speedMin ?? 40, o.speed ?? 200);
      this.add({
        x: x + U.rand(-(o.jitter ?? 0), o.jitter ?? 0), y: y + U.rand(-(o.jitter ?? 0), o.jitter ?? 0),
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: U.rand(o.lifeMin ?? (o.life ?? 0.5) * 0.6, o.life ?? 0.5),
        size: U.rand(o.sizeMin ?? (o.size ?? 3) * 0.5, o.size ?? 3),
        color: Array.isArray(o.color) ? U.pick(o.color) : (o.color ?? '#fff'),
        grav: o.grav ?? 0, drag: o.drag ?? 0.92, shape: o.shape, glow: o.glow, vr: o.vr ?? U.rand(-8, 8),
      });
    }
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
      p.vy += p.grav * dt;
      if (p.drag !== 1) { const d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vy *= d; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
  }
  draw(ctx, glowPass) {
    for (const p of this.list) {
      if (!!p.glow !== glowPass) continue;
      const t = p.life / p.max;
      const s = p.shrink ? p.size * (0.3 + 0.7 * t) : p.size;
      ctx.globalAlpha = Math.min(1, t * 1.6) * (p.alpha ?? 1);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-s, -s * 0.5, s * 2, s); ctx.restore();
      } else if (p.shape === 'leaf') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.6, s * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else if (p.shape === 'line') {
        ctx.strokeStyle = p.color; ctx.lineWidth = s; ctx.beginPath();
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
      } else if (p.shape === 'ring') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - t), 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.3, s), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  clear() { this.list.length = 0; }
}

// ------------------------------------------------------------
//  物理：AABB 对瓦片地图
//  瓦片：0 空 1 实心 2 尖刺 3 单向平台 4 可破坏墙 5 闸门
// ------------------------------------------------------------
const T_EMPTY = 0, T_SOLID = 1, T_SPIKE = 2, T_ONEWAY = 3, T_BREAK = 4, T_GATE = 5, T_SEAL = 6, T_LGATE = 7;

const Phys = {
  solid(room, tx, ty, b) {
    const t = room.tile(tx, ty);
    return t === T_SOLID || t === T_BREAK || t === T_SEAL || t === T_LGATE || (t === T_GATE && room.gateClosed) || (t === T_SPIKE && b.spikeSolid);
  },
  move(room, b, dt) {
    b.hitL = b.hitR = b.hitU = false;
    b.onGround = false;
    const mx = b.vx * dt, my = b.vy * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(my)) / 7));
    const sx = mx / steps, sy = my / steps;
    for (let i = 0; i < steps; i++) {
      this.stepX(room, b, sx);
      this.stepY(room, b, sy);
    }
    // 静止贴地检测
    if (!b.onGround && b.vy >= 0) {
      const ty = Math.floor((b.y + b.h + 0.5) / TILE);
      const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 0.01) / TILE);
      if (Math.abs((b.y + b.h) - ty * TILE) < 0.6) {
        for (let tx = x0; tx <= x1; tx++) {
          if (this.solid(room, tx, ty, b) || (room.tile(tx, ty) === T_ONEWAY && !b.dropping)) { b.onGround = true; break; }
        }
      }
    }
  },
  stepX(room, b, dx) {
    if (!dx) return;
    b.x += dx;
    const y0 = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - 0.01) / TILE);
    if (dx > 0) {
      const tx = Math.floor((b.x + b.w - 0.01) / TILE);
      for (let ty = y0; ty <= y1; ty++) if (this.solid(room, tx, ty, b)) { b.x = tx * TILE - b.w; b.vx = 0; b.hitR = true; return; }
    } else {
      const tx = Math.floor(b.x / TILE);
      for (let ty = y0; ty <= y1; ty++) if (this.solid(room, tx, ty, b)) { b.x = (tx + 1) * TILE; b.vx = 0; b.hitL = true; return; }
    }
  },
  stepY(room, b, dy) {
    if (!dy) return;
    const prevBottom = b.y + b.h;
    b.y += dy;
    const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 0.01) / TILE);
    if (dy > 0) {
      const ty = Math.floor((b.y + b.h - 0.01) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        const t = room.tile(tx, ty);
        if (this.solid(room, tx, ty, b) || (t === T_ONEWAY && !b.dropping && !b.noOneway && prevBottom <= ty * TILE + 0.5)) {
          b.y = ty * TILE - b.h; b.vy = 0; b.onGround = true; return;
        }
      }
    } else {
      const ty = Math.floor(b.y / TILE);
      for (let tx = x0; tx <= x1; tx++) if (this.solid(room, tx, ty, b)) { b.y = (ty + 1) * TILE; b.vy = 0; b.hitU = true; return; }
    }
  },
  // 区域内是否与某类瓦片重叠
  touchesTile(room, r, type, inset = 0) {
    const x0 = Math.floor((r.x + inset) / TILE), x1 = Math.floor((r.x + r.w - inset - 0.01) / TILE);
    const y0 = Math.floor((r.y + inset) / TILE), y1 = Math.floor((r.y + r.h - inset - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (room.tile(tx, ty) === type) return { tx, ty };
    return null;
  },
  // 尖刺命中：只算瓦片下半部的尖端区域
  touchesSpike(room, r) {
    const x0 = Math.floor(r.x / TILE), x1 = Math.floor((r.x + r.w - 0.01) / TILE);
    const y0 = Math.floor(r.y / TILE), y1 = Math.floor((r.y + r.h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (room.tileRaw(tx, ty) !== T_SPIKE) continue;
      const sx = tx * TILE + 3, sy = ty * TILE + 12, sw = TILE - 6, sh = TILE - 12;
      if (r.x < sx + sw && r.x + r.w > sx && r.y < sy + sh && r.y + r.h > sy) return true;
    }
    return false;
  },
  // 射线粗略视线判断
  lineOfSight(room, x0, y0, x1, y1) {
    const d = U.dist(x0, y0, x1, y1), n = Math.ceil(d / 12);
    for (let i = 1; i < n; i++) {
      const t = i / n, x = U.lerp(x0, x1, t), y = U.lerp(y0, y1, t);
      if (room.isSolid(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
    }
    return true;
  },
};

// ------------------------------------------------------------
//  相机
// ------------------------------------------------------------
class Camera {
  constructor() { this.x = 0; this.y = 0; this.shakeT = 0; this.shakeMag = 0; this.ox = 0; this.oy = 0; this.lookY = 0; }
  target(tx, ty, room) {
    let cx = tx - VW / 2, cy = ty - VH / 2;
    cx = room.pw <= VW ? (room.pw - VW) / 2 : U.clamp(cx, 0, room.pw - VW);
    cy = room.ph <= VH ? (room.ph - VH) / 2 : U.clamp(cy, 0, room.ph - VH);
    return [cx, cy];
  }
  follow(tx, ty, room, dt, snap) {
    const [cx, cy] = this.target(tx, ty, room);
    if (snap) { this.x = cx; this.y = cy; return; }
    const kx = 1 - Math.exp(-dt * 7), ky = 1 - Math.exp(-dt * 5);
    this.x += (cx - this.x) * kx; this.y += (cy - this.y) * ky;
  }
  shake(mag, t) { if (typeof Game !== 'undefined' && Game.opts && !Game.opts.shake) return; this.shakeMag = Math.max(this.shakeMag, mag); this.shakeT = Math.max(this.shakeT, t); }
  update(dt) {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const m = this.shakeMag * Math.min(1, this.shakeT * 6);
      this.ox = U.rand(-1, 1) * m; this.oy = U.rand(-1, 1) * m;
      if (this.shakeT <= 0) { this.shakeMag = 0; this.ox = this.oy = 0; }
    }
  }
  get vx() { return Math.round(this.x + this.ox); }
  get vy() { return Math.round(this.y + this.oy); }
}
