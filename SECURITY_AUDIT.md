# Prince Foods B2C — Security & Flow Audit

Audit of login, order storage, activity recording, access control and ease of use.
Every finding below was verified by reading the actual code; file and line references included.

**Headline:** the *payment* path is genuinely well built — prices are validated against the
database, totals are computed server-side, and Stripe is charged the DB figure. The problem is
**access control**: most of the admin API has no authentication at all, and the admin pages are
guarded only in the browser.

---

## CRITICAL

### C1. 83 of 138 admin API routes have no authentication check

`src/middleware.ts` bypasses `/api/` entirely (both the early-return and the `matcher` config
exclude it), so every API route must guard itself. Most don't.

Verified examples — no session check of any kind:

| Route | Effect |
|---|---|
| `GET /api/admin/orders/[id]` | Returns the **entire order object + items** — customer email, totals, payment intent IDs |
| `POST /api/admin/orders/[id]/returns/refund` | Queues a refund, **defaulting to the full grand total** |
| `POST /api/admin/orders/[id]/cancel` | Cancels any order |
| `POST /api/admin/orders/[id]/fulfill` / `ship` / `archive` | Changes order state |
| `POST /api/admin/shipments/[id]/void` / `dispatch` | Voids carrier labels, emails customers |
| `GET,POST /api/admin/products` | Reads and creates products |
| `GET,POST /api/admin/settings/orders` | Reads/writes store settings |
| `POST /api/admin/import-wix` | Bulk data import |

**This is reachable from the public domain.** Middleware blocks `/admin` *pages* on
`prince-foods.com`, but `/api/` is skipped on every host — so
`https://prince-foods.com/api/admin/orders/<id>` answers with no cookie at all.

The refund route is the most serious: it writes `refundQueuedAt` and `refundAmountPence`
(full order total by default) and marks the return resolved, unauthenticated.

> Note: `POST /api/admin/staff/do-reset` *looks* unprotected but is correctly token-gated —
> single-use, expiring, bcrypt-12. Not a finding.

**Fix:** one `requireAdmin()` helper called at the top of every `/api/admin/*` handler. ~83 files,
mechanical. A route-level test that fails the build if any `/api/admin` route lacks it is worth
adding at the same time.

### C2. Admin pages are protected only in the browser

`src/middleware.ts` says *"Admin auth is handled server-side in src/app/admin/AdminGate.tsx"* —
**that file does not exist.** Protection is `app/admin/layout.tsx`, a `'use client'` component
doing `useSession()` + `router.replace()`.

Only `app/admin/settings/layout.tsx` has a real `getServerSession` guard.

`app/admin/orders/[id]/page.tsx` is an **async server component with 4 Prisma queries and no auth
check**. In the App Router a client layout cannot stop a server-component child from executing —
the page runs on the server and its data is serialised into the response, then the browser
redirects. The order data (name, email, address, phone, items, payment IDs) has already been sent.

Reachable at `https://admin.prince-foods.com/admin/orders/<id>` with no session.

**Fix:** convert the admin guard to a server layout using `getServerSession`, or add an auth check
to `middleware.ts` for `/admin` paths (cheapest — it already imports `getToken`).

---

## HIGH

### H1. Customer order history readable by anyone — IDOR

`app/api/customers/[id]/orders/route.ts` has no session check. Pass any user id, get that
customer's last 50 orders. It sits outside `/api/admin/`, so it's public on the storefront domain.

By contrast `app/api/account/orders/route.ts` and `.../[displayId]/route.ts` enforce ownership
correctly (`where: { displayId, userId }`) — so the pattern is already in the codebase, it just
wasn't applied here.

### H2. No rate limiting on password login

You have a working limiter (`src/lib/rate-limit.ts`) used on signup, magic-link and checkout.
But **it does not cover password login.**

- `/api/login` is the **magic-link** endpoint, not password sign-in.
- Both forms call NextAuth `signIn()` → posts to `/api/auth/callback/credentials`.
- `LoginForm.tsx:74` (customer), `AdminLoginClient.tsx:101` (admin).

So admin passwords can be brute-forced without throttling. Compounded by C1/C2, this is the most
likely real-world attack path.

**Fix:** rate-limit inside the `authorize()` callbacks in `lib/auth-options.ts`, keyed on
email + IP, with a short lockout. The limiter is in-memory — fine on one Hetzner box, but note
it resets on redeploy.

---

## MEDIUM

### M1. The activity trail doesn't record *who*

`OrderActivity` (schema line 710) is `id, orderId, type, note, meta, createdAt` — **no actor
field.** You can see that an order was cancelled; you cannot see which staff member cancelled it.
With HEAD/STAFF/VIEWER roles and multiple logins, that's a real accountability gap, and it
undermines the trail's value in a dispute.

There is also **no general audit log**: product and price edits, offer/promotion changes, customer
discounts and staff changes are not recorded anywhere. Site-content edits are the exception — they
create `Notification` rows with before/after in `meta`.

**Fix:** add `actorId` / `actorEmail` to `OrderActivity`, populate from the session (available once
C1 is fixed), and add a small `AuditLog` table written on price, offer and staff changes.

### M2. VIEWER role can never sign in

`auth-options.ts` `admin-credentials` rejects any role that isn't HEAD or STAFF, but
`app/admin/layout.tsx` has a full VIEWER branch (read-only nav). The VIEWER experience is
unreachable — either dead code or a broken feature.

### M3. Weak password policy

`CredentialsSchema` requires only `min(6)`, and `do-reset` accepts any 6-character password.
For accounts that can issue refunds, 10–12 with a breach check would be proportionate.
Hashing itself is fine (bcrypt, 12 rounds).

### M4. Client-supplied tax persisted

`place-order` computes subtotal, shipping, discounts and grand total server-side (good), but
`t.tax` comes from the request body and is stored as `taxTotal` and added to `grandTotal`
(lines 306, 798, 858). `isValidMoney` forces it ≥ 0, so a customer can only overpay — low impact,
but it shouldn't be client-controlled.

---

## What's already done well

Worth stating plainly, because a lot of it is better than typical:

- **Payment integrity is sound.** `place-order` re-reads product prices from the DB and rejects
  any mismatch (line ~370); `isValidMoney` blocks negative amounts; totals are computed
  server-side; `stripe/checkout` charges `order.grandTotal` from the DB as a single line item so
  the Stripe amount cannot drift from the order.
- **Guest order tracking is correct** — requires order number *and* matching email, and returns a
  generic 404 for both "not found" and "wrong email" so order existence isn't leaked.
- **Account endpoints enforce ownership** properly.
- **Stripe webhook verifies the signature** before processing.
- **Session hygiene:** bcrypt 12, `httpOnly`, `secure` in production, `sameSite: lax`,
  `__Host-` prefixed CSRF cookie with no domain override.
- **Secrets:** `.env*` is gitignored, no env files tracked, no hardcoded live keys in source.
- **`displayId`** is 8 random characters, not sequential — order numbers aren't enumerable.

---

## Suggested order of work

1. **C1** — `requireAdmin()` across `/api/admin/*`. Biggest exposure, mechanical fix.
2. **C2** — move the admin guard server-side (middleware or a server layout).
3. **H1** — ownership check on `/api/customers/[id]/orders`.
4. **H2** — throttle `authorize()`.
5. **M1** — actor on `OrderActivity`, then a basic `AuditLog`.
6. M2–M4 as cleanup.

Items 1–4 are roughly a day and close everything externally exploitable.

---

## One caveat on scope

This is a static read of the code. I have not tested the live site — the findings above are
derived from source, and the two critical ones should be confirmed with a single unauthenticated
`curl` against a staging copy before and after the fix. I'd avoid probing production with the
refund endpoint for obvious reasons; `GET /api/admin/orders/<id>` is the safe one to test with.
