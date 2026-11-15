// 回归测试：node tools/test.js（依赖本机已有的 playwright-core 与 headless shell，不会下载任何东西）
const { execSync } = require('child_process');
const path = require('path'), fs = require('fs');
const PW = process.env.PW_CORE || '/work/TEMU/node_modules/playwright-core';
const EXE = process.env.PW_EXE || '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
console.log('== 关卡校验 ==');
try { console.log(execSync('node ' + path.join(__dirname, 'validate.js')).toString().split('\n').slice(-2).join('')); }
catch (e) { console.log(e.stdout.toString()); process.exit(1); }
if (!fs.existsSync(PW) || !fs.existsSync(EXE)) { console.log('未找到 playwright-core 或 headless shell，跳过页面测试'); process.exit(0); }
const { chromium } = require(PW);
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(100);
  await page.evaluate(fs.readFileSync(path.join(__dirname, 'sim-helpers.js'), 'utf8'));
  const t0 = Date.now();
  const res = await page.evaluate(fs.readFileSync(path.join(__dirname, 'page-tests.js'), 'utf8'));
  console.log('== 页面测试 ==');
  let fail = 0;
  for (const r of res) { if (!r.ok) fail++; console.log((r.ok ? '  ✔ ' : '  ✘ ') + r.name + (r.ok ? '' : '  ' + r.detail)); }
  if (errors.length) { fail++; console.log('页面错误:\n' + errors.join('\n')); }
  console.log(`\n${res.length - (fail - (errors.length ? 1 : 0))}/${res.length} 通过，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
