#!/usr/bin/env node
const required = ['DATABASE_URL'];
const advisable = ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_ADMIN_URL', 'SITE_URL'];

let bad = false;
for (const k of required) {
  if (!process.env[k]) {
    console.error(`❌ Missing required env: ${k}`);
    bad = true;
  }
}
if (bad) process.exit(1);

for (const k of advisable) {
  if (!process.env[k]) {
    console.warn(`⚠️  Missing recommended env: ${k}`);
  }
}
console.log('✅ Env guard passed.');
