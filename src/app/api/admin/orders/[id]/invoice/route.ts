// src/app/api/admin/orders/[id]/invoice/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import fontkit from '@pdf-lib/fontkit';
import type { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

/* ====================================================================== */
/* Utilities                                                              */
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

function wrapText(args: { text: string; maxWidth: number; font: PDFFont; size: number }): string[] {
  const { text, maxWidth, font, size } = args;
  const words = (text ?? '').split(/\s+/);
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
    phoneE164?: string | null;
  } | null
) {
  if (!a) return ['—'];
  return [
    [a.firstName ?? '', a.lastName ?? ''].filter(Boolean).join(' ').trim(),
    a.line1 ?? '',
    a.line2 ?? '',
    [a.city ?? '', a.postcode ?? ''].filter(Boolean).join(' ').trim(),
    a.country ?? '',
    a.phoneE164 ?? ''
  ].filter(Boolean);
}

/* Company constants */
const COMPANY = {
  name: 'Prince Foods UK Ltd',
  addr: ['Unit C 55 Riverside Way', 'Uxbridge', 'Middlesex', 'UB8 2YF'],
  phone: '+07912104109',
  email: 'info.uk@prince-foods.com',
  web: 'www.prince-foods.com',
  regA: 'Company Registration No.',
  regB: '06213491',
  bank: {
    bank: 'Barclays Bank',
    accName: 'Prince Foods UK LTD',
    accNo: '90806188',
    sort: '20-42-76',
    payee: 'Cheques payable to Prince Foods UK LTD'
  }
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const variant = (url.searchParams.get('v') ?? 'invoice').toLowerCase() as 'invoice' | 'receipt';

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

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const { reg, bold } = loadFonts();
  const fontReg = reg ? await pdf.embedFont(reg) : await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = bold
    ? await pdf.embedFont(bold)
    : await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([595, 842]); // A4
  const M = 40;
  const W = page.getWidth() - M * 2;
  const L = M;
  const R = M + W;
  let y = page.getHeight() - M;

  // palette
  const TITLE_COLOR = rgb(0.49, 0.16, 0.28); // mauve (title + bottom rule)
  const RULE_COLOR = TITLE_COLOR;
  const GREY = rgb(0.34, 0.34, 0.34);
  const LIGHT_GREY = rgb(0.85, 0.85, 0.85);
  const BAND = rgb(0.91, 0.82, 0.86); // mauve-ish header band
  const DOT_GREY = rgb(0.78, 0.78, 0.78);

  /* ---------- Header (sample-matched layout) ---------- */
  let topY = page.getHeight() - M;

  // Company block (left)
  {
    const x = L;
    const line = (t: string, size = 11, dy = 14, f: PDFFont = fontReg) => {
      page.drawText(t, { x, y: topY, size, font: f });
      topY -= dy;
    };

    line(COMPANY.name, 16, 18, fontBold);
    for (const ln of COMPANY.addr) line(ln);
    line(COMPANY.phone);
    line(COMPANY.email);
    line(COMPANY.web);
    line(COMPANY.regA, 11, 14);
    line(COMPANY.regB, 11, 14);
  }

  // Centered logo (top-middle)
  try {
    const png = path.join(process.cwd(), 'public', 'assets', 'prince-foods-logo.png');
    const jpg = path.join(process.cwd(), 'public', 'assets', 'prince-foods-logo.jpg');
    let bytes: Uint8Array | null = null;
    if (exists(png)) bytes = fs.readFileSync(png);
    else if (exists(jpg)) bytes = fs.readFileSync(jpg);

    if (bytes) {
      const img = await pdf.embedPng(bytes).catch(async () => await pdf.embedJpg(bytes!));
      const maxW = 210,
        maxH = 90;
      const s = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * s,
        h = img.height * s;

      const xCenter = L + W / 2 - w / 2;
      const logoY = page.getHeight() - M - 12 - h;
      // keep it from overlapping the left text block
      page.drawImage(img, { x: Math.max(xCenter, L + 220), y: logoY, width: w, height: h });
    }
  } catch {
    /* ignore logo issues */
  }

  /* ---------- Title + Dual Row (INVOICE TO left + Meta right) ---------- */

  /* Move the entire section up or down by changing this number */
  const TITLE_TOP = page.getHeight() - M - 170; // try 150–180 to taste

  /* 1) Title — "INVOICE" or "RECEIPT" on its own line */
  page.drawText(variant === 'receipt' ? 'RECEIPT' : 'INVOICE', {
    x: L,
    y: TITLE_TOP,
    size: 26,
    font: fontBold,
    color: TITLE_COLOR
  });

  /* 2) Now drop the "INVOICE TO" + Meta pair below it */
  const TRIO_TOP = TITLE_TOP - 30; // vertical gap below title

  // ---- Left column: INVOICE TO + address ----
  let leftY = TRIO_TOP;
  page.drawText('INVOICE TO', { x: L, y: leftY, size: 12, font: fontBold });
  leftY -= 16;
  for (const ln of addressLines(order.billingAddress ?? order.shippingAddress ?? null)) {
    page.drawText(ln, { x: L, y: leftY, size: 11, font: fontReg });
    leftY -= 14;
  }
  const leftBottomY = leftY;

  // ---- Right column: invoice meta ----
  const labelX = R - 220;
  const valueX = R - 40;
  const metaTop = TRIO_TOP + 8;
  const invNo = order.displayId ?? order.id.slice(0, 8).toUpperCase();
  const dateStr = order.createdAt.toLocaleDateString('en-GB');

  const putMeta = (label: string, value: string, row: number) => {
    const yy = metaTop - 16 * row;
    page.drawText(label, { x: labelX, y: yy, size: 12, font: fontBold });
    const tw = fontReg.widthOfTextAtSize(value, 12);
    page.drawText(value, { x: valueX - tw, y: yy, size: 12, font: fontReg });
  };

  putMeta('INVOICE NO.', invNo, 0);
  putMeta('DATE', dateStr, 1);
  putMeta('DUE DATE', dateStr, 2);
  putMeta('TERMS', 'Due on receipt', 3);

  const metaBottomY = metaTop - 16 * 4;

  /* Draw mauve rule beneath whichever side is lower */
  const afterHeaderY = Math.min(leftBottomY, metaBottomY) - 12;
  page.drawLine({
    start: { x: L, y: afterHeaderY },
    end: { x: R, y: afterHeaderY },
    thickness: 1,
    color: RULE_COLOR
  });

  /* Continue below this line */
  y = afterHeaderY - 18;

  /* ---------- Table Header ---------- */
  const bandH = 24;
  page.drawRectangle({ x: L, y: y - bandH, width: W, height: bandH, color: BAND });

  // center header labels inside the band
  const hdrY = y - bandH / 2 - 5;
  const cActivityX = L + 10;
  const cQtyC = R - 210;
  const cRateC = R - 130;
  const cAmtR = R - 10;

  const drawHdr = (text: string, x: number, align: 'L' | 'C' | 'R') => {
    const f = fontBold,
      sz = 10.5;
    const tw = f.widthOfTextAtSize(text, sz);
    const xx = align === 'L' ? x : align === 'C' ? x - tw / 2 : x - tw;
    page.drawText(text, { x: xx, y: hdrY, size: sz, font: f });
  };
  drawHdr('ACTIVITY', cActivityX, 'L');
  drawHdr('QTY', cQtyC, 'C');
  drawHdr('RATE', cRateC, 'C');
  drawHdr('AMOUNT', cAmtR, 'R');

  // rule under the band, then a generous safety gap
  y -= bandH + 2;
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: LIGHT_GREY });

  // ====== ITEMS AREA CONTROLS (tweak these to move content down) ======
  const HEADER_TO_ROWS_GAP = 60; // ↑ bigger = push whole items table DOWN from the band
  const ROW_MIN_HEIGHT = 26; // ↑ bigger = taller rows overall
  const ROW_TOP_PADDING = 8; // ↑ bigger = push product text DOWN inside each row
  const NAME_BASELINE_NUDGE = -2; // negative = lower the product name lines
  const SUBLINE_NUDGE = -1; // negative = lower the grey "£x × qty" line
  const NUM_BASELINE_NUDGE = -4; // negative = lower Qty/Rate/Amount numbers
  // ====================================================================

  y -= HEADER_TO_ROWS_GAP;

  /* ---------- Rows ---------- */
  const rowGap = 8;

  const ensureRoom = (min: number) => {
    if (y < M + min) {
      page = pdf.addPage([595, 842]);
      y = page.getHeight() - M;

      // continuation mini header
      page.drawText(`${variant === 'receipt' ? 'RECEIPT' : 'INVOICE'} • ${invNo}`, {
        x: L,
        y,
        size: 12,
        font: fontBold
      });
      y -= 14;
      page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: LIGHT_GREY });
      y -= 12;

      // re-draw table header
      page.drawRectangle({ x: L, y: y - bandH, width: W, height: bandH, color: BAND });
      const hdrY2 = y - bandH / 2 - 5;
      const h = (t: string, x: number, a: 'L' | 'C' | 'R') => {
        const f = fontBold,
          sz = 10.5;
        const tw = f.widthOfTextAtSize(t, sz);
        const xx = a === 'L' ? x : a === 'C' ? x - tw / 2 : x - tw;
        page.drawText(t, { x: xx, y: hdrY2, size: sz, font: f });
      };
      h('ACTIVITY', cActivityX, 'L');
      h('QTY', cQtyC, 'C');
      h('RATE', cRateC, 'C');
      h('AMOUNT', cAmtR, 'R');

      y -= bandH + 2;
      page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: LIGHT_GREY });
      y -= HEADER_TO_ROWS_GAP;
    }
  };

  for (const it of order.items) {
    ensureRoom(120);

    const main = it.name ?? 'Item';
    const subParts = [`${money(it.unitPrice, order.currency)} x ${it.quantity}`];
    if (it.sku) subParts.push(`SKU ${it.sku}`);
    const sub = subParts.join(' • ');

    // Activity column width
    const actMax = cQtyC - 24 - cActivityX;
    const mainLines = wrapText({ text: main, maxWidth: actMax, font: fontReg, size: 11.5 }).slice(
      0,
      2
    );
    const hasSub = Boolean(sub);

    // overall row height + top padding
    const rowH = Math.max(
      ROW_MIN_HEIGHT,
      mainLines.length * 13 + (hasSub ? 12 : 0) + ROW_TOP_PADDING
    );

    // product name lines
    let ny = y + rowH - 12 - ROW_TOP_PADDING + NAME_BASELINE_NUDGE;
    for (const ln of mainLines) {
      page.drawText(ln, { x: cActivityX, y: ny, size: 11.5, font: fontReg });
      ny -= 13;
    }
    if (hasSub) {
      page.drawText(sub, {
        x: cActivityX,
        y: ny + SUBLINE_NUDGE,
        size: 10,
        font: fontReg,
        color: GREY
      });
    }

    // Qty / Rate / Amount — baseline nudged
    const cellBaseY = y + rowH - 12 + NUM_BASELINE_NUDGE;
    const drawC = (xC: number, txt: string, size = 11) => {
      const tw = fontReg.widthOfTextAtSize(txt, size);
      page.drawText(txt, { x: xC - tw / 2, y: cellBaseY, size, font: fontReg });
    };
    const drawR = (xR: number, txt: string, size = 11) => {
      const tw = fontReg.widthOfTextAtSize(txt, size);
      page.drawText(txt, { x: xR - tw, y: cellBaseY, size, font: fontReg });
    };
    drawC(cQtyC, String(it.quantity));
    drawC(cRateC, money(it.unitPrice, order.currency));
    drawR(cAmtR, money(it.lineTotal, order.currency));

    // next row
    y -= rowH + rowGap;

    // row rule
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.35, color: LIGHT_GREY });
    y -= 6;
  }

  /* ---------- Dotted separator before footer + totals ---------- */
  y -= 8;
  const dots = 120;
  const dotW = (W - 10) / dots;
  let dx = L + 2;
  for (let i = 0; i < dots; i++) {
    page.drawLine({
      start: { x: dx, y },
      end: { x: dx + dotW * 0.55, y },
      thickness: 0.6,
      color: DOT_GREY
    });
    dx += dotW;
  }

  /* ======================================================================
   FOOTER + TOTALS (same baseline) — CONTROLS
   Increase FOOTER_TOP_OFFSET to push BOTH columns DOWN together.
   Decrease to move them UP. Units are PDF points.
====================================================================== */
  const FOOTER_TOP_OFFSET = 16; // ↑ bigger = lower on page; ↓ smaller = higher
  const FOOTER_LINE_GAP = 14; // spacing between lines in both columns
  const BIG_BALANCE_NUDGE = -4; // fine nudge for the big amount relative to totals

  // Starting Y for both columns (same baseline)
  let footerTop = y - FOOTER_TOP_OFFSET;

  // Keep a little safety margin from the bottom; paginate if needed
  if (footerTop < M + 100) {
    page = pdf.addPage([595, 842]);
    y = page.getHeight() - M;
    // re-draw a light rule so the footer has context on the new page
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: LIGHT_GREY });
    y -= 12;
    footerTop = y - FOOTER_TOP_OFFSET;
  }

  /* ---------- Footer banking details (LEFT) ---------- */
  const footLines = [
    COMPANY.bank.payee,
    COMPANY.bank.bank,
    `Account name - ${COMPANY.bank.accName}`,
    `Account Number- ${COMPANY.bank.accNo}`,
    `Sort Code- ${COMPANY.bank.sort}`
  ];
  let fy = footerTop;
  for (const ln of footLines) {
    page.drawText(ln, { x: L, y: fy, size: 10.5, font: fontReg, color: GREY });
    fy -= FOOTER_LINE_GAP;
  }

  /* ---------- Totals (RIGHT) aligned to the same baseline ---------- */
  const subtotal = order.subtotal ?? 0;
  const discount = order.discountTotal ?? 0;
  const tax = order.taxTotal ?? 0;
  const shipping = order.shippingTotal ?? 0;
  const grand = order.grandTotal ?? subtotal - discount + tax + shipping;

  // normalize payment status for comparison (avoid TS union issues)
  const statusStr = String(order.paymentStatus ?? '').toLowerCase();
  const isPaid = statusStr === 'paid' || statusStr === 'succeeded' || statusStr === 'captured';
  const paid = variant === 'receipt' || isPaid ? grand : 0;
  const balance = variant === 'receipt' ? 0 : Math.max(grand - paid, 0);

  const tx = R - 220;
  let ty = footerTop; // <-- same baseline as left column

  const rowR = (label: string, val: string, boldRow = false) => {
    page.drawText(label, { x: tx, y: ty, size: 11.5, font: boldRow ? fontBold : fontReg });
    const f = boldRow ? fontBold : fontReg;
    const tw = f.widthOfTextAtSize(val, 11.5);
    page.drawText(val, { x: R - tw, y: ty, size: 11.5, font: f });
    ty -= FOOTER_LINE_GAP;
  };

  rowR('SUBTOTAL', money(subtotal, order.currency));
  if (shipping > 0) rowR('SHIPPING', money(shipping, order.currency));
  if (discount > 0) rowR('DISCOUNT', `-${money(discount, order.currency)}`);
  if (tax > 0) rowR('TAX', money(tax, order.currency));
  rowR('TOTAL', money(grand, order.currency), true);
  if (paid > 0) rowR('AMOUNT PAID', money(paid, order.currency), true);

  // Big balance due, aligned with right edge; nudge if needed
  ty += BIG_BALANCE_NUDGE; // optional fine tune
  page.drawText('BALANCE DUE', { x: tx, y: ty + 4, size: 12, font: fontBold });
  const BIG = 20;
  const bigVal = money(balance, order.currency);
  const twBig = fontBold.widthOfTextAtSize(bigVal, BIG);
  page.drawText(bigVal, { x: R - twBig, y: ty, size: BIG, font: fontBold });

  // Move y below the lowest of the two columns (for any future content/hooks)
  y = Math.min(fy, ty) - 12;

  /* ---------- Output ---------- */
  const titleSlug = variant === 'receipt' ? 'receipt' : 'invoice';
  const fileBase = order.displayId ? `${order.displayId}` : `${order.id.slice(0, 8)}`;
  const filename = `${fileBase}-${titleSlug}.pdf`;
  const bytes = await pdf.save();
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  return new Response(ab as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store'
    }
  });
}
