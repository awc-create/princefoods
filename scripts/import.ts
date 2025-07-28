import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { prisma } from '../src/lib/prisma';

const file = readFileSync('products.csv', 'utf8').replace(/^\uFEFF/, '');

const records = parse(file, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const seenHandles = new Set<string>();
let importedCount = 0;

async function main() {
  console.log('Parsed Headers:', Object.keys(records[0]));
  console.log('First row sample:', records[0]);

  for (let i = 0; i < records.length; i++) {
    const row = records[i];

    const handleId = row.handleId?.trim();
    if (!handleId) {
      console.warn(`⛔ Skipping row at index ${i} - Missing handleId`);
      continue;
    }

    if (row.fieldType !== 'Product' || seenHandles.has(handleId)) continue;

    const next = records[i + 1];
    seenHandles.add(handleId);

    const product = {
      id: handleId,
      fieldType: row.fieldType?.trim(),
      name: row.name?.trim(),
      description: row.description?.trim(),
      productImageUrl: row.productImageUrl?.trim(),
      collection: row.collection?.trim(),
      sku: next?.fieldType === 'Variant' ? next.sku?.trim() : row.sku?.trim(),
      ribbon: row.ribbon?.trim(),
      price: parseFloat(row.price || '0'),
      surcharge: parseFloat(row.surcharge || '0'),
      visible: row.visible?.toLowerCase() === 'true',
      discountMode: row.discountMode?.trim(),
      discountValue: parseFloat(row.discountValue || '0'),
      inventory: row.inventory?.trim(),
      weight: parseFloat(row.weight || '0'),
      cost: parseFloat(row.cost || '0'),

      // Options
      productOptionName1: row.productOptionName1,
      productOptionType1: row.productOptionType1,
      productOptionDescription1: row.productOptionDescription1,
      productOptionName2: row.productOptionName2,
      productOptionType2: row.productOptionType2,
      productOptionDescription2: row.productOptionDescription2,
      productOptionName3: row.productOptionName3,
      productOptionType3: row.productOptionType3,
      productOptionDescription3: row.productOptionDescription3,
      productOptionName4: row.productOptionName4,
      productOptionType4: row.productOptionType4,
      productOptionDescription4: row.productOptionDescription4,
      productOptionName5: row.productOptionName5,
      productOptionType5: row.productOptionType5,
      productOptionDescription5: row.productOptionDescription5,
      productOptionName6: row.productOptionName6,
      productOptionType6: row.productOptionType6,
      productOptionDescription6: row.productOptionDescription6,

      // Additional Info
      additionalInfoTitle1: row.additionalInfoTitle1,
      additionalInfoDescription1: row.additionalInfoDescription1,
      additionalInfoTitle2: row.additionalInfoTitle2,
      additionalInfoDescription2: row.additionalInfoDescription2,
      additionalInfoTitle3: row.additionalInfoTitle3,
      additionalInfoDescription3: row.additionalInfoDescription3,
      additionalInfoTitle4: row.additionalInfoTitle4,
      additionalInfoDescription4: row.additionalInfoDescription4,
      additionalInfoTitle5: row.additionalInfoTitle5,
      additionalInfoDescription5: row.additionalInfoDescription5,
      additionalInfoTitle6: row.additionalInfoTitle6,
      additionalInfoDescription6: row.additionalInfoDescription6,

      // Custom Fields
      customTextField1: row.customTextField1,
      customTextCharLimit1: parseInt(row.customTextCharLimit1 || '0'),
      customTextMandatory1: row.customTextMandatory1?.toLowerCase() === 'true',
      customTextField2: row.customTextField2,
      customTextCharLimit2: parseInt(row.customTextCharLimit2 || '0'),
      customTextMandatory2: row.customTextMandatory2?.toLowerCase() === 'true',

      brand: row.brand?.trim(),
    };

    await prisma.product.upsert({
      where: { id: product.id },
      update: product,
      create: product,
    });

    importedCount++;
  }

  console.log(`✅ Done importing ${importedCount} products.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
