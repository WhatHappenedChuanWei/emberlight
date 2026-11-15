// 在页面上下文中执行的回归测试（由 tools/test.js 调用）
(() => {
  const R = [];
  const check = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail === undefined ? '' : JSON.stringify(detail) });
  const S = () => Game.save;
  const noEnemies = () => { Game.enemies = Game.enemies.filter(e => e.isBoss); };
  // 通用机器人：朝 dir 移动，可配置跳跃/冲刺/二段跳/攀墙
  const bot = (frames, o) => {
    let prevJump = false, phase = 0;
    T.step(frames, i => {
      const p = Game.player; if (o.clear) noEnemies();
      const toward = o.dir > 0 ? 'right' : 'left', away = o.dir > 0 ? 'left' : 'right';
      const k = [p.wjLock > 0 ? away : toward]; let j = false;
      if (o.mode === 'climb') {
        if (p.wjLock > 0) j = true; else if (p.onGround) j = !prevJump; else if (p.wallDir) j = !prevJump;
        else if (o.dj && p.vy > -50 && p.djAvail) j = !prevJump; else j = p.vy < 0 && prevJump;
      } else if (o.mode === 'leap') {
        const edge = o.dir > 0 ? p.x > o.at : p.x < o.at;
        if (phase === 0 && edge) phase = 1;
        if (phase === 1) { j = true; if (!p.onGround && p.vy > -80) phase = 2; }
        else if (phase === 2) { phase = o.dj ? 3 : 4; }
        else if (phase === 3) { j = true; if (!p.djAvail && p.vy > -60) phase = 4; }
        if (phase === 4 && o.dash) { k.push('dash'); phase = 5; }
      }
      if (j) k.push('jump'); prevJump = j; return k;
    });
    return T.p();
  };
  const reset = () => { T.fresh(); const s = S(); s.hp = s.maxHp = 9; return s; };

  // ---------- 物理 ----------
  reset();
  T.put('A1', 8, 14); let y0 = Game.player.y, minY = y0;
  T.step(120, () => { minY = Math.min(minY, Game.player.y); return ['jump']; });
  check('跳跃高度约 4.4 格', y0 - minY > 136 && y0 - minY < 150, +(y0 - minY).toFixed(1));

  // ---------- 房间切换 ----------
  reset(); T.put('A1', 30, 14); T.step(240, ['right']);
  check('A1 → A2 横向切换', T.p().room === 'A2', T.p());
  T.put('A2', 31, 14); T.step(30); T.step(2, ['down', 'jump']); T.step(150);
  check('A2 单向平台下穿到 A4', T.p().room === 'A4', T.p());
  T.put('A4', 7, 2); T.step(30); T.step(90, i => (i < 70 ? ['jump'] : [])); T.step(60, ['right']);
  check('A4 向上跳回 A2', T.p().room === 'A2', T.p());

  // ---------- A4 荆棘门（冲刺） ----------
  let s = reset();
  s.abilities.dash = true; T.put('A4', 9, 30);
  check('A4 有冲刺可越过荆棘', bot(260, { dir: 1, mode: 'leap', at: 12 * 32 - 22, dash: true }).room === 'C1' && S().hp === 9, [T.p(), S().hp]);
  s = reset(); T.put('A4', 9, 30); bot(260, { dir: 1, mode: 'leap', at: 12 * 32 - 22 });
  check('A4 无冲刺会扎刺', S().hp < 9 && T.p().room === 'A4', [T.p(), S().hp]);
  s = reset(); T.put('A4', 14, 24); bot(260, { dir: 1, mode: 'leap', at: 0 });
  check('A4 从平台跳也绕不过荆棘', S().hp < 9, [T.p(), S().hp]);

  // ---------- B2 塔（钩爪） ----------
  s = reset(); s.abilities.claw = true; T.put('B2', 13, 40);
  let best = 99; T.step(1500, i => { best = Math.min(best, Math.floor(Game.player.y / 32)); noEnemies(); const p = Game.player;
    const k = [p.wjLock > 0 ? 'right' : 'left']; if (p.wjLock > 0 || (p.wallDir && i % 2) || (p.onGround && i % 2) || (!p.wallDir && p.vy < 0)) k.push('jump'); return k; });
  check('B2 有钩爪可爬上塔顶', best <= 14, best);
  s = reset(); T.put('B2', 14, 40); best = 99;
  T.step(600, i => { best = Math.min(best, Math.floor(Game.player.y / 32)); noEnemies(); return i % 40 < 30 ? ['jump', i % 200 < 100 ? 'left' : 'right'] : []; });
  check('B2 无钩爪上不去', best > 30, best);

  // ---------- B3 → D1 ----------
  s = reset(); s.abilities.claw = true; T.put('B3', 36, 13);
  check('B3 攀右墙进入熔窑', bot(600, { dir: 1, mode: 'climb', clear: true }).room === 'D1', T.p());

  // ---------- C3 坑与蛾翼 ----------
  s = reset(); s.abilities.claw = true; T.put('C3', 15, 18);
  check('C3 坑底：仅钩爪可爬出', bot(600, { dir: -1, mode: 'climb', clear: true }).ty <= 13, T.p());
  s = reset(); s.abilities.wings = true; T.put('C3', 15, 18);
  check('C3 坑底：仅蛾翼可爬出', bot(600, { dir: -1, mode: 'climb', dj: true, clear: true }).ty <= 13 || T.p().room === 'C2', T.p());
  s = reset(); T.put('C3', 15, 18);
  check('C3 坑底：无能力出不去', bot(600, { dir: -1, mode: 'climb', clear: true }).ty > 16, T.p());
  s = reset(); Object.assign(s.abilities, { claw: true, wings: true, dash: true }); T.put('C3', 11, 13);
  check('C3 二段跳+冲刺越过深坑', bot(400, { dir: 1, mode: 'leap', at: 13 * 32 - 20, dj: true, dash: true, clear: true }).room === 'C4', T.p());
  s = reset(); Object.assign(s.abilities, { claw: true, wings: true }); T.put('C3', 11, 13);
  check('C3 仅二段跳越不过深坑', bot(400, { dir: 1, mode: 'leap', at: 13 * 32 - 20, dj: true, clear: true }).ty > 16, T.p());
  s = reset(); Object.assign(s.abilities, { claw: true, dash: true }); T.put('C3', 11, 13);
  check('C3 仅冲刺越不过深坑', bot(400, { dir: 1, mode: 'leap', at: 13 * 32 - 20, dash: true, clear: true }).ty > 16, T.p());

  // ---------- 存档 / 死亡 / 遗珀 ----------
  s = reset(); T.put('A3', 10, 14); T.step(30, ['right']); T.step(5); T.step(1, ['up']); T.step(10);
  check('灯座休息并存档', Game.player.state === 'sit' && S().bench && S().bench.room === 'A3' && !!localStorage.getItem('emberlight_save_v1'), [T.p(), Game.state, Game.inputLocked, !!Game.dialog, !!Game.popup, UI.stack.length, Game.objects.map(o => o.constructor.name)]);
  S().amber = 123; T.put('B1', 20, 14); T.step(1); S().hp = 1; Game.player.invuln = 0; Game.player.hurt(1, 0); T.step(120 * 3.5);
  check('死亡后在灯座复活并留下遗珀', Game.room.id === 'A3' && S().amber === 0 && S().lost && S().lost.amount === 123, S().lost);
  T.put('B1', 3, 14); const shade = Game.objects.find(o => o instanceof Shade);
  if (shade) { Game.player.x = shade.x; Game.player.y = shade.y + shade.h - Game.player.h; T.step(5); }
  check('触碰遗珀取回琥珀', S().amber === 123 && !S().lost, S().amber);
  Game.writeSave(); Game.toTitle(); UI.stack = []; Game.startGame(false); T.step(5);
  check('继续游戏从灯座开始', Game.room.id === 'A3' && Game.player.state === 'sit' && S().amber === 123);

  // ---------- 破坏墙 / 心核 ----------
  s = reset(); const hp0 = s.maxHp; T.put('A4', 8, 30); Game.player.facing = -1;
  for (let i = 0; i < 4; i++) { T.step(1, ['left', 'attack']); T.step(50, ['left']); }
  T.step(320, i => (Game.popup ? (i % 2 ? ['confirm'] : []) : ['left']));
  check('A4 隐藏墙与心核', Object.keys(S().broken).length === 3 && S().maxHp === hp0 + 1, [S().broken, S().maxHp]);

  // ---------- 封印 ----------
  s = reset(); s.abilities.spell = true; s.soul = 99; T.put('A1', 6, 14); Game.player.facing = -1; T.step(5);
  T.step(1, ['left', 'cast']); T.step(60); T.step(200, ['left']);
  check('烬火弹击碎 A1 封印进入秘室', T.p().room === 'A5', T.p());

  // ---------- 捷径拉杆 ----------
  s = reset(); s.abilities.claw = true;
  T.put('B1', 29, 14); T.step(120);
  check('B1 落洞后被铁栅挡住', T.p().room === 'C5' && T.p().ty <= 1, T.p());
  s.abilities.claw = false; T.step(30); T.step(60, i => (i < 50 ? ['jump', 'left'] : ['left'])); T.step(60, ['left']);
  check('无能力也能从铁栅上跳回 B1（不卡死）', T.p().room === 'B1', T.p());
  s.abilities.claw = true;
  T.put('C5', 7, 3); Game.player.facing = 1; T.step(1, ['right', 'attack']); T.step(80);
  check('拉杆打开铁栅', !!S().flags.lever_C5 && Game.room.tileRaw(3, 1) === T_EMPTY);
  T.put('C5', 4, 2); T.step(900, i => (Game.room.id === 'C5' && i % 40 < 2 ? ['down', 'jump'] : []));
  check('捷径打通后可落入深渊', T.p().room === 'C2', T.p());
  T.put('C5', 4, 0); check('重新进入后铁栅保持开启', Game.room.tileRaw(3, 1) === T_EMPTY);

  // ---------- 灯饰 ----------
  s = reset(); s.maxHp = 5; s.hp = 5;
  T.put('B6', 32, 14); T.step(20); T.step(200, i => (Game.popup && i % 2 ? ['confirm'] : []));
  check('拾取灯饰疾风羽', !!S().charms.owned.swift);
  S().charms.owned.emberheart = 1; Game.player.state = 'normal';
  check('非灯座处不能装备', (Game.player.state !== 'sit') && Game.toggleCharm && true);
  Game.player.state = 'sit'; Game.toggleCharm('emberheart');
  check('余烬之心 +2 生命', Game.maxHp() === 7 && S().hp === 7, [Game.maxHp(), S().hp]);
  check('槽位上限 3（余烬之心 3 槽 + 疾风羽 1 槽 超出）', Game.toggleCharm('swift') === 'full');
  Game.toggleCharm('emberheart');
  check('卸下后生命上限恢复', Game.maxHp() === 5 && S().hp === 5);
  Game.toggleCharm('swift');
  T.put('A1', 6, 14); T.step(120, ['right']);
  check('疾风羽提高移速', Math.abs(Game.player.vx) > 320, Game.player.vx);

  // ---------- 灯座传送 ----------
  s = reset(); T.put('A3', 10, 14); T.step(30, ['right']); T.step(5); T.step(1, ['up']); T.step(10);
  T.put('C2', 12, 13); T.step(12, ['right']); T.step(5); T.step(1, ['up']); T.step(10);
  check('两处灯座已记录', Object.keys(S().benches).length === 2, Object.keys(S().benches));
  T.step(1, ['up']); T.step(30);
  check('坐着按 ↑ 打开传送菜单', UI.top && UI.top.type === 'travel');
  if (UI.top && UI.top.ids) { UI.top.sel = UI.top.ids.indexOf('A3'); T.step(1, ['confirm']); T.step(200); }
  check('传送到苔径歇所', Game.room.id === 'A3' && Game.player.state === 'sit', T.p());

  // ---------- A2 → A6（需二段跳） ----------
  s = reset(); T.put('A2', 22, 7); T.step(5); T.step(60, i => (i < 40 ? ['jump'] : [])); T.step(60);
  check('A2 平台无二段跳上不去苔母之巢', T.p().room === 'A2', T.p());
  s.abilities.wings = true; T.put('A2', 22, 7); T.step(5); let pj = false;
  T.step(140, i => { const p = Game.player; let j = i < 30 ? true : (i < 32 ? false : p.vy < 200); const k = j ? ['jump'] : []; if (i > 45 && Game.room.id === 'A6') k.push('right'); return k; });
  T.step(60, ['right']);
  check('A2 平台二段跳进入苔母之巢', T.p().room === 'A6', T.p());

  // ---------- 霜息穹顶：平台 ----------
  s = reset(); s.abilities.claw = true;
  T.put('C2', 25, 13); T.step(60); const stayC2 = T.p().room === 'C2';
  check('C2 地洞被单向平台覆盖（主路线不会掉下去）', stayC2, T.p());
  T.step(2, ['down', 'jump']); T.step(200);
  check('深渊灯座地洞通往霜晶落阶', T.p().room === 'E1', T.p());
  T.put('E1', 23, 2); noEnemies(); T.step(10, () => { noEnemies(); return []; });
  T.step(140, i => { noEnemies(); const p = Game.player; return i < 60 ? ['jump'] : (Game.room.id === 'C2' ? ['left'] : []); });
  check('从霜晶落阶跳回深渊灯座', T.p().room === 'C2' && T.p().ty <= 13, T.p());
  T.put('E1', 15, 7); noEnemies(); T.step(30, () => { noEnemies(); return []; });
  const cr = Game.platforms.find(pl => pl.kind === 'crumble' && Math.abs(pl.x - 15 * 32) < 2);
  const onCr = Game.player.ride === cr;
  T.step(120, () => { noEnemies(); return []; });
  check('站上碎冰平台后碎裂坠落', onCr && cr.state !== 'idle' && T.p().ty > 9, [onCr, cr && cr.state, T.p()]);
  T.step(120 * 3, () => { noEnemies(); return []; });
  check('碎冰平台会重生', cr.state === 'idle');
  s = reset(); T.put('E2', 36, 15); noEnemies();
  const mv = Game.platforms.find(pl => pl.x0 === 35 * 32);
  T.step(5, () => { noEnemies(); return []; }); const rx0 = Game.player.x;
  T.step(120, () => { noEnemies(); return []; });
  check('搭乘移动平台随之移动', Game.player.ride === mv && Math.abs(Game.player.x - rx0) > 60 && S().hp === 9, [Game.player.x - rx0, S().hp]);
  s = reset(); T.put('E3', 15, 13); T.step(400, i => (Game.popup ? (i % 2 ? ['confirm'] : []) : ['left']));
  check('霜心秘库：灯饰槽 +1', S().notches === 4, S().notches);

  // E2：只用基础跳跃按时机走完移动平台
  s = reset(); T.put('E2', 41, 18);
  {
    const P1 = Game.platforms.find(pl => pl.x0 === 35 * 32), P2 = Game.platforms.find(pl => pl.x0 === 22 * 32), P3 = Game.platforms.find(pl => pl.x0 === 18 * 32);
    let st = 0, hold = 0;
    for (let f = 0; f < 120 * 30 && st < 4; f++) {
      noEnemies(); const p = Game.player, k = [];
      if (st === 0) { if (hold > 0) { k.push('left', 'jump'); hold--; } else if (p.onGround && P1.x > 1100 && P1.mx > 0) hold = 60; if (p.ride === P1) { st = 1; hold = 0; } }
      else if (st === 1) { if (hold > 0) { k.push('jump'); const dx = (P2.x + 48) - p.cx; if (dx < -8) k.push('left'); else if (dx > 8) k.push('right'); hold--; } else if (p.ride === P1 && P1.x < 900 && P2.y > 400) hold = 50; if (p.ride === P2) { st = 2; hold = 0; } }
      else if (st === 2) { if (hold > 0) { const dx = (P3.x + 48) - p.cx; if (dx < -8) k.push('left'); else if (dx > 8) k.push('right'); hold--; } else if (p.ride === P2 && P3.x > 520) hold = 60; if (p.ride === P3) { st = 3; hold = 0; } }
      else if (st === 3) { if (hold > 0) { k.push('left', 'jump'); hold--; } else if (p.ride === P3 && P3.x < 230) hold = 45; if (p.onGround && !p.ride && p.cx < 4 * 32) st = 4; }
      T.step(1, k);
    }
    check('冰镜长廊：基础跳跃即可无伤通过移动平台', st === 4 && S().hp === 9, [st, S().hp]);
  }
  // E1：连续踩碎冰下到左侧出口
  s = reset(); T.put('E1', 21, 5);
  {
    const targets = [[15, 9], [9, 11], [4, 14]].map(([tx, ty]) => Game.platforms.find(pl => pl.x === tx * 32 && pl.y === ty * 32));
    let st = 0, hold = 0;
    for (let f = 0; f < 120 * 15 && st < 4; f++) {
      noEnemies(); const p = Game.player, k = [], t = targets[st];
      if (st < 3) {
        const dx = (t.x + 32) - p.cx;
        if (p.onGround && hold === 0 && p.ride !== t) hold = 30;
        if (hold > 0) { k.push('jump'); hold--; }
        if (dx < -6) k.push('left'); else if (dx > 6) k.push('right');
        if (p.ride === t) { st++; hold = 0; }
      } else { k.push('left'); if (p.onGround && !p.ride && p.cx < 4 * 32) st = 4; }
      T.step(1, k);
    }
    check('霜晶落阶：连续踩碎冰可无伤到达出口', st === 4 && S().hp === 9, [st, S().hp, T.p()]);
  }

  // ---------- 菜单与卡死回归 ----------
  s = reset(); T.put('A1', 10, 14); T.step(5);
  T.step(1, ['pause']); T.step(30);
  check('Esc 打开暂停', Game.state === 'pause');
  T.step(1, ['pause']); T.step(30);
  check('Esc 关闭暂停（不会立刻重开）', Game.state === 'play' && UI.stack.length === 0, [Game.state, UI.stack.map(m => m.type)]);
  T.step(1, ['map']); T.step(30); T.step(1, ['map']); T.step(30);
  check('Tab 开关地图', Game.state === 'play' && UI.stack.length === 0);
  T.put('A1', 11, 14); T.step(5); T.step(1, ['up']); T.step(30);
  const inDialog = UI.top && UI.top.type === 'dialog';
  T.step(1, ['pause']); T.step(30); T.step(1, ['map']); T.step(30);
  check('对话中 Esc/Tab 不会打开菜单', inDialog && UI.top && UI.top.type === 'dialog' && Game.state === 'play', [inDialog, UI.stack.map(m => m.type), Game.state]);
  for (let i = 0; i < 30 && UI.stack.length; i++) { T.step(1, ['confirm']); T.step(20); }
  const x0 = Game.player.x; T.step(60, ['right']);
  check('对话结束后可以正常移动', !Game.dialog && Game.player.x > x0 + 50, [Game.dialog, Game.player.x - x0]);
  // 击杀后立刻退出：奖励已入档
  s = reset(); T.put('B4', 30, 14); for (let i = 0; i < 900 && (Game.boss.mode === 'sleep' || Game.boss.mode === 'intro'); i++) T.step(1, () => { Game.player.invuln = 1; return []; });
  Game.boss.hp = 1; Game.boss.hurt(2, 1, 0); T.step(30);
  const sv = JSON.parse(localStorage.getItem('emberlight_save_v1'));
  check('击败卡隆后立即存档含影步', sv.bosses.rust && sv.abilities.dash);
  // Boss 死亡动画期间玩家死亡
  s = reset(); T.put('D3', 8, 14); for (let i = 0; i < 900 && (Game.boss.mode === 'sleep' || Game.boss.mode === 'intro'); i++) T.step(1, () => { Game.player.invuln = 1; return []; });
  const kmode = Game.boss && Game.boss.mode; Game.boss.hp = 1; Game.boss.hurt(2, 1, 0); const kmode2 = Game.boss.mode; T.step(5); const krec = S().bosses.kiln; S().hp = 1; Game.player.hurt(1, 0); T.step(120 * 4);
  check('Boss 死亡动画中玩家无敌、击败已记录', S().bosses.kiln && S().abilities.spell && S().deaths === 0, [S().bosses.kiln, S().deaths, kmode, kmode2, krec]);

  // ---------- 钟声试炼 ----------
  s = reset(); s.bosses.mother = true; Object.assign(s.abilities, { dash: true, claw: true, wings: true, spell: true });
  T.put('B5', 9, 14); T.step(10); T.step(1, ['up']); T.step(10);   // 在灯座休息
  T.step(2, ['right']); T.put('B5', 21, 14); T.step(5); T.step(1, ['up']); T.step(20);
  for (let i = 0; i < 10 && UI.top && UI.top.type === 'dialog'; i++) { T.step(1, ['confirm']); T.step(30); }
  const askTrial = UI.top && UI.top.type === 'confirm';
  T.step(1, ['confirm']); T.step(30);
  check('与残响对话后进入钟声试炼', askTrial && Game.room.id === 'R1' && !!Game.trial, [askTrial, Game.room.id]);
  {
    let f = 0, seen = new Set();
    for (; f < 120 * 400 && Game.trial; f++) {
      const p = Game.player; p.invuln = Math.max(p.invuln, 0.5); S().hp = Game.maxHp();
      if (Game.popup) { T.step(1, f % 2 ? ['confirm'] : []); continue; }
      const b = Game.boss; const k = [];
      if (b && !b.dead) { seen.add(b.bossId); const dx = b.cx - p.cx, dy = b.cy - p.cy; if (Math.abs(dx) > 50) k.push(dx > 0 ? 'right' : 'left'); if (dy < -60 && p.onGround && f % 40 < 20) k.push('jump'); if (dy < -40) k.push('up'); if (f % 10 === 0) k.push('attack'); }
      T.step(1, k);
    }
    T.step(240, i => (Game.popup && i % 2 ? ['confirm'] : []));
    check('钟声试炼：连战四位强敌并通关', seen.size === 4 && S().flags.trialDone && !Game.trial && Game.room.id === 'B5', [[...seen], S().flags.trialDone, Game.room.id, (f / 120).toFixed(0) + 's']);
    check('试炼房间不计入足迹/地图', !S().visited.R1);
  }
  s = reset(); s.bosses.mother = true; s.amber = 50; T.put('B5', 9, 14); T.step(10); T.step(1, ['up']); T.step(10);
  Game.startTrial(); T.step(400); S().hp = 1; Game.player.invuln = 0; Game.player.hurt(1, 0); T.step(120 * 4);
  check('试炼中倒下：回到灯座且琥珀保留', !Game.trial && Game.room.id === 'B5' && !S().lost && S().amber === 50, [Game.room.id, S().lost, S().amber]);

  // ---------- 难度 ----------
  localStorage.clear(); UI.openTitle(); T.step(40); T.step(1, ['confirm']); T.step(30);
  const diffMenu = UI.top && UI.top.type === 'difficulty';
  T.step(1, ['up']); T.step(5); T.step(1, ['confirm']); T.step(10);
  const introShown = Game.state === 'intro'; T.step(80); T.step(1, ['confirm']); T.step(10);
  check('新游戏播放开场白，可跳过', introShown && Game.state === 'play', [introShown, Game.state]);
  check('新游戏选择难度：轻松 +3 生命', diffMenu && Game.save.difficulty === 'easy' && Game.maxHp() === 8, [diffMenu, Game.save.difficulty, Game.maxHp()]);
  s = reset(); s.difficulty = 'hard'; s.hp = 9; T.put('A1', 10, 14); Game.player.invuln = 0; Game.player.hurt(1, 0);
  check('困难：受到伤害翻倍', S().hp === 7, S().hp);
  T.put('B4', 30, 14); check('困难：Boss 血量 +30%', Game.boss.maxHp === 91, Game.boss.maxHp);

  // ---------- 图鉴 ----------
  s = reset(); T.put('A2', 8, 14); const nC = Game.enemies.filter(e => e instanceof Crawler).length; Game.enemies.forEach(e => e.die()); T.step(3);
  check('击败敌人记入灯下札记', (S().kills.Crawler || 0) === nC && nC > 0, S().kills);

  // ---------- 存档位 / 设置 ----------
  s = reset(); s.amber = 11; Game.writeSave();
  Game.slot = 1; Game.startGame(true, 'hard'); Game.save.amber = 22; Game.writeSave();
  Game.slot = 0;
  check('多存档位互不干扰', Game.readSave(0).amber === 11 && Game.readSave(1).amber === 22 && Game.readSave(1).difficulty === 'hard' && !Game.readSave(2));
  Game.deleteSlot(1); check('删除存档位', !Game.readSave(1));
  UI.openTitle(); T.step(40); UI.push({ type: 'slots', sel: 1 }); T.step(30); T.step(1, ['confirm']); T.step(30); T.step(1, ['back']); T.step(30);
  check('切换到空存档位后标题菜单刷新', Game.slot === 1 && UI.top.type === 'title' && !UI.top.items.some(i => i.act === 'continue'), [Game.slot, UI.top && UI.top.items.map(i => i.act)]);
  Game.slot = 0;
  Game.opts.shake = false; Game.cam.shakeMag = 0; Game.cam.shake(10, 1); check('关闭画面震动', Game.cam.shakeMag === 0);
  Game.opts.shake = true; Game.slot = 0;

  // ---------- 赛菈支线 ----------
  s = reset(); s.flags.talk_sera = 1;
  T.put('C2', 19, 13); T.step(5); T.step(1, ['up']); T.step(20);
  const asked = UI.top && UI.top.type === 'dialog'; for (let i = 0; i < 10 && UI.stack.length; i++) { T.step(1, ['confirm']); T.step(30); }
  for (const [r, tx, ty] of [['C1', 3, 5], ['C3', 5, 30], ['E2', 23, 8]]) { T.put(r, tx, ty); T.step(20, () => { Game.enemies = []; return []; }); }
  const got3 = Game.sporeCount();
  T.put('C2', 19, 13); T.step(5); T.step(1, ['up']); T.step(20);
  for (let i = 0; i < 20 && (UI.stack.length || Game.popup); i++) { T.step(1, ['confirm']); T.step(80); }
  check('赛菈支线：集齐 3 颗孢子换得孢光冠', asked && got3 === 3 && S().charms.owned.sporecrown && S().flags.seraDone, [asked, got3, S().charms.owned.sporecrown]);
  S().soul = 0; Game.player.state = 'sit'; S().bench = { room: 'C2', x: 0, y: 0 }; Game.toggleCharm('sporecrown'); Game.player.state = 'normal'; T.step(240);
  check('孢光冠：灵焰自动回复', S().soul > 4, S().soul);

  // ---------- 存档兼容 ----------
  {
    const old = newSave(); old.bosses = null; old.abilities = null; old.charms = { owned: { swift: 1 }, equipped: ['swift', 'oldcharm', 'swift'] }; old.bench = { room: 'A3', x: 1, y: 2 }; delete old.benches;
    localStorage.setItem('emberlight_save_v1', JSON.stringify(old));
    const r = Game.readSave();
    check('旧存档：null 字段可读取', !!r && r.bosses.rust === false && r.abilities.dash === false);
    check('旧存档：无效/重复灯饰被清理', r && JSON.stringify(r.charms.equipped) === '["swift"]', r && r.charms.equipped);
    check('旧存档：最后的灯座加入传送列表', r && !!r.benches.A3);
    const old2 = newSave(); old2.bosses.rust = true; delete old2.kills; localStorage.setItem('emberlight_save_v1', JSON.stringify(old2));
    check('旧存档：已击败的强敌补记入札记', (Game.readSave().kills || {}).Rustwarden === 1);
  }

  // ---------- Boss ----------
  const fight = (room, tx, ty, max) => {
    T.put(room, tx, ty);
    for (let f = 0; f < max; f++) {
      const p = Game.player; p.invuln = Math.max(p.invuln, 0.5); S().hp = S().maxHp;
      if (Game.popup) { T.step(1, f % 2 ? ['confirm'] : []); continue; }
      if (Game.state === 'ending') return 'ending';
      const b = Game.boss; if (!b || b.dead) { T.step(1); if (!Game.boss || Game.boss.dead) { if (f > 0 && Game.timers.length === 0 && !Game.popup) return 'done'; } continue; }
      const dx = b.cx - p.cx, dy = b.cy - p.cy, k = [];
      if (Math.abs(dx) > 50) k.push(dx > 0 ? 'right' : 'left');
      if (dy < -60 && p.onGround && f % 40 < 20) k.push('jump');
      if (dy < -40) k.push('up');
      if (f % 10 === 0) k.push('attack');
      T.step(1, k);
    }
    return 'timeout';
  };
  s = reset();
  check('卡隆可被击败并获得影步', fight('B4', 30, 14, 120 * 200) === 'done' && S().bosses.rust && S().abilities.dash && !Game.room.gateClosed);
  check('伊格可被击败并获得烬火弹', fight('D3', 8, 14, 120 * 200) === 'done' && S().bosses.kiln && S().abilities.spell);
  S().abilities.wings = true;
  check('薇丝可被击败并获得荆棘环', fight('A6', 22, 14, 120 * 200) === 'done' && S().bosses.moss && S().charms.owned.thorns, [S().bosses.moss, Game.boss && Game.boss.mode, Game.boss && Game.boss.hp]);
  const mr = fight('C4', 10, 13, 120 * 300);
  check('维萨可被击败并进入结局', Game.state === 'ending' && S().bosses.mother, [mr, Game.boss && Game.boss.hp, Game.boss && Game.boss.mode, Game.state, T.p()]);
  return R;
})()
