'use strict';
// ============================================================
//  玩家：提灯者
// ============================================================
const P = {
  RUN: 290, ACC: 3200, AIR_ACC: 2400, GRAV: 2300, MAXFALL: 840,
  JUMP: 820, DJ: 730, POGO: 680, CUT_GRAV: 2.8,
  DASH_V: 880, DASH_T: 0.17, DASH_CD: 0.42,
  SLIDE: 150, WJ_VX: 330, WJ_VY: 760, WJ_LOCK: 0.14,
  COYOTE: 0.1, BUF: 0.13,
  ATK_CD: 0.36, ATK_T: 0.22, ATK_ACTIVE: 0.1,
  FOCUS_T: 0.9, SOUL_HIT: 11, SOUL_COST: 33, SOUL_MAX: 99,
};

class Player {
  constructor() { this.w = 18; this.h = 30; this.reset(); }
  reset() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.facing = 1;
    this.state = 'normal'; this.onGround = false; this.wasGround = false;
    this.invuln = 0; this.attackCD = 0; this.attackT = 0; this.attackDir = 'side'; this.hitSet = new Set();
    this.dashCD = 0; this.dashT = 0; this.canDash = true; this.djAvail = true;
    this.coyote = 0; this.jumpBuf = 0; this.jumping = false; this.wjLock = 0; this.recoilT = 0; this.hurtT = 0;
    this.wallDir = 0; this.wallSliding = false; this.dropT = 0; this.dropping = false;
    this.focusT = 0; this.deadT = 0; this.t = 0; this.runPhase = 0;
    this.sqx = 1; this.sqy = 1; this.lantA = 0; this.lantV = 0; this.blink = 2;
    this.lastSafe = null; this.castT = 0; this.pogoDone = false; this.hitTiles = false; this.clinked = false;
    this.spikeSolid = false; this.noOneway = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get hp() { return Game.save.hp; }
  set hp(v) { Game.save.hp = v; }
  get maxHp() { return Game.maxHp(); }

  touchWall(dir) {
    const room = Game.room;
    const tx = dir > 0 ? Math.floor((this.x + this.w + 1) / TILE) : Math.floor((this.x - 1) / TILE);
    const y0 = Math.floor((this.y + 4) / TILE), y1 = Math.floor((this.y + this.h - 4) / TILE);
    for (let ty = y0; ty <= y1; ty++) if (room.isSolid(tx, ty)) return true;
    return false;
  }
  standingOnOneway() {
    if (this.ride) return true;
    const room = Game.room, ty = Math.floor((this.y + this.h + 1) / TILE);
    const x0 = Math.floor(this.x / TILE), x1 = Math.floor((this.x + this.w - 0.01) / TILE);
    let one = false;
    for (let tx = x0; tx <= x1; tx++) {
      const t = room.tile(tx, ty);
      if (room.isSolid(tx, ty)) return false;
      if (t === T_ONEWAY) one = true;
    }
    return one;
  }
  safeGround() {
    const room = Game.room, ty = Math.floor((this.y + this.h + 1) / TILE);
    const a = Math.floor((this.x - 2) / TILE), b = Math.floor((this.x + this.w + 2) / TILE);
    for (let tx = a; tx <= b; tx++) {
      const t = room.tile(tx, ty);
      if (!(room.isSolid(tx, ty) || t === T_ONEWAY)) return false;
      if (room.tile(tx, ty - 1) === T_SPIKE) return false;
    }
    if (room.gateClosed) return false;
    return true;
  }

  update(dt) {
    const S = Game.save, room = Game.room;
    this.t += dt;
    const dec = k => { if (this[k] > 0) this[k] = Math.max(0, this[k] - dt); };
    ['invuln', 'attackCD', 'dashCD', 'coyote', 'jumpBuf', 'wjLock', 'recoilT', 'hurtT', 'attackT', 'dropT'].forEach(dec);
    this.dropping = this.dropT > 0;
    this.blink -= dt; if (this.blink < -0.12) this.blink = U.rand(2, 5);
    // 弹性形变回弹
    this.sqx = U.lerp(this.sqx, 1, Math.min(1, dt * 12)); this.sqy = U.lerp(this.sqy, 1, Math.min(1, dt * 12));
    // 提灯摆动
    this.lantV += (-this.lantA * 60 - this.lantV * 6 - this.vx * 0.02) * dt;
    this.lantA += this.lantV * dt;

    if (this.state === 'dead') { this.deadT += dt; return; }
    if (Game.hasCharm('sporecrown') && this.state !== 'focus' && Game.save.soul < P.SOUL_MAX) Game.save.soul = Math.min(P.SOUL_MAX, Game.save.soul + 2.5 * dt);
    if (this.state === 'sit') {
      this.vx = 0; this.vy = 0;
      if (!Game.inputLocked && !(Game.sitGuard > 0) && (Input.pressed('left') || Input.pressed('right') || Input.pressed('jump') || Input.pressed('down'))) {
        this.state = 'normal'; this.sqy = 1.15; this.sqx = 0.9;
      }
      return;
    }

    const ctl = this.hurtT <= 0 && !Game.inputLocked;
    const ix = ctl ? (Input.down('right') ? 1 : 0) - (Input.down('left') ? 1 : 0) : 0;
    const upK = ctl && Input.down('up'), downK = ctl && Input.down('down');
    if (ctl && Input.pressed('jump')) this.jumpBuf = P.BUF;

    // ---------- 聚焦（回血） ----------
    if (this.state === 'focus') {
      if (!ctl || !Input.down('focus') || !this.onGround || S.soul < P.SOUL_COST || this.hp >= this.maxHp) {
        this.state = 'normal'; this.focusT = 0;
      } else {
        this.focusT += dt; this.vx = 0;
        if (Math.random() < dt * 40) {
          const a = U.rand(0, 6.28), r = U.rand(30, 50);
          Game.particles.add({ x: this.cx + Math.cos(a) * r, y: this.cy + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.2, vy: -Math.sin(a) * r * 2.2, life: 0.4, size: 2.2, color: '#ffd38a', glow: true, drag: 1 });
        }
        if (this.focusT >= P.FOCUS_T * (Game.hasCharm('bloom') ? 0.58 : 1)) {
          this.focusT = 0; S.soul -= P.SOUL_COST; this.hp = Math.min(this.maxHp, this.hp + 1);
          Sfx.play('heal'); this.sqy = 1.2; this.sqx = 0.85;
          Game.particles.burst(this.cx, this.cy, 24, { color: ['#ffe2a8', '#ffb347', '#fff'], speed: 220, life: 0.6, glow: true, size: 3 });
          Game.flash('#ffcf80', 0.15);
          if (this.hp >= this.maxHp || S.soul < P.SOUL_COST) this.state = 'normal';
          else Sfx.play('focus');
        }
      }
    } else if (ctl && this.state === 'normal' && Input.pressed('focus') && this.onGround && this.attackT <= 0) {
      if (S.soul >= P.SOUL_COST && this.hp < this.maxHp) { this.state = 'focus'; this.focusT = 0; Sfx.play('focus'); }
      else Sfx.play('deny');
    }

    // ---------- 冲刺 ----------
    if (ctl && this.state === 'normal' && Input.pressed('dash') && S.abilities.dash && this.dashCD <= 0 && this.canDash) {
      let d = ix || this.facing;
      if (this.wallSliding) d = -this.wallDir;
      this.facing = d; this.state = 'dash'; this.dashT = P.DASH_T; this.vx = d * P.DASH_V; this.vy = 0;
      this.canDash = false; this.dashCD = P.DASH_CD; this.attackT = 0; this.wallSliding = false;
      Sfx.play('dash'); this.sqx = 1.35; this.sqy = 0.75;
      Game.particles.burst(this.cx - d * 10, this.cy, 10, { angle: d > 0 ? Math.PI : 0, spread: 0.5, speed: 260, color: ['#3a3f66', '#5b6299', '#14162a'], life: 0.35, size: 5 });
    }
    if (this.state === 'dash') {
      this.dashT -= dt; this.vy = 0; this.vx = this.facing * P.DASH_V;
      if (Math.random() < dt * 60) {
        Game.particles.add({ x: this.cx - this.facing * 8, y: this.cy + U.rand(-10, 12), vx: -this.facing * 60, vy: 0, life: 0.25, size: 6, color: 'rgba(40,44,80,0.8)', drag: 0.9 });
        Game.particles.add({ x: this.cx, y: this.cy + U.rand(-12, 12), vx: -this.facing * 600, vy: 0, life: 0.12, size: 1.5, color: '#c9cfff', shape: 'line', glow: true, drag: 1 });
      }
      if (this.dashT <= 0 || this.hitL || this.hitR) {
        this.state = 'normal'; this.vx = this.facing * P.RUN * (this.onGround ? 1 : 0.8);
      }
    }

    // ---------- 常规移动 ----------
    if (this.state === 'normal') {
      if (this.recoilT <= 0 && this.wjLock <= 0) {
        const acc = this.onGround ? P.ACC : P.AIR_ACC;
        this.vx = U.approach(this.vx, ix * P.RUN * (Game.hasCharm('swift') ? 1.15 : 1), acc * dt);
      }
      if (ix && this.attackT <= 0 && this.wjLock <= 0) this.facing = ix;

      // 墙
      this.wallDir = 0;
      if (S.abilities.claw && !this.onGround) {
        if (this.touchWall(1)) this.wallDir = 1; else if (this.touchWall(-1)) this.wallDir = -1;
      }
      const wasSliding = this.wallSliding;
      this.wallSliding = this.wallDir !== 0 && this.vy > -60 && (ix === this.wallDir || (wasSliding && ix !== -this.wallDir));
      if (this.wallSliding) {
        this.canDash = true; this.djAvail = true; this.facing = -this.wallDir;
        if (!wasSliding) Sfx.play('walljump');
        if (Math.random() < dt * 20) Game.particles.add({ x: this.wallDir > 0 ? this.x + this.w : this.x, y: this.y + this.h - 4, vx: -this.wallDir * 20, vy: -20, life: 0.3, size: 2, color: '#8a8fb0' });
      }

      // 下穿单向平台
      if (this.jumpBuf > 0 && downK && this.onGround && this.standingOnOneway()) {
        this.jumpBuf = 0; this.dropT = 0.22; this.dropping = true; this.y += 2; this.onGround = false;
      }
      // 跳跃
      if (this.jumpBuf > 0) {
        if (this.onGround || this.coyote > 0) {
          this.vy = -P.JUMP; this.jumping = true; this.jumpBuf = 0; this.coyote = 0; this.onGround = false;
          Sfx.play('jump'); this.sqx = 0.75; this.sqy = 1.3;
          Game.particles.burst(this.cx, this.y + this.h, 6, { angle: -Math.PI / 2, spread: 1.2, speed: 90, color: '#aab', life: 0.3, size: 2.5, grav: 300 });
        } else if (this.wallDir !== 0 && S.abilities.claw) {
          this.vx = -this.wallDir * P.WJ_VX; this.vy = -P.WJ_VY; this.wjLock = P.WJ_LOCK; this.facing = -this.wallDir;
          this.jumping = true; this.jumpBuf = 0; this.wallSliding = false;
          Sfx.play('walljump'); this.sqx = 0.8; this.sqy = 1.25;
          Game.particles.burst(this.wallDir > 0 ? this.x + this.w : this.x, this.cy, 8, { angle: this.wallDir > 0 ? Math.PI : 0, spread: 0.9, speed: 140, color: '#99a', life: 0.3, size: 2.5 });
        } else if (S.abilities.wings && this.djAvail) {
          this.djAvail = false; this.vy = -P.DJ; this.jumping = true; this.jumpBuf = 0;
          Sfx.play('djump'); this.sqx = 0.8; this.sqy = 1.25;
          for (let s = -1; s <= 1; s += 2) {
            for (let i = 0; i < 8; i++) Game.particles.add({ x: this.cx + s * (6 + i * 3), y: this.cy + 6 - i * 1.5, vx: s * U.rand(30, 90), vy: U.rand(40, 120), life: 0.5, size: 3, color: U.pick(['#f0c8ff', '#fff', '#d9a0ff']), glow: true, shape: 'leaf', drag: 0.94 });
          }
        }
      }
      // 重力（松开跳跃键时加大重力 → 可变跳高）
      let gm = 1;
      if (this.vy < 0 && this.jumping && !Input.down('jump')) gm = P.CUT_GRAV;
      if (this.vy > 0) this.jumping = false;
      this.vy = Math.min(P.MAXFALL, this.vy + P.GRAV * gm * dt);
      if (this.wallSliding) this.vy = Math.min(this.vy, P.SLIDE);
    } else if (this.state === 'focus') {
      this.vy = Math.min(P.MAXFALL, this.vy + P.GRAV * dt);
    }

    // ---------- 烬火弹 ----------
    if (this.castT > 0) this.castT -= dt;
    if (ctl && this.state === 'normal' && Input.pressed('cast') && S.abilities.spell && this.castT <= 0) {
      if (S.soul >= P.SOUL_COST) {
        S.soul -= P.SOUL_COST; this.castT = 0.3; this.attackT = 0;
        if (this.wallSliding) this.facing = -this.wallDir;
        Game.spells.push(new PlayerSpell(this.cx + this.facing * 16, this.cy - 2, this.facing));
        this.vx = -this.facing * 160; this.recoilT = 0.1; if (this.vy > 0) this.vy *= 0.3;
        Sfx.play('cast'); this.sqx = 1.2; this.sqy = 0.85;
        Game.particles.burst(this.cx + this.facing * 14, this.cy, 14, { angle: this.facing > 0 ? 0 : Math.PI, spread: 0.6, speed: 260, color: ['#ffb040', '#fff4c0'], life: 0.3, size: 3, glow: true });
      } else Sfx.play('deny');
    }

    // ---------- 攻击 ----------
    if (ctl && (this.state === 'normal') && Input.pressed('attack') && this.attackCD <= 0) {
      this.attackDir = upK ? 'up' : (downK && !this.onGround) ? 'down' : 'side';
      if (this.wallSliding && this.attackDir === 'side') this.facing = -this.wallDir;
      this.attackT = P.ATK_T; this.attackCD = P.ATK_CD; this.hitSet.clear();
      this.pogoDone = false; this.hitTiles = false; this.clinked = false;
      Sfx.play('slash');
    }

    // ---------- 移动与碰撞 ----------
    this.wasGround = this.onGround;
    const preVy = this.vy;
    // 搭乘平台：跟随平台位移
    if (this.ride && this.ride.solid && this.state !== 'dash') { Phys.stepX(room, this, this.ride.mx); Phys.stepY(room, this, this.ride.my); }
    const preBottom = this.y + this.h;
    Phys.move(room, this, dt);
    this.ride = null;
    if (this.vy >= 0 && !this.dropping) {
      for (const pl of Game.platforms) {
        if (!pl.solid) continue;
        if (this.x + this.w > pl.x - 4 && this.x < pl.x + pl.w + 4 && this.y + this.h >= pl.y - 0.5 && preBottom <= pl.y + 8 + Math.max(0, -pl.my)) {
          this.y = pl.y - this.h; this.vy = 0; this.onGround = true; this.ride = pl; pl.touch(); break;
        }
      }
    }
    if (this.onGround) {
      if (!this.wasGround) {
        this.jumping = false;
        if (preVy > 300) {
          Sfx.play('land'); this.sqx = 1.25; this.sqy = 0.8;
          Game.particles.burst(this.cx, this.y + this.h, 8, { angle: -Math.PI / 2, spread: 1.4, speed: 110, color: '#9aa', life: 0.35, size: 2.5, grav: 400 });
        }
      }
      this.coyote = P.COYOTE; this.djAvail = true; this.canDash = true; this.wallSliding = false;
      if (this.safeGround()) this.lastSafe = { x: this.x, y: this.y };
      if (Math.abs(this.vx) > 20) this.runPhase += dt * Math.abs(this.vx) / 22;
      if (Math.abs(this.vx) > 200 && Math.random() < dt * 12) Game.particles.add({ x: this.cx - this.facing * 6, y: this.y + this.h - 1, vx: -this.facing * U.rand(20, 60), vy: U.rand(-40, -10), life: 0.4, size: U.rand(1.5, 3), color: 'rgba(150,150,160,0.5)', drag: 0.94 });
    }
    if (this.hitU) this.jumping = false;

    if (this.attackT > P.ATK_T - P.ATK_ACTIVE) this.processAttack();

    // 尖刺
    if (Phys.touchesSpike(room, { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 2 })) Game.hazardHit();
  }

  attackBox() {
    const cx = this.cx, cy = this.cy, k = Game.hasCharm('longedge') ? 1.3 : 1;
    switch (this.attackDir) {
      case 'up': return { x: cx - 28 * k, y: this.y + 8 - 66 * k, w: 56 * k, h: 66 * k };
      case 'down': return { x: cx - 26 * k, y: this.y + this.h - 8, w: 52 * k, h: 60 * k };
      default: return { x: this.facing > 0 ? cx + 2 : cx - 2 - 70 * k, y: cy - 21 * k, w: 70 * k, h: 42 * k };
    }
  }
  processAttack() {
    const S = Game.save, room = Game.room, hb = this.attackBox(), dir = this.attackDir;
    let hit = false, pogo = false, soul = false;
    const dmg = S.blade >= 2 ? 3 : 2;
    for (const e of Game.enemies) {
      if (e.dead || !e.hittable || this.hitSet.has(e)) continue;
      if (U.overlap(hb, e.box())) {
        this.hitSet.add(e);
        const kx = dir === 'side' ? this.facing : 0, ky = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
        if (e.hurt(dmg, kx, ky) === false) { Sfx.play('clink'); continue; }
        hit = true; if (e.givesSoul !== false) soul = true;
        if (dir === 'down') pogo = true;
        const ex = U.clamp(this.cx + (dir === 'side' ? this.facing * 40 : 0), e.x, e.x + e.w), ey = U.clamp(dir === 'up' ? this.y - 30 : dir === 'down' ? this.y + this.h + 25 : this.cy, e.y, e.y + e.h);
        Game.hitSpark(ex, ey, dir === 'side' ? (this.facing > 0 ? 0 : Math.PI) : dir === 'up' ? -Math.PI / 2 : Math.PI / 2);
      }
    }
    for (const p of Game.projectiles) {
      if (p.dead || !p.slashable || p.delay > 0) continue;
      if (U.overlap(hb, p.box())) { p.noBlast = true; p.pop(); hit = true; if (dir === 'down') pogo = true; }
    }
    for (const o of Game.objects) {
      if (!o.hittable || this.hitSet.has(o) || o.dead) continue;
      if (U.overlap(hb, o.box())) { this.hitSet.add(o); o.hit(dir); hit = true; if (dir === 'down') pogo = true; }
    }
    if (!this.hitTiles) {
      const bt = Phys.touchesTile(room, hb, T_BREAK);
      if (bt) { this.hitTiles = true; Game.hitBreakable(bt.tx, bt.ty); hit = true; }
    }
    if (dir === 'down' && !pogo && Phys.touchesTile(room, { x: hb.x + 8, y: hb.y, w: hb.w - 16, h: hb.h }, T_SPIKE)) {
      pogo = true;
      Game.particles.burst(this.cx, this.y + this.h + 24, 8, { color: ['#fff', '#ccd'], speed: 180, life: 0.25, size: 2 });
      Sfx.play('clink');
    }
    if (soul) { S.soul = Math.min(P.SOUL_MAX, S.soul + (S.shop.soul ? 16 : P.SOUL_HIT) + (Game.hasCharm('siphon') ? 6 : 0)); }
    if (pogo && !this.pogoDone) {
      this.pogoDone = true; this.vy = -P.POGO; this.jumping = false; this.djAvail = true; this.canDash = true;
      this.sqx = 0.85; this.sqy = 1.2;
    }
    if (hit && dir === 'side' && this.recoilT <= 0) { this.vx = -this.facing * 190; this.recoilT = 0.08; }
    if (!hit && dir === 'side' && !this.clinked) {
      // 砍到墙
      const wx = this.facing > 0 ? hb.x + hb.w - 6 : hb.x + 6;
      if (room.isSolid(Math.floor(wx / TILE), Math.floor(this.cy / TILE))) {
        this.clinked = true; Sfx.play('clink');
        if (room.tile(Math.floor(wx / TILE), Math.floor(this.cy / TILE)) === T_SEAL && !Game.sealHinted) {
          Game.sealHinted = true;
          Game.toast(S.abilities.spell ? '灵焰封印……试试烬火弹（F / U）。' : '墙上流动着灵焰的纹路，刀刃无法撼动。', 4);
        }
        Game.particles.burst(wx, this.cy, 6, { color: ['#fff', '#ffe2a8'], speed: 160, life: 0.2, size: 2, glow: true });
        this.vx = -this.facing * 120; this.recoilT = 0.06;
      }
    }
  }

  hurt(dmg, srcX) {
    if (this.invuln > 0 || this.state === 'dead' || Game.state !== 'play') return false;
    const S = Game.save;
    this.hp -= dmg * (S.difficulty === 'hard' ? 2 : 1);
    this.invuln = (Game.hasCharm('hardshell') ? 2.0 : 1.3) + (S.difficulty === 'easy' ? 0.6 : 0); this.hurtT = 0.25; this.attackT = 0; this.wallSliding = false;
    if (this.state === 'focus' || this.state === 'dash' || this.state === 'sit') this.state = 'normal';
    const d = U.sign(this.cx - (srcX ?? this.cx - this.facing)) || -this.facing;
    this.vx = d * 330; this.vy = -430; this.jumping = false;
    Sfx.play('hurt');
    if (Game.hasCharm('thorns')) {
      for (const e of Game.enemies) if (!e.dead && e.hittable && U.dist(e.cx, e.cy, this.cx, this.cy) < 130) e.hurt(6, U.sign(e.cx - this.cx), 0);
      Game.particles.burst(this.cx, this.cy, 30, { color: ['#ff9ec8', '#9fe0a8', '#fff'], speed: 420, life: 0.4, size: 2, shape: 'line', glow: true });
    }
    Game.hitstop(0.2); Game.cam.shake(9, 0.3); Game.flash('#ffffff', 0.25, true);
    Game.particles.burst(this.cx, this.cy, 26, { color: ['#0a0a12', '#1c1d33', '#fff'], speed: 320, life: 0.6, size: 5, drag: 0.9 });
    if (this.hp <= 0) { this.hp = 0; Game.playerDie(); }
    return true;
  }

  // ---------------- 绘制 ----------------
  draw(ctx) {
    const fx = Math.round(this.x + this.w / 2), fy = Math.round(this.y + this.h);
    if (this.state === 'dead') {
      const k = Math.min(1, this.deadT / 0.8);
      ctx.globalAlpha = 1 - k;
    } else if (this.invuln > 0 && Math.floor(this.invuln * 18) % 2 === 0) ctx.globalAlpha = 0.45;

    // 斩击特效（先画在身后层）
    ctx.save();
    ctx.translate(fx, fy);
    let sx = this.sqx, sy = this.sqy;
    if (this.state === 'sit') { sy *= 0.82; sx *= 1.08; }
    if (this.state === 'focus') { sy *= 0.94 + Math.sin(this.t * 18) * 0.02; }
    else if (this.onGround && Math.abs(this.vx) < 5 && this.state === 'normal') { sy *= 1 + Math.sin(this.t * 2.6) * 0.015; }
    ctx.scale(this.facing * sx, sy);

    const moving = this.onGround && Math.abs(this.vx) > 20 && this.state === 'normal';
    const bob = moving ? Math.abs(Math.sin(this.runPhase)) * 2 : 0;
    const air = !this.onGround && this.state !== 'sit';
    const lean = this.state === 'dash' ? 0.35 : moving ? 0.08 : air ? U.clamp(this.vy / 2000, -0.15, 0.15) : 0;
    ctx.rotate(lean);

    // 腿
    ctx.fillStyle = '#0d0e18';
    if (moving) {
      const p = Math.sin(this.runPhase);
      ctx.fillRect(-5 + p * 4, -6, 3.5, 6); ctx.fillRect(2 - p * 4, -6, 3.5, 6);
    } else if (air) {
      ctx.fillRect(-5, -8, 3.5, 6); ctx.fillRect(2, -9, 3.5, 6);
    } else {
      ctx.fillRect(-5, -6, 3.5, 6); ctx.fillRect(2, -6, 3.5, 6);
    }
    // 斗篷
    const wave = Math.sin(this.t * 6) * 1.2;
    const trail = U.clamp(Math.abs(this.vx) / P.RUN, 0, 1.5) * 5 + (air ? 3 : 0);
    ctx.fillStyle = '#242842';
    ctx.beginPath();
    ctx.moveTo(-4, -26 - bob);
    ctx.quadraticCurveTo(-12 - trail, -12 - bob, -11 - trail + wave, -3);
    ctx.lineTo(-6 - trail * 0.5, -5 + wave * 0.5);
    ctx.lineTo(-2, -3);
    ctx.lineTo(4, -4);
    ctx.lineTo(9, -3);
    ctx.quadraticCurveTo(10, -14 - bob, 5, -26 - bob);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#353b62';
    ctx.beginPath(); ctx.moveTo(4, -25 - bob); ctx.quadraticCurveTo(9, -14 - bob, 8.5, -4); ctx.lineTo(6, -4); ctx.quadraticCurveTo(6, -15 - bob, 2, -24 - bob); ctx.fill();

    // 兜帽
    const hy = -27 - bob;
    ctx.fillStyle = '#2b3052';
    ctx.beginPath(); ctx.moveTo(-9, hy - 2); ctx.quadraticCurveTo(-14 - trail * 0.6, hy - 9, -16 - trail, hy - 3 + wave); ctx.quadraticCurveTo(-10, hy + 1, -6, hy + 4); ctx.fill();
    ctx.beginPath(); ctx.arc(0, hy, 9.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f467a'; ctx.beginPath(); ctx.arc(1.5, hy - 1.5, 9, -1.4, 0.2); ctx.lineTo(1.5, hy - 1.5); ctx.fill();
    // 脸（深色）
    ctx.fillStyle = '#05060b';
    ctx.beginPath(); ctx.ellipse(3, hy + 1, 5.6, 6.2, 0, 0, Math.PI * 2); ctx.fill();
    // 眼
    if (this.blink > 0 || this.state === 'dead') {
      const eyeC = this.state === 'focus' ? '#fff3c8' : '#ffc96b';
      ctx.fillStyle = eyeC;
      ctx.beginPath(); ctx.ellipse(2, hy + 0.5, 1.3, 1.9, 0, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6, hy + 0.5, 1.3, 1.9, 0, 0, 6.28); ctx.fill();
    } else {
      ctx.fillStyle = '#ffc96b'; ctx.fillRect(0.8, hy + 0.5, 2.6, 0.8); ctx.fillRect(4.8, hy + 0.5, 2.6, 0.8);
    }
    // 提灯
    const ha = this.state === 'focus' ? -0.9 : this.lantA;
    const hx = 8, hyy = -14 - bob;
    ctx.save(); ctx.translate(hx, hyy); ctx.rotate(ha);
    ctx.strokeStyle = '#6b5a45'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 6); ctx.stroke();
    ctx.fillStyle = '#2a1f17'; ctx.fillRect(-3.5, 6, 7, 1.5); ctx.fillRect(-3.5, 14, 7, 1.5);
    const fl = 0.8 + Math.sin(this.t * 13) * 0.1 + Math.sin(this.t * 7.3) * 0.1;
    ctx.fillStyle = `rgba(255,${180 + fl * 40 | 0},90,1)`; ctx.fillRect(-2.6, 7.5, 5.2, 6.5);
    ctx.fillStyle = '#fff4d6'; ctx.fillRect(-1, 9, 2, 3.5 * fl);
    ctx.restore();
    // 手臂与刀
    ctx.fillStyle = '#1d2036'; ctx.beginPath(); ctx.ellipse(6, -15 - bob, 3, 2.2, 0.4, 0, 6.28); ctx.fill();
    if (this.attackT > 0) {
      const k = 1 - this.attackT / P.ATK_T, sw = U.easeOut(Math.min(1, k * 3));
      let a0, a1;
      if (this.attackDir === 'up') { a0 = -0.3; a1 = -1.9; }
      else if (this.attackDir === 'down') { a0 = 0.6; a1 = 1.9; }
      else { a0 = -1.3; a1 = 0.5; }
      const ang = a0 + (a1 - a0) * sw;
      ctx.save(); ctx.translate(7, -15 - bob); ctx.rotate(ang);
      ctx.fillStyle = '#1d2036'; ctx.fillRect(0, -1.5, 7, 3);
      ctx.fillStyle = '#5a4a3a'; ctx.fillRect(6, -2, 3, 4);
      ctx.fillStyle = '#e8e2d6'; ctx.beginPath(); ctx.moveTo(9, -1.6); ctx.lineTo(24, -0.6); ctx.lineTo(27, 0); ctx.lineTo(24, 0.8); ctx.lineTo(9, 1.6); ctx.fill();
      ctx.restore();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
    this.drawSlash(ctx);
  }
  lanternPos() {
    const bob = 0;
    const a = this.lantA, lx = 8 * this.facing - Math.sin(a) * 10 * this.facing, ly = -14 - bob + Math.cos(a) * 10;
    return [this.x + this.w / 2 + lx, this.y + this.h + ly];
  }
  drawSlash(ctx) {
    if (this.attackT <= 0) return;
    const k = 1 - this.attackT / P.ATK_T; // 0→1
    if (k > 0.75) return;
    const a = 1 - k / 0.75;
    const cx = this.cx, cy = this.cy;
    let base = 0;
    if (this.attackDir === 'up') base = -Math.PI / 2;
    else if (this.attackDir === 'down') base = Math.PI / 2;
    else base = this.facing > 0 ? 0 : Math.PI;
    const sweep = 1.25, prog = U.easeOut(Math.min(1, k * 3));
    const flip = this.attackDir === 'side' ? this.facing : 1;
    const a0 = base - sweep * flip, a1 = base - sweep * flip + sweep * 2 * flip * prog;
    const ox = this.attackDir === 'side' ? this.facing * 6 : 0, oy = this.attackDir === 'up' ? -10 : this.attackDir === 'down' ? 12 : 0;
    const R = (this.attackDir === 'side' ? 50 : 46) * (Game.hasCharm('longedge') ? 1.3 : 1);
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = i === 3 ? `rgba(255,255,255,${a})` : `rgba(255,${210 + i * 15},${150 + i * 30},${a * (0.25 + i * 0.15)})`;
      ctx.lineWidth = [14, 9, 5, 2.5][i];
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, R - i * 1.5, Math.min(a0, a1), Math.max(a0, a1));
      ctx.stroke();
    }
    ctx.restore();
  }
}
