"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { api } from "../../../lib/api"
import { useAuth } from "../../../hooks/useAuth"

type MemberSummary = {
  member_id: number
  name: string
  phone: string
  points_balance: number
  membership_rank: string
  discount_rate: string | number
  registration_date: string
  rolling_year_spent: string | number
  current_tier: string
  current_discount_rate: string | number
}

export default function ManagerMembershipPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<MemberSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      if (!token) throw new Error("Not signed in")
      const url = q.trim() ? `/api/members?q=${encodeURIComponent(q.trim())}` : `/api/members`
      const data = await api.get(url, { headers: { Authorization: `Bearer ${token}` } })
      setItems(data as MemberSummary[])
    } catch (e: any) {
      setErr(e?.message || "Failed to load members")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [token, q])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => {
    const count = items.length
    const totalRolling = items.reduce((s, m) => s + Number(m.rolling_year_spent), 0)
    return { count, totalRolling }
  }, [items])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input className="border rounded px-3 py-2 w-72" placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="px-3 py-2 rounded bg-black text-white" onClick={load} disabled={loading}>Refresh</button>
      </div>
      <div className="text-sm text-gray-600">
        {loading ? "Loading…" : `Members: ${totals.count} · Rolling-year total: ฿${totals.totalRolling.toFixed(2)}`}
      </div>
      <div className="border rounded overflow-auto">
        {items.length === 0 ? (
          <div className="p-3 text-sm text-gray-600">No members</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">#</th>
                <th className="p-2">Name</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Points</th>
                <th className="p-2">Rolling-Year Spent</th>
                <th className="p-2">Tier</th>
                <th className="p-2">Discount</th>
                <th className="p-2">Registered</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.member_id} className="border-t">
                  <td className="p-2">{m.member_id}</td>
                  <td className="p-2">{m.name}</td>
                  <td className="p-2">{m.phone}</td>
                  <td className="p-2">{m.points_balance}</td>
                  <td className="p-2">฿{Number(m.rolling_year_spent).toFixed(2)}</td>
                  <td className="p-2">{m.current_tier}</td>
                  <td className="p-2">{Number(m.current_discount_rate).toFixed(2)}%</td>
                  <td className="p-2">{new Date(m.registration_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {err && <div className="text-sm text-red-600">{err}</div>}
    </div>
  )
}
