import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Orders not implemented yet – return an empty list with a helpful flag.
  return NextResponse.json({
    items: [],
    note: 'Orders are not set up yet. Once your Order model & data exist, this endpoint will return them.'
  });
}
