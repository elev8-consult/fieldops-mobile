import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

/**
 * Android reports connectivity in bursts while it rechecks the radio. Each
 * flicker used to start a full catalog download and a queue flush, and those
 * calls sat until the 20–60s timeout because a down interface does not fail
 * fast. That backlog is what hitches the UI.
 *
 * A real drop cancels in-flight calls after a short confirmation. Coming back
 * online waits a second so a one-frame flicker does not start that work again.
 */

const ONLINE_DEBOUNCE_MS = 1000;
const OFFLINE_DEBOUNCE_MS = 400;

let online = true;
let started = false;
let pendingOnline: ReturnType<typeof setTimeout> | null = null;
let pendingOffline: ReturnType<typeof setTimeout> | null = null;
let inflight = new AbortController();
const listeners = new Set<(online: boolean) => void>();

export function isOnline(): boolean {
  return online;
}

/** Signal tied to the current online session. Aborted when we go offline. */
export function networkSignal(): AbortSignal {
  return inflight.signal;
}

export function subscribeOnline(listener: (online: boolean) => void): () => void {
  listeners.add(listener);
  listener(online);
  return () => {
    listeners.delete(listener);
  };
}

function readConnected(state: NetInfoState): boolean | null {
  // `null` means the OS is still probing. Keep the previous value so a probe
  // does not look like a reconnect.
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  if (state.isInternetReachable === true) return true;
  return null;
}

function emit(next: boolean) {
  if (next === online) return;
  if (!next) {
    inflight.abort();
    inflight = new AbortController();
  }
  online = next;
  onlineManager.setOnline(next);
  listeners.forEach((listener) => listener(next));

  if (next) {
    // Imported lazily: the queue store imports the API, which imports this
    // module. A static import would be a cycle.
    void import('@/store/queue.store').then(async ({ useQueueStore }) => {
      const { sent } = await useQueueStore.getState().flush();
      if (sent > 0) {
        void queryClient.invalidateQueries({ queryKey: ['mobile-summary'] });
      }
    });
  }
}

function apply(state: NetInfoState) {
  const next = readConnected(state);
  if (next === null) return;

  if (!next) {
    if (pendingOnline) {
      clearTimeout(pendingOnline);
      pendingOnline = null;
    }
    // Ignore a one-off false reading. A real drop still cancels work well
    // before the old 20s request timeout.
    if (!online || pendingOffline) return;
    pendingOffline = setTimeout(() => {
      pendingOffline = null;
      emit(false);
    }, OFFLINE_DEBOUNCE_MS);
    return;
  }

  if (pendingOffline) {
    clearTimeout(pendingOffline);
    pendingOffline = null;
  }
  if (online || pendingOnline) return;
  pendingOnline = setTimeout(() => {
    pendingOnline = null;
    emit(true);
  }, ONLINE_DEBOUNCE_MS);
}

export function startNetworkMonitor() {
  if (started) return;
  started = true;

  onlineManager.setEventListener((setOnline) => {
    // We publish through emit(), which calls onlineManager.setOnline.
    // Register a listener so React Query drops its default window events.
    setOnline(online);
    const unsubscribe = NetInfo.addEventListener(apply);
    void NetInfo.fetch().then(apply);
    return unsubscribe;
  });
}
