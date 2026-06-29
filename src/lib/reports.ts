import { api } from './api';

export interface VisitItemPayload {
  productId: string | null; // null when the scanned barcode isn't in the catalog
  barcode: string | null;
  productNameRaw: string;
  quantity: number;
  expiryDate: string | null; // YYYY-MM-DD
}

export interface SubmitVisitPayload {
  outletId: string;
  items: VisitItemPayload[];
}

/** Submit a completed store visit straight into the report tables. */
export async function submitVisit(
  payload: SubmitVisitPayload,
): Promise<{ reportId: string }> {
  const { data } = await api.post<{ reportId: string }>(
    '/reports/mobile',
    payload,
  );
  return data;
}
