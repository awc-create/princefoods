import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

function intOrNull(val: unknown): number | null {
  if (val == null || String(val).trim() === '') return null;
  const n = Math.trunc(Number(val));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(_req: Request, ctx: unknown) {
  const { params } = ctx as { params: { id: string } };
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(req: Request, ctx: unknown) {
  const { params } = ctx as { params: { id: string } };
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const updated = await prisma.product.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.sku !== undefined ? { sku: body.sku as string | null } : {}),
      ...(body.price !== undefined ? { price: body.price as number | null } : {}),
      ...(body.inventory !== undefined ? { inventory: body.inventory as string | null } : {}),
      ...(body.collection !== undefined ? { collection: body.collection as string | null } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId as string | null } : {}),
      ...(body.productImageUrl !== undefined
        ? { productImageUrl: body.productImageUrl as string | null }
        : {}),
      ...(body.description !== undefined ? { description: body.description as string | null } : {}),
      ...(body.visible !== undefined ? { visible: Boolean(body.visible) } : {}),
      ...(body.caseQty !== undefined ? { caseQty: intOrNull(body.caseQty) } : {}),
      ...(body.brand !== undefined ? { brand: body.brand as string | null } : {}),
      ...(body.ribbon !== undefined ? { ribbon: body.ribbon as string | null } : {}),
      ...(body.discountMode !== undefined
        ? { discountMode: body.discountMode as string | null }
        : {}),
      ...(body.discountValue !== undefined
        ? { discountValue: body.discountValue as number | null }
        : {}),
      ...(body.shippingWeightGrams !== undefined
        ? { shippingWeightGrams: intOrNull(body.shippingWeightGrams) }
        : {}),
      ...(body.shippingTemp !== undefined
        ? { shippingTemp: body.shippingTemp as 'DRY' | 'FROZEN' }
        : {}),
      ...(Array.isArray(body.tags) ? { tags: body.tags as string[] } : {}),
      ...(body.productOptionName1 !== undefined
        ? { productOptionName1: body.productOptionName1 as string | null }
        : {}),
      ...(body.productOptionType1 !== undefined
        ? { productOptionType1: body.productOptionType1 as string | null }
        : {}),
      ...(body.productOptionDescription1 !== undefined
        ? { productOptionDescription1: body.productOptionDescription1 as string | null }
        : {}),
      ...(body.productOptionName2 !== undefined
        ? { productOptionName2: body.productOptionName2 as string | null }
        : {}),
      ...(body.productOptionType2 !== undefined
        ? { productOptionType2: body.productOptionType2 as string | null }
        : {}),
      ...(body.productOptionDescription2 !== undefined
        ? { productOptionDescription2: body.productOptionDescription2 as string | null }
        : {}),
      ...(body.productOptionName3 !== undefined
        ? { productOptionName3: body.productOptionName3 as string | null }
        : {}),
      ...(body.productOptionType3 !== undefined
        ? { productOptionType3: body.productOptionType3 as string | null }
        : {}),
      ...(body.productOptionDescription3 !== undefined
        ? { productOptionDescription3: body.productOptionDescription3 as string | null }
        : {}),
      ...(body.productOptionName4 !== undefined
        ? { productOptionName4: body.productOptionName4 as string | null }
        : {}),
      ...(body.productOptionType4 !== undefined
        ? { productOptionType4: body.productOptionType4 as string | null }
        : {}),
      ...(body.productOptionDescription4 !== undefined
        ? { productOptionDescription4: body.productOptionDescription4 as string | null }
        : {}),
      ...(body.productOptionName5 !== undefined
        ? { productOptionName5: body.productOptionName5 as string | null }
        : {}),
      ...(body.productOptionType5 !== undefined
        ? { productOptionType5: body.productOptionType5 as string | null }
        : {}),
      ...(body.productOptionDescription5 !== undefined
        ? { productOptionDescription5: body.productOptionDescription5 as string | null }
        : {}),
      ...(body.productOptionName6 !== undefined
        ? { productOptionName6: body.productOptionName6 as string | null }
        : {}),
      ...(body.productOptionType6 !== undefined
        ? { productOptionType6: body.productOptionType6 as string | null }
        : {}),
      ...(body.productOptionDescription6 !== undefined
        ? { productOptionDescription6: body.productOptionDescription6 as string | null }
        : {}),
      ...(body.productOptionName7 !== undefined
        ? { productOptionName7: body.productOptionName7 as string | null }
        : {}),
      ...(body.productOptionType7 !== undefined
        ? { productOptionType7: body.productOptionType7 as string | null }
        : {}),
      ...(body.productOptionDescription7 !== undefined
        ? { productOptionDescription7: body.productOptionDescription7 as string | null }
        : {}),
      ...(body.productOptionName8 !== undefined
        ? { productOptionName8: body.productOptionName8 as string | null }
        : {}),
      ...(body.productOptionType8 !== undefined
        ? { productOptionType8: body.productOptionType8 as string | null }
        : {}),
      ...(body.productOptionDescription8 !== undefined
        ? { productOptionDescription8: body.productOptionDescription8 as string | null }
        : {}),
      ...(body.productOptionName9 !== undefined
        ? { productOptionName9: body.productOptionName9 as string | null }
        : {}),
      ...(body.productOptionType9 !== undefined
        ? { productOptionType9: body.productOptionType9 as string | null }
        : {}),
      ...(body.productOptionDescription9 !== undefined
        ? { productOptionDescription9: body.productOptionDescription9 as string | null }
        : {}),
      ...(body.productOptionName10 !== undefined
        ? { productOptionName10: body.productOptionName10 as string | null }
        : {}),
      ...(body.productOptionType10 !== undefined
        ? { productOptionType10: body.productOptionType10 as string | null }
        : {}),
      ...(body.productOptionDescription10 !== undefined
        ? { productOptionDescription10: body.productOptionDescription10 as string | null }
        : {}),
      ...(body.productOptionName11 !== undefined
        ? { productOptionName11: body.productOptionName11 as string | null }
        : {}),
      ...(body.productOptionType11 !== undefined
        ? { productOptionType11: body.productOptionType11 as string | null }
        : {}),
      ...(body.productOptionDescription11 !== undefined
        ? { productOptionDescription11: body.productOptionDescription11 as string | null }
        : {}),
      ...(body.productOptionName12 !== undefined
        ? { productOptionName12: body.productOptionName12 as string | null }
        : {}),
      ...(body.productOptionType12 !== undefined
        ? { productOptionType12: body.productOptionType12 as string | null }
        : {}),
      ...(body.productOptionDescription12 !== undefined
        ? { productOptionDescription12: body.productOptionDescription12 as string | null }
        : {}),
      ...(body.productOptionName13 !== undefined
        ? { productOptionName13: body.productOptionName13 as string | null }
        : {}),
      ...(body.productOptionType13 !== undefined
        ? { productOptionType13: body.productOptionType13 as string | null }
        : {}),
      ...(body.productOptionDescription13 !== undefined
        ? { productOptionDescription13: body.productOptionDescription13 as string | null }
        : {}),
      ...(body.productOptionName14 !== undefined
        ? { productOptionName14: body.productOptionName14 as string | null }
        : {}),
      ...(body.productOptionType14 !== undefined
        ? { productOptionType14: body.productOptionType14 as string | null }
        : {}),
      ...(body.productOptionDescription14 !== undefined
        ? { productOptionDescription14: body.productOptionDescription14 as string | null }
        : {}),
      ...(body.productOptionName15 !== undefined
        ? { productOptionName15: body.productOptionName15 as string | null }
        : {}),
      ...(body.productOptionType15 !== undefined
        ? { productOptionType15: body.productOptionType15 as string | null }
        : {}),
      ...(body.productOptionDescription15 !== undefined
        ? { productOptionDescription15: body.productOptionDescription15 as string | null }
        : {}),
      ...(body.additionalInfoTitle1 !== undefined
        ? { additionalInfoTitle1: body.additionalInfoTitle1 as string | null }
        : {}),
      ...(body.additionalInfoDescription1 !== undefined
        ? { additionalInfoDescription1: body.additionalInfoDescription1 as string | null }
        : {}),
      ...(body.additionalInfoTitle2 !== undefined
        ? { additionalInfoTitle2: body.additionalInfoTitle2 as string | null }
        : {}),
      ...(body.additionalInfoDescription2 !== undefined
        ? { additionalInfoDescription2: body.additionalInfoDescription2 as string | null }
        : {}),
      ...(body.additionalInfoTitle3 !== undefined
        ? { additionalInfoTitle3: body.additionalInfoTitle3 as string | null }
        : {}),
      ...(body.additionalInfoDescription3 !== undefined
        ? { additionalInfoDescription3: body.additionalInfoDescription3 as string | null }
        : {}),
      ...(body.additionalInfoTitle4 !== undefined
        ? { additionalInfoTitle4: body.additionalInfoTitle4 as string | null }
        : {}),
      ...(body.additionalInfoDescription4 !== undefined
        ? { additionalInfoDescription4: body.additionalInfoDescription4 as string | null }
        : {}),
      ...(body.additionalInfoTitle5 !== undefined
        ? { additionalInfoTitle5: body.additionalInfoTitle5 as string | null }
        : {}),
      ...(body.additionalInfoDescription5 !== undefined
        ? { additionalInfoDescription5: body.additionalInfoDescription5 as string | null }
        : {}),
      ...(body.additionalInfoTitle6 !== undefined
        ? { additionalInfoTitle6: body.additionalInfoTitle6 as string | null }
        : {}),
      ...(body.additionalInfoDescription6 !== undefined
        ? { additionalInfoDescription6: body.additionalInfoDescription6 as string | null }
        : {}),
      ...(body.additionalInfoTitle7 !== undefined
        ? { additionalInfoTitle7: body.additionalInfoTitle7 as string | null }
        : {}),
      ...(body.additionalInfoDescription7 !== undefined
        ? { additionalInfoDescription7: body.additionalInfoDescription7 as string | null }
        : {}),
      ...(body.additionalInfoTitle8 !== undefined
        ? { additionalInfoTitle8: body.additionalInfoTitle8 as string | null }
        : {}),
      ...(body.additionalInfoDescription8 !== undefined
        ? { additionalInfoDescription8: body.additionalInfoDescription8 as string | null }
        : {}),
      ...(body.additionalInfoTitle9 !== undefined
        ? { additionalInfoTitle9: body.additionalInfoTitle9 as string | null }
        : {}),
      ...(body.additionalInfoDescription9 !== undefined
        ? { additionalInfoDescription9: body.additionalInfoDescription9 as string | null }
        : {}),
      ...(body.additionalInfoTitle10 !== undefined
        ? { additionalInfoTitle10: body.additionalInfoTitle10 as string | null }
        : {}),
      ...(body.additionalInfoDescription10 !== undefined
        ? { additionalInfoDescription10: body.additionalInfoDescription10 as string | null }
        : {})
    }
  });

  return NextResponse.json({ ok: true, product: updated });
}
