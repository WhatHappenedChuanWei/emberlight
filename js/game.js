'use strict';
// ============================================================
//  游戏主体：状态、房间、存档、流程
// ============================================================
const SAVE_KEY = 'emberlight_save_v1';
const SETTINGS_KEY = 'emberlight_settings_v1';

function newSave() {
  return {
    v: 1, room: 'A1', bench: null, maxHp: 5, hp: 5, soul: 0, amber: 0, blade: 1,
    abilities: { dash: false, claw: false, wings: false, spell: false },
    got: {}, broken: {}, bosses: { rust: false, mother: false, kiln: false, moss: false }, visited: {}, lost: null,
    flags: {}, shop: {}, time: 0, deaths: 0, cleared: false, difficulty: 'normal', kills: {},
    charms: { owned: {}, equipped: [] }, notches: 3, benches: {},
  };
}

const Game = {
  state: 'title', save: null, room: null, player: null,
  enemies: [], objects: [], projectiles: [], ambers: [], spells: [], platforms: [], particles: new Particles(), cam: new Camera(),
  boss: null, stopT: 0, slowT: 0, time: 0, inputLocked: false,
  trans: null, hazard: null, death: null, fadeA: 0, flashC: null, flashA: 0, flashMax: 1,
  toasts: [], areaCard: null, popup: null, dialog: null, shop: null, interactTarget: null,
  bossCard: null, ending: null, lastArea: null, amberShow: 0, amberPulse: 0, debug: false,

  init() {
    this.player = new Player();
    Light.init();
    this.loadSettings();
    UI.init();
    this.toTitle();
  },
  // ---------------- 存档 ----------------
  hasSave() { return !!this.readSave(); },
  slot: 0, opts: { shake: true, timer: false },
  slotKey(n = this.slot) { return n ? `${SAVE_KEY}_s${n}` : SAVE_KEY; },
  deleteSlot(n) { try { localStorage.removeItem(this.slotKey(n)); } catch (e) { } },
  readSave(slot = this.slot) {
    try {
      const s = JSON.parse(localStorage.getItem(this.slotKey(slot)));
      if (!s || s.v !== 1) return null;
      const base = newSave();
      for (const k in base) if (s[k] === undefined || s[k] === null) s[k] = base[k];
      for (const k of ['abilities', 'bosses', 'got', 'broken', 'visited', 'flags', 'shop', 'benches', 'kills']) if (!s[k] || typeof s[k] !== 'object') s[k] = base[k];
      for (const k in base.abilities) if (s.abilities[k] === undefined) s.abilities[k] = false;
      for (const k in base.bosses) if (s.bosses[k] === undefined) s.bosses[k] = false;
      if (!s.charms || typeof s.charms !== 'object' || !s.charms.owned) s.charms = { owned: {}, equipped: [] };
      if (!Array.isArray(s.charms.equipped)) s.charms.equipped = [];
      const BC = { rust: 'Rustwarden', kiln: 'KilnWarden', moss: 'MossMother', mother: 'Matriarch' };
      for (const id in BC) if (s.bosses[id] && !s.kills[BC[id]]) s.kills[BC[id]] = 1;
      s.charms.equipped = s.charms.equipped.filter((id, i, a) => CHARMS[id] && s.charms.owned[id] && a.indexOf(id) === i);
      while (s.charms.equipped.reduce((t, id) => t + CHARMS[id].cost, 0) > s.notches) s.charms.equipped.pop();
      if (s.bench && s.bench.room && !s.benches[s.bench.room]) s.benches[s.bench.room] = { x: s.bench.x, y: s.bench.y };
      if (s.bench && !ROOM_BY_ID[s.bench.room]) s.bench = null;
      if (!ROOM_BY_ID[s.room]) s.room = 'A1';
      return s;
    } catch (e) { return null; }
  },
  writeSave() {
    if (!this.save) return;
    try { localStorage.setItem(this.slotKey(), JSON.stringify(this.save)); } catch (e) { /* 隐私模式等情况下无法存档 */ }
  },
  loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (s) { Sfx.musicVolume = s.music ?? Sfx.musicVolume; Sfx.sfxVolume = s.sfx ?? Sfx.sfxVolume; this.slot = U.clamp(s.slot | 0, 0, 2); this.opts.shake = s.shake ?? true; this.opts.timer = !!s.timer; }
    } catch (e) { }
  },
  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ music: Sfx.musicVolume, sfx: Sfx.sfxVolume, slot: this.slot, shake: this.opts.shake, timer: this.opts.timer })); } catch (e) { }
    Sfx.setVolumes();
  },

  // ---------------- 流程 ----------------
  toTitle() {
    this.state = 'title'; this.room = null; this.trans = this.hazard = this.death = null;
    this.popup = this.dialog = this.shop = this.ending = this.travel = this.trial = null; this.fadeA = 0; this.inputLocked = false; this.timers = [];
    UI.openTitle();
    Music.play('title');
  },
  startGame(fresh, difficulty) {
    this.save = fresh ? newSave() : (this.readSave() || newSave());
    if (fresh && difficulty) this.save.difficulty = difficulty;
    this.trial = null; this.timers = [];
    this.particles.clear(); this.toasts = []; this.lastArea = null;
    this.player.reset();
    const S = this.save;
    if (S.hp <= 0) S.hp = this.maxHp();
    if (S.bench) {
      this.loadRoom(S.bench.room);
      this.player.x = S.bench.x; this.player.y = S.bench.y; this.player.state = 'sit';
    } else {
      this.loadRoom('A1');
      const sp = this.room.spawns.find(s => s.ch === 'P');
      this.player.x = sp.tx * TILE + 8; this.player.y = (sp.ty + 1) * TILE - this.player.h;
      if (fresh) this.player.state = 'sit';
    }
    S.hp = this.maxHp();
    this.cam.follow(this.player.cx, this.player.cy, this.room, 0, true);
    this.state = 'play'; this.fadeA = 1; this.fadeTarget = 0;
    if (fresh) { this.state = 'intro'; this.intro = { t: 0 }; Music.play('title'); this.writeSave(); }
  },

  loadRoom(id) {
    const def = ROOM_BY_ID[id], S = this.save;
    const room = new Room(def);
    // 已破坏的墙
    for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
      const tt = room.tileRaw(x, y);
      if ((tt === T_BREAK || tt === T_SEAL) && S.broken[`${id}:${x},${y}`]) room.setTile(x, y, T_EMPTY);
      if (tt === T_LGATE && S.flags['lever_' + id]) room.setTile(x, y, T_EMPTY);
    }
    this.room = room;
    this.enemies = []; this.objects = []; this.projectiles = []; this.ambers = []; this.spells = []; this.platforms = []; this.boss = null;
    this.player.ride = null;
    this.particles.clear();
    for (const s of room.spawns) {
      const fx = s.tx * TILE + TILE / 2, fy = (s.ty + 1) * TILE;
      const key = `${id}:${s.ch}${s.tx},${s.ty}`;
      switch (s.ch) {
        case 'B': this.objects.push(new Bench(s.tx, s.ty)); break;
        case 'N': this.objects.push(new NPC(s.tx, s.ty, def.npc)); break;
        case 'S': this.objects.push(new Merchant(s.tx, s.ty)); break;
        case '$': if (!S.got[key]) this.objects.push(new AmberRock(s.tx, s.ty, key)); break;
        case 'H': if (!S.got[key]) this.objects.push(new Pickup(s.tx, s.ty, 'heart', key)); break;
        case 'A': if (!S.abilities[def.ability]) this.objects.push(new Pickup(s.tx, s.ty, 'ability', key, def.ability)); break;
        case 'K':
          if (!S.bosses[def.boss]) { this.boss = this.toughen(new BOSS_TYPES[def.boss](fx, fy)); this.enemies.push(this.boss); }
          break;
        case 'P': break;
        case 'T': this.objects.push(new Tablet(s.tx, s.ty, def.tablet)); break;
        case 'L': this.objects.push(new Lever(s.tx, s.ty, 'lever_' + id)); break;
        case '-': this.platforms.push(new Platform(s.tx * TILE, s.ty * TILE, TILE, 'crumble')); break;
        case 'M': this.platforms.push(new Platform(s.tx * TILE, s.ty * TILE, TILE * 3, 'move', (def.movers || {})[s.tx + ',' + s.ty])); break;
        case 'U': if (!S.got[key]) this.objects.push(new Pickup(s.tx, s.ty, 'notch', key)); break;
        case 'Q': if (!S.got[key]) this.objects.push(new Pickup(s.tx, s.ty, 'spore', key)); break;
        case 'C': if (!S.charms.owned[def.charm]) this.objects.push(new Pickup(s.tx, s.ty, 'charm', key, def.charm)); break;
        default: {
          const E = ENEMY_TYPES[s.ch];
          if (E) this.enemies.push(new E(fx, fy));
        }
      }
    }
    if (S.lost && S.lost.room === id) this.objects.push(new Shade(S.lost.x, S.lost.y, S.lost.amount));
    if (!def.hidden) { S.visited[id] = 1; S.room = id; }
    this.bossCard = null; this.gateAnim = 0;
    RoomArt.get(room);
    // 区域标题 & 音乐
    if (this.lastArea !== room.area) {
      this.lastArea = room.area;
      this.areaCard = { name: room.A.name, sub: room.A.sub, t: 0 };
    }
    if (!this.boss || this.boss.mode === 'sleep') Music.play(room.A.music);
    // 环境飘尘
    this.moteT = 0;
  },

  // ---------------- 主更新 ----------------
  update(dt) {
    this.time += dt;
    Music.update(dt);
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt * 2.2);
    UI.update(dt);
    if (this.state === 'title') return;
    if (this.state === 'ending') { this.updateEnding(dt); return; }
    if (this.state === 'intro') {
      this.intro.t += dt;
      if ((this.intro.t > 0.6 && (Input.pressed('confirm') || Input.pressed('attack') || Input.pressed('pause'))) || this.intro.t > 15) {
        this.state = 'play'; this.intro = null; this.fadeA = 1; this.fadeTarget = 0; this.fadeSpeed = 1.2;
        Music.play(this.room.A.music); this.areaCard = { name: this.room.A.name, sub: this.room.A.sub, t: 0 };
        this.toast('按 ← → 移动，Z / K 跳跃，X / J 挥刀', 6);
      }
      return;
    }
    if (this.state !== 'play') { this.updateFade(dt); return; }

    const canMenu = !UI.hadMenu && !this.trans && !this.death && !this.dialog && !this.travel;
    if (Input.pressed('pause') && canMenu) { UI.openPause(); return; }
    if (Input.pressed('map') && canMenu && !this.popup) { UI.openMap(); return; }

    if (this.popup) { this.updatePopup(dt); this.updateFade(dt); return; }

    this.save.time += dt;
    this.tickTimers(dt);
    this.hints();
    this.updateFade(dt);
    // Boss 一进入死亡动画就记录击败、清除弹幕并保护玩家（在命中停顿之前处理）
    const bb = this.boss;
    if (bb && !bb.dead && bb.mode === 'dying') {
      if (!this.trial && !this.save.bosses[bb.bossId]) { this.recordBossKill(bb.bossId); this.projectiles.forEach(p => p.pop()); }
      this.player.invuln = Math.max(this.player.invuln, 0.3);
    }
    if (this.stopT > 0) { this.stopT -= dt; return; }
    let sdt = dt;
    if (this.slowT > 0) { this.slowT -= dt; sdt = dt * 0.35; }

    this.inputLocked = !!(this.trans || this.hazard || this.death || this.dialog || this.travel);
    if (this.travel) this.updateTravel(dt);
    if (this.sitGuard > 0) this.sitGuard -= dt;
    // 坐在灯座上：↑ 打开传送
    if (!this.inputLocked && this.player.state === 'sit' && Input.pressed('up') && Object.keys(this.save.benches).length >= 2) { this.dialog = true; UI.openTravel(() => { this.dialog = null; }); }
    if (this.trans) { this.updateTransition(dt); if (this.trans && this.trans.phase === 'out') return; }
    if (this.hazard) { this.updateHazard(dt); }
    if (this.death) { this.updateDeath(dt); }

    const p = this.player;
    for (const pl of this.platforms) pl.update(sdt);
    if (!(this.hazard && this.hazard.phase !== 'in')) p.update(sdt);
    if (!this.trans) this.checkExit();

    for (const e of this.enemies) if (!e.dead) e.update(sdt);
    for (const pr of this.projectiles) if (!pr.dead) pr.update(sdt);
    for (const a of this.ambers) if (!a.dead) a.update(sdt);
    for (const sp of this.spells) if (!sp.dead) sp.update(sdt);
    this.spells = this.spells.filter(e => !e.dead);
    for (const o of this.objects) if (!o.dead) o.update(sdt);
    for (const e of this.enemies) if (e.dead && !e.counted) { e.counted = true; const K = this.save.kills || (this.save.kills = {}); const k = e.constructor.name; K[k] = (K[k] || 0) + 1; }
    this.enemies = this.enemies.filter(e => !e.dead);
    this.projectiles = this.projectiles.filter(e => !e.dead);
    this.ambers = this.ambers.filter(e => !e.dead);
    this.objects = this.objects.filter(e => !e.dead);
    this.particles.update(sdt);

    this.combat();
    this.bossLogic(dt);
    this.updateInteract();
    this.updateAmbient(sdt);

    // 相机：带前视
    const look = p.state === 'sit' ? 0 : p.facing * 60;
    let lookY = 0;
    if (p.onGround && p.state === 'normal' && Math.abs(p.vx) < 5) {
      if (Input.down('up') && !this.interactTarget) this.lookHold = (this.lookHold || 0) + dt; else if (Input.down('down')) this.lookHold = (this.lookHold || 0) - dt; else this.lookHold = 0;
      if (this.lookHold > 0.45) lookY = -150; else if (this.lookHold < -0.45) lookY = 150;
    } else this.lookHold = 0;
    this.camLook = U.lerp(this.camLook || 0, look, dt * 2.5);
    this.camLookY = U.lerp(this.camLookY || 0, lookY, dt * 4);
    this.cam.follow(p.cx + this.camLook, p.cy - 20 + this.camLookY, this.room, dt);
    this.cam.update(dt);

    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter(t => t.t < t.dur);
    if (this.areaCard) { this.areaCard.t += dt; if (this.areaCard.t > 4.2) this.areaCard = null; }
    if (this.bossCard) { this.bossCard.t += dt; if (this.bossCard.t > 3.5) this.bossCard = null; }
    this.amberShow = U.approach(this.amberShow, this.save.amber, Math.max(1, Math.abs(this.save.amber - this.amberShow) * dt * 6));
    if (this.amberPulse > 0) this.amberPulse -= dt;
  },
  updateFade(dt) {
    if (this.fadeTarget !== undefined && this.fadeA !== this.fadeTarget) this.fadeA = U.approach(this.fadeA, this.fadeTarget, dt * (this.fadeSpeed || 3));
  },
  fadeTo(a, speed) { this.fadeTarget = a; this.fadeSpeed = speed || 3; },

  // ---------------- 战斗判定 ----------------
  combat() {
    const p = this.player;
    if (p.state === 'dead') return;
    const pb = { x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 4 };
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.touch && U.overlap(e.touchBox(), pb)) { p.hurt(e.touch, e.cx); }
      const ex = e.extraHits && e.extraHits();
      if (ex) for (const b of ex) if (U.overlap(b, pb)) p.hurt(1, e.cx);
    }
    for (const pr of this.projectiles) {
      if (pr.dead || pr.delay > 0) continue;
      if (U.overlap(pr.hitBox(), pb)) { if (p.hurt(pr.dmg, pr.x) && pr.kind !== 'wave' && pr.kind !== 'pillar' && pr.kind !== 'blast') pr.pop(); }
    }
  },
  bossLogic(dt) {
    const b = this.boss, room = this.room;
    if (!b || b.dead) return;
    if (b.mode === 'dying') return;
    if (b.mode === 'sleep' && !this.trial) {
      // 找闸门位置
      let gx = null;
      for (let x = 0; x < room.w && gx === null; x++) for (let y = 0; y < room.h; y++) if (room.tileRaw(x, y) === T_GATE) { gx = (x + 0.5) * TILE; break; }
      const p = this.player;
      if (gx !== null && Math.abs(p.cx - gx) > 5 * TILE && p.state !== 'dead') {
        room.gateClosed = true; Sfx.play('gate'); this.cam.shake(5, 0.4);
        b.wake(); Music.play('boss');
        const info = BOSS_INFO[b.bossId];
        this.bossCard = { name: info.name, title: info.title, t: 0 };
        for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) if (room.tileRaw(x, y) === T_GATE)
          this.particles.burst((x + 0.5) * TILE, (y + 0.5) * TILE, 4, { color: ['#776', '#aa9'], speed: 120, life: 0.5, size: 3, grav: 400 });
      }
    }
  },
  recordBossKill(id) {
    const S = this.save, info = BOSS_INFO[id];
    if (S.bosses[id]) return;
    S.bosses[id] = true;
    if (info.reward) S.abilities[info.reward] = true;
    if (info.charm) S.charms.owned[info.charm] = 1;
    if (id === 'mother') S.cleared = true;
    this.writeSave();
  },
  // ---------------- 钟声试炼 ----------------
  startTrial() {
    const S = this.save, p = this.player;
    this.trial = { i: 0, list: ['rust', 'kiln', 'moss', 'mother'] };
    Sfx.play('bench'); this.fadeA = 1; this.fadeTarget = 0; this.fadeSpeed = 1.5;
    this.loadRoom('R1'); p.reset(); p.x = 6 * TILE; p.y = 14 * TILE - p.h; p.facing = 1;
    S.hp = this.maxHp(); this.cam.follow(p.cx, p.cy, this.room, 0, true);
    this.areaCard = { name: '钟 声 试 炼', sub: 'Trial of Echoes', t: 0 };
    Music.play('none');
    this.trialNext(2.5);
  },
  trialNext(delay) {
    this.after(delay, () => {
      if (!this.trial || this.room.id !== 'R1') return;
      const id = this.trial.list[this.trial.i];
      const b = this.toughen(new BOSS_TYPES[id](this.room.pw * 0.68, 14 * TILE));
      this.enemies.push(b); this.boss = b; b.wake(); Music.play('boss');
      const info = BOSS_INFO[id]; this.bossCard = { name: `回响 ${this.trial.i + 1} / 4 · ${info.name}`, title: info.title, t: 0 };
    });
  },
  onBossDefeated(id) {
    const S = this.save;
    if (this.trial) {
      this.projectiles.forEach(p => p.pop()); this.enemies.forEach(e => { if (!e.isBoss) e.die(); });
      this.trial.i++; S.hp = Math.min(this.maxHp(), S.hp + 2); Music.play('none');
      if (this.trial.i < this.trial.list.length) { this.toast('回声平息了……下一个回声正在逼近。', 2.5); this.trialNext(3); }
      else {
        const first = !S.flags.trialDone; S.flags.trialDone = 1;
        if (first) S.amber += 400;
        this.after(2.5, () => {
          this.popup = { kind: 'charm', title: '钟声试炼', desc: '四位强敌的回声都已平息。钟楼又一次响起了清亮的钟声。', keys: first ? '获得 400 琥珀' : '再次完成试炼', color: '#f2c27b', t: 0 };
          Sfx.play('item'); this.writeSave();
        });
        this.after(4, () => {
          this.trial = null;
          if (S.bench && S.benches[S.bench.room]) this.travelTo(S.bench.room);
          else { S.benches.B5 = S.benches.B5 || { x: 10 * TILE + 16 - 24 + 24 - 9, y: 15 * TILE - 30 }; this.travelTo('B5'); }
        });
      }
      return;
    }
    this.recordBossKill(id);
    this.room.gateClosed = false; Sfx.play('gate');
    this.projectiles.forEach(p => p.pop());
    this.enemies.forEach(e => { if (!e.isBoss) e.die(); });
    Music.play('none');
    const info = BOSS_INFO[id];
    this.writeSave();
    if (id === 'mother') {
      S.cleared = true; this.writeSave();
      this.after(3.2, () => this.startEnding());
    } else {
      this.after(2.0, () => { Music.play(this.room.A.music); if (info.reward) this.gainAbility(info.reward); if (info.charm) this.gainCharm(info.charm); });
    }
  },
  timers: [],
  after(t, fn) { this.timers.push({ t, fn }); },
  tickTimers(dt) {
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.done) { tm.done = true; tm.fn(); } }
    this.timers = this.timers.filter(t => !t.done);
  },

  updateInteract() {
    const p = this.player;
    this.interactTarget = null;
    if (p.state !== 'normal' || !p.onGround || this.inputLocked) return;
    let best = null, bd = 1e9;
    for (const o of this.objects) {
      if (!o.interact || o.dead) continue;
      const dx = Math.abs(o.cx - p.cx), dy = Math.abs((o.y + o.h) - (p.y + p.h));
      if (dx < o.w / 2 + 22 && dy < 40 && dx < bd) { best = o; bd = dx; }
    }
    this.interactTarget = best;
    if (best && Input.pressed('up')) { best.interact(); this.interactTarget = null; }
  },
  updateAmbient(dt) {
    const A = this.room.A;
    this.moteT = (this.moteT || 0) - dt;
    if (this.moteT <= 0) {
      this.moteT = 0.08;
      this.particles.add({
        x: this.cam.x + U.rand(-50, VW + 50), y: this.cam.y + U.rand(0, VH + 50), vx: U.rand(-12, 12), vy: U.rand(-25, -5),
        life: U.rand(3, 6), size: U.rand(0.8, 2), color: A.mote, glow: true, drag: 1, shrink: false, alpha: U.rand(0.3, 0.8),
      });
      if (this.room.area === 'moss' && Math.random() < 0.15) {
        this.particles.add({ x: this.cam.x + U.rand(0, VW), y: this.cam.y - 10, vx: U.rand(10, 40), vy: U.rand(20, 50), life: 8, size: 2.5, color: '#3f7a52', shape: 'leaf', vr: U.rand(-2, 2), drag: 1, shrink: false });
      }
    }
  },

  // ---------------- 房间切换 ----------------
  checkExit() {
    const p = this.player, r = this.room;
    const cx = p.cx, cy = p.cy;
    if (cx >= 0 && cx < r.pw && cy >= 0 && cy < r.ph) return;
    if (p.state === 'dead') return;
    const gx = r.gx * TILE + cx, gy = r.gy * TILE + cy;
    const def = roomAtGlobal(gx, gy);
    if (!def) { p.x = U.clamp(p.x, 0, r.pw - p.w); p.y = U.clamp(p.y, 0, r.ph - p.h); return; }
    const dir = cx < 0 ? 'L' : cx >= r.pw ? 'R' : cy < 0 ? 'U' : 'D';
    this.trans = { phase: 'out', t: 0, id: def.id, gx, gy, dir, vx: p.vx, vy: p.vy, state: p.state };
  },
  updateTransition(dt) {
    const T = this.trans, p = this.player;
    T.t += dt;
    if (T.phase === 'out') {
      this.fadeA = Math.min(1, T.t / 0.16); this.fadeTarget = this.fadeA;
      if (T.t >= 0.16) {
        this.loadRoom(T.id);
        const r = this.room;
        p.x = T.gx - r.gx * TILE - p.w / 2; p.y = T.gy - r.gy * TILE - p.h / 2;
        p.x = U.clamp(p.x, 1, r.pw - p.w - 1); p.y = U.clamp(p.y, 1, r.ph - p.h - 1);
        if (T.dir === 'L') { p.x = r.pw - p.w - 4; p.vx = Math.min(-P.RUN, T.vx); }
        if (T.dir === 'R') { p.x = 4; p.vx = Math.max(P.RUN, T.vx); }
        if (T.dir === 'U') { p.y = r.ph - p.h - 4; p.vy = Math.min(T.vy, -760); p.jumping = false; }
        if (T.dir === 'D') { p.y = 4; p.vy = Math.max(T.vy, 100); }
        if (p.state === 'dash') p.state = 'normal';
        this.cam.follow(p.cx + (this.camLook || 0), p.cy - 20, r, 0, true);
        p.lastSafe = null;
        T.phase = 'in'; T.t = 0; T.lockT = (T.dir === 'L' || T.dir === 'R') ? 0.18 : 0.05;
      }
    } else {
      this.fadeA = Math.max(0, 1 - T.t / 0.22); this.fadeTarget = this.fadeA;
      if (T.dir === 'L' || T.dir === 'R') { if (T.t < T.lockT) p.vx = (T.dir === 'R' ? 1 : -1) * P.RUN; }
      if (T.t >= Math.max(0.22, T.lockT)) { this.trans = null; this.fadeA = 0; this.fadeTarget = 0; }
    }
  },

  // ---------------- 尖刺：扣血并回到安全点 ----------------
  hazardHit() {
    if (this.hazard || this.trans) return;
    const p = this.player;
    if (p.state === 'dead') return;
    p.invuln = 0;
    p.hurt(1, p.cx);
    if (p.state === 'dead') return;
    this.hazard = { phase: 'out', t: 0 };
  },
  updateHazard(dt) {
    const H = this.hazard, p = this.player;
    H.t += dt;
    if (H.phase === 'out') {
      p.vx *= 0.8; p.vy = Math.min(p.vy, 0);
      if (H.t > 0.25) { this.fadeA = Math.min(1, (H.t - 0.25) / 0.25); this.fadeTarget = this.fadeA; }
      if (H.t >= 0.5) {
        const safe = p.lastSafe || this.findSafeSpot();
        p.x = safe.x; p.y = safe.y; p.vx = p.vy = 0; p.state = 'normal'; p.hurtT = 0; p.ride = null;
        this.cam.follow(p.cx, p.cy - 20, this.room, 0, true);
        H.phase = 'in'; H.t = 0;
      }
    } else {
      this.fadeA = Math.max(0, 1 - H.t / 0.3); this.fadeTarget = this.fadeA;
      if (H.t >= 0.3) { this.hazard = null; this.fadeA = 0; }
    }
  },
  findSafeSpot() {
    // 回退：找房间里最近的可站立地面
    const r = this.room, p = this.player;
    let best = null, bd = 1e9;
    for (let y = 1; y < r.h; y++) for (let x = 1; x < r.w - 1; x++) {
      const t = r.tile(x, y), above = r.tile(x, y - 1);
      if ((r.isSolid(x, y) || t === T_ONEWAY) && above === T_EMPTY && r.tile(x, y - 2) !== T_SOLID && r.tile(x - 1, y - 1) !== T_SPIKE && r.tile(x + 1, y - 1) !== T_SPIKE) {
        const sx = x * TILE + 7, sy = y * TILE - p.h, d = U.dist(sx, sy, p.x, p.y);
        if (d < bd) { bd = d; best = { x: sx, y: sy }; }
      }
    }
    return best || { x: p.x, y: p.y };
  },

  // ---------------- 死亡 ----------------
  playerDie() {
    const p = this.player, S = this.save;
    p.state = 'dead'; p.deadT = 0; p.vx = 0; p.vy = 0;
    Sfx.play('death'); this.slowmo(0.8); this.cam.shake(10, 0.6);
    this.particles.burst(p.cx, p.cy, 50, { color: ['#0a0a12', '#2b3052', '#ffc96b'], speed: 380, life: 1.2, size: 5, drag: 0.93 });
    const spot = p.lastSafe || this.findSafeSpot();
    this.death = { t: 0, room: this.room.id, x: spot.x + p.w / 2, y: spot.y + p.h };
    this.hazard = null;
    Music.play('none');
  },
  updateDeath(dt) {
    const D = this.death, S = this.save, p = this.player;
    D.t += dt;
    if (D.t > 1.4 && D.t < 2.2) { this.fadeA = Math.min(1, (D.t - 1.4) / 0.6); this.fadeTarget = this.fadeA; }
    if (D.t >= 2.2 && !D.done) {
      D.done = true;
      S.deaths++;
      if (this.trial) { this.trial = null; this.timers = []; }
      else { if (S.amber > 0) S.lost = { room: D.room, x: D.x, y: D.y, amount: S.amber }; S.amber = 0; this.amberShow = 0; }
      S.hp = this.maxHp(); S.soul = 0;
      p.reset();
      if (S.bench) {
        this.loadRoom(S.bench.room);
        p.x = S.bench.x; p.y = S.bench.y;
      } else {
        this.loadRoom('A1');
        const sp = this.room.spawns.find(s => s.ch === 'P');
        p.x = sp.tx * TILE + 8; p.y = (sp.ty + 1) * TILE - p.h;
      }
      p.state = 'sit';
      this.cam.follow(p.cx, p.cy - 20, this.room, 0, true);
      this.writeSave();
    }
    if (D.t >= 2.4) { this.fadeA = Math.max(0, 1 - (D.t - 2.4) / 0.6); this.fadeTarget = this.fadeA; }
    if (D.t >= 3.0) { this.death = null; this.fadeA = 0; if (S.lost) this.toast('你的琥珀遗落在了倒下的地方……', 4); }
  },

  // ---------------- 交互 ----------------
  restAtBench(b) {
    const p = this.player, S = this.save;
    p.state = 'sit'; p.vx = 0; p.vy = 0;
    p.x = b.cx - p.w / 2; p.y = b.y + b.h - p.h;
    const first = !(S.bench && S.bench.room === this.room.id);
    S.bench = { room: this.room.id, x: p.x, y: p.y };
    S.benches[this.room.id] = { x: p.x, y: p.y };
    S.hp = this.maxHp();
    Sfx.play('bench');
    this.particles.burst(b.cx, b.y + 8, 30, { color: ['#ffcf80', '#fff', '#ffa040'], speed: 180, life: 0.9, size: 2.5, glow: true });
    this.toast(first ? '灯座记住了你的火。' : '已休息，生命完全恢复。', 3);
    this.writeSave();
  },
  startDialog(name, lines, then) { this.dialog = true; UI.openDialog(name, lines, () => { this.dialog = null; if (then) then(); }); },
  openShop() { this.dialog = true; UI.openShop(() => { this.dialog = null; }); },
  gainAbility(id) {
    const S = this.save; S.abilities[id] = true;
    const info = ABILITY_INFO[id];
    this.popup = { kind: 'ability', title: info.name, desc: info.desc, keys: info.keys, color: info.color, t: 0 };
    Sfx.play('item'); this.flash(info.color, 0.5);
    this.particles.burst(this.player.cx, this.player.cy, 60, { color: [info.color, '#fff'], speed: 400, life: 1, size: 3, glow: true });
    this.writeSave();
  },
  gainHeart(title, desc) {
    const S = this.save; S.maxHp++; S.hp = this.maxHp();
    this.popup = { kind: 'heart', title, desc, keys: `生命上限：${this.maxHp()}`, color: '#ff9a8a', t: 0 };
    Sfx.play('item'); this.flash('#ff9a8a', 0.4);
    this.writeSave();
  },
  gainCharm(id) {
    const S = this.save, c = CHARMS[id]; S.charms.owned[id] = 1;
    this.popup = { kind: 'charm', title: c.name, desc: c.desc, keys: `占用 ${c.cost} 槽 · 在灯座旁打开暂停菜单 →「灯饰」装备`, color: c.color, t: 0 };
    Sfx.play('item'); this.flash(c.color, 0.35);
    this.writeSave();
  },
  gainNotch() {
    const S = this.save; S.notches++;
    this.popup = { kind: 'charm', title: '灯饰槽', desc: '一枚封在冰里的旧灯扣。可装备的灯饰槽位 +1。', keys: `灯饰槽：${S.notches}`, color: '#bfe8ff', t: 0 };
    Sfx.play('item'); this.flash('#bfe8ff', 0.35); this.writeSave();
  },
  sporeCount() { return Object.keys(this.save.got).filter(k => /:Q\d/.test(k)).length; },
  hasCharm(id) { return !!(this.save && this.save.charms.equipped.includes(id)); },
  maxHp() { const S = this.save; return S.maxHp + (this.hasCharm('emberheart') ? 2 : 0) + (S.difficulty === 'easy' ? 3 : 0); },
  get hard() { return !!(this.save && this.save.difficulty === 'hard'); },
  toughen(b) { if (this.hard && b && !b.toughened) { b.toughened = true; b.hp = b.maxHp = Math.round(b.maxHp * 1.3); } return b; },
  notchesUsed() { return this.save.charms.equipped.reduce((a, id) => a + CHARMS[id].cost, 0); },
  toggleCharm(id) {
    const S = this.save, eq = S.charms.equipped, i = eq.indexOf(id);
    if (i >= 0) { eq.splice(i, 1); S.hp = Math.min(S.hp, this.maxHp()); Sfx.play('menu'); return 'off'; }
    if (this.notchesUsed() + CHARMS[id].cost > S.notches) { Sfx.play('deny'); return 'full'; }
    eq.push(id); if (id === 'emberheart') S.hp = this.maxHp(); Sfx.play('select'); return 'on';
  },
  openLeverGates(roomId) {
    const room = this.room; let any = false;
    if (roomId && room.id !== roomId) return;
    for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) if (room.tileRaw(x, y) === T_LGATE) {
      room.setTile(x, y, T_EMPTY); any = true;
      this.particles.burst((x + 0.5) * TILE, (y + 0.5) * TILE, 8, { color: ['#7a7280', '#aaa'], speed: 160, life: 0.6, size: 3, grav: 600, shape: 'rect' });
    }
    if (any) { Sfx.play('gate'); this.cam.shake(5, 0.4); this.toast('铁栅升起了——一条捷径打通了。', 3); }
  },
  // ---------------- 灯座传送 ----------------
  travelTo(id) {
    const b = this.save.benches[id]; if (!b) return;
    this.travel = { t: 0, id, done: false }; Sfx.play('bench');
  },
  updateTravel(dt) {
    const T = this.travel, p = this.player, S = this.save; T.t += dt;
    if (T.t < 0.5) { this.fadeA = T.t / 0.5; this.fadeTarget = this.fadeA; }
    else if (!T.done) {
      T.done = true;
      this.loadRoom(T.id); const b = S.benches[T.id];
      p.reset(); p.x = b.x; p.y = b.y; p.state = 'sit';
      S.bench = { room: T.id, x: b.x, y: b.y }; S.hp = this.maxHp();
      this.cam.follow(p.cx, p.cy - 20, this.room, 0, true); this.writeSave();
    } else {
      this.fadeA = Math.max(0, 1 - (T.t - 0.5) / 0.5); this.fadeTarget = this.fadeA;
      if (T.t >= 1.0) { this.travel = null; this.fadeA = 0; }
    }
  },
  updatePopup(dt) {
    this.popup.t += dt;
    if (this.popup.t > 1.2 && (Input.pressed('confirm') || Input.pressed('attack') || Input.pressed('back'))) { this.popup = null; Sfx.play('select'); }
  },

  // ---------------- 破坏墙 ----------------
  hitBreakable(tx, ty) {
    const room = this.room, group = room.breakGroup(tx, ty);
    if (!group.length) return;
    group.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const k = group[0].join(',');
    room.breakHits[k] = (room.breakHits[k] || 0) + 1;
    Sfx.play('rock'); this.cam.shake(3, 0.12); this.hitstop(0.03);
    this.particles.burst((tx + 0.5) * TILE, (ty + 0.5) * TILE, 10, { color: [room.A.tile, room.A.edge, '#888'], speed: 220, life: 0.6, size: 4, grav: 700, shape: 'rect' });
    if (room.breakHits[k] >= 3) {
      for (const [x, y] of group) {
        room.setTile(x, y, T_EMPTY); this.save.broken[`${room.id}:${x},${y}`] = 1;
        this.particles.burst((x + 0.5) * TILE, (y + 0.5) * TILE, 14, { color: [room.A.tile, room.A.edge, room.A.top], speed: 300, life: 1, size: 5, grav: 800, shape: 'rect' });
      }
      Sfx.play('break'); this.cam.shake(6, 0.3);
      this.toast('发现了隐藏的通路！', 2.5);
      this.writeSave();
    }
  },

  breakSeal(tx, ty) {
    const room = this.room, group = room.breakGroup(tx, ty, T_SEAL);
    for (const [x, y] of group) {
      room.setTile(x, y, T_EMPTY); this.save.broken[`${room.id}:${x},${y}`] = 1;
      this.particles.burst((x + 0.5) * TILE, (y + 0.5) * TILE, 18, { color: ['#ffb040', '#e09cff', '#fff4c0'], speed: 320, life: 1, size: 4, glow: true, shape: 'rect' });
    }
    Sfx.play('seal'); this.cam.shake(8, 0.4); this.flash('#ffb040', 0.3);
    this.toast('灵焰封印碎裂了。', 3);
    this.writeSave();
  },
  lavaLights() {
    const room = this.room; if (room.area !== 'kiln') return;
    const x0 = Math.max(0, Math.floor(this.cam.x / TILE)), x1 = Math.min(room.w - 1, Math.ceil((this.cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(this.cam.y / TILE)), y1 = Math.min(room.h - 1, Math.ceil((this.cam.y + VH) / TILE));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x += 2) if (room.tileRaw(x, y) === T_SPIKE) Light.add((x + 0.5) * TILE, (y + 0.7) * TILE, 110 + Math.sin(this.time * 3 + x) * 10, '#ff7a2a', 0.9, 0.35);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (room.tileRaw(x, y) === T_SEAL && (y % 2 === 0)) Light.add((x + 0.5) * TILE, (y + 0.5) * TILE, 90, '#ffa050', 0.7, 0.25);
  },
  // 情境提示（每个只出现一次）
  hints() {
    const S = this.save, F = S.flags, p = this.player;
    if (!F.hint_soul && S.soul >= P.SOUL_COST && S.hp < this.maxHp()) { F.hint_soul = 1; this.toast('灵焰已足够：在地面长按 V / I 可以回复生命', 5); }
    if (!F.hint_map && S.time > 40) { F.hint_map = 1; this.toast('按 Tab / M 打开地图', 4); }
    if (!F.hint_down && S.time > 8 && !p.onGround && p.vy > 200 && p.attackT <= 0 && S.flags.talk_oren) { F.hint_down = 1; this.toast('空中按住 ↓ 挥刀可以向下斩，击中敌人或尖刺会弹起', 5); }
  },
  // ---------------- 小工具 ----------------
  spawnAmber(x, y, n) {
    let big = Math.floor(n / 5), small = n - big * 5;
    if (big > 20) { small += (big - 20) * 5; big = 20; }
    small = Math.min(small, 40);
    for (let i = 0; i < big; i++) this.ambers.push(new Amber(x, y, 5));
    for (let i = 0; i < small; i++) this.ambers.push(new Amber(x, y, 1));
  },
  amberGain() { this.amberPulse = 0.3; },
  hitSpark(x, y, ang) {
    this.particles.burst(x, y, 10, { angle: ang, spread: 0.7, speed: 420, color: ['#fff', '#ffe2a8'], life: 0.18, size: 2, shape: 'line', glow: true, drag: 0.85 });
    this.particles.add({ x, y, size: 16, life: 0.15, color: '#ffffff', shape: 'ring', glow: true });
  },
  hitstop(t) { this.stopT = Math.max(this.stopT, t); },
  slowmo(t) { this.slowT = Math.max(this.slowT, t); },
  flash(c, a, white) { this.flashC = c; this.flashA = a; },
  toast(text, dur = 3) { this.toasts.push({ text, t: 0, dur }); if (this.toasts.length > 3) this.toasts.shift(); },

  // ---------------- 结局 ----------------
  startEnding() {
    this.state = 'ending'; Music.play('end');
    this.ending = { t: 0 };
  },
  updateEnding(dt) {
    const E = this.ending; E.t += dt;
    if (E.t > 11 && (Input.pressed('confirm') || Input.pressed('attack'))) {
      this.toTitle();
    }
  },

  // ---------------- 绘制 ----------------
  draw(ctx) {
    if (this.state === 'title') { UI.drawTitle(ctx); UI.drawMenus(ctx); return; }
    if (this.state === 'ending') { UI.drawEnding(ctx); return; }
    if (this.state === 'intro') { UI.drawIntro(ctx); return; }
    if (!this.room) return;
    const room = this.room, cam = this.cam, p = this.player;
    RoomArt.drawBackground(ctx, room, cam);
    ctx.save();
    ctx.translate(-cam.vx, -cam.vy);
    ctx.drawImage(RoomArt.get(room).fg, 0, 0);
    // 房间比屏幕小时，外部用岩体填满
    if (room.pw < VW || room.ph < VH) {
      ctx.fillStyle = room.A.tileDeep;
      const L = cam.vx - 10, T = cam.vy - 10, R = cam.vx + VW + 10, B = cam.vy + VH + 10;
      if (L < 0) ctx.fillRect(L, T, -L, B - T);
      if (R > room.pw) ctx.fillRect(room.pw, T, R - room.pw, B - T);
      if (T < 0) ctx.fillRect(L, T, R - L, -T);
      if (B > room.ph) ctx.fillRect(L, room.ph, R - L, B - room.ph);
    }
    this.drawDynamicTiles(ctx);
    for (const pl of this.platforms) pl.draw(ctx);
    for (const o of this.objects) o.draw(ctx);
    for (const e of this.enemies) e.draw(ctx);
    for (const a of this.ambers) a.draw(ctx);
    if (p.state !== 'dead' || p.deadT < 1) p.draw(ctx);
    for (const pr of this.projectiles) pr.draw(ctx);
    for (const sp of this.spells) sp.draw(ctx);
    this.particles.draw(ctx, false);
    ctx.globalCompositeOperation = 'lighter';
    this.particles.draw(ctx, true);
    ctx.globalCompositeOperation = 'source-over';
    if (this.debug) this.drawDebug(ctx);
    ctx.restore();

    RoomArt.drawNear(ctx, room, cam);
    // 光照
    Light.begin();
    const [lx, ly] = p.lanternPos();
    const lr = (p.state === 'focus' ? 300 : 250) + Math.sin(this.time * 9) * 4;
    if (p.state !== 'dead') { Light.add(lx, ly, lr, '#ffb860', 1, 0.3); Light.add(p.cx, p.cy, 120, null, 0.6); }
    for (const o of this.objects) o.lights();
    for (const pl of this.platforms) pl.lights();
    for (const e of this.enemies) e.lights();
    for (const pr of this.projectiles) pr.lights();
    for (const sp of this.spells) sp.lights();
    this.lavaLights();
    if (this.ambers.length < 40) for (const a of this.ambers) a.lights();
    let dark = room.A.dark;
    if (this.boss && this.boss.bossId === 'mother' && this.boss.mode !== 'sleep') dark = Math.min(0.92, dark + 0.08);
    Light.render(ctx, cam, dark);

    // 暗角
    const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);

    if (this.flashA > 0 && this.flashC) { ctx.globalAlpha = Math.min(1, this.flashA); ctx.fillStyle = this.flashC; ctx.globalCompositeOperation = 'lighter'; ctx.fillRect(0, 0, VW, VH); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }

    UI.drawHUD(ctx);
    if (this.fadeA > 0) { ctx.fillStyle = `rgba(0,0,0,${this.fadeA})`; ctx.fillRect(0, 0, VW, VH); }
    UI.drawOverlays(ctx);
    UI.drawMenus(ctx);
  },
  drawDynamicTiles(ctx) {
    const room = this.room, A = room.A;
    const x0 = Math.max(0, Math.floor(this.cam.x / TILE) - 1), x1 = Math.min(room.w - 1, Math.ceil((this.cam.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(this.cam.y / TILE) - 1), y1 = Math.min(room.h - 1, Math.ceil((this.cam.y + VH) / TILE) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = room.tileRaw(x, y), px = x * TILE, py = y * TILE;
      if (t === T_BREAK) {
        ctx.fillStyle = A.tile; ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = rgba(A.edge, 0.9); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(px + 6, py + 4); ctx.lineTo(px + 14, py + 15); ctx.lineTo(px + 9, py + 27); ctx.moveTo(px + 14, py + 15); ctx.lineTo(px + 25, py + 18); ctx.stroke();
        const g = room.breakGroup(x, y); g.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const hits = g.length ? (room.breakHits[g[0].join(',')] || 0) : 0;
        if (hits) { ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.moveTo(px + 20, py + 2); ctx.lineTo(px + 16, py + 12); ctx.lineTo(px + 26, py + 28); if (hits > 1) { ctx.moveTo(px + 2, py + 20); ctx.lineTo(px + 12, py + 22); } ctx.stroke(); }
      } else if (t === T_SEAL) {
        // 灵焰封印：流动的纹路晶壁
        ctx.fillStyle = '#2a1424'; ctx.fillRect(px, py, TILE, TILE);
        const ph = this.time * 2 + x * 0.7 + y * 0.9, k = (Math.sin(ph) + 1) / 2;
        ctx.strokeStyle = `rgba(255,${150 + k * 80 | 0},${80 + k * 60 | 0},${0.5 + k * 0.4})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px + 4, py + 16); ctx.lineTo(px + 16, py + 4); ctx.lineTo(px + 28, py + 16); ctx.lineTo(px + 16, py + 28); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = `rgba(255,220,160,${0.4 + k * 0.5})`; ctx.beginPath(); ctx.arc(px + 16, py + 16, 2.5 + k * 1.5, 0, 6.28); ctx.fill();
        ctx.strokeStyle = 'rgba(224,156,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      } else if (t === T_SPIKE && room.area === 'kiln') {
        // 熔岩表面波动
        const wv = Math.sin(this.time * 3 + x * 1.3) * 2;
        ctx.fillStyle = '#ffe08a'; ctx.fillRect(px, py + 11 + wv, TILE, 2);
        if (Math.random() < 0.02) this.particles.add({ x: px + U.rand(4, 28), y: py + 12, vx: U.rand(-15, 15), vy: U.rand(-120, -50), life: 0.6, size: 2, color: '#ffb040', glow: true, grav: 300 });
      } else if (t === T_LGATE) {
        ctx.fillStyle = '#1e1c24'; ctx.fillRect(px, py + 6, TILE, 20);
        ctx.fillStyle = '#5a5662'; for (let i = 0; i < 4; i++) ctx.fillRect(px + 3 + i * 8, py + 2, 3, 28);
        ctx.fillStyle = '#7a7280'; ctx.fillRect(px, py + 8, TILE, 3); ctx.fillRect(px, py + 21, TILE, 3);
      } else if (t === T_GATE) {
        const h = room.gateClosed ? 1 : 0;
        this.gateAnim = U.lerp(this.gateAnim ?? 0, h, 0.1);
        const k = this.gateAnim;
        if (k > 0.02) {
          ctx.fillStyle = '#2a2630';
          for (let i = 0; i < 3; i++) ctx.fillRect(px + 4 + i * 10, py + TILE * (1 - k), 5, TILE * k);
          ctx.fillStyle = '#4a4450'; ctx.fillRect(px, py + TILE * (1 - k), TILE, 3);
        }
      }
    }
  },
  drawDebug(ctx) {
    const p = this.player;
    ctx.strokeStyle = '#0f0'; ctx.strokeRect(p.x, p.y, p.w, p.h);
    if (p.attackT > P.ATK_T - P.ATK_ACTIVE) { const b = p.attackBox(); ctx.strokeStyle = '#ff0'; ctx.strokeRect(b.x, b.y, b.w, b.h); }
    ctx.strokeStyle = '#f00';
    for (const e of this.enemies) { const b = e.touchBox(); ctx.strokeRect(b.x, b.y, b.w, b.h); const ex = e.extraHits && e.extraHits(); if (ex) for (const q of ex) ctx.strokeRect(q.x, q.y, q.w, q.h); }
  },
};
