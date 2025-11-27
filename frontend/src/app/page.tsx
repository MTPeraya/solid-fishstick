"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../hooks/useAuth'
import { useRouter } from 'next/navigation'

export default function Page() {
  const { signin, user } = useAuth()
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      await signin(identifier, password)
    } catch (e: any) {
      setErr(e?.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) router.push('/pos')
  }, [user, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8 space-y-4">
        <h1 className="text-xl font-semibold text-center">Sign In</h1>
        <form className="space-y-3" onSubmit={onSubmit}>
          <input className="border rounded w-full px-3 py-2" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Email or Username" />
          <input className="border rounded w-full px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          <button className="bg-black text-white px-4 py-2 rounded w-full" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
        </form>
        <div className="flex items-center justify-between text-sm">
          <span>{user ? `Signed in as ${user.email}` : ''}</span>
          <Link className="underline" href="/signup">Sign Up</Link>
        </div>
        {err && <div className="text-sm text-red-600 text-center">{err}</div>}
      </div>
    </div>
  )
}
