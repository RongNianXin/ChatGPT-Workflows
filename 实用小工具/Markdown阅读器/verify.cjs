const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const dir = __dirname;
assert(!fs.existsSync(path.join(dir, 'demo.js')), 'No bundled document snapshot');
const cn = fs.readFileSync(path.join(dir, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
const en = fs.readFileSync(path.join(dir, 'README.en.md'), 'utf8');
assert(en.includes('README-SOURCE-SHA256: ' + crypto.createHash('sha256').update(cn).digest('hex')));
assert(cn.toString().startsWith('[English](README.en.md)'));
assert(en.startsWith('[中文](README.md)'));
for (const file of ['index.html', 'reader.js', 'reader.css', 'build.cjs', 'verify.cjs', 'README.md', 'README.en.md']) {
  const text = fs.readFileSync(path.join(dir, file), 'utf8');
  assert(!/[A-Z]:[\\/](?:Users|Windows|Program Files)/i.test(text), 'Machine-specific path: ' + file);
}
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) assert(fs.existsSync(path.join(dir, match[1])), 'Missing asset: ' + match[1]);
console.log('PASS: no bundled snapshot, bilingual README hash/links, local assets, scoped portable paths');
