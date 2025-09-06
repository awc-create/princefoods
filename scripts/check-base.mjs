#!/usr/bin/env node
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();

// Load env from common locations (override as we find more specific files)
const envCandidates = [
  path.join(cwd, '.env'),
  path.join(cwd, '.vercel', '.env.production.local'),
  path.join(cwd, '.vercel', '.env.preview.local'),
  path.join(cwd, '.vercel', '.env.development.local')
];

for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: true });
  }
}

// Now read from process.env
const base =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_ADMIN_URL;

if (!base) {
  console.error(
    '❌ No base URL (NEXT_PUBLIC_ADMIN_URL|NEXT_PUBLIC_SITE_URL|SITE_URL) in .env or env.'
  );
  process.exit(1);
}

console.log(`✅ Base URL detected: ${base}`);
