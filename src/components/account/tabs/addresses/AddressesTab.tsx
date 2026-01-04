// src/components/account/tabs/addresses/AddressesTab.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import styles from './AddressesTab.module.scss';

type AddressKind = 'SHIPPING' | 'BILLING' | 'BOTH';

export interface AddressDTO {
  id: string;
  label: string;
  isDefault: boolean;
  kind: AddressKind;

  firstName: string | null;
  lastName: string | null;
  line1: string;
  line2: string | null;
  town: string | null;
  city: string;
  postcode: string;
  country: string;
  phoneE164: string | null;

  createdAt: string;
  updatedAt: string;
}

interface ApiList {
  ok?: boolean;
  addresses?: AddressDTO[];
  error?: string;
}
interface ApiOne {
  ok?: boolean;
  address?: AddressDTO;
  error?: string;
}

interface FormState {
  kind: AddressKind;
  country: string;

  firstName: string;
  lastName: string;

  label: string;
  line1: string;
  line2: string;

  town: string;
  city: string;
  postcode: string;

  phoneE164: string;
  isDefault: boolean;
}

const EMPTY_FORM: FormState = {
  kind: 'SHIPPING',
  country: 'GB',

  firstName: '',
  lastName: '',

  label: '',
  line1: '',
  line2: '',

  town: '',
  city: '',
  postcode: '',

  phoneE164: '',
  isDefault: false
};

// ✅ UI-only UK postcode check (warn only, don’t block)
const UK_POSTCODE =
  /^(GIR\s?0AA|(?:(?:[A-Z]{1,2}\d{1,2})|(?:[A-Z]{1,2}\d[A-Z])|(?:[A-Z]{1}\d[A-Z])|(?:[A-Z]{2}\d[A-Z]))\s?\d[A-Z]{2})$/i;

// ✅ Simple ISO2 dropdown list (extend as needed)
const COUNTRY_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'GB', label: 'United Kingdom (GB)' },
  { code: 'IE', label: 'Ireland (IE)' },
  { code: 'US', label: 'United States (US)' },
  { code: 'CA', label: 'Canada (CA)' },
  { code: 'AU', label: 'Australia (AU)' },
  { code: 'NZ', label: 'New Zealand (NZ)' },
  { code: 'FR', label: 'France (FR)' },
  { code: 'DE', label: 'Germany (DE)' },
  { code: 'NL', label: 'Netherlands (NL)' },
  { code: 'BE', label: 'Belgium (BE)' },
  { code: 'ES', label: 'Spain (ES)' },
  { code: 'IT', label: 'Italy (IT)' },
  { code: 'SE', label: 'Sweden (SE)' },
  { code: 'NO', label: 'Norway (NO)' },
  { code: 'DK', label: 'Denmark (DK)' },
  { code: 'CH', label: 'Switzerland (CH)' },
  { code: 'AE', label: 'United Arab Emirates (AE)' },
  { code: 'IN', label: 'India (IN)' },
  { code: 'LK', label: 'Sri Lanka (LK)' }
];

function normalizeCountryInput(v: string) {
  const t = (v ?? '').trim().toUpperCase();
  if (!t) return 'GB';
  if (t === 'UK' || t === 'U.K.') return 'GB';
  if (t === 'UNITED KINGDOM' || t === 'GREAT BRITAIN') return 'GB';
  const letters = t.replace(/[^A-Z]/g, '');
  return letters.slice(0, 2) || 'GB';
}

function isNonEmpty(v: string) {
  return v.trim().length > 0;
}

function formatKind(kind: AddressKind) {
  if (kind === 'SHIPPING') return 'Delivery';
  if (kind === 'BILLING') return 'Billing';
  return 'Delivery + Billing';
}

function buildPayload(f: FormState) {
  const country = normalizeCountryInput(f.country);
  return {
    kind: f.kind,
    country,

    firstName: f.firstName.trim() || null,
    lastName: f.lastName.trim() || null,

    label: f.label.trim(),
    line1: f.line1.trim(),
    line2: f.line2.trim() || null,

    town: f.town.trim() || null,
    city: f.city.trim(),
    postcode: f.postcode.trim(),

    phoneE164: f.phoneE164.trim() || null,
    isDefault: Boolean(f.isDefault)
  };
}

function newIdempotencyKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export default function AddressesTab() {
  const [list, setList] = useState<AddressDTO[] | null>(null);
  const [busy, startTransition] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ Idempotency key for create attempts (stable across retries until success/close)
  const createKeyRef = useRef<string | null>(null);

  // Load once
  useEffect(() => {
    if (list !== null) return;

    (async () => {
      try {
        const res = await fetch('/api/account/addresses', { cache: 'no-store' });
        const json = (await res.json()) as ApiList;
        setList(json.addresses ?? []);
      } catch {
        setList([]);
      }
    })();
  }, [list]);

  const grouped = useMemo(() => {
    const all = list ?? [];
    const shipping = all.filter((a) => a.kind === 'SHIPPING' || a.kind === 'BOTH');
    const billing = all.filter((a) => a.kind === 'BILLING' || a.kind === 'BOTH');
    return { all, shipping, billing };
  }, [list]);

  const postcodeWarning = useMemo(() => {
    const country = normalizeCountryInput(form.country);
    const pc = form.postcode.trim();
    if (country !== 'GB') return null;
    if (!pc) return null;
    if (UK_POSTCODE.test(pc)) return null;
    return 'This doesn’t look like a UK postcode (we’ll still allow saving).';
  }, [form.country, form.postcode]);

  function resetMessages() {
    setErr(null);
    setMsg(null);
  }

  function openCreate() {
    resetMessages();
    setEditingId(null);
    setForm({ ...EMPTY_FORM, isDefault: (list?.length ?? 0) === 0 });
    setModalOpen(true);
    createKeyRef.current = newIdempotencyKey();
  }

  function openEdit(a: AddressDTO) {
    resetMessages();
    setEditingId(a.id);
    setForm({
      kind: a.kind,
      country: a.country ?? 'GB',
      firstName: a.firstName ?? '',
      lastName: a.lastName ?? '',
      label: a.label ?? '',
      line1: a.line1 ?? '',
      line2: a.line2 ?? '',
      town: a.town ?? '',
      city: a.city ?? '',
      postcode: a.postcode ?? '',
      phoneE164: a.phoneE164 ?? '',
      isDefault: Boolean(a.isDefault)
    });
    setModalOpen(true);
    createKeyRef.current = null;
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErr(null);
    createKeyRef.current = null;
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    if (err) setErr(null);
  }

  function validateLocal(f: FormState) {
    if (!isNonEmpty(f.label)) return 'Label is required.';
    if (!isNonEmpty(f.line1)) return 'Address line 1 is required.';
    if (!isNonEmpty(f.city)) return 'Locality / City is required.';
    if (!isNonEmpty(f.postcode)) return 'Postcode is required.';
    if (!isNonEmpty(f.country)) return 'Country is required.';
    return null;
  }

  async function refreshList() {
    try {
      const res = await fetch('/api/account/addresses', { cache: 'no-store' });
      const json = (await res.json()) as ApiList;
      setList(json.addresses ?? []);
    } catch {
      // keep current
    }
  }

  async function save() {
    resetMessages();

    const v = validateLocal(form);
    if (v) {
      setErr(v);
      return;
    }

    startTransition(async () => {
      try {
        const payload = buildPayload(form);

        const isEdit = Boolean(editingId);
        const url = isEdit
          ? `/api/account/addresses/${encodeURIComponent(editingId!)}`
          : '/api/account/addresses';
        const method = isEdit ? 'PATCH' : 'POST';

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

        // ✅ Add idempotency only for creates
        if (!isEdit) {
          const key = createKeyRef.current ?? (createKeyRef.current = newIdempotencyKey());
          headers['idempotency-key'] = key;
        }

        const res = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(payload)
        });

        const json = (await res.json()) as ApiOne;

        if (!res.ok || json.ok === false) {
          setErr(json.error ?? 'Could not save address');
          return;
        }

        setMsg(isEdit ? 'Address updated' : 'Address added');

        // ✅ tidy-up idempotency on successful CREATE
        if (!isEdit) createKeyRef.current = null;

        closeModal();
        await refreshList();
      } catch {
        setErr('Could not save address');
      }
    });
  }

  async function setDefault(id: string) {
    resetMessages();

    startTransition(async () => {
      try {
        const res = await fetch(`/api/account/addresses/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isDefault: true })
        });

        const json = (await res.json()) as ApiOne;

        if (!res.ok || json.ok === false) {
          setErr(json.error ?? 'Could not set default');
          return;
        }

        setMsg('Default address updated');
        await refreshList();
      } catch {
        setErr('Could not set default');
      }
    });
  }

  async function remove(id: string) {
    resetMessages();

    const ok = window.confirm('Delete this address?');
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/account/addresses/${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };

        if (!res.ok || json.ok === false) {
          setErr(json.error ?? 'Could not delete address');
          return;
        }

        setMsg('Address deleted');
        await refreshList();
      } catch {
        setErr('Could not delete address');
      }
    });
  }

  return (
    <div className={styles.wrap}>
      {/* ✅ Header row */}
      <div className={styles.headRow}>
        <div className={styles.headText}>
          <h2 className={styles.h2}>Addresses</h2>
          <p className={styles.muted}>Manage your delivery and billing addresses.</p>
        </div>

        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary} ${styles.headBtn}`}
          onClick={openCreate}
        >
          Add address
        </button>
      </div>

      {err && <p className={styles.error}>{err}</p>}
      {msg && <p className={styles.ok}>{msg}</p>}

      {list === null ? (
        <p className={styles.muted}>Loading your addresses…</p>
      ) : list.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No addresses yet</p>
          <p className={styles.muted}>Add your first address to speed up checkout.</p>

          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.emptyBtn}`}
            onClick={openCreate}
          >
            Add address
          </button>
        </div>
      ) : (
        <ul className={styles.list}>
          {grouped.all.map((a) => (
            <li key={a.id} className={styles.li}>
              <div className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.titleRow}>
                    <div className={styles.label}>
                      {a.label}
                      {a.isDefault && <span className={styles.defaultPill}>Default</span>}
                    </div>

                    <div className={styles.pills}>
                      <span className={`${styles.kindPill} ${styles[`kind_${a.kind}`] ?? ''}`}>
                        {formatKind(a.kind)}
                      </span>
                      <span className={styles.countryPill}>
                        {(a.country ?? 'GB').toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    {!a.isDefault && (
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                        onClick={() => setDefault(a.id)}
                        disabled={busy}
                        title="Set as default"
                      >
                        Set default
                      </button>
                    )}

                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                      onClick={() => openEdit(a)}
                      disabled={busy}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                      onClick={() => remove(a.id)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className={styles.body}>
                  <div className={styles.addr}>
                    <div className={styles.addrLine}>
                      {a.firstName || a.lastName ? (
                        <strong>{[a.firstName, a.lastName].filter(Boolean).join(' ')}</strong>
                      ) : (
                        <strong>—</strong>
                      )}
                    </div>

                    <div className={styles.addrLine}>{a.line1}</div>
                    {a.line2 ? <div className={styles.addrLine}>{a.line2}</div> : null}

                    <div className={styles.addrLine}>
                      {a.town ? `${a.town}, ` : ''}
                      {a.city}
                    </div>

                    <div className={styles.addrLine}>{a.postcode}</div>

                    {a.phoneE164 ? (
                      <div className={styles.addrLineMuted}>Phone: {a.phoneE164}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Address modal">
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>
                  {editingId ? 'Edit address' : 'Add address'}
                </div>
                <div className={styles.modalSub}>Delivery / shipping or billing address</div>
              </div>

              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={closeModal}
                disabled={busy}
              >
                Close
              </button>
            </div>

            {err && <p className={styles.error}>{err}</p>}

            <div className={styles.grid2}>
              <div className={styles.formRow}>
                <label htmlFor="addr-kind">Type</label>
                <select
                  id="addr-kind"
                  value={form.kind}
                  onChange={(e) => setField('kind', e.target.value as AddressKind)}
                >
                  <option value="SHIPPING">Delivery</option>
                  <option value="BILLING">Billing</option>
                  <option value="BOTH">Delivery + Billing</option>
                </select>
              </div>

              <div className={styles.formRow}>
                <label htmlFor="addr-country">Country (ISO2)</label>
                <select
                  id="addr-country"
                  value={normalizeCountryInput(form.country)}
                  onChange={(e) => setField('country', e.target.value)}
                  autoComplete="country"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formRow}>
                <label htmlFor="addr-first">First name</label>
                <input
                  id="addr-first"
                  value={form.firstName}
                  onChange={(e) => setField('firstName', e.target.value)}
                  autoComplete="given-name"
                />
              </div>

              <div className={styles.formRow}>
                <label htmlFor="addr-last">Last name</label>
                <input
                  id="addr-last"
                  value={form.lastName}
                  onChange={(e) => setField('lastName', e.target.value)}
                  autoComplete="family-name"
                />
              </div>

              <div className={styles.formRowFull}>
                <label htmlFor="addr-label">Label *</label>
                <input
                  id="addr-label"
                  value={form.label}
                  onChange={(e) => setField('label', e.target.value)}
                  placeholder="Home, Work, etc."
                />
              </div>

              <div className={styles.formRowFull}>
                <label htmlFor="addr-line1">Address line 1 *</label>
                <input
                  id="addr-line1"
                  value={form.line1}
                  onChange={(e) => setField('line1', e.target.value)}
                  autoComplete="address-line1"
                />
              </div>

              <div className={styles.formRowFull}>
                <label htmlFor="addr-line2">Address line 2</label>
                <input
                  id="addr-line2"
                  value={form.line2}
                  onChange={(e) => setField('line2', e.target.value)}
                  autoComplete="address-line2"
                />
              </div>

              <div className={styles.formRow}>
                <label htmlFor="addr-town">Post Town (UK)</label>
                <input
                  id="addr-town"
                  value={form.town}
                  onChange={(e) => setField('town', e.target.value)}
                />
              </div>

              <div className={styles.formRow}>
                <label htmlFor="addr-city">Locality / City *</label>
                <input
                  id="addr-city"
                  value={form.city}
                  onChange={(e) => setField('city', e.target.value)}
                  autoComplete="address-level2"
                />
              </div>

              <div className={styles.formRow}>
                <label htmlFor="addr-postcode">Postcode *</label>
                <input
                  id="addr-postcode"
                  value={form.postcode}
                  onChange={(e) => setField('postcode', e.target.value)}
                  autoComplete="postal-code"
                />
                {postcodeWarning && <div className={styles.warn}>{postcodeWarning}</div>}
              </div>

              <div className={styles.formRow}>
                <label htmlFor="addr-phone">Phone</label>
                <input
                  id="addr-phone"
                  value={form.phoneE164}
                  onChange={(e) => setField('phoneE164', e.target.value)}
                  placeholder="+44…"
                  autoComplete="tel"
                />
              </div>
            </div>

            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setField('isDefault', e.target.checked)}
              />
              <span>Set as default</span>
            </label>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={save}
                disabled={busy}
              >
                {editingId ? 'Save changes' : 'Add address'}
              </button>

              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={closeModal}
                disabled={busy}
              >
                Cancel
              </button>
            </div>

            <p className={styles.hint}>
              * Required fields. UK postcode format is a warning only and won’t block saving.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
