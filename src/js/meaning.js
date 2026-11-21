"use strict";
/* =========================================================
   意味（使われ方）
   ========================================================= */
const MEAN = {'←':'カーソル左','→':'カーソル右','↑':'カーソル上','↓':'カーソル下','Home':'行頭へ','End':'行末へ','PgUp':'前のページ','PgDn':'次のページ',
 '⌫':'左の1文字を削除','BS':'左の1文字を削除','Del':'右の1文字を削除','⏎':'改行・決定','Enter':'改行・決定','Esc':'キャンセル・閉じる','Tab':'タブ／次の項目','Space':'スペース',
 '半/全':'IME オン/オフ切替','変換':'IME オン','無変換':'IME オフ','かな':'かな入力','App':'右クリックメニュー','Ins':'挿入/上書き切替',
 'Ctrl+C':'コピー','Ctrl+X':'切り取り','Ctrl+V':'貼り付け','Ctrl+Z':'元に戻す','Ctrl+Y':'やり直し','Ctrl+S':'保存','Ctrl+A':'すべて選択','Ctrl+F':'検索','Ctrl+H':'置換',
 'Ctrl+P':'印刷','Ctrl+N':'新規','Ctrl+O':'開く','Ctrl+W':'タブ/ウィンドウを閉じる','Ctrl+T':'新しいタブ','Ctrl+Shift+T':'閉じたタブを復元','Ctrl+Tab':'次のタブ',
 'Ctrl+Shift+Tab':'前のタブ','Ctrl+PgDn':'次のタブ','Ctrl+PgUp':'前のタブ','Ctrl+/':'コメント切替','Ctrl+←':'単語単位で左へ','Ctrl+→':'単語単位で右へ',
 'Ctrl+Home':'文書の先頭へ','Ctrl+End':'文書の末尾へ','Ctrl+⌫':'単語を削除','Ctrl+Shift+Esc':'タスクマネージャー','Ctrl+L':'アドレスバーへ','Ctrl+R':'再読み込み',
 'Alt+F4':'ウィンドウを閉じる','Alt+Tab':'ウィンドウ切替','Alt+←':'戻る','Alt+→':'進む','Win+D':'デスクトップ表示','Win+E':'エクスプローラー','Win+L':'PCをロック',
 'Win+V':'クリップボード履歴','Win+Shift+S':'スクリーンショット','Shift+⏎':'改行（送信しない）','Shift+Tab':'前の項目','F2':'名前の変更・編集','F5':'更新',
 'Shift+←':'左へ選択','Shift+→':'右へ選択','Shift+↑':'上へ選択','Shift+↓':'下へ選択','Shift+Home':'行頭まで選択','Shift+End':'行末まで選択'};
function tokenMeaning(tk){
  if(tk.t==='text') return /[「」]/.test(tk.v) ? `“${tk.v}” を入力` : `「${tk.v}」を入力`;
  if(tk.t==='expr') return '変数の内容を送信';
  const m = tk.v.match(/^(.*?)(×(\d+))?$/); const base=m[1], n=m[3];
  const mean = MEAN[base] || (/[↓↑]$/.test(base) ? base.replace(/↓$/,' を押し下げ').replace(/↑$/,' を離す') : base+' キー');
  return mean + (n?` ×${n}回`:'');
}
function meaning(it){
  if(it.kind==='remap') return `${it.out} キーとして動く`+(MEAN[it.out]?`（${MEAN[it.out]}）`:'');
  if(it.kind==='send'){
    const parts=[]; for(const tk of it.tokens||[]){ const s=tokenMeaning(tk); if(parts[parts.length-1]!==s) parts.push(s); }
    let r = parts.slice(0,4).join(' → ') + (parts.length>4?' …':'');
    if(it.extraCode) r += '（＋他の処理）';
    return r || 'キー送信';
  }
  const o=it.out||''; let m;
  if((m=o.match(/^▶ (.*)/))) return `${m[1]} を起動`;
  if(/^Reload/i.test(o)) return 'スクリプトを再読み込み';
  if(/^ExitApp/i.test(o)) return 'スクリプトを終了';
  if(/^Suspend/i.test(o)) return 'ホットキーを一時停止/再開';
  if(/^Pause/i.test(o)) return 'スクリプトを一時停止';
  if(/MsgBox/.test(o)) return 'メッセージを表示';
  if((m=o.match(/^ƒ (.*)/))) return `関数 ${m[1]} を実行`;
  return 'スクリプトを実行' + (it.nLines>1?`（${it.nLines}行）`:'');
}
const kk = (t,held) => `<span class="kbd-k ${held?'h':''}">${esc(t)}</span>`;
function comboHTML(it){
  const ctx = it.ctx ? `<span class="dim">${esc(ctxLabel(it.ctx))} のとき</span> ` : '';
  const k = kk(keyName(it.keyRaw));
  let s;
  if(it.prefixRaw) s = `${kk(keyName(it.prefixRaw),1)} を押しながら ${k}`;
  else if(it.mods.length) s = it.mods.map(m=>kk(m,1)).join(' + ')+' + '+k;
  else s = k;
  return ctx + s + (it.up?' を<b>離したとき</b>':' を押す');
}

