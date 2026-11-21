"use strict";
/* =========================================================
   配列データ（正本）と .ahk の組み立て
   ---------------------------------------------------------
   DOC.hand     … 手書き部分（元ファイルの行）。管理区画の場所に REGION_MARK が1行入る
   DOC.bindings … アプリが管理する割り当て（管理区画はここから毎回作り直す）
   ========================================================= */
const REGION_BEGIN = '; ==== BEGIN 配列アプリ管理区画 (ahk-layout-studio) : この区画はアプリが書き換えます。手で編集しないでください ====';
const REGION_END = '; ==== END 配列アプリ管理区画 ====';
const REGION_MARK = '\u0001REGION';
const AUTO_TAG = '(自動)';

let DOC = null;
const UNDO = [], REDO = [];

function newDoc(name) {
  return { name: name || '新しい配列.ahk', orig: '', eol: '\r\n', nextId: 1, ctxs: [], layerKeys: [],
    hand: ['#Requires AutoHotkey v2.0', '', REGION_MARK, ''], bindings: [] };
}

/* ---------- 読み込み ---------- */
function docFromText(name, text) {
  text = text.replace(/^﻿/, '');
  const lines = text.split(/\r?\n/);
  const doc = { name, orig: text, eol: /\r\n/.test(text) ? '\r\n' : '\n', nextId: 1, ctxs: [], layerKeys: [], hand: lines, bindings: [] };
  const b = lines.findIndex(l => l.startsWith('; ==== BEGIN 配列アプリ管理区画'));
  const e = lines.findIndex((l, i) => i > b && l.startsWith('; ==== END 配列アプリ管理区画'));
  if (b >= 0 && e > b) {
    const region = lines.slice(b + 1, e);
    doc.hand = [...lines.slice(0, b), REGION_MARK, ...lines.slice(e + 1)];
    const r = parseAHK(region.join('\n'), name);
    for (const it of r.items) {
      const bd = itemToBinding(it);
      if (!bd || (bd.comment || '').includes(AUTO_TAG)) continue;
      bd.id = doc.nextId++; doc.bindings.push(bd);
    }
  }
  return doc;
}
const isV2Text = t => /#Requires\s+AutoHotkey\s+v?2/i.test(t) || /^\s*#HotIf/im.test(t) ||
  (/\b(Send\w*|Run|MsgBox)\s*\(?\s*"/i.test(t) && !/\b(Send\w*|Run|MsgBox)\s*,/i.test(t) && !/^\s*#If/im.test(t));

/* ---------- 解析結果 → 割り当て ---------- */
const unq = s => s.slice(1, -1).replace(/`(.)/g, (m, c) => ({ n: '\n', t: '\t' }[c] || c));
const STR = '"(?:[^"`]|`.)*"';
function parseStmt(st) {
  st = st.trim(); let m;
  if ((m = st.match(new RegExp(`^(Send|SendInput|SendText|Run)\\s*(?:\\(\\s*(${STR})\\s*\\)|\\s+(${STR}))$`, 'i'))))
    return { type: /text/i.test(m[1]) ? 'text' : /run/i.test(m[1]) ? 'run' : 'send', value: unq(m[2] || m[3]) };
  if ((m = st.match(/^SendText\s*\(?\s*Chr\((\d+)\)\s*\)?$/i))) return { type: 'text', value: String.fromCharCode(+m[1]) };
  return null;
}
function dedent(lines) {
  const ind = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^\s*/)[0].length), 99);
  return lines.map(l => l.slice(Math.min(ind, l.match(/^\s*/)[0].length)));
}
function itemToBinding(it) {
  const code = it.code.split('\n');
  const head = code[0];
  const hi = head.indexOf(it.spec + '::');
  if (hi < 0) return null;
  let rhs = head.slice(hi + it.spec.length + 2), comment = '';
  const cm = rhs.match(/\s+;\s?(.*)$/);
  if (cm) { comment = cm[1].trim(); rhs = rhs.slice(0, cm.index); }
  rhs = rhs.trim();
  let act, tapStyle = '';
  if (rhs && !/^\{\s*$/.test(rhs)) {
    act = it.kind === 'remap' ? { type: 'remap', value: rhs } : (parseStmt(rhs) || { type: 'code', value: rhs });
  } else {
    let body = code.slice(1);
    while (body.length && !body[body.length - 1].trim()) body.pop();
    if (!rhs && body.length && /^\s*\{\s*$/.test(body[0])) body.shift();
    if (body.length && /^\s*(\}|return)\s*$/i.test(body[body.length - 1])) body.pop();
    body = dedent(body);
    let joined = body.join('\n').trim();
    if (!joined.includes('\n')) { const c = joined.match(/^(.*?)\s+;\s?(.*)$/); if (c && !comment) { joined = c[1]; comment = c[2].trim(); } }
    const tap = joined.match(/^KeyWait\(\s*"([^"]+)"\s*\)\s*\n\s*if\s*\(?\s*A_PriorKey\s*=\s*(?:"[^"]+"|GetKeyName\(\s*"[^"]+"\s*\))\s*\)?\s*\{?\s*\n\s*([^\n]+?)\s*(?:\n\s*\})?$/i);
    if (tap && parseStmt(tap[2])) { act = parseStmt(tap[2]); tapStyle = 'priorkey'; }
    else act = parseStmt(joined) || { type: 'code', value: joined };
  }
  return { ctx: it.ctx || '', prefix: it.prefixRaw || '', mods: [...it.mods], key: it.keyRaw, up: !!it.up,
    flags: { ...it.flags }, act, comment, tapStyle };
}

/* ---------- 割り当て → コード ---------- */
const q2 = s => '"' + String(s).replace(/`/g, '``').replace(/"/g, '`"').replace(/\n/g, '`n') + '"';
const keySpec = k => k === ';' ? '`;' : k;
const MODCH = { Ctrl: '^', Alt: '!', Shift: '+', Win: '#' };
const modChars = m => (m[0] === 'L' && m.length > 3 ? '<' : m[0] === 'R' && m.length > 3 ? '>' : '') + MODCH[modBase(m)];
function specOf(b) {
  let s;
  if (b.prefix) s = (b.flags.tilde ? '~' : '') + keySpec(b.prefix) + ' & ' + keySpec(b.key);
  else s = (b.flags.star ? '*' : '') + (b.flags.tilde ? '~' : '') + (b.flags.dollar ? '$' : '') + b.mods.map(modChars).join('') + keySpec(b.key);
  return s + (b.up ? ' up' : '');
}
function sendOfRemap(v) {
  const m = v.match(/^([#!^+<>]*)(.+)$/);
  return `Send(${q2('{Blind}' + m[1] + '{' + m[2] + '}')})`;
}
function stmtOf(a) {
  switch (a.type) {
    case 'send': return `Send(${q2(a.value)})`;
    case 'text': return a.value === '"' ? 'SendText(Chr(34))' : `SendText(${q2(a.value)})`;
    case 'run': return `Run(${q2(a.value)})`;
    case 'remap': return sendOfRemap(a.value);
    default: return a.value;
  }
}
const isSimpleKey = k => /^[a-z0-9]$/i.test(k);
function codeOf(b, asTap) {
  const cm = b.comment ? '  ; ' + b.comment : '';
  const a = b.act;
  if ((asTap || b.tapStyle === 'priorkey') && a.type !== 'code' && !b.prefix && !b.mods.length && !b.up) {
    // 単押し判定つき（押して離すまでに他のキーを押さなかったときだけ動く）
    const P = b.key, style = b.tapStyle || (isSimpleKey(P) ? 'priorkey' : 'plain');
    if (style === 'priorkey') {
      const cmp = isSimpleKey(P) ? q2(P) : `GetKeyName(${q2(P)})`;
      return [`$${keySpec(P)}:: {${cm}`, `    KeyWait(${q2(P)})`, `    if (A_PriorKey = ${cmp})`, `        ${stmtOf(a)}`, `}`];
    }
    return [`$${keySpec(P)}::${stmtOf(a)}${cm}`];
  }
  const spec = specOf(b);
  if (a.type === 'remap') return [`${spec}::${a.value}${cm}`];
  if (a.type !== 'code') return [`${spec}::${stmtOf(a)}${cm}`];
  const ls = String(a.value).replace(/\s+$/, '').split('\n');
  if (ls.length <= 1) return [`${spec}::${ls[0] || 'return'}${cm}`];
  return [`${spec}:: {${cm}`, ...ls.map(l => '    ' + l), '}'];
}

const lc = s => String(s || '').toLowerCase();
const sameKey = (a, b) => lc(a) === lc(b) || (() => { const x = resolveKey(a), y = resolveKey(b); return x.length > 0 && x.some(i => y.includes(i)); })();
function sameTrig(a, b) {
  return (a.ctx || '') === (b.ctx || '') && !!a.up === !!b.up &&
    (a.prefix ? (b.prefix && sameKey(a.prefix, b.prefix)) : !b.prefix) &&
    a.mods.map(modBase).sort().join() === b.mods.map(modBase).sort().join() && sameKey(a.key, b.key);
}
function prefixesOf(doc) {
  const ps = [];
  const add = p => { if (p && !ps.some(x => sameKey(x, p))) ps.push(p); };
  doc.bindings.forEach(b => add(b.prefix));
  doc.layerKeys.forEach(add);
  return ps;
}
function isTapOf(b, P) { return !b.prefix && !b.mods.length && !b.up && !b.ctx && sameKey(b.key, P); }

/* 手書き部分に「P::」（単押し）があるか。あれば自動の単押しは作らない（重複エラー防止） */
function handDefinesTap(doc, P) {
  const re = new RegExp('^\\s*[~*$]*' + keySpec(P).replace(/[.*+?^${}()|[\]\\`]/g, '\\$&') + '\\s*::', 'i');
  let inC = false;
  for (const l of doc.hand) {
    const t = l.trim();
    if (inC) { if (t.includes('*/')) inC = false; continue; }
    if (t.startsWith('/*')) { inC = !t.includes('*/'); continue; }
    if (re.test(l)) return true;
  }
  return false;
}
const layerTitle = P => { const n = keyName(P); return lc(n) === lc(P) ? P : `${n} (${P})`; };
function genRegion(doc) {
  const out = [REGION_BEGIN], map = [null];
  const push = (lines, id) => { lines.forEach((l, i) => { out.push(l); map.push(i === 0 ? id : null); }); };
  const head = t => { out.push('', `; --- ${t} ---`); map.push(null, null); };
  const bs = doc.bindings, prefixes = prefixesOf(doc);
  const used = new Set();
  const ctxs = ['', ...new Set(bs.map(b => b.ctx).filter(Boolean))];
  for (const ctx of ctxs) {
    const inCtx = bs.filter(b => (b.ctx || '') === ctx);
    if (ctx) { out.push('', '#HotIf ' + ctx); map.push(null, null); }
    const taps = ctx ? [] : inCtx.filter(b => prefixes.some(P => isTapOf(b, P)));
    const base = inCtx.filter(b => !b.prefix && !b.mods.length && !taps.includes(b));
    if (base.length) { head('単体のキー'); base.forEach(b => push(codeOf(b), b.id)); }
    const modGroups = [...new Set(inCtx.filter(b => !b.prefix && b.mods.length).map(b => b.mods.join('+')))];
    for (const g of modGroups) { head(`${g} + キー`); inCtx.filter(b => !b.prefix && b.mods.join('+') === g).forEach(b => push(codeOf(b), b.id)); }
    for (const P of prefixes) {
      const combos = inCtx.filter(b => b.prefix && sameKey(b.prefix, P));
      if (!ctx) {
        const hasCombos = bs.some(b => b.prefix && sameKey(b.prefix, P));
        if (!hasCombos && !combos.length) continue;
        head(`${layerTitle(P)} レイヤー（${layerTitle(P)} を押しながら）`);
        const tap = taps.find(b => isTapOf(b, P));
        if (tap) push(codeOf(tap, true), tap.id);
        else if (handDefinesTap(doc, P)) { out.push(`; （${layerTitle(P)} の単押しは手書き部分で定義されています）`); map.push(null); }
        else {
          const auto = { key: P, act: { type: 'send', value: '{' + P + '}' }, comment: `${AUTO_TAG} 単押しで元のキーを入力`, flags: {}, mods: [] };
          push(codeOf(auto, true), 'auto:' + P);
        }
      } else if (combos.length) head(`${layerTitle(P)} レイヤー（${layerTitle(P)} を押しながら）`);
      combos.forEach(b => push(codeOf(b), b.id));
    }
    if (ctx) { out.push('#HotIf'); map.push(null); }
  }
  out.push('', REGION_END); map.push(null, null);
  return { lines: out, map };
}

/* DOC → .ahk テキスト（行番号 → 割り当てID の対応つき） */
function compose(doc) {
  const hasMark = doc.hand.includes(REGION_MARK);
  const region = hasMark ? genRegion(doc) : null;
  const lines = [], map = new Map(), handIdx = [];
  let rs = 0, re = 0;
  doc.hand.forEach((l, hi) => {
    if (l === REGION_MARK) {
      rs = lines.length + 1;
      region.lines.forEach((x, i) => { lines.push(x); handIdx.push(-1); if (region.map[i] != null) map.set(lines.length, region.map[i]); });
      re = lines.length;
    } else { lines.push(l); handIdx.push(hi); }
  });
  return { text: lines.join(doc.eol), lines, map, handIdx, regionStart: rs, regionEnd: re };
}

/* 管理区画がまだ無ければ、先頭の # 指定のあとに作る */
function ensureMark(doc, at) {
  if (doc.hand.includes(REGION_MARK)) return;
  if (at == null) {
    at = 0;
    for (let i = 0; i < doc.hand.length; i++) {
      const t = doc.hand[i].trim();
      if (!t || t.startsWith(';') || (/^#/.test(t) && !/^#(HotIf|If)/i.test(t))) { if (t.startsWith('#')) at = i + 1; continue; }
      break;
    }
  }
  doc.hand.splice(at, 0, '', REGION_MARK, '');
}

/* ---------- 変更操作（すべて Undo 可能） ---------- */
function snapshot() { return JSON.stringify({ hand: DOC.hand, bindings: DOC.bindings, nextId: DOC.nextId, ctxs: DOC.ctxs, layerKeys: DOC.layerKeys, name: DOC.name }); }
function restore(s) { Object.assign(DOC, JSON.parse(s)); }
function mutate(fn, msg) {
  const before = snapshot();
  fn();
  if (snapshot() === before) { derive(); return false; }
  UNDO.push(before); if (UNDO.length > 200) UNDO.shift(); REDO.length = 0;
  refresh(); if (msg) toast(msg);
  return true;
}
function undo() { if (!UNDO.length) return; REDO.push(snapshot()); restore(UNDO.pop()); refresh(); toast('元に戻しました'); }
function redo() { if (!REDO.length) return; UNDO.push(snapshot()); restore(REDO.pop()); refresh(); toast('やり直しました'); }

function bindingById(id) { return DOC.bindings.find(b => b.id === id); }
function findBinding(trig) { return DOC.bindings.find(b => sameTrig(b, trig)); }

/* 手書き（区画の外）の定義を割り当てデータに取り込む。戻り値: 取り込めた件数 */
function importItemsRaw(items) {
  const comp = S.comp;
  const ok = [];
  for (const it of items) {
    if (!it.locked) continue;
    const stacked = S.items.some(o => o !== it && o.locked && o.line > it.line && o.line <= it.endLine);
    if (stacked) continue;
    const bd = itemToBinding(it);
    if (!bd) continue;
    ok.push({ it, bd, h0: comp.handIdx[it.line - 1], h1: comp.handIdx[it.endLine - 1] });
  }
  if (!ok.length) return 0;
  // 区画の位置：最初に取り込むグローバル定義の位置（無ければ先頭の # 指定のあと）
  let markAt = null;
  if (!DOC.hand.includes(REGION_MARK)) {
    const g = ok.filter(o => !o.bd.ctx).sort((a, b) => a.h0 - b.h0)[0];
    if (g) markAt = g.h0;
  }
  const del = new Set();
  for (const o of ok) for (let i = o.h0; i <= o.h1; i++) del.add(i);
  if (markAt != null) {
    const before = [...del].filter(i => i < markAt).length;
    DOC.hand = DOC.hand.filter((_, i) => !del.has(i));
    ensureMark(DOC, markAt - before);
  } else {
    DOC.hand = DOC.hand.filter((_, i) => !del.has(i));
    ensureMark(DOC);
  }
  cleanupHand();
  for (const o of ok.sort((a, b) => a.h0 - b.h0)) {
    const ex = findBinding(o.bd);
    if (ex) Object.assign(ex, { act: o.bd.act, comment: o.bd.comment, flags: o.bd.flags, tapStyle: o.bd.tapStyle });
    else { o.bd.id = DOC.nextId++; DOC.bindings.push(o.bd); }
  }
  derive();   // 行番号が変わるので解析し直す（同じ操作の中で続けて使えるように）
  return ok.length;
}
/* 取り込みで中身が空になった #HotIf ブロックを片付ける（それ以外の手書き部分は触らない） */
function cleanupHand() {
  const h = DOC.hand;
  for (let i = 0; i < h.length; i++) {
    if (/^\s*#HotIf\s+\S/i.test(h[i])) {
      let j = i + 1;
      while (j < h.length && (!h[j].trim())) j++;
      if (j < h.length && /^\s*#HotIf\s*$/i.test(h[j])) { h.splice(i, j - i + 1); i--; }
    }
  }
}

function itemTrig(it) { return { ctx: it.ctx || '', prefix: it.prefixRaw || '', mods: it.mods, key: it.keyRaw, up: !!it.up }; }
const NOFLAGS = () => ({ tilde: false, star: false, dollar: false });

/* 表示中の定義を、編集できる割り当てデータにする（手書きなら取り込み、自動の単押しなら実体化） */
function ensureManaged(it) {
  if (it.bid) return bindingById(it.bid);
  if (it.auto) {
    ensureMark(DOC);
    const b = { id: DOC.nextId++, ctx: '', prefix: '', mods: [], key: it.keyRaw, up: false, flags: NOFLAGS(),
      act: { type: 'send', value: '{' + it.keyRaw + '}' }, comment: '', tapStyle: '' };
    DOC.bindings.push(b); return b;
  }
  if (it.locked && importItemsRaw([it])) return findBinding(itemTrig(it));
  return null;
}
/* 同じ条件の手書き定義があれば先に取り込む（AHK の重複エラーを防ぐ） */
function absorbHand(trig) {
  const hand = S.items.find(it => it.locked && sameTrig(itemTrig(it), trig));
  if (hand) importItemsRaw([hand]);
}
function assignRaw(trig, act, comment) {
  absorbHand(trig);
  ensureMark(DOC);
  const ex = findBinding(trig);
  if (ex) { ex.act = act; if (comment !== undefined) ex.comment = comment; return ex; }
  const b = { id: DOC.nextId++, ctx: trig.ctx || '', prefix: trig.prefix || '', mods: trig.mods || [], key: trig.key,
    up: !!trig.up, flags: trig.flags || NOFLAGS(), act, comment: comment || '', tapStyle: '' };
  DOC.bindings.push(b); return b;
}
function moveRaw(b, trig, copy) {
  absorbHand(trig);
  const other = findBinding(trig);
  if (other === b) return false;
  const T = { ctx: trig.ctx || '', prefix: trig.prefix || '', mods: trig.mods || [], key: trig.key, up: !!trig.up };
  if (copy) {
    if (other) DOC.bindings = DOC.bindings.filter(x => x !== other);
    DOC.bindings.push(Object.assign(JSON.parse(JSON.stringify(b)), T, { id: DOC.nextId++, tapStyle: '' }));
  } else {
    const from = { ctx: b.ctx, prefix: b.prefix, mods: [...b.mods], key: b.key, up: b.up };
    Object.assign(b, T, { tapStyle: '' });
    if (other) Object.assign(other, from, { tapStyle: '' });
  }
  return true;
}
function removeHandRaw(it) {
  const a = S.comp.handIdx[it.line - 1], z = S.comp.handIdx[it.endLine - 1];
  if (a < 0) return false;
  DOC.hand.splice(a, z - a + 1); cleanupHand(); derive();
  return true;
}

function assign(trig, act, comment) { return mutate(() => { assignRaw(trig, act, comment); }, '割り当てました'); }
function removeBinding(id) { return mutate(() => { DOC.bindings = DOC.bindings.filter(b => b.id !== id); }, '削除しました'); }
function removeItem(it) {
  if (it.auto) { toast('これは自動で作られる「単押し」です。別の動作を割り当てると置き換わります'); return false; }
  if (it.bid) return removeBinding(it.bid);
  return mutate(() => removeHandRaw(it), '手書きの定義を削除しました');
}
function moveItem(it, trig, copy) {
  return mutate(() => { const b = ensureManaged(it); if (!b) return false; return moveRaw(b, trig, copy); }, copy ? 'コピーしました' : '移動しました');
}
function addLayerKey(raw) {
  return mutate(() => { if (!DOC.layerKeys.some(k => sameKey(k, raw))) DOC.layerKeys.push(raw); }, `${keyName(raw)} をレイヤーキーにしました`);
}
function importAllHand() {
  const locked = S.items.filter(it => it.locked);
  let n = 0;
  mutate(() => { n = importItemsRaw(locked); if (!n) return false; }, null);
  return n;
}

/* ---------- 保存 ---------- */
function persist() { try { localStorage.setItem('als.doc', JSON.stringify(DOC)); localStorage.setItem('als.layout', S.layout); } catch (_) {} }
function loadPersisted() {
  try { const d = JSON.parse(localStorage.getItem('als.doc') || 'null'); if (d && d.hand) { DOC = Object.assign(newDoc(), d); } } catch (_) {}
  S.layout = localStorage.getItem('als.layout') || 'jis';
}
