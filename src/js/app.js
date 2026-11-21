"use strict";
/* =========================================================
   起動・画面切り替え・ファイル操作・書き出し
   ========================================================= */
function renderAll() {
  document.body.dataset.view = S.view;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
  $$('#lay button').forEach(b => b.classList.toggle('on', b.dataset.l === S.layout));
  $('#docName').textContent = DOC.name;
  $('#bUndo').disabled = !UNDO.length; $('#bRedo').disabled = !REDO.length;
  const changed = compose(DOC).text !== DOC.orig;
  $('#bExport').classList.toggle('primary', changed);
  $('#bExport').innerHTML = '💾 書き出し' + (changed ? ' <span class="badge">●</span>' : '');
  if (S.view === 'studio') renderStudio();
  else { renderTree(); renderDetailMain(); renderDetailPanel(); }
}

/* ---------- ファイル ---------- */
async function readText(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf[0] === 0xFF && buf[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf);
  if (buf[0] === 0xFE && buf[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch (_) { try { return new TextDecoder('shift_jis').decode(buf); } catch (__) { return new TextDecoder().decode(buf); } }
}
function hasUnsaved() { return DOC && compose(DOC).text !== DOC.orig && (DOC.orig || DOC.bindings.length); }
function openDoc(doc) {
  DOC = doc; UNDO.length = 0; REDO.length = 0;
  S.sim.held.clear(); S.sim.log = []; S.selKey = null; S.appCtx = ''; S.sel = 'all';
  derive();
  if (!isV2Text(DOC.orig || '#Requires AutoHotkey v2.0') && DOC.orig)
    toast('このファイルは AutoHotkey v1 の書き方のようです。表示・ためすはできますが、編集は v2 の書き方で書き出されます', 'warn');
  persist(); renderAll();
}
async function openFile(f) {
  if (hasUnsaved() && !confirm('いまの配列には書き出していない変更があります。破棄して開きますか？')) return;
  openDoc(docFromText(f.name, await readText(f)));
  toast(`${f.name} を開きました`);
}

/* ---------- 書き出し ---------- */
function openExport() {
  const text = compose(DOC).text;
  const changed = text !== DOC.orig;
  $('#xdlg').innerHTML = `<h3 style="margin-top:0">💾 書き出し</h3>
    <div class="xrow"><label>ファイル名</label><input id="xName" value="${esc(DOC.name)}"></div>
    <p class="dim" style="font-size:12px">AutoHotkey v2 の .ahk として保存します（UTF-8 BOM付き・改行コードは元のまま）。
      元のファイルを置き換えてから、AutoHotkey で再読み込み（Reload）してください。<br>
      手書き部分はそのまま残り、<b>管理区画</b>（<code>; ==== BEGIN 配列アプリ管理区画</code> 〜 <code>END</code>）だけがアプリで作り直されます。</p>
    <div class="xf"><div class="xh"><b>元のファイルとの違い</b><span class="dim">${changed ? '緑=追加 / 赤=削除' : '変更なし'}</span></div>
      <div class="diff mono">${DOC.orig ? diffHTML(DOC.orig, text) : text.split(/\r?\n/).map((l, i) => `<div class="dl add"><span class="ln">${i + 1}</span>+ ${esc(l)}</div>`).join('')}</div></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px">
      ${DOC.orig && changed ? '<button class="btn" id="xRevert">↶ 開いたときの状態に戻す</button>' : ''}
      <button class="btn" id="xCopy">📋 全文をコピー</button>
      <button class="btn primary" id="xDl">⬇ ダウンロード</button>
      <button class="btn" id="xClose">閉じる</button></div>`;
  if (!$('#xdlg').open) $('#xdlg').showModal();
}
function download(name, text) {
  const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---------- イベント ---------- */
document.addEventListener('click', async e => {
  const t = e.target;
  const tab = t.closest('#tabs button'); if (tab) { S.view = tab.dataset.v; return renderAll(); }
  const lay = t.closest('#lay button'); if (lay) { S.layout = lay.dataset.l; derive(); persist(); return renderAll(); }
  if (t.closest('#bOpen')) return $('#file').click();
  if (t.closest('#bNew')) {
    if (hasUnsaved() && !confirm('書き出していない変更があります。破棄して新しく作りますか？')) return;
    return openDoc(newDoc());
  }
  if (t.closest('#bSample')) {
    if (hasUnsaved() && !confirm('書き出していない変更があります。破棄してサンプルを開きますか？')) return;
    return openDoc(docFromText('サンプル配列.ahk', SAMPLE));
  }
  if (t.closest('#bUndo')) return undo();
  if (t.closest('#bRedo')) return redo();
  if (t.closest('#bExport')) return openExport();
  if (t.closest('#docName')) {
    const n = prompt('ファイル名', DOC.name); if (n) { DOC.name = /\.ahk$/i.test(n) ? n : n + '.ahk'; persist(); renderAll(); } return;
  }
  // 書き出しダイアログ
  if (t.id === 'xDl') { const n = $('#xName').value.trim() || DOC.name; DOC.name = n; persist(); download(n, compose(DOC).text); return toast('ダウンロードしました'); }
  if (t.id === 'xCopy') { await navigator.clipboard.writeText(compose(DOC).text).catch(() => {}); return toast('コピーしました'); }
  if (t.id === 'xClose') return $('#xdlg').close();
  if (t.id === 'xRevert') { if (confirm('開いたときの状態に戻しますか？（↶ で取り消せます）')) { mutate(() => { const d = docFromText(DOC.name, DOC.orig); DOC.hand = d.hand; DOC.bindings = d.bindings; DOC.nextId = d.nextId; DOC.layerKeys = []; }); openExport(); } return; }
  if (S.view !== 'detail') return;
  // ---- くわしく画面 ----
  const tog = t.closest('[data-tog]'); if (tog) { const ci = tog.dataset.tog; S.collapsed[ci] = !S.collapsed[ci]; return renderTree(); }
  const go = t.closest('[data-goto]'); if (go) { const it = S.items.find(x => x.line === +go.dataset.goto); if (it) gotoItem(it); return; }
  const dl = t.closest('[data-delline]'); if (dl) { const it = S.items.find(x => x.line === +dl.dataset.delline); if (it && confirm('この定義を削除しますか？\n\n' + it.code)) removeItem(it); return; }
  const k = t.closest('.key[data-k]'); if (k && !k.closest('.mini')) { S.selKey = k.dataset.k; renderDetailMain(); renderDetailPanel(); return; }
  const off = t.closest('[data-off]'); if (off) { const it = S.items[+off.dataset.off]; it._offId = it.keyRaw; S.selKey = it.keyRaw; return renderDetailPanel(); }
  const row = t.closest('tr[data-row]'); if (row) { S.sel = 'L:' + row.dataset.row; S.selKey = row.dataset.key || null; S.query = ''; $('#q').value = ''; return renderAll(); }
  const s = t.closest('[data-sel]'); if (s) { S.sel = s.dataset.sel; if (S.query) { S.query = ''; $('#q').value = ''; } renderAll(); $('#main').scrollTop = 0; }
});
document.addEventListener('dblclick', e => {
  if (S.view !== 'detail') return;
  const k = e.target.closest('.key[data-k]'); if (!k || k.closest('.mini')) return;
  const cur = S.sel.startsWith('L:') ? S.layers.get(S.sel.slice(2)) : null;
  const t = triggersOfCtx(cur ? cur.ctx : '')[k.dataset.k];
  if (t && t.length) { S.sel = 'L:' + t[0].key; renderAll(); }
});
document.addEventListener('keydown', e => {
  if (S.view === 'studio' && S.sim.real) return;   // 実キーボード操作中はショートカットを使わない
  if (e.target.closest && e.target.closest('input,textarea,select')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
});

/* ファイルのドラッグ＆ドロップ（画面のどこでも） */
let fileDrag = 0;
const isFileDrag = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
window.addEventListener('dragenter', e => { if (!isFileDrag(e)) return; e.preventDefault(); fileDrag++; $('#drop').classList.add('on'); });
window.addEventListener('dragleave', e => { if (!isFileDrag(e)) return; fileDrag--; if (fileDrag <= 0) { fileDrag = 0; $('#drop').classList.remove('on'); } });
window.addEventListener('dragover', e => { if (isFileDrag(e)) e.preventDefault(); });
window.addEventListener('drop', e => { if (!isFileDrag(e)) return; e.preventDefault(); fileDrag = 0; $('#drop').classList.remove('on'); const f = e.dataTransfer.files[0]; if (f) openFile(f); });

let rT; window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(renderAll, 120); });

/* 起動 */
function boot() {
  $('#file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) openFile(f); });
  $('#q').addEventListener('input', e => { S.query = e.target.value.trim(); if (S.view !== 'detail') S.view = 'detail'; renderAll(); });
  loadPersisted();
  if (!DOC) DOC = docFromText('サンプル配列.ahk', SAMPLE);
  derive(); renderAll();
}
boot();
