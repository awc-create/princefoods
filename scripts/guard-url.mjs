#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const ALLOW = new Set([
  path.join(ROOT, 'lib/abs-url.ts'),
  path.join(ROOT, 'lib/url.ts'),
  path.join(ROOT, 'utils/safeImageUrl.ts')
]);

const IGNORE_DIRS = new Set([
  'node_modules',
  '.next',
  'out',
  'dist',
  'coverage',
  'app/api',
  'pages/api'
]);

const offenders = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full);

    // ignore folders
    if (e.isDirectory()) {
      if ([...IGNORE_DIRS].some((p) => full.includes(path.join('src', p)))) continue;
      walk(full);
      continue;
    }

    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) continue;
    if (ALLOW.has(full)) continue;

    const text = fs.readFileSync(full, 'utf8');
    const regex = /new\s+URL\s*\(/g;
    let m;
    while ((m = regex.exec(text))) {
      const before = text.slice(0, m.index);
      const line = before.split('\n').length;
      offenders.push(`${path.join('src', rel)}:${line}: ${text.split('\n')[line - 1]?.trim()}`);
    }
  }
}

if (fs.existsSync(ROOT)) walk(ROOT);

if (offenders.length) {
  console.error('\n❌ Unsafe `new URL(...)` usages found (use urlFrom()/absUrl() instead):\n');
  for (const o of offenders) console.error('  ' + o);
  console.error('\nFix these or add the file to the allow-list if truly necessary.\n');
  process.exit(1);
}

console.log('✅ URL guard passed.');
