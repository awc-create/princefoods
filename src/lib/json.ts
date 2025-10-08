// src/lib/json.ts
import type { Prisma } from '@prisma/client';

export const toJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;
export const fromJson = <T>(v: unknown): T => v as T; // narrow read values
