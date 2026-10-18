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
  /** Same value on every retry of one visit, so the server can drop duplicates. */
  clientSubmissionId?: string;
}

export function newSubmissionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
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

export interface TodayVisit {
  outletId: string;
  clientSubmissionId: string | null;
  items: VisitItemPayload[];
}

/** Items already saved for this store today. */
export async function fetchTodayVisit(outletId: string): Promise<TodayVisit> {
  const { data } = await api.get<TodayVisit>(
    `/reports/mobile/outlets/${outletId}`,
  );
  return data;
}

/**
 * Create or replace today's visit. `items` is the full list, with any
 * quantities the user added already included in each line.
 */
export async function saveVisit(
  payload: SubmitVisitPayload,
): Promise<{ reportId: string }> {
  const { data } = await api.put<{ reportId: string }>(
    `/reports/mobile/outlets/${payload.outletId}`,
    {
      clientSubmissionId: payload.clientSubmissionId,
      items: payload.items,
    },
  );
  return data;
}
