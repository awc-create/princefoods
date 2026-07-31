# Admin Panel — Simplicity / "No Training Needed" Plan

> **Status:** Fixes **1, 3 and 7 are implemented**, plus the page-hint part of Fix 6.
> Still to do: Fix 2 (dashboard as work queue), Fix 4 (one Discounts door),
> Fix 5 (Simple view sidebar), and the first-run walkthrough in Fix 6.
> Typecheck + lint clean; the next-step state machine is covered by 12 passing cases.

A second review of `/admin`, this time asking one question only: **could a new warehouse
or office staff member sit down with no training and get the day's work done correctly?**

Short answer: **no, not yet** — but not because the admin is missing anything. It's because
it's built like a *toolbox* (here is every capability, arranged by data type) rather than a
*workflow* (here is what to do next). Everything needed is present; nothing tells you the order
to press it in.

---

## The measured problem

| Thing | Now | Comfortable for untrained staff |
|---|---|---|
| Sidebar items | **22** across 6 groups | ~6–8 visible for a normal user |
| Actions on one order page | **~24** buttons/menu items | 1 obvious primary + rest tucked away |
| Ways to "send an order out" | **4** (Buy APC Label, Mark as Fulfilled, Add tracking, Dispatch) | 1 |
| Separate discount systems | **3** (Promotions, Offers, Customer Discounts) | 1 entry point |
| Screens telling you *what to do next* | **0** | every work screen |

The last row is the whole problem. Everything below follows from it.

---

## Fix 1 — Tell the order what its next step is (biggest single win)

Right now the order page shows status badges (`PAID`, `CAPTURED`) and 24 controls, and the
staff member must *already know* that the normal sequence is:

> Buy APC Label → label prints → **Dispatch** (this is what emails the customer) → Fulfil

Nothing on screen says this. "Fulfil", "Ship", "Buy Label" and "Dispatch" all sound like
"send the order", and Dispatch isn't even on the order page — it's on a different screen.

**Proposal: a "Next step" bar at the top of every order, driven by the order's actual state,
with exactly one primary button.**

| Order state | Bar says | Primary button |
|---|---|---|
| Paid, no shipment | "Ready to pack. Print the picking list, then buy a label." | **Print picking list** |
| Paid, picked, no label | "Next: buy the shipping label." | **Buy shipping label** |
| Label bought, not dispatched | "Label ready. Print it, stick it on, then tell the customer it's on the way." | **Print label & notify customer** |
| Dispatched, not fulfilled | "On its way. Nothing to do unless there's a delivery problem." | *(none — shows tracking)* |
| Cancelled / refunded | "Cancelled on 3 Jul. Refund of £24.50 issued." | **Undo** (while in window) |

Everything else stays exactly where it is, behind **⚙️ Actions**. Nothing is removed — the
expert path is untouched, the beginner path becomes a single obvious button. This alone
removes most of the "which button do I press?" training.

**Also merge Dispatch into that flow.** "Buy label" and "notify customer" being on two
different screens is the most confusing thing in the admin. Bundle it: buying the label
offers "print + email customer now" as one action, with the separate Dispatch button kept
on the Shipments page for exceptions.

---

## Fix 2 — Make the front page a work queue, not a scoreboard

The dashboard leads with Products / Customers / Orders / Revenue. Those are numbers for
*you*, not tasks for *them*. A new staff member logs in and has no idea where to start.

We already added a "needs attention" row. Take it further: **make the queue the page.**

```
Today
┌─────────────────────────────────────────────┐
│  7 orders to pack            → Start packing│   ← primary, big
│  2 labels waiting to print   → Print all    │
│  1 delivery problem          → Review       │
│  0 returns to approve                       │
└─────────────────────────────────────────────┘
Business summary  (revenue, totals — collapsed below)
```

"Start packing" opens Orders pre-filtered to exactly the right list. Staff never have to
learn what a filter is. Revenue/stats move below the fold or behind a "Business" tab —
useful to the owner, noise to a packer.

---

## Fix 3 — Say it in English, not in database

Every one of these is currently shown to staff verbatim:

| On screen now | Should read |
|---|---|
| `LABEL_READY` | Label ready to print |
| `NO_SCAN_24H` | Not scanned in 24 hours |
| `IN_TRANSIT_LONG` | Taking longer than usual |
| `NEEDS_LABEL` | No label bought yet |
| `CAPTURED` | Paid |
| `PARTIAL_REFUND` | Partly refunded |
| `BOGOF` / `X_FOR_Y` / `X_FOR_FIXED_PRICE` | Buy one get one free / Buy 3 pay for 2 / 3 for £5 |
| `DROP_DOWN` | Dropdown list |
| Payment intent / charge / idempotency key | *(hide behind "Technical details")* |

This is a one-file label-map change (`statusLabel()` helper) applied at render time — no data
migration, no API change. It's the cheapest big win in this document. The database keeps its
enums; humans stop having to learn them.

Same for money and IDs: the order page prints `intentId`, `chargeId`, `refundId` and
`idempotencyKey` in the main payment panel. Ninety-nine percent of staff never need these —
collapse them into a "Technical details" toggle for when Stripe support asks.

---

## Fix 4 — One "Discounts" door instead of three

Promotions, Offers and Customer Discounts are three separate top-level sections with
overlapping purposes. Staff must already understand the taxonomy to pick the right one —
the Guide even has to explain the difference twice.

**Replace with one "Discounts" section and a chooser on create:**

> **What kind of discount?**
> - ○ A code the customer types in *(e.g. SUMMER10)* → Promotion
> - ○ Automatic deal at checkout *(buy 2 get 1 free, 3 for £5)* → Offer
> - ○ Standing discount for one customer *(trade account)* → Customer discount

Same three engines underneath, zero code changes to the pricing logic — just one entry point
and a question in plain English. The concept staff must learn drops from three to zero.

---

## Fix 5 — Show people only what their job needs

There are 22 nav items. A packer needs about five. Roles already exist (HEAD / STAFF /
VIEWER) but are used mainly to *hide* things for security, not to *simplify*.

- Default the sidebar to a **Simple view** — Orders, Shipments, Products, Customers, Discounts, Guide.
- Put Site Editing, Categories, Analytics, Delivery Rates, Media, Settings behind
  **"Show everything"** (one toggle, remembered per user).
- Rename remaining jargon: "Delivery Exceptions" → **"Delivery problems"**.

Nobody loses access to anything. The first screen just stops looking like a control panel.

---

## Fix 6 — Put the help where the decision is

The Guide page is genuinely good, but it's a manual — staff must remember it exists, leave
their task, find the right section, and come back. Manuals are what you read *during*
training, which is the thing we're trying to avoid.

Move the same content to where it's needed:

- **One-line hint under each page title.** "Orders — every order customers have placed. Open one to pack and ship it."
- **Hover help (`?`) on the words that cost the most confusion:** Fulfil, Dispatch, Archive, Void, Offer vs Promotion.
- **A 4-step "Pack your first order" walkthrough** on first login, dismissible, replayable from the Guide.
- Keep the Guide as the deep reference it already is, and link to the relevant section from each page.

---

## Fix 7 — Make mistakes cheap, so nobody needs permission to try

Half of training is really "don't break anything." If the UI is forgiving, staff explore and
teach themselves. Mostly done in the last pass (confirm dialogs, type-to-confirm on bulk
delete, toasts), remaining gaps:

- **Order detail shows both Archive and Unarchive at once** regardless of state — one of them is
  always wrong. Show only the applicable one (the list view already does this correctly).
- **Undo where possible, confirm where not.** Cancel already has a reversal window; surface it as
  an "Undo" toast right after the action instead of only as a banner.
- **Say what will happen, not what the thing is called.** "Dispatch" → "Email tracking to customer".
  "Void" → "Cancel this label with APC".

---

## Suggested order of work

1. **Plain-English label map** (Fix 3) — half a day, touches every screen, zero risk.
2. **Next-step bar on orders** (Fix 1) — the core of it; removes most order-flow training.
3. **Dashboard as work queue** (Fix 2) — makes "where do I start" answer itself.
4. **Archive/Unarchive + wording fixes** (Fix 7) — small, immediate.
5. **Simple view sidebar** (Fix 5).
6. **One Discounts door** (Fix 4).
7. **Inline help + first-run walkthrough** (Fix 6).

Items 1–4 are roughly a week and would, on their own, take this from "needs a training
session and a cheat sheet" to "a new starter can pack orders on day one."

---

## What deliberately does *not* change

- No capability is removed. Every current button survives, just relocated or renamed.
- No pricing, shipping or payment logic changes.
- The expert path stays fast — power users keep the menus and the bulk tools.
- Nothing here depends on the deferred visual restyle, though doing them together would be cheaper.
