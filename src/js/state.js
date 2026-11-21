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
