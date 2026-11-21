"use strict";
/* =========================================================
   パーサー
   ========================================================= */
const MOD_CHAR = {'^':'Ctrl','!':'Alt','+':'Shift','#':'Win'};
const MOD_ORDER = ['Ctrl','Alt','Shift','Win'];
const modBase = m => m.replace(/^[LR]/,'');
const sortMods = mods => mods.sort((a,b)=>MOD_ORDER.indexOf(modBase(a))-MOD_ORDER.indexOf(modBase(b)) || a.localeCompare(b));
const isKeyToken = k => !!k && ((k.length===1 && !/\s/.test(k)) || /^[A-Za-z0-9_]+$/.test(k));
const unesc = k => (k && /^`.$/.test(k)) ? k[1] : k;
const stripComment = s => s.replace(/(^|\s+);.*$/,'');

function parseSpec(spec){
  let s = spec.trim(), up=false;
  if(/\s+up$/i.test(s)){ up=true; s=s.replace(/\s+up$/i,'').trim(); }
  const flags = {tilde:false,star:false,dollar:false};
  if(/\s&\s/.test(s)){
    let [a,b] = s.split(/\s+&\s+/);
    if(a.startsWith('~')){flags.tilde=true;a=a.slice(1);}
    if(b && b.startsWith('~')){flags.tilde=true;b=b.slice(1);}
    a=unesc(a); b=unesc(b);
    if(!isKeyToken(a)||!isKeyToken(b)) return null;
    return {mods:[],prefixRaw:a,keyRaw:b,up,flags};
  }
  const mods=[]; let side='', i=0;
  while(i<s.length-1 && '#!^+<>*~$'.includes(s[i])){
    const c=s[i];
    if(c==='<') side='L'; else if(c==='>') side='R';
    else if(c==='*') flags.star=true; else if(c==='~') flags.tilde=true; else if(c==='$') flags.dollar=true;
    else { mods.push(side+MOD_CHAR[c]); side=''; }
    i++;
  }
  const key = unesc(s.slice(i));
  if(!isKeyToken(key)) return null;
  return {mods:sortMods(mods),prefixRaw:null,keyRaw:key,up,flags};
}

function isKeyName(n){
  if(n.length===1) return true;
  if(resolveKey(n).length) return true;
  return /^(numpad\w+|wheel(up|down|left|right)|[lrm]button|xbutton[12]|f(1[3-9]|2[0-4])|browser_\w+|volume_\w+|media_\w+|launch_\w+|sleep|ctrlbreak|help|numlock|(vk|sc)[0-9a-f]+)$/i.test(n);
}

function humanizeSend(s){ return sendTokens(s).map(x=>x.v).join(' '); }
function sendTokens(s){
  const out=[]; let mods=[], text='', i=0;
  const flush=()=>{ if(text){ out.push({t:'text',v:text}); text=''; } };
  const push=lab=>{ flush(); out.push({t:'key',v:mods.length? mods.join('+')+'+'+lab : lab}); mods=[]; };
  let raw=false;
  while(i<s.length){
    const c=s[i];
    if(!raw && '^!+#'.includes(c) && i+1<s.length){ flush(); mods.push(MOD_CHAR[c]); i++; continue; }
    if(!raw && c==='{'){
      let j, name;
      if(s[i+1]==='}' && s[i+2]==='}'){ name='}'; j=i+2; }
      else { j=s.indexOf('}',i+1); if(j<0) j=s.length; name=s.slice(i+1,j); }
      i=j+1;
      const [k,extra] = name.trim().split(/\s+/);
      const kl = (k||'').toLowerCase();
      if(kl==='blind') continue;
      if(kl==='raw'||kl==='text'){ raw=true; continue; }
      const vkm = kl.match(/^(vk[0-9a-f]{2})/);
      let lab = SEND_LABEL[kl] || (vkm && SEND_LABEL[vkm[1]]) || (k.length===1 ? (mods.length?k.toUpperCase():k) : k);
      if(extra){ if(/^\d+$/.test(extra)) lab+='×'+extra; else if(/^down$/i.test(extra)) lab+='↓'; else if(/^up$/i.test(extra)) lab+='↑'; }
      if(k.length===1 && !mods.length && !extra){ text+=k; continue; }
      push(lab); continue;
    }
    if(mods.length){ push(c.toUpperCase()); i++; continue; }
    text+=c; i++;
  }
  flush();
  return out;
}

function summarize(lines){
  const code = lines.map(l=>stripComment(l).trim()).filter(Boolean);
  const nLines = code.filter(l=>!/^[{}]$/.test(l) && !/^return$/i.test(l)).length;
  let first=null; const tokens=[];
  for(const l of code){
    const m = l.match(/\b(Send(?:Input|Play|Event|Text|Raw)?)\b\s*(?:,|\(|\s)\s*(.*)$/i);
    if(m && !/^\s*(Mode|Level)/i.test(m[2])){
      let arg=m[2].trim();
      if(arg.endsWith(')') && /\(\s*$/.test(l.slice(0, l.indexOf(m[2])))) arg=arg.slice(0,-1).trim();
      const q = arg.match(/^"((?:[^"]|"")*)"$/) || arg.match(/^'([^']*)'$/);
      let tk;
      if(q) arg=q[1].replace(/""/g,'"').replace(/`(.)/g,'$1');
      const chr = !q && arg.match(/^Chr\((\d+)\)$/i);
      if(chr) arg = String.fromCharCode(+chr[1]);
      if(/^(SendText|SendRaw)$/i.test(m[1]) || chr) tk = [{t:'text',v:arg}];
      else if(/^%\s/.test(arg) || (!q && /^[A-Za-z_]\w*\s*[.(]/.test(arg) && /^%|\(|\./.test(arg) && S._v2)) tk = [{t:'expr',v:'⟨式⟩'}];
      else tk = sendTokens(arg);
      if(first===null) first = tk.map(x=>x.v).join(' ');
      tokens.push(...tk);
    }
  }
  if(first!==null){
    const nSend = code.filter(x=>/\bSend/i.test(x)).length;
    return {kind:'send', out:(first||'Send')+(nSend>1?' …':''), tokens, nLines, extraCode: nLines>nSend};
  }
  first = code.find(l=>!/^[{}]$/.test(l) && !/^return$/i.test(l)) || '';
  let m;
  const r = summarizeAct(first); r.nLines=nLines; return r;
}
function summarizeAct(first){
  let m;
  if((m=first.match(/^Run\b[,\s(]*["']?([^"',)]+)/i))) return {kind:'action',out:'▶ '+m[1].split(/[\\/]/).pop()};
  if((m=first.match(/^(Reload|ExitApp|Suspend|Pause)\b/i))) return {kind:'action',out:m[1]};
  if((m=first.match(/^MsgBox\b/i))) return {kind:'action',out:'💬 MsgBox'};
  if((m=first.match(/^(\w+)\s*\(/))) return {kind:'action',out:'ƒ '+m[1]+'()'};
  if((m=first.match(/^(\w+)\s*:?=\s*(.*)/))) return {kind:'action',out:m[1]+' := '+m[2]};
  return {kind:'action', out: first ? first.slice(0,24) : '(空)'};
}

function classifyRhs(rhs){
  const m = rhs.match(/^([#!^+<>]*)(\S+)$/);
  if(m && isKeyName(m[2]) && !/^(return|reload|exitapp|suspend|send\w*)$/i.test(m[2])){
    const mods = [...m[1].replace(/[<>]/g,'')].map(c=>MOD_CHAR[c]);
    const lab = m[2].length===1 ? m[2] : (SEND_LABEL[m[2].toLowerCase()] || keyName(m[2]));
    const out=(mods.length?mods.join('+')+'+':'')+lab;
    return {kind:'remap', out, target:m[2], tokens:[{t:'key',v:out}]};
  }
  return summarize([rhs]);
}

function ctxLabel(ctx){
  if(!ctx) return 'グローバル';
  let m;
  if((m=ctx.match(/GetKeyState\(\s*"?([\w]+)"?/i))) return keyName(m[1])+' 押下中';
  if((m=ctx.match(/ahk_exe\s+([\w.\-]+)/i))) return (/Not/i.test(ctx)?'≠ ':'')+m[1];
  if((m=ctx.match(/ahk_class\s+([\w.\-]+)/i))) return (/Not/i.test(ctx)?'≠ ':'')+m[1];
  return ctx.length>28 ? ctx.slice(0,28)+'…' : ctx;
}

function parseAHK(text, file){
  const lines = text.replace(/^﻿/,'').split(/\r?\n/);
  const items=[], hs=[], notes=[];
  let ctx=null, inCmt=false, pending=[], body=null;
  const isV2 = /#Requires\s+AutoHotkey\s+v?2/i.test(text) || /^\s*#HotIf/im.test(text) ||
    (/\b(Send\w*|Run|MsgBox)\s*\(?\s*"/i.test(text) && !/\b(Send\w*|Run|MsgBox)\s*,/i.test(text) && !/^\s*#If/im.test(text));
  S._v2 = isV2;
  const finish = (endIdx)=>{
    if(!pending.length) return;
    const sum = summarize(body?body.lines:[]);
    for(const it of pending){
      it.code = lines.slice(it.line-1, endIdx+1).join('\n');
      it.endLine = endIdx+1;
      if(it.isHs){ it.text = sum.kind==='send'?sum.out:sum.out; }
      else { it.kind = sum.kind; it.out = sum.out; it.tokens = sum.tokens; it.nLines = sum.nLines; it.extraCode = sum.extraCode; }
    }
    pending=[]; body=null;
  };
  const matchHotkey = t => {
    const m = t.match(/^(\S+?(?:\s+&\s+\S+?)?(?:\s+up)?)::(.*)$/i);
    if(!m) return null;
    if(/"/.test(m[1])) return null;
    const p = parseSpec(m[1]); if(!p) return null;
    // 右辺の先頭の ; はキー（例: m & g::;）。空白に続く ; だけをコメントとみなす
    return {spec:m[1], p, rhs: m[2].replace(/\s+;.*$/,'').trim()};
  };
  const matchHs = t => t.match(/^:([^:\s]*):(.+?)::(.*)$/);
  const isComment = t => t.startsWith(';') && !/^;(::|\s+&\s|\s+up::)/i.test(t);

  for(let i=0;i<lines.length;i++){
    const raw=lines[i], t=raw.trim();
    if(inCmt){ if(t.includes('*/')) inCmt=false; continue; }
    if(t.startsWith('/*')){ if(!t.includes('*/')) inCmt=true; continue; }

    if(body && body.mode==='brace'){
      body.lines.push(raw);
      const c = stripComment(raw).replace(/"(?:[^"]|"")*"|'[^']*'/g,'');
      body.depth += (c.match(/\{/g)||[]).length - (c.match(/\}/g)||[]).length;
      if(body.depth<=0) finish(i);
      continue;
    }
    if(t==='' || isComment(t)) { if(body) body.lines.push(raw); continue; }

    const dir = t.match(/^#(HotIf|If)(WinActive|WinNotActive|WinExist|WinNotExist)?(?=[\s,]|$)\s*,?\s*(.*)$/i);
    const hsm = !dir && matchHs(t);
    const hk = !dir && !hsm && matchHotkey(t);
    const isLabel = /^[\w]+:$/.test(t) || /^[\w]+\(.*\)\s*\{?\s*$/.test(t) && !/^(if|while|loop|for|switch|return)\b/i.test(t);

    if(body && body.mode==='return'){
      if(dir || hsm || hk || isLabel){ finish(i-1); }
      else if(/^return\b/i.test(t)){ body.lines.push(raw); finish(i); continue; }
      else { body.lines.push(raw); continue; }
    }

    if(pending.length && !body && !hk && !hsm){
      if(dir){ finish(i-1); }
      else if(t.startsWith('{')){
        body={mode:'brace',lines:[raw],depth:0};
        const c=stripComment(raw); body.depth=(c.match(/\{/g)||[]).length-(c.match(/\}/g)||[]).length;
        if(body.depth<=0) finish(i);
        continue;
      } else { body={mode:'return',lines:[raw]}; if(/^return\b/i.test(t)) finish(i); continue; }
    }

    if(dir){
      const kind = dir[2] ? dir[2] : '';
      const rest = stripComment(dir[3]||'').trim();
      ctx = rest ? (kind ? kind+' '+rest : rest) : null;
      if(ctx && !S.ctxDir[ctx]) S.ctxDir[ctx] = stripComment(t).trim();
      continue;
    }
    if(/^#Include/i.test(t)){ notes.push(`${file}:${i+1} ${t} — 参照先ファイルも一緒に読み込んでください`); continue; }
    if(/^Hotkey\b[\s,(]/i.test(t)){ notes.push(`${file}:${i+1} 動的な Hotkey 命令は解析対象外: ${t}`); continue; }

    if(hsm){
      const it = {isHs:true,file,line:i+1,ctx,opts:hsm[1],abbr:hsm[2],text:stripComment(hsm[3]).trim(),code:raw};
      hs.push(it);
      if(!it.text){ pending.push(it); }
      continue;
    }
    if(hk){
      const p=hk.p;
      const it = {file,line:i+1,endLine:i+1,ctx,spec:hk.spec,...p,code:raw};
      items.push(it);
      if(hk.rhs===''){ pending.push(it); continue; }
      if(/^\{\s*$/.test(hk.rhs) || (hk.rhs.startsWith('{') && !/^\{[^{}]+\}$/.test(hk.rhs) && !/\}\s*$/.test(hk.rhs))){
        pending.push(it);
        body={mode:'brace',lines:[hk.rhs],depth:1};
        continue;
      }
      const c = classifyRhs(hk.rhs);
      if(/^\{.*\}$/.test(hk.rhs) && hk.rhs.length>2 && c.kind!=='remap'){ const s2=summarize([hk.rhs.slice(1,-1)]); Object.assign(c,s2); }
      it.kind=c.kind; it.out=c.out; it.tokens=c.tokens;
      for(const pd of pending){ pd.kind=c.kind; pd.out=c.out; pd.tokens=c.tokens; pd.code=lines.slice(pd.line-1,i+1).join('\n'); }
      pending=[];
      continue;
    }
  }
  finish(lines.length-1);
  return {items,hs,notes,v2:isV2};
}

