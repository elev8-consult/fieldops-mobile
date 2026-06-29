import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { setAuthToken } from '@/lib/api';
import type { AuthUser } from '@/lib/auth';

const TOKEN_KEY = 'fieldops_token';
const USER_KEY = 'fieldops_user';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  /** Restore session from secure storage on app start. */
  hydrate: () => Promise<void>;
  signIn: (token: string, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const [token, userJson] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      if (token) {
        setAuthToken(token);
        set({
          token,
          user: userJson ? (JSON.parse(userJson) as AuthUser) : null,
        });
      }
    } catch {
      // ignore corrupt storage
    } finally {
      set({ hydrated: true });
    }
  },

  signIn: async (token, user) => {
    setAuthToken(token);
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);
    set({ token, user });
  },

  signOut: async () => {
    setAuthToken(null);
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
    set({ token: null, user: null });
  },
}));
