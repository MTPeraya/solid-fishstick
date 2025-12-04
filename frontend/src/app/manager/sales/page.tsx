"use client"

import { useEffect, useState } from "react"
import { api } from "../../../lib/api"
import { useAuth } from "../../../hooks/useAuth"

type Tx = {
  transaction_id: number
  transaction_date: string
  employee_id: string
  member_id?: number | null
  subtotal: string | number
  membership_discount: string | number
  product_discount: string | number
  total_amount: string | number
  payment_method: string
}

export default function ManagerSalesPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<Tx[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      if (!token) { throw new Error("Not signed in") }
      const data = await api.get("/api/transactions", { headers: { Authorization: `Bearer ${token}` } })
      setItems(data as Tx[])
    } catch (e: any) {
      setErr(e?.message || "Failed to load sales")
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-lg font-medium">Sales</div>
        <button className="px-3 py-2 rounded border" onClick={load} disabled={loading}>Reload</button>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="border rounded overflow-auto">
        {loading ? (
          <div className="p-3 text-sm text-gray-600">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-3 text-sm text-gray-600">No transactions</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">#</th>
                <th className="p-2">Date</th>
                <th className="p-2">Cashier</th>
                <th className="p-2">Member</th>
                <th className="p-2">Subtotal</th>
                <th className="p-2">Membership Disc</th>
                <th className="p-2">Total</th>
                <th className="p-2">Method</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.transaction_id} className="border-t">
                  <td className="p-2">{t.transaction_id}</td>
                  <td className="p-2">{new Date(t.transaction_date).toLocaleString()}</td>
                  <td className="p-2">{t.employee_id}</td>
                  <td className="p-2">{t.member_id ?? ""}</td>
                  <td className="p-2">฿{Number(t.subtotal).toFixed(2)}</td>
                  <td className="p-2">฿{Number(t.membership_discount).toFixed(2)}</td>
                  <td className="p-2">฿{Number(t.total_amount).toFixed(2)}</td>
                  <td className="p-2">{t.payment_method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
