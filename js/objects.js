'use strict';
// ============================================================
//  场景物件：灯座、NPC、商人、琥珀矿、拾取物、遗珀
// ============================================================
const ABILITY_INFO = {
  dash: { name: '影 步', desc: '如影般向前疾冲，可越过荆棘与深渊。', keys: '按 C / L / Shift（手柄 RB）冲刺 · 空中可用，落地或贴墙后恢复', color: '#9aa6ff' },
  claw: { name: '钩 爪', desc: '贴住墙壁便能缓缓滑落，并从墙上蹬起。', keys: '空中贴墙时按住方向滑落 · 按跳跃蹬墙跳', color: '#f2c27b' },
  spell: { name: '烬火弹', desc: '将灵焰凝成火弹掷出，可贯穿敌人、击碎灵焰封印。', keys: '按 F / U（手柄 Y）施放 · 消耗 33 灵焰', color: '#ff9a40' },
  wings: { name: '蛾 翼', desc: '一对仍在微微发光的蛾翼，让你在空中再跃一次。', keys: '空中再按一次跳跃 → 二段跳', color: '#f0a8ff' },
};

const CHARMS = {
  swift: { name: '疾风羽', cost: 1, desc: '移动速度提升 15%。', color: '#c9f0ff' },
  longedge: { name: '长刃坠', cost: 2, desc: '挥刀范围扩大约 30%。', color: '#f2e2c0' },
  siphon: { name: '灵吸石', cost: 2, desc: '每次命中额外获得灵焰。', color: '#ffd38a' },
  hardshell: { name: '坚壳护符', cost: 2, desc: '受伤后的无敌时间延长。', color: '#b8d0a0' },
  bloom: { name: '疾愈花', cost: 2, desc: '聚焦回血的速度大幅提升。', color: '#9fe0a8' },
  emberheart: { name: '余烬之心', cost: 3, desc: '生命上限 +2。', color: '#ff9a8a' },
  blaze: { name: '烈焰坠', cost: 2, desc: '烬火弹的伤害与体积提升。', color: '#ff9a40' },
  sporecrown: { name: '孢光冠', cost: 2, desc: '灵焰会缓慢地自动回复。', color: '#e09cff' },
  thorns: { name: '荆棘环', cost: 1, desc: '受伤时，荆棘刺伤身边的敌人。', color: '#ff9ec8' },
};
const CHARM_ORDER = ['swift', 'longedge', 'siphon', 'hardshell', 'bloom', 'emberheart', 'blaze', 'thorns', 'sporecrown'];

const SHOP_ITEMS = [
  { id: 'heart', name: '心灯碎核', price: 200, desc: '生命上限 +1。' },
  { id: 'charm', name: '拾珀铃', price: 120, desc: '大幅扩大吸取琥珀的范围。' },
  { id: 'notch', name: '灯饰槽', price: 250, desc: '可装备的灯饰槽位 +1。' },
  { id: 'c_longedge', charm: 'longedge', name: '灯饰 · 长刃坠', price: 220, desc: '挥刀范围扩大约 30%。' },
  { id: 'c_siphon', charm: 'siphon', name: '灯饰 · 灵吸石', price: 180, desc: '每次命中额外获得灵焰。' },
  { id: 'c_emberheart', charm: 'emberheart', name: '灯饰 · 余烬之心', price: 300, desc: '生命上限 +2（需 3 槽）。' },
  { id: 'blade', name: '淬火刀刃', price: 320, desc: '刀刃伤害提升 50%。' },
];

const DIALOG = {
  oren: {
    name: '老守灯人 · 欧伦',
    first: [
      '……啊，又一盏灯醒了。',
      '孩子，你手里那点火，是烬渊里最后的余烬之一。',
      '很久以前，地下诸国靠灯火维生。直到「噬光之母」在深渊里筑巢，把光一口一口吞了下去。',
      '往东走吧。苔径之后是沉钟回廊，再往下……就是深渊。',
      '看见灯座就歇一歇——它会记住你。若你倒下，你的火会在那里重燃。',
      '倒下时，你身上的琥珀会留在原地。回去触碰它，就能拿回来。',
      '击中敌人能积攒「灵焰」。在地面长按 V 或 I，就能把灵焰化作生命。',
    ],
    again: [['愿你的灯不灭。'], ['东边的歇所里住着个商人。琥珀能换来好东西。'], ['竖井里那片荆棘，没有特别的步法可过不去。'], ['有些墙看起来……不太结实。']],
  },
  bell: {
    name: '钟楼的残响',
    first: [
      '……当——……当——',
      '我是这座钟楼最后的敲钟人……或者说，是他留下的回声。',
      '隔壁大厅里的「锈钟守卫 · 卡隆」，从前守护着钟声。光被吞噬后，他只剩下守护本身。',
      '击败他的人，会得到他的「影步」——如影般疾行，越过荆棘。',
      '苔径的竖井底下有一片荆棘。越过它，就是通往深渊的路。',
    ],
    again: [['当——……'], ['卡隆跃起时，落地会掀起冲击波。跳起来避开。'], ['他冲撞到墙上时，会短暂失神。']],
    after: [['钟声停了……这样也好。往下走吧，提灯者。']],
  },
  sera: {
    name: '迷途学者 · 赛菈',
    first: [
      '别靠太近！……哦，你身上有光。真难得。',
      '我在研究这些菌丝。它们吞下光来进食，自己却又会发亮。很讽刺，对吧？',
      '下面的深坑里躺着一对蛾翼。以前的提灯者靠它在空中再跃一次。',
      '巢就在东边。母巢会放出光球、俯冲……愤怒时还会召来她的孩子。',
      '如果你赢了……请让光回到这里。',
    ],
    again: [['东边的深坑太宽了，光靠影步过不去。'], ['母巢俯冲之前会颤抖。看准时机闪开。'], ['那座巢……我能听见它在呼吸。']],
  },
  hel: {
    name: '铸匠 · 赫尔',
    first: [
      '哈！好久没见过会走路的火苗了。',
      '这座熔窑从前替整个地下锻造灯盏。光没了，炉子也就疯了。',
      '里头那个「熔炉看守 · 伊格」，肚子里还烧着最后一炉火。',
      '要是你能打赢他，就把那炉火收进你的灯里——它能被掷出去，叫「烬火弹」。',
      '世上有些墙上流着灵焰的纹路，刀砍不动。用烬火弹试试。',
      '我记得……苔径的入口附近就有一面。',
    ],
    again: [['熔岩别碰，碰了就是一身焦糊味。'], ['伊格砸地之前会举起双臂。看见了就赶紧挪开。'], ['火弹会把敌人一路烧穿过去，排成一排更划算。']],
  },
  gado: {
    name: '旅商 · 噶朵',
    first: ['嘿嘿，提灯的小家伙。琥珀，我收；好东西，我卖。'],
  },
};

class GameObject {
  constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; this.dead = false; this.t = Math.random() * 10; this.hittable = false; }
  get cx() { return this.x + this.w / 2; }
  box() { return this; }
  update(dt) { this.t += dt; }
  draw(ctx) { }
  lights() { }
}

// ---------------- 灯座（存档点） ----------------
class Bench extends GameObject {
  constructor(tx, ty) { super(tx * TILE + TILE / 2 - 24, (ty + 1) * TILE - 46, 48, 46); this.prompt = '休息'; }
  get lit() { return Game.save.bench && Game.save.bench.room === Game.room.id; }
  interact() { Game.restAtBench(this); }
  update(dt) {
    super.update(dt);
    if (Math.random() < dt * (this.lit ? 8 : 3)) {
      Game.particles.add({ x: this.cx + U.rand(-4, 4), y: this.y + 8, vx: U.rand(-10, 10), vy: U.rand(-50, -20), life: U.rand(0.8, 1.6), size: U.rand(1, 2.2), color: '#ffcf80', glow: true, drag: 0.99 });
    }
  }
  draw(ctx) {
    const x = this.cx, by = this.y + this.h;
    ctx.fillStyle = '#2b2a33';
    ctx.beginPath(); ctx.moveTo(x - 24, by); ctx.lineTo(x - 20, by - 8); ctx.lineTo(x + 20, by - 8); ctx.lineTo(x + 24, by); ctx.fill();
    ctx.fillStyle = '#3b3a46'; ctx.fillRect(x - 6, by - 30, 12, 22);
    ctx.fillStyle = '#4c4a5a'; ctx.fillRect(x - 18, by - 12, 36, 4);
    // 灯碗
    ctx.fillStyle = '#5a4a3a';
    ctx.beginPath(); ctx.moveTo(x - 14, by - 34); ctx.quadraticCurveTo(x, by - 22, x + 14, by - 34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a6448'; ctx.fillRect(x - 15, by - 35, 30, 2.5);
    // 火焰
    const f = 1 + Math.sin(this.t * 9) * 0.08 + Math.sin(this.t * 13.7) * 0.06, s = this.lit ? 1.35 : 0.85;
    ctx.fillStyle = '#ff9d3a';
    ctx.beginPath(); ctx.moveTo(x - 7 * s, by - 36); ctx.quadraticCurveTo(x - 6 * s, by - 46 * f * s - 0, x, by - 36 - 18 * f * s); ctx.quadraticCurveTo(x + 6 * s, by - 46 * f * s, x + 7 * s, by - 36); ctx.fill();
    ctx.fillStyle = '#fff2c8';
    ctx.beginPath(); ctx.moveTo(x - 3 * s, by - 36); ctx.quadraticCurveTo(x - 2, by - 42 * s, x, by - 36 - 9 * f * s); ctx.quadraticCurveTo(x + 2, by - 42 * s, x + 3 * s, by - 36); ctx.fill();
  }
  lights() { Light.add(this.cx, this.y + 4, this.lit ? 260 : 170, '#ffb860', 1, this.lit ? 0.4 : 0.28); }
}

// ---------------- NPC ----------------
class NPC extends GameObject {
  constructor(tx, ty, id) { super(tx * TILE + TILE / 2 - 16, (ty + 1) * TILE - 44, 32, 44); this.id = id; this.prompt = '交谈'; this.facing = -1; }
  interact() {
    const D = DIALOG[this.id], S = Game.save, key = 'talk_' + this.id;
    let lines;
    if (this.id === 'sera' && S.flags[key] && !S.flags.seraDone) {
      const n = Game.sporeCount();
      if (n >= 3) {
        S.flags.seraDone = 1;
        Game.startDialog(D.name, ['这、这是……三颗菌光孢子！全都还活着！', '它们吞下的光，又被它们自己重新点亮了。也许黑暗并不是终点。', '这个给你——我用孢子的菌丝编的冠。戴着它，你的灵焰会自己慢慢长回来。'], () => Game.gainCharm('sporecrown'));
      } else {
        S.flags.seraAsked = 1;
        Game.startDialog(D.name, ['对了，提灯者……如果你在路上看见会发光的孢子，能帮我带回来吗？', '我听说一颗在隧道的高处，一颗在深坑底，还有一颗……在冰里的什么地方。', `（已收集 ${n} / 3）`]);
      }
      return;
    }
    if (this.id === 'bell' && S.bosses.mother) {
      S.flags[key] = 1;
      Game.startDialog(D.name, ['……钟声又在我耳边回响了。', '那些被你击败的强敌，回声仍困在钟里。', '敲响它吧——若你能平息所有回声……'], () => {
        Game.dialog = true;
        UI.push({ type: 'confirm', q: '开始「钟声试炼」？连战四位强敌，倒下不会遗失琥珀。', yes: () => { Game.dialog = null; Game.startTrial(); }, no: () => { Game.dialog = null; } });
      });
      return;
    }
    else if (!S.flags[key]) { lines = D.first; S.flags[key] = 1; }
    else if (D.after && this.id === 'bell' && S.bosses.rust) lines = U.pick(D.after);
    else lines = U.pick(D.again);
    Game.startDialog(D.name, lines);
  }
  update(dt) {
    super.update(dt);
    const p = Game.player; this.facing = p.cx < this.cx ? -1 : 1;
  }
  draw(ctx) {
    const x = this.cx, by = this.y + this.h;
    ctx.save(); ctx.translate(x, by); ctx.scale(this.facing, 1);
    const br = Math.sin(this.t * 1.8) * 1;
    if (this.id === 'oren') {
      // 驼背老者，长杖挂灯
      ctx.strokeStyle = '#5a4a38'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(16, -46); ctx.stroke();
      ctx.fillStyle = '#ffb860'; ctx.fillRect(15, -44, 6, 7);
      ctx.fillStyle = '#3d3a32';
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-16, -26, -2, -34 + br); ctx.quadraticCurveTo(12, -30 + br, 12, 0); ctx.fill();
      ctx.fillStyle = '#4d493f'; ctx.beginPath(); ctx.arc(4, -32 + br, 9, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#d8d0b8'; ctx.beginPath(); ctx.moveTo(4, -26 + br); ctx.lineTo(12, -24 + br); ctx.lineTo(6, -12 + br); ctx.fill(); // 胡须
      ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(8, -33 + br, 1.3, 0, 6.28); ctx.fill();
    } else if (this.id === 'bell') {
      // 半透明回声，钟形身体
      ctx.globalAlpha = 0.55 + Math.sin(this.t * 2) * 0.15;
      ctx.fillStyle = '#9fb4e8';
      ctx.beginPath(); ctx.moveTo(-14, -2); ctx.quadraticCurveTo(-12, -30 + br, 0, -36 + br); ctx.quadraticCurveTo(12, -30 + br, 14, -2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#dfe8ff'; ctx.beginPath(); ctx.arc(0, -40 + br, 4, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#1a2240'; ctx.beginPath(); ctx.arc(3, -22 + br, 2, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(-3, -22 + br, 2, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (this.id === 'hel') {
      // 铸匠：敦实，围裙与大锤
      ctx.strokeStyle = '#4a3a30'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(-18, -36); ctx.stroke();
      ctx.fillStyle = '#5a5a60'; ctx.fillRect(-26, -44, 16, 10);
      ctx.fillStyle = '#3a2a22'; ctx.beginPath(); ctx.ellipse(0, -16, 15, 17 + br * 0.5, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#6a4a30'; ctx.fillRect(-8, -24, 16, 20);
      ctx.fillStyle = '#2a1e18'; ctx.beginPath(); ctx.arc(2, -34 + br, 9, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#ff9a40'; ctx.fillRect(1, -36 + br, 3, 2); ctx.fillRect(6, -36 + br, 3, 2);
      ctx.fillStyle = '#8a8a90'; ctx.fillRect(-6, -44 + br, 16, 4);
    } else if (this.id === 'sera') {
      // 学者：大帽子，背着瓶罐
      ctx.fillStyle = '#4a3a5e'; ctx.fillRect(-14, -30 + br, 9, 14); // 背包
      ctx.fillStyle = '#e09cff'; ctx.fillRect(-12, -27 + br, 5, 6);
      ctx.fillStyle = '#2e2440';
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-6, -26 + br); ctx.lineTo(8, -26 + br); ctx.lineTo(10, 0); ctx.fill();
      ctx.fillStyle = '#c8b8d8'; ctx.beginPath(); ctx.arc(2, -31 + br, 7, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#1e1630'; ctx.beginPath(); ctx.ellipse(1, -37 + br, 15, 4, 0, 0, 6.28); ctx.fill();
      ctx.fillRect(-5, -46 + br, 12, 10);
      ctx.fillStyle = '#2a2040'; ctx.beginPath(); ctx.arc(5, -31 + br, 2.6, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#f5d080'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(5, -31 + br, 2.6, 0, 6.28); ctx.stroke();
    }
    ctx.restore();
  }
  lights() {
    const c = this.id === 'bell' ? '#9fb4e8' : this.id === 'sera' ? '#e09cff' : this.id === 'hel' ? '#ff8a3a' : '#ffb860';
    Light.add(this.cx, this.y + 10, 130, c, 0.8, 0.2);
  }
}

// ---------------- 商人 ----------------
class Merchant extends GameObject {
  constructor(tx, ty) { super(tx * TILE + TILE / 2 - 28, (ty + 1) * TILE - 52, 56, 52); this.prompt = '交易'; }
  interact() { Game.openShop(); }
  draw(ctx) {
    const x = this.cx, by = this.y + this.h, br = Math.sin(this.t * 1.5) * 1.5;
    // 背篓与挂灯
    ctx.fillStyle = '#4a3828'; ctx.beginPath(); ctx.ellipse(x + 10, by - 30 + br, 18, 20, 0.2, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#2a1d14'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 4, by - 44 + i * 8 + br); ctx.lineTo(x + 26, by - 40 + i * 8 + br); ctx.stroke(); }
    for (let i = 0; i < 3; i++) {
      const lx = x + 4 + i * 10, ly = by - 52 + br + Math.sin(this.t * 2 + i) * 2;
      ctx.strokeStyle = '#3a2a1c'; ctx.beginPath(); ctx.moveTo(lx, ly - 6); ctx.lineTo(lx, ly); ctx.stroke();
      ctx.fillStyle = ['#ffb860', '#9fe0a8', '#e09cff'][i]; ctx.fillRect(lx - 2.5, ly, 5, 6);
    }
    // 圆胖身体
    ctx.fillStyle = '#6b5a48'; ctx.beginPath(); ctx.ellipse(x - 6, by - 18, 20, 18 + br * 0.5, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#7f6c56'; ctx.beginPath(); ctx.ellipse(x - 10, by - 20, 12, 12, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#3b2f24'; ctx.beginPath(); ctx.arc(x - 18, by - 30 + br, 10, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(x - 22, by - 31 + br, 2, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(x - 16, by - 32 + br, 1.6, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#3b2f24'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 20, by - 39 + br); ctx.quadraticCurveTo(x - 26, by - 50, x - 30, by - 46); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 15, by - 39 + br); ctx.quadraticCurveTo(x - 14, by - 52, x - 8, by - 50); ctx.stroke();
  }
  lights() { Light.add(this.x + 30, this.y + 6, 150, '#ffb860', 0.8, 0.25); }
}

// ---------------- 琥珀矿 ----------------
class AmberRock extends GameObject {
  constructor(tx, ty, key) { super(tx * TILE + 2, ty * TILE + 4, 28, 28); this.key = key; this.hp = 5; this.hittable = true; this.shake = 0; }
  hit() {
    this.hp--; this.shake = 0.2; Sfx.play('rock'); Game.hitstop(0.03);
    Game.particles.burst(this.cx, this.y + this.h / 2, 8, { color: ['#ffd27a', '#c47a1e', '#665'], speed: 200, life: 0.4, size: 3, grav: 600 });
    Game.spawnAmber(this.cx, this.y + 6, this.hp > 0 ? U.randi(2, 3) : 10);
    if (this.hp <= 0) { this.dead = true; Game.save.got[this.key] = 1; Sfx.play('break'); }
  }
  update(dt) { super.update(dt); this.shake = Math.max(0, this.shake - dt); }
  draw(ctx) {
    const ox = this.shake > 0 ? U.rand(-2, 2) : 0, x = this.cx + ox, by = this.y + this.h;
    ctx.fillStyle = '#3a3330';
    ctx.beginPath(); ctx.moveTo(x - 15, by); ctx.lineTo(x - 12, by - 14); ctx.lineTo(x + 2, by - 18); ctx.lineTo(x + 14, by - 10); ctx.lineTo(x + 15, by); ctx.fill();
    const n = Math.max(1, this.hp);
    for (let i = 0; i < n; i++) {
      const a = -1.2 + i * 0.6, L = 14 + (i % 2) * 6;
      ctx.fillStyle = i % 2 ? '#e8942e' : '#ffc24a';
      ctx.beginPath(); ctx.moveTo(x - 4 + i * 2, by - 12); ctx.lineTo(x + Math.sin(a) * L, by - 12 - Math.cos(a) * L); ctx.lineTo(x + 4 + i * 2, by - 12); ctx.fill();
    }
  }
  lights() { Light.add(this.cx, this.y + 10, 80, '#ffb040', 0.6, 0.3); }
}

// ---------------- 拾取物：心核 / 能力 ----------------
class Pickup extends GameObject {
  constructor(tx, ty, kind, key, ability) {
    super(tx * TILE + 4, ty * TILE + 2, 24, 26); this.kind = kind; this.key = key; this.ability = ability; this.baseY = this.y;
    this.color = kind === 'heart' ? '#ff9a8a' : kind === 'spore' ? '#e09cff' : kind === 'notch' ? '#bfe8ff' : kind === 'charm' ? (CHARMS[ability]?.color || '#fff') : (ABILITY_INFO[ability]?.color || '#fff');
  }
  update(dt) {
    super.update(dt);
    this.y = this.baseY + Math.sin(this.t * 2) * 4;
    if (Math.random() < dt * 10) Game.particles.add({ x: this.cx + U.rand(-10, 10), y: this.y + 14 + U.rand(-10, 10), vx: 0, vy: -30, life: 0.8, size: 1.8, color: this.color, glow: true });
    const p = Game.player;
    if (!this.dead && p.state !== 'dead' && U.overlap(this, p)) {
      this.dead = true; Game.save.got[this.key] = 1;
      if (this.kind === 'heart') Game.gainHeart('心 核', '一颗仍在跳动的心核。生命上限 +1。');
      else if (this.kind === 'charm') Game.gainCharm(this.ability);
      else if (this.kind === 'notch') Game.gainNotch();
      else if (this.kind === 'spore') { const n = Game.sporeCount(); Sfx.play('item'); Game.toast(`拾得菌光孢子（${n} / 3）` + (n >= 3 ? ' —— 带回去给赛菈吧' : ''), 4); Game.writeSave(); }
      else Game.gainAbility(this.ability);
    }
  }
  draw(ctx) {
    const x = this.cx, y = this.y + 13;
    glowDot(ctx, x, y, 34, this.color, 0.35 + Math.sin(this.t * 4) * 0.1);
    if (this.kind === 'spore') {
      ctx.fillStyle = '#5a3a6a'; ctx.fillRect(x - 1.5, y - 2, 3, 10);
      ctx.fillStyle = '#e09cff'; ctx.beginPath(); ctx.ellipse(x, y - 3, 9, 6, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fff'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(x + i * 4, y - 5 + Math.abs(i), 1.2, 0, 6.28); ctx.fill(); }
    } else if (this.kind === 'notch') {
      ctx.strokeStyle = '#eaf8ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.28); ctx.stroke();
      ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 6.28); ctx.fill();
    } else if (this.kind === 'charm') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(this.t * 2) * 0.3);
      ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -6); ctx.stroke();
      ctx.fillStyle = this.color; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(7, 2); ctx.lineTo(0, 11); ctx.lineTo(-7, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-1.5, 0, 2, 0, 6.28); ctx.fill();
      ctx.restore();
    } else if (this.kind === 'heart') {
      ctx.fillStyle = '#c94a4a';
      ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.bezierCurveTo(x - 14, y, x - 10, y - 12, x, y - 5); ctx.bezierCurveTo(x + 10, y - 12, x + 14, y, x, y + 10); ctx.fill();
      ctx.fillStyle = '#ffd0c8'; ctx.beginPath(); ctx.arc(x - 4, y - 4, 2.5, 0, 6.28); ctx.fill();
    } else {
      ctx.save(); ctx.translate(x, y); ctx.rotate(this.t);
      ctx.strokeStyle = this.color; ctx.lineWidth = 2;
      ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); } ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.28); ctx.fill();
      ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.28); ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
    }
  }
  lights() { Light.add(this.cx, this.y + 13, 140, this.color, 1, 0.35); }
}

// ---------------- 遗珀：死亡时留下的琥珀 ----------------
class Shade extends GameObject {
  constructor(x, y, amount) { super(x - 14, y - 30, 28, 34); this.amount = amount; }
  update(dt) {
    super.update(dt);
    const p = Game.player;
    if (Math.random() < dt * 12) Game.particles.add({ x: this.cx + U.rand(-8, 8), y: this.y + 20, vx: U.rand(-10, 10), vy: U.rand(-40, -15), life: 1, size: 2, color: '#ffcf80', glow: true });
    if (!this.dead && p.state !== 'dead' && U.overlap(this, p)) {
      this.dead = true; Game.save.amber += this.amount; Game.amberGain(this.amount); Game.save.lost = null;
      Sfx.play('shade'); Game.toast(`取回了遗珀 · ${this.amount} 琥珀`);
      Game.particles.burst(this.cx, this.y + 15, 40, { color: ['#ffcf80', '#fff', '#ffa040'], speed: 300, life: 0.8, size: 3, glow: true });
      Game.save.soul = P.SOUL_MAX;
    }
  }
  draw(ctx) {
    const x = this.cx, y = this.y + 16 + Math.sin(this.t * 2.2) * 4, a = 0.55 + Math.sin(this.t * 7) * 0.15;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#1a1626';
    ctx.beginPath(); ctx.moveTo(x - 10, y + 14); ctx.quadraticCurveTo(x - 12, y - 8, x, y - 14); ctx.quadraticCurveTo(x + 12, y - 8, x + 10, y + 14);
    for (let i = 0; i < 4; i++) ctx.lineTo(x + 10 - i * 6.6 - 3.3, y + 10 + Math.sin(this.t * 6 + i) * 3);
    ctx.fill();
    ctx.fillStyle = '#ffcf80';
    ctx.beginPath(); ctx.arc(x - 3, y - 4, 1.8, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(x + 3, y - 4, 1.8, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1;
  }
  lights() { Light.add(this.cx, this.y + 16, 110, '#ffb860', 0.8, 0.35); }
}

// ---------------- 古老的石碑 ----------------
class Tablet extends GameObject {
  constructor(tx, ty, lines) { super(tx * TILE + 2, (ty + 1) * TILE - 40, 28, 40); this.lines = lines || ['……字迹已经无法辨认。']; this.prompt = '阅读'; }
  interact() { Game.startDialog('古老的石碑', this.lines); }
  draw(ctx) {
    const x = this.x, y = this.y, A = Game.room.A;
    ctx.fillStyle = '#26232c';
    ctx.beginPath(); ctx.moveTo(x, y + 40); ctx.lineTo(x + 2, y + 8); ctx.quadraticCurveTo(x + 14, y - 4, x + 26, y + 8); ctx.lineTo(x + 28, y + 40); ctx.fill();
    ctx.fillStyle = '#34303c'; ctx.fillRect(x + 4, y + 10, 20, 2);
    const k = (Math.sin(this.t * 1.5) + 1) / 2;
    ctx.fillStyle = rgba(A.accent, 0.35 + k * 0.35);
    for (let i = 0; i < 4; i++) { ctx.fillRect(x + 8, y + 16 + i * 5, 12 - (i % 2) * 4, 1.5); }
  }
  lights() { Light.add(this.cx, this.y + 20, 70, Game.room.A.accent, 0.5, 0.12); }
}

// ---------------- 拉杆：开启铁栅 ----------------
class Lever extends GameObject {
  constructor(tx, ty, key) {
    super(tx * TILE + 6, ty * TILE, 20, 32); this.key = key; this.on = !!Game.save.flags[key]; this.hittable = !this.on; this.ang = this.on ? 0.7 : -0.7;
  }
  hit() {
    if (this.on) return;
    this.on = true; this.hittable = false; Game.save.flags[this.key] = 1;
    Sfx.play('clink'); Game.hitstop(0.05);
    const rid = Game.room.id; Game.after(0.35, () => { Game.openLeverGates(rid); });
    Game.writeSave();
  }
  update(dt) { super.update(dt); this.ang = U.lerp(this.ang, this.on ? 0.7 : -0.7, Math.min(1, dt * 12)); }
  draw(ctx) {
    const x = this.cx, by = this.y + this.h;
    ctx.fillStyle = '#3a3640'; ctx.fillRect(x - 8, by - 8, 16, 8);
    ctx.save(); ctx.translate(x, by - 6); ctx.rotate(this.ang);
    ctx.strokeStyle = '#7a7280'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -22); ctx.stroke();
    ctx.fillStyle = this.on ? '#9fe0a8' : '#ff8a6a'; ctx.beginPath(); ctx.arc(0, -24, 4, 0, 6.28); ctx.fill();
    ctx.restore();
  }
  lights() { Light.add(this.cx, this.y + 8, 60, this.on ? '#9fe0a8' : '#ff8a6a', 0.5, 0.2); }
}

// ---------------- 平台：碎冰 / 移动 ----------------
class Platform {
  constructor(x, y, w, kind, o = {}) {
    this.x = x; this.y = y; this.w = w; this.h = 12; this.kind = kind;
    this.x0 = x; this.y0 = y; this.dx = (o.dx || 0) * TILE; this.dy = (o.dy || 0) * TILE; this.period = o.period || 4;
    this.t = 0; this.mx = 0; this.my = 0; this.state = 'idle'; this.timer = 0; this.shake = 0;
  }
  get solid() { return this.state !== 'gone'; }
  touch() { if (this.kind === 'crumble' && this.state === 'idle') { this.state = 'shake'; this.timer = 0.45; Sfx.play('rock', 1.4); } }
  update(dt) {
    const px = this.x, py = this.y;
    if (this.kind === 'move') {
      this.t += dt; const k = (1 - Math.cos(this.t / this.period * Math.PI * 2)) / 2;
      this.x = this.x0 + this.dx * k; this.y = this.y0 + this.dy * k;
    } else {
      if (this.state === 'shake') {
        this.timer -= dt; this.shake = U.rand(-1.5, 1.5);
        if (this.timer <= 0) {
          this.state = 'gone'; this.timer = 2.4; this.shake = 0; Sfx.play('break', 1.6);
          Game.particles.burst(this.x + this.w / 2, this.y + 6, 14, { color: ['#bfe8ff', '#eaf8ff', '#5a88b0'], speed: 160, life: 0.8, size: 3, grav: 900, shape: 'rect' });
        }
      } else if (this.state === 'gone') {
        this.timer -= dt;
        if (this.timer <= 0 && !U.overlap(this, Game.player)) { this.state = 'idle'; Game.particles.burst(this.x + this.w / 2, this.y + 6, 8, { color: ['#eaf8ff'], speed: 60, life: 0.4, size: 2, glow: true }); }
      }
    }
    this.mx = this.x - px; this.my = this.y - py;
  }
  draw(ctx) {
    if (this.state === 'gone') {
      const k = 1 - this.timer / 2.4; if (k > 0.7) { ctx.strokeStyle = `rgba(190,232,255,${(k - 0.7) * 1.5})`; ctx.strokeRect(this.x + 1, this.y + 1, this.w - 2, this.h - 2); }
      return;
    }
    const x = this.x + this.shake, y = this.y;
    if (this.kind === 'move') {
      ctx.fillStyle = '#2a4a66'; ctx.fillRect(x, y, this.w, this.h);
      ctx.fillStyle = '#a8d8f0'; ctx.fillRect(x, y, this.w, 3);
      ctx.fillStyle = '#eaf8ff'; for (let i = 8; i < this.w; i += 24) ctx.fillRect(x + i, y + 5, 6, 2);
      ctx.fillStyle = '#1a3048';
      ctx.beginPath(); ctx.moveTo(x + 6, y + this.h); ctx.lineTo(x + this.w / 2, y + this.h + 12); ctx.lineTo(x + this.w - 6, y + this.h); ctx.fill();
    } else {
      ctx.fillStyle = this.state === 'shake' ? '#cfeeff' : '#7ab0d0'; ctx.fillRect(x, y, this.w, this.h);
      ctx.fillStyle = '#eaf8ff'; ctx.fillRect(x, y, this.w, 2.5);
      ctx.strokeStyle = 'rgba(20,40,60,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 8, y); ctx.lineTo(x + 14, y + 7); ctx.lineTo(x + 11, y + this.h); ctx.moveTo(x + 14, y + 7); ctx.lineTo(x + 24, y + 5); ctx.stroke();
    }
  }
  lights() { if (this.state !== 'gone') Light.add(this.x + this.w / 2, this.y + 4, 70, '#bfe8ff', 0.5, 0.15); }
}
