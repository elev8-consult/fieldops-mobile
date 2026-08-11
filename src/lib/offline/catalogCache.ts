import { api } from '../api';
import type { Product } from '../catalog';
import { KEYS, readJson, writeJson } from './storage';

interface CachedCatalog {
  syncedAt: string;
  products: Product[];
}

let memoryIndex: Map<string, Product> | null = null;
let memorySyncedAt: string | null = null;

function buildIndex(products: Product[]): Map<string, Product> {
  const map = new Map<string, Product>();
  for (const p of products) {
    if (p.barcode) map.set(String(p.barcode).trim(), p);
  }
  return map;
}

/** Load the cached catalog from disk into memory (once per app start). */
export async function loadCatalogCache(): Promise<void> {
  if (memoryIndex) return;
  const cached = await readJson<CachedCatalog>(KEYS.catalog);
  if (cached?.products?.length) {
    memoryIndex = buildIndex(cached.products);
    memorySyncedAt = cached.syncedAt;
  } else {
    memoryIndex = new Map();
  }
}

/** Download the full barcode catalog and persist it for offline scanning. */
export async function syncCatalog(): Promise<{ count: number }> {
  const { data } = await api.get<CachedCatalog>('/products/catalog', {
    timeout: 60000,
  });
  const products = data?.products ?? [];
  memoryIndex = buildIndex(products);
  memorySyncedAt = data?.syncedAt ?? new Date().toISOString();
  await writeJson(KEYS.catalog, {
    syncedAt: memorySyncedAt,
    products,
  } satisfies CachedCatalog);
  return { count: products.length };
}

/** Look a barcode up in the local cache. Null when not cached. */
export function lookupCachedBarcode(barcode: string): Product | null {
  if (!memoryIndex) return null;
  return memoryIndex.get(String(barcode).trim()) ?? null;
}

export function catalogInfo(): { count: number; syncedAt: string | null } {
  return { count: memoryIndex?.size ?? 0, syncedAt: memorySyncedAt };
}
