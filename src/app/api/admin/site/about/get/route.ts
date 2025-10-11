// src/app/api/admin/site/about/get/route.ts
import { fromJson, toJson } from '@/lib/json';
import { prisma } from '@/lib/prisma';
import type { AboutSettingsDTO } from '@/types/aboutSettings';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// -------------------------
// Default content
// -------------------------
const DEFAULTS: AboutSettingsDTO = {
  hero: {
    title: 'Your Favourite South Asian Grocery — A Reminder of Home',
    subtitle: 'Quality, value & nostalgia in every bite',
    imageUrl: '/assets/about.png'
  },
  story: {
    heading: 'Our Story',
    paragraphs: [
      'Since 2007, Prince Foods has been proudly connecting South Asian communities across England, Scotland, Wales and Ireland with the authentic flavours of home. What started as a small family business importing a few favourites from Kerala has grown into a trusted nationwide grocery brand — loved for our quality, reliability, and unbeatable prices.',
      'From everyday staples like rice, spices, and pulses to frozen delicacies and snacks, our curated collections make it easy to bring traditional cooking to your modern kitchen. Every item on our shelves is chosen with care to ensure genuine taste, trusted quality, and fair value for every household.'
    ]
  },
  stats: [
    { id: 's1', title: '2007', subtitle: 'Year founded' },
    { id: 's2', title: 'UK & IE', subtitle: 'Nationwide delivery' },
    { id: 's3', title: 'Thousands', subtitle: 'Happy households' }
  ],
  values: [
    {
      id: 'v1',
      icon: '🌿',
      title: 'Authentic Ingredients',
      text: 'Carefully sourced staples and treats from trusted South Asian suppliers.'
    },
    {
      id: 'v2',
      icon: '🚚',
      title: 'Fast, Reliable Delivery',
      text: 'UK + Ireland-wide delivery with safe, temperature-aware handling.'
    },
    {
      id: 'v3',
      icon: '💰',
      title: 'Everyday Low Prices',
      text: 'Transparent value — no hidden markups, just fair pricing.'
    },
    {
      id: 'v4',
      icon: '❤️',
      title: 'Family-Run Since 2007',
      text: 'A brand built on trust, consistency, and community.'
    },
    {
      id: 'v5',
      icon: '🛒',
      title: 'Easy Online Ordering',
      text: 'Secure checkout and a simple shopping experience on any device.'
    }
  ],
  cta: { text: 'Browse Our Collections', href: '/collections' }
};

// -------------------------
// GET handler
// -------------------------
export async function GET() {
  try {
    // ✅ Idempotent get-or-create pattern
    const row = await prisma.aboutSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        hero: toJson(DEFAULTS.hero),
        story: toJson(DEFAULTS.story),
        stats: toJson(DEFAULTS.stats),
        values: toJson(DEFAULTS.values),
        cta: toJson(DEFAULTS.cta)
      },
      update: {} // If it exists, just return existing
    });

    // ✅ Normalize Prisma JSON fields into clean DTO types
    const data: AboutSettingsDTO = {
      hero: fromJson(row.hero) as AboutSettingsDTO['hero'],
      story: fromJson(row.story) as AboutSettingsDTO['story'],
      stats: fromJson(row.stats) as AboutSettingsDTO['stats'],
      values: fromJson(row.values) as AboutSettingsDTO['values'],
      cta: fromJson(row.cta) as AboutSettingsDTO['cta']
    };

    return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN_ERROR';
    console.error('GET /api/admin/site/about/get failed:', e);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
