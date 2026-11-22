import { demoAdminRequest, demoRequest } from '@/lib/demoApi';

const TOKEN_KEY = 'link-hub-token';
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
export const REQUEST_TIMEOUT_MESSAGE = 'Hozir serverda yoki internetingizda muammo bo‘layapti. Iltimos, qayta urinib ko‘ring.';
const REQUEST_TIMEOUT_MS = 10_000;

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function fetchApi<T>(path: string, options: RequestInit, headers: Headers): Promise<T> {
  if (options.body) headers.set('Content-Type', 'application/json');
  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/api${path}`, { ...options, headers, signal: controller.signal });
    if (response.status === 204) return undefined as T;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Server bilan aloqa xatosi.');
    return body as T;
  } catch (error) {
    if (timedOut || (error instanceof Error && error.name === 'AbortError')) throw new Error(REQUEST_TIMEOUT_MESSAGE);
    if (error instanceof TypeError) throw new Error(REQUEST_TIMEOUT_MESSAGE);
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function apiRequest<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  if (DEMO_MODE && path !== '/auth/reset-password') return demoRequest<T>(path, options);
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetchApi<T>(path, options, headers);
}

export async function adminRequest<T = unknown>(path: string, adminKey: string, options: RequestInit = {}): Promise<T> {
  if (DEMO_MODE) return demoAdminRequest<T>(path, adminKey, options);
  const headers = new Headers(options.headers);
  headers.set('X-Admin-Key', adminKey);
  return fetchApi<T>(path, options, headers);
}
