#!/usr/bin/env node
/**
 * Build guard: every /api/admin route handler must authorise itself.
 *
 * src/middleware.ts deliberately skips /api/, so there is no blanket protection —
 * each route is on its own. Before this check existed, 83 of 138 admin routes were
 * reachable with no session at all, including one that queued a full-value refund.
 *
 * Fails the build if a handler is unguarded. Fix by adding, at the top of the handler:
 *
 *   const guard = await requireAdmin({ write: true });   // omit `write` for GET
 *   if (!guard.ok) return guard.response;
 */
import fs from 'node:fs';
import path from 'node:path';

const ADMIN_API = path.join(process.cwd(), 'src', 'app', 'api', 'admin');

/** Routes that legitimately authorise by something other than a session. */
const ALLOWLIST = new Map([
  ['cron/close-idle/route.ts', 'authorised by CRON_SECRET'],
  ['cron/expire-unpaid-orders/route.ts', 'authorised by CRON_SECRET'],
  ['staff/do-reset/route.ts', 'the single-use reset token IS the credential']
]);

const HANDLER_RE = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;
const WRITE_RE = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\s*\(/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name === 'route.ts') out.push(full);
  }
  return out;
}

const files = walk(ADMIN_API);
const unguarded = [];
const viewerWritable = [];

for (const file of files) {
  const rel = path.relative(ADMIN_API, file).split(path.sep).join('/');
  if (ALLOWLIST.has(rel)) continue;

  const src = fs.readFileSync(file, 'utf8');
  if (![...src.matchAll(HANDLER_RE)].length) continue;

  const authorises =
    src.includes('requireAdmin') ||
    src.includes('getServerSession') ||
    src.includes('CRON_SECRET') ||
    src.includes('constructEvent');

  if (!authorises) {
    unguarded.push(rel);
    continue;
  }

  // Writes must block the read-only VIEWER role.
  // Two guards exist, with different shapes:
  //   @/lib/require-admin → requireAdmin({ write: true })      — opt IN to blocking VIEWER
  //   @/lib/route-ctx     → requireAdmin({ allowViewer: true }) — blocks VIEWER by default
  if (!WRITE_RE.test(src)) continue;

  const usesRouteCtx = /from '@\/lib\/route-ctx'/.test(src) && src.includes('requireAdmin');
  const usesSharedGuard = /from '@\/lib\/require-admin'/.test(src);

  if (usesSharedGuard && !src.includes('write: true')) {
    viewerWritable.push(rel);
  }

  // route-ctx is strict unless a handler opts in — make sure no WRITE handler does.
  if (usesRouteCtx) {
    const parts = src.split(/(export async function (?:GET|POST|PUT|PATCH|DELETE)\s*\()/);
    for (let i = 1; i < parts.length; i += 2) {
      const isWrite = /export async function (?:POST|PUT|PATCH|DELETE)/.test(parts[i]);
      if (isWrite && parts[i + 1]?.includes('allowViewer')) viewerWritable.push(rel);
    }
  }
}

let failed = false;

if (unguarded.length) {
  failed = true;
  console.error(`\n❌ ${unguarded.length} admin route(s) have NO authorisation:\n`);
  for (const r of unguarded) console.error(`   /api/admin/${r}`);
  console.error('\n   Add to each handler:');
  console.error("     const guard = await requireAdmin({ write: true });");
  console.error('     if (!guard.ok) return guard.response;\n');
}

if (viewerWritable.length) {
  failed = true;
  console.error(`\n❌ ${viewerWritable.length} route(s) allow writes without blocking VIEWER:\n`);
  for (const r of viewerWritable) console.error(`   /api/admin/${r}`);
  console.error("\n   Pass { write: true } to requireAdmin() in those handlers.\n");
}

if (failed) process.exit(1);

console.log(
  `✅ admin guards: ${files.length} route files checked, all authorised ` +
    `(${ALLOWLIST.size} allowlisted).`
);
