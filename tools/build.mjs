// src/ を1つの HTML（dist/ahk-layout-studio.html）にまとめる
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = p => readFileSync(join(root, 'src', p), 'utf8');
let html = src('index.html');
html = html.replace('<link rel="stylesheet" href="css/app.css">', () => `<style>\n${src('css/app.css')}\n</style>`);
html = html.replace(/<!-- BUILD:SCRIPTS -->([\s\S]*?)<!-- \/BUILD:SCRIPTS -->/, (_, block) => {
  const files = [...block.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
  return files.map(f => `<script>\n/* ---- ${f} ---- */\n${src(f).replace(/<\/script/gi, '<\\/script')}\n</script>`).join('\n');
});
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'ahk-layout-studio.html'), html);
console.log('built dist/ahk-layout-studio.html', (html.length / 1024).toFixed(0) + ' KB');
