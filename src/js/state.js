"use strict";
/* =========================================================
   アプリ全体の状態
   ========================================================= */
const S = {
  layout: 'jis',
  view: 'studio',              // 'studio'（キーボード） | 'detail'（くわしく）
  // くわしく画面
  sel: 'all', selKey: null, query: '', collapsed: {},
  // 解析結果（DOC から作った .ahk を解析したもの）
  items: [], hotstrings: [], notes: [], ctxs: [], layers: new Map(), ctxDir: {},
  // キーボード画面
  sim: { held: new Set(), ctxOn: new Set(), log: [], used: false, real: true, flash: null },
  appCtx: '',                  // いま使っているアプリの条件（'' = グローバル）。ためす・つくる共通
  locked: false,               // 編集ロック（ためすだけ）
  paletteQ: '',
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg, kind) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.className = 'on ' + (kind || '');
  clearTimeout(el._t); el._t = setTimeout(() => el.className = '', 2800);
}

/* ---------- ページ内ダイアログ（claude.ai のページでは prompt/confirm が使えないため） ---------- */
function uiDialog({ msg, input = null, ok = 'OK', cancel = 'キャンセル', danger = false }) {
  return new Promise(resolve => {
    const d = $('#udlg');
    d.innerHTML = `<div class="umsg">${esc(msg).replace(/\n/g, '<br>')}</div>
      ${input !== null ? `<input id="uIn" value="${esc(input)}">` : ''}
      <div class="row" style="justify-content:flex-end;margin-top:14px">
        ${cancel ? `<button class="btn" id="uNo">${esc(cancel)}</button>` : ''}
        <button class="btn primary ${danger ? 'danger' : ''}" id="uOk">${esc(ok)}</button></div>`;
    const done = v => { d.close(); resolve(v); };
    d.onclick = e => { if (e.target.id === 'uOk') done(input !== null ? $('#uIn').value : true); if (e.target.id === 'uNo') done(input !== null ? null : false); };
    d.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'uIn') { e.preventDefault(); done($('#uIn').value); } };
    d.oncancel = e => { e.preventDefault(); done(input !== null ? null : false); };
    d.showModal();
    const i = $('#uIn'); if (i) { i.focus(); i.select(); } else $('#uOk').focus();
  });
}
const uiConfirm = (msg, ok, danger) => uiDialog({ msg, ok: ok || 'OK', danger });
const uiPrompt = (msg, def) => uiDialog({ msg, input: def || '' });
