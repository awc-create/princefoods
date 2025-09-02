export interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  imageUrl?: string | null;
  slug?: string;
  collection?: string;
  inventory?: number;
  visible?: boolean;
  tag?: '🔥 Best Seller' | '🎉 New Arrival' | string;
  special?: boolean;
}
