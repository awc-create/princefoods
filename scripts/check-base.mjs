#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const CANDIDATE_KEYS = ['NEXT_PUBLIC_ADMIN_URL', 'NEXT_PUBLIC_SITE_URL', 'SITE_URL'];

const envFile = path.resolve(process.cwd(), '.env');
const hasDotenv = fs.existsSync(envFile);
const dotenvText = hasDotenv ? fs.readFileSync(envFile, 'utf8') : '';
const dotenv = Object.fromEntries(
  dotenvText
    .split(/\r?\n/)
    .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      const k = l.slice(0, i).trim();
      const v = l.slice(i + 1).trim();
      return [k, v.replace(/^["']|["']$/g, '')];
    })
);

// resolve the first non-empty value from process.env or .env
const getVal = (k) => {
  const v = (process.env[k] ?? dotenv[k] ?? '').trim();
  return v || null;
};

// simple absolute URL validator
const isAbsUrl = (s) => {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

// find the first good one
const winner = CANDIDATE_KEYS.find((k) => isAbsUrl(getVal(k)));

if (winner) {
  console.log(`✅ Base URL checks passed (${winner}=${getVal(winner)})`);
  process.exit(0);
}

// if none matched, print helpful diagnostics
const have = CANDIDATE_KEYS.map((k) => `${k}=${JSON.stringify(getVal(k))}`).join(', ');

console.error('❌ No valid base URL found. Need at least ONE of:');
console.error('   ' + CANDIDATE_KEYS.join(', '));
console.error(`🔎 Resolved values (env ⟶ .env): ${have}`);

if (hasDotenv) {
  console.error('\n📄 First 12 lines of .env for context:');
  console.error(dotenvText.split(/\r?\n/).slice(0, 12).join('\n'));
} else {
  console.error('\n⚠️ No .env file found at project root.');
}

process.exit(1);
