// E2E テスト: node tests/e2e.cjs   （先に npm run build）
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const APP = 'file://' + path.resolve(__dirname, '../dist/ahk-layout-studio.html');
const FIX = path.resolve(__dirname, 'fixtures/layout-v2.ahk');
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['✔', name]); } catch (e) { results.push(['✘', name, e.message.split('\n').slice(0, 6).join('\n')]); }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push('ブラウザの標準ダイアログが出た: ' + d.message()); d.dismiss(); });
  // ページ内ダイアログに答える
  const answer = async (text) => {
    await page.waitForSelector('#udlg[open]');
    if (text != null) await page.fill('#uIn', text);
    await page.click('#uOk');
  };
  await page.goto(APP);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const ev = (fn, arg) => page.evaluate(fn, arg);
  const out = () => ev(() => compose(DOC).text);
  const sig = () => ev(() => S.items.map(i => [i.ctx || '', (i.prefixRaw || '').toLowerCase(), i.mods.join('+'), i.keyRaw.toLowerCase(), i.up, i.out].join('|')).sort());
  const hold = async label => { await page.click(`.lchip:has-text("${label}")`); };
  const key = id => `#skb .key[data-sk="${id}"]`;
  const pal = label => `.pal:has(b:text-is("${label}"))`;

  await page.setInputFiles('#file', FIX);
  const original = fs.readFileSync(FIX, 'utf8');

  await test('読み込んだだけなら書き出し内容は元のファイルと同じ', async () => {
    assert.equal(await out(), original.replace(/^﻿/, ''));
  });
  await test('読み取り: m & g::; と m & ,::+ と v & ,::^Enter を正しく読む', async () => {
    const s = await sig();
    assert.ok(s.includes('|m||g|false|;'), 'm & g::;');
    assert.ok(s.includes('|m||,|false|+'), 'm & ,::+');
    assert.ok(s.some(x => x.startsWith('|v||,|false|')), 'v & ,');
    assert.ok(s.includes('|m||h|false|='), 'm & h::= は = と表示');
    assert.ok(s.includes('|m||w|false|"'), 'Chr(34) は " と表示');
  });

  const dups = () => ev(() => { const seen = {}, d = [];
    for (const i of S.items) { const k = [i.ctx || '', i.prefixIds.join(), i.mods.map(modBase).sort().join(), i.keyIds.join() || i.keyRaw.toLowerCase(), i.up].join('|');
      if (seen[k]) d.push(i.spec + ' / ' + seen[k]); seen[k] = i.spec; } return d; });
  await test('手書きのキーを直接編集すると、その定義だけ取り込まれ重複しない', async () => {
    await hold('V');
    await page.dragAndDrop(pal('Home'), key('j'));
    const t = await out();
    assert.match(t, /^v & j::Home$/m);
    assert.equal((t.match(/^v & j::/gm) || []).length, 1);
    assert.equal((t.match(/^\$v::/gm) || []).length, 1, '$v は1つだけ（手書きのまま）');
    assert.deepEqual(await dups(), []);
    await page.click('#bUndo');
    assert.equal(await out(), original);
    await hold('なし');
  });

  const before = await sig();
  await test('まとめて取り込んでも動作は変わらない', async () => {
    await page.click('#importAll'); await answer();
    assert.deepEqual(await sig(), before);
    const t = await out();
    assert.match(t, /; ==== BEGIN 配列アプリ管理区画/);
    assert.match(t, /MyHelper\(\) \{/, '関数は手書き部分に残る');
    assert.match(t, /\$\/:: \{\n?\r?\n?\s*KeyWait\("\/"\)/, '$/ の単押し判定は残る');
    assert.match(t, /#InputLevel 1[\s\S]*BEGIN/, '#InputLevel より後に区画');
    assert.deepEqual(await dups(), []);
  });
  await test('書き出した内容を読み直しても同じ（往復で変化しない）', async () => {
    const t = await out();
    const again = await ev(t => compose(docFromText('x.ahk', t)).text, t);
    assert.equal(again, t);
  });

  await test('V を押した状態で ← を H にドラッグ → v & h::Left', async () => {
    await hold('V');
    await page.dragAndDrop(pal('←'), key('h'));
    assert.match(await out(), /^v & h::Left$/m);
  });
  await test('V レイヤーで J を U にドラッグ → 移動', async () => {
    await page.dragAndDrop(key('j'), key('u'));
    const t = await out();
    assert.match(t, /^v & u::Left$/m); assert.doesNotMatch(t, /^v & j::/m);
  });
  await test('占有されたキーへドラッグ → 入れ替え', async () => {
    await page.dragAndDrop(key('u'), key('k'));
    const t = await out();
    assert.match(t, /^v & k::Left$/m); assert.match(t, /^v & u::Down$/m);
  });
  await test('ゴミ箱へドラッグ → 解除', async () => {
    await page.dragAndDrop(key('u'), '.trash');
    assert.doesNotMatch(await out(), /^v & u::/m);
  });
  await test('元に戻す・やり直し', async () => {
    await page.click('#bUndo');
    assert.match(await out(), /^v & u::Down$/m);
    await page.click('#bRedo');
    assert.doesNotMatch(await out(), /^v & u::/m);
  });
  await test('キーをレイヤーのボタンへドラッグ → そのレイヤーへ移す（V の I → ベース）', async () => {
    await page.dragAndDrop(key('i'), '.lchip[data-drop="layer:base"]');
    const t = await out();
    assert.match(t, /^i::Up$/m); assert.doesNotMatch(t, /^v & i::/m);
  });
  await test('新しいレイヤー: N をレイヤー作成へ → 部品を置くと n & x と単押しが自動で作られる', async () => {
    await hold('なし');
    await page.dragAndDrop(key('n'), '.lchip.newl');
    const held = await ev(() => [...S.sim.held]);
    assert.deepEqual(held, ['n']);
    await page.dragAndDrop(pal('コピー'), key('x'));
    const t = await out();
    assert.match(t, /^n & x::Send\("\^c"\)$/m);
    assert.match(t, /\$n:: \{[^}]*KeyWait\("n"\)[^}]*Send\("\{n\}"\)/s, '単押しで n');
    assert.deepEqual(await dups(), []);
  });
  await test('右欄のフォームで編集して保存', async () => {
    await page.click(key('x'));
    await page.selectOption('#iType', 'text');
    await page.fill('#iVal', 'こんにちは');
    await page.click('#iSave');
    assert.match(await out(), /^n & x::SendText\("こんにちは"\)$/m);
  });
  await test('アプリ別: chrome.exe で Ctrl を押して H に「前のタブ」', async () => {
    await hold('なし');
    await page.click('#addApp'); await answer('chrome.exe');
    await page.click('.lchip.mod:has-text("Ctrl")');
    await page.dragAndDrop(pal('前のタブ'), key('h'));
    const t = await out();
    assert.match(t, /#HotIf WinActive\("ahk_exe chrome.exe"\)[\s\S]*\^h::Send\("\^\+\{Tab\}"\)[\s\S]*#HotIf\r?\n/);
  });
  await test('ためす: クリックした結果がログに出る', async () => {
    await page.click('[data-app=""]');
    await hold('V');
    await page.click(key('l'));
    const log = await page.textContent('.loglist');
    assert.match(log, /→ →/);
  });
  await test('編集ロック中はドラッグしても変わらない', async () => {
    const t0 = await out();
    await page.check('#lockT');
    await page.dragAndDrop(pal('←'), key('p'));
    assert.equal(await out(), t0);
    await page.uncheck('#lockT');
  });
  await test('書き出し（ダウンロード）: BOM付き UTF-8・改行コード維持', async () => {
    await page.click('#bExport');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#xDl')]);
    const p = await dl.path(); const buf = fs.readFileSync(p);
    assert.deepEqual([...buf.slice(0, 3)], [0xEF, 0xBB, 0xBF]);
    assert.equal(buf.slice(3).toString('utf8'), await out());
    await page.click('#xClose');
  });
  await test('再読み込みしても状態が残る', async () => {
    const t = await out();
    await page.reload();
    assert.equal(await out(), t);
  });
  await test('くわしく画面が表示できる', async () => {
    await page.click('#tabs button[data-v="detail"]');
    await page.click('.node:has-text("全体マップ")');
    assert.ok(await page.locator('.card').count() > 3);
    await page.click('#tabs button[data-v="studio"]');
  });
  await test('v1 のファイルも開ける（エラーにならない）', async () => {
    const v1 = path.join(require('os').tmpdir(), 'v1.ahk');
    fs.writeFileSync(v1, '#If GetKeyState("vk1D", "P")\r\nj::Send, {Left}\r\n#If\r\nF13::MsgBox, hi\r\n');
    await page.setInputFiles('#file', v1); await answer();
    await page.waitForFunction(() => DOC.name === 'v1.ahk');
    assert.equal(await ev(() => S.items.length), 2);
  });
  await test('パレットの「文字を入力…」はページ内の入力欄で聞く', async () => {
    await page.click('[data-app=""]'); await hold('なし');
    await page.dragAndDrop(pal('✍ 文字を入力…'), key('f12'));
    await answer('おつかれさま');
    assert.match(await out(), /^F12::SendText\("おつかれさま"\)$/m);
  });
  await test('ページ上でエラーが出ていない', async () => { assert.deepEqual(errors, []); });

  await page.screenshot({ path: path.join(__dirname, 'last-run.png') });
  await browser.close();
  for (const r of results) console.log(r[0], r[1], r[2] ? '\n   ' + r[2].replace(/\n/g, '\n   ') : '');
  const failed = results.filter(r => r[0] === '✘').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
