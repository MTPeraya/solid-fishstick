"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../hooks/useAuth'

export default function PosPage() {
  const { user, token, ready, signout } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (ready && token === null && user === null) router.push('/')
  }, [ready, token, user, router])

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sm text-gray-600">Loading…</div>
    </div>
  )

  const isManager = user.role === 'manager'

  return (
    <div className="min-h-screen flex">
      {isManager && (
        <aside className={`relative transition-all duration-300 ease-out ${sidebarOpen ? 'w-64' : 'w-12'} bg-white border-r`}> 
          <button
            aria-label="Toggle dashboard"
            className="absolute top-4 left-1 p-2"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <div className="space-y-1">
              <span className="block w-6 h-0.5 bg-black"></span>
              <span className="block w-6 h-0.5 bg-black"></span>
              <span className="block w-6 h-0.5 bg-black"></span>
            </div>
          </button>
          {sidebarOpen && (
            <div className="mt-12 p-4 space-y-3">
              <div className="font-semibold">Dashboard</div>
              <ul className="text-sm space-y-2">
                <li>Overview</li>
                <li>Sales</li>
                <li>Inventory</li>
              </ul>
            </div>
          )}
        </aside>
      )}

      <main className="flex-1 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">POS</h1>
          <div className="flex items-center gap-3">
            <div className="text-sm">{user.name || user.username}</div>
            <button
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-black text-white hover:bg-gray-900"
              onClick={() => { signout(); router.push('/') }}
              aria-label="Sign out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
              </svg>
              <span className="text-sm">Sign out</span>
            </button>
          </div>
        </div>
        <div className="mt-6 border rounded-lg p-4 bg-white">POS content goes here</div>
      </main>
    </div>
  )
}
