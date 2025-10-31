// src/app/api/admin/orders/[id]/packing-slip/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import fontkit from '@pdf-lib/fontkit';
import type { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface AddressLike {
  firstName: string | null;
  lastName: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  phoneE164: string | null;
}

function money(pence: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format((pence ?? 0) / 100);
}
const fmtKg = (g?: number | null) =>
  g && g > 0 ? `${(g / 1000).toFixed(g >= 10000 ? 1 : 2)} kg` : '—';
const fmtG = (g?: number | null) => (g && g > 0 ? `${g} g` : '—');

function exists(p: string) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function loadLogo(): { kind: 'png' | 'jpg'; bytes: Uint8Array } | null {
  const png = path.join(process.cwd(), 'public', 'assets', 'prince-foods-logo.png');
  const jpg = path.join(process.cwd(), 'public', 'assets', 'prince-foods-logo.jpg');
  if (exists(png)) return { kind: 'png', bytes: fs.readFileSync(png) };
  if (exists(jpg)) return { kind: 'jpg', bytes: fs.readFileSync(jpg) };
  return null;
}

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

function addressLines(a: AddressLike | null | undefined): string[] {
  if (!a) return ['—'];
  return [
    [a.firstName ?? '', a.lastName ?? ''].filter(Boolean).join(' ').trim(),
    a.line1,
    a.line2 ?? '',
    [a.city ?? '', a.postcode ?? ''].filter(Boolean).join(' ').trim(),
    a.country
  ].filter(Boolean) as string[];
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const variant = (url.searchParams.get('v') ?? url.searchParams.get('variant') ?? 'plain')
    .toLowerCase()
    .trim() as 'plain' | 'weights';

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, shippingAddress: true, billingAddress: true }
  });

  if (!order) {
    return new Response(JSON.stringify({ ok: false, error: 'Order not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // --- Build PDF ---
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const { reg, bold } = loadFonts();
  const fontReg = reg ? await pdf.embedFont(reg) : await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = bold
    ? await pdf.embedFont(bold)
    : await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([595, 842]); // A4
  const margin = 40;
  const width = page.getWidth() - margin * 2;
  const left = margin;
  const right = margin + width;
  let y = page.getHeight() - margin;

  // --- HEADER ---
  const logo = loadLogo();
  if (logo) {
    const img =
      logo.kind === 'png' ? await pdf.embedPng(logo.bytes) : await pdf.embedJpg(logo.bytes);
    const maxW = 130,
      maxH = 58;
    const scale = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * scale,
      h = img.height * scale;
    page.drawImage(img, { x: left, y: y - h, width: w, height: h });
    y -= Math.max(h, 60) + 14;
  } else {
    y -= 60;
  }

  const title = variant === 'weights' ? 'PACKING SLIP (WITH WEIGHTS)' : 'PACKING SLIP';
  page.drawText(title, {
    x: right - fontBold.widthOfTextAtSize(title, 28),
    y: page.getHeight() - margin - 10,
    size: 28,
    font: fontBold
  });

  // --- META ---
  const meta = [
    `Order: ${order.displayId ?? order.id}`,
    `Placed: ${order.createdAt.toLocaleString('en-GB')}`,
    `Status: ${order.status}  •  Payment: ${order.paymentStatus}`
  ];
  for (const line of meta) {
    page.drawText(line, { x: left, y, size: 11, font: fontReg, color: rgb(0, 0, 0) });
    y -= 14;
  }
  y -= 8;

  // --- ADDRESSES ---
  const colW = Math.floor(width / 2) - 10;
  const addrBlock = (heading: string, a: AddressLike | null | undefined, x: number, y0: number) => {
    page.drawText(heading, { x, y: y0, size: 12, font: fontBold });
    let dy = y0 - 16;
    for (const line of addressLines(a)) {
      page.drawText(line, { x, y: dy, size: 11, font: fontReg });
      dy -= 13;
    }
    return dy;
  };

  const yAddrStart = y;
  const yAfterShip = addrBlock('Ship To', order.shippingAddress, left, yAddrStart);
  const yAfterBill = addrBlock('Bill To', order.billingAddress, left + colW + 20, yAddrStart);
  y = Math.min(yAfterShip, yAfterBill) - 10;

  // --- TABLE HEADERS ---
  page.drawText('Items', { x: left, y, size: 13, font: fontBold });
  y -= 18;

  // Header band (grey)
  const headerBandH = 24;
  page.drawRectangle({
    x: left,
    y: y - headerBandH,
    width,
    height: headerBandH,
    color: rgb(0.96, 0.96, 0.96)
  });

  const headerFontSize = 10;
  const headerY = y - headerBandH / 2 - headerFontSize / 2 + 1;

  // === KNOBS ===
  // Space between the header bottom rule and the first row:
  const HEADER_TO_ROWS_GAP = 22; // increase to push rows further DOWN
  // Vertical nudge for words inside each row (negative = down, positive = up):
  const ROW_CONTENT_NUDGE = -2;

  // Helpers
  const drawRight = (xRight: number, text: string, yy: number, size: number, bold = false) => {
    const f = bold ? fontBold : fontReg;
    const tw = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: xRight - tw, y: yy, size, font: f });
  };
  const drawCenter = (xCenter: number, text: string, yy: number, size: number, bold = false) => {
    const f = bold ? fontBold : fontReg;
    const tw = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: xCenter - tw / 2, y: yy, size, font: f });
  };
  const _hdrR = (edge: number, txt: string) =>
    page.drawText(txt, {
      x: edge - fontBold.widthOfTextAtSize(txt, headerFontSize),
      y: headerY,
      size: headerFontSize,
      font: fontBold
    });
  const hdrCenter = (xCenter: number, text: string) =>
    page.drawText(text, {
      x: xCenter - fontBold.widthOfTextAtSize(text, headerFontSize) / 2,
      y: headerY,
      size: headerFontSize,
      font: fontBold
    });

  // --- COLUMN LAYOUTS ---

  // PLAIN — centered: Product | Qty | Price | SKU | Total (Total right-aligned)
  const p_qtyC = right - 210;
  const p_priceC = right - 150;
  const p_skuC = right - 90;
  const p_totalR = right - 20;

  // small per-column nudges to taste
  const NUDGE_P = { qty: -4, price: 0, sku: -6, total: 0 } as const;

  const colsPlain = {
    nameX: left + 8,
    // keep product text at least 20pt away from Qty center
    nameW: p_qtyC + NUDGE_P.qty - 20 - (left + 8),

    qtyC: p_qtyC + NUDGE_P.qty,
    priceC: p_priceC + NUDGE_P.price,
    skuC: p_skuC + NUDGE_P.sku,
    totalR: p_totalR + NUDGE_P.total
  } as const;

  // WEIGHTS — centered: Product | Qty | Price | T Wt. | SKU | Total (Total right-aligned)
  const w_qtyC = right - 200;
  const w_priceC = right - 140;
  const w_lineWtC = right - 90; // "T Wt." (total line weight)
  const w_skuC = right - 50;
  const w_totalR = right - 10;

  const NUDGE_W = { qty: -6, price: 0, lineWt: -8, sku: -10, total: +6 } as const;

  const colsW = {
    nameX: left + 8,
    // keep product text 20pt away from the Qty center
    nameW: w_qtyC + NUDGE_W.qty - 20 - (left + 8),

    qtyC: w_qtyC + NUDGE_W.qty,
    priceC: w_priceC + NUDGE_W.price,
    lineWtC: w_lineWtC + NUDGE_W.lineWt,
    skuC: w_skuC + NUDGE_W.sku,
    totalR: w_totalR + NUDGE_W.total
  } as const;

  const useWeights = variant === 'weights';

  // HEADERS
  if (useWeights) {
    page.drawText('Product', { x: colsW.nameX, y: headerY, size: headerFontSize, font: fontBold });
    hdrCenter(colsW.qtyC, 'Qty');
    hdrCenter(colsW.priceC, 'Price');
    hdrCenter(colsW.lineWtC, 'T Wt.');
    hdrCenter(colsW.skuC, 'SKU');
    page.drawText('Total', {
      x: colsW.totalR - fontBold.widthOfTextAtSize('Total', headerFontSize),
      y: headerY,
      size: headerFontSize,
      font: fontBold
    });
  } else {
    page.drawText('Product', {
      x: colsPlain.nameX,
      y: headerY,
      size: headerFontSize,
      font: fontBold
    });
    hdrCenter(colsPlain.qtyC, 'Qty');
    hdrCenter(colsPlain.priceC, 'Price');
    hdrCenter(colsPlain.skuC, 'SKU');
    page.drawText('Total', {
      x: colsPlain.totalR - fontBold.widthOfTextAtSize('Total', headerFontSize),
      y: headerY,
      size: headerFontSize,
      font: fontBold
    });
  }

  // header bottom rule + extra gap before first row
  y -= headerBandH + 2;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8)
  });
  y -= HEADER_TO_ROWS_GAP; // move the whole first row DOWN by increasing this

  // --- ROWS ---
  let totalWeight = 0;

  for (const it of order.items) {
    const qty = it.quantity;
    const unitW = it.unitWeightGrams ?? 0;
    const lineW = unitW * qty;
    totalWeight += lineW;

    // Wrap long names (max 2 lines)
    const name = it.name ?? '';
    const maxWidth = useWeights ? colsW.nameW : colsPlain.nameW;
    const words = name.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (fontReg.widthOfTextAtSize(t, 10) <= maxWidth) cur = t;
      else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);

    const numLines = Math.min(2, lines.length || 1);
    const rowH = Math.max(12, numLines * 12);

    // vertically center row text, then nudge DOWN
    const cellBaseY = y + rowH / 2 - 10 / 2 + ROW_CONTENT_NUDGE;

    // Product name block (also nudged)
    const nameBlockH = numLines * 12;
    let ny = y + (rowH - nameBlockH) / 2 + (12 - 10) + ROW_CONTENT_NUDGE;
    for (const ln of lines.slice(0, numLines)) {
      page.drawText(ln, {
        x: useWeights ? colsW.nameX : colsPlain.nameX,
        y: ny,
        size: 10,
        font: fontReg
      });
      ny += 12;
    }

    if (useWeights) {
      drawCenter(colsW.qtyC, String(qty), cellBaseY, 10);
      drawCenter(colsW.priceC, money(it.unitPrice, order.currency), cellBaseY, 10);
      drawCenter(colsW.lineWtC, fmtG(lineW), cellBaseY, 10);
      drawCenter(colsW.skuC, it.sku ?? '—', cellBaseY, 10);
      drawRight(colsW.totalR, money(it.lineTotal, order.currency), cellBaseY, 10);
    } else {
      drawCenter(colsPlain.qtyC, String(qty), cellBaseY, 10);
      drawCenter(colsPlain.priceC, money(it.unitPrice, order.currency), cellBaseY, 10);
      drawCenter(colsPlain.skuC, it.sku ?? '—', cellBaseY, 10);
      drawRight(colsPlain.totalR, money(it.lineTotal, order.currency), cellBaseY, 10);
    }

    y -= rowH + 6;
  }

  // divider under table (below the rows)
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8)
  });
  y -= 12;

  // --- TOTALS CARD ---
  const cardW = 260;
  const cardH = variant === 'weights' ? 120 : 100;
  const cardX = right - cardW;
  const centerY = (margin + (page.getHeight() - margin - cardH)) / 2;
  let cardY = Math.min(centerY, y - cardH - 8);
  if (cardY < margin + 40) cardY = margin + 40;

  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1
  });

  const row = (label: string, value: string, boldRow = false, yy: number) => {
    page.drawText(label, { x: cardX + 14, y: yy, size: 11, font: boldRow ? fontBold : fontReg });
    drawRight(cardX + cardW - 14, value, yy, 11, boldRow);
  };

  let ty = cardY + cardH - 22;
  row('Subtotal', money(order.subtotal, order.currency), false, ty);
  ty -= 16;
  row('Shipping', money(order.shippingTotal, order.currency), false, ty);
  ty -= 16;
  if (order.discountTotal > 0) {
    row('Discount', `-${money(order.discountTotal, order.currency)}`, false, ty);
    ty -= 16;
  }
  if (order.taxTotal > 0) {
    row('Tax', money(order.taxTotal, order.currency), false, ty);
    ty -= 16;
  }
  row('Grand Total', money(order.grandTotal, order.currency), true, ty);
  ty -= 16;
  if (variant === 'weights')
    row('Total weight', fmtKg(order.totalWeightGrams ?? totalWeight), true, ty);

  // --- FOOTER ---
  page.drawText(
    'Customer copy excludes pricing. This slip is for packing/internal use. For support: info.uk@prince-foods.com',
    { x: left, y: cardY - 26, size: 9, font: fontReg, color: rgb(0.4, 0.4, 0.4) }
  );

  // --- OUTPUT ---
  const bytes = await pdf.save();
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  const filename = `${order.displayId ?? order.id}-packing-slip${variant === 'weights' ? '-weights' : ''}.pdf`;
  return new Response(ab as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store'
    }
  });
}
