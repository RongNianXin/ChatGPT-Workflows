const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
for (const [from, to] of [
  ['markdown-it/dist/markdown-it.min.js', 'markdown-it.min.js'],
  ['markdown-it/LICENSE', 'markdown-it.LICENSE'],
  ['lucide/dist/umd/lucide.min.js', 'lucide.min.js'],
  ['lucide/LICENSE', 'lucide.LICENSE']
]) fs.copyFileSync(path.join(root, 'node_modules', from), path.join(root, 'vendor', to));
const cn = path.join(root, 'README.md');
const en = path.join(root, 'README.en.md');
if (fs.existsSync(cn) && fs.existsSync(en)) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(cn, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
  fs.writeFileSync(en, fs.readFileSync(en, 'utf8').replace(/README-SOURCE-SHA256: \S+/, 'README-SOURCE-SHA256: ' + hash));
}
console.log('Built offline assets. All documents are selected and read at runtime.');
