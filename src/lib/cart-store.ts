'use client';

import { create, type StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';

/* -------------------------------------------
   Types
------------------------------------------- */

export interface CartLine {
  id: string; // stable line id (sku or productId+variant)
  sku?: string | null;
  productId?: string | null;
  name: string;
  image?: string | null;
  imageUrl?: string;
  unitPrice: number; // pence

  // paid quantity (what customer selected)
  quantity: number;

  // derived from offers quote (auto-add freebies)
  freeQty?: number; // default 0
}

type OfferReason = 'FREE' | 'DISCOUNT';

interface OfferLineDiscount {
  productId?: string | null;
  sku?: string | null;
  name: string;
  qty: number;
  amountPence: number;
  reason?: OfferReason;
}

interface OfferLineParticipant {
  productId?: string | null;
  sku?: string | null;
  name: string;
  qty: number;
  role?: 'BUY' | 'GET' | 'ELIGIBLE' | 'FREE';
}

interface OfferAppliedCard {
  offerId: string;
  name: string;
  kind: string;
  discountPence: number;
  meta?: {
    lineDiscounts?: OfferLineDiscount[];
    lineParticipants?: OfferLineParticipant[];
    groups?: number;
    freeCount?: number;
    samePool?: boolean;
    bxgyLines?: {
      productId?: string | null;
      sku?: string | null;
      name: string;
      paidQty: number;
      groups: number;
      freeQty: number;
      totalQty: number;
      unitPricePence: number;
      discountPence: number;
    }[];
  } | null;
}

interface OffersSnapshot {
  discountPence: number;
  applied: OfferAppliedCard[];
  eligible?: OfferAppliedCard[]; // optional (some routes include it)
  autoAdd: {
    reasonOfferId: string;
    productId?: string | null;
    sku?: string | null;
    name: string;
    qty: number;
  }[];
}

interface OffersQuoteApiResp {
  result?: {
    discountTotalPence?: number;
    discountPence?: number;
    applied?: OffersSnapshot['applied'];
    eligible?: OffersSnapshot['eligible'];
    autoAdd?: OffersSnapshot['autoAdd'];
  };
}

export interface CartState {
  items: CartLine[];
  isOpen: boolean;

  open: () => void;
  close: () => void;
  toggle: () => void;

  add: (line: Omit<CartLine, 'quantity' | 'freeQty'> & { quantity?: number }) => void;
  updateQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;

  // derived helpers
  displayQty: (id: string) => number; // paid + free
  paidQty: (id: string) => number; // paid only
  freeQty: (id: string) => number; // free only
  offerNames: (id: string) => string[]; // ✅ per-line offer names (from participants/discounts/autoAdd)
  offerDiscountForLine: (id: string) => number; // ✅ per-line discount total (for Was/Now + "Offer applied")
  subtotal: () => number; // paid only
  count: () => number; // paid + free (matches UI)

  // offers sync
  offers: OffersSnapshot;
  refreshOffers: () => Promise<void>;
}

/* -------------------------------------------
   Helpers
------------------------------------------- */

const normStr = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

const normSku = (v: unknown): string | null => {
  const s = normStr(v);
  if (!s) return null;
  return s.replace(/\s+/g, ' ');
};

const normProductId = (v: unknown): string | null => {
  const s = normStr(v);
  if (!s) return null;
  return s;
};

const normName = (v: unknown) => normStr(v).replace(/\s+/g, ' ');

function safeInt(n: unknown, fallback = 0) {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : fallback;
}

// Stable line id (CRITICAL for merging)
function buildLineId(input: {
  sku?: string | null;
  productId?: string | null;
  name: string;
  unitPrice: number;
}) {
  const sku = normSku(input.sku);
  if (sku) return `sku:${sku}`;

  const pid = normProductId(input.productId);
  if (pid) return `pid:${pid}`;

  const nm = normName(input.name).toLowerCase();
  const price = Math.max(0, Math.trunc(input.unitPrice));
  return `name:${nm}|p:${price}`;
}

function normaliseLine(raw: Partial<CartLine>): CartLine | null {
  const name = normName(raw.name ?? '');
  const unitPrice = Math.max(0, Math.trunc(Number(raw.unitPrice ?? 0)));
  const quantity = Math.max(1, Math.trunc(Number(raw.quantity ?? 1)));
  const freeQty = Math.max(0, Math.trunc(Number(raw.freeQty ?? 0)));

  if (!name) return null;

  const sku = normSku(raw.sku);
  const productId = normProductId(raw.productId);

  const id = normStr(raw.id) || buildLineId({ sku, productId, name, unitPrice });

  return {
    id,
    sku,
    productId,
    name,
    image: (raw.image ?? null) as string | null,
    imageUrl: (raw.imageUrl ?? undefined) as string | undefined,
    unitPrice,
    quantity,
    freeQty
  };
}

function mergeDuplicateLines(lines: CartLine[]) {
  const map = new Map<string, CartLine>();

  for (const l of lines) {
    const prev = map.get(l.id);
    if (!prev) {
      map.set(l.id, { ...l, freeQty: Math.max(0, Math.trunc(l.freeQty ?? 0)) });
      continue;
    }

    prev.quantity += l.quantity;
    prev.freeQty = (prev.freeQty ?? 0) + (l.freeQty ?? 0);

    if (!prev.sku && l.sku) prev.sku = l.sku;
    if (!prev.productId && l.productId) prev.productId = l.productId;
    if (!prev.image && l.image) prev.image = l.image;
    if (!prev.imageUrl && l.imageUrl) prev.imageUrl = l.imageUrl;
  }

  return Array.from(map.values());
}

const normNameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const normSkuKey = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ');

function itemKeyOf(x: { productId?: string | null; sku?: string | null; name: string }) {
  if (x.productId) return `pid:${x.productId}`;
  if (x.sku) return `sku:${normSkuKey(x.sku)}`;
  return `name:${normNameKey(x.name)}`;
}

async function fetchOffersQuote(
  lines: Array<{
    productId?: string | null;
    sku?: string | null;
    name: string;
    unitPricePence: number;
    qty: number;
  }>
) {
  const res = await fetch('/api/offers/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lines })
  });

  const json = (await res.json()) as OffersQuoteApiResp;

  if (!res.ok || !json?.result) {
    return { discountPence: 0, applied: [], eligible: [], autoAdd: [] } satisfies OffersSnapshot;
  }

  const applied = Array.isArray(json.result.applied) ? json.result.applied : [];
  const eligible = Array.isArray(json.result.eligible) ? json.result.eligible : [];
  const autoAdd = Array.isArray(json.result.autoAdd) ? json.result.autoAdd : [];

  const discount =
    Math.max(0, Math.trunc(json.result.discountTotalPence ?? 0)) ||
    Math.max(0, Math.trunc(json.result.discountPence ?? 0)) ||
    applied.reduce((s, a) => s + Math.max(0, safeInt(a.discountPence, 0)), 0);

  return {
    discountPence: discount,
    applied,
    eligible,
    autoAdd
  } satisfies OffersSnapshot;
}

/* -------------------------------------------
   Store
------------------------------------------- */

const creator: StateCreator<CartState> = (set, get) => ({
  items: [],
  isOpen: false,

  offers: { discountPence: 0, applied: [], eligible: [], autoAdd: [] },

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen }),

  add: (line) => {
    set((s) => {
      const qty = Math.max(1, Math.trunc(line.quantity ?? 1));
      const normalised = normaliseLine({ ...line, quantity: qty, freeQty: 0 });

      if (!normalised) return { ...s };

      const idx = s.items.findIndex((i) => i.id === normalised.id);

      if (idx >= 0) {
        const next = [...s.items];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };

        if (!next[idx].sku && normalised.sku) next[idx].sku = normalised.sku;
        if (!next[idx].productId && normalised.productId)
          next[idx].productId = normalised.productId;
        if (!next[idx].image && normalised.image) next[idx].image = normalised.image;
        if (!next[idx].imageUrl && normalised.imageUrl) next[idx].imageUrl = normalised.imageUrl;

        next[idx].freeQty = next[idx].freeQty ?? 0;

        return { items: next, isOpen: true };
      }

      return { items: [...s.items, normalised], isOpen: true };
    });

    void get().refreshOffers();
  },

  updateQty: (id, qty) => {
    set((s) => {
      const next = s.items
        .map((i) =>
          i.id === id
            ? ({
                ...i,
                quantity: Math.max(1, Math.trunc(qty)),
                freeQty: i.freeQty ?? 0
              } as CartLine)
            : i
        )
        .filter((i) => i.quantity > 0);
      return { items: next };
    });

    void get().refreshOffers();
  },

  remove: (id) => {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    void get().refreshOffers();
  },

  clear: () =>
    set({ items: [], offers: { discountPence: 0, applied: [], eligible: [], autoAdd: [] } }),

  paidQty: (id) => {
    const it = get().items.find((x) => x.id === id);
    return it ? Math.max(1, Math.trunc(it.quantity)) : 0;
  },

  freeQty: (id) => {
    const it = get().items.find((x) => x.id === id);
    return it ? Math.max(0, Math.trunc(it.freeQty ?? 0)) : 0;
  },

  displayQty: (id) => {
    const it = get().items.find((x) => x.id === id);
    if (!it) return 0;
    return Math.max(1, Math.trunc(it.quantity)) + Math.max(0, Math.trunc(it.freeQty ?? 0));
  },

  // ✅ Offer names for THIS item (participants/discounts/autoAdd -> applied/eligible)
  offerNames: (id) => {
    const state = get();
    const it = state.items.find((x) => x.id === id);
    if (!it) return [];

    const key = itemKeyOf({
      productId: it.productId ?? null,
      sku: it.sku ?? null,
      name: it.name
    });

    const pool = [
      ...(Array.isArray(state.offers.applied) ? state.offers.applied : []),
      ...(Array.isArray(state.offers.eligible) ? state.offers.eligible! : [])
    ];

    // de-dupe offers by offerId
    const seen = new Set<string>();
    const offers = pool.filter((o) => {
      const oid = String(o.offerId ?? '').trim();
      if (!oid) return false;
      if (seen.has(oid)) return false;
      seen.add(oid);
      return true;
    });

    const names: string[] = [];

    for (const o of offers) {
      const offerName = String(o.name ?? '').trim();
      if (!offerName) continue;

      // 1) participants
      const parts = o.meta?.lineParticipants ?? [];
      for (const p of parts) {
        const k = itemKeyOf({ productId: p.productId ?? null, sku: p.sku ?? null, name: p.name });
        if (k === key) {
          names.push(offerName);
          break;
        }
      }

      // 2) discounts
      if (!names.includes(offerName)) {
        const dsc = o.meta?.lineDiscounts ?? [];
        for (const d of dsc) {
          const k = itemKeyOf({ productId: d.productId ?? null, sku: d.sku ?? null, name: d.name });
          if (k === key) {
            names.push(offerName);
            break;
          }
        }
      }

      // 3) autoAdd (matches this item + this offer)
      if (!names.includes(offerName)) {
        for (const aa of state.offers.autoAdd ?? []) {
          const aaKey = itemKeyOf({
            productId: aa.productId ?? null,
            sku: aa.sku ?? null,
            name: aa.name
          });

          if (aaKey !== key) continue;
          if (String(aa.reasonOfferId) !== String(o.offerId)) continue;

          names.push(offerName);
          break;
        }
      }
    }

    return Array.from(new Set(names.map((x) => x.trim()).filter(Boolean)));
  },

  // ✅ per-line discount total (from applied meta.lineDiscounts)
  offerDiscountForLine: (id) => {
    const state = get();
    const it = state.items.find((x) => x.id === id);
    if (!it) return 0;

    const key = itemKeyOf({
      productId: it.productId ?? null,
      sku: it.sku ?? null,
      name: it.name
    });

    const applied = Array.isArray(state.offers.applied) ? state.offers.applied : [];

    let total = 0;

    for (const a of applied) {
      const lineDiscounts = a.meta?.lineDiscounts ?? [];
      for (const d of lineDiscounts) {
        const dk = itemKeyOf({
          productId: d.productId ?? null,
          sku: d.sku ?? null,
          name: d.name
        });

        if (dk !== key) continue;
        total += Math.max(0, safeInt(d.amountPence, 0));
      }
    }

    return Math.max(0, total);
  },

  // subtotal should be PAID only (correct money)
  subtotal: () =>
    get().items.reduce((sum, i) => sum + i.unitPrice * Math.max(1, Math.trunc(i.quantity)), 0),

  // basket count should match what customer SEES (paid + free)
  count: () =>
    get().items.reduce((n, i) => {
      const paid = Math.max(1, Math.trunc(i.quantity));
      const free = Math.max(0, Math.trunc(i.freeQty ?? 0));
      return n + paid + free;
    }, 0),

  refreshOffers: async () => {
    const snapshot = get().items;

    if (!snapshot.length) {
      set({ offers: { discountPence: 0, applied: [], eligible: [], autoAdd: [] } });
      return;
    }

    const quoteLines = snapshot.map((it) => ({
      productId: it.productId ?? null,
      sku: it.sku ?? null,
      name: it.name,
      unitPricePence: Math.max(0, Math.trunc(it.unitPrice)),
      qty: Math.max(1, Math.trunc(it.quantity)) // IMPORTANT: PAID QTY ONLY
    }));

    let snap: OffersSnapshot;
    try {
      snap = await fetchOffersQuote(quoteLines);
    } catch {
      snap = { discountPence: 0, applied: [], eligible: [], autoAdd: [] };
    }

    // Build freeQty map from autoAdd results
    const freeMap = new Map<string, number>();
    for (const a of snap.autoAdd ?? []) {
      const k = itemKeyOf({ productId: a.productId ?? null, sku: a.sku ?? null, name: a.name });
      freeMap.set(k, (freeMap.get(k) ?? 0) + Math.max(0, Math.trunc(a.qty ?? 0)));
    }

    // Apply freeQty onto current items (match by productId/sku/name)
    set((s) => ({
      offers: snap,
      items: s.items.map((it) => {
        const k = itemKeyOf({
          productId: it.productId ?? null,
          sku: it.sku ?? null,
          name: it.name
        });
        const freeQty = freeMap.get(k) ?? 0;
        return { ...it, freeQty };
      })
    }));
  }
});

export const useCart = create<CartState>()(
  persist(creator, {
    name: 'pf-cart-v1',
    version: 4,

    migrate: (persisted, _version) => {
      const state = persisted as Partial<CartState> | undefined;

      if (!state || typeof state !== 'object') {
        return {
          items: [],
          isOpen: false,
          offers: { discountPence: 0, applied: [], eligible: [], autoAdd: [] }
        };
      }

      const rawItems = Array.isArray(state.items) ? state.items : [];
      const fixed = rawItems
        .map((x) => normaliseLine(x as Partial<CartLine>))
        .filter((x): x is CartLine => Boolean(x));

      const merged = mergeDuplicateLines(fixed).map((x) => ({
        ...x,
        freeQty: Math.max(0, Math.trunc(x.freeQty ?? 0))
      }));

      return {
        items: merged,
        isOpen: Boolean(state.isOpen),
        offers: { discountPence: 0, applied: [], eligible: [], autoAdd: [] }
      };
    }
  })
);
