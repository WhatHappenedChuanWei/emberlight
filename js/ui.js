'use strict';
// ============================================================
//  界面：HUD、菜单、地图、对话、商店、结局
// ============================================================
function txt(ctx, s, x, y, size, color, align = 'left', font = FONT, alpha = 1, weight = '') {
  ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.font = `${weight} ${size}px ${font}`; ctx.fillText(s, x, y); ctx.globalAlpha = 1;
}
function wrapText(ctx, s, maxW) {
  const out = []; let line = '';
  for (const ch of s) {
    if (ch === '\n') { out.push(line); line = ''; continue; }
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) { out.push(line); line = ch; } else line = test;
  }
  if (line) out.push(line);
  return out;
}
function panel(ctx, x, y, w, h, a = 0.85) {
  ctx.fillStyle = `rgba(6,7,14,${a})`; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,220,170,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = 'rgba(255,220,170,0.12)'; ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
  // 角饰
  ctx.fillStyle = 'rgba(255,210,150,0.6)';
  for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore(); }
}
function ornament(ctx, x, y, w, a = 1) {
  ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, 'rgba(255,210,150,0)'); g.addColorStop(0.5, 'rgba(255,210,150,0.8)'); g.addColorStop(1, 'rgba(255,210,150,0)');
  ctx.fillStyle = g; ctx.fillRect(x - w / 2, y, w, 1);
  ctx.fillStyle = 'rgba(255,220,170,0.9)'; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
  ctx.globalAlpha = 1;
}

const UI = {
  stack: [], embers: [], t: 0,
  init() {
    for (let i = 0; i < 70; i++) this.embers.push({ x: Math.random() * VW, y: Math.random() * VH, s: U.rand(0.5, 2.2), v: U.rand(8, 30), p: Math.random() * 6 });
  },
  get top() { return this.stack[this.stack.length - 1]; },
  push(m) { m.t = 0; m.sel = m.sel || 0; this.stack.push(m); },
  pop() { return this.stack.pop(); },
  update(dt) {
    this.t += dt;
    this.hadMenu = this.stack.length > 0; // 本帧输入已被菜单处理，游戏层不再响应暂停/地图键
    for (const e of this.embers) { e.y -= e.v * dt; e.x += Math.sin(this.t + e.p) * 6 * dt; if (e.y < -5) { e.y = VH + 5; e.x = Math.random() * VW; } }
    const m = this.top; if (!m) return;
    m.t += dt;
    const fn = this['upd_' + m.type]; if (fn) fn.call(this, m, dt);
  },
  navigate(m, n, dt) {
    if (Input.repeat('up', dt)) { m.sel = (m.sel + n - 1) % n; Sfx.play('menu'); }
    if (Input.repeat('down', dt)) { m.sel = (m.sel + 1) % n; Sfx.play('menu'); }
  },

  // ---------------- 标题 ----------------
  openTitle() {
    this.stack = [];
    const items = [];
    const has = Game.hasSave();
    if (has) items.push({ label: '继续旅程', act: 'continue' });
    items.push({ label: '新的旅程', act: 'new' });
    items.push({ label: '选择存档', act: 'slots' });
    items.push({ label: '操作说明', act: 'controls' });
    items.push({ label: '设置', act: 'settings' });
    this.push({ type: 'title', items, save: has ? Game.readSave() : null });
  },
  upd_title(m, dt) {
    this.navigate(m, m.items.length, dt);
    if (m.t > 0.3 && Input.pressed('confirm')) {
      const it = m.items[m.sel]; Sfx.play('select');
      if (it.act === 'continue') { this.stack = []; Game.startGame(false); }
      else if (it.act === 'new') {
        const pick = () => this.push({ type: 'difficulty', sel: 1 });
        if (m.save) this.push({ type: 'confirm', q: '开始新的旅程会覆盖现有存档。确定吗？', yes: pick });
        else pick();
      } else if (it.act === 'slots') this.push({ type: 'slots', sel: Game.slot });
      else if (it.act === 'controls') this.push({ type: 'controls' });
      else if (it.act === 'settings') this.push({ type: 'settings' });
    }
  },
  drawTitle(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#05060c'); g.addColorStop(1, '#141024');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    // 远景剪影
    ctx.fillStyle = '#0d0c1a';
    for (let i = 0; i < 14; i++) {
      const x = i * 75 + Math.sin(i * 7) * 20, h = 120 + Math.abs(Math.sin(i * 3.3)) * 180;
      ctx.beginPath(); ctx.moveTo(x - 40, VH); ctx.quadraticCurveTo(x, VH - h * 1.6, x + 40, VH); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 15, 0); ctx.lineTo(x + 5, 40 + Math.abs(Math.sin(i * 5.1)) * 90); ctx.lineTo(x + 25, 0); ctx.fill();
    }
    // 中心灯火
    const cx = VW / 2, cy = 200, f = 1 + Math.sin(this.t * 3) * 0.04 + Math.sin(this.t * 7.7) * 0.03;
    glowDot(ctx, cx, cy, 260 * f, '#ff9a40', 0.18);
    glowDot(ctx, cx, cy, 90 * f, '#ffcf80', 0.35);
    ctx.globalCompositeOperation = 'lighter';
    for (const e of this.embers) { ctx.fillStyle = `rgba(255,${170 + e.s * 30 | 0},90,${0.25 + e.s * 0.25})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.s, 0, 6.28); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    txt(ctx, '烬  灯', cx, cy - 6, 84, '#f6e2c0', 'center', SERIF, 1, 'bold');
    txt(ctx, 'E M B E R L I G H T', cx, cy + 56, 16, '#d9b88a', 'center', FONT, 0.8);
    ornament(ctx, cx, cy + 80, 300);
    const m = this.stack[0];
    if (m && m.type === 'title') {
      m.items.forEach((it, i) => {
        const y = 340 + i * 38, sel = i === m.sel && this.top === m;
        txt(ctx, it.label, cx, y, 22, sel ? '#fff4dc' : '#9c8f80', 'center', FONT, 1);
        if (sel) {
          for (const s of [-1, 1]) {
            ctx.fillStyle = '#ffcf80'; ctx.save(); ctx.translate(cx + s * 78, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-3.5, -3.5, 7, 7); ctx.restore();
          }
        }
      });
      if (m.save && this.top === m && m.items[m.sel].act === 'continue') {
        const s = m.save, d = ROOM_BY_ID[s.bench ? s.bench.room : s.room] || ROOM_BY_ID.A1;
        txt(ctx, `${{ easy: '轻松 · ', hard: '困难 · ' }[s.difficulty] || ''}${AREAS[d.area].name.replace(/ /g, '')} · ${d.name}   ·   ${U.fmtTime(s.time)}   ·   琥珀 ${s.amber}${s.cleared ? '   ·   已通关' : ''}`, cx, VH - 28, 13, '#8a7f72', 'center');
      }
    }
    txt(ctx, '方向键/WASD 选择 · Z/Enter 确认 · 支持手柄与触屏', VW - 16, VH - 12, 11, '#5a5248', 'right');
  },

  // ---------------- 灯下札记（图鉴） ----------------
  JOURNAL: [
    { k: 'Crawler', name: '苔甲虫', desc: '背着苔藓缓缓爬行的甲虫。性情温吞，却会撞伤挡路的旅人。' },
    { k: 'Flyer', name: '磷火蛾', desc: '被光吸引的飞蛾。一旦看见灯火，便会不顾一切地扑来。' },
    { k: 'Hopper', name: '跳刺虫', desc: '浑身是刺的跳虫。蹲伏片刻之后，会猛然扑向猎物。' },
    { k: 'Spitter', name: '孢囊', desc: '悬浮在空中的孢子囊，朝光源喷吐孢子。孢子可以用刀打散。' },
    { k: 'Guard', name: '锈卫', desc: '回廊的老守卫。举矛蓄力之后会猛地突刺，看准时机跳过去。' },
    { k: 'Emberling', name: '余烬虫', desc: '背上燃着炭火的虫子，会把火球高高抛向来者。' },
    { k: 'Bomber', name: '炉蛾', desc: '在头顶盘旋，投下会炸开的火囊。别站在它正下方。' },
    { k: 'Turret', name: '霜晶炮台', desc: '从冰里长出来的晶簇，会一次射出三道冰棱。' },
    { k: 'Rustwarden', name: '锈钟守卫 · 卡隆', desc: '曾守护钟声的骑士。光被吞噬后，只剩下守护本身。' },
    { k: 'KilnWarden', name: '熔炉看守 · 伊格', desc: '熔窑的看守。腹中烧着地下最后的一炉火。' },
    { k: 'MossMother', name: '苔母 · 薇丝', desc: '在苔径深处扎根的巨花。会潜入地下，从你脚边破土而出。' },
    { k: 'Matriarch', name: '噬光之母 · 维萨', desc: '在深渊筑巢的巨蛾。她吞下了所有的光——也许只是因为太冷。' },
  ],
  upd_journal(m, dt) {
    this.navigate(m, this.JOURNAL.length, dt);
    if (m.t > 0.15 && (Input.pressed('back') || Input.pressed('pause') || Input.pressed('confirm'))) { this.pop(); Sfx.play('menu'); }
  },
  draw_journal(ctx, m) {
    ctx.fillStyle = 'rgba(0,0,0,0.94)'; ctx.fillRect(0, 0, VW, VH);
    panel(ctx, 60, 30, 840, 480);
    txt(ctx, '灯 下 札 记', VW / 2, 64, 24, '#f6e2c0', 'center', SERIF, 1, 'bold');
    ornament(ctx, VW / 2, 88, 220);
    const K = Game.save.kills || {};
    let known = 0;
    this.JOURNAL.forEach((e, i) => {
      const n = K[e.k] || 0, sel = i === m.sel, y = 118 + i * 31; if (n) known++;
      if (sel) { ctx.fillStyle = 'rgba(255,207,128,0.08)'; ctx.fillRect(84, y - 14, 300, 28); }
      txt(ctx, n ? e.name : '？？？', 100, y, 15, sel ? '#fff' : n ? '#d8ccb8' : '#4a443e', 'left', i >= 8 ? SERIF : FONT);
      if (n) txt(ctx, '×' + n, 370, y, 13, '#9c8f80', 'right');
    });
    txt(ctx, `已记录 ${known} / ${this.JOURNAL.length}`, 234, 490, 12, '#8a7f72', 'center');
    // 右侧：立绘与描述
    const e = this.JOURNAL[m.sel], n = K[e.k] || 0, px = 640, py = 300;
    ctx.strokeStyle = 'rgba(255,220,170,0.2)'; ctx.strokeRect(420, 110, 450, 380);
    if (!n) { txt(ctx, '尚未遇见', px, py, 18, '#4a443e', 'center', SERIF); return; }
    if (!m.cache) m.cache = {};
    let inst = m.cache[e.k];
    if (!inst) {
      try { inst = new (window[e.k] || eval(e.k))(0, 0); inst.mode = inst.mode === 'sleep' ? 'idle' : inst.mode; inst.rise = 1; } catch (err) { inst = null; }
      m.cache[e.k] = inst;
    }
    if (inst) {
      inst.t = this.t; inst.flash = 0;
      const big = e.k === 'Rustwarden' || e.k === 'KilnWarden' || e.k === 'MossMother' || e.k === 'Matriarch';
      const sc = big ? 1.3 : 3;
      ctx.save(); glowDot(ctx, px, py - 30, 150, '#ffcf80', 0.08);
      ctx.translate(px, py + (big ? 40 : 30)); ctx.scale(sc, sc);
      inst.x = -inst.w / 2; inst.y = -inst.h; if (inst.floorY !== undefined) inst.floorY = 0;
      try { inst.draw(ctx); } catch (err) { }
      ctx.restore();
    }
    txt(ctx, e.name, px, 380, 20, '#f6e2c0', 'center', SERIF, 1, 'bold');
    ctx.font = `14px ${FONT}`;
    wrapText(ctx, e.desc, 400).forEach((l, i) => txt(ctx, l, px, 412 + i * 22, 14, '#c8b8a0', 'center'));
    txt(ctx, `击败 ${n} 次`, px, 466, 12, '#8a7f72', 'center');
  },

  // ---------------- 难度 ----------------
  DIFFS: [
    { id: 'easy', name: '轻 松', desc: '生命 +3，受伤后的无敌时间更长。适合想专心探索的旅人。' },
    { id: 'normal', name: '普 通', desc: '原本的体验。' },
    { id: 'hard', name: '困 难', desc: '受到的所有伤害翻倍，强敌更加坚韧。' },
  ],
  upd_difficulty(m, dt) {
    this.navigate(m, 3, dt);
    if (m.t > 0.2 && Input.pressed('back')) { this.openTitle(); Sfx.play('menu'); return; }
    if (m.t > 0.2 && Input.pressed('confirm')) { Sfx.play('select'); const d = this.DIFFS[m.sel].id; this.stack = []; Game.startGame(true, d); }
  },
  draw_difficulty(ctx, m) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, VW, VH);
    panel(ctx, VW / 2 - 260, 110, 520, 320);
    txt(ctx, '选 择 难 度', VW / 2, 150, 24, '#f6e2c0', 'center', SERIF, 1, 'bold');
    ornament(ctx, VW / 2, 174, 220);
    this.DIFFS.forEach((d, i) => {
      const y = 220 + i * 64, sel = i === m.sel;
      if (sel) { ctx.fillStyle = 'rgba(255,207,128,0.08)'; ctx.fillRect(VW / 2 - 230, y - 22, 460, 56); }
      txt(ctx, d.name, VW / 2 - 200, y, 20, sel ? '#fff' : '#9c8f80', 'left', SERIF, 1, 'bold');
      txt(ctx, d.desc, VW / 2 - 200, y + 22, 13, sel ? '#c8b8a0' : '#6a6058');
    });
    txt(ctx, '难度在本次旅程中不可更改', VW / 2, 412, 12, '#6a6058', 'center');
  },

  // ---------------- 存档位 ----------------
  upd_slots(m, dt) {
    this.navigate(m, 3, dt);
    if (m.t > 0.2 && Input.pressed('back')) { this.openTitle(); Sfx.play('menu'); return; }
    const has = Game.readSave(m.sel);
    if (m.t > 0.2 && Input.pressed('dash') && has) {
      const n = m.sel;
      this.push({ type: 'confirm', q: `删除存档 ${n + 1}？此操作无法撤销。`, yes: () => { Game.deleteSlot(n); if (n === Game.slot) this.openTitle(); } });
      return;
    }
    if (m.t > 0.2 && Input.pressed('confirm')) {
      Sfx.play('select'); Game.slot = m.sel; Game.saveSettings();
      if (has) { this.stack = []; Game.startGame(false); }
      else this.push({ type: 'difficulty', sel: 1 });
    }
  },
  draw_slots(ctx, m) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, VW, VH);
    panel(ctx, VW / 2 - 280, 80, 560, 380);
    txt(ctx, '选 择 存 档', VW / 2, 120, 24, '#f6e2c0', 'center', SERIF, 1, 'bold');
    ornament(ctx, VW / 2, 144, 220);
    for (let i = 0; i < 3; i++) {
      const s = Game.readSave(i), y = 190 + i * 80, sel = i === m.sel;
      if (sel) { ctx.fillStyle = 'rgba(255,207,128,0.08)'; ctx.fillRect(VW / 2 - 250, y - 28, 500, 66); }
      txt(ctx, `存档 ${i + 1}`, VW / 2 - 230, y - 6, 18, sel ? '#fff' : '#b8a68e', 'left', SERIF, 1, 'bold');
      if (s) {
        const d = ROOM_BY_ID[s.bench ? s.bench.room : s.room] || ROOM_BY_ID.A1;
        txt(ctx, `${AREAS[d.area].name.replace(/ /g, '')} · ${d.name}`, VW / 2 - 120, y - 6, 16, sel ? '#f0e2cc' : '#9c8f80');
        txt(ctx, `${{ easy: '轻松', hard: '困难' }[s.difficulty] || '普通'}  ·  ${U.fmtTime(s.time)}  ·  琥珀 ${s.amber}${s.cleared ? '  ·  已通关' : ''}`, VW / 2 - 120, y + 18, 13, '#8a7f72');
      } else txt(ctx, '—— 空 ——', VW / 2 - 120, y + 4, 16, '#5a5248');
      if (i === Game.slot) txt(ctx, '当前', VW / 2 + 230, y - 6, 12, '#ffcf80', 'right');
    }
    txt(ctx, 'Z 选择 · C 删除 · Esc 返回', VW / 2, 438, 12, '#6a6058', 'center');
  },

  // ---------------- 确认 ----------------
  upd_confirm(m, dt) {
    if (Input.repeat('left', dt) || Input.repeat('right', dt) || Input.repeat('up', dt) || Input.repeat('down', dt)) { m.sel = 1 - m.sel; Sfx.play('menu'); }
    if (m.t > 0.2 && Input.pressed('confirm')) { Sfx.play('select'); this.pop(); if (m.sel === 0) m.yes(); else if (m.no) m.no(); }
    else if (m.t > 0.2 && Input.pressed('back')) { this.pop(); Sfx.play('menu'); if (m.no) m.no(); }
  },
  draw_confirm(ctx, m) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, VW, VH);
    panel(ctx, VW / 2 - 220, VH / 2 - 70, 440, 140);
    txt(ctx, m.q, VW / 2, VH / 2 - 25, 17, '#f0e2cc', 'center');
    ['确定', '取消'].forEach((s, i) => txt(ctx, (m.sel === i ? '◆ ' : '  ') + s, VW / 2 + (i ? 70 : -70), VH / 2 + 30, 18, m.sel === i ? '#fff' : '#8a7f72', 'center'));
  },

  // ---------------- 操作说明 ----------------
  upd_controls(m) { if (m.t > 0.2 && (Input.pressed('back') || Input.pressed('confirm') || Input.pressed('pause'))) { this.pop(); Sfx.play('menu'); } },
  draw_controls(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, VW, VH);
    panel(ctx, 150, 40, 660, 470);
    txt(ctx, '操 作 说 明', VW / 2, 90, 26, '#f6e2c0', 'center', SERIF, 1, 'bold');
    ornament(ctx, VW / 2, 114, 240);
    const rows = [
      ['移动', '← → / A D', '左摇杆 / 十字键'],
      ['跳跃（按住跳更高）', 'Z / K / 空格', 'A'],
      ['挥刀', 'X / J', 'X'],
      ['向上 / 向下挥刀', '按住 ↑ / ↓ + 挥刀', '↑ / ↓ + X'],
      ['冲刺（需习得）', 'C / L / Shift', 'RB / RT'],
      ['聚焦回血（地面长按）', 'V / I', 'B'],
      ['烬火弹（需习得）', 'F / U', 'Y'],
      ['交互（灯座/NPC/商人）', '↑ / W', '↑'],
      ['下穿单向平台', '↓ + 跳跃', '↓ + A'],
      ['地图', 'Tab / M', 'Back / LB'],
      ['暂停', 'Esc / P', 'Start'],
    ];
    txt(ctx, '键盘', 520, 140, 14, '#b8a68e', 'center'); txt(ctx, '手柄', 700, 140, 14, '#b8a68e', 'center');
    rows.forEach((r, i) => {
      const y = 168 + i * 27;
      txt(ctx, r[0], 190, y, 15, '#e8dcc8');
      txt(ctx, r[1], 520, y, 15, '#ffcf80', 'center');
      txt(ctx, r[2], 700, y, 15, '#c8b8e8', 'center');
    });
    txt(ctx, '空中向下挥刀击中敌人或尖刺可以弹起。击中敌人积攒灵焰（左上角的球）。', VW / 2, 478, 13, '#9c8f80', 'center');
  },

  // ---------------- 设置 ----------------
  upd_settings(m, dt) {
    this.navigate(m, 5, dt);
    const d = (Input.repeat('right', dt) ? 1 : 0) - (Input.repeat('left', dt) ? 1 : 0);
    const toggle = d || (m.t > 0.2 && Input.pressed('confirm'));
    if (d && m.sel <= 1) {
      if (m.sel === 0) Sfx.musicVolume = U.clamp(Math.round((Sfx.musicVolume + d * 0.1) * 10) / 10, 0, 1);
      if (m.sel === 1) Sfx.sfxVolume = U.clamp(Math.round((Sfx.sfxVolume + d * 0.1) * 10) / 10, 0, 1);
      Game.saveSettings(); Sfx.play('menu');
    } else if (toggle && m.sel === 2) { Game.opts.shake = !Game.opts.shake; Game.saveSettings(); Sfx.play('menu'); }
    else if (toggle && m.sel === 3) { Game.opts.timer = !Game.opts.timer; Game.saveSettings(); Sfx.play('menu'); }
    if (m.t > 0.2 && ((Input.pressed('confirm') && m.sel === 4) || Input.pressed('back') || Input.pressed('pause'))) { this.pop(); Sfx.play('menu'); }
  },
  draw_settings(ctx, m) {
    ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, VW, VH);
    panel(ctx, VW / 2 - 220, 110, 440, 340);
    txt(ctx, '设 置', VW / 2, 150, 24, '#f6e2c0', 'center', SERIF, 1, 'bold');
    const bar = (y, v, sel, label) => {
      txt(ctx, label, VW / 2 - 170, y, 17, sel ? '#fff' : '#9c8f80');
      for (let i = 0; i < 10; i++) { ctx.fillStyle = i < Math.round(v * 10) ? (sel ? '#ffcf80' : '#8a6a40') : '#2a2630'; ctx.fillRect(VW / 2 - 20 + i * 17, y - 7, 13, 14); }
    };
    bar(205, Sfx.musicVolume, m.sel === 0, '音乐');
    bar(250, Sfx.sfxVolume, m.sel === 1, '音效');
    const sw = (y, on, sel, label) => { txt(ctx, label, VW / 2 - 170, y, 17, sel ? '#fff' : '#9c8f80'); txt(ctx, on ? '开' : '关', VW / 2 + 60, y, 17, on ? (sel ? '#ffcf80' : '#8a6a40') : '#5a5248', 'center'); };
    sw(295, Game.opts.shake, m.sel === 2, '画面震动');
    sw(340, Game.opts.timer, m.sel === 3, '显示计时');
    txt(ctx, '返回', VW / 2, 390, 18, m.sel === 4 ? '#fff' : '#9c8f80', 'center');
    txt(ctx, '← → 调节 / 切换', VW / 2, 425, 12, '#6a6058', 'center');
  },

  // ---------------- 暂停 ----------------
  openPause() { Game.state = 'pause'; this.push({ type: 'pause', items: ['继续', '地图', '灯饰', '灯下札记', '操作说明', '设置', '保存并回到标题'] }); Sfx.play('menu'); },
  closeToPlay() {
    // 只关闭暂停层及其子菜单，保留下面的对话/商店等
    while (this.stack.length) { const m = this.stack.pop(); if (m.type === 'pause' || (m.type === 'map' && m.direct)) break; }
    if (!this.stack.some(m => m.type === 'pause' || m.type === 'map')) Game.state = 'play';
  },
  upd_pause(m, dt) {
    this.navigate(m, m.items.length, dt);
    if (m.t > 0.15 && (Input.pressed('pause') || Input.pressed('back'))) { this.closeToPlay(); Sfx.play('menu'); return; }
    if (m.t > 0.15 && Input.pressed('confirm')) {
      Sfx.play('select');
      switch (m.sel) {
        case 0: this.closeToPlay(); break;
        case 1: this.push({ type: 'map' }); break;
        case 2: this.push({ type: 'charms', msg: '' }); break;
        case 3: this.push({ type: 'journal' }); break;
        case 4: this.push({ type: 'controls' }); break;
        case 5: this.push({ type: 'settings' }); break;
        case 6: this.push({ type: 'confirm', q: '回到标题？进度保存在最后休息的灯座。', yes: () => { Game.writeSave(); Game.toTitle(); } }); break;
      }
    }
  },
  draw_pause(ctx, m) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, VW, VH);
    txt(ctx, '暂 停', VW / 2, 150, 34, '#f6e2c0', 'center', SERIF, 1, 'bold');
    ornament(ctx, VW / 2, 180, 260);
    m.items.forEach((s, i) => {
      const y = 220 + i * 36, sel = i === m.sel;
      txt(ctx, s, VW / 2, y, 20, sel ? '#fff' : '#8a7f72', 'center');
      if (sel) for (const k of [-1, 1]) { ctx.fillStyle = '#ffcf80'; ctx.save(); ctx.translate(VW / 2 + k * 100, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore(); }
    });
    const S = Game.save;
    txt(ctx, `游戏时间 ${U.fmtTime(S.time)}   ·   倒下 ${S.deaths} 次   ·   收集 ${UI.completion()}%`, VW / 2, VH - 40, 13, '#8a7f72', 'center');
    // 旅程记录
    const st = this.stats(), x = VW - 210, y = 190;
    txt(ctx, '旅 程 记 录', x + 80, y - 30, 15, '#d8c8b0', 'center', SERIF);
    st.forEach((r, i) => {
      txt(ctx, r[0], x, y + i * 30, 14, '#9c8f80');
      txt(ctx, `${r[1]} / ${r[2]}`, x + 160, y + i * 30, 14, r[1] >= r[2] ? '#ffcf80' : '#d8ccb8', 'right');
    });
    // 已习得能力
    const ab = [['dash', '影步'], ['claw', '钩爪'], ['wings', '蛾翼'], ['spell', '烬火弹']];
    txt(ctx, '能 力', 130, y - 30, 15, '#d8c8b0', 'center', SERIF);
    ab.forEach(([k, n], i) => txt(ctx, S.abilities[k] ? n : '？？？', 130, y + i * 30, 15, S.abilities[k] ? ABILITY_INFO[k].color : '#4a443e', 'center'));
  },
  stats() {
    const S = Game.save; let hearts = 0, heartsGot = 0;
    for (const d of ROOM_DEFS) d.map.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === 'H') { hearts++; if (S.got[`${d.id}:H${x},${y}`]) heartsGot++; } });
    if (S.shop.heart) heartsGot++; hearts++;
    return [
      ['强敌', Object.values(S.bosses).filter(Boolean).length, Object.keys(BOSS_INFO).length],
      ['心核', heartsGot, hearts],
      ['灯饰', CHARM_ORDER.filter(id => S.charms.owned[id]).length, CHARM_ORDER.length],
      ['灯饰槽', S.notches, 5],
      ['足迹', Object.keys(S.visited).filter(id => ROOM_BY_ID[id] && !ROOM_BY_ID[id].hidden).length, ROOM_DEFS.filter(d => !d.hidden).length],
      ['菌光孢子', Game.sporeCount(), 3],
      ['钟声试炼', S.flags.trialDone ? 1 : 0, 1],
    ];
  },
  completion() {
    const S = Game.save; let have = 0, total = 0;
    for (const k of ['dash', 'claw', 'wings', 'spell']) { total++; if (S.abilities[k]) have++; }
    for (const k of ['rust', 'mother', 'kiln', 'moss']) { total++; if (S.bosses[k]) have++; }
    for (const d of ROOM_DEFS) if (!d.hidden) d.map.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === 'H' || row[x] === 'U' || row[x] === 'Q') { total++; if (S.got[`${d.id}:${row[x]}${x},${y}`]) have++; } });
    for (const it of SHOP_ITEMS) { if (it.charm) continue; total++; if (S.shop[it.id]) have++; }
    for (const id of CHARM_ORDER) { total++; if (S.charms.owned[id]) have++; }
    for (const d of ROOM_DEFS) { if (d.hidden) continue; total += 0.5; if (S.visited[d.id]) have += 0.5; }
    return Math.round(have / total * 100);
  },

  // ---------------- 地图 ----------------
  openMap() { Game.state = 'pause'; this.push({ type: 'map', direct: true }); Sfx.play('menu'); },
  upd_map(m) {
    if (m.t > 0.15 && (Input.pressed('map') || Input.pressed('back') || Input.pressed('pause') || Input.pressed('confirm'))) {
      this.pop(); Sfx.play('menu');
      if (!this.stack.some(m => m.type === 'pause' || m.type === 'map')) Game.state = 'play';
    }
  },
  miniCache: {},
  miniRoom(def) {
    let c = this.miniCache[def.id]; if (c) return c;
    const w = def.map[0].length, h = def.map.length;
    c = U.makeCanvas(w, h); const g = c.getContext('2d'), A = AREAS[def.area];
    const img = g.createImageData(w, h), d = img.data;
    const solid = hexToRgb(A.edge), emp = hexToRgb(A.sky[1]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = def.map[y][x], i = (y * w + x) * 4;
      const col = ch === '#' || ch === 'X' ? solid : ch === '^' ? [200, 90, 90] : ch === '=' ? hexToRgb(A.top) : emp;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = ch === '#' ? 150 : 255;
    }
    g.putImageData(img, 0, 0);
    return (this.miniCache[def.id] = c);
  },
  draw_map(ctx, m) {
    ctx.fillStyle = 'rgba(4,5,10,0.92)'; ctx.fillRect(0, 0, VW, VH);
    // 世界边界
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const d of ROOM_DEFS) { if (d.hidden) continue; x0 = Math.min(x0, d.x); y0 = Math.min(y0, d.y); x1 = Math.max(x1, d.x + d.map[0].length); y1 = Math.max(y1, d.y + d.map.length); }
    const sc = Math.min((VW - 80) / (x1 - x0), (VH - 150) / (y1 - y0));
    const ox = (VW - (x1 - x0) * sc) / 2 - x0 * sc, oy = 90 + ((VH - 150) - (y1 - y0) * sc) / 2 - y0 * sc;
    const S = Game.save;
    ctx.imageSmoothingEnabled = false;
    for (const d of ROOM_DEFS) {
      if (!S.visited[d.id] || d.hidden) continue;
      const w = d.map[0].length, h = d.map.length, rx = ox + d.x * sc, ry = oy + d.y * sc;
      ctx.drawImage(this.miniRoom(d), rx, ry, w * sc, h * sc);
      const cur = Game.room && Game.room.id === d.id;
      ctx.strokeStyle = cur ? 'rgba(255,220,160,0.9)' : rgba(AREAS[d.area].accent, 0.35); ctx.lineWidth = cur ? 2 : 1;
      ctx.strokeRect(rx + 0.5, ry + 0.5, w * sc - 1, h * sc - 1);
      // 标记
      d.map.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x], mx = rx + (x + 0.5) * sc, my = ry + (y + 0.5) * sc;
          if (ch === 'B') { ctx.fillStyle = '#ffcf80'; ctx.beginPath(); ctx.arc(mx, my - 2, 4, 0, 6.28); ctx.fill(); }
          if (ch === 'S') { ctx.fillStyle = '#9fe0a8'; ctx.fillRect(mx - 3, my - 5, 6, 6); }
          if (ch === 'K' && !S.bosses[d.boss]) { ctx.fillStyle = '#ff6a5a'; ctx.save(); ctx.translate(mx, my - 4); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore(); }
        }
      });
    }
    ctx.imageSmoothingEnabled = true;
    if (S.lost) {
      const d = ROOM_BY_ID[S.lost.room];
      const mx = ox + (d.x + S.lost.x / TILE) * sc, my = oy + (d.y + S.lost.y / TILE) * sc;
      glowDot(ctx, mx, my, 10, '#ffb860', 0.8);
      txt(ctx, '遗珀', mx, my - 12, 11, '#ffcf80', 'center');
    }
    if (Game.room && !Game.room.def.hidden) {
      const p = Game.player, r = Game.room;
      const mx = ox + (r.gx + p.cx / TILE) * sc, my = oy + (r.gy + p.cy / TILE) * sc;
      const bl = (Math.sin(this.t * 6) + 1) / 2;
      glowDot(ctx, mx, my, 14, '#fff4dc', 0.5 + bl * 0.4);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx, my, 3, 0, 6.28); ctx.fill();
    }
    txt(ctx, '地 图', VW / 2, 40, 26, '#f6e2c0', 'center', SERIF, 1, 'bold');
    if (Game.room) txt(ctx, `${Game.room.A.name.replace(/ /g, '')} · ${Game.room.name}`, VW / 2, 70, 14, '#b8a68e', 'center');
    // 图例
    const ly = VH - 26;
    ctx.fillStyle = '#ffcf80'; ctx.beginPath(); ctx.arc(VW / 2 - 200, ly, 4, 0, 6.28); ctx.fill(); txt(ctx, '灯座', VW / 2 - 190, ly, 12, '#9c8f80');
    ctx.fillStyle = '#9fe0a8'; ctx.fillRect(VW / 2 - 113, ly - 3, 6, 6); txt(ctx, '商人', VW / 2 - 100, ly, 12, '#9c8f80');
    ctx.fillStyle = '#ff6a5a'; ctx.fillRect(VW / 2 - 23, ly - 3, 6, 6); txt(ctx, '强敌', VW / 2 - 10, ly, 12, '#9c8f80');
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(VW / 2 + 70, ly, 3, 0, 6.28); ctx.fill(); txt(ctx, '你', VW / 2 + 80, ly, 12, '#9c8f80');
    txt(ctx, 'Tab / M 关闭', VW / 2 + 200, ly, 12, '#6a6058', 'center');
  },

  // ---------------- 对话 ----------------
  openDialog(name, lines, cb) { this.push({ type: 'dialog', name, lines, i: 0, shown: 0, cb }); },
  upd_dialog(m, dt) {
    const line = m.lines[m.i], before = Math.floor(m.shown);
    m.shown = Math.min(line.length, m.shown + dt * 38);
    if (Math.floor(m.shown) !== before && Math.floor(m.shown) % 3 === 0) Sfx.play('talk');
    if (m.t > 0.15 && (Input.pressed('confirm') || Input.pressed('attack') || Input.pressed('up'))) {
      if (m.shown < line.length) m.shown = line.length;
      else {
        m.i++; m.shown = 0; Sfx.play('menu');
        if (m.i >= m.lines.length) { this.pop(); m.cb && m.cb(); }
      }
    }
  },
  draw_dialog(ctx, m) {
    const x = 130, y = VH - 170, w = VW - 260, h = 130;
    panel(ctx, x, y, w, h, 0.88);
    txt(ctx, m.name, x + 28, y + 26, 16, '#ffcf80', 'left', FONT, 1, 'bold');
    ctx.font = `17px ${FONT}`;
    const line = m.lines[m.i] || '', shown = line.slice(0, Math.floor(m.shown));
    const ls = wrapText(ctx, shown, w - 60);
    ls.forEach((s, i) => txt(ctx, s, x + 28, y + 60 + i * 26, 17, '#efe4d2'));
    if (m.shown >= line.length) {
      const b = Math.sin(this.t * 6) * 2;
      ctx.fillStyle = '#ffcf80'; ctx.beginPath(); ctx.moveTo(x + w - 30, y + h - 22 + b); ctx.lineTo(x + w - 20, y + h - 22 + b); ctx.lineTo(x + w - 25, y + h - 15 + b); ctx.fill();
    }
  },

  // ---------------- 商店 ----------------
  openShop(cb) { this.push({ type: 'shop', cb, greet: DIALOG.gado.first[0], msg: '' }); },
  upd_shop(m, dt) {
    const n = SHOP_ITEMS.length + 1;
    this.navigate(m, n, dt);
    if (m.t > 0.2 && Input.pressed('back')) { this.pop(); m.cb && m.cb(); Sfx.play('menu'); return; }
    if (m.t > 0.2 && Input.pressed('confirm')) {
      if (m.sel === SHOP_ITEMS.length) { this.pop(); m.cb && m.cb(); Sfx.play('menu'); return; }
      const it = SHOP_ITEMS[m.sel], S = Game.save;
      if (S.shop[it.id]) { m.msg = '这个已经卖给你啦。'; Sfx.play('deny'); }
      else if (S.amber < it.price) { m.msg = '琥珀不够哦，小家伙。'; Sfx.play('deny'); }
      else {
        S.amber -= it.price; S.shop[it.id] = 1; Sfx.play('buy');
        if (it.id === 'heart') { S.maxHp++; S.hp = Game.maxHp(); }
        if (it.id === 'blade') S.blade = 2;
        if (it.id === 'notch') S.notches++;
        if (it.charm) S.charms.owned[it.charm] = 1;
        m.msg = '嘿嘿，好眼光！'; Game.writeSave();
      }
    }
  },
  draw_shop(ctx, m) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, VW, VH);
    const x = 200, y = 24, w = 560, h = 492;
    panel(ctx, x, y, w, h);
    txt(ctx, '旅商 · 噶朵', x + w / 2, y + 34, 22, '#f6e2c0', 'center', SERIF, 1, 'bold');
    txt(ctx, m.msg || m.greet, x + w / 2, y + 66, 14, '#b8a68e', 'center');
    const S = Game.save;
    SHOP_ITEMS.forEach((it, i) => {
      const yy = y + 104 + i * 48, sel = m.sel === i, own = S.shop[it.id];
      if (sel) { ctx.fillStyle = 'rgba(255,207,128,0.08)'; ctx.fillRect(x + 20, yy - 20, w - 40, 44); }
      txt(ctx, (sel ? '◆ ' : '   ') + it.name, x + 36, yy - 6, 18, own ? '#5a5248' : sel ? '#fff' : '#d8ccb8');
      txt(ctx, it.desc, x + 62, yy + 13, 13, own ? '#4a443e' : '#9c8f80');
      txt(ctx, own ? '已售出' : `${it.price} 琥珀`, x + w - 40, yy - 6, 16, own ? '#5a5248' : S.amber >= it.price ? '#ffcf80' : '#a05a4a', 'right');
    });
    const ly = y + 104 + SHOP_ITEMS.length * 48;
    txt(ctx, (m.sel === SHOP_ITEMS.length ? '◆ ' : '   ') + '离开', x + 36, ly - 6, 18, m.sel === SHOP_ITEMS.length ? '#fff' : '#9c8f80');
    txt(ctx, `持有琥珀：${S.amber}`, x + w - 40, ly - 6, 15, '#ffcf80', 'right');
  },

  // ---------------- 灯语传送 ----------------
  openTravel(cb) {
    const ids = ROOM_DEFS.map(d => d.id).filter(id => Game.save.benches[id]);
    this.push({ type: 'travel', ids, cb, sel: Math.max(0, ids.indexOf(Game.room.id)) });
    Sfx.play('menu');
  },
  upd_travel(m, dt) {
    this.navigate(m, m.ids.length, dt);
    const close = () => { this.pop(); m.cb && m.cb(); Game.sitGuard = 0.25; };
    if (m.t > 0.15 && (Input.pressed('back') || Input.pressed('pause'))) { close(); Sfx.play('menu'); return; }
    if (m.t > 0.15 && Input.pressed('confirm')) {
      const id = m.ids[m.sel]; close();
      if (id !== Game.room.id) Game.travelTo(id); else Sfx.play('menu');
    }
  },
  draw_travel(ctx, m) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, VW, VH);
    const h = 110 + m.ids.length * 40, y0 = (VH - h) / 2;
    panel(ctx, VW / 2 - 200, y0, 400, h);
    txt(ctx, '灯 语 传 送', VW / 2, y0 + 36, 22, '#f6e2c0', 'center', SERIF, 1, 'bold');
    ornament(ctx, VW / 2, y0 + 60, 200);
    m.ids.forEach((id, i) => {
      const d = ROOM_BY_ID[id], sel = i === m.sel, here = id === Game.room.id;
      txt(ctx, (sel ? '◆ ' : '   ') + `${AREAS[d.area].name.replace(/ /g, '')} · ${d.name}` + (here ? '（此处）' : ''), VW / 2 - 150, y0 + 90 + i * 40, 17, sel ? '#fff' : '#9c8f80');
    });
  },

  // ---------------- 灯饰 ----------------
  atBench() { const S = Game.save; return Game.player.state === 'sit' && !!S.bench && Game.room && S.bench.room === Game.room.id; },
  upd_charms(m, dt) {
    const owned = CHARM_ORDER.filter(id => Game.save.charms.owned[id]);
    m.owned = owned;
    if (!owned.length) { if (m.t > 0.15 && (Input.pressed('back') || Input.pressed('confirm') || Input.pressed('pause'))) { this.pop(); Sfx.play('menu'); } return; }
    m.sel = Math.min(m.sel, owned.length - 1);
    this.navigate(m, owned.length, dt);
    if (m.t > 0.15 && (Input.pressed('back') || Input.pressed('pause'))) { this.pop(); Sfx.play('menu'); return; }
    if (m.t > 0.15 && Input.pressed('confirm')) {
      if (!UI.atBench()) { m.msg = '只能在灯座旁休息时更换灯饰。'; Sfx.play('deny'); return; }
      const r = Game.toggleCharm(owned[m.sel]);
      m.msg = r === 'full' ? '灯饰槽不够了。' : r === 'on' ? '已装备。' : '已卸下。';
      Game.writeSave();
    }
  },
  draw_charms(ctx, m) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, VW, VH);
    panel(ctx, 140, 40, 680, 460);
    txt(ctx, '灯 饰', VW / 2, 78, 26, '#f6e2c0', 'center', SERIF, 1, 'bold');
    ornament(ctx, VW / 2, 102, 220);
    const S = Game.save, used = Game.notchesUsed();
    // 槽位
    for (let i = 0; i < S.notches; i++) {
      const x = VW / 2 - (S.notches - 1) * 14 + i * 28, y = 128;
      ctx.strokeStyle = '#d8b880'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 8, 0, 6.28); ctx.stroke();
      if (i < used) { ctx.fillStyle = '#ffcf80'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.28); ctx.fill(); }
    }
    const owned = m.owned || CHARM_ORDER.filter(id => S.charms.owned[id]);
    if (!owned.length) { txt(ctx, '你还没有找到任何灯饰。', VW / 2, 260, 16, '#9c8f80', 'center'); return; }
    owned.forEach((id, i) => {
      const c = CHARMS[id], y = 168 + i * 40, sel = i === m.sel, on = S.charms.equipped.includes(id);
      if (sel) { ctx.fillStyle = 'rgba(255,207,128,0.08)'; ctx.fillRect(170, y - 18, 620, 36); }
      ctx.fillStyle = c.color; ctx.save(); ctx.translate(196, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-6, -6, 12, 12); ctx.restore();
      if (on) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.save(); ctx.translate(196, y); ctx.rotate(Math.PI / 4); ctx.strokeRect(-9, -9, 18, 18); ctx.restore(); }
      txt(ctx, c.name, 222, y, 17, on ? '#fff4dc' : sel ? '#e8dcc8' : '#9c8f80');
      txt(ctx, c.desc, 340, y, 14, sel ? '#c8b8a0' : '#7a7064');
      for (let k = 0; k < c.cost; k++) { ctx.fillStyle = on ? '#ffcf80' : '#5a5040'; ctx.beginPath(); ctx.arc(760 - k * 14, y, 4.5, 0, 6.28); ctx.fill(); }
    });
    const sitting = UI.atBench();
    txt(ctx, m.msg || (sitting ? 'Z / 确认：装备或卸下' : '在灯座旁休息时才能更换灯饰'), VW / 2, 478, 13, '#b8a68e', 'center');
  },

  // ---------------- HUD ----------------
  drawHUD(ctx) {
    const S = Game.save, p = Game.player;
    if (!S) return;
    // 灵焰之球
    const ox = 52, oy = 52, R = 30;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(ox, oy, R + 4, 0, 6.28); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(ox, oy, R, 0, 6.28); ctx.clip();
    const lvl = S.soul / P.SOUL_MAX, top = oy + R - lvl * R * 2;
    const g = ctx.createLinearGradient(0, top, 0, oy + R);
    g.addColorStop(0, '#fff4d6'); g.addColorStop(1, '#ff9a40');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(ox - R, oy + R);
    for (let i = 0; i <= 20; i++) { const x = ox - R + i * R / 10; ctx.lineTo(x, top + Math.sin(this.t * 3 + i * 0.6) * 2.5); }
    ctx.lineTo(ox + R, oy + R); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = S.soul >= P.SOUL_COST ? '#ffe2a8' : '#8a7a64'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(ox, oy, R, 0, 6.28); ctx.stroke();
    if (S.soul >= P.SOUL_COST) glowDot(ctx, ox, oy, R * 1.6, '#ffb860', 0.15 + Math.sin(this.t * 3) * 0.05);
    // 低血量：红色暗角脉动
    if (S.hp > 0 && S.hp <= (S.difficulty === 'hard' ? 2 : 1) && Game.state !== 'title') {
      const k = (Math.sin(this.t * 5) + 1) / 2;
      const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VH * 0.9);
      vg.addColorStop(0, 'rgba(120,0,0,0)'); vg.addColorStop(1, `rgba(140,10,10,${0.25 + k * 0.2})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
    }
    // 生命：小提灯
    const MH = Game.maxHp();
    for (let i = 0; i < MH; i++) {
      const x = 100 + i * 26, y = 38, full = i < S.hp, extra = i >= S.maxHp + (S.difficulty === 'easy' ? 3 : 0);
      ctx.fillStyle = '#1a1620'; ctx.fillRect(x - 7, y - 10, 14, 22);
      ctx.fillStyle = full ? '#3a2a1c' : '#221c18'; ctx.fillRect(x - 8, y - 12, 16, 3); ctx.fillRect(x - 8, y + 10, 16, 3);
      if (full) {
        const fl = 0.85 + Math.sin(this.t * 8 + i) * 0.15;
        glowDot(ctx, x, y, 16, '#ffb860', 0.3);
        ctx.fillStyle = extra ? '#ff8a7a' : '#ffb347'; ctx.fillRect(x - 5, y - 8, 10, 17);
        ctx.fillStyle = '#fff4d6'; ctx.fillRect(x - 2, y - 4, 4, 9 * fl);
      } else {
        ctx.strokeStyle = '#4a3e34'; ctx.lineWidth = 1; ctx.strokeRect(x - 5, y - 8, 10, 17);
      }
    }
    // 琥珀
    const ay = 74, pulse = Game.amberPulse > 0 ? 1 + Game.amberPulse : 1;
    ctx.save(); ctx.translate(108, ay); ctx.scale(pulse, pulse);
    ctx.fillStyle = '#e8942e'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0); ctx.fill();
    ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(3, -1); ctx.lineTo(-4, 0); ctx.fill();
    ctx.restore();
    txt(ctx, String(Math.round(Game.amberShow)), 122, ay + 1, 18, '#f0e2cc', 'left', FONT, 1, 'bold');

    // 灯座传送提示
    if (p.state === 'sit' && !Game.dialog && !Game.popup && Object.keys(S.benches || {}).length >= 2 && Game.state === 'play') {
      const x = p.cx - Game.cam.vx, y = p.y - Game.cam.vy - 52 + Math.sin(this.t * 4) * 2;
      txt(ctx, '↑ 灯语传送', x, y, 13, 'rgba(246,226,192,0.8)', 'center');
    }
    if (Game.opts.timer && Game.state !== 'title') txt(ctx, U.fmtTime(S.time) + '.' + String(Math.floor((S.time % 1) * 10)), VW - 16, document.querySelector('.tc-top') ? 70 : 22, 14, 'rgba(240,226,204,0.8)', 'right');
    // 交互提示
    const it = Game.interactTarget;
    if (it && !Game.dialog) {
      const x = it.cx - Game.cam.vx, y = it.y - Game.cam.vy - 18 + Math.sin(this.t * 4) * 2;
      ctx.font = `14px ${FONT}`; const w = ctx.measureText(it.prompt).width + 36;
      ctx.fillStyle = 'rgba(8,8,14,0.8)'; ctx.fillRect(x - w / 2, y - 13, w, 26);
      ctx.strokeStyle = 'rgba(255,220,170,0.5)'; ctx.strokeRect(x - w / 2 + 0.5, y - 12.5, w - 1, 25);
      txt(ctx, '↑ ' + it.prompt, x, y, 14, '#f6e2c0', 'center');
    }
    // Boss 血条
    const b = Game.boss;
    if (b && !b.dead && b.mode !== 'sleep') {
      const w = 520, x = VW / 2 - w / 2, y = VH - 34;
      const k = b.hp / b.maxHp;
      b.shownHp = b.shownHp === undefined ? k : U.approach(b.shownHp, k, 0.004);
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 3, y - 3, w + 6, 14);
      ctx.fillStyle = '#5a2020'; ctx.fillRect(x, y, w * b.shownHp, 8);
      ctx.fillStyle = b.bossId === 'mother' ? '#c070ff' : b.bossId === 'moss' ? '#8fd0a0' : '#e0904a'; ctx.fillRect(x, y, w * k, 8);
      const info = BOSS_INFO[b.bossId];
      txt(ctx, `${info.name} · ${info.title.replace(/ /g, '')}`, VW / 2, y - 14, 14, '#e8dcc8', 'center', SERIF);
    }
  },
  drawOverlays(ctx) {
    const G = Game;
    // 区域标题
    if (G.areaCard && !G.popup && !this.stack.length) {
      const t = G.areaCard.t, a = t < 0.8 ? t / 0.8 : t > 3.2 ? Math.max(0, 1 - (t - 3.2)) : 1;
      txt(ctx, G.areaCard.name, VW / 2, 150, 44, '#f6e2c0', 'center', SERIF, a, 'bold');
      ornament(ctx, VW / 2, 185, 320 * Math.min(1, t * 1.5), a);
      txt(ctx, G.areaCard.sub, VW / 2, 205, 14, '#c8b8a0', 'center', FONT, a * 0.8);
    }
    if (G.bossCard && !G.popup && !this.stack.length) {
      const t = G.bossCard.t, a = t < 0.6 ? t / 0.6 : t > 2.6 ? Math.max(0, 1 - (t - 2.6)) : 1;
      txt(ctx, G.bossCard.name, 70, VH - 140, 20, '#d8c8b0', 'left', SERIF, a);
      txt(ctx, G.bossCard.title, 66, VH - 96, 56, '#fff4dc', 'left', SERIF, a, 'bold');
    }
    // 提示
    G.toasts.forEach((tt, i) => {
      const a = Math.min(1, tt.t * 3, (tt.dur - tt.t) * 2);
      ctx.font = `15px ${FONT}`; const w = ctx.measureText(tt.text).width + 40;
      const y = 26 + i * 34;
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(6,7,14,0.75)'; ctx.fillRect(VW / 2 - w / 2, y - 14, w, 28); ctx.globalAlpha = 1;
      txt(ctx, tt.text, VW / 2, y, 15, '#f0e2cc', 'center', FONT, a);
    });
    // 获得能力
    if (G.popup) {
      const pp = G.popup, a = Math.min(1, pp.t * 2);
      ctx.fillStyle = `rgba(0,0,0,${0.65 * a})`; ctx.fillRect(0, 0, VW, VH);
      glowDot(ctx, VW / 2, VH / 2 - 60, 180, pp.color, 0.25 * a);
      txt(ctx, pp.kind === 'ability' ? '习得能力' : '获得', VW / 2, VH / 2 - 110, 15, '#c8b8a0', 'center', FONT, a);
      txt(ctx, pp.title, VW / 2, VH / 2 - 60, 52, '#fff4dc', 'center', SERIF, a, 'bold');
      ornament(ctx, VW / 2, VH / 2 - 20, 360, a);
      txt(ctx, pp.desc, VW / 2, VH / 2 + 15, 18, '#efe4d2', 'center', FONT, a);
      txt(ctx, pp.keys, VW / 2, VH / 2 + 52, 15, pp.color, 'center', FONT, a);
      if (pp.t > 1.2) txt(ctx, '按 Z / 确认 继续', VW / 2, VH / 2 + 110, 12, '#8a7f72', 'center', FONT, 0.6 + Math.sin(this.t * 4) * 0.3);
    }
  },
  drawMenus(ctx) {
    for (const m of this.stack) { const fn = this['draw_' + m.type]; if (fn) fn.call(this, ctx, m); }
  },

  // ---------------- 开场 ----------------
  drawIntro(ctx) {
    const t = Game.intro ? Game.intro.t : 0;
    ctx.fillStyle = '#030306'; ctx.fillRect(0, 0, VW, VH);
    const lines = [
      [0.5, '很久以前，地下诸国靠灯火而活。'],
      [2.6, '直到一只巨蛾在深渊里筑了巢，把光一口一口吞了下去。'],
      [4.9, '灯一盏接一盏地熄灭，王国也随之沉入黑暗。'],
      [7.2, '如今，只剩下你手里的这一点余烬。'],
    ];
    lines.forEach(([at, s], i) => txt(ctx, s, VW / 2, 170 + i * 46, 20, '#e8d8c0', 'center', SERIF, U.clamp((t - at) / 1.4, 0, 1)));
    const a = U.clamp((t - 9.2) / 1.5, 0, 1);
    if (a > 0) { glowDot(ctx, VW / 2, 400, 60 + Math.sin(t * 6) * 4, '#ffb860', 0.5 * a); glowDot(ctx, VW / 2, 400, 14, '#fff4dc', a); }
    txt(ctx, '按 Z 跳过', VW - 20, VH - 18, 12, '#5a5248', 'right');
  },

  // ---------------- 结局 ----------------
  drawEnding(ctx) {
    const E = Game.ending, t = E.t, S = Game.save;
    const k = Math.min(1, t / 4);
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, mixHex('#000000', '#2a1a10', k)); g.addColorStop(1, mixHex('#000000', '#4a2a14', k));
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    glowDot(ctx, VW / 2, VH + 40, 500 * k, '#ffb860', 0.35);
    ctx.globalCompositeOperation = 'lighter';
    for (const e of this.embers) { ctx.fillStyle = `rgba(255,${170 + e.s * 30 | 0},90,${(0.25 + e.s * 0.25) * k})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.s * 1.4, 0, 6.28); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    const lines = [
      [1.0, '噬光之母倒下了。'],
      [2.6, '被她吞下的光，化作无数火星，从深渊升向地表。'],
      [4.4, '苔径的萤火重新亮起，沉钟回廊里传来久违的钟声。'],
      [6.2, '而你手中的那点余烬——'],
      [7.6, '终于不再孤单。'],
    ];
    if (E.complete === undefined) E.complete = this.completion() >= 100;
    if (E.complete) lines.push([8.8, '……而在霜心秘库的冰层深处，一点新的火苗，悄悄亮了起来。']);
    lines.forEach(([at, s], i) => {
      const a = U.clamp((t - at) / 1.2, 0, 1);
      txt(ctx, s, VW / 2, 110 + i * 38, i === 5 ? 17 : 20, i === 5 ? '#bfe8ff' : '#f6e2c0', 'center', SERIF, a);
    });
    const a2 = U.clamp((t - 9.5) / 1.5, 0, 1);
    if (a2 > 0) {
      txt(ctx, '烬  灯', VW / 2, 365, 44, '#fff4dc', 'center', SERIF, a2, 'bold');
      ornament(ctx, VW / 2, 395, 260, a2);
      txt(ctx, `通关时间 ${U.fmtTime(S.time)}   ·   倒下 ${S.deaths} 次   ·   收集 ${this.completion()}%`, VW / 2, 425, 15, '#d8c0a0', 'center', FONT, a2);
      txt(ctx, '感谢游玩', VW / 2, 462, 15, '#b8a080', 'center', FONT, a2);
      if (t > 11) txt(ctx, '按 Z / 确认 回到标题（存档保留，可继续探索）', VW / 2, VH - 24, 12, '#8a7060', 'center', FONT, 0.6 + Math.sin(this.t * 3) * 0.3);
    }
  },
};
