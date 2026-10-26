import { titleCase } from './names';
import type { ServerMessage, User } from './types';

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    public status: number, // 0 = could not reach the server
    public code: string,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

let token: string | null = null;
export const setToken = (t: string | null) => (token = t);

/** base64("rollNo:password"), UTF-8 safe */
export function makeToken(rollNo: string, password: string): string {
  const bytes = new TextEncoder().encode(`${rollNo}:${password}`);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function request<T>(
  path: string,
  { method = 'GET', body, signal }: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Basic ${token}`;

  let res: Response;
  try {
    // credentials: 'omit' keeps the browser from popping up its own Basic-auth dialog on a 401
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'omit',
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server');
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.code ?? 'ERROR',
      data?.error?.message ?? res.statusText,
      Number(res.headers.get('Retry-After')) || undefined,
    );
  }
  return data as T;
}

// names are shown in one consistent style, even for accounts that were saved as "samay" or "SAMAY BADGOTIYA"
const tidy = (u: User): User => ({ ...u, name: titleCase(u.name) });

export const getMe = async () => tidy(await request<User>('/me'));

export const registerUser = async (rollNo: string, name: string, password: string) =>
  tidy(await request<User>('/users', { method: 'POST', body: { rollNo, name: titleCase(name), password } }));

export const listUsers = async () => {
  const res = await request<{ count: number; users: User[] }>('/users');
  return { ...res, users: res.users.map(tidy) };
};

export const listMessages = (opts: { with?: string; limit?: number; after?: number } = {}) => {
  const q = new URLSearchParams();
  if (opts.with) q.set('with', opts.with);
  if (opts.limit) q.set('limit', String(opts.limit));
  if (opts.after !== undefined) q.set('after', String(opts.after));
  const qs = q.toString();
  return request<{ count: number; total: number; messages: ServerMessage[] }>(`/messages${qs ? `?${qs}` : ''}`);
};

export const sendMessage = (to: string, text: string) =>
  request<ServerMessage>('/messages', { method: 'POST', body: { to, text } });

export const editMessage = (id: number, text: string) =>
  request<ServerMessage>(`/messages/${id}`, { method: 'PATCH', body: { text } });

export const deleteMessage = (id: number) => request<void>(`/messages/${id}`, { method: 'DELETE' });
