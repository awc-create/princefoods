// src/components/checkout/AddressStep.tsx
'use client';

import styles from '@/app/checkout/checkout.module.scss';
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import Field from './Field';
import type { Addr, AddrTouched, LookupState } from './types';

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

interface Props {
  needEmail: boolean;
  contactEmail: string;
  setContactEmail: (v: string) => void;
  touchedEmail: boolean;
  setTouchedEmail: (v: boolean) => void;
  emailInvalid: boolean;

  shipping: Addr;
  setShipping: React.Dispatch<React.SetStateAction<Addr>>;
  billingSame: boolean;
  setBillingSame: (v: boolean) => void;
  billing: Addr;
  setBilling: React.Dispatch<React.SetStateAction<Addr>>;

  touchedShipping: AddrTouched;
  markTouchedShipping: (k: keyof Addr) => void;
  touchedBilling: AddrTouched;
  markTouchedBilling: (k: keyof Addr) => void;

  shippingPostcodeInvalid: boolean;
  billingPostcodeInvalid: boolean;

  shipLookup: LookupState;
  billLookup: LookupState;

  onShippingPostcodeBlur: (postcode: string, country: string) => void;
  onBillingPostcodeBlur: (postcode: string, country: string) => void;

  onContinue: () => void;
  step1Valid: boolean;
  err: string | null;

  // ✅ logged-in UX
  isLoggedIn: boolean;

  // ✅ saved address dropdowns
  savedAddresses: SavedAddress[];
  selectedShipId: string;
  onSelectSavedShipping: (id: string) => void;

  selectedBillId: string;
  onSelectSavedBilling: (id: string) => void;

  // ✅ save to account
  saveToAccount: boolean;
  setSaveToAccount: (v: boolean) => void;
  saveLabel: string;
  setSaveLabel: (v: string) => void;
}

export default function AddressStep({
  needEmail,
  contactEmail,
  setContactEmail,
  setTouchedEmail,
  emailInvalid,

  shipping,
  setShipping,
  billingSame,
  setBillingSame,
  billing,
  setBilling,

  touchedShipping,
  markTouchedShipping,
  touchedBilling,
  markTouchedBilling,

  shippingPostcodeInvalid,
  billingPostcodeInvalid,

  shipLookup,
  billLookup,

  onShippingPostcodeBlur,
  onBillingPostcodeBlur,

  onContinue,
  step1Valid,
  err,

  isLoggedIn,
  savedAddresses,
  selectedShipId,
  onSelectSavedShipping,
  selectedBillId,
  onSelectSavedBilling,

  saveToAccount,
  setSaveToAccount,
  saveLabel,
  setSaveLabel
}: Props) {
  // ✅ adds field-level invalid={...} for courier-required fields
  const shippingFirstNameInvalid = !!touchedShipping.firstName && !shipping.firstName.trim();
  const shippingLastNameInvalid = !!touchedShipping.lastName && !shipping.lastName.trim();
  const shippingLine1Invalid = !!touchedShipping.line1 && !shipping.line1.trim();
  const shippingPhoneInvalid = !!touchedShipping.phoneE164 && !(shipping.phoneE164 ?? '').trim();
  const shippingTownInvalid =
    shipping.country.toUpperCase() === 'GB' &&
    !!touchedShipping.town &&
    !(shipping.town ?? '').trim();
  const shippingCountryInvalid = !!touchedShipping.country && !shipping.country.trim();

  const billingFirstNameInvalid = !!touchedBilling.firstName && !billing.firstName.trim();
  const billingLastNameInvalid = !!touchedBilling.lastName && !billing.lastName.trim();
  const billingLine1Invalid = !!touchedBilling.line1 && !billing.line1.trim();
  const billingPhoneInvalid = !!touchedBilling.phoneE164 && !(billing.phoneE164 ?? '').trim();
  const billingTownInvalid =
    billing.country.toUpperCase() === 'GB' && !!touchedBilling.town && !(billing.town ?? '').trim();
  const billingCountryInvalid = !!touchedBilling.country && !billing.country.trim();

  const hasSaved = isLoggedIn && (savedAddresses?.length ?? 0) > 0;

  const shippingChoices = (savedAddresses ?? []).filter(
    (a) => a.kind === 'SHIPPING' || a.kind === 'BOTH'
  );
  const billingChoices = (savedAddresses ?? []).filter(
    (a) => a.kind === 'BILLING' || a.kind === 'BOTH'
  );

  return (
    <>
      {needEmail && (
        <>
          <h3 className={styles.h3}>Contact email</h3>
          <Field
            label="Email"
            value={contactEmail}
            type="email"
            onChange={setContactEmail}
            onBlur={() => setTouchedEmail(true)}
            invalid={emailInvalid}
            hint="We’ll send your receipt and updates to this email."
          />
        </>
      )}

      {/* ✅ Saved address selector (shipping) */}
      {hasSaved && shippingChoices.length > 0 && (
        <div className={styles.saveWrap} style={{ marginBottom: 12 }}>
          <div className={styles.formRow}>
            <label className={styles.label}>Select a saved shipping address</label>
            <select
              className={styles.select}
              value={selectedShipId}
              onChange={(e) => onSelectSavedShipping(e.target.value)}
            >
              <option value="">— Choose —</option>
              {shippingChoices.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                  {a.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
            <p className={styles.hint}>Pick one to auto-fill the form below.</p>
          </div>
        </div>
      )}

      <h3 className={styles.h3}>Shipping address</h3>

      <div className={styles.row2}>
        <Field
          label="First name"
          value={shipping.firstName}
          onChange={(v) => setShipping((s) => ({ ...s, firstName: v }))}
          onBlur={() => markTouchedShipping('firstName')}
          invalid={shippingFirstNameInvalid}
        />
        <Field
          label="Last name"
          value={shipping.lastName}
          onChange={(v) => setShipping((s) => ({ ...s, lastName: v }))}
          onBlur={() => markTouchedShipping('lastName')}
          invalid={shippingLastNameInvalid}
        />
      </div>

      <Field
        label="Phone / Mobile"
        value={shipping.phoneE164 ?? ''}
        onChange={(v) => setShipping((s) => ({ ...s, phoneE164: v }))}
        onBlur={() => {
          markTouchedShipping('phoneE164');
          setShipping((s) => ({ ...s, phoneE164: (s.phoneE164 ?? '').trim() }));
        }}
        inputMode="tel"
        invalid={shippingPhoneInvalid}
        hint="Required for APC delivery updates. Use +44... if possible."
      />

      <Field
        label="Address line 1"
        value={shipping.line1}
        onChange={(v) => setShipping((s) => ({ ...s, line1: v }))}
        onBlur={() => markTouchedShipping('line1')}
        invalid={shippingLine1Invalid}
      />

      <Field
        label="Address line 2"
        value={shipping.line2 ?? ''}
        onChange={(v) => setShipping((s) => ({ ...s, line2: v }))}
      />

      <div className={styles.row3}>
        <Field
          label="Town (Post Town)"
          value={shipping.town ?? ''}
          onChange={(v) => setShipping((s) => ({ ...s, town: v }))}
          onBlur={() => markTouchedShipping('town')}
          invalid={shippingTownInvalid}
          hint={shipping.country.toUpperCase() === 'GB' ? 'Required for UK addresses.' : undefined}
        />

        {/* ✅ Locality is HIDDEN (still filled via postcode lookup + packAddress fallback) */}

        <Field
          label="Postcode"
          value={shipping.postcode}
          onChange={(v) => setShipping((s) => ({ ...s, postcode: v }))}
          onBlur={() => {
            markTouchedShipping('postcode');
            onShippingPostcodeBlur(shipping.postcode, shipping.country);
          }}
          invalid={shippingPostcodeInvalid}
          hint={
            touchedShipping.postcode &&
            shipping.country.toUpperCase() === 'GB' &&
            shippingPostcodeInvalid
              ? 'Enter a valid UK postcode (e.g. SW1A 1AA).'
              : shipLookup.status !== 'idle'
                ? shipLookup.message
                : undefined
          }
        />
      </div>

      {/* ✅ separation above country */}
      <div className={styles.countrySpacer}>
        <Field
          label="Country"
          value={shipping.country}
          onChange={(v) => setShipping((s) => ({ ...s, country: v.toUpperCase() }))}
          onBlur={() => markTouchedShipping('country')}
          invalid={shippingCountryInvalid}
          hint="2-letter code, e.g. GB"
        />
      </div>

      {/* ✅ Save-to-account UI */}
      {isLoggedIn && (
        <div className={styles.saveWrap}>
          <div className={styles.chk}>
            <input
              id="saveaddr"
              type="checkbox"
              checked={saveToAccount}
              onChange={(e) => setSaveToAccount(e.target.checked)}
            />
            <label htmlFor="saveaddr">Save this address to my account</label>
          </div>

          {saveToAccount && (
            <Field
              label="Address name"
              value={saveLabel}
              onChange={setSaveLabel}
              hint="e.g. Bob’s house, Office, Warehouse"
            />
          )}
        </div>
      )}

      <div className={styles.chk}>
        <input
          id="same"
          type="checkbox"
          checked={billingSame}
          onChange={(e) => setBillingSame(e.target.checked)}
        />
        <label htmlFor="same">Billing address same as shipping</label>
      </div>

      <AnimatePresence initial={false}>
        {!billingSame && (
          <motion.div
            key="billing"
            className={styles.billingWrap}
            initial={{ height: 0, opacity: 0, y: -8, scale: 0.99, filter: 'blur(2px)' }}
            animate={{ height: 'auto', opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ height: 0, opacity: 0, y: -8, scale: 0.99, filter: 'blur(2px)' }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {/* ✅ Saved address selector (billing) */}
            {hasSaved && billingChoices.length > 0 && (
              <div className={styles.saveWrap} style={{ marginBottom: 12 }}>
                <div className={styles.formRow}>
                  <label className={styles.label}>Select a saved billing address</label>
                  <select
                    className={styles.select}
                    value={selectedBillId}
                    onChange={(e) => onSelectSavedBilling(e.target.value)}
                  >
                    <option value="">— Choose —</option>
                    {billingChoices.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                        {a.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className={styles.hint}>Pick one to auto-fill the billing form below.</p>
                </div>
              </div>
            )}

            <h3 className={styles.h3}>Billing address</h3>

            <div className={styles.row2}>
              <Field
                label="First name"
                value={billing.firstName}
                onChange={(v) => setBilling((s) => ({ ...s, firstName: v }))}
                onBlur={() => markTouchedBilling('firstName')}
                invalid={billingFirstNameInvalid}
              />
              <Field
                label="Last name"
                value={billing.lastName}
                onChange={(v) => setBilling((s) => ({ ...s, lastName: v }))}
                onBlur={() => markTouchedBilling('lastName')}
                invalid={billingLastNameInvalid}
              />
            </div>

            <Field
              label="Phone / Mobile"
              value={billing.phoneE164 ?? ''}
              onChange={(v) => setBilling((s) => ({ ...s, phoneE164: v }))}
              onBlur={() => markTouchedBilling('phoneE164')}
              inputMode="tel"
              invalid={billingPhoneInvalid}
            />

            <Field
              label="Address line 1"
              value={billing.line1}
              onChange={(v) => setBilling((s) => ({ ...s, line1: v }))}
              onBlur={() => markTouchedBilling('line1')}
              invalid={billingLine1Invalid}
            />

            <Field
              label="Address line 2"
              value={billing.line2 ?? ''}
              onChange={(v) => setBilling((s) => ({ ...s, line2: v }))}
            />

            <div className={styles.row3}>
              <Field
                label="Town (Post Town)"
                value={billing.town ?? ''}
                onChange={(v) => setBilling((s) => ({ ...s, town: v }))}
                onBlur={() => markTouchedBilling('town')}
                invalid={billingTownInvalid}
                hint={
                  billing.country.toUpperCase() === 'GB' ? 'Required for UK addresses.' : undefined
                }
              />

              {/* ✅ Locality is HIDDEN (still filled via postcode lookup + packAddress fallback) */}

              <Field
                label="Postcode"
                value={billing.postcode}
                onChange={(v) => setBilling((s) => ({ ...s, postcode: v }))}
                onBlur={() => {
                  markTouchedBilling('postcode');
                  onBillingPostcodeBlur(billing.postcode, billing.country);
                }}
                invalid={billingPostcodeInvalid}
                hint={
                  touchedBilling.postcode &&
                  billing.country.toUpperCase() === 'GB' &&
                  billingPostcodeInvalid
                    ? 'Enter a valid UK postcode (e.g. SW1A 1AA).'
                    : billLookup.status !== 'idle'
                      ? billLookup.message
                      : undefined
                }
              />
            </div>

            <Field
              label="Country"
              value={billing.country}
              onChange={(v) => setBilling((s) => ({ ...s, country: v.toUpperCase() }))}
              onBlur={() => markTouchedBilling('country')}
              invalid={billingCountryInvalid}
              hint="2-letter code, e.g. GB"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {err && (
        <p className={styles.err} role="alert" aria-live="polite">
          {err}
        </p>
      )}

      <div className={styles.stepActions}>
        <button
          type="button"
          className={styles.nextBtn}
          disabled={!step1Valid}
          onClick={onContinue}
        >
          Continue to payment
        </button>
      </div>
    </>
  );
}
