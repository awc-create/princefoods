"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/scripts/backfill-weights.ts
const parse_weight_1 = require("@/lib/parse-weight");
const prisma_1 = require("@/lib/prisma");
async function main() {
    const products = await prisma_1.prisma.product.findMany({
        select: { id: true, name: true, weight: true }
    });
    let updates = 0;
    for (const p of products) {
        if (p.weight != null)
            continue; // skip already set
        const parsed = (0, parse_weight_1.parseWeightToGrams)(p.name);
        if (!parsed)
            continue;
        await prisma_1.prisma.product.update({
            where: { id: p.id },
            data: { weight: parsed.grams / 1000 }
        });
        updates++;
    }
    console.log(`Backfill complete. Updated ${updates} products.`);
}
main().finally(() => prisma_1.prisma.$disconnect());
