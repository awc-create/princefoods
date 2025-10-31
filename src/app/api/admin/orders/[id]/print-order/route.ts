// src/app/api/admin/orders/[id]/print-order/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import fontkit from '@pdf-lib/fontkit';
import type { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

/* ====================================================================== */
/* =                           UTILITIES                                = */
/* ====================================================================== */

const exists = (p: string) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};

function loadFonts() {
  const regA = path.join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf');
  const regB = path.join(process.cwd(), 'public', 'fonts', 'Inter_18pt-Regular.ttf');
  const boldA = path.join(process.cwd(), 'public', 'fonts', 'Inter-Bold.ttf');
  const boldB = path.join(process.cwd(), 'public', 'fonts', 'Inter_18pt-Bold.ttf');
  const reg = exists(regA) ? regA : exists(regB) ? regB : null;
  const bold = exists(boldA) ? boldA : exists(boldB) ? boldB : null;
  return {
    reg: reg ? fs.readFileSync(reg) : null,
    bold: bold ? fs.readFileSync(bold) : null
  };
}

const money = (p: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format((p ?? 0) / 100);

const fmtKg = (g?: number | null) =>
  g && g > 0 ? `${(g / 1000).toFixed(g >= 10000 ? 1 : 2)} kg` : '—';

/** Pull bytes from local path, http(s), or Next proxy */
async function loadImageBytes(src?: string | null): Promise<Uint8Array | null> {
  if (!src) return null;
  let url = src.trim();
  if (!url) return null;

  // unwrap Next.js image optimizer URLs
  if (url.startsWith('/_next/image')) {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost';
    const u = new URL(url, base);
    const real = u.searchParams.get('url');
    if (real) url = real;
  }

  // local file
  if (!/^https?:\/\//i.test(url)) {
    const abs = url.startsWith('/') ? path.join(process.cwd(), 'public', url) : url;
    if (exists(abs)) return fs.readFileSync(abs);
    return null;
  }

  // remote fetch
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const ab = await r.arrayBuffer();
    return new Uint8Array(ab);
  } catch {
    return null;
  }
}

/** Draw a circular thumbnail (avatar look) */
async function drawCircleThumb(params: {
  pdf: PDFDocument;
  page: PDFPage;
  x: number;
  y: number; // bottom-left of the circle box
  size: number; // diameter
  urlOrBytes?: string | Uint8Array | null;
}) {
  const { pdf, page, x, y, size, urlOrBytes } = params;

  // pale circle background
  page.drawEllipse({
    x: x + size / 2,
    y: y + size / 2,
    xScale: size / 2,
    yScale: size / 2,
    color: rgb(0.96, 0.96, 0.96)
  });

  let bytes: Uint8Array | null = null;
  if (urlOrBytes instanceof Uint8Array) bytes = urlOrBytes;
  else if (typeof urlOrBytes === 'string') bytes = await loadImageBytes(urlOrBytes);
  if (!bytes) return;

  // embed image (try PNG then JPG)
  let img;
  try {
    img = await pdf.embedPng(bytes);
  } catch {
    img = await pdf.embedJpg(bytes);
  }

  // contain-fit inside circle
  const scale = Math.min(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, { x: x + (size - w) / 2, y: y + (size - h) / 2, width: w, height: h });
}

/** Word-wrap to a max width */
function wrapText(args: { text: string; maxWidth: number; font: PDFFont; size: number }): string[] {
  const { text, maxWidth, font, size } = args;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) <= maxWidth) cur = t;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function addressLines(
  a?: {
    firstName: string | null;
    lastName: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    postcode: string | null;
    country: string | null;
  } | null
) {
  if (!a) return ['—'];
  return [
    [a.firstName ?? '', a.lastName ?? ''].filter(Boolean).join(' ').trim(),
    a.line1 ?? '',
    a.line2 ?? '',
    [a.city ?? '', a.postcode ?? ''].filter(Boolean).join(' ').trim(),
    a.country ?? ''
  ].filter(Boolean);
}

/* ====================================================================== */
/* =                         REQUEST HANDLER                             = */
/* ====================================================================== */

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  /* -------------------------- params + data --------------------------- */
  const { id } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      user: true,
      shippingAddress: true,
      billingAddress: true
    }
  });

  if (!order) {
    return new Response(JSON.stringify({ ok: false, error: 'Order not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /* --------------------------- PDF setup ----------------------------- */
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const { reg, bold } = loadFonts();
  const fontReg = reg ? await pdf.embedFont(reg) : await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = bold
    ? await pdf.embedFont(bold)
    : await pdf.embedFont(StandardFonts.HelveticaBold);

  // A4 page + layout constants
  let page = pdf.addPage([595, 842]);
  const M = 28;
  const W = page.getWidth() - M * 2;
  const L = M;
  const R = M + W;

  // palette / spacing knobs
  const ROW_THUMB = 64;
  const ROW_GAP = 18;
  const HR_THICK = 1;
  const BAND_COLOR = rgb(0.9, 0.9, 0.9);
  const GREY = rgb(0.35, 0.35, 0.35);

  // product text knobs
  const NAME_SIZE = 13;
  const NAME_MAX_LINES = 2;
  const NAME_RIGHT_PAD = 18;

  // columns
  const X_THUMB = L;
  const X_NAME = L + ROW_THUMB + 20;
  const X_UNIT = R - 220;
  const X_QTY = R - 150;
  const X_LINE = R - 36;

  let y = page.getHeight() - M;

  /* ----------------------------- Header ------------------------------ */
  try {
    // (1) Date at very top-right on its own line
    const META_SIZE = 12;
    const placed = `Placed on ${order.createdAt.toLocaleString('en-GB', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })}`;
    const placedTw = fontReg.widthOfTextAtSize(placed, META_SIZE);
    page.drawText(placed, {
      x: R - placedTw,
      y: y + 14,
      size: META_SIZE,
      font: fontReg,
      color: GREY
    });

    // (2) Row below: [LOGO]  Title   and directly below: Name | Email
    const LOGO_MAX_W = 130;
    const LOGO_MAX_H = 58;
    const TITLE_SIZE = 18;
    const INFO_SIZE = 12;

    // logo bytes
    const logoPng = path.join(process.cwd(), 'public', 'assets', 'prince-foods-logo.png');
    const logoJpg = path.join(process.cwd(), 'public', 'assets', 'prince-foods-logo.jpg');
    let logoBytes: Uint8Array | null = null;
    if (exists(logoPng)) logoBytes = fs.readFileSync(logoPng);
    else if (exists(logoJpg)) logoBytes = fs.readFileSync(logoJpg);
    else logoBytes = await loadImageBytes('/assets/prince-foods-logo.png');

    const rowTop = y; // anchor for the logo/text block
    let logoW = 0;
    let logoH = 0;

    if (logoBytes) {
      let img;
      try {
        img = await pdf.embedPng(logoBytes);
      } catch {
        img = await pdf.embedJpg(logoBytes);
      }
      const s = Math.min(LOGO_MAX_W / img.width, LOGO_MAX_H / img.height);
      logoW = img.width * s;
      logoH = img.height * s;
      const logoY = rowTop - logoH + 6;
      page.drawImage(img, { x: L, y: logoY, width: logoW, height: logoH });
    }

    // text block to the right of logo
    const textX = L + logoW + 18;

    // Title (first line)
    const title = `Order #${order.displayId ?? order.id} (${order.items.length} item${
      order.items.length === 1 ? '' : 's'
    })`;

    // place title roughly centered to logo height
    const titleY = rowTop - logoH + 6 + logoH / 2 - TITLE_SIZE / 2 + 6;
    page.drawText(title, { x: textX, y: titleY, size: TITLE_SIZE, font: fontBold });

    // Info directly below title (second line)
    const info = [order.user?.name ?? '', order.contactEmail ?? ''].filter(Boolean).join(' | ');
    const infoY = titleY - (INFO_SIZE + 6);
    page.drawText(info, { x: textX, y: infoY, size: INFO_SIZE, font: fontReg });

    // Advance below header
    const textBlockBottom = infoY - 2;
    const usedHeaderH = Math.max(logoH + 12, rowTop - textBlockBottom, 64);
    y = rowTop - usedHeaderH;
  } catch {
    // fallback: still keep date, then two-line text without logo
    const META_SIZE = 12;
    const placed = `Placed on ${order.createdAt.toLocaleString('en-GB', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })}`;
    const placedTw = fontReg.widthOfTextAtSize(placed, META_SIZE);
    page.drawText(placed, {
      x: R - placedTw,
      y: y + 14,
      size: META_SIZE,
      font: fontReg,
      color: GREY
    });

    const TITLE_SIZE = 18;
    const INFO_SIZE = 12;
    const title = `Order #${order.displayId ?? order.id} (${order.items.length} item${
      order.items.length === 1 ? '' : 's'
    })`;
    page.drawText(title, { x: L, y: y + 4, size: TITLE_SIZE, font: fontBold });

    const info = [order.user?.name ?? '', order.contactEmail ?? ''].filter(Boolean).join(' | ');
    page.drawText(info, { x: L, y: y - (INFO_SIZE + 4), size: INFO_SIZE, font: fontReg });

    y -= 64;
  }

  // Divider under header
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: HR_THICK, color: BAND_COLOR });
  y -= 12;

  /* ------------------------------ Items ------------------------------ */
  const titleForContinuation = `Order #${order.displayId ?? order.id}`;

  const drawContinuationHeader = async () => {
    // called on new pages to keep branding consistent
    let xText = L;
    try {
      const logoPng = path.join(process.cwd(), 'public', 'assets', 'prince-foods-logo.png');
      const logoJpg = path.join(process.cwd(), 'public', 'assets', 'prince-foods-logo.jpg');
      let logoBytes: Uint8Array | null = null;

      if (exists(logoPng)) logoBytes = fs.readFileSync(logoPng);
      else if (exists(logoJpg)) logoBytes = fs.readFileSync(logoJpg);

      if (logoBytes) {
        const img = (await pdf
          .embedPng(logoBytes)
          .catch(async () => await pdf.embedJpg(logoBytes!)))!;
        const s = Math.min(80 / img.width, 32 / img.height);
        const w = img.width * s;
        const h = img.height * s;
        page.drawImage(img, { x: L, y: y - h + 4, width: w, height: h });
        xText = L + w + 12;
      }
    } catch {
      // ignore logo error on continuation
    }
    page.drawText(titleForContinuation, { x: xText, y: y - 2, size: 16, font: fontBold });
    y -= 20;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: HR_THICK, color: BAND_COLOR });
    y -= 12;
  };

  const drawRow = async (p: (typeof order.items)[number], isLast: boolean) => {
    // thumbnail (fallback to logo)
    const fallback = path.join(process.cwd(), 'public', 'assets', 'prince-foods-logo.png');
    const bytes =
      (await loadImageBytes(p.imageUrl ?? '')) ??
      (exists(fallback) ? fs.readFileSync(fallback) : null);

    await drawCircleThumb({
      pdf,
      page,
      x: X_THUMB,
      y: y - ROW_THUMB,
      size: ROW_THUMB,
      urlOrBytes: bytes
    });

    // product title (wrapped)
    const maxNameWidth = Math.max(50, X_UNIT - NAME_RIGHT_PAD - X_NAME);
    const nameLines = wrapText({
      text: p.name,
      maxWidth: maxNameWidth,
      font: fontBold,
      size: NAME_SIZE
    }).slice(0, NAME_MAX_LINES);

    let ny = y - 8;
    for (const line of nameLines) {
      page.drawText(line, { x: X_NAME, y: ny, size: NAME_SIZE, font: fontBold });
      ny -= NAME_SIZE + 2;
    }

    // SKU + FROZEN flag
    const metaY = Math.min(y - ROW_THUMB + 18, ny - 6);
    page.drawText(`SKU: ${p.sku ?? '—'}`, {
      x: X_NAME,
      y: metaY,
      size: 11,
      font: fontReg,
      color: GREY
    });

    const isFrozen = /\bfrozen\b/i.test(p.name);
    page.drawText('FROZEN:', { x: X_NAME, y: metaY - 16, size: 11, font: fontBold, color: GREY });
    page.drawText(isFrozen ? 'Yes' : 'No', {
      x: X_NAME + 64,
      y: metaY - 16,
      size: 11,
      font: fontReg
    });

    // unit / qty / line total
    const unitStr = money(p.unitPrice, order.currency);
    const qtyStr = `x ${p.quantity}`;
    const lineStr = money(p.lineTotal, order.currency);

    const unitTw = fontReg.widthOfTextAtSize(unitStr, 13);
    const qtyTw = fontReg.widthOfTextAtSize(qtyStr, 13);
    const lineTw = fontBold.widthOfTextAtSize(lineStr, 14);

    const colsY = y - 12;
    page.drawText(unitStr, { x: X_UNIT - unitTw / 2, y: colsY, size: 13, font: fontReg });
    page.drawText(qtyStr, { x: X_QTY - qtyTw / 2, y: colsY, size: 13, font: fontReg });
    page.drawText(lineStr, { x: X_LINE - lineTw, y: colsY, size: 14, font: fontBold });

    // row divider
    page.drawLine({
      start: { x: L, y: y - ROW_THUMB - 8 },
      end: { x: R, y: y - ROW_THUMB - 8 },
      thickness: 0.6,
      color: rgb(0.8, 0.8, 0.8)
    });

    // advance
    y -= ROW_THUMB + ROW_GAP;

    // paginate if tight
    if (!isLast && y < M + 140) {
      y = page.getHeight() - M;
      page = pdf.addPage([595, 842]);
      await drawContinuationHeader();
    }
  };

  for (let i = 0; i < order.items.length; i++) {
    await drawRow(order.items[i], i === order.items.length - 1);
  }

  /* ------------------ Totals & Customer Info section ----------------- */

  // compute weight (fallback if not denormalized)
  const computedWeight =
    order.totalWeightGrams ??
    order.items.reduce((sum, it) => sum + (it.unitWeightGrams ?? 0) * it.quantity, 0);

  // ensure room for end section
  const END_MIN_SPACE = 300;
  if (y < M + END_MIN_SPACE) {
    page = pdf.addPage([595, 842]);
    y = page.getHeight() - M;
    await drawContinuationHeader();
  }

  /* ------------------------------ Totals ------------------------------ */
  const cardW = 260;
  const cardX = R - cardW;
  const lineH = 18;

  // push the totals block LOWER on the page (increase magnitude to move further down)
  const TOTALS_Y_OFFSET = -10;
  let ty = y + TOTALS_Y_OFFSET;

  const drawRowR = (label: string, val: string, boldRow = false) => {
    page.drawText(label, { x: cardX, y: ty, size: 12, font: boldRow ? fontBold : fontReg });
    const tw = (boldRow ? fontBold : fontReg).widthOfTextAtSize(val, 12);
    page.drawText(val, {
      x: cardX + cardW - tw,
      y: ty,
      size: 12,
      font: boldRow ? fontBold : fontReg
    });
    ty -= lineH;
  };

  // thin divider above totals
  page.drawLine({
    start: { x: cardX, y: ty + 10 },
    end: { x: cardX + cardW, y: ty + 10 },
    thickness: 0.6,
    color: rgb(0.75, 0.75, 0.75)
  });

  // spacing before "Subtotal"
  const TOTALS_TOP_SPACER = 8;
  ty -= TOTALS_TOP_SPACER;

  drawRowR('Subtotal', money(order.subtotal, order.currency));
  drawRowR('Shipping', money(order.shippingTotal, order.currency));
  if (order.taxTotal > 0) drawRowR('Tax', money(order.taxTotal, order.currency));
  if (order.discountTotal > 0)
    drawRowR('Discount', `-${money(order.discountTotal, order.currency)}`);

  // underline then grand total
  page.drawLine({
    start: { x: cardX, y: ty + 8 },
    end: { x: cardX + cardW, y: ty + 8 },
    thickness: 1.1,
    color: rgb(0.25, 0.25, 0.25)
  });

  // spacing between underline and "Total"
  const GRAND_TOTAL_TOP_SPACER = 8;
  ty -= GRAND_TOTAL_TOP_SPACER;

  drawRowR('Total', money(order.grandTotal, order.currency), true);
  drawRowR('Total weight', fmtKg(computedWeight), true);

  const totalsBottomY = ty - 6;

  /* --------------------------- Customer Info ------------------------- */

  // extra breathing room under totals
  const CUSTOMER_INFO_EXTRA_GAP = 24;
  let blockTopY = totalsBottomY - CUSTOMER_INFO_EXTRA_GAP;

  // section title
  page.drawText('Customer Info', { x: L, y: blockTopY, size: 18, font: fontBold });
  blockTopY -= 12;

  // columns: left (Shipping) / right (Billing)
  const colGap = 36;
  const colW = Math.floor((W - colGap) / 2);
  const shipX = L;
  const billX = L + colW + colGap;

  const drawAddressCol = (x: number, heading: string, lines: string[]) => {
    let yy = blockTopY - 20;
    page.drawText(heading, { x, y: yy, size: 15, font: fontBold });
    yy -= 18;
    for (const line of lines) {
      page.drawText(line, { x, y: yy, size: 12.5, font: fontReg });
      yy -= 16;
    }
    return yy;
  };

  const shipLines = addressLines(order.shippingAddress);
  const billLines = addressLines(order.billingAddress);

  const shipLastY = drawAddressCol(shipX, 'Shipping Address', shipLines);
  const billLastY = drawAddressCol(billX, 'Billing Address', billLines);

  // footer notes under each column
  const shipNoteY = shipLastY - 10;
  const billNoteY = billLastY - 10;

  const shippingNote = 'Shipping (Free over £30)';
  const paymentNote =
    order.paymentProvider || order.paymentStatus
      ? `Paid via ${order.paymentProvider ?? ''} ${order.paymentStatus ?? ''}`.trim()
      : '—';

  page.drawText(shippingNote, { x: shipX, y: shipNoteY, size: 11.5, font: fontReg, color: GREY });
  page.drawText(paymentNote, { x: billX, y: billNoteY, size: 11.5, font: fontReg, color: GREY });

  // move y below the lowest part (future content hook)
  y = Math.min(shipNoteY, billNoteY) - 12;

  /* ------------------------------ Output ----------------------------- */
  const bytes = await pdf.save();
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const filename = `${order.displayId ?? order.id}-picker.pdf`;

  return new Response(ab as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store'
    }
  });
}
