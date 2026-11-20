// Үүрэг бүрээр хөтчөөр нэвтэрч гол дэлгэцүүдийн зургийг авна (docs/screens)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = __dirname + '/docs/screens/';
(async () => {
  const b = await chromium.launch();
  const errors = [];
  async function as(login, viewport, steps) {
    const ctx = await b.newContext({ viewport, deviceScaleFactor: 1, locale: 'mn-MN', timezoneId: 'Asia/Ulaanbaatar' });
    const p = await ctx.newPage();
    p.on('console', m => m.type() === 'error' && errors.push(`${login}: ${m.text()}`));
    p.on('pageerror', e => errors.push(`${login}: ${e.message}`));
    if (login) { await p.goto(BASE + '/login'); await p.fill('input[autocomplete=username]', login); await p.fill('input[type=password]', 'Demo12345'); await p.click('button.btn'); await p.waitForTimeout(700); }
    for (const [name, fn] of steps) { await fn(p); await p.waitForTimeout(500); await p.screenshot({ path: OUT + name + '.png', fullPage: true }); }
    await ctx.close();
  }
  const phone = { width: 390, height: 780 }, desk = { width: 1280, height: 800 };
  await as(null, phone, [['01_schedule_public', p => p.goto(BASE + '/')], ['02_register', p => p.goto(BASE + '/register')]]);
  await as('99000001', phone, [
    ['03_citizen_new', async p => { await p.goto(BASE + '/new'); await p.selectOption('select >> nth=0', { index: 2 }); await p.selectOption('select >> nth=1', { index: 2 }); await p.fill('textarea', 'Хуучин шүүгээ 1, сандал 2'); }],
    ['04_citizen_sent', async p => { await p.click('button.btn.block'); await p.waitForTimeout(600); }],
    ['05_citizen_list', p => p.goto(BASE + '/my')],
    ['06_citizen_detail', p => p.goto(BASE + '/my/1')],
    ['07_notifications', p => p.goto(BASE + '/notifications')],
  ]);
  await as('90000002', desk, [
    ['08_coord_requests', async p => { await p.goto(BASE + '/coordinator'); await p.click('tbody tr >> nth=0'); }],
    ['09_coord_assign', async p => { await p.click('text=Хуваарилах >> nth=0'); await p.waitForTimeout(400); await p.click('tbody tr >> nth=0'); await p.waitForTimeout(500);
      const sel = p.locator('select').last(); await sel.selectOption({ index: 1 }); await p.locator('input[type=time]').nth(0).fill('10:30'); await p.locator('input[type=time]').nth(1).fill('11:30'); await p.click('button:has-text("Хуваарилах") >> nth=-1'); }],
    ['10_coord_jobs', async p => { await p.goto(BASE + '/coordinator/jobs'); const d = new Date(Date.now() + 864e5).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ulaanbaatar' }); await p.fill('input[type=date]', d); }],
    ['11_coord_schedule', p => p.goto(BASE + '/coordinator/schedule')],
    ['12_coord_phone', p => p.goto(BASE + '/coordinator/phone')],
  ]);
  await as('90000003', phone, [
    ['13_driver_today', async p => { await p.goto(BASE + '/driver'); const d = new Date(Date.now() + 864e5).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ulaanbaatar' }); await p.fill('input[type=date]', d); }],
    ['14_driver_started', async p => { await p.click('text=Эхлүүлэх >> nth=0'); await p.waitForTimeout(500); }],
  ]);
  await as('90000005', desk, [['15_manager_report', p => p.goto(BASE + '/reports')], ['16_manager_report_req', async p => { await p.click('button:has-text("Хүсэлт")'); }]]);
  await as('90000001', desk, [['17_admin_users', p => p.goto(BASE + '/admin')], ['18_admin_lookups', p => p.goto(BASE + '/admin/lookups')]]);
  await b.close();
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'Хөтчийн алдаа: 0');
})();
