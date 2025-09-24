'use client';

import { create, type StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartLine {
  id: string; // unique line id (sku or productId+variant)
  sku?: string | null;
  productId?: string | null;
  name: string;
  image?: string | null;
  unitPrice: number; // pence
  quantity: number;
  imageUrl?: string;
}

export interface CartState {
  items: CartLine[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  add: (line: Omit<CartLine, 'quantity'> & { quantity?: number }) => void;
  updateQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  subtotal: () => number;
  count: () => number;
}

const creator: StateCreator<CartState> = (set, get) => ({
  items: [],
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen }),

  add: (line: Omit<CartLine, 'quantity'> & { quantity?: number }) =>
    set((s) => {
      const qty = Math.max(1, line.quantity ?? 1);
      const idx = s.items.findIndex((i) => i.id === line.id);
      if (idx >= 0) {
        const next = [...s.items];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return { items: next, isOpen: true };
      }
      return { items: [...s.items, { ...line, quantity: qty }], isOpen: true };
    }),

  updateQty: (id: string, qty: number) =>
    set((s) => {
      const next = s.items
        .map((i) => (i.id === id ? ({ ...i, quantity: Math.max(1, qty) } as CartLine) : i))
        .filter((i) => i.quantity > 0);
      return { items: next };
    }),

  remove: (id: string) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

  clear: () => set({ items: [] }),

  subtotal: () => get().items.reduce<number>((sum, i) => sum + i.unitPrice * i.quantity, 0),

  count: () => get().items.reduce<number>((n, i) => n + i.quantity, 0)
});

export const useCart = create<CartState>()(persist(creator, { name: 'pf-cart-v1' }));
