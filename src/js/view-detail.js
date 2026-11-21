"use strict";
/* =========================================================
   くわしく画面（ツリー・全体マップ・一覧・検索）
   ========================================================= */
const kindName = {remap:'リマップ',send:'Send',action:'スクリプト'};
const icon = l => l.type==='base'?'⌨':l.type==='mod'?'⇧':'🔗';

function renderTree(){ /* くわしく画面の左ツリー */
  const el=$('#tree');
  let h = `<div class="node ${S.sel==='all'?'sel':''}" data-sel="all"><span class="tog"></span>📚<span class="nm">全体マップ</span><span class="cnt">${S.items.length}</span></div>`;
  h += `<div class="tsec">コンテキスト / レイヤー</div>`;
  S.ctxs.forEach((ctx,ci)=>{
    const ls = layersOfCtx(ctx), open = !S.collapsed[ci];
    const n = ls.reduce((a,l)=>a+l.items.length,0);
    h += `<div class="node ${S.sel==='C:'+ci?'sel':''}" data-sel="C:${ci}" title="${esc(ctx||'条件なし（常に有効）')}"><span class="tog" data-tog="${ci}">${open?'▼':'▶'}</span>${ctx?'🎯':'🌐'}<span class="nm">${esc(ctxLabel(ctx))}</span><span class="cnt">${n}</span></div>`;
    if(open){
      h += `<div class="children">`;
      const grp = {base:[],mod:[],prefix:[]}; ls.forEach(l=>grp[l.type].push(l));
      const gname = {base:'',mod:'修飾キー レイヤー',prefix:'カスタム レイヤー（A & B）'};
      for(const g of ['base','mod','prefix']){
        if(!grp[g].length) continue;
        if(gname[g]) h+=`<div class="grp">${gname[g]}</div>`;
        for(const l of grp[g]) h += `<div class="node ${S.sel==='L:'+l.key?'sel':''}" data-sel="L:${esc(l.key)}"><span class="tog"></span>${icon(l)}<span class="nm">${esc(l.name)}</span><span class="cnt">${l.items.length}</span></div>`;
      }
      h += `</div>`;
    }
  });
  if(S.hotstrings.length) h += `<div class="tsec">その他</div><div class="node ${S.sel==='hs'?'sel':''}" data-sel="hs"><span class="tog"></span>✍<span class="nm">ホットストリング</span><span class="cnt">${S.hotstrings.length}</span></div>`;
  el.innerHTML = h;
}

function unitFor(container){
  const w = (container.clientWidth||900) - 4;
  return Math.max(26, Math.min(60, w / KB_W));
}

/* キーボード描画 */
function kbdHTML(layer, U, mini=false){
  const ctx = layer ? layer.ctx : '';
  const map = {};
  if(layer) for(const it of layer.items) for(const id of it.keyIds) (map[id]=map[id]||[]).push(it);
  const held = new Set(heldIds(layer));
  const trig = triggersOfCtx(ctx);
  const gap = mini?1.5:4;
  let h = `<div class="kbd ${mini?'mini':''}" style="width:${KB_W*U}px;height:${KB_H*U}px">`;
  for(const k of LAYOUT){
    const its = map[k.id]||[];
    const main = its.find(x=>!x.up) || its[0];
    let cls = 'key', out='', bd='';
    if(held.has(k.id)){ cls+=' held'; out = '押下'; }
    else if(main){ cls+=' '+main.kind; out = main.out; }
    else cls+=' empty';
    if(trig[k.id] && !held.has(k.id)) cls+=' trigger';
    if(!mini){
      if(main){ const f=main.flags; bd = (f.tilde?'~':'')+(f.star?'*':'')+(its.some(x=>x.up)?'↑':'')+(its.length>1?' ×'+its.length:''); }
      if(trig[k.id]) bd = '▸'+bd;
      if(S.selKey===k.id) cls+=' selk';
      if(S.query && its.some(x=>matchQ(x))) cls+=' hit';
    }
    const len=[...out].length;
    const fs = mini?0: len<=2?Math.round(U*.36): len<=4?Math.round(U*.27): len<=7?Math.round(U*.21): Math.round(U*.18);
    const tip = `${capLabel(k.id)}${its.length?' → '+its.map(x=>x.out+(x.up?' (離した時)':'')).join(' / '):''}${trig[k.id]?'\n▸ レイヤー: '+trig[k.id].map(l=>l.name).join(', '):''}`;
    h += `<div class="${cls}" data-k="${esc(k.id)}" title="${esc(tip)}" style="left:${k.x*U}px;top:${k.y*U}px;width:${k.w*U-gap}px;height:${k.h*U-gap}px">`+
      (mini?'':`<span class="cap">${esc(capLabel(k.id))}</span><span class="out" style="font-size:${fs}px">${esc(out)}</span><span class="bd">${esc(bd)}</span>`)+`</div>`;
  }
  return h+`</div>`;
}

function matchQ(it){
  const q=S.query.toLowerCase(); if(!q) return false;
  return [it.spec,it.out,it.code,keyName(it.keyRaw),it.layerName].some(v=>String(v||'').toLowerCase().includes(q));
}

function itemRow(it, showLayer){
  return `<tr class="row" data-row="${esc(it.lkey)}" data-key="${esc(it.keyIds[0]||'')}">
    <td class="mono">${esc(it.spec)}</td>
    ${showLayer?`<td>${esc(ctxLabel(it.ctx))} › ${esc(it.layerName)}</td>`:''}
    <td><b>${esc(keyName(it.keyRaw))}</b>${it.up?' <span class="dim">(離す)</span>':''}</td>
    <td>${esc(it.out)}</td>
    <td class="dim">${esc(meaning(it))}</td>
    <td><span class="tag ${it.kind}">${kindName[it.kind]}</span></td>
    <td class="dim mono">${esc(it.file)}:${it.line}</td></tr>`;
}

function renderDetailMain(){
  const el=$('#main');

  let h='';
  if(S.notes.length) h += `<div class="notice">⚠ ${S.notes.slice(0,5).map(esc).join('<br>⚠ ')}${S.notes.length>5?`<br>…他 ${S.notes.length-5} 件`:''}</div>`;

  if(S.query){
    const res = S.items.filter(matchQ), hres=S.hotstrings.filter(x=>(x.abbr+x.text).toLowerCase().includes(S.query.toLowerCase()));
    h += `<h2>🔍 「${esc(S.query)}」の検索結果 <span class="dim" style="font-size:13px">${res.length+hres.length} 件</span></h2>`;
    h += `<table><tr><th>定義</th><th>場所</th><th>キー</th><th>出力</th><th>意味</th><th>種類</th><th>ファイル</th></tr>${res.map(x=>itemRow(x,true)).join('')}
      ${hres.map(x=>`<tr><td class="mono">${esc(x.abbr)}</td><td>ホットストリング</td><td></td><td>${esc(x.text)}</td><td><span class="tag hs">HS</span></td><td class="dim mono">${esc(x.file)}:${x.line}</td></tr>`).join('')}</table>`;
    el.innerHTML=h; return;
  }

  if(S.sel==='hs'){
    h += `<h2>✍ ホットストリング <span class="dim" style="font-size:13px">${S.hotstrings.length} 件</span></h2>
      <table><tr><th>入力</th><th>→ 変換後</th><th>オプション</th><th>コンテキスト</th><th>ファイル</th></tr>
      ${S.hotstrings.map(x=>`<tr><td class="mono"><b>${esc(x.abbr)}</b></td><td>${esc(x.text)}</td><td class="mono dim">${esc(x.opts)}</td><td>${esc(ctxLabel(x.ctx))}</td><td class="dim mono">${esc(x.file)}:${x.line}</td></tr>`).join('')}</table>`;
    el.innerHTML=h; return;
  }

  const MU = 17;
  if(S.sel==='all' || S.sel.startsWith('C:')){
    const ctxs = S.sel==='all' ? S.ctxs : [S.ctxs[+S.sel.slice(2)]];
    const kinds = {remap:0,send:0,action:0}; S.items.forEach(x=>kinds[x.kind]++);
    if(S.sel==='all'){
      h += `<h2>📚 全体マップ</h2>
        <div class="stat"><div><b>${S.items.length}</b>ホットキー</div><div><b>${S.layers.size}</b>レイヤー</div><div><b>${S.ctxs.length}</b>コンテキスト</div>
        <div><b>${kinds.remap}</b>リマップ</div><div><b>${kinds.send}</b>Send</div><div><b>${kinds.action}</b>スクリプト</div><div><b>${S.hotstrings.length}</b>ホットストリング</div></div>`;
    } else {
      h += `<div class="crumb"><a data-sel="all">全体マップ</a> ›</div><h2>${ctxs[0]?'🎯':'🌐'} ${esc(ctxLabel(ctxs[0]))}</h2>
        <div class="dim mono" style="margin-bottom:12px">${esc(ctxs[0]||'条件なし（常に有効）')}</div>`;
    }
    h += legendHTML();
    for(const ctx of ctxs){
      const ci=S.ctxs.indexOf(ctx);
      if(S.sel==='all') h += `<div class="ctxhead">${ctx?'🎯':'🌐'} <a class="link" data-sel="C:${ci}">${esc(ctxLabel(ctx))}</a> <span class="dim mono" style="font-size:11px">${esc(ctx)}</span></div>`;
      h += `<div class="cards">`;
      for(const l of layersOfCtx(ctx)){
        h += `<div class="card" data-sel="L:${esc(l.key)}"><h3><span>${icon(l)} ${esc(l.name)}</span><span class="dim">${l.items.length} 件</span></h3>${kbdHTML(l,MU,true)}</div>`;
      }
      h += `</div>`;
    }
    el.innerHTML=h; return;
  }

  // レイヤー
  const layer = S.layers.get(S.sel.slice(2));
  if(!layer){ S.sel='all'; return renderMain(); }
  const ci = S.ctxs.indexOf(layer.ctx);
  h += `<div class="crumb"><a data-sel="all">全体マップ</a> › <a data-sel="C:${ci}">${esc(ctxLabel(layer.ctx))}</a> ›</div>
    <h2>${icon(layer)} ${esc(layer.name)} <span class="dim" style="font-size:13px">${layer.items.length} 件</span></h2>`;
  if(layer.type!=='base') h += `<div class="dim" style="margin:-4px 0 6px">黄色のキーを押しながら、他のキーを押したときの動作</div>`;
  h += legendHTML();
  h += `<div id="kbwrap"></div>`;
  const off = layer.items.filter(it=>!it.keyIds.some(id=>LAYOUT_IDS.has(id)));
  if(off.length) h += `<div class="dim" style="font-size:12px;margin-bottom:6px">キーボード外のキー（マウス・テンキー等）</div><div class="chips">${off.map(it=>`<span class="chip ${it.kind}" data-off="${S.items.indexOf(it)}"><b>${esc(keyName(it.keyRaw))}</b> → ${esc(it.out)}</span>`).join('')}</div>`;
  h += `<table><tr><th>定義</th><th>キー</th><th>出力</th><th>意味</th><th>種類</th><th>ファイル</th></tr>${layer.items.map(x=>itemRow(x,false)).join('')}</table>`;
  el.innerHTML = h;
  const wrap=$('#kbwrap'); wrap.innerHTML = kbdHTML(layer, unitFor(wrap));
}

function legendHTML(){
  return `<div class="legend"><span><i style="background:var(--remap)"></i>リマップ</span><span><i style="background:var(--send)"></i>Send（キー/文字送信）</span>
    <span><i style="background:var(--action)"></i>スクリプト</span><span><i style="background:var(--held)"></i>押下中のキー</span>
    <span><i style="border:2px dashed var(--prefix)"></i>レイヤー起動キー ▸</span><span>~ 元キーも有効 / * ワイルドカード / ↑ 離した時</span></div>`;
}

function renderDetailPanel(){
  const el=$('#detail');
  const id=S.selKey;
  if(!id){
    el.innerHTML = `<div class="dim">キーボードのキーをクリックすると、そのキーの<b>全レイヤーでの割り当て</b>と元のコードが表示されます。<br><br>
      破線のキー ▸ はレイヤーを起動するキーです。ダブルクリックでそのレイヤーへ移動します。</div>`;
    return;
  }
  const curLayer = S.sel.startsWith('L:') ? S.layers.get(S.sel.slice(2)) : null;
  const all = S.items.filter(it=>it.keyIds.includes(id) || it._offId===id);
  let h = `<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><span class="dk">${esc(LAYOUT_IDS.has(id)?capLabel(id):id)}</span>
    <div><div style="font-weight:600">${esc(id)}</div><div class="dim" style="font-size:12px">${all.length} 件の割り当て</div></div></div>`;
  // レイヤー起動
  const trig = curLayer ? triggersOfCtx(curLayer.ctx) : triggersOfCtx('');
  const prefLayers = [...S.layers.values()].filter(l=>l.type!=='base' && heldIds(l).includes(id));
  if(prefLayers.length){
    h += `<div class="di" style="border-color:var(--prefix)"><div class="hd">▸ このキーで起動するレイヤー</div>
      ${prefLayers.map(l=>`<div style="margin-top:4px"><span class="link" data-sel="L:${esc(l.key)}">${icon(l)} ${esc(ctxLabel(l.ctx))} › ${esc(l.name)}</span> <span class="dim">(${l.items.length})</span></div>`).join('')}</div>`;
  }
  const cur = all.filter(it=>curLayer && it.lkey===curLayer.key);
  const other = all.filter(it=>!cur.includes(it));
  const block = it => `<div class="di"><div class="hd"><span class="tag ${it.kind}">${kindName[it.kind]}</span>
      <span class="link" data-sel="L:${esc(it.lkey)}">${esc(ctxLabel(it.ctx))} › ${esc(it.layerName)}</span>
      ${it.up?'<span class="dim">離した時</span>':''}${it.flags.tilde?'<span class="dim">~元キー有効</span>':''}${it.flags.star?'<span class="dim">*任意修飾</span>':''}</div>
      <div style="margin:8px 0 4px;line-height:1.6">${comboHTML(it)}</div>
      <div style="font-size:14px;margin:2px 0 4px">→ <b>${esc(it.out)}</b> <span class="dim">（${esc(meaning(it))}）</span></div>
      <div class="dim mono" style="font-size:11px">${esc(it.file)} : ${it.line}${it.endLine>it.line?'–'+it.endLine:''}</div>
      <pre class="mono">${esc(it.code)}</pre>
      <div class="edb"><button class="btn" data-goto="${it.line}">⌨ キーボードで編集</button><button class="btn" data-delline="${it.line}">🗑 削除</button>${it.locked?'<span class="tag lock">🔒 手書き</span>':it.auto?'<span class="tag auto">自動</span>':'<span class="tag own">アプリ管理</span>'}</div></div>`;
  if(cur.length) h += `<div class="tsec" style="margin-left:0">このレイヤー</div>${cur.map(block).join('')}`;
  if(other.length) h += `<div class="tsec" style="margin-left:0">他のレイヤー・コンテキスト</div>${other.map(block).join('')}`;
  if(!all.length && !prefLayers.length) h += `<div class="dim">このキーには割り当てがありません（通常どおり入力されます）。</div>`;
  el.innerHTML = h;
}

