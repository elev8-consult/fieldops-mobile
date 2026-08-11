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

export interface SummaryOutlet {
  id: string;
  name: string;
  regionName: string | null;
  visitedToday: boolean;
}

export interface MobileSummary {
  date: string;
  assignedCount: number;
  visitedCount: number;
  itemsToday: number;
  outlets: SummaryOutlet[];
  lastVisit: {
    outletName: string | null;
    itemCount: number;
    submittedAt: string;
  } | null;
}

/** Everything the home screen shows: today's progress and assigned stores. */
export async function fetchMobileSummary(): Promise<MobileSummary> {
  const { data } = await api.get<MobileSummary>('/reports/mobile/summary');
  return data;
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
