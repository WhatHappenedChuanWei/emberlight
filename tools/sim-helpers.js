// 页面内测试助手：T.step / T.put / T.fresh / T.p
(() => {
const KEY = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'KeyZ', attack: 'KeyX', dash: 'KeyC', focus: 'KeyV', cast: 'KeyF', confirm: 'Enter', map: 'Tab', pause: 'Escape', back: 'Backspace' };
    window.T = {
      step(n = 1, keys = []) {
        for (let i = 0; i < n; i++) {
          Input.keys = Object.create(null);
          const ks = typeof keys === 'function' ? keys(i) : keys;
          for (const k of ks) Input.keys[KEY[k]] = true;
          Input.update(); Game.update(1 / 120);
        }
      },
      fresh() { localStorage.clear(); UI.stack = []; Game.popup = null; Game.dialog = null; Game.timers = []; Game.startGame(true); Game.state = 'play'; Game.intro = null; Game.player.state = 'normal'; Game.areaCard = null; Game.fadeA = 0; Game.fadeTarget = 0; T.step(5); },
      put(room, tx, ty) { Game.loadRoom(room); const p = Game.player; p.state = 'normal'; p.x = tx * 32 + 7; p.y = (ty + 1) * 32 - p.h; p.vx = p.vy = 0; Game.trans = null; Game.hazard = null; Game.death = null; Game.fadeA = 0; Game.cam.follow(p.cx, p.cy, Game.room, 0, true); T.step(10); },
      p() { const p = Game.player; return { room: Game.room.id, x: +p.x.toFixed(1), y: +p.y.toFixed(1), tx: Math.floor(p.cx / 32), ty: Math.floor((p.y + p.h - 1) / 32), st: p.state, hp: Game.save.hp, g: p.onGround }; },
    };
})();
