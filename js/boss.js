'use strict';
// ============================================================
//  Boss：锈钟守卫 · 卡隆 / 噬光之母 · 维萨
// ============================================================
const BOSS_INFO = {
  rust: { name: '锈钟守卫', title: '卡 隆', reward: 'dash' },
  mother: { name: '噬光之母', title: '维 萨', reward: null },
};

class Rustwarden extends Enemy {
  constructor(x, y) {
    super(x, y, 64, 84);
    this.hp = this.maxHp = 70; this.knock = 0; this.touch = 1; this.amber = [0, 0];
    this.mode = 'sleep'; this.modeT = 0; this.facing = 1; this.last = []; this.isBoss = true; this.bossId = 'rust';
    this.blood = ['#f2c27b', '#a8733f', '#fff', '#5a4636'];
    this.swingA = 0; this.eye = 0;
  }
  get phase2() { return this.hp <= this.maxHp * 0.5; }
  wake() { this.mode = 'intro'; this.modeT = 1.6; Sfx.play('roar'); Game.cam.shake(10, 1.2); }
  setMode(m, t) { this.mode = m; this.modeT = t; }
  choose() {
    const p = Game.player, d = Math.abs(p.cx - this.cx);
    let opts = d < 160 ? ['swing', 'swing', 'leap', 'charge'] : ['charge', 'leap', 'leap', 'swing'];
    if (this.last.length >= 2 && this.last[0] === this.last[1]) opts = opts.filter(o => o !== this.last[0]);
    const m = U.pick(opts);
    this.last.unshift(m); this.last.length = Math.min(this.last.length, 3);
    this.facing = U.sign(p.cx - this.cx) || this.facing;
    if (m === 'charge') { this.setMode('charge_wind', this.phase2 ? 0.45 : 0.6); Sfx.play('charge'); }
    else if (m === 'leap') this.setMode('leap_wind', this.phase2 ? 0.3 : 0.42);
    else { this.setMode('swing_wind', this.phase2 ? 0.38 : 0.5); Sfx.play('charge'); }
  }
  dropRocks(n) {
    const p = Game.player;
    for (let i = 0; i < n; i++) {
      const x = U.clamp(p.cx + U.rand(-260, 260), 200, Game.room.pw - 200);
      Game.projectiles.push(new Projectile(x, 110, 0, 0, { r: 11, kind: 'rock', grav: 900, delay: 0.4 + i * 0.25, color: '#a87a4a' }));
    }
  }
  hurt(d, kx, ky) {
    if (this.mode === 'sleep' || this.mode === 'intro' || this.mode === 'dying') return false;
    const wasP2 = this.phase2;
    this.hp -= d; this.flash = 0.1;
    Sfx.play('hit'); Game.hitstop(0.04);
    Game.particles.burst(this.cx - kx * 10, this.cy, 6, { color: this.blood, speed: 220, life: 0.4, size: 3, grav: 500 });
    if (!wasP2 && this.phase2) { Sfx.play('roar'); Game.cam.shake(8, 0.8); this.setMode('stagger', 0.9); }
    if (this.hp <= 0) { this.hp = 0; this.setMode('dying', 2.2); this.hittable = false; Sfx.play('roar'); Game.slowmo(1.2); }
  }
  update(dt) {
    this.baseUpdate(dt);
    const p = Game.player, room = Game.room;
    this.modeT -= dt;
    this.eye = U.lerp(this.eye, /wind/.test(this.mode) ? 1 : 0.3, dt * 8);
    const sp = this.phase2 ? 1.2 : 1;
    switch (this.mode) {
      case 'sleep': this.vx = 0; break;
      case 'intro': if (this.modeT <= 0) this.setMode('idle', 0.6); break;
      case 'idle':
        this.facing = U.sign(p.cx - this.cx) || this.facing;
        this.vx = U.approach(this.vx, this.facing * 50, 400 * dt);
        if (this.modeT <= 0) this.choose();
        break;
      case 'charge_wind':
        this.vx = U.approach(this.vx, -this.facing * 30, 600 * dt);
        if (this.modeT <= 0) { this.setMode('charge', 3); Sfx.play('dash', 0.5); }
        break;
      case 'charge':
        this.vx = this.facing * 520 * sp;
        if (Math.random() < 0.6) Game.particles.add({ x: this.cx - this.facing * 30, y: this.y + this.h, vx: -this.facing * 100, vy: -U.rand(40, 120), life: 0.4, size: 4, color: '#776655', grav: 400 });
        if (this.hitL || this.hitR || this.modeT <= 0) {
          Sfx.play('slam'); Game.cam.shake(12, 0.4);
          Game.particles.burst(this.facing > 0 ? this.x + this.w : this.x, this.cy, 20, { color: ['#a87a4a', '#fff', '#665'], speed: 300, life: 0.6, size: 4, grav: 600 });
          if (this.phase2) this.dropRocks(4); else this.dropRocks(2);
          this.vx = -this.facing * 150; this.vy = -300;
          this.setMode('recover', this.phase2 ? 0.8 : 1.1);
        }
        break;
      case 'leap_wind':
        this.vx = 0;
        if (this.modeT <= 0) {
          const tx = U.clamp(p.cx, 100, room.pw - 100);
          this.vy = -950; this.vx = U.clamp((tx - this.cx) / 0.95, -560, 560);
          this.facing = U.sign(this.vx) || this.facing;
          this.setMode('leap', 3); Sfx.play('jump', 0.4);
        }
        break;
      case 'leap':
        if (this.onGround && this.vy >= 0 && this.modeT < 2.9) {
          Sfx.play('slam'); Game.cam.shake(14, 0.45);
          const gy = this.y + this.h;
          for (const d of [-1, 1]) Game.projectiles.push(new Projectile(this.cx + d * 30, gy, d * 380 * sp, 0, { kind: 'wave', color: '#f2c27b', life: 3, tiles: false }));
          Game.particles.burst(this.cx, gy, 30, { angle: -Math.PI / 2, spread: 1.3, speed: 320, color: ['#a87a4a', '#fff', '#665'], life: 0.6, size: 4, grav: 700 });
          if (this.phase2) this.dropRocks(3);
          this.vx = 0; this.setMode('recover', this.phase2 ? 0.5 : 0.7);
        }
        break;
      case 'swing_wind':
        this.facing = U.sign(p.cx - this.cx) || this.facing;
        this.vx = U.approach(this.vx, 0, 800 * dt);
        this.swingA = U.lerp(this.swingA, -1.6, dt * 10);
        if (this.modeT <= 0) { this.setMode('swing', 0.22); Sfx.play('slash', 0.5); this.vx = this.facing * 260; }
        break;
      case 'swing':
        this.swingA = U.lerp(this.swingA, 1.4, dt * 25);
        this.vx = U.approach(this.vx, 0, 1200 * dt);
        if (this.modeT <= 0) {
          Game.cam.shake(6, 0.2);
          Game.particles.burst(this.cx + this.facing * 90, this.y + this.h - 4, 14, { angle: -Math.PI / 2, spread: 1.2, speed: 220, color: ['#a87a4a', '#fff'], life: 0.5, size: 3, grav: 600 });
          this.setMode('recover', this.phase2 ? 0.45 : 0.65);
        }
        break;
      case 'stagger':
        this.vx = U.approach(this.vx, 0, 900 * dt);
        if (this.modeT <= 0) this.setMode('idle', 0.2);
        break;
      case 'recover':
        this.vx = U.approach(this.vx, 0, 900 * dt);
        this.swingA = U.lerp(this.swingA, 0, dt * 5);
        if (this.modeT <= 0) this.setMode('idle', (this.phase2 ? U.rand(0.25, 0.5) : U.rand(0.45, 0.8)));
        break;
      case 'dying':
        this.vx = 0;
        if (Math.random() < dt * 20) Game.particles.burst(this.cx + U.rand(-30, 30), this.cy + U.rand(-40, 30), 6, { color: this.blood, speed: 200, life: 0.5, size: 4, grav: 400 });
        if (Math.random() < dt * 6) Sfx.play('hit');
        if (this.modeT <= 0) {
          this.dead = true;
          Game.particles.burst(this.cx, this.cy, 80, { color: [...this.blood, '#ffe2a8'], speed: 500, life: 1.2, size: 5, grav: 500 });
          Game.cam.shake(16, 0.8); Sfx.play('break'); Sfx.play('kill');
          Game.spawnAmber(this.cx, this.cy, 60);
          Game.onBossDefeated('rust');
        }
        break;
    }
    if (this.mode !== 'sleep') this.physics(dt, 2000);
  }
  extraHits() {
    if (this.mode === 'swing' && this.modeT < 0.16) {
      return [{ x: this.facing > 0 ? this.cx : this.cx - 130, y: this.y - 10, w: 130, h: this.h + 10 }];
    }
    return null;
  }
  touchBox() {
    if (this.mode === 'sleep' || this.mode === 'dying') return { x: 0, y: -999, w: 0, h: 0 };
    return { x: this.x + 6, y: this.y + 10, w: this.w - 12, h: this.h - 10 };
  }
  draw(ctx) {
    const x = this.cx, by = this.y + this.h, f = this.facing;
    ctx.save(); ctx.translate(x + (this.mode === 'dying' ? U.rand(-3, 3) : 0), by); ctx.scale(f, 1);
    let crouch = 0;
    if (this.mode === 'charge_wind' || this.mode === 'leap_wind') crouch = 0.12;
    if (this.mode === 'sleep') crouch = 0.18;
    ctx.scale(1 + crouch * 0.5, 1 - crouch);
    if (this.mode === 'charge') ctx.rotate(0.12);
    const step = (this.mode === 'idle' || this.mode === 'charge') ? Math.sin(this.t * (this.mode === 'charge' ? 22 : 8)) * 4 : 0;
    // 腿
    ctx.fillStyle = this.col('#1f1a1c');
    ctx.fillRect(-22 + step, -22, 14, 22); ctx.fillRect(8 - step, -22, 14, 22);
    // 身躯
    ctx.fillStyle = this.col('#3b2b24');
    ctx.beginPath(); ctx.moveTo(-32, -20); ctx.quadraticCurveTo(-36, -60, -10, -66); ctx.lineTo(18, -66); ctx.quadraticCurveTo(36, -56, 32, -20); ctx.closePath(); ctx.fill();
    // 胸甲（锈铜）
    ctx.fillStyle = this.col('#8a5a34');
    ctx.beginPath(); ctx.moveTo(-26, -26); ctx.quadraticCurveTo(-28, -56, -6, -60); ctx.lineTo(16, -60); ctx.quadraticCurveTo(30, -52, 27, -26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = this.col('#b37a44'); ctx.fillRect(-24, -44, 50, 4);
    ctx.fillStyle = this.col('#5f7a6a'); // 铜锈斑
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-18 + i * 10, -34 + (i % 2) * 8, 3 + (i % 3), 0, 6.28); ctx.fill(); }
    // 钟形头盔
    ctx.fillStyle = this.col('#9a6a3a');
    ctx.beginPath(); ctx.moveTo(-18, -62); ctx.quadraticCurveTo(-20, -92, 4, -96); ctx.quadraticCurveTo(26, -92, 24, -62); ctx.quadraticCurveTo(28, -58, 30, -56); ctx.lineTo(-24, -56); ctx.quadraticCurveTo(-22, -58, -18, -62); ctx.fill();
    ctx.fillStyle = this.col('#c99358'); ctx.fillRect(-22, -60, 50, 4);
    ctx.fillStyle = this.col('#6a4628'); ctx.beginPath(); ctx.arc(4, -98, 4, 0, 6.28); ctx.fill();
    // 眼缝
    ctx.fillStyle = '#120c0a'; ctx.fillRect(2, -78, 22, 7);
    const e = this.eye;
    ctx.fillStyle = `rgb(255,${150 + (1 - e) * 80 | 0},${60 + (1 - e) * 60 | 0})`;
    ctx.fillRect(10, -77, 10, 4 + e * 1.5);
    // 武器：钟锤
    ctx.save(); ctx.translate(22, -44);
    const sa = this.swingA;
    ctx.rotate(sa);
    ctx.strokeStyle = this.col('#3a2f28'); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(56, 0); ctx.stroke();
    ctx.fillStyle = this.col('#6a5040'); ctx.beginPath(); ctx.arc(64, 0, 13, 0, 6.28); ctx.fill();
    ctx.fillStyle = this.col('#9a7a5a'); ctx.beginPath(); ctx.arc(61, -4, 5, 0, 6.28); ctx.fill();
    ctx.restore();
    ctx.restore();
    if (this.mode === 'swing' && this.modeT > 0.06) {
      ctx.strokeStyle = 'rgba(255,220,160,0.6)'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(this.cx + f * 22, this.y + 40, 86, f > 0 ? -1.4 : Math.PI - 1.4 + 2.8 - 2.8, f > 0 ? 1.3 : Math.PI + 1.4); ctx.stroke();
    }
  }
  lights() { Light.add(this.cx + this.facing * 14, this.y + 10, 120 + this.eye * 60, '#ff9a50', 0.7, 0.2 + this.eye * 0.2); }
}

// ------------------------------------------------------------
class Matriarch extends Enemy {
  constructor(x, y) {
    super(x, y, 84, 70);
    this.hp = this.maxHp = 96; this.knock = 0; this.touch = 1; this.amber = [0, 0];
    this.flying = true; this.isBoss = true; this.bossId = 'mother';
    this.mode = 'sleep'; this.modeT = 0; this.tx = this.x; this.ty = this.y; this.last = [];
    this.y = -160; this.blood = ['#e09cff', '#7a3aa0', '#fff', '#1a0d26'];
    this.diveVX = 0; this.diveVY = 0; this.glow = 0; this.wing = 0; this.summonCD = 6;
  }
  get phase2() { return this.hp <= this.maxHp * 0.5; }
  wake() { this.mode = 'intro'; this.modeT = 2.2; Sfx.play('roar'); Game.cam.shake(8, 1.5); }
  setMode(m, t) { this.mode = m; this.modeT = t; }
  choose() {
    const opts = ['orbs', 'dive', 'rain', 'dive', 'orbs'];
    if (this.phase2 && this.summonCD <= 0 && Game.enemies.filter(e => !e.dead && !e.isBoss).length < 3) { this.summonCD = 12; this.setMode('summon', 1.0); Sfx.play('roar'); return; }
    let m = U.pick(opts);
    if (this.last[0] === m && this.last[1] === m) m = m === 'dive' ? 'orbs' : 'dive';
    this.last.unshift(m); this.last.length = Math.min(3, this.last.length);
    if (m === 'orbs') { this.setMode('orbs_wind', this.phase2 ? 0.5 : 0.7); Sfx.play('charge'); }
    else if (m === 'dive') { this.setMode('dive_wind', this.phase2 ? 0.55 : 0.75); this.lockX = Game.player.cx; this.lockY = Game.player.cy; Sfx.play('charge'); }
    else { this.setMode('rain_move', 0.8); }
  }
  hurt(d, kx, ky) {
    if (this.mode === 'sleep' || this.mode === 'intro' || this.mode === 'dying') return false;
    const wasP2 = this.phase2;
    this.hp -= d; this.flash = 0.1;
    Sfx.play('hit'); Game.hitstop(0.04);
    Game.particles.burst(this.cx, this.cy, 6, { color: this.blood, speed: 220, life: 0.4, size: 3, glow: true });
    if (ky > 0) this.vy -= 0; // 免疫击退
    if (!wasP2 && this.phase2) { Sfx.play('roar'); Game.cam.shake(10, 1); this.setMode('rage', 1.4); Game.flash('#e09cff', 0.3); }
    if (this.hp <= 0) { this.hp = 0; this.setMode('dying', 3.0); this.hittable = false; Sfx.play('roar'); Game.slowmo(1.6); }
  }
  moveTo(tx, ty, dt, k = 2.2) {
    const room = Game.room;
    tx = U.clamp(tx, 70, room.pw - 70 - this.w); ty = U.clamp(ty, 80, room.ph - 120 - this.h);
    this.vx = U.lerp(this.vx, (tx - this.x) * k, Math.min(1, dt * 4));
    this.vy = U.lerp(this.vy, (ty - this.y) * k, Math.min(1, dt * 4));
  }
  update(dt) {
    this.baseUpdate(dt);
    const p = Game.player, room = Game.room, sp = this.phase2 ? 1.25 : 1;
    this.modeT -= dt; this.summonCD -= dt;
    this.wing += dt * (this.mode === 'dive' ? 20 : 7);
    this.glow = U.lerp(this.glow, /wind|rage|summon/.test(this.mode) ? 1 : 0.25, dt * 6);
    switch (this.mode) {
      case 'sleep': this.vx = this.vy = 0; break;
      case 'intro':
        this.moveTo(room.pw * 0.62, 150, dt, 1.5);
        if (this.modeT <= 0) this.setMode('drift', 1.0);
        break;
      case 'drift': {
        const side = this.cx < p.cx ? -1 : 1;
        this.moveTo(p.cx + side * 170 - this.w / 2, 185 + Math.sin(this.t * 1.7) * 45, dt);
        if (this.modeT <= 0) this.choose();
        break;
      }
      case 'orbs_wind':
        this.vx *= 0.9; this.vy *= 0.9;
        if (this.modeT <= 0) {
          const n = this.phase2 ? 12 : 9, off = Math.random() * 6.28;
          for (let w = 0; w < (this.phase2 ? 2 : 1); w++) {
            for (let i = 0; i < n; i++) {
              const a = off + i * 6.28 / n + w * Math.PI / n;
              Game.projectiles.push(new Projectile(this.cx + Math.cos(a) * 30, this.cy + Math.sin(a) * 30, Math.cos(a) * 130 * sp, Math.sin(a) * 130 * sp, { r: 8, color: '#e09cff', accel: 70, life: 5, delay: w * 0.45, tiles: true }));
            }
          }
          Sfx.play('orb'); this.setMode('recover', 0.9);
        }
        break;
      case 'dive_wind':
        this.vx *= 0.85; this.vy *= 0.85;
        this.x += U.rand(-2, 2);
        if (this.modeT <= 0) {
          const dx = this.lockX - this.cx, dy = this.lockY - this.cy, L = Math.max(1, Math.hypot(dx, dy));
          this.diveVX = dx / L * 720 * sp; this.diveVY = dy / L * 720 * sp;
          this.setMode('dive', 1.2); Sfx.play('dash', 0.4);
        }
        break;
      case 'dive':
        this.vx = this.diveVX; this.vy = this.diveVY;
        if (Math.random() < 0.8) Game.particles.add({ x: this.cx + U.rand(-20, 20), y: this.cy + U.rand(-20, 20), vx: -this.vx * 0.2, vy: -this.vy * 0.2, life: 0.4, size: 5, color: U.pick(['#2a1438', '#7a3aa0']), drag: 0.9 });
        if (this.y + this.h > room.ph - 3 * TILE - 4 || this.x < 66 || this.x + this.w > room.pw - 66 || this.modeT <= 0) {
          if (this.y + this.h > room.ph - 3 * TILE - 4) { Game.cam.shake(10, 0.35); Sfx.play('slam'); Game.particles.burst(this.cx, this.y + this.h, 20, { angle: -Math.PI / 2, spread: 1.4, speed: 260, color: this.blood, life: 0.6, size: 3, grav: 500 }); }
          this.vx = this.vy = 0;
          if (this.y + this.h > room.ph - 3 * TILE - 4) this.setMode('grounded', this.phase2 ? 0.9 : 1.3);
          else this.setMode('recover', this.phase2 ? 0.6 : 0.9);
        }
        break;
      case 'rain_move':
        this.moveTo(room.pw / 2 - this.w / 2, 90, dt, 3);
        if (this.modeT <= 0) {
          const n = this.phase2 ? 14 : 10;
          for (let i = 0; i < n; i++) {
            const x = 110 + (room.pw - 220) * (i + Math.random() * 0.8) / n;
            Game.projectiles.push(new Projectile(x, 3 * TILE + 10, 0, 40, { r: 7, color: '#f5c8ff', grav: 520, delay: 0.3 + Math.random() * 1.2, slashable: true, life: 4 }));
          }
          Sfx.play('spit'); this.setMode('recover', 1.6);
        }
        break;
      case 'summon':
        this.vx *= 0.9; this.vy *= 0.9;
        if (this.modeT <= 0) {
          for (let i = 0; i < 2; i++) {
            const e = new Flyer(this.cx + (i ? 60 : -60), this.cy + 20); e.aggro = true; e.amber = [1, 2];
            Game.enemies.push(e);
            Game.particles.burst(e.cx, e.cy, 20, { color: ['#8fdcff', '#fff'], speed: 200, life: 0.5, glow: true });
          }
          this.setMode('recover', 0.6);
        }
        break;
      case 'grounded':
        // 俯冲落地后短暂失衡：反击窗口
        this.vx *= 0.8; this.vy = 0;
        if (Math.random() < 0.2) Game.particles.add({ x: this.cx + U.rand(-30, 30), y: this.y + this.h, vx: U.rand(-40, 40), vy: U.rand(-80, -20), life: 0.5, size: 2, color: '#e09cff', glow: true });
        if (this.modeT <= 0) this.setMode('recover', 0.5);
        break;
      case 'rage':
        this.vx *= 0.9; this.vy *= 0.9;
        if (Math.random() < 0.5) Game.particles.add({ x: this.cx, y: this.cy, vx: U.rand(-300, 300), vy: U.rand(-300, 300), life: 0.6, size: 3, color: '#e09cff', glow: true });
        if (this.modeT <= 0) this.setMode('drift', 0.6);
        break;
      case 'recover':
        this.moveTo(this.x, Math.min(this.y, 200), dt, 1.2);
        if (this.modeT <= 0) this.setMode('drift', this.phase2 ? U.rand(0.5, 0.9) : U.rand(0.8, 1.3));
        break;
      case 'dying':
        this.vx *= 0.95; this.vy = 20;
        if (Math.random() < dt * 25) Game.particles.burst(this.cx + U.rand(-40, 40), this.cy + U.rand(-30, 30), 6, { color: this.blood, speed: 220, life: 0.6, size: 4, glow: true });
        if (Math.random() < dt * 5) Sfx.play('hit');
        if (this.modeT <= 0) {
          this.dead = true;
          Game.particles.burst(this.cx, this.cy, 120, { color: ['#fff', '#ffe2a8', '#e09cff', '#ffcf80'], speed: 600, life: 1.6, size: 5, glow: true });
          Game.cam.shake(18, 1); Sfx.play('break'); Sfx.play('item');
          Game.flash('#fff', 1.0);
          Game.onBossDefeated('mother');
        }
        break;
    }
    if (this.mode !== 'sleep') { this.x += this.vx * dt; this.y += this.vy * dt; }
  }
  touchBox() {
    if (this.mode === 'sleep' || this.mode === 'dying' || this.mode === 'intro') return { x: 0, y: -999, w: 0, h: 0 };
    return { x: this.x + 14, y: this.y + 10, w: this.w - 28, h: this.h - 16 };
  }
  draw(ctx) {
    const x = this.cx, y = this.cy, g = this.glow, fl = Math.sin(this.wing);
    if (this.mode === 'dive_wind') {
      ctx.strokeStyle = `rgba(224,156,255,${0.3 + 0.3 * Math.sin(this.t * 30)})`; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(this.lockX, this.lockY); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.save(); ctx.translate(x + (this.mode === 'dying' ? U.rand(-4, 4) : 0), y);
    if (this.mode === 'dive') ctx.rotate(Math.atan2(this.diveVY, this.diveVX) - Math.PI / 2);
    // 翅膀
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(s, 1); ctx.rotate(-0.2 + fl * 0.25);
      ctx.fillStyle = this.col('#2a1438');
      ctx.beginPath(); ctx.moveTo(6, -8);
      ctx.bezierCurveTo(40, -70, 110, -60, 118, -18);
      ctx.lineTo(104, -10); ctx.lineTo(112, 4); ctx.lineTo(94, 6); ctx.lineTo(98, 22);
      ctx.bezierCurveTo(70, 30, 30, 20, 6, 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = this.col('#5a2a78'); ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(8, 0); ctx.quadraticCurveTo(50, -40 + i * 18, 100 - i * 4, -24 + i * 12); ctx.stroke(); }
      // 眼斑
      ctx.fillStyle = this.col('#7a3aa0'); ctx.beginPath(); ctx.arc(70, -18, 12, 0, 6.28); ctx.fill();
      ctx.fillStyle = this.flash > 0 ? '#fff' : `rgba(245,200,255,${0.6 + g * 0.4})`; ctx.beginPath(); ctx.arc(70, -18, 5, 0, 6.28); ctx.fill();
      ctx.restore();
    }
    // 身体
    ctx.fillStyle = this.col('#1a0d26');
    ctx.beginPath(); ctx.ellipse(0, 6, 20, 36, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = this.col('#3a1d50');
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, 14 + i * 7, 16 - i * 3, 3, 0, 0, 6.28); ctx.fill(); }
    // 吞光之核：中心黑洞 + 紫环
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(0, -4, 11 + g * 3, 0, 6.28); ctx.fill();
    ctx.strokeStyle = this.flash > 0 ? '#fff' : `rgba(224,156,255,${0.5 + g * 0.5})`; ctx.lineWidth = 2 + g * 2;
    ctx.beginPath(); ctx.arc(0, -4, 13 + g * 3 + Math.sin(this.t * 6) * 1.5, 0, 6.28); ctx.stroke();
    // 头冠触丝
    ctx.strokeStyle = this.col('#f0c8ff'); ctx.lineWidth = 1.5;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath(); ctx.moveTo(i * 3, -28); ctx.quadraticCurveTo(i * 8 + Math.sin(this.t * 3 + i) * 4, -46, i * 12, -54 - Math.abs(i) * -2);
      ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(i * 12, -54 + Math.abs(i) * 2, 1.8, 0, 6.28); ctx.fill();
    }
    ctx.fillStyle = this.col('#2a1438'); ctx.beginPath(); ctx.ellipse(0, -28, 12, 9, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = this.phase2 ? '#ff6ad0' : '#f5c8ff';
    ctx.beginPath(); ctx.arc(-5, -29, 2.2, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(5, -29, 2.2, 0, 6.28); ctx.fill();
    ctx.restore();
  }
  lights() { if (this.mode !== 'sleep') Light.add(this.cx, this.cy, 160 + this.glow * 80, '#c070ff', 0.6, 0.2 + this.glow * 0.25); }
}

const BOSS_TYPES = { rust: Rustwarden, mother: Matriarch };

// ------------------------------------------------------------
//  熔炉看守 · 伊格
// ------------------------------------------------------------
class KilnWarden extends Enemy {
  constructor(x, y) {
    super(x, y, 92, 96);
    this.hp = this.maxHp = 64; this.knock = 0; this.touch = 1; this.amber = [0, 0];
    this.isBoss = true; this.bossId = 'kiln'; this.mode = 'sleep'; this.modeT = 0; this.facing = 1; this.last = [];
    this.floorY = y; this.mouth = 0; this.arms = 0;
    this.blood = ['#ffb070', '#ff6a2a', '#3a2418', '#fff'];
  }
  get phase2() { return this.hp <= this.maxHp * 0.5; }
  wake() { this.mode = 'intro'; this.modeT = 1.6; Sfx.play('roar'); Game.cam.shake(9, 1.2); }
  setMode(m, t) { this.mode = m; this.modeT = t; }
  choose() {
    const p = Game.player, room = Game.room, d = Math.abs(p.cx - this.cx);
    let opts = ['breath', 'pillars', 'breath', 'pillars'];
    if (d < 140 || Math.random() < 0.25) opts.push('hop', 'hop');
    if (this.last[0] && this.last[0] === this.last[1]) opts = opts.filter(o => o !== this.last[0]);
    const m = U.pick(opts); this.last.unshift(m); this.last.length = Math.min(3, this.last.length);
    this.facing = U.sign(p.cx - this.cx) || this.facing;
    if (m === 'breath') { this.setMode('breath_wind', this.phase2 ? 0.45 : 0.65); Sfx.play('charge'); }
    else if (m === 'pillars') { this.setMode('pillar_wind', this.phase2 ? 0.4 : 0.55); }
    else {
      this.setMode('hop_wind', 0.35);
      this.hopX = this.cx < room.pw / 2 ? room.pw * U.rand(0.62, 0.8) : room.pw * U.rand(0.2, 0.38);
    }
  }
  hurt(d, kx, ky) {
    if (this.mode === 'sleep' || this.mode === 'intro' || this.mode === 'dying') return false;
    const was = this.phase2;
    this.hp -= d; this.flash = 0.1; Sfx.play('hit'); Game.hitstop(0.04);
    Game.particles.burst(this.cx - kx * 20, this.cy, 6, { color: this.blood, speed: 220, life: 0.4, size: 3, grav: 500 });
    if (!was && this.phase2) { Sfx.play('roar'); Game.cam.shake(9, 0.8); this.setMode('rage', 1.0); Game.flash('#ff8a3a', 0.3); }
    if (this.hp <= 0) { this.hp = 0; this.setMode('dying', 2.2); this.hittable = false; Sfx.play('roar'); Game.slowmo(1.2); }
  }
  update(dt) {
    this.baseUpdate(dt);
    const p = Game.player, room = Game.room, sp = this.phase2 ? 1.2 : 1;
    this.modeT -= dt;
    this.mouth = U.lerp(this.mouth, /breath|rage/.test(this.mode) ? 1 : 0.25, dt * 8);
    this.arms = U.lerp(this.arms, this.mode === 'pillar_wind' ? 1 : 0, dt * 10);
    if (Math.random() < dt * 6) Game.particles.add({ x: this.cx + U.rand(-8, 8), y: this.y - 6, vx: U.rand(-10, 10), vy: U.rand(-60, -30), life: 1.2, size: U.rand(3, 6), color: 'rgba(60,40,36,0.6)', drag: 0.98 });
    switch (this.mode) {
      case 'sleep': this.vx = 0; break;
      case 'intro': if (this.modeT <= 0) this.setMode('idle', 0.6); break;
      case 'idle':
        this.facing = U.sign(p.cx - this.cx) || this.facing;
        this.vx = U.approach(this.vx, 0, 600 * dt);
        if (this.modeT <= 0) this.choose();
        break;
      case 'breath_wind':
        if (this.modeT <= 0) {
          const n = this.phase2 ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const vx = this.facing * U.lerp(160, 470, i / (n - 1)) * sp, vy = -U.rand(380, 620);
            Game.projectiles.push(new Projectile(this.cx + this.facing * 30, this.y + 40, vx, vy, { r: 9, color: '#ff8a3a', grav: 950, slashable: true, delay: i * 0.05 }));
          }
          Sfx.play('dash', 0.6); this.setMode('recover', this.phase2 ? 0.7 : 1.0);
        }
        break;
      case 'pillar_wind':
        if (this.modeT <= 0) {
          Sfx.play('slam'); Game.cam.shake(10, 0.3);
          const n = this.phase2 ? 5 : 3, gap = 110, base = p.cx - (n - 1) * gap / 2 + U.rand(-30, 30);
          for (let i = 0; i < n; i++) {
            const x = U.clamp(base + i * gap, 80, room.pw - 80);
            const pr = new Projectile(x, this.floorY, 0, 0, { kind: 'pillar', delay: 0.65 + i * (this.phase2 ? 0.08 : 0.12), life: 0.45, tiles: false, color: '#ff8a3a' });
            Game.projectiles.push(pr);
          }
          this.setMode('recover', this.phase2 ? 0.9 : 1.2);
        }
        break;
      case 'hop_wind':
        this.vx = 0;
        if (this.modeT <= 0) {
          this.vy = -880; this.vx = U.clamp((this.hopX - this.cx) / 0.85, -620, 620);
          this.setMode('hop', 3); Sfx.play('jump', 0.4);
        }
        break;
      case 'hop':
        if (this.onGround && this.vy >= 0 && this.modeT < 2.9) {
          Sfx.play('slam'); Game.cam.shake(12, 0.4);
          for (const d of [-1, 1]) Game.projectiles.push(new Projectile(this.cx + d * 40, this.floorY, d * 340 * sp, 0, { kind: 'wave', color: '#ff8a3a', life: 3, tiles: false }));
          this.vx = 0; this.setMode('recover', 0.6);
        }
        break;
      case 'rage':
        this.vx = 0;
        if (Math.random() < 0.6) Game.particles.add({ x: this.cx, y: this.y + 40, vx: U.rand(-300, 300), vy: U.rand(-400, -50), life: 0.6, size: 3, color: '#ffb040', glow: true, grav: 600 });
        if (this.modeT <= 0) this.setMode('idle', 0.2);
        break;
      case 'recover':
        this.vx = U.approach(this.vx, 0, 900 * dt);
        if (this.modeT <= 0) this.setMode('idle', this.phase2 ? U.rand(0.2, 0.45) : U.rand(0.4, 0.75));
        break;
      case 'dying':
        this.vx = 0;
        if (Math.random() < dt * 20) Game.particles.burst(this.cx + U.rand(-40, 40), this.cy + U.rand(-40, 40), 6, { color: this.blood, speed: 240, life: 0.6, size: 4, glow: true });
        if (Math.random() < dt * 6) Sfx.play('hit');
        if (this.modeT <= 0) {
          this.dead = true;
          Game.particles.burst(this.cx, this.cy, 90, { color: ['#fff4c0', '#ffb040', '#ff6a2a', '#3a2418'], speed: 520, life: 1.2, size: 5, glow: true });
          Game.cam.shake(16, 0.8); Sfx.play('break'); Sfx.play('kill');
          Game.spawnAmber(this.cx, this.cy, 80);
          Game.onBossDefeated('kiln');
        }
        break;
    }
    if (this.mode !== 'sleep') this.physics(dt, 2000);
  }
  touchBox() {
    if (this.mode === 'sleep' || this.mode === 'dying') return { x: 0, y: -999, w: 0, h: 0 };
    return { x: this.x + 10, y: this.y + 14, w: this.w - 20, h: this.h - 14 };
  }
  draw(ctx) {
    const x = this.cx, by = this.y + this.h, f = this.facing;
    ctx.save(); ctx.translate(x + (this.mode === 'dying' ? U.rand(-3, 3) : 0), by); ctx.scale(f, 1);
    let sq = 0;
    if (this.mode === 'hop_wind') sq = 0.12; else if (this.mode === 'sleep') sq = 0.1;
    ctx.scale(1 + sq * 0.5, 1 - sq);
    // 腿
    ctx.fillStyle = this.col('#1e1410'); ctx.fillRect(-34, -18, 22, 18); ctx.fillRect(12, -18, 22, 18);
    // 窑身（砖）
    ctx.fillStyle = this.col('#3a2418');
    ctx.beginPath(); ctx.moveTo(-46, -14); ctx.lineTo(-38, -82); ctx.quadraticCurveTo(0, -96, 38, -82); ctx.lineTo(46, -14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = this.col('#2a1810'); ctx.lineWidth = 2;
    for (let r = 0; r < 5; r++) {
      const yy = -24 - r * 13; ctx.beginPath(); ctx.moveTo(-44 + r * 1.5, yy); ctx.lineTo(44 - r * 1.5, yy); ctx.stroke();
      for (let c = 0; c < 6; c++) { const xx = -40 + c * 16 + (r % 2) * 8; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - 13); ctx.stroke(); }
    }
    // 炉口
    const m = this.mouth;
    ctx.fillStyle = '#120806'; ctx.beginPath(); ctx.ellipse(6, -42, 22, 18 + m * 4, 0, Math.PI, 0); ctx.lineTo(28, -30); ctx.lineTo(-16, -30); ctx.fill();
    const g = ctx.createRadialGradient(6, -36, 2, 6, -36, 26);
    g.addColorStop(0, this.flash > 0 ? '#fff' : `rgba(255,${200 + m * 50 | 0},140,1)`); g.addColorStop(0.5, 'rgba(255,120,40,0.9)'); g.addColorStop(1, 'rgba(120,30,10,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(6, -38, 18 + m * 4, 12 + m * 4, 0, 0, 6.28); ctx.fill();
    // 手臂
    const ay = -60 - this.arms * 34;
    ctx.fillStyle = this.col('#2e1c14');
    ctx.save(); ctx.translate(-40, -62); ctx.rotate(-0.4 - this.arms * 1.6); ctx.fillRect(-8, 0, 16, 40); ctx.fillStyle = this.col('#4a2c1c'); ctx.fillRect(-11, 34, 22, 14); ctx.restore();
    ctx.save(); ctx.translate(40, -62); ctx.rotate(0.4 + this.arms * 1.6); ctx.fillRect(-8, 0, 16, 40); ctx.fillStyle = this.col('#4a2c1c'); ctx.fillRect(-11, 34, 22, 14); ctx.restore();
    void ay;
    // 烟囱头与眼
    ctx.fillStyle = this.col('#2a1810'); ctx.fillRect(-16, -112, 32, 26); ctx.fillRect(-20, -116, 40, 6);
    ctx.fillStyle = this.phase2 ? '#fff4c0' : '#ffb040';
    ctx.fillRect(-4, -102, 8, 4); ctx.fillRect(8, -102, 8, 4);
    ctx.restore();
  }
  lights() { Light.add(this.cx + this.facing * 6, this.y + 56, 160 + this.mouth * 120, '#ff8a3a', 0.9, 0.25 + this.mouth * 0.25); }
}
BOSS_TYPES.kiln = KilnWarden;
BOSS_INFO.kiln = { name: '熔炉看守', title: '伊 格', reward: 'spell' };

// ------------------------------------------------------------
//  苔母 · 薇丝（可选）：潜地移动、破土而出、喷吐孢种、召唤藤刺
// ------------------------------------------------------------
class MossMother extends Enemy {
  constructor(x, y) {
    super(x, y, 72, 78);
    this.hp = this.maxHp = 54; this.knock = 0; this.touch = 1; this.amber = [0, 0];
    this.isBoss = true; this.bossId = 'moss'; this.mode = 'sleep'; this.modeT = 0; this.facing = -1;
    this.floorY = y; this.rise = 1; this.targetX = this.cx; this.blood = ['#9fe0a8', '#5fa877', '#ff9ec8', '#fff'];
    this.count = 0;
  }
  get phase2() { return this.hp <= this.maxHp * 0.5; }
  wake() { this.mode = 'intro'; this.modeT = 1.5; Sfx.play('roar'); Game.cam.shake(8, 1); }
  setMode(m, t) { this.mode = m; this.modeT = t; }
  hurt(d, kx, ky) {
    if (!/rooted|spit|vine|recover/.test(this.mode)) return false;
    const was = this.phase2;
    this.hp -= d; this.flash = 0.1; Sfx.play('hit'); Game.hitstop(0.04);
    Game.particles.burst(this.cx, this.cy, 6, { color: this.blood, speed: 220, life: 0.4, size: 3, grav: 500 });
    if (!was && this.phase2) { Sfx.play('roar'); Game.cam.shake(8, 0.6); this.setMode('sink', 0.5); }
    if (this.hp <= 0) { this.hp = 0; this.setMode('dying', 2); this.hittable = false; Sfx.play('roar'); Game.slowmo(1); }
  }
  update(dt) {
    this.baseUpdate(dt);
    const p = Game.player, room = Game.room, sp = this.phase2 ? 1.3 : 1;
    this.modeT -= dt;
    this.y = this.floorY - this.h + (1 - this.rise) * (this.h + 6);
    switch (this.mode) {
      case 'sleep': this.rise = 0; this.hittable = false; break;
      case 'intro':
        this.rise = Math.min(1, this.rise + dt * 1.2); this.hittable = true;
        if (Math.random() < 0.5) this.dirt();
        if (this.modeT <= 0) this.setMode('rooted', 0.5);
        break;
      case 'rooted':
        this.facing = U.sign(p.cx - this.cx) || this.facing;
        if (this.modeT <= 0) {
          this.count++;
          const r = Math.random();
          if (this.count % 3 === 0 || Math.abs(p.cx - this.cx) < 90) this.setMode('sink', 0.5);
          else if (r < 0.5) { this.setMode('spit', this.phase2 ? 0.4 : 0.55); Sfx.play('charge'); }
          else this.setMode('vine', 0.5);
        }
        break;
      case 'spit':
        if (this.modeT <= 0) {
          const n = this.phase2 ? 6 : 4;
          for (let i = 0; i < n; i++) {
            const vx = this.facing * U.lerp(120, 420, i / (n - 1)) * sp;
            Game.projectiles.push(new Projectile(this.cx + this.facing * 20, this.y + 20, vx, -U.rand(450, 600), { r: 7, color: '#ff9ec8', grav: 900, slashable: true, delay: i * 0.06 }));
          }
          Sfx.play('spit'); this.setMode('recover', 0.8);
        }
        break;
      case 'vine':
        if (this.modeT <= 0) {
          const n = this.phase2 ? 4 : 3;
          for (let i = 0; i < n; i++) {
            const x = U.clamp(p.cx + (i - (n - 1) / 2) * 120 + U.rand(-20, 20), 80, room.pw - 80);
            Game.projectiles.push(new Projectile(x, this.floorY, 0, 0, { kind: 'pillar', delay: 0.6 + i * 0.1, life: 0.4, tiles: false, color: '#9fe0a8' }));
          }
          Sfx.play('slam'); Game.cam.shake(5, 0.2); this.setMode('recover', 0.9);
        }
        break;
      case 'recover':
        if (this.modeT <= 0) this.setMode('rooted', this.phase2 ? 0.3 : 0.6);
        break;
      case 'sink':
        this.rise = Math.max(0, this.rise - dt * 2.5); if (Math.random() < 0.5) this.dirt();
        if (this.rise <= 0) {
          this.hittable = false;
          this.targetX = U.clamp(p.cx + U.rand(-60, 60), 100, room.pw - 100);
          this.setMode('burrow', 2.5);
        }
        break;
      case 'burrow': {
        // 地下移动：地面翻起的土是预警
        const dx = this.targetX - this.cx;
        this.x += U.clamp(dx, -260 * sp * dt, 260 * sp * dt);
        if (Math.random() < 0.7) this.dirt();
        if (Math.abs(dx) < 4 || this.modeT <= 0) { this.setMode('emerge', 0.35); }
        break;
      }
      case 'emerge':
        if (this.modeT <= 0) {
          this.hittable = true; this.rise = 0.01; this.setMode('rising', 0.3);
          Sfx.play('slam'); Game.cam.shake(7, 0.25);
          Game.particles.burst(this.cx, this.floorY, 24, { angle: -Math.PI / 2, spread: 0.9, speed: 380, color: ['#5a4a3a', '#5fa877', '#2a3a2a'], life: 0.7, size: 4, grav: 900 });
        } else if (Math.random() < 0.8) this.dirt();
        break;
      case 'rising':
        this.rise = Math.min(1, this.rise + dt * 5);
        if (this.rise >= 1) this.setMode('rooted', 0.4);
        break;
      case 'dying':
        if (Math.random() < dt * 20) Game.particles.burst(this.cx + U.rand(-30, 30), this.cy + U.rand(-30, 30), 6, { color: this.blood, speed: 200, life: 0.5, size: 4 });
        if (this.modeT <= 0) {
          this.dead = true;
          Game.particles.burst(this.cx, this.cy, 80, { color: [...this.blood, '#ffe2a8'], speed: 480, life: 1.2, size: 5, glow: true });
          Game.cam.shake(14, 0.6); Sfx.play('break'); Sfx.play('kill');
          Game.spawnAmber(this.cx, this.cy, 70);
          Game.onBossDefeated('moss');
        }
        break;
    }
  }
  dirt() { Game.particles.add({ x: this.cx + U.rand(-30, 30), y: this.floorY - 2, vx: U.rand(-60, 60), vy: U.rand(-220, -80), life: 0.5, size: U.rand(2, 4), color: U.pick(['#5a4a3a', '#3f5a40', '#2a2a22']), grav: 800 }); }
  touchBox() {
    if (this.rise < 0.3 || this.mode === 'dying' || this.mode === 'sleep') return { x: 0, y: -999, w: 0, h: 0 };
    return { x: this.x + 10, y: this.y + 8, w: this.w - 20, h: this.h - 8 };
  }
  extraHits() {
    if (this.mode === 'rising') return [{ x: this.cx - 34, y: this.floorY - 70, w: 68, h: 70 }];
    return null;
  }
  draw(ctx) {
    if (this.rise <= 0.01) return;
    const x = this.cx, by = this.floorY, f = this.facing;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - 120, by - 200, 240, 200); ctx.clip();
    ctx.translate(x + (this.mode === 'dying' ? U.rand(-3, 3) : 0), this.y + this.h); ctx.scale(f, 1);
    const sw = Math.sin(this.t * 2) * 0.05;
    ctx.rotate(sw);
    // 茎
    ctx.fillStyle = this.col('#2f4a30'); ctx.fillRect(-10, -50, 20, 50);
    // 叶
    for (const s of [-1, 1]) {
      ctx.fillStyle = this.col(s > 0 ? '#3f7a52' : '#356a46');
      ctx.beginPath(); ctx.ellipse(s * 26, -24, 26, 9, s * 0.5, 0, 6.28); ctx.fill();
    }
    // 花苞头
    const open = this.mode === 'spit' ? 1 - Math.max(0, this.modeT) / 0.55 : 0.2;
    ctx.fillStyle = this.col('#4f8a5f');
    ctx.beginPath(); ctx.ellipse(0, -60, 30, 26, 0, 0, 6.28); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.5;
      ctx.fillStyle = this.col(i % 2 ? '#ff9ec8' : '#e07aa8');
      ctx.save(); ctx.translate(Math.cos(a) * 20, -60 + Math.sin(a) * 20); ctx.rotate(a + Math.PI / 2 + (i - 2) * open * 0.3);
      ctx.beginPath(); ctx.ellipse(0, -8, 9, 16, 0, 0, 6.28); ctx.fill(); ctx.restore();
    }
    // 口与眼
    ctx.fillStyle = '#1a0d14'; ctx.beginPath(); ctx.ellipse(14, -56, 10, 6 + open * 6, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = this.phase2 ? '#ff6ad0' : '#fff4c8';
    ctx.beginPath(); ctx.arc(4, -70, 3, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(16, -71, 2.5, 0, 6.28); ctx.fill();
    ctx.restore();
  }
  lights() { if (this.rise > 0.05) Light.add(this.cx, this.y + 20, 150, '#ff9ec8', 0.7, 0.25); }
}
BOSS_TYPES.moss = MossMother;
BOSS_INFO.moss = { name: '苔母', title: '薇 丝', reward: null, charm: 'thorns' };
