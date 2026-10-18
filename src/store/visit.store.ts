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
  /** Stable id for this store's visit today. Retries update the same visit. */
  clientSubmissionId: string | null;
  /** True when the list was loaded from a visit already saved today. */
  editing: boolean;
  setOutlet: (outlet: Outlet | null) => void;
  setVisit: (visit: {
    items: Omit<VisitItem, 'key'>[];
    clientSubmissionId: string | null;
    editing: boolean;
  }) => void;
  addItem: (item: Omit<VisitItem, 'key'>) => void;
  /** Replace one line, or add onto its quantity. */
  updateItem: (key: string, item: Omit<VisitItem, 'key'>) => void;
  removeItem: (key: string) => void;
  reset: () => void;
}

let seq = 0;

function lineIdentity(item: Omit<VisitItem, 'key'>): string {
  const expiry = item.expiryDate ?? '';
  if (item.productId) return `p:${item.productId}|${expiry}`;
  return `b:${item.barcode ?? ''}|${item.productName}|${expiry}`;
}

/** Same product and expiry is one line. Quantities add together. */
function collapse(items: VisitItem[]): VisitItem[] {
  const map = new Map<string, VisitItem>();
  const order: string[] = [];
  for (const item of items) {
    const id = lineIdentity(item);
    const prev = map.get(id);
    if (prev) {
      prev.quantity += item.quantity;
      continue;
    }
    map.set(id, { ...item });
    order.push(id);
  }
  return order.map((id) => map.get(id)!);
}

export const useVisitStore = create<VisitState>((set) => ({
  outlet: null,
  items: [],
  clientSubmissionId: null,
  editing: false,
  setOutlet: (outlet) => set({ outlet }),
  setVisit: ({ items, clientSubmissionId, editing }) =>
    set({
      clientSubmissionId,
      editing,
      items: collapse(items.map((item) => ({ ...item, key: `i${++seq}` }))),
    }),
  addItem: (item) =>
    set((s) => ({
      items: collapse([{ ...item, key: `i${++seq}` }, ...s.items]),
    })),
  updateItem: (key, item) =>
    set((s) => ({
      items: collapse(
        s.items.map((current) =>
          current.key === key ? { ...item, key } : current,
        ),
      ),
    })),
  removeItem: (key) =>
    set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
  reset: () =>
    set({ outlet: null, items: [], clientSubmissionId: null, editing: false }),
}));
