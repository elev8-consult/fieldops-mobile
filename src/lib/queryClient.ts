import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // A dead radio will not succeed on a second try. Retrying just
        // holds the UI for another timeout, which is what makes Android
        // feel stuck once the signal drops.
        if (failureCount >= 1) return false;
        if (axios.isAxiosError(error) && !error.response) return false;
        return true;
      },
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      networkMode: 'online',
    },
    // Mutations must still run while offline. Submitting a visit is what
    // saves it onto the phone; pausing it would drop the visit on app kill.
    mutations: { networkMode: 'always', retry: false },
  },
});
