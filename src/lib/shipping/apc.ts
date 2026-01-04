// src/lib/shipping/apc.ts

export type ApcMime = 'application/pdf' | 'image/png' | 'application/zpl';

/* ------------------------------------------------------------------ */
/* ENV                                                                 */
/* ------------------------------------------------------------------ */

const APC_ENV = (process.env.APC_ENV ?? 'training').toLowerCase(); // training | live
const APC_BASE_URL = APC_ENV === 'live' ? process.env.APC_LIVE_BASE : process.env.APC_TRAINING_BASE;

const APC_USERNAME = process.env.APC_USERNAME ?? '';
const APC_PASSWORD = process.env.APC_PASSWORD ?? '';
const APC_TIMEOUT_MS = Number(process.env.APC_TIMEOUT_MS ?? 25_000);

if (!APC_BASE_URL) throw new Error('Missing APC base URL (APC_TRAINING_BASE / APC_LIVE_BASE).');
if (!APC_USERNAME) throw new Error('Missing APC_USERNAME.');
if (!APC_PASSWORD) throw new Error('Missing APC_PASSWORD.');

/* ------------------------------------------------------------------ */
/* SMALL SAFE HELPERS (NO any)                                         */
/* ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function asRecord(v: unknown): Record<string, unknown> {
  return isRecord(v) ? v : {};
}
function getObj(o: unknown, k: string): Record<string, unknown> {
  const r = asRecord(o);
  const v = r[k];
  return asRecord(v);
}
function getStr(o: unknown, k: string): string | null {
  const r = asRecord(o);
  const v = r[k];
  return typeof v === 'string' ? v : null;
}

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

export type ApcItemType = 'PARCEL' | 'LIQUIDS';

export interface ApcShipmentItem {
  Type: ApcItemType;
  Weight: string;
  Length: string;
  Width: string;
  Height: string;
  Value: string;
  Description?: string;
}

export interface ApcShipmentDetails {
  NumberOfPieces: string;
  Items: { Item: ApcShipmentItem | ApcShipmentItem[] };
}

export interface ApcServiceAvailabilityRequest {
  Orders: {
    Order: {
      CollectionDate: string; // DD/MM/YYYY
      ReadyAt: string; // HH:mm
      ClosedAt: string; // HH:mm
      Collection: { PostalCode: string; CountryCode: string };
      Delivery: { PostalCode: string; CountryCode: string };
      ShipmentDetails: ApcShipmentDetails;
    };
  };
}

export interface ApcCreateOrderPayload {
  Orders: {
    Order: {
      CollectionDate: string;
      ReadyAt: string;
      ClosedAt: string;
      ProductCode: string;
      Reference: string;

      Collection: {
        CompanyName: string;
        AddressLine1: string;
        AddressLine2?: string;
        PostalCode: string;
        City: string;
        CountryCode: string;
        Contact: {
          PersonName: string;
          PhoneNumber: string;
          Email: string;
        };
      };

      Delivery: {
        CompanyName: string;
        AddressLine1: string;
        AddressLine2?: string;
        PostalCode: string;
        City: string;
        CountryCode: string;
        Contact: {
          PersonName: string;
          PhoneNumber: string;
          MobileNumber?: string;
          Email: string;
        };
      };

      GoodsInfo: {
        GoodsValue: string;
        GoodsDescription: string;
        PremiumInsurance?: string;
        Fragile?: string;
        Security?: string;
        IncreasedLiability?: string;
      };

      ShipmentDetails: ApcShipmentDetails;
    };
  };
}

export interface ServiceOption {
  Carrier?: string;
  ServiceName?: string;
  ProductCode?: string;
  MinTransitDays?: string;
  MaxTransitDays?: string;
  CollectionDate?: string;
  EstimatedDeliveryDate?: string;
}

/* ------------------------------------------------------------------ */
/* ERRORS                                                              */
/* ------------------------------------------------------------------ */

export class ApcHttpError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`APC HTTP ${status}: ${body.slice(0, 500)}`);
    this.name = 'ApcHttpError';
    this.status = status;
    this.body = body;
  }
}

export class ApcLabelPendingError extends Error {
  waybill: string;
  attempts: number;
  constructor(waybill: string, attempts: number) {
    super(`APC label not ready for ${waybill} after ${attempts} attempts`);
    this.name = 'ApcLabelPendingError';
    this.waybill = waybill;
    this.attempts = attempts;
  }
}

export interface ApcOrderGetResult {
  contentType: string;
  raw: string;
  json?: unknown;
  xml?: string;
}

/* ------------------------------------------------------------------ */
/* AUTH + HTTP                                                         */
/* ------------------------------------------------------------------ */

/**
 * APC expects:
 *   remote-user: Basic <base64(email:password)>
 * NOT Authorization.
 */
function remoteUserHeaderValue(username: string, password: string) {
  const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

function buildHeaders(extra?: Record<string, string>) {
  return {
    Accept: 'application/json, text/xml, application/xml, */*',
    'Content-Type': 'application/json',
    'remote-user': remoteUserHeaderValue(APC_USERNAME, APC_PASSWORD),
    ...extra
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout(signal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), APC_TIMEOUT_MS);

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

/** Minimal XML tag extraction */
function xmlGetFirst(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m?.[1]?.trim() ?? null;
}

/* ------------------------------------------------------------------ */
/* CORE CALLS                                                          */
/* ------------------------------------------------------------------ */

export async function apcServiceAvailability(
  payload: ApcServiceAvailabilityRequest,
  signal?: AbortSignal
) {
  const { signal: s, clear } = withTimeout(signal);
  try {
    const res = await fetch(`${APC_BASE_URL}/ServiceAvailability.json`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
      signal: s,
      cache: 'no-store'
    });

    const raw = await res.text();
    if (!res.ok) throw new ApcHttpError(res.status, raw);

    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return { raw } as unknown;
    }
  } finally {
    clear();
  }
}

export async function apcCreateOrder(payload: ApcCreateOrderPayload, signal?: AbortSignal) {
  const { signal: s, clear } = withTimeout(signal);
  try {
    const res = await fetch(`${APC_BASE_URL}/Orders.json`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
      signal: s,
      cache: 'no-store'
    });

    const raw = await res.text();
    if (!res.ok) throw new ApcHttpError(res.status, raw);

    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return { raw } as unknown;
    }
  } finally {
    clear();
  }
}

/**
 * Get order (and label) by identifier.
 */
export async function apcGetOrderByWaybill(
  waybill: string,
  signal?: AbortSignal,
  opts?: {
    labelFormat?: 'PDF' | 'PNG' | 'ZPL';
    markPrinted?: boolean;
    searchType?: 'CarrierWaybill' | 'OrderNumber' | 'Reference';
    labels?: boolean;
  }
): Promise<ApcOrderGetResult> {
  const { signal: s, clear } = withTimeout(signal);
  try {
    const labelFormat = opts?.labelFormat ?? 'PDF';
    const markPrinted = opts?.markPrinted ?? true;
    const searchType = opts?.searchType ?? 'CarrierWaybill';
    const labels = opts?.labels ?? true;

    const qs = new URLSearchParams({
      labelformat: labelFormat,
      markprinted: String(markPrinted),
      searchtype: searchType,
      labels: String(labels)
    });

    const res = await fetch(
      `${APC_BASE_URL}/Orders/${encodeURIComponent(waybill)}.json?${qs.toString()}`,
      {
        method: 'GET',
        headers: buildHeaders({ Accept: 'application/json, text/xml, application/xml, */*' }),
        signal: s,
        cache: 'no-store'
      }
    );

    const contentType = res.headers.get('content-type') ?? '';
    const raw = await res.text();

    if (!res.ok) throw new ApcHttpError(res.status, raw);

    if (contentType.includes('application/json') || raw.trim().startsWith('{')) {
      try {
        return { contentType, raw, json: JSON.parse(raw) as unknown };
      } catch {
        return { contentType, raw };
      }
    }

    return { contentType, raw, xml: raw };
  } finally {
    clear();
  }
}

/* ------------------------------------------------------------------ */
/* EXTRACTORS                                                          */
/* ------------------------------------------------------------------ */

export function apcExtractWaybillFromCreateResponse(resp: unknown): string | null {
  const r = asRecord(resp);
  const orders = getObj(r, 'Orders');
  const order = getObj(orders, 'Order');

  const waybill =
    getStr(order, 'WayBill') ??
    getStr(order, 'WayBillNumber') ??
    getStr(r, 'WayBill') ??
    getStr(r, 'WayBillNumber');

  if (typeof waybill === 'string' && waybill.length > 6) return waybill;

  const raw = getStr(r, 'raw');
  if (raw) {
    const wb = xmlGetFirst(raw, 'WayBill') ?? xmlGetFirst(raw, 'WayBillNumber');
    if (wb && wb.length > 6) return wb;
  }

  return null;
}

/**
 * Labels in JSON responses are typically nested like:
 * ShipmentDetails.Items.Item.Label.{Format,Content}
 */
export function apcExtractLabel(
  result: ApcOrderGetResult
): { mime: ApcMime; base64: string } | null {
  const mapMime = (fmt: string): ApcMime | null => {
    const f = fmt.toUpperCase();
    if (f === 'PDF') return 'application/pdf';
    if (f === 'PNG') return 'image/png';
    if (f === 'ZPL') return 'application/zpl';
    return null;
  };

  const fromOrderObject = (orderObj: Record<string, unknown>) => {
    const shipment = getObj(orderObj, 'ShipmentDetails');
    const itemsWrap = getObj(shipment, 'Items');
    const itemAny = itemsWrap['Item'];

    const items = Array.isArray(itemAny) ? itemAny : itemAny ? [itemAny] : [];
    for (const it of items) {
      const item = asRecord(it);
      const label = getObj(item, 'Label');
      const fmt = getStr(label, 'Format');
      const content = getStr(label, 'Content');
      if (fmt && content && content.length > 50) {
        const mime = mapMime(fmt);
        if (mime) return { mime, base64: content };
      }
    }
    return null;
  };

  if (result.json) {
    const j = asRecord(result.json);
    const orders = getObj(j, 'Orders');

    const orderObj = getObj(orders, 'Order');
    if (Object.keys(orderObj).length) {
      const label = fromOrderObject(orderObj);
      if (label) return label;
    }

    const rootOrder = getObj(j, 'Order');
    if (Object.keys(rootOrder).length) {
      const label = fromOrderObject(rootOrder);
      if (label) return label;
    }

    return null;
  }

  if (result.xml) {
    const xml = result.xml;
    const content = xmlGetFirst(xml, 'Content');
    const fmt = xmlGetFirst(xml, 'Format');
    if (content && fmt && content.length > 50) {
      const mime = mapMime(fmt);
      if (mime) return { mime, base64: content };
    }
    return null;
  }

  return null;
}

/**
 * Try to extract CollectionDate (DD/MM/YYYY) from APC order response.
 * Used only for "abortIfFutureCollectionDate" behaviour.
 */
export function apcExtractCollectionDate(result: ApcOrderGetResult): string | null {
  if (result.json) {
    const j = asRecord(result.json);
    const orders = getObj(j, 'Orders');

    const orderObj = getObj(orders, 'Order');
    const cd1 = getStr(orderObj, 'CollectionDate');
    if (cd1) return cd1;

    const rootOrder = getObj(j, 'Order');
    const cd2 = getStr(rootOrder, 'CollectionDate');
    if (cd2) return cd2;

    return null;
  }

  if (result.xml) {
    const cd = xmlGetFirst(result.xml, 'CollectionDate');
    return cd ?? null;
  }

  return null;
}

function parseApcDdMmYyyy(s: string): Date | null {
  // Expected: DD/MM/YYYY
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  const d = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0, 0));
  // basic sanity
  if (d.getUTCFullYear() !== yyyy || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd)
    return null;
  return d;
}

function isFutureApcCollectionDate(ddmmyyyy: string): boolean {
  const d = parseApcDdMmYyyy(ddmmyyyy);
  if (!d) return false;

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );

  return d.getTime() > todayUtc.getTime();
}

/* ------------------------------------------------------------------ */
/* PUBLIC API (used by your routes)                                    */
/* ------------------------------------------------------------------ */

export async function getServiceAvailability(args: {
  collectionDate: string;
  readyAt: string;
  closedAt: string;
  collectionPostcode: string;
  deliveryPostcode: string;
  collectionCountry: string;
  deliveryCountry: string;
  items: Array<{
    type: ApcItemType;
    weight: number;
    length: number;
    width: number;
    height: number;
    value: number;
    description?: string;
  }>;
}): Promise<ServiceOption[]> {
  const items: ApcShipmentItem[] = args.items.map((it) => ({
    Type: it.type,
    Weight: String(it.weight),
    Length: String(it.length),
    Width: String(it.width),
    Height: String(it.height),
    Value: String(it.value),
    ...(it.description ? { Description: it.description } : {})
  }));

  const payload: ApcServiceAvailabilityRequest = {
    Orders: {
      Order: {
        CollectionDate: args.collectionDate,
        ReadyAt: args.readyAt,
        ClosedAt: args.closedAt,
        Collection: { PostalCode: args.collectionPostcode, CountryCode: args.collectionCountry },
        Delivery: { PostalCode: args.deliveryPostcode, CountryCode: args.deliveryCountry },
        ShipmentDetails: {
          NumberOfPieces: String(items.length || 1),
          Items: { Item: items }
        }
      }
    }
  };

  const resp = await apcServiceAvailability(payload);

  const r = asRecord(resp);
  const sa = getObj(r, 'ServiceAvailability');
  const servicesWrap = getObj(sa, 'Services');
  const maybe = servicesWrap['Service'];

  const services = Array.isArray(maybe) ? maybe : maybe ? [maybe] : [];
  return services as ServiceOption[];
}

export async function placeOrder(payload: ApcCreateOrderPayload): Promise<{ waybill: string }> {
  const resp = await apcCreateOrder(payload);
  const waybill = apcExtractWaybillFromCreateResponse(resp);

  if (!waybill) {
    throw new Error(
      `APC create order did not return a WayBill. Raw: ${JSON.stringify(resp).slice(0, 800)}`
    );
  }

  return { waybill };
}

export interface ApcGetLabelWithPollingOptions {
  attempts?: number;
  initialDelayMs?: number;
  labelFormat?: 'PDF' | 'PNG' | 'ZPL';

  /**
   * Restored option:
   * When true, if APC reports a CollectionDate in the future, we abort polling early.
   * (Prevents hammering APC for labels that cannot exist yet.)
   */
  abortIfFutureCollectionDate?: boolean;
}

export async function getLabelWithPolling(
  waybill: string,
  opts?: {
    attempts?: number;
    delayMs?: number;
    labelFormat?: 'PDF' | 'PNG' | 'ZPL';
    abortIfFutureCollectionDate?: boolean;
  }
): Promise<{ mime: ApcMime; base64: string }> {
  const attempts = opts?.attempts ?? Number(process.env.APC_LABEL_RETRY ?? 40);
  const initialDelayMs = opts?.delayMs ?? Number(process.env.APC_LABEL_DELAY_MS ?? 3500);
  const abortIfFutureCollectionDate = opts?.abortIfFutureCollectionDate ?? false;

  await sleep(initialDelayMs);

  for (let i = 0; i < attempts; i++) {
    const result = await apcGetOrderByWaybill(waybill, undefined, {
      labelFormat: opts?.labelFormat ?? 'PDF',
      markPrinted: true,
      searchType: 'CarrierWaybill',
      labels: true
    });

    // ✅ Restored behaviour: abort early if future collection date (when enabled)
    if (abortIfFutureCollectionDate) {
      const cd = apcExtractCollectionDate(result);
      if (cd && isFutureApcCollectionDate(cd)) {
        // treat as "pending" rather than hard error
        throw new ApcLabelPendingError(waybill, i + 1);
      }
    }

    const label = apcExtractLabel(result);
    if (label) return label;

    await sleep(1500);
  }

  throw new ApcLabelPendingError(waybill, attempts);
}

export const apcGetLabelWithPolling = async (
  waybill: string,
  opts?: ApcGetLabelWithPollingOptions
) => {
  const label = await getLabelWithPolling(waybill, {
    attempts: opts?.attempts,
    delayMs: opts?.initialDelayMs,
    labelFormat: opts?.labelFormat,
    abortIfFutureCollectionDate: opts?.abortIfFutureCollectionDate
  });

  return { waybill, mime: label.mime, base64: label.base64 };
};

export function base64ToUint8Array(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}
