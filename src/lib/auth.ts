import { api } from './api';

export interface AuthUser {
  id: string;
  fullName: string | null;
  role: string;
  brandId: string | null;
}

export interface VerifyResponse {
  access_token: string;
  user: AuthUser;
}

/** Ask the API to send a one-time code to this phone via WhatsApp/SMS. */
export async function requestOtp(phone: string): Promise<{ channel?: string }> {
  const { data } = await api.post<{ channel?: string }>('/auth/request-otp', {
    phone,
  });
  return data ?? {};
}

/** Verify the code and receive a JWT + the merchandiser's identity. */
export async function verifyOtp(
  phone: string,
  code: string,
): Promise<VerifyResponse> {
  const { data } = await api.post<VerifyResponse>('/auth/verify-otp', {
    phone,
    code,
  });
  return data;
}
