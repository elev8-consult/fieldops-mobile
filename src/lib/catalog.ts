import axios from 'axios';
import { api } from './api';
import { lookupCachedBarcode } from './offline/catalogCache';

export interface Product {
  id: string;
  canonicalName: string;
  sku: string | null;
  barcode: string | null;
  unit: string | null;
  brandId: string;
  brandName: string | null;
}

export interface Outlet {
  id: string;
  name: string;
  regionName: string | null;
}

/** Look up a product by its scanned barcode. 404 means "not in catalog". */
export async function fetchProductByBarcode(barcode: string): Promise<Product> {
  const { data } = await api.get<Record<string, any>>(
    `/products/by-barcode/${encodeURIComponent(barcode)}`,
  );
  return {
    id: String(data.id),
    canonicalName: data.canonicalName ?? data.canonical_name ?? '',
    sku: data.sku ?? null,
    barcode: data.barcode ?? null,
    unit: data.unit ?? null,
    brandId: String(data.brandId ?? data.brand_id ?? ''),
    brandName: data.brand?.name ?? null,
  };
}

export type BarcodeResolution =
  | { product: Product; source: 'cache' | 'server' }
  | { product: null; source: 'unknown' | 'offline' };

/**
 * Resolve a scanned barcode. Checks the offline cache first so scanning keeps
 * working with no signal, then falls back to the server.
 */
export async function resolveBarcode(
  barcode: string,
): Promise<BarcodeResolution> {
  const cached = lookupCachedBarcode(barcode);
  if (cached) return { product: cached, source: 'cache' };

  try {
    const product = await fetchProductByBarcode(barcode);
    return { product, source: 'server' };
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (e.response?.status === 404) return { product: null, source: 'unknown' };
      // No response at all → we are offline and it was not in the cache.
      if (!e.response) return { product: null, source: 'offline' };
    }
    throw e;
  }
}

/** List outlets for the visit picker (optionally filtered by search text). */
export async function fetchOutlets(search?: string): Promise<Outlet[]> {
  const { data } = await api.get<any>('/outlets', {
    params: search ? { search } : undefined,
  });
  const rows: Record<string, any>[] = Array.isArray(data)
    ? data
    : (data?.data ?? []);
  return rows.map((o) => ({
    id: String(o.id),
    name: o.name ?? o.outlet_name ?? 'Unnamed outlet',
    regionName: o.region?.name ?? o.regionName ?? o.region_name ?? null,
  }));
}
