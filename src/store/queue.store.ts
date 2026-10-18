import { create } from 'zustand';
import { apiErrorMessage } from '@/lib/api';
import { isOnline } from '@/lib/offline/network';
import { KEYS, readJson, writeJson } from '@/lib/offline/storage';
import { saveVisit, type VisitItemPayload } from '@/lib/reports';

export interface QueuedVisit {
  id: string;
  outletId: string;
  outletName: string;
  items: VisitItemPayload[];
  clientSubmissionId?: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

interface QueueState {
  pending: QueuedVisit[];
  loaded: boolean;
  syncing: boolean;
  /** Restore the queue from disk on app start. */
  load: () => Promise<void>;
  /** Save a visit for later delivery. One queued visit per store. */
  enqueue: (
    visit: Omit<QueuedVisit, 'id' | 'createdAt' | 'attempts' | 'lastError'>,
  ) => Promise<QueuedVisit>;
  /** Try to deliver everything queued. Safe to call often. */
  flush: () => Promise<{ sent: number; failed: number }>;
  discard: (id: string) => Promise<void>;
  /** Drop a queued visit for a store after it has been saved online. */
  discardOutlet: (outletId: string) => Promise<void>;
}

let seq = 0;

async function persist(pending: QueuedVisit[]) {
  await writeJson(KEYS.queue, pending);
}

export const useQueueStore = create<QueueState>((set, get) => ({
  pending: [],
  loaded: false,
  syncing: false,

  load: async () => {
    if (get().loaded) return;
    const stored = (await readJson<QueuedVisit[]>(KEYS.queue)) ?? [];
    set({ pending: stored, loaded: true });
  },

  enqueue: async (visit) => {
    const previous = get().pending.find((v) => v.outletId === visit.outletId);
    const entry: QueuedVisit = {
      ...visit,
      // Keep the id when this store is edited again before the send succeeds,
      // so a flush that already started can tell the new list apart.
      id: `q${Date.now()}_${++seq}`,
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      attempts: 0,
      lastError: null,
      clientSubmissionId:
        visit.clientSubmissionId ?? previous?.clientSubmissionId,
    };
    const pending = [
      entry,
      ...get().pending.filter((v) => v.outletId !== visit.outletId),
    ];
    set({ pending });
    await persist(pending);
    return entry;
  },

  flush: async () => {
    if (!isOnline()) return { sent: 0, failed: 0 };
    if (get().syncing) return { sent: 0, failed: 0 };
    const queue = get().pending;
    if (queue.length === 0) return { sent: 0, failed: 0 };

    set({ syncing: true });
    let sent = 0;
    let failed = 0;
    const remaining: QueuedVisit[] = [];

    for (const visit of queue) {
      // A newer edit for this store landed while we were sending. Skip the
      // stale copy; the new one stays queued.
      const latest = get().pending.find((v) => v.outletId === visit.outletId);
      if (!latest || latest.id !== visit.id) continue;

      try {
        await saveVisit({
          outletId: visit.outletId,
          items: visit.items,
          clientSubmissionId: visit.clientSubmissionId,
        });
        sent += 1;
      } catch (err) {
        failed += 1;
        remaining.push({
          ...visit,
          attempts: visit.attempts + 1,
          lastError: apiErrorMessage(err, 'Could not send'),
        });
      }
    }

    const snapshotIds = new Set(queue.map((v) => v.id));
    const replacedOutlets = new Set(
      get()
        .pending.filter((v) => !snapshotIds.has(v.id))
        .map((v) => v.outletId),
    );
    const pending = [
      ...get().pending.filter((v) => !snapshotIds.has(v.id)),
      ...remaining.filter((v) => !replacedOutlets.has(v.outletId)),
    ];
    set({ pending, syncing: false });
    await persist(pending);
    return { sent, failed };
  },

  discard: async (id) => {
    const pending = get().pending.filter((v) => v.id !== id);
    set({ pending });
    await persist(pending);
  },

  discardOutlet: async (outletId) => {
    const pending = get().pending.filter((v) => v.outletId !== outletId);
    set({ pending });
    await persist(pending);
  },
}));
