"use strict";
/* =========================================================
   キーボード画面（ためす＋つくる）
   - キーをクリック: 押しっぱなし（レイヤーキー・修飾キー）／ためす
   - パレットからキーへドラッグ: いまの状態で割り当て
   - キーからキーへドラッグ: 移動（相手があれば入れ替え）、Ctrl/Alt+ドラッグでコピー
   ========================================================= */
const MODNAME = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', win: 'Win' };

/* いまの押下状態で id を押したときの「条件」 */
function triggerFor(id) {
  const H = [...S.sim.held];
  const pre = H.filter(x => !STD_MODS.includes(x));
  const mods = pre.length ? [] : sortMods([...new Set(H.filter(x => STD_MODS.includes(x)).map(x => MODNAME[x.slice(1)]))]);
  return { ctx: S.appCtx || '', prefix: pre.length ? rawNameFor(pre[0]) : '', mods, key: rawNameFor(id), up: false,
    flags: { tilde: false, star: false, dollar: false } };
}
function stateLabel() {
  const H = [...S.sim.held];
  const app = S.appCtx ? `「${ctxLabel(S.appCtx)}」で ` : '';
  if (!H.length) return app + '何も押していないとき';
  return app + H.map(capLabel).join(' + ') + ' を押している間';
}
function prefixChips() {
  const ids = [];
  const add = id => { if (id && !ids.includes(id) && !STD_MODS.includes(id)) ids.push(id); };
  for (const l of S.layers.values()) if (l.type === 'prefix') l.prefixIds.slice(0, 1).forEach(add);
  for (const k of DOC.layerKeys) resolveKey(k).slice(0, 1).forEach(add);
  return ids.map(id => ({ id, n: S.items.filter(it => it.prefixIds.includes(id)).length }));
}

/* ---------- 描画 ---------- */
function renderPalette() {
  const q = S.paletteQ.toLowerCase();
  let h = `<div class="pal-head"><input id="palQ" placeholder="🔍 部品をさがす" value="${esc(S.paletteQ)}"></div>
    <div class="pal-hint">キーへ<b>ドラッグ</b>して割り当て。<br>キーを選んでから部品を<b>クリック</b>しても OK。</div>`;
  for (const c of PALETTE) {
    const items = c.items.filter(p => !q || (p.label + p.sub + c.cat).toLowerCase().includes(q));
    if (!items.length) continue;
    h += `<details class="pal-cat" ${S.palClosed && S.palClosed[c.cat] ? '' : 'open'} data-cat="${esc(c.cat)}"><summary>${esc(c.cat)}</summary><div class="pal-grid">` +
      items.map(p => `<div class="pal ${p.special ? 'special' : ''}" draggable="true" data-pal="${PAL.indexOf(p)}" title="${esc(p.sub || p.label)}">
        <b>${esc(p.label)}</b>${p.sub ? `<small>${esc(p.sub)}</small>` : ''}</div>`).join('') + `</div></details>`;
  }
  $('#tree').innerHTML = h;
}

function studioKbdHTML(U) {
  const H = S.sim.held, hold = holdableIds();
  let h = `<div class="kbd" style="width:${KB_W * U}px;height:${KB_H * U}px">`;
  for (const k of LAYOUT) {
    let cls = 'key', out = '', bd = '';
    const isHeld = H.has(k.id);
    const it = isHeld ? null : resolvePress(k.id);
    if (isHeld) { cls += ' held'; out = '押下中'; }
    else if (it) { cls += ' ' + it.kind; out = it.out; if (it.locked) { cls += ' lockedk'; bd = '🔒'; } if (it.auto) cls += ' autok';
      // レイヤーを押しているのに、そのレイヤー外（ベース等）の定義が効いているキーは薄く
      if (H.size && !it.prefixRaw && !it.mods.length && !gksIds(it.ctx).length) cls += ' fallback'; }
    else cls += ' empty';
    if (hold.has(k.id) && !isHeld) { cls += ' trigger'; if (!STD_MODS.includes(k.id)) bd = '▸' + bd; }
    if (S.sim.flash === k.id) cls += ' flash';
    if (S.selKey === k.id) cls += ' selk';
    const tip = it ? `${capLabel(k.id)} → ${it.out}\n${meaning(it)}${it.locked ? '\n🔒 手書きの定義（編集すると取り込みます）' : ''}` :
      (hold.has(k.id) ? `${capLabel(k.id)}：クリックで押しっぱなし` : `${capLabel(k.id)}（割り当てなし）`);
    h += `<div class="${cls}" data-sk="${esc(k.id)}" data-drop="key:${esc(k.id)}" draggable="${S.locked ? 'false' : 'true'}" title="${esc(tip)}"
      style="left:${k.x * U}px;top:${k.y * U}px;width:${k.w * U - 4}px;height:${k.h * U - 4}px">` +
      `<span class="cap">${esc(capLabel(k.id))}</span><span class="out" style="font-size:${fontFor(out, U)}px">${esc(out)}</span><span class="bd">${bd}</span></div>`;
  }
  return h + `</div>`;
}
function fontFor(out, U) {
  const len = [...out].length;
  return len <= 2 ? Math.round(U * .36) : len <= 4 ? Math.round(U * .27) : len <= 7 ? Math.round(U * .21) : Math.round(U * .18);
}

function renderStudio() {
  renderPalette();
  const H = S.sim.held;
  const locked = S.items.filter(it => it.locked);
  let h = '';
  // アプリ（条件）
  h += `<div class="bar"><span class="lbl">アプリ</span>
    <span class="chip ${!S.appCtx ? 'on' : ''}" data-app="">🌐 すべて</span>` +
    S.ctxs.filter(c => c).map(c => gksIds(c).length
      ? `<span class="chip auto ${ctxActive(c) ? 'on' : ''}" title="${esc(c)}（キーを押すと自動で有効）">${esc(ctxLabel(c))}</span>`
      : `<span class="chip ${S.appCtx === c ? 'on' : ''}" data-app="${esc(c)}" title="${esc(c)}">🎯 ${esc(ctxLabel(c))}</span>`).join('') +
    `<span class="chip ghost" id="addApp" title="特定のアプリだけで動く割り当てを作る">＋ アプリ別</span>
    <span style="flex:1"></span>
    <label class="lockt ${S.locked ? 'on' : ''}" title="オンにすると、ためすだけになり配列は変わりません"><input type="checkbox" id="lockT" ${S.locked ? 'checked' : ''}> 🔒 編集ロック</label></div>`;
  // 押しているキー（レイヤー）
  h += `<div class="bar layers"><span class="lbl">押している<br>キー</span>
    <span class="lchip ${!H.size ? 'on' : ''}" data-hold="" data-drop="layer:base">⌨ なし<small>ベース</small></span>` +
    prefixChips().map(p => `<span class="lchip ${H.has(p.id) ? 'on' : ''}" data-hold="${esc(p.id)}" data-drop="layer:pre:${esc(p.id)}">${esc(capLabel(p.id))}<small>${p.n}件</small></span>`).join('') +
    `<span class="sep"></span>` +
    ['ctrl', 'shift', 'alt', 'win'].map(m => { const on = H.has('l' + m) || H.has('r' + m);
      return `<span class="lchip mod ${on ? 'on' : ''}" data-hold="l${m}" data-drop="layer:mod:${MODNAME[m]}">${MODNAME[m]}</span>`; }).join('') +
    `<span class="lchip newl" data-drop="newlayer" title="キーをここへドラッグすると、そのキーを押しながら使うレイヤーを作れます">＋ レイヤーを作る<small>キーをここへ</small></span></div>`;
  if (locked.length) h += `<div class="banner">🔒 手書きの定義が <b>${locked.length}</b> 件あります。そのままでも表示・ためす・ドラッグ編集できます（触った定義から自動で取り込みます）。
    <button class="btn" id="importAll">まとめて取り込む</button></div>`;
  h += `<div class="state">${esc(stateLabel())} <span class="dim">の配列</span></div>`;
  h += `<div id="skb"></div>`;
  h += `<div class="under"><div class="trash" data-drop="trash">🗑 ここへドラッグで解除</div>
    <div class="dim hint">クリック: ためす・選ぶ ／ ドラッグ: 移動（相手があれば入れ替え） ／ <b>Ctrl</b>+ドラッグ: コピー ／ レイヤーのボタンへドラッグ: そのレイヤーへ移す</div></div>`;
  h += `<div class="loglist"><span class="lbl">ためしたログ</span>${S.sim.log.length ? S.sim.log.slice(0, 12).map(e =>
    `<span class="logc">${e.keys.map((t, i, a) => kk(t, i < a.length - 1 && e.heldN > 0)).join('+')} → ${e.it ? `<b>${esc(e.it.out)}</b>` : '<span class="dim">そのまま</span>'}</span>`).join('') :
    '<span class="dim">キーを押す（クリック／実際のキーボード）と、何が起きたかがここに出ます。</span>'}
    <label class="realk"><input type="checkbox" id="simReal" ${S.sim.real ? 'checked' : ''}> 実キーボードで操作</label></div>`;
  $('#main').innerHTML = h;
  const w = $('#skb'); w.innerHTML = studioKbdHTML(unitFor(w));
  S.sim.flash = null;
  renderInspector();
}

/* ---------- 右欄：選んだキーの詳細・編集 ---------- */
const TYPE_OPTS = [['remap', '別のキーとして動かす（リマップ）'], ['send', 'キー操作を送る（Send）'], ['text', '文字を入力（SendText）'], ['run', 'アプリ・URLを開く（Run）'], ['code', 'コードを書く']];
const TYPE_HELP = { remap: 'キー名（例: Left, Enter, BackSpace, ^t）', send: '{Left} {Enter} ^c(Ctrl) +(Shift) !(Alt) #(Win)', text: '入力する文字そのもの', run: 'notepad.exe / https://…', code: 'AutoHotkey v2 のコード（複数行OK）' };
function renderInspector() {
  const el = $('#detail'), id = S.selKey;
  if (!id) {
    const n = DOC.bindings.length, nl = S.items.filter(i => i.locked).length;
    el.innerHTML = `<div class="ins-empty"><div class="big">👆</div>キーをクリックすると、ここで<b>いまの状態での割り当て</b>を見たり、書き換えたりできます。
      <div class="stat2"><div><b>${n}</b>アプリ管理</div><div><b>${nl}</b>手書き</div><div><b>${S.items.length}</b>合計</div></div></div>`;
    return;
  }
  const trig = triggerFor(id);
  const isHeld = S.sim.held.has(id);
  const cur = isHeld ? null : resolvePress(id);
  const exact = findBinding(trig);
  const sameAsCur = cur && sameTrig(itemTrig(cur), trig);
  let h = `<div class="ins-head">${[...S.sim.held].map(x => kk(capLabel(x), 1)).join(' + ')}${S.sim.held.size ? ' + ' : ''}<span class="dk">${esc(capLabel(id))}</span>
    ${S.appCtx ? `<div class="dim" style="font-size:12px;margin-top:4px">🎯 ${esc(ctxLabel(S.appCtx))} のとき</div>` : ''}</div>`;
  if (isHeld) {
    h += `<div class="di">このキーは押しっぱなしにしています。<br>単押しの動作を変えるには、「押しているキー: なし」に戻してからこのキーを選んでください。</div>`;
  } else {
    h += `<div class="di cur"><div class="hd">いまの動作 ${cur ? (cur.locked ? '<span class="tag lock">🔒 手書き</span>' : cur.auto ? '<span class="tag auto">自動</span>' : '<span class="tag own">アプリ管理</span>') : ''}</div>`;
    if (cur) {
      h += `<div class="outbig">→ ${esc(cur.out)}</div><div class="dim">${esc(meaning(cur))}</div>`;
      if (!sameAsCur) h += `<div class="note">※ この状態専用の割り当てはなく、「${esc(ctxLabel(cur.ctx))} › ${esc(cur.layerName)}」の設定が使われています。下で保存すると、この状態専用の割り当てになります。</div>`;
      if (cur.auto) h += `<div class="note">レイヤーキーの単押しは、自動で「元のキーを入力」になっています。</div>`;
    } else h += `<div class="dim">割り当てなし（普通に入力されます）</div>`;
    h += `</div>`;
    // 編集フォーム
    const base = exact ? { act: exact.act, comment: exact.comment } : (sameAsCur ? (cur.auto ? { act: { type: 'send', value: '{' + cur.keyRaw + '}' }, comment: '' } : itemToBinding(cur)) : null);
    const act = base ? base.act : { type: 'remap', value: '' };
    if (S.locked) h += `<div class="note">🔒 編集ロック中です。上のチェックを外すと編集できます。</div>`;
    else {
      h += `<div class="di form"><div class="hd">${exact || sameAsCur ? 'この割り当てを編集' : '＋ この状態に割り当てる'}</div>
        <select id="iType">${TYPE_OPTS.map(([v, l]) => `<option value="${v}" ${v === act.type ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <textarea id="iVal" rows="${act.type === 'code' ? 5 : 1}" spellcheck="false" placeholder="${esc(TYPE_HELP[act.type])}">${esc(act.value)}</textarea>
        <div id="iHelp" class="dim" style="font-size:11px">${esc(TYPE_HELP[act.type])}</div>
        <input id="iCm" placeholder="コメント（任意）" value="${esc(base ? base.comment || '' : '')}">
        ${cur && cur.locked && sameAsCur ? '<div class="note">保存すると、この手書き定義をアプリ管理に取り込んで置き換えます。</div>' : ''}
        <div class="row"><button class="btn primary" id="iSave">保存</button>
        ${cur && sameAsCur && !cur.auto ? '<button class="btn" id="iDel">解除</button>' : ''}</div></div>`;
    }
    if (cur) h += `<details class="codebox"><summary>コードを見る <span class="dim mono">${esc(DOC.name)}:${cur.line}</span></summary><pre class="mono">${esc(cur.code)}</pre></details>`;
  }
  // レイヤーキー
  const lay = S.items.filter(it => it.prefixIds.includes(id));
  if (lay.length) h += `<div class="di lay">▸ このキーを押しながら使える割り当てが <b>${lay.length}</b> 件 <button class="btn" data-hold="${esc(id)}">押しっぱなしにする</button></div>`;
  // ほかの状態
  const others = S.items.filter(it => it.keyIds.includes(id) && it !== cur);
  if (others.length) h += `<div class="tsec">ほかの状態での割り当て</div>` + others.map(it =>
    `<div class="orow" data-goto="${it.line}">${comboHTML(it)} → <b>${esc(it.out)}</b>${it.locked ? ' 🔒' : ''}</div>`).join('');
  el.innerHTML = h;
}

/* ---------- 操作 ---------- */
function simClick(id) {
  const prefixHeld = [...S.sim.held].filter(x => !STD_MODS.includes(x));
  const comboWithHeld = prefixHeld.length && S.items.some(it => it.keyIds.includes(id) && it.prefixIds.some(p => S.sim.held.has(p)));
  S.selKey = id;
  if (holdableIds().has(id) && !comboWithHeld) simHold(id, !S.sim.held.has(id));
  else simPress(id);
}
function simPress(id) {
  S.sim.used = true;
  const it = resolvePress(id);
  S.sim.log.unshift({ keys: [...heldLabel(), capLabel(id)], heldN: S.sim.held.size, it });
  S.sim.log.length = Math.min(S.sim.log.length, 30);
  S.sim.flash = id;
  renderAll();
}
function simHold(id, on) {
  if (on) {
    // レイヤーキーは1つだけ押しっぱなしにする
    if (!STD_MODS.includes(id)) for (const x of [...S.sim.held]) if (!STD_MODS.includes(x)) S.sim.held.delete(x);
    S.sim.held.add(id); S.sim.used = false;
  } else {
    S.sim.held.delete(id);
    if (!S.sim.used) {
      const it = resolvePress(id, true) || resolvePress(id);
      if (it) S.sim.log.unshift({ keys: [capLabel(id) + '（単押し）'], heldN: 0, it });
    }
  }
  renderAll();
}
function gotoItem(it) {
  S.sim.held = new Set(it.prefixIds.length ? [it.prefixIds[0]] : modIdsFor(it.mods));
  gksIds(it.ctx).forEach(i => S.sim.held.add(i));
  S.appCtx = gksIds(it.ctx).length ? '' : (it.ctx || '');
  S.selKey = it.keyIds[0] || null; S.view = 'studio';
  renderAll();
}

/* ドラッグ＆ドロップ */
let DRAG = null;
document.addEventListener('dragstart', e => {
  const p = e.target.closest && e.target.closest('[data-pal]');
  const k = e.target.closest && e.target.closest('.key[data-sk]');
  if (p) DRAG = { from: 'pal', i: +p.dataset.pal };
  else if (k && S.view === 'studio') {
    const id = k.dataset.sk, it = S.sim.held.has(id) ? null : resolvePress(id);
    DRAG = { from: 'key', id, line: it ? it.line : null };
  } else return;
  e.dataTransfer.setData('application/x-als', '1');
  e.dataTransfer.effectAllowed = 'copyMove';
  document.body.classList.add('dragging');
});
document.addEventListener('dragover', e => {
  if (!DRAG) return;
  const t = e.target.closest && e.target.closest('[data-drop]');
  $$('.over').forEach(x => x !== t && x.classList.remove('over'));
  if (!t) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = (e.ctrlKey || e.altKey || e.metaKey) ? 'copy' : 'move';
  t.classList.add('over');
});
document.addEventListener('dragend', () => { DRAG = null; document.body.classList.remove('dragging'); $$('.over').forEach(x => x.classList.remove('over')); });
document.addEventListener('drop', e => {
  if (!DRAG) return;
  const t = e.target.closest && e.target.closest('[data-drop]');
  const d = DRAG; DRAG = null; document.body.classList.remove('dragging'); $$('.over').forEach(x => x.classList.remove('over'));
  if (!t) return;
  e.preventDefault(); e.stopPropagation();
  handleDrop(d, t.dataset.drop, e.ctrlKey || e.altKey || e.metaKey);
});
function handleDrop(d, target, copy) {
  if (S.locked) return toast('編集ロック中です（上の 🔒 編集ロック を外してください）', 'warn');
  const [kind, a, b] = target.split(':');
  if (d.from === 'pal') {
    const p = PAL[d.i];
    if (kind === 'key') return dropPal(p, a);
    if (kind === 'newlayer' || kind === 'layer') return toast('部品はキーボードのキーへドラッグしてください', 'warn');
    return;
  }
  const it = d.line ? S.items.find(x => x.line === d.line) : null;
  if (kind === 'newlayer') {
    const raw = rawNameFor(d.id);
    addLayerKey(raw); S.sim.held = new Set([d.id]); S.selKey = null; renderAll();
    return;
  }
  if (!it) return toast('割り当てのないキーです（パレットから部品をドラッグしてください）', 'warn');
  if (kind === 'trash') return removeItem(it);
  if (kind === 'key') {
    if (S.sim.held.has(a)) return toast('押しっぱなしのキー自身には置けません', 'warn');
    const trig = triggerFor(a);
    if (moveItem(it, trig, copy)) S.selKey = a;
    return renderAll();
  }
  if (kind === 'layer') {
    const trig = { ctx: it.ctx || '', prefix: '', mods: [], key: it.keyRaw, up: !!it.up };
    if (a === 'pre') { if (resolveKey(it.keyRaw).includes(b)) return toast('そのキー自身のレイヤーには移せません', 'warn'); trig.prefix = rawNameFor(b); }
    if (a === 'mod') trig.mods = [b];
    moveItem(it, trig, copy);
  }
}
function dropPal(p, id) {
  if (p.special === 'layer') {
    addLayerKey(rawNameFor(id)); S.sim.held = new Set([id]); S.selKey = null; renderAll();
    return;
  }
  if (S.sim.held.has(id)) return toast('押しっぱなしのキー自身には割り当てられません。単押しの動作は「なし」に戻してから割り当ててください', 'warn');
  const act = p.act ? { ...p.act } : askAct(p.ask);
  if (!act) return;
  S.selKey = id;
  assign(triggerFor(id), act);
}

/* クリック */
document.addEventListener('click', e => {
  if (S.view !== 'studio') return;
  const t = e.target;
  const k = t.closest('#skb .key[data-sk]'); if (k) return simClick(k.dataset.sk);
  const hold = t.closest('[data-hold]');
  if (hold) {
    const id = hold.dataset.hold;
    if (!id) S.sim.held.clear();
    else if (STD_MODS.includes(id)) { const m = id.slice(1); const on = S.sim.held.has('l' + m) || S.sim.held.has('r' + m);
      for (const x of [...S.sim.held]) if (!STD_MODS.includes(x)) S.sim.held.delete(x);
      S.sim.held.delete('l' + m); S.sim.held.delete('r' + m); if (!on) S.sim.held.add(id); }
    else if (S.sim.held.has(id) && S.sim.held.size === 1) S.sim.held.clear();
    else S.sim.held = new Set([id]);
    S.sim.used = false; return renderAll();
  }
  const pal = t.closest('[data-pal]');
  if (pal) { if (!S.selKey) return toast('先にキーボードのキーをクリックして選んでください', 'warn'); if (S.locked) return toast('編集ロック中です', 'warn'); return dropPal(PAL[+pal.dataset.pal], S.selKey); }
  const app = t.closest('[data-app]'); if (app) { S.appCtx = app.dataset.app; return renderAll(); }
  if (t.closest('#addApp')) {
    const exe = prompt('どのアプリで使う割り当てですか？ 実行ファイル名を入力してください（例: chrome.exe, Code.exe）', '');
    if (!exe) return;
    const ctx = `WinActive("ahk_exe ${exe.trim()}")`;
    mutate(() => { if (!DOC.ctxs.includes(ctx)) DOC.ctxs.push(ctx); });
    S.appCtx = ctx; return renderAll();
  }
  if (t.closest('#importAll')) {
    if (!confirm('手書きの定義をまとめてアプリ管理に取り込みます。\n・関数や複雑な処理（積み重ね記法など）はそのまま手書き部分に残ります\n・取り込んだ定義は「管理区画」に整理して書き出されます\n・あとから ↶ 元に戻す で戻せます\n\n取り込みますか？')) return;
    const n = importAllHand(); return toast(n ? `${n} 件を取り込みました` : '取り込める定義がありませんでした');
  }
  if (t.id === 'iSave') {
    const act = { type: $('#iType').value, value: $('#iVal').value };
    if (!act.value.trim()) return toast('内容が空です', 'warn');
    return assign(triggerFor(S.selKey), act, $('#iCm').value.trim());
  }
  if (t.id === 'iDel') { const it = resolvePress(S.selKey); if (it) removeItem(it); return; }
  const go = t.closest('[data-goto]'); if (go) { const it = S.items.find(x => x.line === +go.dataset.goto); if (it) gotoItem(it); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'lockT') { S.locked = t.checked; renderAll(); }
  if (t.id === 'simReal') { S.sim.real = t.checked; t.blur(); }
  if (t.id === 'iType') { $('#iVal').rows = t.value === 'code' ? 5 : 1; $('#iVal').placeholder = TYPE_HELP[t.value]; $('#iHelp').textContent = TYPE_HELP[t.value]; }
});
document.addEventListener('input', e => { if (e.target.id === 'palQ') { S.paletteQ = e.target.value; renderPalette(); const q = $('#palQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); } });
document.addEventListener('toggle', e => { const c = e.target.dataset && e.target.dataset.cat; if (c) { S.palClosed = S.palClosed || {}; S.palClosed[c] = !e.target.open; } }, true);

/* 実キーボード */
function simKeyActive(e) {
  return S.view === 'studio' && S.sim.real && !document.querySelector('dialog[open]') &&
    !(e.target.closest && e.target.closest('input:not([type=checkbox]),textarea,select'));
}
window.addEventListener('keydown', e => {
  if (!simKeyActive(e)) return;
  const id = codeToId(e.code); if (!id) return;
  e.preventDefault(); if (e.repeat) return;
  S.selKey = id;
  const prefixHeld = [...S.sim.held].some(x => !STD_MODS.includes(x));
  const comboWithHeld = prefixHeld && S.items.some(it => it.keyIds.includes(id) && it.prefixIds.some(p => S.sim.held.has(p)));
  if (holdableIds().has(id) && !comboWithHeld) { if (!S.sim.held.has(id)) simHold(id, true); }
  else simPress(id);
});
window.addEventListener('keyup', e => {
  if (!simKeyActive(e)) return;
  const id = codeToId(e.code); if (!id) return;
  e.preventDefault();
  if (S.sim.held.has(id)) simHold(id, false);
});
