#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');
let env = '';
try {
  env = readFileSync(envPath, 'utf8');
} catch {}
const get = (k) => (process.env[k] ?? env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').trim();

const base = get('NEXT_PUBLIC_ADMIN_URL') || get('NEXT_PUBLIC_SITE_URL') || get('SITE_URL');
if (!base) {
  console.error(
    '❌ No base URL (NEXT_PUBLIC_ADMIN_URL|NEXT_PUBLIC_SITE_URL|SITE_URL) in .env or env.'
  );
  process.exit(1);
}

try {
  const u = new URL(base);
  // also check relative resolution works (trailing slash etc.)
  const v = new URL('/health', u);
  if (!v.href.startsWith(u.origin)) throw new Error('relative resolution broken');
} catch (e) {
  console.error('❌ Base URL is invalid or cannot resolve relatives:', base);
  console.error(String((e && e.message) || e));
  process.exit(1);
}

console.log('✅ Base URL OK:', base);
