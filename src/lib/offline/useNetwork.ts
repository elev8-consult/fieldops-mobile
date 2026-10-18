import { useEffect, useState } from 'react';
import { isOnline, subscribeOnline } from '@/lib/offline/network';
import { useQueueStore } from '@/store/queue.store';

/**
 * Online flag for the screen that's mounted. Reconnect flushing lives in the
 * network monitor so it still runs on the scan screen, where this hook is not
 * mounted.
 */
export function useNetwork() {
  const [online, setOnline] = useState(isOnline);
  const load = useQueueStore((s) => s.load);

  useEffect(() => {
    void load();
    return subscribeOnline(setOnline);
  }, [load]);

  return { online };
}
