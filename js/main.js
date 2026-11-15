'use strict';
// ============================================================
//  入口：画布缩放 + 固定步长主循环
// ============================================================
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let scale = 1;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fit = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    const cssW = Math.floor(VW * fit), cssH = Math.floor(VH * fit);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    scale = U.clamp(fit * dpr, 0.5, 2); // 内部分辨率上限 1920×1080，更大的屏幕由 CSS 放大
    canvas.width = Math.round(VW * scale); canvas.height = Math.round(VH * scale);
  }
  addEventListener('resize', resize);
  resize();

  Input.init();
  Game.init();
  addEventListener('keydown', e => {
    if (e.code === 'F3') { Game.debug = !Game.debug; e.preventDefault(); }
    if (e.code === 'F11') return;
  });
  // 失焦自动暂停
  addEventListener('blur', () => { if (Game.state === 'play' && !Game.trans && !Game.death && !Game.dialog && !Game.travel && !UI.stack.length) UI.openPause(); });

  const STEP = 1 / 120;
  let acc = 0, last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 12) {
      Input.update();
      Game.update(STEP);
      acc -= STEP; n++;
    }
    if (n === 12) acc = 0;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    Game.draw(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
