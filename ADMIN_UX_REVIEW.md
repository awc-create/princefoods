# Prince Foods B2C — Admin UX Review

> **Status update:** All P0 and P1 items below, plus the smaller P2 items (nav renames,
> error-handling gaps, dashboard action tiles, empty states), have been **implemented**.
> Deliberately deferred to a separate pass: the full visual restyle across all admin pages
> and mobile/card table layouts (P2 #1 and #6). Typecheck + lint pass clean.
> Bonus fix found during implementation: product **creation** was POSTing to `/api/products`
> (GET-only → 405); it now posts to `/api/admin/products` and sends the uploaded image.

Fine-tooth-comb pass over `src/app/admin` + `src/components/admin` (~28k lines). Focus: orders/shipments, products/catalog, offers/promotions. Items ordered by priority within each section, with file references.

---

## P0 — Quick wins (low risk, high daily-use payoff)

1. **Shipment "Void" has no confirmation** — it's destructive and fires immediately. Add a confirm dialog. `shipments/shipments-client.tsx:273`
2. **Shipments search navigates on every keystroke** — `pushParam('q', …)` calls `router.push` per character, spamming browser history and refetching each time. Debounce 300ms and use `router.replace`. `shipments-client.tsx:305`
3. **Orders/products search has no debounce** — a fetch per keystroke. Customers page already has the right 300ms pattern (`customers/page.tsx:33`) — copy it to `orders/page.tsx:165` and `products/page.tsx:392`.
4. **Shipment rows don't link to the order** — displayId is plain text; staff have to go find the order manually. Make it a link. `shipments-client.tsx:435`
5. **Sidebar "Overview" is highlighted on every page** — `isActivePath('/admin/orders', '/admin')` matches via `startsWith('/admin/')`. Special-case exact match for `/admin`. `layout.tsx:22`
6. **Sidebar group containing the current page can be collapsed** — e.g. land on Products with "Catalog" closed; the active item is invisible. Auto-expand the group matching `pathname`, and persist open/closed state to localStorage. `layout.tsx:56`
7. **Orders list never shows the total count** — `meta.total` is fetched but unused. Show "142 orders" next to the filters; ops people use this constantly. `orders/page.tsx:337`
8. **Dashboard stat cards aren't clickable** — Products/Customers/Orders/Revenue should link to their sections (Orders filtered to the same period). `admin/page.tsx`
9. **Dashboard shows zeros on API failure** — a failed stats call renders `0 / £0.00` with no error, which reads as "no sales today". Show an error state instead. `admin/page.tsx:54-62`
10. **Debug leftovers** — `console.log('🟡 [offers-client]…')` ×5 in `offers/offers-client.tsx`; dead file `components/admin/site/home/showcase/ShowcaseSectionsBuilder.old.tsx`; several debug `.zip` files in repo root.
11. **`orders/OrderActionsCell.tsx` appears to be dead code** — it's not imported anywhere and still uses `window.prompt()`. Delete it (or wire it up and modernise it).

---

## P1 — High-impact improvements

### Product edit page is far behind the create page (biggest catalog win)
`products/[id]/page.tsx` vs `products/create/page.tsx`:

- **Images:** edit has a single raw "Image URL" text input, no preview, no media-library picker. Create has a proper multi-image `ProductImageUpload`. Users editing a product (the common case) get the worst experience. Reuse the upload component on edit.
- **Categories:** edit has a category dropdown *plus* a free-text "Collection" field (dual taxonomy, easy to desync). Create uses `CategorySelector`. Unify.
- **Inventory is free text** ("e.g. In Stock") — typo-prone; make it a select (In Stock / Out of Stock) or a numeric quantity.
- **Option "Type" expects an enum typed by hand** (placeholder "e.g. DROP_DOWN") — make it a select.
- **Save kicks you back to the products list (page 1, filters lost) after 800ms.** Offer "Save" (stay) + "Save & close", and return to the previous list state.
- **No unsaved-changes warning** — Cancel/back silently discards edits on a long form.
- Also: create posts to `/api/products` while edit patches `/api/admin/products/:id` — worth consolidating.

### Persist list state in the URL (orders + products)
Orders and Products keep search/filters/page in `useState`, so opening an order and going back resets everything — painful mid-workflow. Shipments already does URL params correctly (`shipments-client.tsx`); apply the same pattern. Bonus: filtered views become shareable links.

### Replace `window.confirm` / `alert` with proper dialogs + toasts
40 usages across 20 files (orders, products, media, offers, promotions, staff, shipping…). One shared `<ConfirmDialog>` and a toast helper would modernise the whole admin in one sweep and let you show context (e.g. counts) in destructive confirmations.

### Orders list upgrades
- **Status/payment as colored badges** — the list shows raw `PAID` / `CAPTURED` text while the detail page already has a `Badge` component; extract and reuse it. `orders/page.tsx:284`
- **Date-range filter** — currently no way to see "orders this week" without paging.
- **Bulk actions** — select multiple orders → print packing slips / fulfil / archive. Products already has the select-all-matching pattern to copy.
- **Cancel-from-list hardcodes the reason** ("Cancelled from list view") with no input. `orders/page.tsx:488`

### Order detail
- **LIVE and TEST "Buy APC Label" buttons sit side by side** — a mis-click buys a real label (or a test one that confuses ops). Hide TEST behind an env flag or a dev-tools toggle. `orders/[id]/page.tsx:463-475`
- **No "back to orders" link or prev/next-order navigation** — combined with the lost filter state above, this makes working a queue tedious.
- Flags passed to CancelDialog via `window.__order_*` globals — fragile; pass as props. `orders/[id]/page.tsx:441`

### CSV import feedback
Import reports only "✅ Imported N rows, M skipped" — no indication of *which* rows failed or why, and no dry-run preview. Add a per-row error report (downloadable) and a "validate only" pass. `products/import/page.tsx`

### Offer creation + email blast coupling
If the blast fails after the offer is created, the user sees an error and will naturally retry — creating a **duplicate offer** and potentially double-emailing customers. Split "Send email" into an action available on an existing offer (retryable), and have create-with-blast reuse it. `offers/offers-client.tsx:297-324`

### Bulk delete "all matching" doesn't state the count
The confirm says "Delete ALL products that match your current filters?" even though `matchingCount` is often already loaded. Say "Delete 312 products?" — and consider a type-to-confirm for this one. `products/page.tsx:213`

---

## P2 — Structural / consistency

1. **Two visual worlds:** Shipments and Order detail are dark-glass themed with inline styles; Products, Exceptions, Offers are light SCSS modules; Orders list is unstyled inline CSS. A small shared kit (PageHeader, Table, Badge, Button, ConfirmDialog, Toast, EmptyState) would fix the inconsistency and shrink these 500–1000-line files.
2. **Navigation duplication/naming:**
   - "Change Password" exists as a HEAD-only sidebar item *and* a tab in Settings.
   - Sidebar "Shipping" (zones/rates) vs Settings→"Shipping" (APC credentials/sender) — same word, different things. Rename to "Delivery Rates" and "Carrier (APC) Settings".
3. **Error handling gaps:** orders list swallows failures (shows "No orders found"), product visibility toggle fails silently (`products/page.tsx:180`), exceptions resolve/recheck don't check `res.ok` (`orders/exceptions/page.tsx:210`). Standardise on the shipments-client pattern, which does this well.
4. **Dashboard as an action centre:** add "needs attention" tiles — unfulfilled paid orders, open exceptions (count already computed on that page), open returns, pending labels. Right now the dashboard tells you totals but not what to *do*.
5. **Empty states are bare text** ("No orders found") — add a hint + primary action (e.g. "Clear filters", "+ New offer").
6. **Mobile:** tables have fixed min-widths (orders 1180px) with page-level overflow; if staff ever use tablets/phones for packing, card layouts for orders/shipments would help.
7. **Media library actions** use `alert('Copied URL')` and raw confirms — toasts; and product edit should open it as a picker (ties into the P1 item).

---

## What's already good (keep these patterns)

- **Exceptions page** — severity ranking, auto-refresh, resolve-with-note writing to OrderActivity, scan-age pills. Best page in the admin.
- **Products list** — bulk bar, select-all-matching-across-pages, grouped collections filter.
- **Shipments** — URL-persisted filters, real error banners, per-row busy states.
- **Customers list** — debounced search (the reference implementation for the P0 fixes).
- **Guide page** existing at all is great for staff onboarding.

## Suggested order of attack

1. P0 batch (1–11) — roughly a day of changes, all low-risk.
2. Product edit page rebuild reusing create-page components.
3. URL state + badges + date filter on orders.
4. Shared ConfirmDialog/Toast sweep.
5. P2 structural items opportunistically as pages get touched.
