import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useQueueStore } from '@/store/queue.store';

/**
 * Tracks connectivity and automatically flushes the offline queue whenever the
 * device comes back online.
 */
export function useNetwork() {
  const [online, setOnline] = useState(true);
  const qc = useQueryClient();
  const flush = useQueueStore((s) => s.flush);
  const load = useQueueStore((s) => s.load);
  const wasOffline = useRef(false);

  useEffect(() => {
    void load();

    const unsubscribe = NetInfo.addEventListener((state) => {
      // `isInternetReachable` is null while probing — treat that as connected
      // so we never show "offline" spuriously.
      const connected =
        Boolean(state.isConnected) && state.isInternetReachable !== false;
      setOnline(connected);

      if (connected && wasOffline.current) {
        wasOffline.current = false;
        void flush().then(({ sent }) => {
          if (sent > 0) {
            void qc.invalidateQueries({ queryKey: ['mobile-summary'] });
          }
        });
      }
      if (!connected) wasOffline.current = true;
    });

    return () => unsubscribe();
  }, [flush, load, qc]);

  return { online };
}
