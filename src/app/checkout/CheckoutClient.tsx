// src/app/checkout/CheckoutClient.tsx
'use client';

import { useCart, type CartLine } from '@/lib/cart-store';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './checkout.module.scss';

// ✅ components
import AddressStep from '@/components/checkout/AddressStep';
import OrderSummary from '@/components/checkout/OrderSummary';
import PaymentStep from '@/components/checkout/PaymentStep';

import type { Addr, AddrTouched, Role, Step } from '@/components/checkout/types';
import { useUkPostcodeLookup } from '@/components/checkout/useUkPostcodeLookup';

interface PlaceOrderResponse {
  ok?: boolean;
  orderId?: string;
  displayId?: string;
  error?: string;
}

const LS_CONTACT_KEY = 'pf_checkout_contact';
const LS_ADDR_KEY = 'pf_checkout_addr';

/* =========================
   Phone helpers
   ========================= */
function digitsOnly(s: string) {
  return s.replace(/[^\d]/g, '');
}

// Keep it loose for checkout UX: accept +44..., or digits; validate 6–15 digits.
function normalizePhoneLoose(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const d = digitsOnly(t);
  if (d.length < 6 || d.length > 15) return '';
  return t.startsWith('+') ? t : d;
}

function normalizeTown(raw: string): string {
  return raw.trim();
}

function postcodeValidForCountry(
  country: string,
  postcode: string,
  formatUK: (s: string) => string
) {
  const cc = (country ?? '').trim().toUpperCase();
  const pc = postcode.trim();
  if (!pc) return false;

  if (cc === 'GB') {
    return formatUK(pc).length >= 6;
  }

  return pc.length >= 3;
}

// ✅ Royal Mail fallback merge: never overwrite typed values; ensure GB town + city never blank
function mergeTownCity(args: {
  country: string;
  typedTown: string;
  typedCity: string;
  lookup?: { town?: string | null; city?: string | null } | null;
}) {
  const cc = (args.country ?? '').toUpperCase();
  const typedTown = (args.typedTown ?? '').trim();
  const typedCity = (args.typedCity ?? '').trim();

  const lookupTown = (args.lookup?.town ?? '').trim();
  const lookupCity = (args.lookup?.city ?? '').trim();

  if (cc === 'GB') {
    const town = typedTown || lookupTown;
    const city = typedCity || lookupCity || town;
    return { town, city };
  }

  const town = typedTown || lookupTown;
  const city = typedCity || lookupCity || town;
  return { town, city };
}

interface SavedAddress {
  id: string;
  label: string;
  isDefault: boolean;
  kind: 'SHIPPING' | 'BILLING' | 'BOTH';
  firstName: string | null;
  lastName: string | null;
  line1: string;
  line2: string | null;
  town: string | null;
  city: string;
  postcode: string;
  country: string;
  phoneE164: string | null;
}

function addrToForm(a: SavedAddress): Addr {
  return {
    firstName: a.firstName ?? '',
    lastName: a.lastName ?? '',
    line1: a.line1 ?? '',
    line2: a.line2 ?? '',
    town: a.town ?? '',
    city: a.city ?? '',
    postcode: a.postcode ?? '',
    country: (a.country ?? 'GB').toUpperCase(),
    phoneE164: a.phoneE164 ?? ''
  };
}

interface ShippingQuoteOk {
  ok: true;
  currency: string;
  service: 'STANDARD' | 'EXPRESS';
  zone: { id: string; name: string };
  totals: { shippingPenceTotal: number };
}
interface ShippingQuoteErr {
  ok: false;
  error: string;
}

interface PromoSnapshot {
  promotionId: string | null;
  promotionCode: string | null;
  promoName: string | null;
  discountPence: number;
  shippingDiscountPence: number;
}

/* =========================
   ✅ Offers snapshot (FULL shape incl meta + eligible)
   ========================= */
interface LineDiscount {
  productId?: string | null;
  sku?: string | null;
  name: string;
  qty: number;
  amountPence: number;
  reason?: 'FREE' | 'DISCOUNT';
}

interface LineParticipant {
  productId?: string | null;
  sku?: string | null;
  name: string;
  qty: number;
  role?: 'BUY' | 'GET' | 'ELIGIBLE' | 'FREE';
}

interface OfferCard {
  offerId: string;
  name: string;
  kind: string;
  discountPence: number;
  meta?: {
    lineDiscounts?: LineDiscount[];
    lineParticipants?: LineParticipant[];
    groups?: number;
    freeCount?: number;
    samePool?: boolean;
  } | null;
}

interface OffersSnapshot {
  discountPence: number;
  applied: OfferCard[];
  eligible?: OfferCard[];
  autoAdd: {
    reasonOfferId: string;
    productId?: string | null;
    sku?: string | null;
    name: string;
    qty: number;
  }[];
}

const normNameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const normSkuKey = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ');

function itemKeyOf(x: { productId?: string | null; sku?: string | null; name: string }) {
  if (x.productId) return `pid:${x.productId}`;
  if (x.sku) return `sku:${normSkuKey(x.sku)}`;
  return `name:${normNameKey(x.name)}`;
}

export default function CheckoutClient({ email }: { email: string | null }) {
  const router = useRouter();

  const sp = useSearchParams();
  const searchParams = useMemo(() => sp ?? new URLSearchParams(), [sp]);

  const { data: session } = useSession();
  const cart = useCart();
  const { items, subtotal, clear, updateQty, remove } = cart;

  const { shipLookup, billLookup, lookupUKPostcode, reset, formatUKPostcode } =
    useUkPostcodeLookup();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const role = (session?.user as { role?: Role } | undefined)?.role;
  const isAdmin = mounted && (role === 'HEAD' || role === 'STAFF');
  const isLoggedIn = !!session?.user;

  const incQty = (id: string) => {
    const line = items.find((l) => l.id === id);
    if (!line) return;
    updateQty(id, line.quantity + 1);
  };
  const decQty = (id: string) => {
    const line = items.find((l) => l.id === id);
    if (!line) return;
    if (line.quantity <= 1) remove(id);
    else updateQty(id, line.quantity - 1);
  };
  const setQty = (id: string, qty: number) => updateQty(id, Math.max(1, qty));

  const sessionUserId = (session?.user as { id?: string } | null)?.id ?? null;
  const sessionEmail = (session?.user as { email?: string } | null)?.email ?? null;

  const [contactEmail, setContactEmail] = useState(email ?? '');
  const needEmail = useMemo(() => !email, [email]);

  const [mode, setMode] = useState<'guest' | 'login' | 'signup'>(needEmail ? 'guest' : 'guest');

  const stepParam = (searchParams.get('step') ?? 'address') as Step;
  const [step, setStep] = useState<Step>(stepParam === 'payment' ? 'payment' : 'address');

  useEffect(() => {
    const s = (searchParams.get('step') ?? 'address') as Step;
    setStep(s === 'payment' ? 'payment' : 'address');
  }, [searchParams]);

  const goStep = (next: Step) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('step', next);
    router.replace(`/checkout?${params.toString()}`);
  };

  const [shipping, setShipping] = useState<Addr>({
    firstName: '',
    lastName: '',
    line1: '',
    line2: '',
    town: '',
    city: '',
    postcode: '',
    country: 'GB',
    phoneE164: ''
  });

  const [billingSame, setBillingSame] = useState(true);

  const [billing, setBilling] = useState<Addr>({
    firstName: '',
    lastName: '',
    line1: '',
    line2: '',
    town: '',
    city: '',
    postcode: '',
    country: 'GB',
    phoneE164: ''
  });

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<string>('');
  const [selectedBillId, setSelectedBillId] = useState<string>('');

  const [saveToAccount, setSaveToAccount] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');

  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [shippingPence, setShippingPence] = useState<number>(0);
  const [shippingLabel, setShippingLabel] = useState<string>('');
  const [shippingErr, setShippingErr] = useState<string | null>(null);
  const shippingReqSeq = useRef(0);

  const [promo, setPromo] = useState('');
  const [promoSnap, setPromoSnap] = useState<PromoSnapshot>({
    promotionId: null,
    promotionCode: null,
    promoName: null,
    discountPence: 0,
    shippingDiscountPence: 0
  });

  const [offersSnap, setOffersSnap] = useState<OffersSnapshot>({
    discountPence: 0,
    applied: [],
    eligible: [],
    autoAdd: []
  });

  const promoCartKey = useMemo(() => {
    return items
      .map((i) => `${i.productId ?? ''}:${i.id}:${i.quantity}:${Math.trunc(i.unitPrice)}`)
      .join('|');
  }, [items]);

  useEffect(() => {
    setPromoSnap({
      promotionId: null,
      promotionCode: null,
      promoName: null,
      discountPence: 0,
      shippingDiscountPence: 0
    });
  }, [promoCartKey]);

  useEffect(() => {
    setOffersSnap({ discountPence: 0, applied: [], eligible: [], autoAdd: [] });
  }, [promoCartKey]);

  const liveSubtotal = mounted ? subtotal() : 0;
  const tax = 0;

  const promoDiscountTotal = Math.max(
    0,
    Math.trunc(promoSnap.discountPence) + Math.trunc(promoSnap.shippingDiscountPence)
  );

  const [touchedShipping, setTouchedShipping] = useState<AddrTouched>({});
  const [touchedBilling, setTouchedBilling] = useState<AddrTouched>({});
  const [touchedEmail, setTouchedEmail] = useState(false);

  const markTouchedShipping = (k: keyof Addr) => setTouchedShipping((t) => ({ ...t, [k]: true }));
  const markTouchedBilling = (k: keyof Addr) => setTouchedBilling((t) => ({ ...t, [k]: true }));

  const touchCourierRequired = () => {
    (
      ['firstName', 'lastName', 'line1', 'postcode', 'country', 'phoneE164', 'town'] as const
    ).forEach((k) => markTouchedShipping(k));

    if (!billingSame) {
      (
        ['firstName', 'lastName', 'line1', 'postcode', 'country', 'phoneE164', 'town'] as const
      ).forEach((k) => markTouchedBilling(k));
    }

    if (needEmail) setTouchedEmail(true);
  };

  const emailValid = useMemo(() => {
    if (!needEmail) return true;
    const trimmed = contactEmail.trim();
    return /^\S+@\S+\.\S+$/.test(trimmed) && trimmed.length <= 254;
  }, [needEmail, contactEmail]);

  const addressValid = (a: Addr) => {
    const cc = (a.country ?? '').trim().toUpperCase();
    const phoneOk = !!normalizePhoneLoose(a.phoneE164 ?? '');
    const townOk = cc !== 'GB' ? true : !!(a.town ?? '').trim();
    const pcOk = postcodeValidForCountry(cc, a.postcode, formatUKPostcode);

    return (
      !!a.firstName.trim() &&
      !!a.lastName.trim() &&
      !!a.line1.trim() &&
      pcOk &&
      !!cc &&
      phoneOk &&
      townOk
    );
  };

  const formValid =
    (mounted ? items.length > 0 : true) &&
    emailValid &&
    addressValid(shipping) &&
    (billingSame || addressValid(billing)) &&
    !shippingErr;

  useEffect(() => {
    if (email) return;
    try {
      const contactRaw = localStorage.getItem(LS_CONTACT_KEY);
      const addrRaw = localStorage.getItem(LS_ADDR_KEY);

      if (contactRaw) {
        const { contactEmail: savedEmail } = JSON.parse(contactRaw) as { contactEmail?: string };
        if (savedEmail) setContactEmail(savedEmail);
      }

      if (addrRaw) {
        const parsed = JSON.parse(addrRaw) as {
          shipping?: Addr;
          billing?: Addr;
          billingSame?: boolean;
        };
        if (parsed.shipping) setShipping(parsed.shipping);
        if (parsed.billing) setBilling(parsed.billing);
        if (typeof parsed.billingSame === 'boolean') setBillingSame(parsed.billingSame);
      }
    } catch {
      // ignore
    }
  }, [email]);

  const lsSaveTimer = useRef<number | null>(null);
  const scheduleSave = () => {
    if (lsSaveTimer.current) window.clearTimeout(lsSaveTimer.current);
    lsSaveTimer.current = window.setTimeout(() => {
      try {
        if (!email) {
          localStorage.setItem(LS_CONTACT_KEY, JSON.stringify({ contactEmail }));
        }
        localStorage.setItem(LS_ADDR_KEY, JSON.stringify({ shipping, billing, billingSame }));
      } catch {
        // ignore
      }
    }, 250);
  };
  useEffect(scheduleSave, [contactEmail, shipping, billing, billingSame, email]);

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/account/addresses', { cache: 'no-store' });
        const json = (await res.json()) as { ok: boolean; addresses: SavedAddress[] };

        if (!res.ok || !json.ok) return;

        const list = json.addresses ?? [];
        if (cancelled) return;

        setSavedAddresses(list);

        const defShip =
          list.find((a) => a.isDefault && (a.kind === 'SHIPPING' || a.kind === 'BOTH')) ??
          list.find((a) => a.kind === 'SHIPPING' || a.kind === 'BOTH');

        const defBill =
          list.find((a) => a.isDefault && (a.kind === 'BILLING' || a.kind === 'BOTH')) ??
          list.find((a) => a.kind === 'BILLING' || a.kind === 'BOTH');

        if (defShip) {
          setSelectedShipId(defShip.id);
          setShipping((s) => ({ ...s, ...addrToForm(defShip) }));
        }

        if (defBill && defBill.id !== defShip?.id) {
          setSelectedBillId(defBill.id);
          setBillingSame(false);
          setBilling((b) => ({ ...b, ...addrToForm(defBill) }));
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  const shippingPostcodeInvalid =
    !!touchedShipping.postcode &&
    !!shipping.postcode.trim() &&
    !postcodeValidForCountry(shipping.country, shipping.postcode, formatUKPostcode);

  const billingPostcodeInvalid =
    !!touchedBilling.postcode &&
    !!billing.postcode.trim() &&
    !postcodeValidForCountry(billing.country, billing.postcode, formatUKPostcode);

  const emailInvalid = needEmail && touchedEmail && !!contactEmail && !emailValid;

  const step1Valid =
    (mounted ? items.length > 0 : true) &&
    emailValid &&
    addressValid(shipping) &&
    (billingSame || addressValid(billing)) &&
    !shippingErr;

  const onShippingPostcodeBlur = (postcode: string, country: string) => {
    const cc = (country ?? '').toUpperCase();

    setShipping((s) => ({
      ...s,
      postcode: cc === 'GB' ? formatUKPostcode(s.postcode) : s.postcode.trim()
    }));

    if (cc !== 'GB') {
      reset('shipping');
      return;
    }

    void lookupUKPostcode(postcode, 'shipping', (patch) => {
      setShipping((s) => {
        const merged = mergeTownCity({
          country: s.country,
          typedTown: s.town ?? '',
          typedCity: s.city ?? '',
          lookup: patch
        });
        return { ...s, ...merged };
      });
    });
  };

  const onBillingPostcodeBlur = (postcode: string, country: string) => {
    const cc = (country ?? '').toUpperCase();

    setBilling((b) => ({
      ...b,
      postcode: cc === 'GB' ? formatUKPostcode(b.postcode) : b.postcode.trim()
    }));

    if (cc !== 'GB') {
      reset('billing');
      return;
    }

    void lookupUKPostcode(postcode, 'billing', (patch) => {
      setBilling((b) => {
        const merged = mergeTownCity({
          country: b.country,
          typedTown: b.town ?? '',
          typedCity: b.city ?? '',
          lookup: patch
        });
        return { ...b, ...merged };
      });
    });
  };

  function packAddress(a: Addr) {
    const cc = a.country.toUpperCase();
    const town = normalizeTown(a.town ?? '');

    const cityTyped = (a.city ?? '').trim();
    const city = cityTyped || town;

    return {
      firstName: a.firstName,
      lastName: a.lastName,
      line1: a.line1,
      line2: a.line2 ?? '',
      city,
      town: town || '',
      postcode: cc === 'GB' ? formatUKPostcode(a.postcode) : a.postcode.trim(),
      country: cc,
      phoneE164: normalizePhoneLoose(a.phoneE164 ?? '')
    };
  }

  useEffect(() => {
    if (!mounted) return;

    const country = (shipping.country ?? '').trim().toUpperCase();
    const postcode = (shipping.postcode ?? '').trim();

    if (!country || !postcode || items.length === 0) {
      setShippingPence(0);
      setShippingLabel('');
      setShippingErr(null);
      return;
    }

    const seq = ++shippingReqSeq.current;

    const timer = window.setTimeout(async () => {
      try {
        setShippingErr(null);

        const res = await fetch('/api/shipping/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country,
            postcode,
            currency: 'GBP',
            service: 'STANDARD',
            items: items.map((it: CartLine) => ({
              productId: it.productId ?? null,
              quantity: it.quantity,
              unitPricePence: Math.trunc(it.unitPrice)
            }))
          })
        });

        const json = (await res.json()) as ShippingQuoteOk | ShippingQuoteErr;

        if (seq !== shippingReqSeq.current) return;

        if (!res.ok || !json.ok) {
          setShippingPence(0);
          setShippingLabel('');
          setShippingErr((json as ShippingQuoteErr).error ?? 'Shipping unavailable.');
          return;
        }

        setShippingPence(json.totals.shippingPenceTotal);
        setShippingLabel(json.zone?.name ?? '');
        setShippingErr(null);
      } catch (e) {
        if (seq !== shippingReqSeq.current) return;
        setShippingPence(0);
        setShippingLabel('');
        setShippingErr(e instanceof Error ? e.message : 'Shipping unavailable.');
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [mounted, shipping.country, shipping.postcode, items, formatUKPostcode, reset]);

  async function refreshOffers() {
    if (!mounted) return;

    if (!items.length) {
      setOffersSnap({ discountPence: 0, applied: [], eligible: [], autoAdd: [] });
      return;
    }

    const res = await fetch('/api/offers/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lines: items.map((it: CartLine) => ({
          lineId: it.id,
          productId: it.productId ?? undefined,
          sku: it.sku ?? undefined,
          name: it.name,
          unitPricePence: Math.trunc(it.unitPrice),
          qty: Math.trunc(it.quantity),
          categoryId: (it as unknown as { categoryId?: string | null }).categoryId ?? undefined,
          tags: (it as unknown as { tags?: string[] | null }).tags ?? undefined,
          collection: (it as unknown as { collection?: string | null }).collection ?? undefined
        })),
        code: promo?.trim() ? promo.trim().toUpperCase() : null
      })
    });

    const json = (await res.json()) as {
      result?: {
        discountTotalPence?: number;
        applied?: OffersSnapshot['applied'];
        eligible?: OffersSnapshot['eligible'];
        autoAdd?: OffersSnapshot['autoAdd'];
      };
    };

    if (!res.ok || !json.result) {
      setOffersSnap({ discountPence: 0, applied: [], eligible: [], autoAdd: [] });
      return;
    }

    setOffersSnap({
      discountPence: Math.max(0, Math.trunc(json.result.discountTotalPence ?? 0)),
      applied: Array.isArray(json.result.applied) ? json.result.applied : [],
      eligible: Array.isArray(json.result.eligible) ? json.result.eligible : [],
      autoAdd: Array.isArray(json.result.autoAdd) ? json.result.autoAdd : []
    });
  }

  useEffect(() => {
    void refreshOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, promoCartKey, promo]);

  function makeOrderBody() {
    const ship = packAddress(shipping);
    const bill = billingSame ? undefined : packAddress(billing);

    const emailForOrder = needEmail ? contactEmail.trim() : (email ?? '');

    const promoPayload =
      promoSnap.promotionId && promoSnap.promotionCode
        ? { promotionId: promoSnap.promotionId, promotionCode: promoSnap.promotionCode }
        : {};

    return {
      items: (mounted ? items : []).map((i: CartLine) => ({
        id: i.id,
        sku: i.sku ?? undefined,
        name: i.name,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        imageUrl: i.imageUrl ?? (i as unknown as { image?: string | null }).image ?? undefined,
        productId: i.productId ?? undefined
      })),
      shippingAddress: ship,
      billingSameAsShipping: billingSame,
      billingAddress: bill,
      totals: {
        subtotal: liveSubtotal,
        shipping: shippingPence,
        discount: 0,
        tax: 0,
        grandTotal: 0
      },
      currency: 'GBP',
      contactEmail: emailForOrder,
      saveAddress: isLoggedIn ? saveToAccount : false,
      saveAddressLabel: isLoggedIn && saveToAccount ? saveLabel.trim() : '',
      saveAddressKind: 'SHIPPING' as const,
      ...promoPayload
    };
  }

  async function maybeSaveAddressToAccount() {
    if (!isLoggedIn) return;
    if (!saveToAccount) return;

    const label = saveLabel.trim();
    if (!label) return;

    const payload = {
      label,
      kind: billingSame ? 'SHIPPING' : 'BOTH',
      isDefault: false,
      address: packAddress(shipping),
      billing: billingSame ? undefined : packAddress(billing)
    };

    try {
      await fetch('/api/account/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {
      // ignore
    }
  }

  async function payWithStripe(orderId: string) {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });

    const j = (await res.json()) as { ok?: boolean; url?: string; error?: string };
    if (!res.ok || !j?.url) throw new Error(j?.error ?? 'Stripe init failed');

    window.location.href = j.url;
  }

  async function placeOrder() {
    setErr(null);

    touchCourierRequired();
    if (!formValid) {
      setErr(shippingErr ?? 'Please complete all required delivery details.');
      return;
    }

    setPlacing(true);
    try {
      await maybeSaveAddressToAccount();

      const res = await fetch('/api/checkout/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(makeOrderBody())
      });
      const json = (await res.json()) as PlaceOrderResponse;

      if (!res.ok || !json.orderId) throw new Error(json?.error ?? 'Could not place order.');

      clear();
      router.replace(
        `/order-confirmation/${json.orderId}?d=${encodeURIComponent(json.displayId ?? '')}`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not place order.');
    } finally {
      setPlacing(false);
    }
  }

  async function placeOrderAndPayWithStripe() {
    setErr(null);

    touchCourierRequired();
    if (!formValid) {
      setErr(shippingErr ?? 'Please complete all required delivery details.');
      return;
    }

    setPlacing(true);
    try {
      await maybeSaveAddressToAccount();

      const res = await fetch('/api/checkout/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(makeOrderBody())
      });
      const json = (await res.json()) as { orderId?: string; displayId?: string; error?: string };
      if (!res.ok || !json?.orderId) throw new Error(json?.error ?? 'Could not place order.');

      clear();
      await payWithStripe(json.orderId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start Stripe Checkout.');
    } finally {
      setPlacing(false);
    }
  }

  async function placeTestOrder() {
    setErr(null);

    touchCourierRequired();
    if (!formValid) {
      setErr(shippingErr ?? 'Please complete all required delivery details.');
      return;
    }

    setPlacing(true);
    try {
      await maybeSaveAddressToAccount();

      const res = await fetch('/api/checkout/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...makeOrderBody(), notes: 'Placed from checkout test button' })
      });
      const json = (await res.json()) as PlaceOrderResponse;

      if (!res.ok || !json.orderId) throw new Error(json?.error ?? 'Could not place test order.');

      clear();
      router.replace(
        `/order-confirmation/${json.orderId}?d=${encodeURIComponent(json.displayId ?? '')}`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not place test order.');
    } finally {
      setPlacing(false);
    }
  }

  const onSelectSavedShipping = (id: string) => {
    setSelectedShipId(id);
    const addr = savedAddresses.find((a) => a.id === id);
    if (!addr) return;

    setShipping((s) => ({ ...s, ...addrToForm(addr) }));

    if (addr.kind === 'BOTH' || addr.kind === 'BILLING') {
      setSelectedBillId(id);
      setBillingSame(false);
      setBilling((b) => ({ ...b, ...addrToForm(addr) }));
    }
  };

  const onSelectSavedBilling = (id: string) => {
    setSelectedBillId(id);
    const addr = savedAddresses.find((a) => a.id === id);
    if (!addr) return;

    setBillingSame(false);
    setBilling((b) => ({ ...b, ...addrToForm(addr) }));
  };

  const emailForPromo = needEmail ? contactEmail.trim() : (email ?? sessionEmail ?? '');
  const shippingKind: 'DRY' | 'FROZEN' | 'MIXED' = 'DRY';

  const promoRecheckKey = useMemo(() => {
    const c = (shipping.country ?? '').trim().toUpperCase();
    const p = (shipping.postcode ?? '').trim().toUpperCase();
    return [c, p, String(Math.trunc(shippingPence ?? 0)), shippingKind, 'GBP'].join('|');
  }, [shipping.country, shipping.postcode, shippingPence, shippingKind]);

  // ✅ BEST WINS totals (UI mirrors server)
  const offerDiscountTotal = Math.max(0, Math.trunc(offersSnap.discountPence));
  const offersHaveImpact = offerDiscountTotal > 0 || (offersSnap.autoAdd?.length ?? 0) > 0;
  const promoHaveImpact = promoDiscountTotal > 0;

  const useOffers =
    offersHaveImpact && (!promoHaveImpact || offerDiscountTotal > promoDiscountTotal);
  const discountShown = useOffers ? offerDiscountTotal : promoDiscountTotal;

  // ✅ compute value of free units (autoAdd) so we don't double-discount
  const offersFreeValuePence = useMemo(() => {
    if (!offersSnap?.autoAdd?.length) return 0;

    const priceByKey = new Map<string, number>();
    for (const it of items) {
      const k = itemKeyOf({ productId: it.productId ?? null, sku: it.sku ?? null, name: it.name });
      priceByKey.set(k, Math.max(0, Math.trunc(it.unitPrice)));
    }

    let total = 0;
    for (const a of offersSnap.autoAdd) {
      const k = itemKeyOf({ productId: a.productId ?? null, sku: a.sku ?? null, name: a.name });
      const unit = priceByKey.get(k) ?? 0;
      const qty = Math.max(0, Math.trunc(a.qty ?? 0));
      total += unit * qty;
    }

    return Math.max(0, Math.trunc(total));
  }, [offersSnap.autoAdd, items]);

  // ✅ When using offers, show a "was" subtotal including free value
  const subtotalShown = useOffers ? liveSubtotal + offersFreeValuePence : liveSubtotal;

  // ✅ Show discount effect in the UI grand total WITHOUT double-discounting
  const grand = subtotalShown + shippingPence - discountShown + tax;

  return (
    <main className={styles.shell}>
      <div className={styles.headerRow}>
        <h1 className={styles.h1}>Checkout</h1>
        <Link href="/cart" className={styles.linkBack}>
          Back to cart
        </Link>
      </div>

      <div className={styles.stepTabs} role="tablist" aria-label="Checkout steps">
        <button
          type="button"
          className={`${styles.stepTab} ${step === 'address' ? styles.stepActive : ''}`}
          onClick={() => goStep('address')}
          aria-selected={step === 'address'}
        >
          1. Address
        </button>
        <button
          type="button"
          className={`${styles.stepTab} ${step === 'payment' ? styles.stepActive : ''}`}
          onClick={() => {
            touchCourierRequired();
            if (step1Valid) goStep('payment');
            else
              setErr(
                shippingErr ?? 'Please complete all required delivery details before continuing.'
              );
          }}
          aria-selected={step === 'payment'}
        >
          2. Payment
        </button>
      </div>

      {!email && step === 'address' && (
        <section className={styles.modes} aria-label="Choose how to check out">
          <button
            className={`${styles.modeBtn} ${mode === 'guest' ? styles.modeActive : ''}`}
            onClick={() => setMode('guest')}
            type="button"
          >
            <span className={styles.modeTitle}>Continue as guest</span>
            <span className={styles.modeSub}>No account required</span>
          </button>

          <Link
            href="/?modal=login&callbackUrl=/checkout"
            className={`${styles.modeBtn} ${mode === 'login' ? styles.modeActive : ''}`}
            onClick={() => setMode('login')}
          >
            <span className={styles.modeTitle}>Log in</span>
            <span className={styles.modeSub}>Use your Prince Foods account</span>
          </Link>

          <Link
            href="/?modal=signup&callbackUrl=/checkout"
            className={`${styles.modeBtn} ${mode === 'signup' ? styles.modeActive : ''}`}
            onClick={() => setMode('signup')}
          >
            <span className={styles.modeTitle}>Create account</span>
            <span className={styles.modeSub}>Faster checkout next time</span>
          </Link>
        </section>
      )}

      <div className={styles.grid}>
        <section className={styles.form} aria-label="Checkout details">
          {step === 'address' && (
            <AddressStep
              needEmail={needEmail}
              contactEmail={contactEmail}
              setContactEmail={setContactEmail}
              touchedEmail={touchedEmail}
              setTouchedEmail={setTouchedEmail}
              emailInvalid={emailInvalid}
              shipping={shipping}
              setShipping={setShipping}
              billingSame={billingSame}
              setBillingSame={(v) => {
                setBillingSame(v);
                if (v) reset('billing');
              }}
              billing={billing}
              setBilling={setBilling}
              touchedShipping={touchedShipping}
              markTouchedShipping={markTouchedShipping}
              touchedBilling={touchedBilling}
              markTouchedBilling={markTouchedBilling}
              shippingPostcodeInvalid={shippingPostcodeInvalid}
              billingPostcodeInvalid={billingPostcodeInvalid}
              shipLookup={shipLookup}
              billLookup={billLookup}
              onShippingPostcodeBlur={onShippingPostcodeBlur}
              onBillingPostcodeBlur={onBillingPostcodeBlur}
              onContinue={() => {
                setErr(null);
                touchCourierRequired();
                if (!step1Valid) {
                  setErr(shippingErr ?? 'Please complete all required delivery details.');
                  return;
                }
                goStep('payment');
              }}
              step1Valid={step1Valid}
              err={err}
              isLoggedIn={isLoggedIn}
              savedAddresses={savedAddresses}
              selectedShipId={selectedShipId}
              onSelectSavedShipping={onSelectSavedShipping}
              selectedBillId={selectedBillId}
              onSelectSavedBilling={onSelectSavedBilling}
              saveToAccount={saveToAccount}
              setSaveToAccount={setSaveToAccount}
              saveLabel={saveLabel}
              setSaveLabel={setSaveLabel}
            />
          )}

          {step === 'payment' && (
            <PaymentStep
              delivery={'standard'}
              setDelivery={() => undefined}
              placing={placing}
              formValid={formValid}
              mounted={mounted}
              err={err ?? (shippingErr ? `Shipping: ${shippingErr}` : null)}
              onEditAddress={() => goStep('address')}
              onPlaceOrder={placeOrder}
              isAdmin={isAdmin}
              onPayWithStripe={placeOrderAndPayWithStripe}
              onPlaceTestOrder={placeTestOrder}
            />
          )}
        </section>

        <OrderSummary
          mounted={mounted}
          items={items}
          // ✅ pass the "was" subtotal when offers are used (prevents double-discount in UI)
          liveSubtotal={subtotalShown}
          shippingCost={shippingPence}
          grand={grand}
          onDecQty={decQty}
          onIncQty={incQty}
          onSetQty={setQty}
          onRemove={remove}
          promo={promo}
          setPromo={setPromo}
          userId={sessionUserId}
          email={emailForPromo}
          currency="GBP"
          shippingKind={shippingKind}
          recheckKey={promoRecheckKey}
          onPromoApplied={(v) => {
            setPromoSnap({
              promotionId: v.promotionId ?? null,
              promotionCode: v.promotionCode ?? null,
              promoName: v.promoName ?? null,
              discountPence: Math.max(0, Math.trunc(v.discountPence ?? 0)),
              shippingDiscountPence: Math.max(0, Math.trunc(v.shippingDiscountPence ?? 0))
            });
          }}
          offersSnap={offersSnap}
          useOffers={useOffers}
          offerDiscountTotal={offerDiscountTotal}
          promoDiscountTotal={promoDiscountTotal}
        />
      </div>

      <p className={styles.muted} style={{ marginTop: 12 }}>
        Shipping: {shippingLabel ? shippingLabel : '—'} • Total shown includes delivery.
      </p>
    </main>
  );
}
