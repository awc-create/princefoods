// src/app/checkout/CheckoutClient.tsx
'use client';

import { useCart, type CartLine } from '@/lib/cart-store';
import { penceToGBP } from '@/lib/money';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './checkout.module.scss';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

interface Addr {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
  phoneE164?: string;
}

type Delivery = 'standard' | 'express';

const DELIVERY_PRICE: Record<Delivery, number> = {
  standard: 399,
  express: 799
};

const LS_CONTACT_KEY = 'pf_checkout_contact';
const LS_ADDR_KEY = 'pf_checkout_addr';

function formatUKPostcode(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (s.length < 5) return s;
  const head = s.slice(0, -3);
  const tail = s.slice(-3);
  return `${head} ${tail}`;
}

export default function CheckoutClient({ email }: { email: string | null }) {
  const router = useRouter();
  const { data: session } = useSession();
  const cart = useCart();
  const { items, subtotal, clear, updateQty, remove } = cart;

  // Hydration-safe mount flag
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Admin role (show test buttons for HEAD/STAFF)
  const role = (session?.user as { role?: Role } | undefined)?.role;
  const isAdmin = mounted && (role === 'HEAD' || role === 'STAFF');

  // Cart helpers
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

  // Guest contact email (if no session)
  const [contactEmail, setContactEmail] = useState(email ?? '');
  const needEmail = useMemo(() => !email, [email]);

  // UX path
  const [mode, setMode] = useState<'guest' | 'login' | 'signup'>(needEmail ? 'guest' : 'guest');

  // Addresses
  const [shipping, setShipping] = useState<Addr>({
    firstName: '',
    lastName: '',
    line1: '',
    line2: '',
    city: '',
    postcode: '',
    country: 'GB'
  });
  const [billingSame, setBillingSame] = useState(true);
  const [billing, setBilling] = useState<Addr>({
    firstName: '',
    lastName: '',
    line1: '',
    line2: '',
    city: '',
    postcode: '',
    country: 'GB'
  });

  // Delivery / totals
  const [delivery, setDelivery] = useState<Delivery>('standard');
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Promo (UI only)
  const [promo, setPromo] = useState('');
  const promoAppliedRef = useRef<string | null>(null);

  // Totals — stay stable until mounted to avoid hydration mismatch
  const liveSubtotal = mounted ? subtotal() : 0;
  const shippingCost = DELIVERY_PRICE[delivery];
  const discount = 0;
  const tax = 0;
  const grand = liveSubtotal + shippingCost - discount + tax;

  // Validation
  const emailValid = useMemo(() => {
    if (!needEmail) return true;
    const trimmed = contactEmail.trim();
    return /^\S+@\S+\.\S+$/.test(trimmed) && trimmed.length <= 254;
  }, [needEmail, contactEmail]);

  const addressValid = (a: Addr) =>
    !!a.firstName.trim() &&
    !!a.lastName.trim() &&
    !!a.line1.trim() &&
    !!a.city.trim() &&
    !!a.postcode.trim() &&
    !!a.country.trim();

  const formValid =
    (mounted ? items.length > 0 : true) &&
    emailValid &&
    addressValid(shipping) &&
    (billingSame || addressValid(billing));

  // Prefill from localStorage (guests only)
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

  // Save to localStorage
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

  // ---------------------------
  // Helpers for server payloads
  // ---------------------------
  function makeOrderBody() {
    return {
      items: (mounted ? items : []).map((i: CartLine) => ({
        id: i.id,
        sku: i.sku ?? undefined,
        name: i.name,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        imageUrl: i.imageUrl ?? i.image ?? undefined,
        productId: i.productId ?? undefined
      })),
      shippingAddress: shipping,
      billingSameAsShipping: billingSame,
      billingAddress: billingSame ? undefined : billing,
      totals: {
        subtotal: liveSubtotal,
        shipping: shippingCost,
        discount,
        tax,
        grandTotal: grand
      },
      currency: 'GBP',
      contactEmail: needEmail ? contactEmail.trim() : email
    };
  }

  // ---------------------------
  // Stripe Checkout helper
  // ---------------------------
  async function payWithStripe(orderId: string) {
    const lines = (mounted ? items : []).map((it: CartLine) => ({
      name: it.name,
      unit_amount: Math.trunc(it.unitPrice), // pence
      quantity: it.quantity
    }));

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, lines })
    });
    const j = await res.json();

    if (!res.ok || !j?.url) {
      throw new Error(j?.error ?? 'Stripe init failed');
    }
    window.location.href = j.url as string;
  }

  // ---------------------------
  // Actions
  // ---------------------------

  // 1) Normal "Place order" (no Stripe)
  async function placeOrder() {
    setErr(null);
    if (!formValid) {
      setErr('Please complete the required fields.');
      return;
    }
    setPlacing(true);
    try {
      const res = await fetch('/api/checkout/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(makeOrderBody())
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Could not place order.');
      clear();
      router.replace(`/order-confirmation/${json.orderId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not place order.');
    } finally {
      setPlacing(false);
    }
  }

  // 2) Create order, then redirect to Stripe Checkout (test)
  async function placeOrderAndPayWithStripe() {
    setErr(null);
    if (!formValid) {
      setErr('Please complete the required fields.');
      return;
    }

    setPlacing(true);
    try {
      // 1) Create order
      const res = await fetch('/api/checkout/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(makeOrderBody())
      });
      const json = await res.json();
      if (!res.ok || !json?.orderId) throw new Error(json?.error ?? 'Could not place order.');

      // 2) Clear cart locally before redirect (optional)
      clear();

      // 3) Open Stripe Checkout
      await payWithStripe(json.orderId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start Stripe Checkout.');
    } finally {
      setPlacing(false);
    }
  }

  // 3) Admin-only test order (bypasses Stripe; writes paid test order)
  async function placeTestOrder() {
    setErr(null);
    if (!formValid) {
      setErr('Please complete the required fields.');
      return;
    }
    setPlacing(true);
    try {
      const res = await fetch('/api/checkout/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...makeOrderBody(),
          notes: 'Placed from checkout test button'
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Could not place test order.');
      clear();
      router.replace(`/order-confirmation/${json.orderId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not place test order.');
    } finally {
      setPlacing(false);
    }
  }

  const applyPromo = () => {
    promoAppliedRef.current = promo.trim().toUpperCase() || null;
  };

  return (
    <main className={styles.shell}>
      <div className={styles.headerRow}>
        <h1 className={styles.h1}>Checkout</h1>
        <Link href="/cart" className={styles.linkBack}>
          Back to cart
        </Link>
      </div>

      {!email && (
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
        <section className={styles.form} aria-label="Shipping and billing">
          {needEmail && (
            <>
              <h3 className={styles.h3}>Contact email</h3>
              <Field
                label="Email"
                value={contactEmail}
                type="email"
                onChange={setContactEmail}
                invalid={needEmail && !!contactEmail && !emailValid}
                hint={needEmail ? 'We’ll send your receipt and updates to this email.' : undefined}
              />
            </>
          )}

          <h3 className={styles.h3}>Shipping address</h3>
          <div className={styles.row2}>
            <Field
              label="First name"
              value={shipping.firstName}
              onChange={(v) => setShipping((s) => ({ ...s, firstName: v }))}
            />
            <Field
              label="Last name"
              value={shipping.lastName}
              onChange={(v) => setShipping((s) => ({ ...s, lastName: v }))}
            />
          </div>
          <Field
            label="Address line 1"
            value={shipping.line1}
            onChange={(v) => setShipping((s) => ({ ...s, line1: v }))}
          />
          <Field
            label="Address line 2"
            value={shipping.line2 ?? ''}
            onChange={(v) => setShipping((s) => ({ ...s, line2: v }))}
          />
          <div className={styles.row3}>
            <Field
              label="City"
              value={shipping.city}
              onChange={(v) => setShipping((s) => ({ ...s, city: v }))}
            />
            <Field
              label="Postcode"
              value={shipping.postcode}
              onChange={(v) => setShipping((s) => ({ ...s, postcode: v }))}
              onBlur={() => setShipping((s) => ({ ...s, postcode: formatUKPostcode(s.postcode) }))}
            />
            <Field
              label="Country"
              value={shipping.country}
              onChange={(v) => setShipping((s) => ({ ...s, country: v.toUpperCase() }))}
            />
          </div>

          {/* Delivery Method */}
          <div className={styles.deliveryWrap} role="group" aria-label="Delivery method">
            <span className={styles.deliveryLabel}>Delivery</span>
            <div className={styles.deliveryOptions}>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="delivery"
                  value="standard"
                  checked={delivery === 'standard'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    if (e.target.checked) setDelivery('standard');
                  }}
                />
                <span>Standard (2–4 days) — {penceToGBP(DELIVERY_PRICE.standard)}</span>
              </label>

              <label className={styles.radio}>
                <input
                  type="radio"
                  name="delivery"
                  value="express"
                  checked={delivery === 'express'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    if (e.target.checked) setDelivery('express');
                  }}
                />
                <span>Express (Next day) — {penceToGBP(DELIVERY_PRICE.express)}</span>
              </label>
            </div>
          </div>

          <div className={styles.chk}>
            <input
              id="same"
              type="checkbox"
              checked={billingSame}
              onChange={(e) => setBillingSame(e.target.checked)}
            />
            <label htmlFor="same">Billing address same as shipping</label>
          </div>

          {!billingSame && (
            <>
              <h3 className={styles.h3}>Billing address</h3>
              <div className={styles.row2}>
                <Field
                  label="First name"
                  value={billing.firstName}
                  onChange={(v) => setBilling((s) => ({ ...s, firstName: v }))}
                />
                <Field
                  label="Last name"
                  value={billing.lastName}
                  onChange={(v) => setBilling((s) => ({ ...s, lastName: v }))}
                />
              </div>
              <Field
                label="Address line 1"
                value={billing.line1}
                onChange={(v) => setBilling((s) => ({ ...s, line1: v }))}
              />
              <Field
                label="Address line 2"
                value={billing.line2 ?? ''}
                onChange={(v) => setBilling((s) => ({ ...s, line2: v }))}
              />
              <div className={styles.row3}>
                <Field
                  label="City"
                  value={billing.city}
                  onChange={(v) => setBilling((s) => ({ ...s, city: v }))}
                />
                <Field
                  label="Postcode"
                  value={billing.postcode}
                  onChange={(v) => setBilling((s) => ({ ...s, postcode: v }))}
                  onBlur={() =>
                    setBilling((s) => ({ ...s, postcode: formatUKPostcode(s.postcode) }))
                  }
                />
                <Field
                  label="Country"
                  value={billing.country}
                  onChange={(v) => setBilling((s) => ({ ...s, country: v.toUpperCase() }))}
                />
              </div>
            </>
          )}

          {err && (
            <p className={styles.err} role="alert" aria-live="polite">
              {err}
            </p>
          )}
        </section>

        <aside className={styles.summary} aria-label="Order summary">
          <h3 className={styles.h3}>Summary</h3>

          <ul className={styles.items}>
            {!mounted && <li className={styles.muted}>Loading cart…</li>}
            {mounted && items.length === 0 && <li className={styles.muted}>Your cart is empty.</li>}
            {mounted &&
              items.map((it) => (
                <li key={it.id} className={styles.itemRow}>
                  <div className={styles.itemLeft}>
                    <div className={styles.thumbWrap} aria-hidden>
                      <img
                        src={it.imageUrl ?? it.image ?? '/assets/prince-foods-logo.png'}
                        alt=""
                        className={styles.thumb}
                      />
                    </div>
                    <div className={styles.itemMeta}>
                      <span className={styles.itemName} title={it.name}>
                        {it.name}
                      </span>
                      <div className={styles.qtyControls} aria-label="Quantity controls">
                        <button
                          type="button"
                          onClick={() => (it.quantity > 1 ? decQty(it.id) : remove(it.id))}
                          className={styles.qtyBtn}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <input
                          className={styles.qtyInput}
                          inputMode="numeric"
                          value={it.quantity}
                          onChange={(e) => {
                            const v = Math.max(1, parseInt(e.target.value || '1', 10));
                            setQty(it.id, v);
                          }}
                          aria-label="Quantity"
                        />
                        <button
                          type="button"
                          onClick={() => incQty(it.id)}
                          className={styles.qtyBtn}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className={styles.itemPrice}>{penceToGBP(it.unitPrice * it.quantity)}</div>
                </li>
              ))}
          </ul>

          <div className={styles.promoRow}>
            <input
              className={styles.promoInput}
              placeholder="Promo code"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
            />
            <button
              type="button"
              className={styles.promoBtn}
              onClick={applyPromo}
              title="Coming soon"
            >
              Apply
            </button>
          </div>
          <p className={styles.promoHint}>Promos will be applied at payment step soon.</p>

          <div className={styles.row}>
            <span>Subtotal</span>
            <span>{penceToGBP(liveSubtotal)}</span>
          </div>
          <div className={styles.row}>
            <span>Shipping</span>
            <span>{penceToGBP(shippingCost)}</span>
          </div>
          <div className={styles.total}>
            <span>Total</span>
            <strong>{penceToGBP(grand)}</strong>
          </div>

          {/* Normal place order */}
          <button
            className={styles.place}
            disabled={placing || (mounted ? !formValid : true)}
            onClick={placeOrder}
            aria-disabled={placing || (mounted ? !formValid : true)}
          >
            {placing ? 'Placing…' : 'Place order'}
          </button>
          <p className={styles.muted}>
            You’ll be charged on the next step when a real PSP is connected.
          </p>

          {/* Admin-only: Stripe test checkout */}
          {isAdmin && (
            <button
              type="button"
              className={styles.testBtn}
              onClick={placeOrderAndPayWithStripe}
              disabled={placing || (mounted ? !formValid : true)}
              aria-disabled={placing || (mounted ? !formValid : true)}
              title="Creates the order, then redirects to Stripe Checkout (test)."
            >
              Pay with Stripe (test)
            </button>
          )}

          {/* Admin-only: bypass Stripe and write a captured payment */}
          {isAdmin && (
            <button
              type="button"
              className={styles.testBtn}
              onClick={placeTestOrder}
              disabled={placing || !formValid}
              aria-disabled={placing || !formValid}
              title="Admin-only: writes a paid test order directly."
              style={{ marginTop: 8 }}
            >
              Place Test Order (admin only)
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  invalid = false,
  hint,
  onBlur
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  invalid?: boolean;
  hint?: string;
  onBlur?: () => void;
}) {
  const id = useMemo(() => `f_${label.toLowerCase().replace(/\s+/g, '_')}`, [label]);
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        id={id}
        value={value}
        type={type}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={invalid || undefined}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}
