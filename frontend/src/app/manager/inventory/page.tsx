"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "../../../lib/api"
import { useAuth } from "../../../hooks/useAuth"

type Product = { product_id: number; name: string; barcode: string; brand?: string | null; category?: string | null; selling_price: string | number; stock_quantity: number; min_stock: number }

export default function ManagerInventoryPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [editStockId, setEditStockId] = useState<number | null>(null)
  const [newStock, setNewStock] = useState<number | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)


  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    setOkMsg(null)
    try {
      const path = q.trim() ? `/api/products?q=${encodeURIComponent(q.trim())}` : "/api/products"
      const data = await api.get(path)
      setItems((data as any[]).map((p) => ({
        product_id: p.product_id,
        name: p.name,
        barcode: p.barcode,
        brand: p.brand,
        category: p.category,
        selling_price: p.selling_price,
        stock_quantity: Number(p.stock_quantity),
        min_stock: Number(p.min_stock),
      })))
    } catch (e: any) {
      setErr(e?.message || "Failed to load inventory")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [q, load])

  function startEditStock(p: Product) {
    setEditStockId(p.product_id)
    setNewStock(p.stock_quantity)
    setErr(null)
    setOkMsg(null)
  }

  function cancelEditStock() {
    setEditStockId(null)
    setNewStock(null)
  }

  async function saveStock(id: number) {
    if (!token) { setErr('Not signed in'); return }
    if (newStock === null || newStock < 0) {
        setErr('Invalid stock quantity');
        return;
    }
    setErr(null)
    setOkMsg(null)
    setSavingId(id)

    try {
      const payload = { stock_quantity: newStock }
      await api.post(`/api/products/${id}`, payload, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      setOkMsg(`Stock updated successfully for Product ID ${id}.`)
      setEditStockId(null)
      setNewStock(null)
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Stock update failed')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-lg font-medium">Inventory Stock Management</div>
        <div className="flex items-center gap-2">
          <input className="border rounded px-3 py-2 w-64" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" />
          <button className="px-3 py-2 rounded border" onClick={load} disabled={loading}>Reload</button>
        </div>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}
      {okMsg && <div className="text-sm text-green-700">{okMsg}</div>}

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
                <th className="p-2">Barcode</th>
                <th className="p-2">Current Stock</th>
                <th className="p-2">Min Threshold</th>
                <th className="p-2">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p, index) => {
                const low = p.stock_quantity < p.min_stock
                const isEditing = p.product_id === editStockId
                return (
                  <tr key={p.product_id} className={`border-t ${low ? "bg-red-50" : ""}`}>
                    <td className="p-2">{index + 1}</td>
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">{p.barcode}</td>
                    <td className="p-2">
                        {isEditing ? (
                            <input
                                className="border rounded px-2 py-1 w-20 text-center"
                                type="number"
                                min="0"
                                value={newStock ?? ''}
                                onChange={(e) => setNewStock(Number(e.target.value))}
                            />
                        ) : (
                            p.stock_quantity
                        )}
                    </td>
                    <td className="p-2">{p.min_stock}</td>
                    <td className={`p-2 ${low ? "text-red-600 font-medium" : "text-green-700"}`}>{low ? "LOW STOCK" : "OK"}</td>
                    <td className="p-2">
                        {isEditing ? (
                            <div className="flex gap-2">
                                <button 
                                    className="px-2 py-1 rounded bg-black text-white text-xs disabled:opacity-50" 
                                    onClick={() => saveStock(p.product_id)} 
                                    disabled={savingId === p.product_id || newStock === null || newStock < 0}
                                >
                                    {savingId === p.product_id ? "Saving..." : "Save"}
                                </button>
                                <button 
                                    className="px-2 py-1 rounded border text-xs" 
                                    onClick={cancelEditStock}
                                    disabled={savingId === p.product_id}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button 
                                className="px-2 py-1 rounded border text-xs" 
                                onClick={() => startEditStock(p)}
                                disabled={editStockId !== null}
                            >
                                Update Stock
                            </button>
                        )}
                    </td>
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