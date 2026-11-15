'use strict';
// ============================================================
//  渲染：程序化地形、视差背景、光照
// ============================================================
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
function rgba(hex, a) { const c = hexToRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

const RoomArt = {
  cache: {},
  get(room) {
    let c = this.cache[room.id];
    if (!c) { c = this.cache[room.id] = { fg: this.buildTiles(room), bg: this.buildBG(room), near: this.buildNear(room) }; }
    return c;
  },
  buildTiles(room) {
    const A = room.A, c = U.makeCanvas(room.pw, room.ph), g = c.getContext('2d');
    const rnd = U.rng(U.hash(room.id + 'tiles'));
    const S = (x, y) => room.tile(x, y) === T_SOLID;
    const depth = (x, y) => {
      for (let r = 1; r <= 3; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!S(x + dx, y + dy)) return r;
        }
      }
      return 4;
    };
    // 实心底色（越深越暗）
    for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
      if (!S(x, y)) continue;
      const d = depth(x, y);
      g.fillStyle = d === 1 ? A.tile : d === 2 ? mixHex(A.tile, A.tileDeep, 0.5) : A.tileDeep;
      g.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (d <= 2) {
        for (let i = 0; i < 3; i++) {
          g.fillStyle = rnd() < 0.5 ? rgba(A.edge, 0.25) : 'rgba(0,0,0,0.25)';
          const s = 2 + rnd() * 5;
          g.beginPath(); g.arc(x * TILE + rnd() * TILE, y * TILE + rnd() * TILE, s, 0, 6.28); g.fill();
        }
      }
    }
    // 圆角：外露角挖掉
    g.globalCompositeOperation = 'destination-out';
    for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
      if (!S(x, y)) continue;
      const u = !S(x, y - 1), d = !S(x, y + 1), l = !S(x - 1, y), r = !S(x + 1, y);
      const px = x * TILE, py = y * TILE, R = 11;
      if (u && l) this.cutCorner(g, px, py, 1, 1, R);
      if (u && r) this.cutCorner(g, px + TILE, py, -1, 1, R);
      if (d && l) this.cutCorner(g, px, py + TILE, 1, -1, R);
      if (d && r) this.cutCorner(g, px + TILE, py + TILE, -1, -1, R);
    }
    g.globalCompositeOperation = 'source-over';
    // 边缘细节
    for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
      if (!S(x, y)) continue;
      const px = x * TILE, py = y * TILE;
      const up = !S(x, y - 1) && y > 0, dn = !S(x, y + 1) && y < room.h - 1, lf = !S(x - 1, y) && x > 0, rt = !S(x + 1, y) && x < room.w - 1;
      if (lf) { g.fillStyle = A.edge; g.fillRect(px, py + (up ? 8 : 0), 2.5, TILE - (up ? 8 : 0) - (dn ? 8 : 0)); }
      if (rt) { g.fillStyle = A.edge; g.fillRect(px + TILE - 2.5, py + (up ? 8 : 0), 2.5, TILE - (up ? 8 : 0) - (dn ? 8 : 0)); }
      if (dn) { g.fillStyle = rgba(A.edge, 0.8); const x0 = px + (lf ? 8 : 0), x1 = px + TILE - (rt ? 8 : 0); g.fillRect(x0, py + TILE - 2, x1 - x0, 2); }
      if (up) {
        const x0 = px + (lf ? 6 : 0), x1 = px + TILE - (rt ? 6 : 0);
        g.fillStyle = A.top; g.fillRect(x0, py, x1 - x0, 4);
        g.fillStyle = rgba(A.topHi, 0.6); g.fillRect(x0, py, x1 - x0, 1.5);
        // 草/苔/菌
        for (let i = 0; i < 5; i++) {
          const bx = x0 + rnd() * (x1 - x0), bh = 3 + rnd() * (room.area === 'ruin' ? 3 : 9);
          if (room.area === 'deep' && rnd() < 0.25) {
            // 小蘑菇
            g.fillStyle = rgba(A.edge, 1); g.fillRect(bx - 0.75, py - bh, 1.5, bh);
            g.fillStyle = rnd() < 0.5 ? A.topHi : A.top;
            g.beginPath(); g.ellipse(bx, py - bh, 3 + rnd() * 2, 2.2, 0, Math.PI, 0); g.fill();
          } else if (room.area === 'ruin') {
            g.fillStyle = rgba(A.topHi, 0.25); g.fillRect(bx, py + 4, 1 + rnd() * 3, 1);
          } else {
            g.strokeStyle = rnd() < 0.3 ? A.topHi : A.top; g.lineWidth = 1.3;
            g.beginPath(); g.moveTo(bx, py + 1); g.quadraticCurveTo(bx + (rnd() - 0.5) * 6, py - bh * 0.6, bx + (rnd() - 0.5) * 8, py - bh); g.stroke();
          }
        }
      }
      if (dn) {
        g.fillStyle = A.under;
        for (let i = 0; i < 2; i++) {
          if (rnd() < 0.55) {
            const bx = px + 4 + rnd() * (TILE - 8), bl = 4 + rnd() * 12;
            g.beginPath(); g.moveTo(bx - 3, py + TILE - 1); g.lineTo(bx + 3, py + TILE - 1); g.lineTo(bx, py + TILE + bl); g.fill();
          }
        }
        if (room.area === 'moss' && rnd() < 0.3) {
          // 垂藤
          g.strokeStyle = rgba(A.top, 0.55); g.lineWidth = 1;
          const bx = px + rnd() * TILE, bl = 10 + rnd() * 40;
          g.beginPath(); g.moveTo(bx, py + TILE); g.bezierCurveTo(bx + 4, py + TILE + bl * 0.3, bx - 4, py + TILE + bl * 0.6, bx + 1, py + TILE + bl); g.stroke();
          g.fillStyle = A.topHi; g.beginPath(); g.arc(bx + 1, py + TILE + bl, 1.4, 0, 6.28); g.fill();
        }
      }
    }
    // 单向平台
    for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
      if (room.tile(x, y) !== T_ONEWAY) continue;
      const px = x * TILE, py = y * TILE;
      const lEnd = room.tileRaw(x - 1, y) !== T_ONEWAY, rEnd = room.tileRaw(x + 1, y) !== T_ONEWAY;
      g.fillStyle = mixHex(A.tile, A.edge, 0.4); g.fillRect(px, py, TILE, 9);
      g.fillStyle = A.top; g.fillRect(px, py, TILE, 2);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(px, py + 7, TILE, 2);
      if (lEnd || rEnd || x % 3 === 0) {
        g.fillStyle = A.tileDeep;
        const sx = lEnd ? px + 4 : rEnd ? px + TILE - 8 : px + 14;
        g.beginPath(); g.moveTo(sx, py + 9); g.lineTo(sx + 4, py + 9); g.lineTo(sx + 2, py + 20); g.fill();
      }
    }
    // 尖刺（荆棘）/ 熔岩
    for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
      if (room.tile(x, y) !== T_SPIKE) continue;
      if (room.area === 'kiln') {
        const px = x * TILE, py = y * TILE;
        const lg = g.createLinearGradient(0, py + 10, 0, py + TILE);
        lg.addColorStop(0, '#ffd070'); lg.addColorStop(0.25, '#ff7a2a'); lg.addColorStop(1, '#7a1a08');
        g.fillStyle = lg; g.fillRect(px, py + 12, TILE, TILE - 12);
        continue;
      }
      const px = x * TILE, py = y * TILE;
      for (let i = 0; i < 4; i++) {
        const bx = px + 2 + i * 7.5 + rnd() * 2, h = 16 + rnd() * 12;
        const grd = g.createLinearGradient(0, py + TILE, 0, py + TILE - h);
        grd.addColorStop(0, A.tileDeep); grd.addColorStop(1, mixHex(A.edge, '#e8e0ff', 0.35));
        g.fillStyle = grd;
        g.beginPath(); g.moveTo(bx, py + TILE); g.lineTo(bx + 3.5 + (rnd() - 0.5) * 3, py + TILE - h); g.lineTo(bx + 7, py + TILE); g.fill();
      }
    }
    return c;
  },
  cutCorner(g, cx, cy, sx, sy, R) {
    // 以 (cx,cy) 为外角，向内 sx,sy 方向挖去 R 大小的角
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + sx * R, cy);
    g.quadraticCurveTo(cx, cy, cx, cy + sy * R);
    g.closePath();
    g.fill();
  },
  buildBG(room) {
    const A = room.A, layers = [];
    const specs = [{ k: 0.25, col: A.far, dens: 0.6 }, { k: 0.55, col: A.mid, dens: 1 }];
    specs.forEach((sp, li) => {
      const w = VW + Math.max(0, room.pw - VW) * sp.k + 40, h = VH + Math.max(0, room.ph - VH) * sp.k + 40;
      const c = U.makeCanvas(w, h), g = c.getContext('2d');
      const rnd = U.rng(U.hash(room.id + 'bg' + li));
      this.drawSilhouettes(g, w, h, rnd, room.area, sp.col, li, sp.dens);
      layers.push({ c, k: sp.k });
    });
    return layers;
  },
  drawSilhouettes(g, w, h, rnd, area, col, li, dens) {
    g.fillStyle = col;
    const n = Math.ceil(w / (li ? 90 : 140) * dens);
    if (area === 'moss') {
      for (let i = 0; i < n; i++) {
        const x = rnd() * w, top = rnd() * h * 0.3, len = h * (0.2 + rnd() * 0.5), wd = 10 + rnd() * 40;
        // 钟乳与苔柱
        g.beginPath(); g.moveTo(x - wd, -5); g.quadraticCurveTo(x - wd * 0.3, top + len * 0.5, x, top + len); g.quadraticCurveTo(x + wd * 0.3, top + len * 0.5, x + wd, -5); g.fill();
        if (rnd() < 0.5) {
          const bx = rnd() * w, bw = 30 + rnd() * 80, bh = h * (0.15 + rnd() * 0.35);
          g.beginPath(); g.moveTo(bx - bw, h + 5); g.quadraticCurveTo(bx, h - bh * 2, bx + bw, h + 5); g.fill();
        }
        if (rnd() < 0.35) {
          // 巨型蕨叶
          const fx = rnd() * w, fy = h * (0.5 + rnd() * 0.5);
          g.save(); g.translate(fx, fy); g.rotate(-0.6 + rnd() * 1.2);
          for (let j = 0; j < 7; j++) { g.beginPath(); g.ellipse(0, -j * 14, 26 - j * 3, 5, 0.5, 0, 6.28); g.fill(); g.beginPath(); g.ellipse(0, -j * 14, 26 - j * 3, 5, -0.5, 0, 6.28); g.fill(); }
          g.restore();
        }
      }
    } else if (area === 'ruin') {
      for (let i = 0; i < n * 0.7; i++) {
        const x = rnd() * w, pw = 24 + rnd() * 30, ph = h * (0.4 + rnd() * 0.6);
        g.fillRect(x, h - ph, pw, ph + 5);
        g.fillRect(x - 6, h - ph, pw + 12, 10);
        if (rnd() < 0.6) {
          // 拱
          const aw = 80 + rnd() * 80;
          g.beginPath(); g.moveTo(x, h - ph + 10); g.arc(x + pw + aw / 2, h - ph + 10, aw / 2 + pw / 2, Math.PI, 0); g.lineTo(x + pw + aw + pw, h - ph + 30);
          g.arc(x + pw + aw / 2, h - ph + 30, aw / 2, 0, Math.PI, true); g.closePath(); g.fill();
        }
        if (rnd() < 0.25) {
          // 悬钟
          const bx = rnd() * w, by = 40 + rnd() * h * 0.4, bs = 14 + rnd() * 22;
          g.fillRect(bx - 1, 0, 2, by - bs);
          g.beginPath(); g.moveTo(bx - bs * 0.5, by - bs); g.quadraticCurveTo(bx - bs * 0.6, by, bx - bs, by + bs * 0.2); g.lineTo(bx + bs, by + bs * 0.2); g.quadraticCurveTo(bx + bs * 0.6, by, bx + bs * 0.5, by - bs); g.fill();
        }
      }
    } else if (area === 'frost') {
      for (let i = 0; i < n; i++) {
        // 冰晶簇与冰柱
        const x = rnd() * w, hh = h * (0.15 + rnd() * 0.45), ww = 14 + rnd() * 26;
        g.beginPath(); g.moveTo(x - ww, h + 5); g.lineTo(x - ww * 0.2, h - hh); g.lineTo(x + ww * 0.3, h - hh * 0.7); g.lineTo(x + ww, h + 5); g.fill();
        if (rnd() < 0.6) { const sx = rnd() * w, sl = h * (0.08 + rnd() * 0.3); g.beginPath(); g.moveTo(sx - 9, -5); g.lineTo(sx, sl); g.lineTo(sx + 9, -5); g.fill(); }
      }
      for (let i = 0; i < n * 3; i++) { g.fillStyle = `rgba(220,240,255,${0.05 + rnd() * 0.15})`; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
    } else if (area === 'kiln') {
      for (let i = 0; i < n * 0.6; i++) {
        // 烟囱与窑炉
        const x = rnd() * w, cw = 26 + rnd() * 30, ch = h * (0.35 + rnd() * 0.6);
        g.fillRect(x, h - ch, cw, ch + 5); g.fillRect(x - 5, h - ch, cw + 10, 8);
        if (rnd() < 0.5) {
          const kx = rnd() * w, kr = 50 + rnd() * 60;
          g.beginPath(); g.arc(kx, h, kr, Math.PI, 0); g.fill();
          g.fillStyle = `rgba(255,120,40,${0.08 + rnd() * 0.1})`;
          g.beginPath(); g.arc(kx, h, kr * 0.35, Math.PI, 0); g.fill();
          g.fillStyle = col;
        }
        if (rnd() < 0.4) {
          // 吊链
          const lx = rnd() * w, ll = h * (0.2 + rnd() * 0.4);
          for (let j = 0; j < ll; j += 9) g.fillRect(lx - 2, j, 4, 6);
          g.fillRect(lx - 8, ll, 16, 12);
        }
      }
      for (let i = 0; i < n * 3; i++) {
        g.fillStyle = `rgba(255,150,70,${0.05 + rnd() * 0.15})`;
        g.beginPath(); g.arc(rnd() * w, rnd() * h, 0.8 + rnd() * 1.6, 0, 6.28); g.fill();
      }
    } else {
      for (let i = 0; i < n; i++) {
        // 巨菌
        const x = rnd() * w, sh = h * (0.25 + rnd() * 0.6), cw = 30 + rnd() * 70;
        g.fillRect(x - 4 - rnd() * 5, h - sh, 8 + rnd() * 6, sh + 5);
        g.beginPath(); g.ellipse(x, h - sh, cw, cw * 0.4, 0, Math.PI, 0); g.fill();
        if (rnd() < 0.5) {
          const sx = rnd() * w, sl = h * (0.1 + rnd() * 0.3);
          g.beginPath(); g.moveTo(sx - 12, -5); g.lineTo(sx, sl); g.lineTo(sx + 12, -5); g.fill();
        }
      }
      // 远处光点
      for (let i = 0; i < n * 3; i++) {
        g.fillStyle = `rgba(230,160,255,${0.05 + rnd() * 0.15})`;
        g.beginPath(); g.arc(rnd() * w, rnd() * h, 1 + rnd() * 2, 0, 6.28); g.fill();
      }
    }
  },
  // 近景剪影：位于镜头前方，视差系数 > 1
  buildNear(room) {
    const rnd = U.rng(U.hash(room.id + 'near')), list = [], K = 1.35;
    const span = room.pw * K + VW;
    for (let x = -200; x < span; x += 220 + rnd() * 380) {
      if (rnd() < 0.55) list.push({ x, bottom: true, h: 40 + rnd() * 70, w: 60 + rnd() * 120, kind: rnd() });
      if (rnd() < 0.4) list.push({ x: x + rnd() * 200, bottom: false, h: 50 + rnd() * 120, w: 20 + rnd() * 40, kind: rnd() });
    }
    return { list, K };
  },
  drawNear(ctx, room, cam) {
    const N = this.get(room).near, A = room.A;
    ctx.fillStyle = A.tileDeep; ctx.strokeStyle = A.tileDeep;
    const ox = cam.x * N.K, oyB = VH + (cam.y - Math.max(0, room.ph - VH)) * N.K * 0.6, oyT = -(cam.y) * N.K * 0.6;
    for (const e of N.list) {
      const x = e.x - ox;
      if (x < -e.w - 50 || x > VW + e.w + 50) continue;
      if (e.bottom) {
        const by = oyB + 20;
        if (by > VH + e.h) continue;
        ctx.beginPath(); ctx.moveTo(x - e.w / 2, by);
        const n = 7;
        for (let i = 0; i <= n; i++) {
          const px = x - e.w / 2 + e.w * i / n, ph = (i % 2 ? 1 : 0.45) * e.h * (0.6 + 0.4 * Math.sin(i * 1.7 + e.kind * 9));
          ctx.lineTo(px, by - ph);
        }
        ctx.lineTo(x + e.w / 2, by); ctx.fill();
      } else {
        const ty = oyT - 10;
        if (ty < -e.h) continue;
        if (room.area === 'ruin' || room.area === 'kiln') {
          for (let j = 0; j < e.h; j += 12) ctx.fillRect(x - 3, ty + j, 6, 8);
        } else {
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(x, ty);
          ctx.bezierCurveTo(x + 14, ty + e.h * 0.3, x - 14, ty + e.h * 0.6, x + 4, ty + e.h); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(x + 4, ty + e.h, 8, 5, 0.4, 0, 6.28); ctx.fill();
        }
      }
    }
  },
  drawBackground(ctx, room, cam) {
    const A = room.A, art = this.get(room);
    const sky = ctx.createLinearGradient(0, 0, 0, VH);
    sky.addColorStop(0, A.sky[0]); sky.addColorStop(1, A.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, VH);
    for (const L of art.bg) {
      ctx.drawImage(L.c, -Math.round(Math.max(0, cam.x) * L.k) - 20, -Math.round(Math.max(0, cam.y) * L.k) - 20);
    }
    ctx.fillStyle = A.fog; ctx.fillRect(0, 0, VW, VH);
  },
};

// ------------------------------------------------------------
//  光照：低分辨率暗层 + 叠加辉光
// ------------------------------------------------------------
const Light = {
  canvas: null, ctx: null, list: [], scale: 0.5,
  init() {
    this.canvas = U.makeCanvas(VW * this.scale, VH * this.scale);
    this.ctx = this.canvas.getContext('2d');
  },
  begin() { this.list.length = 0; },
  add(x, y, r, color, a = 1, glow = 0.25) { this.list.push({ x, y, r, color, a, glow }); },
  render(ctx, cam, darkness) {
    const g = this.ctx, s = this.scale;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.fillStyle = `rgba(3,3,9,${darkness})`;
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    g.globalCompositeOperation = 'destination-out';
    for (const L of this.list) {
      const x = (L.x - cam.vx) * s, y = (L.y - cam.vy) * s, r = L.r * s;
      if (x < -r || y < -r || x > VW * s + r || y > VH * s + r) continue;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(0,0,0,${L.a})`);
      grd.addColorStop(0.45, `rgba(0,0,0,${L.a * 0.55})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill();
    }
    ctx.drawImage(this.canvas, 0, 0, VW, VH);
    // 彩色辉光
    ctx.globalCompositeOperation = 'lighter';
    for (const L of this.list) {
      if (!L.color || L.glow <= 0) continue;
      const x = L.x - cam.vx, y = L.y - cam.vy, r = L.r * 0.7;
      if (x < -r || y < -r || x > VW + r || y > VH + r) continue;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, rgba(L.color, L.glow));
      grd.addColorStop(1, rgba(L.color, 0));
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  },
};

// 通用：发光圆
function glowDot(ctx, x, y, r, color, a = 1) {
  const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, rgba(color, a)); grd.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill();
}
