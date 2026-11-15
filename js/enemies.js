'use strict';
// ============================================================
//  敌人、投射物、掉落物
// ============================================================
class Enemy {
  constructor(x, y, w, h) {
    this.w = w; this.h = h; this.x = x - w / 2; this.y = y - h; // (x,y) 为脚底中心
    this.vx = 0; this.vy = 0; this.facing = -1;
    this.hp = 4; this.maxHp = 4; this.flash = 0; this.dead = false; this.stunT = 0;
    this.touch = 1; this.hittable = true; this.givesSoul = true;
    this.amber = [2, 4]; this.knock = 1; this.spikeSolid = true; this.noOneway = false;
    this.t = Math.random() * 10; this.onGround = false;
    this.homeX = this.x; this.homeY = this.y;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  box() { return this; }
  touchBox() { return { x: this.x + 3, y: this.y + 3, w: this.w - 6, h: this.h - 6 }; }
  col(c) { return this.flash > 0 ? '#ffffff' : c; }
  hurt(dmg, kx, ky) {
    this.hp -= dmg; this.flash = 0.12; this.stunT = 0.12;
    if (kx) { this.vx = kx * 300 * this.knock; this.facing = -kx; }
    if (ky < 0) this.vy = -260 * this.knock;
    if (ky > 0 && this.flying) this.vy = 260 * this.knock;
    Sfx.play('hit');
    Game.hitstop(0.045);
    Game.particles.burst(this.cx, this.cy, 8, { color: this.blood || ['#f6e7c8', '#e0a85c'], speed: 220, life: 0.45, size: 3, grav: 500, drag: 0.95 });
    if (this.hp <= 0) this.die();
    else this.onHurt?.();
  }
  die() {
    if (this.dead) return;
    this.dead = true;
    Sfx.play('kill');
    Game.cam.shake(4, 0.15);
    Game.particles.burst(this.cx, this.cy, 22, { color: this.blood || ['#f6e7c8', '#e0a85c', '#5a4a3a'], speed: 300, life: 0.7, size: 4, grav: 600, drag: 0.94 });
    Game.particles.add({ x: this.cx, y: this.cy, size: Math.max(this.w, this.h) * 0.8, life: 0.35, color: '#fff', shape: 'ring', glow: true });
    const n = U.randi(this.amber[0], this.amber[1]);
    Game.spawnAmber(this.cx, this.cy, n);
    this.onDeath?.();
  }
  physics(dt, grav = 2000) {
    if (grav) this.vy = Math.min(900, this.vy + grav * dt);
    Phys.move(Game.room, this, dt);
  }
  baseUpdate(dt) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.stunT > 0) this.stunT -= dt;
  }
  frontGround(dir) {
    const fx = dir > 0 ? this.x + this.w + 2 : this.x - 2;
    const ty = Math.floor((this.y + this.h + 2) / TILE), tx = Math.floor(fx / TILE);
    const room = Game.room, t = room.tile(tx, ty);
    return room.isSolid(tx, ty) || t === T_ONEWAY || t === T_SPIKE;
  }
  frontWall(dir) {
    const fx = dir > 0 ? this.x + this.w + 1 : this.x - 1;
    return Game.room.isSolid(Math.floor(fx / TILE), Math.floor((this.y + this.h / 2) / TILE));
  }
  playerDist() { const p = Game.player; return U.dist(this.cx, this.cy, p.cx, p.cy); }
  lights() { }
}

// ---------------- 苔甲虫：沿地面巡游 ----------------
class Crawler extends Enemy {
  constructor(x, y) { super(x, y, 30, 20); this.hp = this.maxHp = 4; this.speed = 55; this.facing = Math.random() < 0.5 ? -1 : 1; this.amber = [2, 3]; }
  update(dt) {
    this.baseUpdate(dt);
    if (this.stunT <= 0) {
      if (this.onGround && (this.frontWall(this.facing) || !this.frontGround(this.facing))) this.facing *= -1;
      this.vx = this.facing * this.speed;
    } else this.vx *= 0.9;
    this.physics(dt);
  }
  draw(ctx) {
    const x = this.cx, y = this.y + this.h, f = this.facing;
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
    // 腿
    ctx.strokeStyle = this.col('#2a1e14'); ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const p = Math.sin(this.t * 10 + i * 2) * 3;
      ctx.beginPath(); ctx.moveTo(-8 + i * 7, -6); ctx.lineTo(-10 + i * 7 + p, 0); ctx.stroke();
    }
    // 壳
    ctx.fillStyle = this.col('#3b2c22');
    ctx.beginPath(); ctx.moveTo(-15, -4); ctx.quadraticCurveTo(-14, -21, 0, -21); ctx.quadraticCurveTo(15, -21, 15, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = this.col('#5a4433');
    ctx.beginPath(); ctx.moveTo(-10, -8); ctx.quadraticCurveTo(-9, -18, 1, -18); ctx.quadraticCurveTo(-4, -13, -10, -8); ctx.fill();
    // 苔
    ctx.fillStyle = this.col('#5fa877');
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-10 + i * 5, -19 + Math.abs(i - 2) * 1.5, 3, 0, 6.28); ctx.fill(); }
    // 头
    ctx.fillStyle = this.col('#1c140e'); ctx.beginPath(); ctx.ellipse(15, -7, 6, 5, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(17, -8, 1.5, 0, 6.28); ctx.fill();
    ctx.restore();
  }
}

// ---------------- 磷火蛾：飞行追击 ----------------
class Flyer extends Enemy {
  constructor(x, y) {
    super(x, y, 24, 22); this.y = y - 16; this.homeY = this.y;
    this.hp = this.maxHp = 4; this.flying = true; this.aggro = false; this.amber = [2, 4];
    this.noOneway = true; this.spikeSolid = true; this.knock = 1.3;
    this.blood = ['#c9f5ff', '#7ad4ff', '#fff'];
  }
  update(dt) {
    this.baseUpdate(dt);
    const p = Game.player, d = this.playerDist();
    if (!this.aggro && d < 300 && Phys.lineOfSight(Game.room, this.cx, this.cy, p.cx, p.cy)) { this.aggro = true; Sfx.play('orb'); }
    if (this.aggro && d > 650) this.aggro = false;
    if (this.stunT > 0) { this.vx *= 0.92; this.vy *= 0.92; }
    else if (this.aggro && p.state !== 'dead') {
      const dx = p.cx - this.cx, dy = p.cy - 10 - this.cy, L = Math.max(1, Math.hypot(dx, dy));
      this.vx += dx / L * 520 * dt; this.vy += dy / L * 520 * dt;
      this.vy += Math.sin(this.t * 5) * 140 * dt;
      const sp = Math.hypot(this.vx, this.vy), M = 165;
      if (sp > M) { this.vx *= M / sp; this.vy *= M / sp; }
      this.facing = U.sign(dx) || this.facing;
    } else {
      this.vx = U.approach(this.vx, Math.cos(this.t * 0.7) * 30, 200 * dt);
      this.vy = U.approach(this.vy, (this.homeY - this.y) * 1.5 + Math.sin(this.t * 2) * 25, 300 * dt);
    }
    this.physics(dt, 0);
  }
  draw(ctx) {
    const x = this.cx, y = this.cy, f = this.facing;
    const flap = Math.sin(this.t * 28);
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
    ctx.fillStyle = this.col('rgba(170,230,255,0.55)');
    ctx.beginPath(); ctx.ellipse(-4, -6, 12, 6 + flap * 4, -0.6 + flap * 0.3, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3, -6, 10, 5 + flap * 3, 0.5 - flap * 0.3, 0, 6.28); ctx.fill();
    ctx.fillStyle = this.col('#2a3550');
    ctx.beginPath(); ctx.ellipse(0, 1, 6, 9, 0.2, 0, 6.28); ctx.fill();
    ctx.fillStyle = this.col('#9fe6ff');
    ctx.beginPath(); ctx.ellipse(-1, 7, 3.5, 4, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = this.aggro ? '#ff8f6b' : '#e6f8ff';
    ctx.beginPath(); ctx.arc(4, -3, 1.8, 0, 6.28); ctx.fill();
    ctx.strokeStyle = this.col('#2a3550'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(3, -7); ctx.quadraticCurveTo(8, -14, 11, -12); ctx.stroke();
    ctx.restore();
  }
  lights() { Light.add(this.cx, this.cy + 6, 70, '#8fdcff', 0.6, 0.25); }
}

// ---------------- 跳刺虫：蓄力跳扑 ----------------
class Hopper extends Enemy {
  constructor(x, y) { super(x, y, 26, 22); this.hp = this.maxHp = 6; this.waitT = U.rand(0.5, 1.5); this.amber = [3, 5]; this.crouch = 0; this.blood = ['#ffd1f0', '#d070b0', '#fff']; }
  update(dt) {
    this.baseUpdate(dt);
    const p = Game.player;
    if (this.onGround && this.stunT <= 0) {
      this.vx = U.approach(this.vx, 0, 1500 * dt);
      this.waitT -= dt;
      this.crouch = this.waitT < 0.3 ? 1 - this.waitT / 0.3 : 0;
      if (this.waitT <= 0) {
        const d = this.playerDist(), dir = U.sign(p.cx - this.cx) || 1;
        if (d < 420) { this.vx = dir * U.rand(170, 250); this.vy = -U.rand(560, 700); this.facing = dir; }
        else { this.facing = Math.random() < 0.5 ? -1 : 1; this.vx = this.facing * 80; this.vy = -380; }
        if (this.frontWall(U.sign(this.vx))) this.vx *= -1;
        this.waitT = U.rand(0.7, 1.4); this.crouch = 0;
        if (d < 600) Sfx.play('jump', 0.6);
      }
    }
    this.physics(dt, 1900);
  }
  draw(ctx) {
    const x = this.cx, y = this.y + this.h;
    ctx.save(); ctx.translate(x, y); ctx.scale(this.facing, 1 - this.crouch * 0.25);
    if (!this.onGround) ctx.rotate(U.clamp(this.vy / 1400, -0.5, 0.5) * this.facing);
    ctx.strokeStyle = this.col('#3a1d33'); ctx.lineWidth = 2.5;
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath(); ctx.moveTo(s * 6, -8); ctx.lineTo(s * 12, this.onGround ? -2 : 2); ctx.lineTo(s * 14, 0); ctx.stroke();
    }
    ctx.fillStyle = this.col('#5a2a52');
    ctx.beginPath(); ctx.arc(0, -12, 11, 0, 6.28); ctx.fill();
    ctx.fillStyle = this.col('#d070b0');
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI + i * Math.PI / 6;
      ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.2) * 10, -12 + Math.sin(a - 0.2) * 10); ctx.lineTo(Math.cos(a) * 17, -12 + Math.sin(a) * 17); ctx.lineTo(Math.cos(a + 0.2) * 10, -12 + Math.sin(a + 0.2) * 10); ctx.fill();
    }
    ctx.fillStyle = '#fff2b0'; ctx.beginPath(); ctx.arc(6, -12, 2.2, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(1, -13, 1.6, 0, 6.28); ctx.fill();
    ctx.restore();
  }
  lights() { Light.add(this.cx, this.cy, 50, '#ff9ee0', 0.4, 0.15); }
}

// ---------------- 孢囊：悬浮射击 ----------------
class Spitter extends Enemy {
  constructor(x, y) {
    super(x, y, 30, 30); this.y = y - 26; this.homeY = this.y; this.homeX = this.x;
    this.hp = this.maxHp = 5; this.fireT = U.rand(1, 2.5); this.swell = 0; this.flying = true; this.knock = 0.4; this.amber = [3, 5];
    this.blood = ['#d8ffb0', '#8fd060', '#fff'];
  }
  update(dt) {
    this.baseUpdate(dt);
    const p = Game.player, d = this.playerDist();
    this.vx = U.approach(this.vx, (this.homeX - this.x) * 2, 400 * dt);
    this.vy = U.approach(this.vy, (this.homeY - this.y) * 2 + Math.sin(this.t * 1.8) * 20, 400 * dt);
    this.physics(dt, 0);
    if (d < 480 && p.state !== 'dead' && Phys.lineOfSight(Game.room, this.cx, this.cy, p.cx, p.cy)) {
      this.fireT -= dt;
      if (this.fireT < 0.5) this.swell = 1 - this.fireT / 0.5;
      if (this.fireT <= 0) {
        const dx = p.cx - this.cx, dy = p.cy - this.cy, L = Math.max(1, Math.hypot(dx, dy));
        Game.projectiles.push(new Projectile(this.cx + dx / L * 16, this.cy + dy / L * 16, dx / L * 230, dy / L * 230, { r: 7, color: '#b8f080', slashable: true }));
        Sfx.play('spit'); this.fireT = U.rand(2.0, 2.8); this.swell = 0; this.vx -= dx / L * 80; this.vy -= dy / L * 80;
      }
    } else { this.swell = Math.max(0, this.swell - dt * 2); this.fireT = Math.max(this.fireT, 0.8); }
  }
  draw(ctx) {
    const x = this.cx, y = this.cy, s = 1 + this.swell * 0.25 + Math.sin(this.t * 3) * 0.04;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = this.col('#3d5a2a'); ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * 0.35 + i * 0.25, w = Math.sin(this.t * 2 + i) * 4;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.quadraticCurveTo(Math.cos(a) * 18 + w, Math.sin(a) * 20, Math.cos(a) * 14 - w, Math.sin(a) * 30); ctx.stroke();
    }
    ctx.scale(s, s);
    ctx.fillStyle = this.col('#2f4a24'); ctx.beginPath(); ctx.arc(0, 0, 14, 0, 6.28); ctx.fill();
    ctx.fillStyle = this.col('#5f8f3f');
    for (let i = 0; i < 6; i++) { const a = i * 1.047 + this.t * 0.3; ctx.beginPath(); ctx.arc(Math.cos(a) * 8, Math.sin(a) * 8, 3.5, 0, 6.28); ctx.fill(); }
    ctx.fillStyle = this.flash > 0 ? '#fff' : `rgb(${200 + this.swell * 55 | 0},255,${130 - this.swell * 60 | 0})`;
    ctx.beginPath(); ctx.arc(0, 0, 5 + this.swell * 3, 0, 6.28); ctx.fill();
    ctx.restore();
  }
  lights() { Light.add(this.cx, this.cy, 70 + this.swell * 40, '#b8f080', 0.6, 0.2 + this.swell * 0.3); }
}

// ---------------- 锈卫：蓄力突刺 ----------------
class Guard extends Enemy {
  constructor(x, y) {
    super(x, y, 30, 44); this.hp = this.maxHp = 10; this.knock = 0.35; this.amber = [5, 8];
    this.mode = 'idle'; this.modeT = 0; this.facing = -1; this.blood = ['#ffcf9a', '#b36a3a', '#fff'];
  }
  update(dt) {
    this.baseUpdate(dt);
    const p = Game.player, dx = p.cx - this.cx, ad = Math.abs(dx), sameLevel = Math.abs(p.cy - this.cy) < 70;
    this.modeT -= dt;
    switch (this.mode) {
      case 'idle':
        this.vx = U.approach(this.vx, 0, 1200 * dt);
        if (ad < 380 && sameLevel && p.state !== 'dead') { this.mode = 'walk'; }
        break;
      case 'walk':
        this.facing = U.sign(dx) || this.facing;
        if (this.stunT <= 0) this.vx = (this.frontGround(this.facing) && !this.frontWall(this.facing)) ? this.facing * 75 : 0;
        if (ad < 150 && sameLevel) { this.mode = 'wind'; this.modeT = 0.5; this.vx = 0; Sfx.play('charge'); }
        if (ad > 520 || !sameLevel) this.mode = 'idle';
        break;
      case 'wind':
        this.vx = U.approach(this.vx, -this.facing * 40, 600 * dt);
        if (this.modeT <= 0) { this.mode = 'lunge'; this.modeT = 0.28; Sfx.play('dash', 0.7); }
        break;
      case 'lunge':
        this.vx = (this.frontGround(this.facing) && !this.frontWall(this.facing)) ? this.facing * 560 : 0;
        if (Math.random() < 0.5) Game.particles.add({ x: this.cx - this.facing * 12, y: this.y + this.h - 2, vx: -this.facing * 80, vy: -30, life: 0.3, size: 3, color: '#776' });
        if (this.modeT <= 0) { this.mode = 'recover'; this.modeT = 0.7; }
        break;
      case 'recover':
        this.vx = U.approach(this.vx, 0, 1800 * dt);
        if (this.modeT <= 0) this.mode = 'walk';
        break;
    }
    this.physics(dt);
  }
  hurt(d, kx, ky) { super.hurt(d, kx, ky); if (this.mode === 'idle') this.mode = 'walk'; }
  touchBox() {
    if (this.mode === 'lunge') return { x: this.facing > 0 ? this.x : this.x - 34, y: this.y + 4, w: this.w + 34, h: this.h - 8 };
    return super.touchBox();
  }
  draw(ctx) {
    const x = this.cx, y = this.y + this.h, f = this.facing;
    const w = this.mode === 'wind' ? Math.min(1, (0.5 - this.modeT) / 0.5) : 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
    if (this.mode === 'lunge') ctx.rotate(0.15);
    if (this.mode === 'wind') ctx.rotate(-0.12 * w);
    const step = this.mode === 'walk' ? Math.sin(this.t * 9) * 3 : 0;
    ctx.fillStyle = this.col('#1b1620'); ctx.fillRect(-9 + step, -10, 6, 10); ctx.fillRect(3 - step, -10, 6, 10);
    // 身体与铠甲
    ctx.fillStyle = this.col('#3a2f2a');
    ctx.beginPath(); ctx.moveTo(-14, -10); ctx.lineTo(-12, -34); ctx.lineTo(10, -36); ctx.lineTo(14, -10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = this.col('#7a5238');
    ctx.beginPath(); ctx.moveTo(-12, -30); ctx.lineTo(12, -32); ctx.lineTo(13, -22); ctx.lineTo(-13, -20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = this.col('#a8733f'); ctx.fillRect(-12, -30, 24, 2);
    // 头盔
    ctx.fillStyle = this.col('#5c4a3e');
    ctx.beginPath(); ctx.arc(2, -40, 9, Math.PI, 0); ctx.lineTo(11, -34); ctx.lineTo(-7, -34); ctx.fill();
    ctx.fillStyle = this.col('#2a2220'); ctx.fillRect(-2, -42, 12, 3);
    ctx.fillStyle = this.mode === 'wind' || this.mode === 'lunge' ? '#ff6a3a' : '#f2c27b';
    ctx.fillRect(4, -41.5, 5, 2);
    // 长矛
    const sx = this.mode === 'lunge' ? 14 : this.mode === 'wind' ? -6 * w : 4;
    ctx.strokeStyle = this.col('#5a4636'); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-16 + sx, -22); ctx.lineTo(28 + sx, -24); ctx.stroke();
    ctx.fillStyle = this.col('#c9c2b0');
    ctx.beginPath(); ctx.moveTo(28 + sx, -28); ctx.lineTo(40 + sx, -24.5); ctx.lineTo(28 + sx, -21); ctx.fill();
    ctx.restore();
    if (this.mode === 'wind') {
      ctx.fillStyle = `rgba(255,120,60,${0.5 * w})`;
      ctx.beginPath(); ctx.arc(this.cx + f * 6, this.y - 6, 4 + w * 4, 0, 6.28); ctx.fill();
    }
  }
}

// ---------------- 投射物 ----------------
class Projectile {
  constructor(x, y, vx, vy, o = {}) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.r = o.r ?? 6; this.color = o.color ?? '#fff'; this.dmg = o.dmg ?? 1; this.grav = o.grav ?? 0;
    this.life = o.life ?? 6; this.slashable = o.slashable ?? false; this.tiles = o.tiles ?? true;
    this.kind = o.kind ?? 'orb'; this.dead = false; this.t = 0; this.accel = o.accel ?? 0; this.delay = o.delay ?? 0; this.delay0 = this.delay || 1;
  }
  box() { return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 }; }
  pop() {
    if (this.dead) return; this.dead = true;
    Game.particles.burst(this.x, this.y, 8, { color: [this.color, '#fff'], speed: 150, life: 0.3, size: 2.5, glow: true });
    if (this.kind === 'bomb' && !this.noBlast) {
      Game.projectiles.push(new Projectile(this.x, this.y - 6, 0, 0, { kind: 'blast', r: 30, life: 0.18, color: '#ff8a3a', tiles: false }));
      Game.particles.burst(this.x, this.y, 18, { color: ['#ffb040', '#ff6a2a', '#fff4c0'], speed: 260, life: 0.45, size: 4, glow: true });
      Sfx.play('rock'); Game.cam.shake(3, 0.1);
    }
  }
  update(dt) {
    this.t += dt;
    if (this.delay > 0) {
      this.delay -= dt;
      if (this.kind === 'pillar' && Math.random() < 0.5) Game.particles.add({ x: this.x + U.rand(-16, 16), y: this.y - 2, vx: 0, vy: U.rand(-80, -30), life: 0.3, size: 2, color: '#ffb040', glow: true });
      if (this.delay <= 0 && this.kind === 'pillar') { Sfx.play('dash', 0.5); Game.cam.shake(4, 0.15); }
      return;
    }
    this.life -= dt; if (this.life <= 0) { this.pop(); return; }
    if (this.kind === 'pillar') { if (Math.random() < 0.7) Game.particles.add({ x: this.x + U.rand(-18, 18), y: this.y - U.rand(0, 200), vx: U.rand(-20, 20), vy: U.rand(-300, -120), life: 0.4, size: U.rand(2, 5), color: U.pick(['#ffb040', '#ff6a2a', '#fff4c0']), glow: true }); if (this.life <= 0) this.dead = true; return; }
    if (this.kind === 'blast') return;
    this.vy += this.grav * dt;
    if (this.accel) { const s = Math.hypot(this.vx, this.vy) || 1, ns = s + this.accel * dt; this.vx *= ns / s; this.vy *= ns / s; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.kind === 'wave') {
      // 地面冲击波：沿地面前进，遇墙消失
      const room = Game.room;
      if (room.isSolid(Math.floor((this.x + U.sign(this.vx) * 12) / TILE), Math.floor((this.y - 8) / TILE))) this.pop();
      if (Math.random() < 0.6) Game.particles.add({ x: this.x + U.rand(-10, 10), y: this.y, vx: U.rand(-30, 30), vy: U.rand(-160, -60), life: 0.4, size: 3, color: U.pick(['#f2c27b', '#a87a4a', '#fff']), grav: 500 });
    } else if (this.tiles && Game.room.isSolid(Math.floor(this.x / TILE), Math.floor(this.y / TILE))) this.pop();
    if (this.x < -200 || this.y < -200 || this.x > Game.room.pw + 200 || this.y > Game.room.ph + 200) this.dead = true;
  }
  hitBox() {
    if (this.kind === 'pillar') return { x: this.x - 20, y: this.y - 230, w: 40, h: 230 };
    if (this.kind === 'blast') return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
    if (this.kind === 'wave') return { x: this.x - 14, y: this.y - 34, w: 28, h: 34 };
    const r = this.r * 0.75; return { x: this.x - r, y: this.y - r, w: r * 2, h: r * 2 };
  }
  draw(ctx) {
    if (this.kind === 'pillar') {
      if (this.delay > 0) {
        const k = 1 - this.delay / this.delay0;
        ctx.fillStyle = `rgba(255,140,60,${0.25 + k * 0.5})`; ctx.fillRect(this.x - 22, this.y - 4, 44, 4);
        glowDot(ctx, this.x, this.y, 30 + k * 20, '#ff8a3a', 0.4 * k);
      } else {
        const a = Math.min(1, this.life / 0.15);
        const g = ctx.createLinearGradient(0, this.y, 0, this.y - 240);
        g.addColorStop(0, `rgba(255,240,200,${a})`); g.addColorStop(0.3, `rgba(255,150,60,${a * 0.9})`); g.addColorStop(1, 'rgba(255,80,30,0)');
        ctx.fillStyle = g;
        const w = 20 + Math.sin(this.t * 40) * 3;
        ctx.beginPath(); ctx.moveTo(this.x - w, this.y); ctx.quadraticCurveTo(this.x - w * 0.6, this.y - 120, this.x, this.y - 240); ctx.quadraticCurveTo(this.x + w * 0.6, this.y - 120, this.x + w, this.y); ctx.fill();
      }
      return;
    }
    if (this.kind === 'blast') { glowDot(ctx, this.x, this.y, this.r * 1.6, '#ffb040', 0.8); return; }
    if (this.delay > 0) {
      ctx.strokeStyle = rgba(this.color, 0.5 * (1 - this.delay)); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r * (1 + this.delay * 2), 0, 6.28); ctx.stroke();
      return;
    }
    if (this.kind === 'wave') {
      const s = Math.sin(this.t * 30) * 3;
      ctx.fillStyle = rgba(this.color, 0.85);
      ctx.beginPath(); ctx.moveTo(this.x - 16, this.y); ctx.quadraticCurveTo(this.x - 4, this.y - 40 - s, this.x + U.sign(this.vx) * 14, this.y); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.moveTo(this.x - 6, this.y); ctx.quadraticCurveTo(this.x, this.y - 24 - s, this.x + U.sign(this.vx) * 8, this.y); ctx.fill();
      return;
    }
    if (this.kind === 'rock') {
      ctx.fillStyle = '#5a4a3e'; ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.t * 4);
      ctx.beginPath(); ctx.moveTo(-this.r, -this.r * 0.6); ctx.lineTo(this.r * 0.4, -this.r); ctx.lineTo(this.r, this.r * 0.3); ctx.lineTo(-this.r * 0.2, this.r); ctx.closePath(); ctx.fill();
      ctx.restore(); return;
    }
    glowDot(ctx, this.x, this.y, this.r * 2.4, this.color, 0.5);
    ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(this.x - this.r * 0.25, this.y - this.r * 0.25, this.r * 0.4, 0, 6.28); ctx.fill();
  }
  lights() {
    if (this.kind === 'pillar') { Light.add(this.x, this.y - (this.delay > 0 ? 0 : 100), this.delay > 0 ? 70 : 200, '#ff8a3a', 0.8, 0.3); return; }
    if (this.delay <= 0 && this.kind !== 'rock') Light.add(this.x, this.y, this.r * 7, this.color, 0.7, 0.3);
  }
}

// ---------------- 琥珀（货币） ----------------
class Amber {
  constructor(x, y, value) {
    this.w = value >= 5 ? 10 : 7; this.h = this.w; this.x = x - this.w / 2; this.y = y - this.h / 2;
    const a = U.rand(-Math.PI * 0.85, -Math.PI * 0.15), s = U.rand(150, 380);
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s; this.value = value; this.t = 0; this.dead = false;
    this.spikeSolid = true; this.rot = U.rand(0, 6);
  }
  update(dt) {
    this.t += dt;
    const p = Game.player, dx = p.cx - (this.x + this.w / 2), dy = p.cy - (this.y + this.h / 2), d = Math.hypot(dx, dy);
    const mag = Game.save.shop.charm ? 150 : 70;
    if (this.t > 0.35 && d < mag && p.state !== 'dead') {
      this.vx += dx / d * 2400 * dt; this.vy += dy / d * 2400 * dt;
      this.vx *= 0.9; this.vy *= 0.9;
      this.x += this.vx * dt; this.y += this.vy * dt;
    } else {
      const pvy = this.vy;
      this.vy = Math.min(700, this.vy + 1500 * dt);
      Phys.move(Game.room, this, dt);
      if (this.onGround) {
        if (pvy > 120) { this.vy = -pvy * 0.45; if (pvy > 250) Sfx.play('amber', 0.5); }
        this.vx *= Math.pow(0.02, dt);
      }
      if (this.hitL || this.hitR) this.vx = -this.vx * 0.5;
      this.rot += this.vx * dt * 0.05;
    }
    if (this.t > 0.2 && U.overlap(this, p) && p.state !== 'dead') {
      this.dead = true; Game.save.amber += this.value; Game.amberGain(this.value); Sfx.play('amber');
      Game.particles.burst(this.x + this.w / 2, this.y + this.h / 2, 4, { color: ['#ffd27a', '#fff'], speed: 90, life: 0.3, size: 2, glow: true });
    }
  }
  draw(ctx) {
    const x = this.x + this.w / 2, y = this.y + this.h / 2, s = this.w / 2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(this.rot);
    ctx.fillStyle = '#c47a1e'; ctx.beginPath(); ctx.moveTo(0, -s * 1.3); ctx.lineTo(s, 0); ctx.lineTo(0, s * 1.3); ctx.lineTo(-s, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.moveTo(0, -s * 1.3); ctx.lineTo(s * 0.4, -s * 0.1); ctx.lineTo(-s * 0.5, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
    const tw = (Math.sin(this.t * 6 + this.rot * 3) + 1) / 2;
    if (tw > 0.85) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 0.5, y - 4, 1, 8); ctx.fillRect(x - 4, y - 0.5, 8, 1); }
  }
  lights() { Light.add(this.x + this.w / 2, this.y + this.h / 2, 28, '#ffc060', 0.4, 0.2); }
}

const ENEMY_TYPES = { c: Crawler, f: Flyer, h: Hopper, s: Spitter, g: Guard };

// ---------------- 余烬虫：抛射火球 ----------------
class Emberling extends Enemy {
  constructor(x, y) {
    super(x, y, 30, 24); this.hp = this.maxHp = 6; this.speed = 38; this.facing = Math.random() < 0.5 ? -1 : 1;
    this.fireT = U.rand(1.2, 2.4); this.glow = 0; this.amber = [3, 5]; this.blood = ['#ffb070', '#ff6a2a', '#fff'];
  }
  update(dt) {
    this.baseUpdate(dt);
    const p = Game.player, d = this.playerDist();
    const see = d < 430 && p.state !== 'dead' && Phys.lineOfSight(Game.room, this.cx, this.cy - 6, p.cx, p.cy);
    if (see) {
      this.fireT -= dt; this.facing = U.sign(p.cx - this.cx) || this.facing;
      this.glow = this.fireT < 0.45 ? 1 - this.fireT / 0.45 : 0;
      this.vx = U.approach(this.vx, 0, 600 * dt);
      if (this.fireT <= 0) {
        const g = 900, dx = p.cx - this.cx, dy = p.cy - (this.y + 4);
        const t = U.clamp(Math.abs(dx) / 320, 0.55, 1.1);
        Game.projectiles.push(new Projectile(this.cx, this.y + 4, dx / t, (dy - 0.5 * g * t * t) / t, { r: 7, color: '#ff8a3a', grav: g, slashable: true }));
        Sfx.play('spit', 0.8); this.fireT = U.rand(2.2, 3.0); this.glow = 0;
      }
    } else {
      this.glow = Math.max(0, this.glow - dt * 3);
      if (this.stunT <= 0) {
        if (this.onGround && (this.frontWall(this.facing) || !this.frontGround(this.facing))) this.facing *= -1;
        this.vx = this.facing * this.speed;
      }
    }
    if (this.stunT > 0) this.vx *= 0.9;
    this.physics(dt);
  }
  draw(ctx) {
    const x = this.cx, y = this.y + this.h, f = this.facing;
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1 + this.glow * 0.1);
    ctx.strokeStyle = this.col('#2a140c'); ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const p = Math.sin(this.t * 8 + i * 2) * 2; ctx.beginPath(); ctx.moveTo(-8 + i * 8, -6); ctx.lineTo(-10 + i * 8 + p, 0); ctx.stroke(); }
    ctx.fillStyle = this.col('#2e1810');
    ctx.beginPath(); ctx.moveTo(-15, -5); ctx.quadraticCurveTo(-14, -24, 2, -24); ctx.quadraticCurveTo(16, -22, 15, -5); ctx.closePath(); ctx.fill();
    // 背上的炭块缝隙
    ctx.strokeStyle = this.flash > 0 ? '#fff' : `rgb(255,${120 + this.glow * 100 | 0},${40 + this.glow * 60 | 0})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(-4, -20); ctx.lineTo(2, -14); ctx.lineTo(8, -21); ctx.stroke();
    ctx.fillStyle = this.col('#1a0c08'); ctx.beginPath(); ctx.ellipse(14, -9, 6, 5, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = this.glow > 0.3 ? '#fff4c0' : '#ff8a3a'; ctx.beginPath(); ctx.arc(17, -9, 2 + this.glow * 2, 0, 6.28); ctx.fill();
    ctx.restore();
  }
  lights() { Light.add(this.cx, this.cy, 60 + this.glow * 50, '#ff8a3a', 0.6, 0.2 + this.glow * 0.3); }
}

// ---------------- 炉蛾：空投火弹 ----------------
class Bomber extends Enemy {
  constructor(x, y) {
    super(x, y, 30, 24); this.y = y - 20; this.homeY = this.y;
    this.hp = this.maxHp = 5; this.flying = true; this.noOneway = true; this.knock = 1.1; this.amber = [3, 5];
    this.dropT = 1.5; this.aggro = false; this.blood = ['#ffd0a0', '#ff7a3a', '#fff'];
  }
  update(dt) {
    this.baseUpdate(dt);
    const p = Game.player, d = this.playerDist();
    if (!this.aggro && d < 380) this.aggro = true;
    if (this.aggro && d > 700) this.aggro = false;
    if (this.stunT > 0) { this.vx *= 0.9; this.vy *= 0.9; }
    else if (this.aggro && p.state !== 'dead') {
      const tx = p.cx + Math.sin(this.t * 0.9) * 60, ty = p.cy - 170;
      this.vx = U.approach(this.vx, U.clamp((tx - this.cx) * 2, -150, 150), 400 * dt);
      this.vy = U.approach(this.vy, U.clamp((ty - this.cy) * 2, -120, 120), 400 * dt);
      this.facing = U.sign(p.cx - this.cx) || this.facing;
      this.dropT -= dt;
      if (this.dropT <= 0 && Math.abs(p.cx - this.cx) < 80 && p.cy > this.cy) {
        Game.projectiles.push(new Projectile(this.cx, this.y + this.h, this.vx * 0.3, 60, { r: 8, color: '#ff7a3a', grav: 800, kind: 'bomb', slashable: true }));
        Sfx.play('spit', 0.6); this.dropT = U.rand(1.8, 2.5);
      }
    } else {
      this.vx = U.approach(this.vx, Math.cos(this.t * 0.6) * 35, 200 * dt);
      this.vy = U.approach(this.vy, (this.homeY - this.y) * 1.5 + Math.sin(this.t * 2) * 20, 300 * dt);
    }
    this.physics(dt, 0);
  }
  draw(ctx) {
    const x = this.cx, y = this.cy, flap = Math.sin(this.t * 22);
    ctx.save(); ctx.translate(x, y); ctx.scale(this.facing, 1);
    ctx.fillStyle = this.col('rgba(120,50,30,0.85)');
    ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(-22, -12 + flap * 8); ctx.lineTo(-16, 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(22, -12 + flap * 8); ctx.lineTo(16, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = this.col('#2a140c'); ctx.beginPath(); ctx.ellipse(0, 0, 8, 11, 0, 0, 6.28); ctx.fill();
    // 腹中火囊
    const r = 5 + Math.max(0, 1 - this.dropT) * 3;
    ctx.fillStyle = this.flash > 0 ? '#fff' : '#ff9a3a'; ctx.beginPath(); ctx.arc(0, 6, r, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#ffe0a0'; ctx.beginPath(); ctx.arc(3, -5, 1.6, 0, 6.28); ctx.fill();
    ctx.restore();
  }
  lights() { Light.add(this.cx, this.cy + 6, 80, '#ff8a3a', 0.6, 0.25); }
}
ENEMY_TYPES.e = Emberling;
ENEMY_TYPES.b = Bomber;

// ---------------- 烬火弹（玩家法术） ----------------
class PlayerSpell {
  constructor(x, y, dir) {
    this.x = x; this.y = y; this.vx = dir * 780; this.dir = dir; this.life = 1.1; this.dead = false; this.hit = new Set(); this.t = 0;
    this.big = Game.hasCharm('blaze'); this.dmg = this.big ? 8 : 5; this.sc = this.big ? 1.4 : 1;
  }
  box() { return { x: this.x - 18 * this.sc, y: this.y - 12 * this.sc, w: 36 * this.sc, h: 24 * this.sc }; }
  explode() {
    if (this.dead) return; this.dead = true;
    Game.particles.burst(this.x, this.y, 24, { color: ['#fff4c0', '#ffb040', '#ff6a2a'], speed: 300, life: 0.5, size: 4, glow: true });
    Game.particles.add({ x: this.x, y: this.y, size: 30, life: 0.25, color: '#ffb040', shape: 'ring', glow: true });
    Sfx.play('rock'); Game.cam.shake(3, 0.12);
  }
  update(dt) {
    this.t += dt; this.life -= dt;
    if (this.life <= 0) { this.explode(); return; }
    this.x += this.vx * dt;
    Game.particles.add({ x: this.x - this.dir * 10 + U.rand(-4, 4), y: this.y + U.rand(-6, 6), vx: -this.dir * U.rand(40, 120), vy: U.rand(-40, 20), life: 0.35, size: U.rand(2, 5), color: U.pick(['#ffb040', '#ff6a2a', '#fff4c0']), glow: true, drag: 0.93 });
    const b = this.box();
    for (const e of Game.enemies) {
      if (e.dead || !e.hittable || this.hit.has(e)) continue;
      if (U.overlap(b, e.box())) { this.hit.add(e); e.hurt(this.dmg, this.dir, 0); Game.hitSpark(this.x + this.dir * 14, this.y, this.dir > 0 ? 0 : Math.PI); }
    }
    for (const o of Game.objects) if (o.hittable && !o.dead && !this.hit.has(o) && U.overlap(b, o.box())) { this.hit.add(o); o.hit('side'); }
    const room = Game.room, tx = Math.floor((this.x + this.dir * 16) / TILE), ty = Math.floor(this.y / TILE);
    const t = room.tile(tx, ty);
    if (t === T_SEAL) { if (!(Game.boss && !Game.boss.dead && Game.boss.mode === 'dying')) Game.breakSeal(tx, ty); this.explode(); return; }
    if (room.isSolid(tx, ty)) { this.explode(); return; }
    if (this.x < -50 || this.x > room.pw + 50) this.dead = true;
  }
  draw(ctx) {
    const x = this.x, y = this.y, d = this.dir;
    ctx.save(); ctx.translate(x, y); ctx.scale(this.sc, this.sc); ctx.translate(-x, -y);
    glowDot(ctx, x, y, 34, '#ff8a3a', 0.45);
    ctx.fillStyle = '#ff6a2a';
    ctx.beginPath(); ctx.moveTo(x + d * 16, y); ctx.quadraticCurveTo(x, y - 12, x - d * 26, y - 3 + Math.sin(this.t * 40) * 3); ctx.quadraticCurveTo(x, y + 12, x + d * 16, y); ctx.fill();
    ctx.fillStyle = '#ffd070';
    ctx.beginPath(); ctx.moveTo(x + d * 13, y); ctx.quadraticCurveTo(x + d * 2, y - 6, x - d * 12, y); ctx.quadraticCurveTo(x + d * 2, y + 6, x + d * 13, y); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + d * 8, y, 3.5, 0, 6.28); ctx.fill();
    ctx.restore();
  }
  lights() { Light.add(this.x, this.y, 150 * this.sc, '#ff9a40', 1, 0.35); }
}

// ---------------- 霜晶炮台：三向冰棱 ----------------
class Turret extends Enemy {
  constructor(x, y) {
    super(x, y, 28, 30); this.hp = this.maxHp = 6; this.knock = 0; this.amber = [3, 6];
    this.fireT = U.rand(1, 2); this.glow = 0; this.blood = ['#eaf8ff', '#7ab0d0', '#fff'];
  }
  update(dt) {
    this.baseUpdate(dt);
    const p = Game.player, d = this.playerDist();
    if (d < 540 && p.state !== 'dead' && Phys.lineOfSight(Game.room, this.cx, this.y + 6, p.cx, p.cy)) {
      this.fireT -= dt; this.glow = this.fireT < 0.5 ? 1 - this.fireT / 0.5 : 0;
      if (this.fireT <= 0) {
        const a0 = Math.atan2(p.cy - (this.y + 6), p.cx - this.cx);
        for (const da of [-0.22, 0, 0.22]) Game.projectiles.push(new Projectile(this.cx + Math.cos(a0) * 14, this.y + 6 + Math.sin(a0) * 14, Math.cos(a0 + da) * 250, Math.sin(a0 + da) * 250, { r: 6, color: '#bfe8ff', slashable: true }));
        Sfx.play('orb'); this.fireT = U.rand(2.4, 3); this.glow = 0;
      }
    } else this.glow = Math.max(0, this.glow - dt * 2);
    this.physics(dt);
  }
  draw(ctx) {
    const x = this.cx, by = this.y + this.h;
    ctx.fillStyle = this.col('#2a4a66'); ctx.fillRect(x - 13, by - 8, 26, 8);
    const c = this.flash > 0 ? '#fff' : `rgb(${120 + this.glow * 120 | 0},${190 + this.glow * 60 | 0},255)`;
    ctx.fillStyle = c;
    for (const [ox, h, wd] of [[-8, 18, 6], [0, 28, 8], [8, 20, 6]]) {
      ctx.beginPath(); ctx.moveTo(x + ox - wd, by - 7); ctx.lineTo(x + ox, by - 7 - h); ctx.lineTo(x + ox + wd, by - 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(x - 2, by - 12); ctx.lineTo(x, by - 30); ctx.lineTo(x + 1, by - 12); ctx.fill();
  }
  lights() { Light.add(this.cx, this.y + 8, 80 + this.glow * 60, '#bfe8ff', 0.6, 0.2 + this.glow * 0.3); }
}
ENEMY_TYPES.k = Turret;
