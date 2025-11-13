'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../hooks/useAuth'

export default function SignInPage() {
  const { signin } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await signin(email, password)
    router.push('/')
  }

  return (
    <div className="max-w-md mx-auto p-8 space-y-4">
      <h1 className="text-xl font-semibold">Sign In</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input className="border rounded w-full px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="border rounded w-full px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button className="bg-black text-white px-4 py-2 rounded" type="submit">Sign In</button>
      </form>
    </div>
  )
}