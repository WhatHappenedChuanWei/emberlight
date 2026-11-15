// 确定性模拟：在页面中手动逐帧推进游戏，测物理与流程。node tools/sim.js tests.js
const { chromium } = require(process.env.PW_CORE || '/work/TEMU/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const EXE = process.env.PW_EXE || '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '')));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); else console.log('[page]', m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(300);
  // 停掉 RAF 循环的影响：替换 requestAnimationFrame
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(100);
  await page.evaluate(fs.readFileSync(path.join(__dirname, 'sim-helpers.js'), 'utf8'));

  const SHOTDIR = process.env.OUT || require('os').tmpdir();
  await page.exposeFunction('__shot', async name => { await page.screenshot({ path: path.join(SHOTDIR, name + '.png') }); });
  const tests = fs.readFileSync(path.resolve(process.argv[2]), 'utf8');
  try { const r = await page.evaluate(tests); if (r !== undefined) console.log(typeof r === 'string' ? r : JSON.stringify(r, null, 1)); }
  catch (e) { console.log('TEST THREW:', e.message); }
  if (process.argv[3]) await page.evaluate(() => { Game.draw(document.getElementById('game').getContext('2d')); }), await page.screenshot({ path: process.argv[3] });
  console.log(errors.length ? errors.join('\n') : 'no page errors');
  await browser.close();
})();
