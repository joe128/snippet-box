import type { NewSnippet, SearchQuery, Snippet, TagCount } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const request = async <T>(url: string, method = 'GET', body?: unknown): Promise<T> => {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, json.error || res.statusText);
  }

  return json.data as T;
};

export const api = {
  list: () => request<Snippet[]>('/api/snippets'),
  get: (id: number) => request<Snippet>(`/api/snippets/${id}`),
  create: (s: NewSnippet) => request<Snippet>('/api/snippets', 'POST', s),
  update: (id: number, s: NewSnippet) => request<Snippet>(`/api/snippets/${id}`, 'PUT', s),
  remove: (id: number) => request<object>(`/api/snippets/${id}`, 'DELETE'),
  pin: (id: number, isPinned: boolean) =>
    request<Snippet>(`/api/snippets/${id}/pin`, 'PATCH', { isPinned }),
  tags: () => request<TagCount[]>('/api/snippets/statistics/count'),
  search: (q: SearchQuery) => request<Snippet[]>('/api/snippets/search', 'POST', q),
  rawUrl: (id: number) => `${window.location.origin}/api/snippets/raw/${id}`
};
