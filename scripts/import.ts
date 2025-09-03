/* scripts/import.ts */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';
import slugify from '../src/utils/slugify'; // <-- uses your util

const prisma = new PrismaClient();

type Row = Record<string, string>;

const toBool = (v?: string | null) => !!v && /^true$/i.test((v ?? '').trim());
const toNum = (v?: string | null) => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const str = (r: Row, k: string) => (r[k]?.trim() ? r[k].trim() : '');

// Accept ; > / | as separators
function splitCollectionPath(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[;>\/|]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Ensure a parent category exists (first segment). Returns { id, slug }. */
async function ensureParentCategory(name: string) {
  const parentSlug = slugify(name);
  // try exact slug (parent has parentId null)
  const hit = await prisma.category.findUnique({
    where: { slug: parentSlug },
    select: { id: true, slug: true, parentId: true, name: true, isActive: true },
  });

  if (hit && hit.parentId === null) {
    if (!hit.isActive || hit.name !== name) {
      const updated = await prisma.category.update({
        where: { id: hit.id },
        data: { isActive: true, name },
        select: { id: true, slug: true },
      });
      return updated;
    }
    return { id: hit.id, slug: hit.slug };
  }

  // create or upsert
  const created = await prisma.category.upsert({
    where: { slug: parentSlug },
    update: { parentId: null, isActive: true, name },
    create: { name, slug: parentSlug, parentId: null, isActive: true },
    select: { id: true, slug: true },
  });
  return created;
}

/** Ensure a child category under given parent. Slug pattern: `${parentSlug}-${slugify(childName)}` (+suffix if needed). */
async function ensureChildCategory(childName: string, parentId: string, parentSlug: string) {
  const base = slugify(childName);
  let childSlug = `${parentSlug}-${base}`;

  // exact slug?
  const existing = await prisma.category.findUnique({
    where: { slug: childSlug },
    select: { id: true, slug: true, parentId: true, name: true, isActive: true },
  });

  if (existing && existing.parentId === parentId) {
    if (!existing.isActive || existing.name !== childName) {
      const updated = await prisma.category.update({
        where: { id: existing.id },
        data: { isActive: true, name: childName },
        select: { id: true, slug: true },
      });
      return updated;
    }
    return { id: existing.id, slug: existing.slug };
  }

  // slug in use under a different parent -> find free suffix
  if (existing && existing.parentId !== parentId) {
    let n = 2;
    while (
      await prisma.category.findUnique({
        where: { slug: `${parentSlug}-${base}-${n}` },
        select: { id: true },
      })
    ) {
      n++;
    }
    childSlug = `${parentSlug}-${base}-${n}`;
  }

  const created = await prisma.category.create({
    data: { name: childName, slug: childSlug, parentId, isActive: true },
    select: { id: true, slug: true },
  });
  return created;
}

/** Map a collection string to a categoryId: parent if 1 segment, otherwise the deepest child. */
async function resolveCategoryIdFromCollection(collection: string | null | undefined): Promise<string | null> {
  const parts = splitCollectionPath(collection);
  if (!parts.length) return null;

  const parentRes = await ensureParentCategory(parts[0]);
  if (parts.length === 1) return parentRes.id;

  const childName = parts[parts.length - 1];
  const childRes = await ensureChildCategory(childName, parentRes.id, parentRes.slug);
  return childRes.id;
}

async function main() {
  const file = process.argv[2] || path.resolve(process.cwd(), 'products.csv');
  const csv = fs.readFileSync(file, 'utf8');

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
    trim: true,
  }) as Row[];

  // group by handleId / id
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const handleId = (row.handleId || row.id || '').trim();
    if (!handleId) continue;
    if (!groups.has(handleId)) groups.set(handleId, []);
    groups.get(handleId)!.push(row);
  }

  let upserted = 0;
  let skipped = 0;

  for (const [handleId, group] of groups) {
    const productRow = group.find((r) => (r.fieldType || '').toLowerCase() === 'product') || group[0];
    const variantRow = group.find((r) => (r.fieldType || '').toLowerCase() === 'variant') || productRow;
    if (!productRow) {
      skipped++;
      continue;
    }

    const collection = str(productRow, 'collection') || null;

    // 👇 NEW: compute categoryId from collection string
    let categoryId: string | null = null;
    try {
      categoryId = await resolveCategoryIdFromCollection(collection);
    } catch (e) {
      console.warn(`Category resolve failed for ${handleId} (${collection ?? 'no collection'}):`, e);
    }

    const record = {
      id: handleId,
      fieldType: str(productRow, 'fieldType') || 'Product',
      name: str(productRow, 'name') || '(untitled)',
      description: str(productRow, 'description') || null,
      productImageUrl: str(productRow, 'productImageUrl') || null,
      collection, // keep the raw string for admin/reporting
      sku: str(variantRow, 'sku') || str(productRow, 'sku') || null,
      ribbon: str(productRow, 'ribbon') || null,
      price: toNum(variantRow.price ?? productRow.price) ?? null,
      surcharge: toNum(productRow.surcharge) ?? null,
      visible: toBool(productRow.visible), // if missing, this becomes false; change to ?? true if you prefer default true
      discountMode: str(productRow, 'discountMode') || null,
      discountValue: toNum(productRow.discountValue) ?? null,
      inventory: str(variantRow, 'inventory') || str(productRow, 'inventory') || null,
      weight: toNum(variantRow.weight ?? productRow.weight) ?? null,
      cost: toNum(productRow.cost) ?? null,
      productOptionName1: str(productRow, 'productOptionName1') || null,
      productOptionType1: str(productRow, 'productOptionType1') || null,
      productOptionDescription1: str(productRow, 'productOptionDescription1') || null,
      productOptionName2: str(productRow, 'productOptionName2') || null,
      productOptionType2: str(productRow, 'productOptionType2') || null,
      productOptionDescription2: str(productRow, 'productOptionDescription2') || null,
      productOptionName3: str(productRow, 'productOptionName3') || null,
      productOptionType3: str(productRow, 'productOptionType3') || null,
      productOptionDescription3: str(productRow, 'productOptionDescription3') || null,
      productOptionName4: str(productRow, 'productOptionName4') || null,
      productOptionType4: str(productRow, 'productOptionType4') || null,
      productOptionDescription4: str(productRow, 'productOptionDescription4') || null,
      productOptionName5: str(productRow, 'productOptionName5') || null,
      productOptionType5: str(productRow, 'productOptionType5') || null,
      productOptionDescription5: str(productRow, 'productOptionDescription5') || null,
      productOptionName6: str(productRow, 'productOptionName6') || null,
      productOptionType6: str(productRow, 'productOptionType6') || null,
      productOptionDescription6: str(productRow, 'productOptionDescription6') || null,
      additionalInfoTitle1: str(productRow, 'additionalInfoTitle1') || null,
      additionalInfoDescription1: str(productRow, 'additionalInfoDescription1') || null,
      additionalInfoTitle2: str(productRow, 'additionalInfoTitle2') || null,
      additionalInfoDescription2: str(productRow, 'additionalInfoDescription2') || null,
      additionalInfoTitle3: str(productRow, 'additionalInfoTitle3') || null,
      additionalInfoDescription3: str(productRow, 'additionalInfoDescription3') || null,
      additionalInfoTitle4: str(productRow, 'additionalInfoTitle4') || null,
      additionalInfoDescription4: str(productRow, 'additionalInfoDescription4') || null,
      additionalInfoTitle5: str(productRow, 'additionalInfoTitle5') || null,
      additionalInfoDescription5: str(productRow, 'additionalInfoDescription5') || null,
      additionalInfoTitle6: str(productRow, 'additionalInfoTitle6') || null,
      additionalInfoDescription6: str(productRow, 'additionalInfoDescription6') || null,
      customTextField1: str(productRow, 'customTextField1') || null,
      customTextCharLimit1: toNum(productRow.customTextCharLimit1) ?? null,
      customTextMandatory1: toBool(productRow.customTextMandatory1) || false,
      customTextField2: str(productRow, 'customTextField2') || null,
      customTextCharLimit2: toNum(productRow.customTextCharLimit2) ?? null,
      customTextMandatory2: toBool(productRow.customTextMandatory2) || false,
      brand: str(productRow, 'brand') || null,
      // 👇 NEW:
      categoryId, // parent if 1 segment, else deepest child
    };

    try {
      await prisma.product.upsert({
        where: { id: handleId },
        create: record,
        update: { ...record, createdAt: undefined as any },
      });
      upserted++;
    } catch (e) {
      console.error(`Upsert failed for ${handleId}:`, e);
      skipped++;
    }
  }

  console.log(`✅ Done: upserted=${upserted}, skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
