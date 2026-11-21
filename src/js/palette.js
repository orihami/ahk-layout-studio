"use strict";
/* =========================================================
   パレット（キーにドラッグして割り当てる部品）
   act: 割り当てる動作 / ask: ドロップ時に内容を尋ねる / special: 特別な部品
   ========================================================= */
const R = v => ({ type: 'remap', value: v });
const SD = v => ({ type: 'send', value: v });
const TX = v => ({ type: 'text', value: v });

const PALETTE = [
  { cat: 'レイヤー', items: [
    { label: '🔑 レイヤーキー', sub: 'このキーを押しながら使う面を作る', special: 'layer' },
  ]},
  { cat: '移動', items: [
    { label: '←', sub: 'カーソル左', act: R('Left') }, { label: '→', sub: 'カーソル右', act: R('Right') },
    { label: '↑', sub: 'カーソル上', act: R('Up') }, { label: '↓', sub: 'カーソル下', act: R('Down') },
    { label: 'Home', sub: '行頭へ', act: R('Home') }, { label: 'End', sub: '行末へ', act: R('End') },
    { label: 'PgUp', sub: '前のページ', act: R('PgUp') }, { label: 'PgDn', sub: '次のページ', act: R('PgDn') },
    { label: '⇠単語', sub: '単語単位で左へ', act: SD('^{Left}') }, { label: '単語⇢', sub: '単語単位で右へ', act: SD('^{Right}') },
    { label: '先頭', sub: '文書の先頭へ', act: SD('^{Home}') }, { label: '末尾', sub: '文書の末尾へ', act: SD('^{End}') },
  ]},
  { cat: '編集', items: [
    { label: 'Enter', sub: '改行・決定', act: R('Enter') }, { label: '⇧Enter', sub: '改行（送信しない）', act: R('+Enter') },
    { label: '^Enter', sub: 'Ctrl+Enter', act: R('^Enter') }, { label: 'BS', sub: '左を1文字削除', act: R('BackSpace') },
    { label: 'Del', sub: '右を1文字削除', act: R('Delete') }, { label: 'Tab', sub: 'タブ', act: R('Tab') },
    { label: 'Esc', sub: 'キャンセル', act: R('Esc') }, { label: 'Space', sub: 'スペース', act: R('Space') },
    { label: '単語削除', sub: 'Ctrl+BS', act: SD('^{BS}') },
  ]},
  { cat: 'ショートカット', items: [
    { label: 'コピー', sub: 'Ctrl+C', act: SD('^c') }, { label: '貼り付け', sub: 'Ctrl+V', act: SD('^v') },
    { label: '切り取り', sub: 'Ctrl+X', act: SD('^x') }, { label: '元に戻す', sub: 'Ctrl+Z', act: SD('^z') },
    { label: 'やり直し', sub: 'Ctrl+Y', act: SD('^y') }, { label: '保存', sub: 'Ctrl+S', act: SD('^s') },
    { label: '全選択', sub: 'Ctrl+A', act: SD('^a') }, { label: '検索', sub: 'Ctrl+F', act: SD('^f') },
    { label: '新しいタブ', sub: 'Ctrl+T', act: SD('^t') }, { label: 'タブを閉じる', sub: 'Ctrl+W', act: SD('^w') },
    { label: '次のタブ', sub: 'Ctrl+Tab', act: SD('^{Tab}') }, { label: '前のタブ', sub: 'Ctrl+Shift+Tab', act: SD('^+{Tab}') },
    { label: 'ウィンドウを閉じる', sub: 'Alt+F4', act: SD('!{F4}') }, { label: 'クリップボード履歴', sub: 'Win+V', act: SD('#v') },
    { label: 'スクショ', sub: 'Win+Shift+S', act: SD('#+s') },
  ]},
  { cat: '数字', items: [...'1234567890'].map(c => ({ label: c, sub: '', act: R(c) })) },
  { cat: '記号', items: [
    ...[...'!#$%&\'()=~|-^\\@[]+*<>,./?_:;`{}'].map(c => ({ label: c, sub: '', act: '`{};'.includes(c) ? TX(c) : R(c) })),
    { label: '"', sub: '', act: TX('"') },
  ]},
  { cat: 'カッコ（中にカーソル）', items: [
    { label: '「」', sub: '', act: SD('「」{Left}') }, { label: '（）', sub: '', act: SD('（）{Left}') },
    { label: '()', sub: '', act: SD('(){Left}') }, { label: '[]', sub: '', act: SD('[]{Left}') },
    { label: '<>', sub: '', act: SD('<>{Left}') }, { label: '{}', sub: '', act: SD('{{}{}}{Left}') },
    { label: '""', sub: '', act: SD('""{Left}') },
  ]},
  { cat: '日本語入力', items: [
    { label: '半/全', sub: 'IME 切り替え', act: SD('{vkF3sc029}') }, { label: 'IME オン', sub: '変換キー', act: SD('{vk1C}') },
    { label: 'IME オフ', sub: '無変換キー', act: SD('{vk1D}') },
  ]},
  { cat: 'ファンクション', items: [...Array(12)].map((_, i) => ({ label: 'F' + (i + 1), sub: '', act: R('F' + (i + 1)) })) },
  { cat: '修飾キーにする', items: [
    { label: 'Ctrl', sub: 'Ctrl として動く', act: R('Ctrl') }, { label: 'Shift', sub: 'Shift として動く', act: R('Shift') },
    { label: 'Alt', sub: 'Alt として動く', act: R('Alt') }, { label: 'Win', sub: 'Win として動く', act: R('LWin') },
  ]},
  { cat: 'カスタム', items: [
    { label: '✍ 文字を入力…', sub: '好きな文字列を入力', ask: 'text' },
    { label: '⌨ キー操作を送る…', sub: 'Send 記法で指定', ask: 'send' },
    { label: '🚀 アプリ・URLを開く…', sub: 'Run', ask: 'run' },
    { label: '🧩 コードを書く…', sub: 'AutoHotkey のコード', ask: 'code' },
    { label: '🚫 無効にする', sub: '押しても何もしない', act: { type: 'code', value: 'return' } },
  ]},
];
const PAL = PALETTE.flatMap(c => c.items.map(it => Object.assign(it, { cat: c.cat })));

const ASK_TEXT = {
  text: '入力したい文字（例: よろしくお願いします。）',
  send: 'Send 記法（例: ^c は Ctrl+C、{Left} は ←、{Enter} は Enter）',
  run: '開くアプリ・ファイル・URL（例: notepad.exe / https://example.com）',
  code: 'AutoHotkey v2 のコード（1行。複数行は右の欄で編集できます）',
};
function askAct(kind) {
  const v = prompt(ASK_TEXT[kind], '');
  if (v == null || v === '') return null;
  return { type: kind, value: v };
}
