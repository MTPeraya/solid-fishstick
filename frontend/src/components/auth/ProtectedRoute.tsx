'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../hooks/useAuth'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!user) router.push('/')
  }, [user, router])
  if (!user) return null
  return <>{children}</>
}
