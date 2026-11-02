# Admin Audit — Backend Quality & Remaining UX

Second admin pass. The first two (`ADMIN_UX_REVIEW.md`, `ADMIN_SIMPLICITY_PLAN.md`) covered
workflow and learnability. This one covers **backend quality** and the **UX items still
outstanding**, with the brief of making the admin easier for staff to actually use.

---

## Backend findings

### B1 — Missing indexes on the two most-used filters (MEDIUM)

`Order` is well indexed overall, but not for how the admin list actually queries it.

Every admin orders request filters `archivedAt` (the default view is `archived=active` →
`archivedAt: null`) and sorts by `createdAt desc`. There is **no index on `archivedAt`**, and
none on `paymentStatus` either — both are in the default query path.

```
existing:  [status, createdAt]  [userId, createdAt]  [contactEmail, createdAt]  …
missing:   [archivedAt, createdAt]   [paymentStatus, createdAt]
```

Right now the table is small enough that nobody notices. It degrades as orders accumulate, and
the orders list is the page staff live in.

### B2 — 26 unbounded `findMany` calls (LOW→MEDIUM)

Most are harmless (categories, FAQ, home sections, shipping zones, staff — all small, fixed-size
tables). Four grow without limit and are worth capping:

| Route | Grows with |
|---|---|
| `returns/route.ts:31` | every return case ever |
| `promotions/route.ts:66` | every promotion ever |
| `orders/[id]/activity:18` | every event on an order — and we now log more |
| `threads/[threadId]/messages:41` | every chat message in a thread |

Export and email-blast routes are also unbounded, but intentionally so.

> Note: my first scan reported 30, including the option-pickers. That was wrong — they use a
> shorthand `take,` property my regex didn't match. They're correctly capped (20–1000).

### B3 — N+1 patterns (LOW)

Five loops contain queries. Four are inherent (CSV upsert-per-row, per-user welcome emails) or
already capped. One is mine: `cron/expire-unpaid-orders` updates row-by-row where a single
`updateMany` would do — worth tightening before it ever runs on a large backlog.

### B4 — What's already sound

Worth recording so it doesn't get "fixed" later: the admin orders list paginates properly with
a server-side `count`, the option-pickers cap and support search, `products/bulk` uses
`updateMany` rather than looping, and multi-step writes in the offers and site-content routes
are wrapped in `$transaction`.

---

## UX findings — the staff-usability brief

Three items from `ADMIN_SIMPLICITY_PLAN.md` are still open, and they're the three that most
affect day-to-day use.

### U1 — The dashboard still answers the wrong question (HIGH)

It leads with Products / Customers / Orders / Revenue — numbers for the owner, not tasks for
staff. Someone logging in to pack orders has no "start here". We added a small needs-attention
row, but the scoreboard is still the page.

**Fix:** make the work queue the page. Counts that are also the buttons: orders to pack, labels
to print, delivery problems, returns to action — each opening the right pre-filtered list.
Business figures move below, under their own heading.

### U2 — 22 sidebar items for a job that needs about six (HIGH)

A packer needs Orders, Shipments, Products, Customers, Returns. They currently scan 22 links
across six groups, including Site Editing, Media Library, Categories, Analytics and Delivery
Rates.

**Fix:** a Simple view by default (the six), with "Show everything" revealing the rest —
remembered per user. Nothing is removed or made inaccessible.

### U3 — Three doors to discounts (MEDIUM)

Promotions, Offers and Customer Discounts are three top-level sections with overlapping
purposes. Staff must already know the taxonomy to pick correctly; the Guide has to explain the
difference twice, which is the tell.

**Fix:** one **Discounts** hub that explains the three in plain English and routes onward. The
three engines stay exactly as they are — this is a signpost, not a rewrite.

### U4 — Customer-reported problems have nowhere obvious to land (NEW)

I added customer-side "Report a problem" in the last pass. Those create `ReturnCase` rows that
appear in the Returns list, but nothing distinguishes a customer-raised report from a
system-detected delivery exception, and nothing surfaces it on the dashboard. Staff could miss
them.

**Fix:** flag customer-reported cases in the returns list and count them on the dashboard.

---

## Order of work

1. **U1 dashboard work queue** — biggest daily impact
2. **U2 simple sidebar**
3. **U4 surface customer reports**
4. **U3 discounts hub**
5. **B1 indexes** (append to the already-pending migration — it hasn't been applied)
6. **B2/B3** caps and the cron tidy-up


---

# ✅ Implemented

All six items above are done. Typecheck clean, lint clean, 140 admin routes verified guarded.

## UI — easier for staff

**U1. The dashboard is now a work queue.** `WorkQueue.tsx` + a new `GET /api/admin/worklist`
(counts only, run in parallel). The page opens with what's waiting, each row being both the
count and the way in:

| | |
|---|---|
| *N* orders to pack | → Orders, pre-filtered to PAID |
| *N* labels to print and send | → Shipments with a label |
| *N* problems reported by customers | → Returns |
| *N* returns to action | → Returns |
| *N* abandoned checkouts | → hidden when zero |

Zero-count rows disappear, and an all-clear state says so rather than showing a row of noughts.
Business figures (products / customers / orders / revenue, with the period picker) moved below
under **Business summary**. The old "needs attention" tiles are superseded, so I removed them
and their loader rather than leaving duplicates.

**U2. Sidebar defaults to six items, not 22.** Orders, Shipments, Returns, Products, Customers,
Overview. A **"⋯ Show everything"** toggle at the bottom reveals Site Editing, Media, Categories,
Analytics, Delivery Rates and Settings, and the choice is remembered per browser. Nothing was
removed or made inaccessible.

**U3. One Discounts door.** New `/admin/discounts` explains the three types in plain English —
*"If the customer has to type something in, it's a discount code. If it should just happen at
checkout, it's an automatic offer. If it follows one person around, it's a customer discount."*
— with an example on each and a link onward. The three engines are untouched; the nav now shows
Discounts with the three indented beneath it.

**U4. Customer reports are distinguishable.** The returns list has a **Raised by** column showing
*Customer* or *System*, and customer-raised cases are counted separately on the dashboard. Staff
can no longer miss a report in among automated delivery exceptions.

## Backend

**B1. Indexes** — `[archivedAt, createdAt]` and `[paymentStatus, createdAt]` on `Order`, appended
to the **existing unapplied migration** so it's still one `prisma migrate deploy`, not two.

**B2. Caps** on the four lists that grow unbounded: returns (200, max 500), promotions (300),
order activity (200), chat messages (500). The rest are small fixed-size tables and were left alone.

**B3. Cron tidy-up** — `expire-unpaid-orders` now uses one `updateMany` plus one `createMany`
instead of updating row by row.

## Still outstanding (deliberately)

- **Full visual restyle / mobile card layouts** — still the deferred P2 from `ADMIN_UX_REVIEW.md`.
  Needs a browser and visual testing, not a code read.
- **A Content-Security-Policy** — has to be written against the real pages or it breaks Crisp,
  Stripe and Instagram embeds.
- **`yarn npm audit`** — can't run here; please run it locally.
