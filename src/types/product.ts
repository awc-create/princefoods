export interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  imageUrl?: string | null;
  slug?: string;
  collection?: string;
  inventory?: number;
  /** Server-decided availability — see src/lib/stock.ts. */
  purchasable?: boolean;
  visible?: boolean;
  tag?: '🔥 Best Seller' | '🎉 New Arrival' | string;
  special?: boolean;

  // ✅ offer fields for pills
  ribbon?: string | null;
  discountMode?: string | null; // e.g. 'PERCENT_OFF' | 'AMOUNT_OFF' | 'BOGOF'
  discountValue?: number | null; // % number OR pence (depending on mode)
}
