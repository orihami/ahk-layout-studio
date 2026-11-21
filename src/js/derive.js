"use strict";
/* =========================================================
   DOC → .ahk → 解析 → 表示用データ（レイヤー・条件）
   ========================================================= */
function layerNameOf(it) {
  if (it.prefixRaw) return keyName(it.prefixRaw) + ' ＆';
  return it.mods.length ? it.mods.join('+') : 'ベース';
}

function derive() {
  LAYOUT = buildLayout(S.layout); LAYOUT_IDS = new Set(LAYOUT.map(k => k.id));
  S.ctxDir = {};
  const comp = compose(DOC);
  S.comp = comp;
  const r = parseAHK(comp.text, DOC.name);
  S.items = r.items; S.hotstrings = r.hs; S.notes = r.notes; S.v2 = r.v2;
  S.layers = new Map(); const ctxSet = [''];
  for (const it of S.items) {
    it.keyIds = resolveKey(it.keyRaw);
    it.prefixIds = it.prefixRaw ? resolveKey(it.prefixRaw) : [];
    it.layerName = layerNameOf(it);
    it.lkey = (it.ctx || '') + '\u0001' + it.layerName;
    it.managed = comp.regionStart > 0 && it.line >= comp.regionStart && it.line <= comp.regionEnd;
    it.locked = !it.managed;
    const bid = comp.map.get(it.line);
    it.bid = typeof bid === 'number' ? bid : null;
    it.auto = typeof bid === 'string';
    if (!ctxSet.includes(it.ctx || '')) ctxSet.push(it.ctx || '');
    if (!S.layers.has(it.lkey)) S.layers.set(it.lkey, { key: it.lkey, ctx: it.ctx || '', name: it.layerName,
      type: it.prefixRaw ? 'prefix' : (it.mods.length ? 'mod' : 'base'), mods: it.mods, prefixRaw: it.prefixRaw, prefixIds: it.prefixIds, items: [] });
    S.layers.get(it.lkey).items.push(it);
  }
  for (const c of DOC.ctxs) if (!ctxSet.includes(c)) ctxSet.push(c);
  S.ctxs = ctxSet.filter((c, i) => c || S.items.length || i === 0);
  for (const id of [...S.sim.held]) if (!holdableIds().has(id)) S.sim.held.delete(id);
  if (S.appCtx && !S.ctxs.includes(S.appCtx)) S.appCtx = '';
  if (S.sel.startsWith('L:') && !S.layers.has(S.sel.slice(2))) S.sel = 'all';
  // このキーに使われている AHK 名（例: @ の位置 → "@"）を覚えておく
  S.rawName = {};
  for (const it of S.items) {
    if (it.keyIds.length === 1 && !S.rawName[it.keyIds[0]]) S.rawName[it.keyIds[0]] = it.keyRaw;
    if (it.prefixIds.length === 1 && !S.rawName[it.prefixIds[0]]) S.rawName[it.prefixIds[0]] = it.prefixRaw;
  }
}
const rawNameFor = id => S.rawName[id] || idToAhk(id);

/* 変更のたびに呼ぶ */
function refresh() { derive(); persist(); renderAll(); }

function layersOfCtx(ctx) {
  const order = { base: 0, mod: 1, prefix: 2 };
  return [...S.layers.values()].filter(l => l.ctx === ctx)
    .sort((a, b) => order[a.type] - order[b.type] || a.mods.length - b.mods.length || a.name.localeCompare(b.name));
}
function heldIds(layer) {
  if (!layer) return [];
  const ids = [];
  for (const m of (layer.ctx || '').matchAll(/GetKeyState\(\s*"?(\w+)"?/gi)) ids.push(...resolveKey(m[1]));
  if (layer.type === 'prefix') return ids.concat(layer.prefixIds);
  for (const m of layer.mods) {
    const b = modBase(m).toLowerCase(), s = m[0] === 'L' && m.length > 3 ? 'l' : m[0] === 'R' && m.length > 3 ? 'r' : '';
    if (s) ids.push(s + b); else ids.push('l' + b, 'r' + b);
  }
  return ids;
}
function triggersOfCtx(ctx) {
  const map = {};
  for (const l of layersOfCtx(ctx)) { if (l.type === 'base') continue; for (const id of heldIds(l)) (map[id] = map[id] || []).push(l); }
  return map;
}
