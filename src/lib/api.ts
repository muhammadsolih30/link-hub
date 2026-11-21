import { demoRequest } from '@/lib/demoApi';

const TOKEN_KEY = 'link-hub-token';
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function fetchApi<T>(path: string, options: RequestInit, headers: Headers): Promise<T> {
  if (options.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE_URL}/api${path}`, { ...options, headers });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Server bilan aloqa xatosi.');
  return body as T;
}

export async function apiRequest<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  if (DEMO_MODE && path !== '/auth/reset-password') return demoRequest<T>(path, options);
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetchApi<T>(path, options, headers);
}

export async function adminRequest<T = unknown>(path: string, adminKey: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('X-Admin-Key', adminKey);
  return fetchApi<T>(path, options, headers);
}
