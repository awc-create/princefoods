// src/app/api/admin/products/import/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/* -------------------------------------------
   Image URL detection + normalization
   (handles Wix bare ids, /media paths, wix:image://v1/,
    Google Drive / Photos, and regular URLs)
------------------------------------------- */

const WIX_MEDIA_HOST = 'https://static.wixstatic.com';
const WIX_MEDIA_PREFIX = `${WIX_MEDIA_HOST}/media/`;
// e.g. 96bfc4_a4613d3675074b0b97f11a2f8093f585~mv2.webp
const WIX_ID_RE = /^[0-9a-f]{6,}_[^/]+~mv2\.[a-z0-9]+$/i;

type ImgDetect =
  | { url: string; source: 'wix' | 'wix-id' | 'wix-media' | 'wix-image-v1' | 'google-drive' | 'google-photos' | 'google-static' | 'other' }
  | { url: null; source: 'invalid' };

function detectAndNormalizeImageUrl(input: any): ImgDetect {
  if (!input) return { url: null, source: 'invalid' };
  let s = String(input).trim();
  if (!s) return { url: null, source: 'invalid' };

  // protocol-relative → https
  if (s.startsWith('//')) s = 'https:' + s;

  // 1) Bare Wix media id
  if (WIX_ID_RE.test(s)) {
    return { url: WIX_MEDIA_PREFIX + s, source: 'wix-id' };
  }

  // 2) Wix /media/... path
  if (s.startsWith('/media/')) {
    return { url: WIX_MEDIA_HOST + s, source: 'wix-media' };
  }

  // 3) wix:image://v1/... → pull last segment if it looks like an id
  if (s.startsWith('wix:image://v1/')) {
    const last = s.split('/').pop();
    if (last && WIX_ID_RE.test(last)) {
      return { url: WIX_MEDIA_PREFIX + last, source: 'wix-image-v1' };
    }
    // fallthrough to URL handling
  }

  // try to salvage odd characters so new URL() succeeds
  try {
    new URL(s);
  } catch {
    s = encodeURI(s);
  }

  if (!/^https?:\/\//i.test(s)) return { url: null, source: 'invalid' };

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { url: null, source: 'invalid' };
  }

  const host = u.hostname.toLowerCase();

  // Google Drive → convert share links to direct "view"
  if (host === 'drive.google.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    const fileIndex = parts.indexOf('file');
    let id: string | null = null;

    if (fileIndex !== -1) {
      const dIndex = parts.indexOf('d', fileIndex);
      if (dIndex !== -1 && parts[dIndex + 1]) id = parts[dIndex + 1];
    }
    if (!id) id = u.searchParams.get('id');

    if (id) {
      const direct = new URL('https://drive.google.com/uc');
      direct.searchParams.set('export', 'view');
      direct.searchParams.set('id', id);
      return { url: direct.toString(), source: 'google-drive' };
    }
    return { url: null, source: 'invalid' };
  }

  if (host.endsWith('googleusercontent.com') || host.endsWith('ggpht.com')) {
    return { url: u.toString(), source: 'google-photos' };
  }

  if (host.endsWith('gstatic.com')) {
    return { url: u.toString(), source: 'google-static' };
  }

  if (host === 'static.wixstatic.com' || host.endsWith('.wixstatic.com')) {
    return { url: u.toString(), source: 'wix' };
  }

  return { url: u.toString(), source: 'other' };
}

/* -------------------------------------------
   CSV parsing helpers (no external deps)
------------------------------------------- */

function parseCSV(csv: string) {
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [] as string[], rows: [] as any[] };

  const headers = splitCSVLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const cols = splitCSVLine(line);
    const obj: any = {};
    headers.forEach((h, i) => obj[h] = (cols[i] ?? '').trim());
    return obj;
  });
  return { headers, rows };
}

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQ = false; }
      } else {
        cur += c;
      }
    } else {
      if (c === ',') { out.push(cur); cur = ''; }
      else if (c === '"') { inQ = true; }
      else { cur += c; }
    }
  }
  out.push(cur);
  return out;
}

function normalizeKeys(o: any) {
  const out: any = {};
  for (const k of Object.keys(o)) out[k.replace(/\s+/g,'').toLowerCase()] = o[k];
  return out;
}

function truthy(val: any): boolean | undefined {
  const v = String(val || '').trim().toUpperCase();
  if (v === 'TRUE') return true;
  if (v === 'FALSE') return false;
  return undefined;
}

function numOrNull(val: any): number | null {
  if (val === '' || val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function pick<T extends object>(obj: any, keys: (keyof any)[]): Partial<T> {
  const out: any = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

/* -------------------------------------------
   Map CSV row → Prisma Product data
------------------------------------------- */

function mapToProductCreate(id: string, r: any) {
  const detected = detectAndNormalizeImageUrl(r.productimageurl || r.image || null);

  return {
    id,
    fieldType: r.fieldtype || 'Product',
    name: r.name || '',
    description: r.description || null,

    // normalized image URL (supports Wix, Drive/Photos, others)
    productImageUrl: detected.url,

    collection: r.collection || null,
    sku: r.sku || null,
    ribbon: r.ribbon || null,
    price: numOrNull(r.price),
    surcharge: numOrNull(r.surcharge),
    visible: truthy(r.visible) ?? true,
    discountMode: r.discountmode || null,
    discountValue: numOrNull(r.discountvalue),
    inventory: r.inventory || null,
    weight: numOrNull(r.weight),
    cost: numOrNull(r.cost),

    productOptionName1: r.productoptionname1 || null,
    productOptionType1: r.productoptiontype1 || null,
    productOptionDescription1: r.productoptiondescription1 || null,
    productOptionName2: r.productoptionname2 || null,
    productOptionType2: r.productoptiontype2 || null,
    productOptionDescription2: r.productoptiondescription2 || null,
    productOptionName3: r.productoptionname3 || null,
    productOptionType3: r.productoptiontype3 || null,
    productOptionDescription3: r.productoptiondescription3 || null,
    productOptionName4: r.productoptionname4 || null,
    productOptionType4: r.productoptiontype4 || null,
    productOptionDescription4: r.productoptiondescription4 || null,
    productOptionName5: r.productoptionname5 || null,
    productOptionType5: r.productoptiontype5 || null,
    productOptionDescription5: r.productoptiondescription5 || null,
    productOptionName6: r.productoptionname6 || null,
    productOptionType6: r.productoptiontype6 || null,
    productOptionDescription6: r.productoptiondescription6 || null,

    additionalInfoTitle1: r.additionalinfotitle1 || null,
    additionalInfoDescription1: r.additionalinfodescription1 || null,
    additionalInfoTitle2: r.additionalinfotitle2 || null,
    additionalInfoDescription2: r.additionalinfodescription2 || null,
    additionalInfoTitle3: r.additionalinfotitle3 || null,
    additionalInfoDescription3: r.additionalinfodescription3 || null,
    additionalInfoTitle4: r.additionalinfotitle4 || null,
    additionalInfoDescription4: r.additionalinfodescription4 || null,
    additionalInfoTitle5: r.additionalinfotitle5 || null,
    additionalInfoDescription5: r.additionalinfodescription5 || null,
    additionalInfoTitle6: r.additionalinfotitle6 || null,
    additionalInfoDescription6: r.additionalinfodescription6 || null,

    customTextField1: r.customtextfield1 || null,
    customTextCharLimit1: r.customtextcharlimit1 ? Number(r.customtextcharlimit1) : null,
    customTextMandatory1: truthy(r.customtextmandatory1) ?? null,
    customTextField2: r.customtextfield2 || null,
    customTextCharLimit2: r.customtextcharlimit2 ? Number(r.customtextcharlimit2) : null,
    customTextMandatory2: truthy(r.customtextmandatory2) ?? null,

    brand: r.brand || null,
  };
}

function mapToProductUpdate(r: any) {
  const d: any = mapToProductCreate('ignore', r);
  delete d.id;
  return d;
}

/* -------------------------------------------
   POST /api/admin/products/import
------------------------------------------- */

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as 'HEAD' | 'STAFF' | 'VIEWER' | undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ message: 'Invalid form data' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ message: 'Missing file' }, { status: 400 });

  const text = await file.text();
  const { headers, rows } = parseCSV(text);
  if (rows.length === 0) return NextResponse.json({ message: 'Empty file' }, { status: 400 });

  const hasFieldType = headers.map(h => h.toLowerCase()).includes('fieldtype');

  let upserted = 0, skipped = 0;

  if (hasFieldType) {
    // Wix-style: pair "Product" + "Variant" by handleId
    type Acc = Record<string, { product?: any; variant?: any }>;
    const acc: Acc = {};

    for (const r of rows) {
      const row = normalizeKeys(r);
      const handleId = (row.handleid || row.handleId || '').trim();
      const fieldType = (row.fieldtype || row.fieldType || '').trim();
      if (!handleId) { skipped++; continue; }

      acc[handleId] ||= {};
      if (fieldType === 'Product') acc[handleId].product = row;
      else if (fieldType === 'Variant') acc[handleId].variant = row;
      else acc[handleId].product = { ...(acc[handleId].product || {}), ...row };
    }

    for (const id of Object.keys(acc)) {
      const p = acc[id].product || {};
      const v = acc[id].variant || {};
      // Variant can override sku/price/inventory/weight AND image fields
      const merged = { ...p, ...pick(v, ['sku', 'price', 'inventory', 'weight', 'productimageurl', 'image']) };

      try {
        await prisma.product.upsert({
          where: { id },
          update: mapToProductUpdate(merged),
          create: mapToProductCreate(id, merged),
        });
        upserted++;
      } catch {
        skipped++;
      }
    }
  } else {
    // Simple CSV (no fieldType) — allow id or handleId as primary key
    for (const r of rows) {
      const row = normalizeKeys(r);
      const id = (row.id || row.handleid || '').trim();
      const name = (row.name || '').trim();
      if (!id || !name) { skipped++; continue; }

      try {
        await prisma.product.upsert({
          where: { id },
          update: mapToProductUpdate(row),
          create: mapToProductCreate(id, row),
        });
        upserted++;
      } catch {
        skipped++;
      }
    }
  }

  return NextResponse.json({ ok: true, upserted, skipped });
}
