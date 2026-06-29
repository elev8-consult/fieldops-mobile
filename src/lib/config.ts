import Constants from 'expo-constants';

/**
 * API base URL. Configured in app.json -> expo.extra.apiUrl.
 * The NestJS API is served under the /api prefix.
 */
const apiUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'https://fieldops-api-production.up.railway.app';

export const API_BASE_URL = `${apiUrl.replace(/\/+$/, '')}/api`;
