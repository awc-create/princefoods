# Prince Foods B2C — Customer Journey Audit

Walking the shopper's path through the code: finding a product → adding to basket →
paying → receiving it → getting help when something goes wrong.

**Summary:** the checkout *mechanics* are good — the money is handled correctly, the flow is
sensibly ordered, and several edge cases are already handled thoughtfully. Two problems will
cost real money and goodwill: **out-of-stock products can be bought**, and **a basket left for a
while can hit an unfixable error at payment**.

---

## HIGH — will generate refunds and complaints

### H1. 85 out-of-stock products are on sale right now

`products.csv` contains exactly two inventory values: `InStock` (312) and `OutOfStock` (85).

The product page parses that field with:

```ts
// app/product/[id]/page.tsx:39
function parseInventory(inv: string | null): number | null {
  if (!inv) return null;
  const n = Number(inv);                       // Number('OutOfStock') → NaN
  return Number.isFinite(n) ? Math.trunc(n) : null;   // → null
}
```

and the buy box decides:

```ts
// app/product/[id]/product-buy-box.tsx:112
const inStock = product.inventory == null ? true : product.inventory > 0;  // null → TRUE
```

So every one of those 85 products displays as available with a working **Add to Cart**. The
out-of-stock path only ever triggers if the field contains a literal number like `0`.

It compounds in two more places:

- **The shop grid shows no stock information at all.** `components/shop/ProductCard.tsx` renders
  price and discount only — no availability, so a customer browsing the category never sees it.
- **`place-order` performs no stock check.** There is no server-side guard, so even a corrected
  UI could be bypassed and the order would still be accepted.

Net effect: customers pay for groceries you don't have, then you refund, apologise and absorb
the support time.

> **My mistake, worth flagging:** in the admin refactor last session I turned the inventory field
> into a dropdown offering `In Stock` / `Out of Stock` — with spaces. Your data uses `InStock` /
> `OutOfStock` without. That would have introduced a *third* spelling. It needs fixing alongside
> this.

**Fix:** make inventory a real enum or integer rather than free text, teach `parseInventory` the
string forms (`OutOfStock`, `Out of Stock`, `0`), default unknown values to **out** of stock
rather than in, show availability on the product card, and add a stock check to `place-order`.

### H2. A basket left for a few days can dead-end at payment

The basket is a zustand store with `persist` (`lib/cart-store.ts`) — it keeps `unitPrice` in
localStorage indefinitely. Nothing ever re-syncs those prices against the database;
`refreshOffers()` only re-quotes discounts.

Meanwhile `place-order` correctly rejects price drift:

```
Price mismatch for "<product>": expected 299p, got 275p.
```

and `CheckoutClient.tsx:823` surfaces that string **verbatim** to the shopper via
`setErr(e.message)`.

So: customer adds items, you edit a price in the admin, customer returns a week later and tries
to pay. They get a message in pence and developer phrasing, with no button that fixes it. The
only escape is clearing the basket, which they have no reason to guess.

The server-side rejection is *right* — don't weaken it. The failure is that the client never
refreshes and the message is unusable.

**Fix:** re-fetch prices when the cart or checkout page mounts and quietly update the basket
(showing "the price of X has changed" where it differs); and translate the mismatch error into
plain English with an "Update basket and continue" action.

---

## MEDIUM

### M1. No way for a customer to report a problem or request a return

There is **no customer-facing returns API** — `find app/api -ipath "*return*"` outside
`/api/admin/` returns nothing. Every return, refund and reship is admin-initiated.

Your admin side for returns is genuinely good (return cases, decide/receive/reship/refund,
resolution notes). The customer just has no door into it. Someone whose frozen order arrives
thawed has to find the contact page or the Crisp chat bubble and hope.

For a food business where damaged and missing items are routine, a "Report a problem with this
order" button on the order page — creating the `ReturnCase` your admin already handles — would
cut support load and look far more professional.

### M2. Free orders get no confirmation email

The confirmation email is sent from the Stripe webhook (`app/api/stripe/webhook/route.ts:386`),
which is the correct place — after payment actually succeeds, and wrapped so a mail failure
can't break the webhook.

But `place-order` marks a zero-total order as paid outright:

```ts
status:        grandTotal <= 0 ? 'PAID' : 'PLACED',
paymentStatus: grandTotal <= 0 ? 'CAPTURED' : 'PENDING',
```

No Stripe session means no webhook, which means **no confirmation email**. Any 100%-off promotion
or fully-discounted order leaves the customer with nothing in their inbox.

### M3. Abandoned Stripe checkouts leave orders behind

`placeOrderAndPayWithStripe` creates the order *before* redirecting to Stripe. A customer who
closes the tab leaves a `PLACED` / `PENDING` order in the system. Your `STALE_ORDER` delivery
exception catches these eventually, so it's handled — but they clutter the orders list and
inflate counts. A scheduled cleanup that cancels unpaid `PLACED` orders after, say, 24 hours
would keep the list honest.

### M4. Missing email is silently replaced with a fake address

`place-order:341` falls back to `guest@prince-v.com` when no contact email is supplied. The
client does require a valid email (`emailValid` is part of `formValid`), so this only fires if
the UI is bypassed — but an order created that way can never be tracked (guest tracking matches
on email) and can never be emailed. Rejecting is safer than substituting.

---

## What's already good

Several things here are better than typical, and worth not breaking:

- **Money is handled correctly.** Prices are re-validated against the database at order time,
  negative amounts are rejected, totals are computed server-side, and Stripe is charged the DB
  grand total as a single line item.
- **The "Test Stripe" button is properly gated** to HEAD/STAFF (`isAdmin`) — customers never see it.
- **Order confirmation is sent after payment, not before**, and email failure doesn't fail the webhook.
- **Guest tracking is well designed** — needs order number *and* matching email, and returns an
  identical 404 for "no such order" and "wrong email" so order existence can't be probed.
- **Thoughtful small touches:** the delivery address is only saved to the account *after* the
  order succeeds; the guest email is cleared afterwards; and if Stripe fails to start *after* the
  order was created, the customer is given their order reference rather than a dead end.
- **Checkout is rate-limited** (20/hour/IP) — generous for real shoppers, awkward for scripts.

---

## Suggested order

1. **H1 — stock.** Highest customer impact, happening today across 85 products.
2. **H2 — cart price refresh + human error message.** Silent conversion killer.
3. **M1 — "Report a problem" button** wired to the existing `ReturnCase` flow.
4. **M2 — send confirmation for free orders** from `place-order`.
5. M3, M4 as cleanup.

1 and 2 are the ones affecting customers right now. Both are small changes — the stock fix is
mostly `parseInventory` plus a card badge plus a server guard; the cart fix is a refresh on mount
plus a friendlier error.

---

## Caveat

This is a static read of the code, not a click-through of the live site. I haven't assessed
visual design, mobile layout, page speed or accessibility — those need the real site in a
browser. Everything above is traceable to the files and lines cited.
