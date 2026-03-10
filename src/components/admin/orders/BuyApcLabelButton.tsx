// src/components/admin/orders/BuyApcLabelButton.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';

type ItemType = 'PARCEL' | 'LIQUIDS';
type ApcMode = 'live' | 'test';

interface Props {
  orderId: string;
  mode?: ApcMode; // ✅ NEW
  productCode?: string | null;
  weightGrams?: number | null;
  deliveryPreview?: {
    name?: string | null;
    phone?: string | null;
    mobile?: string | null;
    email?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null; // locality
    town?: string | null; // post town (APC City)
    county?: string | null;
    instructions?: string | null;
    postcode?: string | null;
    countryCode?: string | null;
  } | null;
  onDone?: () => void;
}

interface ShipmentLite {
  id: string;
  waybill: string | null;
  trackingUrl: string | null;
  serviceCode: string | null;
}
interface ApiOk {
  ok: true;
  shipment: ShipmentLite;
  label: { mime: string | null; base64: string | null };
}
interface ApiErr {
  ok: false;
  error: string;
}
type ApiResponse = ApiOk | ApiErr;

interface ApcWarehouseSettings {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address1: string;
  address2: string;
  city: string; // post town for pickup
  postcode: string;
  countryCode: string;
}

interface ShippingSettingsResponse {
  ok: boolean;
  data?: Partial<ApcWarehouseSettings> | null;
  apc?: Partial<ApcWarehouseSettings> | null;
  error?: string;
}

/* -----------------------
   helpers (safe json)
------------------------ */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function hasFalseOk(v: unknown): v is { ok: false } {
  return isRecord(v) && 'ok' in v && (v as Record<string, unknown>).ok === false;
}
function hasStringError(v: unknown): v is { error: string } {
  return isRecord(v) && typeof (v as { error?: unknown }).error === 'string';
}

async function postJson(
  url: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<ApiResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(extraHeaders ?? {}) },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store'
  });

  const text = await res.text();
  const parsed: unknown = text ? JSON.parse(text) : {};

  if (!res.ok || hasFalseOk(parsed)) {
    const msg = hasStringError(parsed) ? parsed.error : res.statusText || 'Request failed';
    throw new Error(msg);
  }

  return parsed as ApiResponse;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/* -----------------------
   APC formatting helpers
------------------------ */
const stripCommas = (s: string) =>
  s
    .replace(/,+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

const limit = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
const upper = (s: string) => s.toUpperCase();
const digitsOnly = (s?: string) => (s ? s.replace(/[^\d]/g, '') : '');

const normalizePhone = (p?: string) => {
  const d = digitsOnly(p);
  return d.length >= 6 && d.length <= 15 ? d : '';
};

const normalizePostcode = (pc?: string) => upper((pc ?? '').trim()).replace(/\s{2,}/g, ' ');
const normalizeAddress1 = (line?: string) => limit(stripCommas((line ?? '').trim()), 64);
const cleanFreeText = (s?: string) => stripCommas((s ?? '').trim());

/* =========================
   UI: Field (fixed height)
========================= */
const fieldWrap: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: '18px 44px 16px',
  gap: 6
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.2,
  color: 'rgba(15,23,42,0.55)',
  lineHeight: '18px'
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(15,23,42,0.45)',
  lineHeight: '16px',
  minHeight: 16
};

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={fieldWrap}>
      <span style={labelStyle}>{label}</span>
      {children}
      <span style={hintStyle}>{hint ?? ''}</span>
    </label>
  );
}

const control: React.CSSProperties = {
  height: 44,
  width: '100%',
  borderRadius: 14,
  padding: '0 12px',
  border: '1px solid rgba(15,23,42,0.14)',
  background: '#fff',
  font: 'inherit',
  boxSizing: 'border-box',
  outline: 'none'
};

const controlSelect: React.CSSProperties = {
  ...control,
  lineHeight: 'normal'
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 14,
  padding: '10px 12px',
  border: '1px solid rgba(15,23,42,0.14)',
  background: '#fff',
  font: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
  resize: 'vertical'
};

const card: React.CSSProperties = {
  border: '1px solid rgba(15,23,42,0.10)',
  borderRadius: 16,
  padding: 14,
  background: 'linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%)',
  boxShadow: '0 10px 30px rgba(15,23,42,0.06)'
};

const cardTitle: React.CSSProperties = {
  fontWeight: 950,
  color: '#0f172a',
  letterSpacing: 0.2,
  marginBottom: 10
};

function subtleDivider(): React.CSSProperties {
  return {
    height: 1,
    background: 'rgba(15,23,42,0.08)',
    margin: '12px 0'
  };
}

/* -----------------------
   APC Services dropdown types
------------------------ */
interface ApcService {
  Carrier: string;
  ServiceName: string;
  ProductCode: string;
  MinTransitDays?: string;
  MaxTransitDays?: string;
  TotalCost?: string;
  Currency?: string;
  ItemType?: string;
}

type ServicesApiResponse = { ok: true; services: ApcService[] } | { ok: false; error: string };

export default function BuyApcLabelButton({
  orderId,
  mode = 'live', // ✅ default
  productCode,
  weightGrams,
  deliveryPreview,
  onDone
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ store shipment id + waybill once purchased
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [waybill, setWaybill] = useState<string | null>(null);

  // header form state
  const [codeInput, setCodeInput] = useState<string>(productCode ?? '');
  const [weightInput, setWeightInput] = useState<string>(
    weightGrams != null ? String(weightGrams) : ''
  );
  const [itemType, setItemType] = useState<ItemType>('PARCEL');

  // collection date (min = tomorrow)
  const tomorrowISO = useMemo(() => toISODate(addDays(new Date(), 1)), []);
  const [collectionDateISO, setCollectionDateISO] = useState<string>(tomorrowISO);

  // pickup (editable)
  const [pickup, setPickup] = useState<ApcWarehouseSettings>({
    companyName: '',
    contactName: '',
    phone: '',
    email: '',
    address1: '',
    address2: '',
    city: '',
    postcode: '',
    countryCode: 'GB'
  });

  // delivery (editable)
  interface DeliveryForm {
    name: string;
    phone: string; // primary
    mobile: string; // optional secondary
    email: string;
    address1: string;
    address2: string;
    city: string; // locality
    town: string; // post town (APC City)
    county: string;
    instructions: string;
    postcode: string;
    countryCode: string;
  }
  const [delivery, setDelivery] = useState<DeliveryForm | null>(null);

  // goods (editable)
  interface GoodsForm {
    valuePounds: string;
    description: string;
    fragile: boolean;
    security: boolean;
    increasedLiability: boolean;
  }
  const [goods, setGoods] = useState<GoodsForm>({
    valuePounds: '15',
    description: 'Food and drink',
    fragile: false,
    security: false,
    increasedLiability: false
  });

  // APC services dropdown state
  const [services, setServices] = useState<ApcService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  // keep some defaults for reset
  const defaultsRef = useRef<{
    codeInput: string;
    weightInput: string;
    itemType: ItemType;
    collectionDateISO: string;
    pickup: ApcWarehouseSettings;
    delivery: DeliveryForm | null;
    goods: GoodsForm;
  } | null>(null);

  const prettyKg = useMemo(() => {
    const raw = weightInput.trim();
    if (!raw) return 'auto';
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return `${(n / 1000).toFixed(2)} kg`;
  }, [weightInput]);

  // ✅ lint-friendly hint (no nested ternary)
  const serviceHint = useMemo(() => {
    if (servicesLoading) return 'Loading services…';
    return (
      servicesError ??
      (services.length ? 'Select a service (recommended)' : 'Click “Load” to fetch services')
    );
  }, [servicesLoading, servicesError, services.length]);

  function closeModal() {
    setOpen(false);
    setMsg(null);
    setWaybill(null);
    setShipmentId(null);
    setServicesError(null);
  }

  // Seed delivery from parent preview (if provided)
  useEffect(() => {
    if (!deliveryPreview) return;

    setDelivery({
      name: (deliveryPreview.name ?? '').trim(),
      phone: (deliveryPreview.phone ?? '').trim(),
      mobile: (deliveryPreview.mobile ?? '').trim(),
      email: (deliveryPreview.email ?? '').trim(),
      address1: (deliveryPreview.address1 ?? '').trim(),
      address2: (deliveryPreview.address2 ?? '').trim(),
      city: (deliveryPreview.city ?? '').trim(),
      town: (deliveryPreview.town ?? '').trim() || (deliveryPreview.city ?? '').trim(),
      county: (deliveryPreview.county ?? '').trim(),
      instructions: (deliveryPreview.instructions ?? '').trim(),
      postcode: normalizePostcode(deliveryPreview.postcode ?? undefined),
      countryCode: upper(deliveryPreview.countryCode ?? 'GB')
    });
  }, [deliveryPreview]);

  // Prefill pickup from shipping settings, and delivery from order shipping endpoint
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadAll() {
      try {
        // pickup settings
        const res = await fetch('/api/admin/settings/shipping', { cache: 'no-store' });
        const data = (await res.json()) as ShippingSettingsResponse;
        const s = data.data ?? data.apc;

        if (!cancelled && data.ok && s) {
          setPickup((prev) => ({
            companyName: (s.companyName ?? prev.companyName) || '',
            contactName: (s.contactName ?? prev.contactName) || '',
            phone: (s.phone ?? prev.phone) || '',
            email: (s.email ?? prev.email) || '',
            address1: (s.address1 ?? prev.address1) || '',
            address2: (s.address2 ?? prev.address2) || '',
            city: (s.city ?? prev.city) || '',
            postcode: (s.postcode ?? prev.postcode) || '',
            countryCode: upper(s.countryCode ?? prev.countryCode ?? 'GB')
          }));
        }
      } catch {
        // user can type
      }

      // delivery (only if not already seeded)
      if (!delivery) {
        try {
          const res2 = await fetch(`/api/admin/orders/${orderId}/shipping`, { cache: 'no-store' });
          const data2 = (await res2.json()) as {
            ok: boolean;
            shipping: {
              firstName?: string | null;
              lastName?: string | null;
              phoneE164?: string | null;
              line1?: string | null;
              line2?: string | null;
              city?: string | null;
              town?: string | null;
              postcode?: string | null;
              country?: string | null;
              email?: string | null;
            } | null;
          };

          if (!cancelled && data2.ok && data2.shipping) {
            const s = data2.shipping;
            const fullName =
              [s.firstName ?? '', s.lastName ?? ''].filter(Boolean).join(' ').trim() || 'Customer';

            const town = (s.town ?? '').trim();
            const locality = (s.city ?? '').trim();

            setDelivery({
              name: fullName,
              phone: (s.phoneE164 ?? '').trim(),
              mobile: '',
              email: (s.email ?? '').trim(),
              address1: (s.line1 ?? '').trim(),
              address2: (s.line2 ?? '').trim(),
              city: locality,
              town: town || locality,
              county: '',
              instructions: '',
              postcode: normalizePostcode(s.postcode ?? undefined),
              countryCode: upper(s.country ?? 'GB')
            });
          }
        } catch {
          // ignore
        }
      }

      defaultsRef.current ??= {
        codeInput: productCode ?? '',
        weightInput: weightGrams != null ? String(weightGrams) : '',
        itemType: 'PARCEL',
        collectionDateISO: tomorrowISO,
        pickup: {
          companyName: '',
          contactName: '',
          phone: '',
          email: '',
          address1: '',
          address2: '',
          city: '',
          postcode: '',
          countryCode: 'GB'
        },
        delivery: null,
        goods: {
          valuePounds: '15',
          description: 'Food and drink',
          fragile: false,
          security: false,
          increasedLiability: false
        }
      };
    }

    void loadAll();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  function resetAll() {
    setMsg(null);
    setWaybill(null);
    setShipmentId(null);

    setCodeInput(productCode ?? '');
    setWeightInput(weightGrams != null ? String(weightGrams) : '');
    setItemType('PARCEL');
    setCollectionDateISO(tomorrowISO);

    setDelivery(null);

    setPickup({
      companyName: '',
      contactName: '',
      phone: '',
      email: '',
      address1: '',
      address2: '',
      city: '',
      postcode: '',
      countryCode: 'GB'
    });

    setGoods({
      valuePounds: '15',
      description: 'Food and drink',
      fragile: false,
      security: false,
      increasedLiability: false
    });

    setServices([]);
    setServicesError(null);
  }

  // ---- client-side validation mirroring APC quirks ----
  function validate(): string | null {
    // Pickup
    if (!pickup.companyName.trim()) return 'Pickup: Company Name is required.';
    if (!pickup.address1.trim()) return 'Pickup: Address Line 1 is required.';
    if (!pickup.city.trim()) return 'Pickup: Town/City (post town) is required.';
    if (!pickup.postcode.trim()) return 'Pickup: Postcode is required.';
    const pickupPhone = normalizePhone(pickup.phone);
    if (!pickupPhone) return 'Pickup: Phone must be 6–15 digits.';

    // Delivery
    if (!delivery) return 'Delivery: Missing shipping address.';
    if (!delivery.name.trim()) return 'Delivery: Name is required.';
    if (!delivery.address1.trim()) return 'Delivery: Address Line 1 is required.';
    if (!delivery.postcode.trim()) return 'Delivery: Postcode is required.';
    const cc = upper(delivery.countryCode || 'GB');
    if (cc === 'GB' && !delivery.town.trim())
      return 'Delivery: Town (Royal Mail post town) is required for UK addresses.';

    const primary = normalizePhone(delivery.phone);
    const secondary = normalizePhone(delivery.mobile);
    if (!primary && !secondary) return 'Delivery: Provide a valid Phone or Mobile (6–15 digits).';

    // Weight
    if (weightInput.trim() !== '') {
      const n = Number(weightInput);
      if (!Number.isFinite(n) || n <= 0) return 'Weight must be a positive number in grams.';
    }

    // Goods value
    const val = Number(goods.valuePounds || '0');
    if (!Number.isFinite(val) || val < 1) return 'Declared Value must be at least £1.';

    return null;
  }

  function resolveWeightGramsForServiceCall(): number {
    const w = weightInput.trim();
    if (w) {
      const n = Number(w);
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
    if (weightGrams && weightGrams > 0) return Math.floor(weightGrams);
    return 1000; // default 1kg
  }

  async function loadApcServices() {
    if (!delivery) {
      setServicesError('Delivery: Missing shipping address.');
      return;
    }

    const pickupPostcode = normalizePostcode(pickup.postcode);
    const deliveryPostcode = normalizePostcode(delivery.postcode);

    if (!pickupPostcode) {
      setServicesError('Pickup postcode is required to load services.');
      return;
    }
    if (!deliveryPostcode) {
      setServicesError('Delivery postcode is required to load services.');
      return;
    }

    setServicesLoading(true);
    setServicesError(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipments/apc/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-apc-env': mode }, // ✅ NEW
        cache: 'no-store',
        body: JSON.stringify({
          collectionDateISO,
          pickupPostcode,
          deliveryPostcode,
          weightGrams: resolveWeightGramsForServiceCall(),
          itemType
        })
      });

      const data = (await res.json()) as ServicesApiResponse;

      if (!res.ok || data.ok === false) {
        throw new Error(data.ok === false ? data.error : 'Failed to load services');
      }

      const list = (data.services ?? []).filter((s) => !!s?.ProductCode);

      const sorted = [...list].sort((a, b) => {
        const na = Number(a.TotalCost ?? '');
        const nb = Number(b.TotalCost ?? '');
        const va = Number.isFinite(na) ? na : Number.POSITIVE_INFINITY;
        const vb = Number.isFinite(nb) ? nb : Number.POSITIVE_INFINITY;
        return va - vb;
      });

      setServices(sorted);

      if (!codeInput.trim() && sorted.length > 0) {
        setCodeInput(upper(sorted[0].ProductCode));
      }
    } catch (e) {
      setServices([]);
      setServicesError(e instanceof Error ? e.message : 'Failed to load services');
    } finally {
      setServicesLoading(false);
    }
  }

  // Optional: auto-load once when modal opens and we have delivery + postcodes
  useEffect(() => {
    if (!open) return;
    if (!delivery) return;
    if (services.length > 0) return;

    const pickupPostcode = normalizePostcode(pickup.postcode);
    const deliveryPostcode = normalizePostcode(delivery.postcode);

    if (!pickupPostcode || !deliveryPostcode) return;

    void loadApcServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, delivery]);

  const serviceOptions = useMemo(() => {
    return services.map((s) => {
      const code = upper(s.ProductCode);
      const cost =
        s.TotalCost && String(s.TotalCost).trim()
          ? `${String(s.TotalCost).trim()} ${s.Currency ?? 'GBP'}`
          : null;

      const transit =
        s.MinTransitDays || s.MaxTransitDays
          ? `${s.MinTransitDays ?? '?'}–${s.MaxTransitDays ?? '?'}d`
          : null;

      const meta = [cost, transit].filter(Boolean).join(' • ');

      return {
        code,
        label: `${s.ServiceName} (${code})`,
        meta
      };
    });
  }, [services]);

  function purchase() {
    const error = validate();
    if (error) {
      setMsg(error);
      return;
    }
    if (!delivery) {
      setMsg('Delivery: Missing shipping address.');
      return;
    }

    setMsg(null);

    startTransition(async () => {
      try {
        const companyName = pickup.companyName.trim();
        const contactRaw = pickup.contactName.trim();
        const contactName = contactRaw === '' ? companyName : contactRaw;

        const pickupPhone = normalizePhone(pickup.phone);

        const deliveryPrimary = normalizePhone(delivery.phone);
        const deliverySecondary = normalizePhone(delivery.mobile);
        const deliveryPhone = deliveryPrimary || deliverySecondary;

        const countryCode = upper(pickup.countryCode || 'GB');
        const deliveryCountry = upper(delivery.countryCode || 'GB');

        const payload = {
          productCode: codeInput.trim() === '' ? undefined : upper(codeInput.trim()),
          weightGrams:
            weightInput.trim() === ''
              ? undefined
              : Number.isFinite(Number(weightInput))
                ? Number(weightInput)
                : undefined,
          itemType,
          collectionDateISO,

          pickupOverride: {
            companyName: cleanFreeText(companyName),
            contactName: cleanFreeText(contactName),
            phone: pickupPhone,
            email: (pickup.email ?? '').trim(),
            address1: normalizeAddress1(pickup.address1),
            address2: cleanFreeText(pickup.address2),
            city: cleanFreeText(pickup.city),
            postcode: normalizePostcode(pickup.postcode),
            countryCode
          },

          deliveryOverride: {
            name: cleanFreeText(delivery.name),
            phone: deliveryPhone,
            mobile: deliverySecondary || '',
            email: (delivery.email ?? '').trim(),
            address1: normalizeAddress1(delivery.address1),
            address2: cleanFreeText(delivery.address2),
            city: cleanFreeText(delivery.city),
            town: cleanFreeText(delivery.town),
            county: cleanFreeText(delivery.county),
            instructions: cleanFreeText(delivery.instructions),
            postcode: normalizePostcode(delivery.postcode),
            countryCode: deliveryCountry
          },

          goodsOverride: {
            valuePounds: Number(goods.valuePounds || '0'),
            description: cleanFreeText(goods.description) || 'Goods',
            fragile: !!goods.fragile,
            security: !!goods.security,
            increasedLiability: !!goods.increasedLiability
          }
        };

        const res = await postJson(
          `/api/admin/orders/${orderId}/labels/purchase/apc`,
          payload,
          { 'x-apc-env': mode } // ✅ NEW
        );

        if (res.ok !== true) throw new Error('Unexpected response');

        setShipmentId(res.shipment.id);
        setWaybill(res.shipment.waybill);

        setMsg(`✅ Label purchased • Waybill: ${res.shipment.waybill ?? '—'}`);

        onDone?.();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Failed to buy label.');
      }
    });
  }

  const labelBtn: React.CSSProperties = {
    border: '1px solid rgba(15,23,42,0.14)',
    borderRadius: 12,
    padding: '8px 10px',
    background: '#fff',
    cursor: 'pointer',
    font: 'inherit',
    fontWeight: 900,
    boxShadow: '0 6px 18px rgba(15,23,42,0.06)',
    textDecoration: 'none',
    color: '#0f172a',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8
  };

  /* =========================
     Render
  ========================= */
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMsg(null);
          setWaybill(null);
          setShipmentId(null);
          setServicesError(null);
        }}
        style={{
          border: '1px solid rgba(15,23,42,0.20)',
          borderRadius: 12,
          padding: '8px 12px',
          background: '#fff',
          cursor: 'pointer',
          font: 'inherit',
          fontWeight: 900,
          boxShadow: '0 6px 18px rgba(15,23,42,0.08)'
        }}
        title={mode === 'test' ? 'Buy APC label (TEST)' : 'Buy APC label (LIVE)'}
      >
        🚚 Buy APC Label {mode === 'test' ? '(TEST)' : '(LIVE)'}
      </button>

      {!open ? null : (
        <div
          aria-modal="true"
          role="dialog"
          aria-labelledby="apc-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'grid',
            placeItems: 'center'
          }}
        >
          {/* overlay */}
          <div
            onClick={closeModal}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(2,6,23,0.55)',
              backdropFilter: 'blur(4px)',
              zIndex: 0
            }}
          />

          {/* modal */}
          <div
            style={{
              position: 'relative',
              width: 'min(1040px, 96vw)',
              maxHeight: '92vh',
              borderRadius: 18,
              overflow: 'hidden',
              background: 'linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%)',
              boxShadow: '0 30px 100px rgba(2,6,23,0.35)',
              display: 'grid',
              gridTemplateRows: 'auto 1fr auto',
              zIndex: 1
            }}
          >
            {/* header */}
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid rgba(15,23,42,0.10)',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'center',
                gap: 12
              }}
            >
              <div>
                <div
                  id="apc-modal-title"
                  style={{ fontWeight: 950, fontSize: 16, color: '#0f172a' }}
                >
                  Buy APC Label {mode === 'test' ? '(TEST)' : '(LIVE)'}
                </div>
                <div style={{ color: 'rgba(15,23,42,0.60)', fontSize: 13, marginTop: 3 }}>
                  Select a service from APC (recommended). If you already know the code, you can
                  type it manually. <span style={{ color: 'rgba(15,23,42,0.45)' }}>Order:</span>{' '}
                  <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    {orderId}
                  </span>
                </div>
              </div>

              <button
                aria-label="Close"
                onClick={closeModal}
                style={{
                  border: '1px solid rgba(15,23,42,0.12)',
                  background: '#fff',
                  width: 38,
                  height: 38,
                  borderRadius: 14,
                  cursor: 'pointer',
                  fontWeight: 900
                }}
              >
                ✕
              </button>
            </div>

            {/* body */}
            <div style={{ padding: 16, overflow: 'auto' }}>
              {/* TOP CONTROLS */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.25fr 0.8fr 1fr auto',
                  gap: 12,
                  alignItems: 'end'
                }}
              >
                <Field label="Weight (grams)" hint={prettyKg}>
                  <input
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="auto"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    style={control}
                  />
                </Field>

                <Field label="Service (APC Product Code)" hint={serviceHint}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <select
                      value={codeInput.trim() ? upper(codeInput) : ''}
                      onChange={(e) => setCodeInput(upper(e.target.value))}
                      style={controlSelect}
                      disabled={servicesLoading}
                    >
                      <option value="">
                        {services.length ? 'Select a service…' : 'No services loaded'}
                      </option>

                      {serviceOptions.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label}
                          {o.meta ? ` — ${o.meta}` : ''}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={loadApcServices}
                      disabled={servicesLoading}
                      style={{
                        height: 44,
                        borderRadius: 14,
                        padding: '0 14px',
                        border: '1px solid rgba(15,23,42,0.14)',
                        background: '#fff',
                        cursor: 'pointer',
                        fontWeight: 950,
                        whiteSpace: 'nowrap',
                        opacity: servicesLoading ? 0.75 : 1
                      }}
                      title="Fetch available APC services for these postcodes"
                    >
                      {servicesLoading ? 'Loading…' : services.length ? 'Reload' : 'Load'}
                    </button>
                  </div>
                </Field>

                <Field label="Item Type" hint=" ">
                  <select
                    value={itemType}
                    onChange={(e) => {
                      const v = (e.target.value as ItemType) ?? 'PARCEL';
                      setItemType(v);
                      setServices([]);
                      setServicesError(null);
                    }}
                    style={controlSelect}
                  >
                    <option value="PARCEL">PARCEL</option>
                    <option value="LIQUIDS">LIQUIDS</option>
                  </select>
                </Field>

                <Field label="Collection date" hint="No past dates">
                  <input
                    type="date"
                    min={tomorrowISO}
                    value={collectionDateISO}
                    onChange={(e) => {
                      setCollectionDateISO(e.target.value);
                      setServices([]);
                      setServicesError(null);
                    }}
                    style={control}
                  />
                </Field>

                <div style={{ display: 'grid', gridTemplateRows: '18px 44px 16px', gap: 6 }}>
                  <span style={{ ...labelStyle, opacity: 0 }}>Reset</span>
                  <button
                    type="button"
                    onClick={resetAll}
                    style={{
                      height: 44,
                      borderRadius: 14,
                      padding: '0 14px',
                      border: '1px solid rgba(15,23,42,0.14)',
                      background: '#fff',
                      cursor: 'pointer',
                      fontWeight: 950,
                      boxShadow: '0 8px 20px rgba(15,23,42,0.06)'
                    }}
                    title="Reset form to defaults"
                  >
                    Reset
                  </button>
                  <span style={hintStyle} />
                </div>
              </div>

              {/* Manual override (kept as fallback) */}
              <div style={{ marginTop: 10 }}>
                <Field
                  label="Manual Product Code (optional override)"
                  hint="Only needed if you want to type a code directly"
                >
                  <input
                    value={codeInput}
                    onChange={(e) => setCodeInput(upper(e.target.value))}
                    placeholder="e.g. APCND16"
                    style={control}
                  />
                </Field>
              </div>

              <div style={subtleDivider()} />

              {/* TWO PANELS */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(320px,1fr) minmax(320px,1fr)',
                  gap: 14
                }}
              >
                {/* Pickup */}
                <div style={card}>
                  <div style={cardTitle}>Pickup (APC)</div>

                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <Field label="Company Name">
                        <input
                          value={pickup.companyName}
                          onChange={(e) =>
                            setPickup((p) => ({ ...p, companyName: e.target.value }))
                          }
                          style={control}
                        />
                      </Field>
                      <Field label="Contact Name" hint="Defaults to company name if blank">
                        <input
                          value={pickup.contactName}
                          onChange={(e) =>
                            setPickup((p) => ({ ...p, contactName: e.target.value }))
                          }
                          style={control}
                        />
                      </Field>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <Field label="Phone" hint="Digits only (6–15)">
                        <input
                          value={pickup.phone}
                          onChange={(e) => setPickup((p) => ({ ...p, phone: e.target.value }))}
                          style={control}
                        />
                      </Field>
                      <Field label="Email" hint="Optional">
                        <input
                          value={pickup.email}
                          onChange={(e) => setPickup((p) => ({ ...p, email: e.target.value }))}
                          style={control}
                        />
                      </Field>
                    </div>

                    <Field label="Address Line 1">
                      <input
                        value={pickup.address1}
                        onChange={(e) => setPickup((p) => ({ ...p, address1: e.target.value }))}
                        placeholder="e.g. Unit C 45 Riverside Way"
                        style={control}
                      />
                    </Field>

                    <Field label="Address Line 2" hint="Optional">
                      <input
                        value={pickup.address2}
                        onChange={(e) => setPickup((p) => ({ ...p, address2: e.target.value }))}
                        style={control}
                      />
                    </Field>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <Field
                        label="Town / City (post town)"
                        hint="Royal Mail post town for the postcode"
                      >
                        <input
                          value={pickup.city}
                          onChange={(e) => setPickup((p) => ({ ...p, city: e.target.value }))}
                          placeholder="Uxbridge / Hayes"
                          style={control}
                        />
                      </Field>
                      <Field label="Postcode">
                        <input
                          value={pickup.postcode}
                          onChange={(e) =>
                            setPickup((p) => ({ ...p, postcode: upper(e.target.value) }))
                          }
                          style={control}
                        />
                      </Field>
                    </div>

                    <Field label="Country" hint="2-letter code (GB)">
                      <input
                        value={pickup.countryCode}
                        onChange={(e) =>
                          setPickup((p) => ({ ...p, countryCode: upper(e.target.value) }))
                        }
                        style={{ ...control, maxWidth: 140 }}
                      />
                    </Field>
                  </div>
                </div>

                {/* Delivery */}
                <div style={card}>
                  <div style={cardTitle}>Delivery (from order)</div>

                  {!delivery ? (
                    <div style={{ color: 'rgba(15,23,42,0.55)', fontSize: 14 }}>
                      Fetching shipping address…
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <Field label="Name">
                        <input
                          value={delivery.name}
                          onChange={(e) =>
                            setDelivery((d) => (d ? { ...d, name: e.target.value } : d))
                          }
                          style={control}
                        />
                      </Field>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Field label="Phone" hint="Digits only (6–15)">
                          <input
                            value={delivery.phone}
                            onChange={(e) =>
                              setDelivery((d) => (d ? { ...d, phone: e.target.value } : d))
                            }
                            style={control}
                          />
                        </Field>
                        <Field label="Mobile (optional)" hint="Backup number">
                          <input
                            value={delivery.mobile}
                            onChange={(e) =>
                              setDelivery((d) => (d ? { ...d, mobile: e.target.value } : d))
                            }
                            style={control}
                          />
                        </Field>
                      </div>

                      <Field label="Email" hint="Defaults to order contact email if empty">
                        <input
                          value={delivery.email}
                          onChange={(e) =>
                            setDelivery((d) => (d ? { ...d, email: e.target.value } : d))
                          }
                          style={control}
                        />
                      </Field>

                      <Field label="Address Line 1">
                        <input
                          value={delivery.address1}
                          onChange={(e) =>
                            setDelivery((d) => (d ? { ...d, address1: e.target.value } : d))
                          }
                          style={control}
                        />
                      </Field>

                      <Field label="Address Line 2" hint="Optional">
                        <input
                          value={delivery.address2}
                          onChange={(e) =>
                            setDelivery((d) => (d ? { ...d, address2: e.target.value } : d))
                          }
                          style={control}
                        />
                      </Field>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Field label="City / Locality" hint="Borough / locality (optional)">
                          <input
                            value={delivery.city}
                            onChange={(e) =>
                              setDelivery((d) => (d ? { ...d, city: e.target.value } : d))
                            }
                            style={control}
                          />
                        </Field>
                        <Field label="Town (Royal Mail post town)" hint="APC uses this as “City”">
                          <input
                            value={delivery.town}
                            onChange={(e) =>
                              setDelivery((d) => (d ? { ...d, town: e.target.value } : d))
                            }
                            style={control}
                          />
                        </Field>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Field label="Postcode">
                          <input
                            value={delivery.postcode}
                            onChange={(e) =>
                              setDelivery((d) =>
                                d ? { ...d, postcode: upper(e.target.value) } : d
                              )
                            }
                            style={control}
                          />
                        </Field>
                        <Field label="Country" hint="2-letter code (GB)">
                          <input
                            value={delivery.countryCode}
                            onChange={(e) =>
                              setDelivery((d) =>
                                d ? { ...d, countryCode: upper(e.target.value) } : d
                              )
                            }
                            style={{ ...control, maxWidth: 140 }}
                          />
                        </Field>
                      </div>

                      <Field label="County (optional)" hint="Optional">
                        <input
                          value={delivery.county}
                          onChange={(e) =>
                            setDelivery((d) => (d ? { ...d, county: e.target.value } : d))
                          }
                          style={control}
                        />
                      </Field>

                      <Field label="Instructions (optional)" hint="Delivery notes for driver">
                        <textarea
                          value={delivery.instructions}
                          onChange={(e) =>
                            setDelivery((d) => (d ? { ...d, instructions: e.target.value } : d))
                          }
                          rows={2}
                          style={textareaStyle}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              </div>

              <div style={subtleDivider()} />

              {/* GOODS */}
              <div style={card}>
                <div style={cardTitle}>Goods</div>

                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12 }}>
                    <Field label="Declared Value (£)" hint="Minimum £1">
                      <input
                        value={goods.valuePounds}
                        onChange={(e) => setGoods((g) => ({ ...g, valuePounds: e.target.value }))}
                        inputMode="decimal"
                        style={control}
                      />
                    </Field>

                    <Field label="Description" hint="Shown to APC">
                      <input
                        value={goods.description}
                        onChange={(e) => setGoods((g) => ({ ...g, description: e.target.value }))}
                        style={control}
                      />
                    </Field>
                  </div>

                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <label
                      style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800 }}
                    >
                      <input
                        type="checkbox"
                        checked={goods.fragile}
                        onChange={(e) => setGoods((g) => ({ ...g, fragile: e.target.checked }))}
                      />
                      Fragile
                    </label>

                    <label
                      style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800 }}
                    >
                      <input
                        type="checkbox"
                        checked={goods.security}
                        onChange={(e) => setGoods((g) => ({ ...g, security: e.target.checked }))}
                      />
                      Security
                    </label>

                    <label
                      style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800 }}
                    >
                      <input
                        type="checkbox"
                        checked={goods.increasedLiability}
                        onChange={(e) =>
                          setGoods((g) => ({ ...g, increasedLiability: e.target.checked }))
                        }
                      />
                      Increased Liability (charges may apply)
                    </label>
                  </div>
                </div>
              </div>

              {/* messages */}
              {msg && (
                <div
                  style={{
                    marginTop: 14,
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'rgba(15,23,42,0.04)',
                    border: '1px solid rgba(15,23,42,0.08)',
                    color: '#0f172a',
                    fontSize: 13,
                    fontWeight: 800,
                    wordBreak: 'break-word'
                  }}
                >
                  {msg}
                </div>
              )}

              {/* ✅ After purchase: show label links + tracking */}
              {(shipmentId ?? waybill) && (
                <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {shipmentId && (
                    <>
                      <a
                        href={`/api/admin/shipments/${shipmentId}/label`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={labelBtn}
                        title="Open the label for this shipment"
                      >
                        🏷️ Open label
                      </a>

                      <a
                        href={`/api/admin/shipments/${shipmentId}/label?download=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={labelBtn}
                        title="Download the label file"
                      >
                        ⬇️ Download label
                      </a>
                    </>
                  )}

                  <a
                    href={`/api/admin/orders/${orderId}/labels/latest`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={labelBtn}
                    title="Open the latest label for this order"
                  >
                    🧾 Latest label (order)
                  </a>

                  {waybill && (
                    <a
                      href={`https://apc-overnight.com/recexpress/tracking/?consignment=${encodeURIComponent(
                        waybill
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={labelBtn}
                      title="Track on APC"
                    >
                      📍 Track (APC)
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* footer */}
            <div
              style={{
                padding: 12,
                borderTop: '1px solid rgba(15,23,42,0.10)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                background: '#fff'
              }}
            >
              <button
                type="button"
                onClick={closeModal}
                style={{
                  height: 42,
                  border: '1px solid rgba(15,23,42,0.14)',
                  borderRadius: 14,
                  padding: '0 14px',
                  background: '#fff',
                  fontWeight: 950,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>

              <button
                type="button"
                onClick={purchase}
                disabled={isPending}
                style={{
                  height: 42,
                  border: '1px solid rgba(2,6,23,0.9)',
                  borderRadius: 14,
                  padding: '0 16px',
                  background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
                  color: '#fff',
                  fontWeight: 950,
                  minWidth: 140,
                  cursor: 'pointer',
                  opacity: isPending ? 0.75 : 1,
                  boxShadow: '0 10px 26px rgba(2,6,23,0.22)'
                }}
              >
                {isPending ? 'Purchasing…' : 'Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
