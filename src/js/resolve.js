"use strict";
/* =========================================================
   押している状態から、動くホットキーを求める
   ========================================================= */
const STD_MODS = ['lctrl','rctrl','lshift','rshift','lalt','ralt','lwin','rwin'];
function holdableIds(){
  const set = new Set(STD_MODS);
  for(const l of S.layers.values()) for(const id of heldIds(l)) set.add(id);
  if(typeof DOC!=='undefined' && DOC) for(const k of DOC.layerKeys) resolveKey(k).forEach(id=>set.add(id));
  return set;
}
function gksIds(ctx){ const ids=[]; for(const m of (ctx||'').matchAll(/GetKeyState\(\s*"?(\w+)"?/gi)) ids.push(...resolveKey(m[1])); return ids; }
function ctxActive(ctx){
  if(!ctx) return true;
  const g = gksIds(ctx);
  if(g.length) return g.every(id=>S.sim.held.has(id));
  return S.appCtx===ctx;
}
function activeCtxs(){ return S.ctxs.filter(c=>c && ctxActive(c)).concat(['']); }
function modsOk(it, H){
  for(const m of it.mods){
    const b=modBase(m).toLowerCase(), sd=m[0]==='L'?'l':m[0]==='R'?'r':'';
    if(!(sd ? H.has(sd+b) : (H.has('l'+b)||H.has('r'+b)))) return false;
  }
  if(it.flags.star) return true;
  for(const b of ['ctrl','alt','shift','win'])
    if((H.has('l'+b)||H.has('r'+b)) && !it.mods.some(m=>modBase(m).toLowerCase()===b)) return false;
  return true;
}
/* いまの押下状態で id を押した（離した）時に動くホットキー */
function resolvePress(id, wantUp=false){
  const H = S.sim.held;
  for(const ctx of activeCtxs()){
    let best=null, bs=-1;
    for(const it of S.items){
      if((it.ctx||'')!==ctx || !it.keyIds.includes(id) || !!it.up!==wantUp) continue;
      let sc=-1;
      if(it.prefixRaw){ if(it.prefixIds.some(p=>H.has(p)) && !it.prefixIds.includes(id)) sc = 3; }
      else if(modsOk(it,H)) sc = it.mods.length ? 2 : 1;
      if(sc>bs){ bs=sc; best=it; }
    }
    if(best && bs>=0) return best;
  }
  return null;
}
function heldLabel(){ return [...S.sim.held].map(capLabel); }
function modIdsFor(mods){ return mods.map(m=>(m[0]==='R'?'r':'l')+modBase(m).toLowerCase()); }
const CODE2ID = {Escape:'esc',Backspace:'backspace',Tab:'tab',CapsLock:'capslock',Enter:'enter',ShiftLeft:'lshift',ShiftRight:'rshift',ControlLeft:'lctrl',ControlRight:'rctrl',
  AltLeft:'lalt',AltRight:'ralt',MetaLeft:'lwin',MetaRight:'rwin',OSLeft:'lwin',OSRight:'rwin',ContextMenu:'appskey',Space:'space',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',
  Backslash:'\\',Semicolon:';',Quote:"'",Backquote:'`',Comma:',',Period:'.',Slash:'/',IntlYen:'jp_yen',IntlRo:'jp_ro',NonConvert:'muhenkan',Convert:'henkan',KanaMode:'kana',
  ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',Home:'home',End:'end',PageUp:'pgup',PageDown:'pgdn',Insert:'insert',Delete:'delete',
  PrintScreen:'printscreen',ScrollLock:'scrolllock',Pause:'pause'};
function codeToId(code){
  if(CODE2ID[code]) return CODE2ID[code];
  let m;
  if((m=code.match(/^Key([A-Z])$/))) return m[1].toLowerCase();
  if((m=code.match(/^Digit(\d)$/))) return m[1];
  if((m=code.match(/^F(\d+)$/))) return 'f'+m[1];
  return null;
}
