"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/backfill-wix-images.ts
// Run with: npx ts-node scripts/backfill-wix-images.ts
const prisma_1 = require("@/lib/prisma");
const WIX_MEDIA_HOST = 'https://static.wixstatic.com';
const WIX_MEDIA_PREFIX = `${WIX_MEDIA_HOST}/media/`;
const WIX_ID_RE = /^[0-9a-f]{6,}_[^/]+~mv2\.[a-z0-9]+$/i;
async function main() {
    const products = await prisma_1.prisma.product.findMany({
        select: { id: true, productImageUrl: true },
    });
    let fixed = 0;
    for (const p of products) {
        const v = p.productImageUrl;
        if (!v)
            continue;
        let newUrl = null;
        if (WIX_ID_RE.test(v))
            newUrl = WIX_MEDIA_PREFIX + v;
        else if (v.startsWith('/media/'))
            newUrl = WIX_MEDIA_HOST + v;
        if (newUrl) {
            await prisma_1.prisma.product.update({
                where: { id: p.id },
                data: { productImageUrl: newUrl },
            });
            fixed++;
        }
    }
    console.log('Backfilled', fixed, 'product image URLs.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma_1.prisma.$disconnect());
