import { create } from 'zustand';
import { apiErrorMessage } from '@/lib/api';
import { KEYS, readJson, writeJson } from '@/lib/offline/storage';
import { submitVisit, type VisitItemPayload } from '@/lib/reports';

export interface QueuedVisit {
  id: string;
  outletId: string;
  outletName: string;
  items: VisitItemPayload[];
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
  /** Save a visit for later delivery. */
  enqueue: (
    visit: Omit<QueuedVisit, 'id' | 'createdAt' | 'attempts' | 'lastError'>,
  ) => Promise<QueuedVisit>;
  /** Try to deliver everything queued. Safe to call often. */
  flush: () => Promise<{ sent: number; failed: number }>;
  discard: (id: string) => Promise<void>;
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
    const entry: QueuedVisit = {
      ...visit,
      id: `q${Date.now()}_${++seq}`,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
    };
    const pending = [...get().pending, entry];
    set({ pending });
    await persist(pending);
    return entry;
  },

  flush: async () => {
    if (get().syncing) return { sent: 0, failed: 0 };
    const queue = get().pending;
    if (queue.length === 0) return { sent: 0, failed: 0 };

    set({ syncing: true });
    let sent = 0;
    let failed = 0;
    const remaining: QueuedVisit[] = [];

    for (const visit of queue) {
      try {
        await submitVisit({ outletId: visit.outletId, items: visit.items });
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

    set({ pending: remaining, syncing: false });
    await persist(remaining);
    return { sent, failed };
  },

  discard: async (id) => {
    const pending = get().pending.filter((v) => v.id !== id);
    set({ pending });
    await persist(pending);
  },
}));
