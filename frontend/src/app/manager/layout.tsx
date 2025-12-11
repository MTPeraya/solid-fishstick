"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../hooks/useAuth'

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const { user, token, ready, signout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (ready && token === null && user === null) router.push('/')
  }, [ready, token, user, router])

  useEffect(() => {
    if (user && user.role !== 'manager') router.push('/pos')
  }, [user, router])

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sm text-gray-600">Loading…</div>
    </div>
  )

  const items = [
    { key: 'sales', label: 'Sales', href: '/manager/sales' },
    { key: 'inventory', label: 'Inventory', href: '/manager/inventory' },
    { key: 'product', label: 'Product', href: '/manager/product' },
    { key: 'promotion', label: 'Promotions', href: '/manager/promotion' }, // 🟢 ADDED
    { key: 'employee', label: 'Employee', href: '/manager/employee' },
  ]

  const title = (
    {
      '/manager/dashboard': 'Dashboard',
      '/manager/sales': 'Sales',
      '/manager/inventory': 'Inventory',
      '/manager/employee': 'Employee',
      '/manager/product': 'Product',
      '/manager/promotion': 'Promotions', // 🟢 ADDED
    } as Record<string, string>
  )[pathname] || 'Manager'

  return (
    <div className="min-h-screen flex">
      <aside className={`relative transition-all duration-300 ease-out ${sidebarOpen ? 'w-64' : 'w-12'} bg-white border-r`}> 
        <button
          aria-label="Toggle manager sidebar"
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
            <Link href="/manager/dashboard" className="text-lg font-semibold hover:text-black text-gray-700">Dashboard</Link>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className={`text-lg ${pathname === item.href ? 'text-black font-medium' : 'text-gray-600'} hover:text-black`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {sidebarOpen && (
          <div className="absolute bottom-4 left-3 right-3">
            <Link
              href="/pos"
              className="block w-full text-center px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:border-gray-400"
            >
              Back to POS
            </Link>
          </div>
        )}
      </aside>

      <main className="flex-1 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{title}</h1>
          <div className="flex items-center gap-3">
            <div className="text-lg font-medium">{user.name || user.username}</div>
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

        <div className="mt-6 border rounded-lg p-4 bg-white">
          {children}
        </div>
      </main>
    </div>
  )
}