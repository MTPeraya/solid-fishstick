import { API_BASE_URL } from '../config/env'

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  })
  if (!res.ok) {
    let data: any = null
    try { data = await res.json() } catch {}
    if (data) {
      const detail = data.detail
      if (Array.isArray(detail) && detail.length > 0) {
        const d = detail[0]
        const field = Array.isArray(d?.loc) ? d.loc[d.loc.length - 1] : ''
        const msg = d?.msg || data.message || 'Validation error'
        throw new Error(field ? `${field}: ${msg}` : msg)
      }
      const msg = (data.detail || data.message) || JSON.stringify(data)
      throw new Error(msg)
    }
    throw new Error(await res.text())
  }
  // No content response (e.g., 204 No Content for DELETE)
  if (res.status === 204) {
    return null
  }
  return res.json()
}

export const api = {
  get: (path: string, options?: RequestInit) => request(path, options),
  post: (path: string, body: unknown, options?: RequestInit) => request(path, { method: 'POST', body: JSON.stringify(body), ...(options || {}) }),
  put: (path: string, body: unknown, options?: RequestInit) => request(path, { method: 'PUT', body: JSON.stringify(body), ...(options || {}) }),
  patch: (path: string, body: unknown, options?: RequestInit) => request(path, { method: 'PATCH', body: JSON.stringify(body), ...(options || {}) }),
  delete: (path: string, options?: RequestInit) => request(path, { method: 'DELETE', ...(options || {}) }),
}