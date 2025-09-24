'use client';

import { useCart, type CartLine } from '@/lib/cart-store';
import { penceToGBP } from '@/lib/money';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './checkout.module.scss';

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
  const cart = useCart();
  const { items, subtotal, clear, updateQty, remove } = cart;

  // Helpers built on your cart API
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

  // Path chooser (visual only)
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

  // Promo (UI only for now)
  const [promo, setPromo] = useState('');
  const promoAppliedRef = useRef<string | null>(null);

  const shippingCost = DELIVERY_PRICE[delivery];
  const discount = 0;
  const tax = 0;
  const grand = subtotal() + shippingCost - discount + tax;

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
    items.length > 0 &&
    emailValid &&
    addressValid(shipping) &&
    (billingSame || addressValid(billing));

  // ---------- Prefill from localStorage (guests only) ----------
  useEffect(() => {
    if (email) return; // logged-in users don’t load guest cache
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
  }, [email]); // include email per lint rule

  // ---------- Save to localStorage (debounced-ish) ----------
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
  useEffect(scheduleSave, [contactEmail, shipping, billing, billingSame, email]); // include email per lint rule

  // ---------- Submit ----------
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
        body: JSON.stringify({
          items: items.map((i: CartLine) => ({
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
            subtotal: subtotal(),
            shipping: shippingCost,
            discount,
            tax,
            grandTotal: grand
          },
          currency: 'GBP',
          contactEmail: needEmail ? contactEmail.trim() : email
        })
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

          <div className={styles.deliveryWrap} role="group" aria-label="Delivery method">
            <span className={styles.deliveryLabel}>Delivery</span>
            <div className={styles.deliveryOptions}>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="delivery"
                  value="standard"
                  checked={delivery === 'standard'}
                  onChange={() => setDelivery('standard')}
                />
                <span>Standard (2–4 days) — {penceToGBP(DELIVERY_PRICE.standard)}</span>
              </label>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="delivery"
                  value="express"
                  checked={delivery === 'express'}
                  onChange={() => setDelivery('express')}
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

          {/* Items with thumbnails & inline qty */}
          <ul className={styles.items}>
            {items.length === 0 && <li className={styles.muted}>Your cart is empty.</li>}
            {items.map((it) => (
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

          {/* Promo code (UI only for now) */}
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
            <span>{penceToGBP(subtotal())}</span>
          </div>
          <div className={styles.row}>
            <span>Shipping</span>
            <span>{penceToGBP(shippingCost)}</span>
          </div>
          {discount > 0 && (
            <div className={styles.row}>
              <span>Discount</span>
              <span>-{penceToGBP(discount)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className={styles.row}>
              <span>Tax</span>
              <span>{penceToGBP(tax)}</span>
            </div>
          )}
          <div className={styles.total}>
            <span>Total</span>
            <strong>{penceToGBP(grand)}</strong>
          </div>

          <button
            className={styles.place}
            disabled={placing || !formValid}
            onClick={placeOrder}
            aria-disabled={placing || !formValid}
          >
            {placing ? 'Placing…' : 'Place order'}
          </button>
          <p className={styles.muted}>
            You’ll be charged on the next step when a real PSP is connected.
          </p>
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
