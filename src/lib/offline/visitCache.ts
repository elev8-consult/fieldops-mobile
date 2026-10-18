import type { VisitItemPayload } from '@/lib/reports';
import { KEYS, readJson, writeJson } from './storage';

export interface CachedVisit {
  date: string;
  outletId: string;
  clientSubmissionId: string | null;
  items: VisitItemPayload[];
}

/** Same calendar day the API uses for "visited today". */
export function beirutToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Beirut',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function readVisitCache(
  outletId: string,
): Promise<CachedVisit | null> {
  const all = await readJson<Record<string, CachedVisit>>(KEYS.visits);
  const row = all?.[outletId];
  if (!row || row.date !== beirutToday()) return null;
  return row;
}

export async function writeVisitCache(visit: CachedVisit): Promise<void> {
  const all =
    (await readJson<Record<string, CachedVisit>>(KEYS.visits)) ?? {};
  const today = visit.date;
  const next: Record<string, CachedVisit> = {};
  for (const [id, row] of Object.entries(all)) {
    if (row.date === today) next[id] = row;
  }
  next[visit.outletId] = visit;
  await writeJson(KEYS.visits, next);
}
