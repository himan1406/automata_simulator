// Post-build step: fold website/assets/* into website/index.html so the site is ONE self-contained file
// (no server needed; also works when opened straight from disk via file://).
import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const website = new URL('../website/', import.meta.url);
const read = ref => readFileSync(new URL(ref.replace(/^\.?\//, ''), website), 'utf8');
let html = readFileSync(new URL('index.html', website), 'utf8');

let js = '';
html = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>\s*/g, (_, src) => { js += read(src) + '\n'; return ''; });
html = html.replace(/<link\b[^>]*>\s*/g, tag => {
  const href = /\brel="stylesheet"/.test(tag) && tag.match(/\bhref="([^"]+)"/);
  return href ? `<style>${read(href[1])}</style>\n` : tag;
});
if (!js) throw new Error('inline: no script found in website/index.html (did vite build run?)');
html = html.replace('</body>', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>\n</body>`);

writeFileSync(new URL('index.html', website), html);
rmSync(new URL('assets/', website), { recursive: true, force: true });
console.log(`website/index.html ready (${(html.length / 1024).toFixed(1)} kB, self-contained)`);
