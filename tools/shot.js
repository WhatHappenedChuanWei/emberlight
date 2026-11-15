// 用本地已有的 headless shell 进行截图/自动化测试（不下载任何东西）
// 用法：node tools/shot.js <script.json 或内联步骤>
const { chromium } = require(process.env.PW_CORE || '/work/TEMU/node_modules/playwright-core');
const path = require('path');
const OUT = process.env.OUT || require('os').tmpdir();
const EXE = process.env.PW_EXE || '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '')));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  const steps = require(path.resolve(process.argv[2]));
  for (const s of steps) {
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.eval) { const r = await page.evaluate(s.eval); if (r !== undefined) console.log('eval:', JSON.stringify(r)); }
    if (s.press) await page.keyboard.press(s.press, { delay: s.hold || 60 });
    if (s.down) await page.keyboard.down(s.down);
    if (s.up) await page.keyboard.up(s.up);
    if (s.shot) await page.screenshot({ path: path.join(OUT, s.shot + '.png') });
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
