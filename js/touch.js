'use strict';
// ============================================================
//  触屏按键（仅在触屏设备上显示）
// ============================================================
(function () {
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
  if (!isTouch) return;
  const css = document.createElement('style');
  css.textContent = `
  .tc { position: fixed; z-index: 10; user-select: none; -webkit-user-select: none; touch-action: none; }
  .tc button { position: absolute; border-radius: 50%; border: 1.5px solid rgba(255,220,170,0.45); background: rgba(10,10,18,0.35);
    color: rgba(255,235,210,0.85); font: 600 15px "Microsoft YaHei","PingFang SC",sans-serif; touch-action: none; padding: 0; }
  .tc button.on { background: rgba(255,190,110,0.35); }
  .tc-left { left: 12px; bottom: 14px; width: 168px; height: 168px; }
  .tc-right { right: 12px; bottom: 14px; width: 220px; height: 190px; }
  .tc-top { right: 12px; top: 10px; width: 120px; height: 44px; }
  .tc-top button { border-radius: 10px; }`;
  document.head.appendChild(css);
  const mk = (cls, defs) => {
    const box = document.createElement('div'); box.className = 'tc ' + cls; document.body.appendChild(box);
    for (const d of defs) {
      const b = document.createElement('button'); b.textContent = d.t;
      Object.assign(b.style, { left: d.x + 'px', top: d.y + 'px', width: d.s + 'px', height: d.s + 'px' });
      if (d.r) b.style.borderRadius = d.r;
      const down = e => { e.preventDefault(); Input.press(d.k); b.classList.add('on'); Sfx.unlock(); };
      const up = e => { e.preventDefault(); Input.release(d.k); b.classList.remove('on'); };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      box.appendChild(b);
    }
  };
  mk('tc-left', [
    { t: '▲', k: 'ArrowUp', x: 58, y: 0, s: 52 },
    { t: '◀', k: 'ArrowLeft', x: 0, y: 58, s: 52 },
    { t: '▶', k: 'ArrowRight', x: 116, y: 58, s: 52 },
    { t: '▼', k: 'ArrowDown', x: 58, y: 116, s: 52 },
  ]);
  mk('tc-right', [
    { t: '跳', k: 'KeyZ', x: 150, y: 110, s: 68 },
    { t: '斩', k: 'KeyX', x: 76, y: 120, s: 62 },
    { t: '冲', k: 'KeyC', x: 156, y: 36, s: 56 },
    { t: '愈', k: 'KeyV', x: 0, y: 132, s: 52 },
    { t: '火', k: 'KeyF', x: 86, y: 52, s: 52 },
  ]);
  mk('tc-top', [
    { t: '地图', k: 'Tab', x: 0, y: 0, s: 54, r: '10px' },
    { t: '暂停', k: 'Escape', x: 62, y: 0, s: 54, r: '10px' },
  ]);
  document.querySelectorAll('.tc-top button').forEach(b => { b.style.height = '40px'; });
})();
