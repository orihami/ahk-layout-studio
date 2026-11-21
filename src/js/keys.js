"use strict";
/* =========================================================
   キー定義
   ========================================================= */
const hex3 = n => n.toString(16).padStart(3,'0');
const SC = {'001':'esc','00e':'backspace','00f':'tab','01c':'enter','01d':'lctrl','02a':'lshift','036':'rshift','038':'lalt','039':'space','03a':'capslock','029':'`','02b':'\\','07b':'muhenkan','079':'henkan','070':'kana','073':'jp_ro','07d':'jp_yen','11d':'rctrl','138':'ralt','15b':'lwin','15c':'rwin','15d':'appskey','147':'home','14f':'end','149':'pgup','151':'pgdn','152':'insert','153':'delete','148':'up','150':'down','14b':'left','14d':'right','137':'printscreen','046':'scrolllock','045':'pause','057':'f11','058':'f12'};
[['1234567890-=',2],['qwertyuiop[]',0x10],["asdfghjkl;'",0x1e],['zxcvbnm,./',0x2c]].forEach(([s,b])=>[...s].forEach((c,i)=>SC[hex3(b+i)]=c));
for(let i=0;i<10;i++) SC[hex3(0x3b+i)]='f'+(i+1);

const VK = {'1d':'muhenkan','1c':'henkan','f2':'kana','15':'kana','f3':'`','f4':'`','19':'`','14':'capslock','f0':'capslock','20':'space','0d':'enter','08':'backspace','09':'tab','1b':'esc','a0':'lshift','a1':'rshift','a2':'lctrl','a3':'rctrl','a4':'lalt','a5':'ralt','5b':'lwin','5c':'rwin','5d':'appskey','bc':',','bd':'-','be':'.','bf':'/','25':'left','26':'up','27':'right','28':'down','2d':'insert','2e':'delete','24':'home','23':'end','21':'pgup','22':'pgdn','2c':'printscreen','91':'scrolllock','13':'pause'};
for(let c=0x41;c<=0x5a;c++) VK[c.toString(16)] = String.fromCharCode(c+32);
for(let c=0x30;c<=0x39;c++) VK[c.toString(16)] = String.fromCharCode(c);
for(let i=0;i<12;i++) VK[(0x70+i).toString(16)] = 'f'+(i+1);
const VK_US  = {'ba':';','bb':'=','c0':'`','db':'[','dc':'\\','dd':']','de':"'"};
const VK_JIS = {'ba':"'",'bb':';','c0':'[','db':']','dc':'jp_yen','dd':'\\','de':'=','e2':'jp_ro'};
const JIS_CHAR = {'@':'[','[':']',']':'\\',':':"'",'^':'=','\\':'jp_yen'};
const ALIAS = {escape:['esc'],bs:['backspace'],back:['backspace'],return:['enter'],del:['delete'],ins:['insert'],pageup:['pgup'],pagedown:['pgdn'],
  control:['lctrl','rctrl'],ctrl:['lctrl','rctrl'],shift:['lshift','rshift'],alt:['lalt','ralt'],lcontrol:['lctrl'],rcontrol:['rctrl'],apps:['appskey'],prtsc:['printscreen']};

const CAP = {esc:'Esc',backspace:'BS',tab:'Tab',capslock:'CapsLock',enter:'Enter',lshift:'Shift',rshift:'Shift',lctrl:'Ctrl',rctrl:'Ctrl',lwin:'Win',rwin:'Win',lalt:'Alt',ralt:'Alt',appskey:'App',space:'Space',printscreen:'PrtSc',scrolllock:'ScrLk',pause:'Pause',insert:'Ins',home:'Home',pgup:'PgUp',delete:'Del',end:'End',pgdn:'PgDn',up:'↑',down:'↓',left:'←',right:'→',muhenkan:'無変換',henkan:'変換',kana:'かな',jp_yen:'¥',jp_ro:'ろ'};
const CAP_JIS = {'`':'半/全','=':'^','[':'@',']':'[',"'":':','\\':']'};
const SEND_LABEL = {left:'←',right:'→',up:'↑',down:'↓',enter:'⏎',return:'⏎',backspace:'⌫',bs:'⌫',delete:'Del',del:'Del',esc:'Esc',escape:'Esc',tab:'Tab',space:'Space',home:'Home',end:'End',pgup:'PgUp',pgdn:'PgDn',insert:'Ins',ins:'Ins',appskey:'App',lwin:'Win',rwin:'Win',
  vk1d:'無変換',vk1c:'変換',vkf2:'かな',vkf3:'半/全',vkf4:'半/全',sc07b:'無変換',sc079:'変換',ime:'IME'};

function buildLayout(t){
  const K=[]; const add=(id,x,y,w=1,h=1)=>K.push({id,x,y,w,h});
  const row=(y,list,x=0)=>{for(const e of list){const [id,w=1]=Array.isArray(e)?e:[e]; if(id!=='_') add(id,x,y,w); x+=w;}};
  const D=[...'1234567890'], Q=[...'qwertyuiop'], A=[...'asdfghjkl'], Z=[...'zxcvbnm'];
  row(0,['esc',['_',1],'f1','f2','f3','f4',['_',.5],'f5','f6','f7','f8',['_',.5],'f9','f10','f11','f12']);
  const Y=1.25;
  if(t==='us'){
    row(Y,['`',...D,'-','=',['backspace',2]]);
    row(Y+1,[['tab',1.5],...Q,'[',']',['\\',1.5]]);
    row(Y+2,[['capslock',1.75],...A,';',"'",['enter',2.25]]);
    row(Y+3,[['lshift',2.25],...Z,',','.','/',['rshift',2.75]]);
    row(Y+4,[['lctrl',1.25],['lwin',1.25],['lalt',1.25],['space',6.25],['ralt',1.25],['rwin',1.25],['appskey',1.25],['rctrl',1.25]]);
  } else {
    row(Y,['`',...D,'-','=','jp_yen','backspace']);
    row(Y+1,[['tab',1.5],...Q,'[',']']); add('enter',13.75,Y+1,1.25,2);
    row(Y+2,[['capslock',1.75],...A,';',"'",'\\']);
    row(Y+3,[['lshift',2.25],...Z,',','.','/','jp_ro',['rshift',1.75]]);
    row(Y+4,[['lctrl',1.5],['lwin',1.25],['lalt',1.25],['muhenkan',1.25],['space',3.25],['henkan',1.25],['kana',1.25],['ralt',1.25],['appskey',1.25],['rctrl',1.5]]);
  }
  const X=15.5;
  row(0,['printscreen','scrolllock','pause'],X);
  row(Y,['insert','home','pgup'],X);
  row(Y+1,['delete','end','pgdn'],X);
  add('up',X+1,Y+3);
  row(Y+4,['left','down','right'],X);
  return K;
}
const KB_W = 18.5, KB_H = 6.25;
let LAYOUT = buildLayout('jis'), LAYOUT_IDS = new Set(LAYOUT.map(k=>k.id));

function resolveKey(raw){
  if(!raw) return [];
  const k = raw.toLowerCase();
  if(k.length===1){
    if(S.layout==='jis' && JIS_CHAR[k]) return [JIS_CHAR[k]];
    return LAYOUT_IDS.has(k) ? [k] : [];
  }
  if(ALIAS[k]) return ALIAS[k];
  if(CAP[k] || /^f([1-9]|1[0-2])$/.test(k)) return [k];
  let m = k.match(/^vk([0-9a-f]{2})/);
  if(m){ const id = (S.layout==='jis'?VK_JIS:VK_US)[m[1]] || VK[m[1]]; return id?[id]:[]; }
  m = k.match(/^sc([0-9a-f]{3})$/);
  if(m){ const id=SC[m[1]]; return id?[id]:[]; }
  return [];
}
function capLabel(id){
  if(S.layout==='jis' && CAP_JIS[id]) return CAP_JIS[id];
  if(CAP[id]) return CAP[id];
  return id.length===1 ? id.toUpperCase() : id.toUpperCase();
}
function keyName(raw){
  const ids = resolveKey(raw);
  if(ids.length===1) return capLabel(ids[0]);
  return raw.length===1 ? raw.toUpperCase() : raw;
}

const AHK_NAMED = {esc:'Esc',backspace:'Backspace',tab:'Tab',capslock:'CapsLock',enter:'Enter',lshift:'LShift',rshift:'RShift',lctrl:'LCtrl',rctrl:'RCtrl',lalt:'LAlt',ralt:'RAlt',
  lwin:'LWin',rwin:'RWin',appskey:'AppsKey',space:'Space',printscreen:'PrintScreen',scrolllock:'ScrollLock',pause:'Pause',insert:'Insert',home:'Home',pgup:'PgUp',delete:'Delete',
  end:'End',pgdn:'PgDn',up:'Up',down:'Down',left:'Left',right:'Right',muhenkan:'vk1D',henkan:'vk1C',kana:'sc070',jp_yen:'sc07D',jp_ro:'sc073'};
const AHK_PUNCT_JIS = {'`':'sc029','=':'sc00D','[':'sc01A',']':'sc01B',';':'sc027',"'":'sc028','\\':'sc02B'};
const AHK_PUNCT_US  = {'`':'sc029'};
function idToAhk(id){
  if(AHK_NAMED[id]) return AHK_NAMED[id];
  if(/^f\d+$/.test(id)) return id.toUpperCase();
  const p = (S.layout==='jis'?AHK_PUNCT_JIS:AHK_PUNCT_US)[id];
  return p || id;
}
