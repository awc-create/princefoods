# Prince Foods B2C — Audit Fixes Applied

Everything from `SECURITY_AUDIT.md` and `CUSTOMER_JOURNEY_AUDIT.md`, repaired.
143 files changed (132 modified, 11 new). Typecheck clean, lint clean, guard check passing.

**Decisions you made that shaped this:** VIEWER is read-only (can log in, GET only);
stock stays as In/Out text statuses; the migration is written but not applied; the
customer returns flow is included.

---

## ⚠️ Two things to do at deploy time

1. **Run the migration** — adds `actorId` / `actorEmail` to `OrderActivity`:
   ```bash
   npx prisma generate       # also needed: new columns aren't in the client yet
   npx prisma migrate deploy
   ```
   Both columns are nullable, so it's additive: no table rewrite, no backfill, no
   meaningful lock. Existing rows keep NULL (= system/unknown actor).
   **Until this runs, attribution silently no-ops** — everything else works.

2. **Clear the Hetzner disk first.** It was at 100%. An `ALTER TABLE` needs space.

---

## CRITICAL

### C1 — 83 unauthenticated admin API routes → all 138 now guarded

New `src/lib/require-admin.ts`:

```ts
const guard = await requireAdmin({ write: true });
if (!guard.ok) return guard.response;
```

- Applied to **82 files / 90 handlers**. GET is read-only (VIEWER allowed), writes
  require HEAD/STAFF, staff management and store settings require HEAD.
- `lib/route-ctx.ts` already had a *different* `requireAdmin` used by 29 routes. Rather
  than leave two competing policies, it now takes `{ allowViewer }` and its GET handlers
  opt in — so one policy applies everywhere.
- **`send-welcome` was the nastiest find of this pass.** My first sweep skipped it as
  "token-gated" because it mentions `passwordToken` — but it *creates* tokens and mass-emails
  reset links, with no arguments. Unauthenticated, anyone could have triggered a password-reset
  blast to every user. Now HEAD-only.
- `staff/do-reset` and `cron/close-idle` are deliberately allowlisted — the reset token and
  `CRON_SECRET` are their credentials.

**`scripts/check-admin-guards.mjs`** now runs in `prebuild`. A new unguarded admin route
fails the build with instructions. This is the part that stops the problem returning.

### C2 — Admin pages protected only in the browser → gated in middleware

`middleware.ts` claimed admin auth lived in `AdminGate.tsx`, **which doesn't exist**. The only
real guard was on `/admin/settings`. `/admin/orders/[id]` is an async server component with 4
Prisma queries — a client layout can't stop it running, so order data was serialised into the
response before the browser redirected.

Now every `/admin` path is checked in middleware before any server component runs.

---

## HIGH

### H1 — Customer order history readable by anyone (IDOR)
`/api/customers/[id]/orders` took any user id and returned 50 orders. Now 401 without a
session, 404 unless it's your own id or you're staff.

### H2 — Password login had no rate limiting
Your limiter sat on `/api/login`, which is the **magic-link** endpoint. Both forms call NextAuth
`signIn()` → `/api/auth/callback/credentials`, which never touched it. Added
`passwordAttemptLimiter` inside both `authorize()` callbacks: 8 attempts / 15 min, keyed on
**both** account and IP.

### H3 — 85 out-of-stock products were on sale
`Number('OutOfStock')` → `NaN` → `null`, and null meant *in stock*.

New `src/lib/stock.ts` is the single source of truth, and **fails closed** — anything
unrecognised is treated as out of stock, because quietly selling what you don't have is worse
than quietly hiding what you do. Verified against 15 cases including both spellings, numbers,
null and junk.

Applied at every layer: product page, buy box, **shop grid (which previously showed no stock
at all)**, the products API, and a server-side gate in `place-order` returning a 409 in plain
English.

> I introduced part of this. My earlier admin dropdown wrote `In Stock` / `Out of Stock`
> (with spaces) while your data uses `InStock` / `OutOfStock` — a third spelling. The dropdown
> now writes the canonical values, and the parser understands all of them regardless.

### H4 — A basket left for days dead-ended at payment
Prices persist in localStorage forever; `place-order` rejects drift with
`Price mismatch … expected 299p, got 275p` — shown to the shopper verbatim, with no way out.

- New `POST /api/products/prices` (capped at 100 ids).
- New `syncWithCatalogue()` on the cart store: re-prices lines, drops items that are gone or
  out of stock, and returns what changed. On network failure it leaves the basket untouched
  rather than wiping someone's shopping.
- The basket page syncs on mount and explains itself: *"The price of X has changed. Your
  basket has been updated."*
- Checkout translates the remaining server errors into plain English and re-syncs automatically.

The server-side rejection is unchanged — it was correct.

---

## MEDIUM

| | |
|---|---|
| **Activity log had no actor** | `logActivity()` now stamps the acting staff member centrally, so all existing call sites get attribution free. Null = system (webhook/cron). *Needs the migration.* |
| **No customer returns route** | New `POST /api/account/orders/[displayId]/report-problem` + a "Report a problem" form on the order page. Opens the same `ReturnCase` your admin already triages — no admin-side changes needed. Ownership enforced; duplicate reports are absorbed. |
| **Free orders got no email** | Confirmation lived inside the webhook, which never fires for £0 orders. Extracted to `lib/email/send-order-confirmation.ts`, called by both. Idempotent via the existing activity note, so Stripe re-delivery can't double-send — **and no second migration needed.** |
| **Fake guest email** | `guest@prince-v.com` fallback removed — such an order could never be tracked or contacted. Now rejected with a clear message. |
| **Client-supplied tax** | `taxTotal` is now server-decided (0 for zero-rated groceries) in one place, instead of trusted from the browser. |
| **Password policy** | Sign-in min 8; new/reset passwords min 10 with a real error message. |
| **VIEWER role** | Was unusable — the provider rejected it while the UI had a whole VIEWER branch. Now genuinely read-only, consistently, across middleware and both guards. |

---

## CSV import/export — was quietly destructive

Re-importing your own admin export **wiped every product image**: the export writes
`imageUrl`, the importer reads `productImageUrl`/`image`. Same for shipping weights
(`shipping_weight_grams` vs `shipping_weight`), which would have broken APC quotes.

- Importer now accepts all those aliases.
- **Updates are partial.** Previously the update path wrote all ~55 fields, so any column
  missing from the CSV was nulled — cost, surcharge, all product options, all additional info.
  A field absent from the CSV is now left alone.
- **A stock-only CSV works.** `name` is only required to *create*. So `id,inventory` with 85
  rows updates stock and touches nothing else — verified: writes 1 field, preserves 60.

Also added **bulk "In stock" / "Out of stock"** to the products list, so you don't need the CSV
or 85 individual page loads.

---

## Added in a second pass

Checks I ran after the main sweep, and what they turned up:

| Check | Result |
|---|---|
| **Does anything public call `/api/admin/*`?** (regression risk from my own change) | Only the admin-gated Test-Stripe button, the upload helpers (admin-only components) and admin print links. **No customer-facing breakage.** |
| **Secrets in the browser bundle** | Clean — every `NEXT_PUBLIC_` var is legitimately public (publishable Stripe keys, VAPID public key, URLs). No server secret referenced in a client component. |
| **Security headers** | There were **none**. Added `X-Content-Type-Options`, `X-Frame-Options` + `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, and `no-store` on `/admin` + `/account`. Deliberately **no full CSP** — this site loads Crisp, Stripe, Instagram and Google images, so a CSP has to be written against the real pages and tested or it silently breaks them. |
| **Abandoned orders** (the one item I'd missed) | New `GET /api/admin/cron/expire-unpaid-orders`. Cancels PLACED+PENDING orders with no shipment after `ORDER_ABANDON_HOURS` (default 24). Cancels rather than deletes; supports `?dry=1`. Needs a cron entry calling it with `x-cron-key`. |
| **Dependency audit** | Couldn't run — this is a Yarn project and the sandbox has no Yarn. **Please run `yarn npm audit --severity high` locally.** |

Also worth knowing: `next.config.js` has `eslint: { ignoreDuringBuilds: true }`, so lint
problems never fail your deploys. I've left it alone rather than risk blocking a release, but
it's why the guard check is a separate `prebuild` script instead of a lint rule.

---

## Verification

- `tsc --noEmit` — clean
- `eslint` on all changed areas — clean
- `scripts/check-admin-guards.mjs` — 138 routes, all authorised
- Stock logic — 15/15 cases pass
- CSV round-trip — simulated against the real mapper

**Not verified:** nothing has been run against a live database or browser. Worth doing after
deploy: an unauthenticated `curl` to `/api/admin/orders/<id>` (expect 401), one real checkout,
and confirming an out-of-stock product can't be added from the shop grid.
