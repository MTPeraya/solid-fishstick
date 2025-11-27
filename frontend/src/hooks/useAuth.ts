'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

type User = { uid: string; email: string; username: string; name: string; role: string }

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    setToken(t)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }
    api.get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } }).then((u: User) => setUser(u)).catch(() => setUser(null))
  }, [token])

  const signin = useCallback(async (identifier: string, password: string) => {
    const data = await api.post('/api/users/signin', { identifier, password })
    const t = data.access_token as string
    localStorage.setItem('token', t)
    setToken(t)
  }, [])

  const signup = useCallback(async (email: string, password: string, username: string, name: string, role: 'manager' | 'cashier', managerSecret?: string) => {
    await api.post('/api/users/signup', { email, password, username, name, role, manager_secret: managerSecret })
    await signin(email, password)
  }, [signin])

  const signout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }, [])

  return { user, token, ready, signin, signup, signout }
}
