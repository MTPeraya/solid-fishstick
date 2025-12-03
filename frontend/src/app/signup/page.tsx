'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../hooks/useAuth'

export default function SignUpPage() {
  const { signup } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'cashier' | 'manager'>('cashier')
  const [managerSecret, setManagerSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const invalidPwd = password.length > 0 && (password.length < 6 || password.length > 72)
  const invalidEmail = email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      if (invalidEmail) {
        setLoading(false)
        setErr('Please enter a valid email address')
        return
      }
      if (password.length < 6 || password.length > 72) {
        setLoading(false)
        return
      }
      if (role === 'manager' && !showSecret) {
        setShowSecret(true)
        setLoading(false)
        return
      }
      await signup(email, password, username, name, role, role === 'manager' ? managerSecret : undefined)
      router.push('/')
    } catch (e: any) {
      setErr(e?.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 space-y-5">
        <h1 className="text-2xl font-semibold text-center">Create your account</h1>
        <form className="space-y-4" onSubmit={onSubmit}>
          <input className="border rounded-lg w-full px-3 py-2" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" required />
          <input className="border rounded-lg w-full px-3 py-2" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required />
          <input className="border rounded-lg w-full px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          {invalidEmail && <div className="text-xs text-red-600 mt-1" aria-live="polite">Enter a valid email address</div>}
          <div>
            <input className="border rounded-lg w-full px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
            {invalidPwd && <div className="text-xs text-red-600 mt-1">Password must be 6–72 characters</div>}
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Select role</div>
            <div className="grid grid-cols-2 gap-3">
              <label className={`relative cursor-pointer rounded-xl p-3 flex items-center gap-3 transition-colors ${role === 'cashier' ? 'border-2 border-black bg-gray-100 ring-2 ring-black' : 'border border-gray-300 hover:border-black'}`} aria-selected={role === 'cashier'}>
                <input type="radio" name="role" value="cashier" className="sr-only" checked={role === 'cashier'} onChange={() => { setRole('cashier'); setShowSecret(false) }} />
                <span className="text-xl">🛒</span>
                <div>
                  <div className="font-medium">Cashier</div>
                  <div className="text-xs text-gray-600">Standard user</div>
                </div>
                <div className={`absolute top-3 right-3 w-4 h-4 rounded-full ${role === 'cashier' ? 'bg-black' : 'border border-gray-300'}`}></div>
              </label>
              <label className={`relative cursor-pointer rounded-xl p-3 flex items-center gap-3 transition-colors ${role === 'manager' ? 'border-2 border-black bg-gray-100 ring-2 ring-black' : 'border border-gray-300 hover:border-black'}`} aria-selected={role === 'manager'}>
                <input type="radio" name="role" value="manager" className="sr-only" checked={role === 'manager'} onChange={() => { setRole('manager'); setShowSecret(true) }} />
                <span className="text-xl">🧑‍💼</span>
                <div>
                  <div className="font-medium">Manager</div>
                  <div className="text-xs text-gray-600">Requires secret code</div>
                </div>
                <div className={`absolute top-3 right-3 w-4 h-4 rounded-full ${role === 'manager' ? 'bg-black' : 'border border-gray-300'}`}></div>
              </label>
            </div>
          </div>
          <div
            aria-expanded={showSecret}
            className={`transition-all duration-300 ease-out overflow-hidden ${showSecret ? 'max-h-28 opacity-100 mt-2' : 'max-h-0 opacity-0'} `}
          >
            <div className="space-y-2 border rounded-xl p-3 bg-gray-50">
              <div className="text-sm">Manager secret code</div>
              <input className="border rounded-lg w-full px-3 py-2" type="text" value={managerSecret} onChange={(e) => setManagerSecret(e.target.value)} placeholder="Enter secret" required={role === 'manager'} />
            </div>
          </div>
          <button className="bg-black text-white px-4 py-2 rounded-lg w-full disabled:opacity-60" type="submit" disabled={loading || invalidEmail || invalidPwd}>{loading ? 'Creating account…' : 'Create Account'}</button>
        </form>
        <div className="flex items-center justify-center text-sm">
          <span className="text-gray-600">Already have an account?</span>
          <Link className="ml-1 underline" href="/">Sign in</Link>
        </div>
        {err && <div className="text-sm text-red-600 text-center">{err}</div>}
      </div>
    </div>
  )
}
