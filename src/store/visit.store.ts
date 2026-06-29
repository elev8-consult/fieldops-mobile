import { create } from 'zustand';
import type { Outlet } from '@/lib/catalog';

export interface VisitItem {
  /** Stable key for list rendering. */
  key: string;
  productId: string | null;
  barcode: string | null;
  productName: string;
  quantity: number;
  expiryDate: string | null; // YYYY-MM-DD
}

interface VisitState {
  outlet: Outlet | null;
  items: VisitItem[];
  setOutlet: (outlet: Outlet | null) => void;
  addItem: (item: Omit<VisitItem, 'key'>) => void;
  removeItem: (key: string) => void;
  reset: () => void;
}

let seq = 0;

export const useVisitStore = create<VisitState>((set) => ({
  outlet: null,
  items: [],
  setOutlet: (outlet) => set({ outlet }),
  addItem: (item) =>
    set((s) => ({ items: [{ ...item, key: `i${++seq}` }, ...s.items] })),
  removeItem: (key) =>
    set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
  reset: () => set({ outlet: null, items: [] }),
}));
