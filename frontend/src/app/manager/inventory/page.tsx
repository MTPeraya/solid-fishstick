"use client"

import { useEffect, useState } from "react"
import { api } from "../../../lib/api"

type Product = { product_id: number; name: string; barcode: string; brand?: string | null; category?: string | null; stock_quantity: number; min_stock: number }

export default function ManagerInventoryPage() {
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState("")

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const path = q.trim() ? `/api/products?q=${encodeURIComponent(q.trim())}` : "/api/products"
      const data = await api.get(path)
      setItems((data as any[]).map((p) => ({
        product_id: p.product_id,
        name: p.name,
        barcode: p.barcode,
        brand: p.brand,
        category: p.category,
        stock_quantity: Number(p.stock_quantity),
        min_stock: Number(p.min_stock),
      })))
    } catch (e: any) {
      setErr(e?.message || "Failed to load inventory")
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-lg font-medium">Inventory</div>
        <div className="flex items-center gap-2">
          <input className="border rounded px-3 py-2 w-64" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" />
          <button className="px-3 py-2 rounded border" onClick={load} disabled={loading}>Reload</button>
        </div>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="border rounded overflow-auto">
        {loading ? (
          <div className="p-3 text-sm text-gray-600">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-3 text-sm text-gray-600">No products</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">#</th>
                <th className="p-2">Name</th>
                <th className="p-2">Brand</th>
                <th className="p-2">Category</th>
                <th className="p-2">Barcode</th>
                <th className="p-2">Stock</th>
                <th className="p-2">Min</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const low = p.stock_quantity < p.min_stock
                return (
                  <tr key={p.product_id} className="border-t">
                    <td className="p-2">{p.product_id}</td>
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">{p.brand || ""}</td>
                    <td className="p-2">{p.category || ""}</td>
                    <td className="p-2">{p.barcode}</td>
                    <td className="p-2">{p.stock_quantity}</td>
                    <td className="p-2">{p.min_stock}</td>
                    <td className={`p-2 ${low ? "text-red-600" : "text-green-700"}`}>{low ? "Low" : "OK"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
