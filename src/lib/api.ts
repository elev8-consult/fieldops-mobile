import axios from 'axios';
import { API_BASE_URL } from './config';

/**
 * Shared axios instance. The JWT is held in memory and attached on every
 * request. It is set on login and on app boot (restored from SecureStore).
 */
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

/** Extract a human-friendly message from an axios error. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    const m = data?.message;
    if (Array.isArray(m)) return m[0] ?? fallback;
    if (typeof m === 'string') return m;
    if (err.code === 'ECONNABORTED') return 'The connection timed out. Check your internet and try again.';
    if (!err.response) return 'No internet connection. Please try again.';
  }
  return fallback;
}
