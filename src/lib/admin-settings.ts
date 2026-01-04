// src/lib/admin-settings.ts
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export interface ApcWarehouseSettings {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  postcode: string;
  countryCode: string; // e.g. "GB"
}

const KEY = 'apc.warehouse';

export async function getWarehouseSettings(): Promise<ApcWarehouseSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });

  // prefer ?? over ||
  const value = (row?.value ?? null) as Prisma.JsonValue | null;

  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return {
      companyName: String(v.companyName ?? ''),
      contactName: String(v.contactName ?? ''),
      email: String(v.email ?? ''),
      phone: String(v.phone ?? ''),
      address1: String(v.address1 ?? ''),
      address2: (v.address2 ?? '') as string,
      city: String(v.city ?? ''),
      postcode: String(v.postcode ?? ''),
      countryCode: String(v.countryCode ?? 'GB')
    };
  }

  // sensible defaults
  return {
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    postcode: '',
    countryCode: 'GB'
  };
}

export async function upsertWarehouseSettings(
  s: ApcWarehouseSettings
): Promise<ApcWarehouseSettings> {
  // Build a plain object and assert as Prisma.InputJsonValue
  const payload: Prisma.InputJsonValue = {
    companyName: s.companyName,
    contactName: s.contactName,
    email: s.email,
    phone: s.phone,
    address1: s.address1,
    address2: s.address2 ?? '',
    city: s.city,
    postcode: s.postcode,
    countryCode: s.countryCode
  };

  const existing = await prisma.appSetting.findUnique({ where: { key: KEY } });

  if (existing) {
    await prisma.appSetting.update({
      where: { key: KEY },
      data: { value: payload } // <-- satisfies Prisma type
    });
  } else {
    await prisma.appSetting.create({
      data: { key: KEY, value: payload } // <-- satisfies Prisma type
    });
  }

  return s;
}
