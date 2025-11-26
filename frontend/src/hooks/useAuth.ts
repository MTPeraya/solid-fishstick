'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

type User = { id: number; email: string }

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    setToken(t)
  }, [])

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }
    api.get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } }).then((u: User) => setUser(u)).catch(() => setUser(null))
  }, [token])

  const signin = useCallback(async (email: string, password: string) => {
    const data = await api.post('/api/users/signin', { email, password })
    const t = data.access_token as string
    localStorage.setItem('token', t)
    setToken(t)
  }, [])

  const signup = useCallback(async (email: string, password: string) => {
    await api.post('/api/users/signup', { email, password })
    await signin(email, password)
  }, [signin])

  const signout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }, [])

  return { user, token, signin, signup, signout }
}
