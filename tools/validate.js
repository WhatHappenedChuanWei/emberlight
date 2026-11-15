// 关卡校验：node tools/validate.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Math, Set, Map, Object, Array, String, Uint8Array, addEventListener() {}, window: {}, document: {} };
vm.createContext(ctx);
const src = ['core.js', 'world.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
vm.runInContext(src + '\n;this.ROOM_DEFS=ROOM_DEFS;this.Room=Room;this.TILE=TILE;', ctx, { filename: 'game' });
const { ROOM_DEFS, Room } = ctx;
let errors = 0;
const err = m => { errors++; console.log('ERROR', m); };
const rooms = {};
for (const d of ROOM_DEFS) {
  const w = d.map[0].length;
  d.map.forEach((r, i) => { if (r.length !== w) err(`${d.id} row ${i} width ${r.length} != ${w}`); });
  rooms[d.id] = new Room(d);
}
// 重叠
for (let i = 0; i < ROOM_DEFS.length; i++) for (let j = i + 1; j < ROOM_DEFS.length; j++) {
  const a = rooms[ROOM_DEFS[i].id], b = rooms[ROOM_DEFS[j].id];
  if (a.gx < b.gx + b.w && a.gx + a.w > b.gx && a.gy < b.gy + b.h && a.gy + a.h > b.gy) err(`overlap ${a.id} ${b.id}`);
}
function at(gx, gy) { for (const id in rooms) { const r = rooms[id]; if (gx >= r.gx && gx < r.gx + r.w && gy >= r.gy && gy < r.gy + r.h) return r; } return null; }
const open = t => t === 0 || t === 3 || t === 5 || t === 2 || t === 6 || t === 7;
const links = {};
for (const id in rooms) {
  const r = rooms[id];
  const check = (lx, ly, dx, dy) => {
    if (!open(r.tileRaw(lx, ly))) return;
    const gx = r.gx + lx + dx, gy = r.gy + ly + dy;
    const o = at(gx, gy);
    if (!o) { err(`${id} edge open at (${lx},${ly}) leads nowhere`); return; }
    const t = o.tileRaw(gx - o.gx, gy - o.gy);
    if (!open(t)) err(`${id} edge (${lx},${ly}) -> ${o.id} (${gx - o.gx},${gy - o.gy}) is solid`);
    (links[id] = links[id] || new Set()).add(o.id);
  };
  for (let y = 0; y < r.h; y++) { check(0, y, -1, 0); check(r.w - 1, y, 1, 0); }
  for (let x = 0; x < r.w; x++) { check(x, 0, 0, -1); check(x, r.h - 1, 0, 1); }
  // 生成物
  for (const s of r.spawns) {
    if (!'PBNSTXcfhsgebHA$KCL-MkUQ'.includes(s.ch)) err(`${id} unknown char ${s.ch} at ${s.tx},${s.ty}`);
    if ('BNSPHcghA$'.includes(s.ch) && 'hcge'.includes(s.ch)) {
      // 地面敌人下方应为地面
      const below = r.tileRaw(s.tx, s.ty + 1);
      if (below !== 1 && below !== 3) console.log('WARN', id, s.ch, 'not on ground at', s.tx, s.ty);
    }
    if ('BNST'.includes(s.ch)) { const below = r.tileRaw(s.tx, s.ty + 1); if (below !== 1) err(`${id} ${s.ch} not on solid ground`); }
  }
}
for (const id in links) console.log(id, '->', [...links[id]].join(','));
console.log(errors ? `${errors} errors` : 'OK');
process.exit(errors ? 1 : 0);
