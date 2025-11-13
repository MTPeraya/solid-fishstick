import { API_BASE_URL } from '../config/env'

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  get: (path: string, options?: RequestInit) => request(path, options),
  post: (path: string, body: unknown, options?: RequestInit) => request(path, { method: 'POST', body: JSON.stringify(body), ...(options || {}) }),
}