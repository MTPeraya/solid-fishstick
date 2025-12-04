"use client"

import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

type Product = { product_id: number; barcode: string; name: string; brand?: string | null; category?: string | null; cost_price: string | number; selling_price: string | number; stock_quantity: number; min_stock: number }

export default function ManagerProductPage() {
  const { token, user } = useAuth()
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [stockQty, setStockQty] = useState(0)
  const [minStock, setMinStock] = useState(10)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const data = await api.get('/api/products')
      setItems(data as Product[])
    } catch (e: any) {
      setErr(e?.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function addProduct(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!token) { setErr('Not signed in'); return }
    try {
      await api.post('/api/products', {
        barcode: barcode.trim(),
        name: name.trim(),
        brand: brand.trim() || null,
        category: category.trim() || null,
        cost_price: Number(costPrice),
        selling_price: Number(sellingPrice),
        stock_quantity: Number(stockQty),
        min_stock: Number(minStock),
      }, { headers: { Authorization: `Bearer ${token}` } })
      setBarcode(''); setName(''); setBrand(''); setCategory(''); setCostPrice(''); setSellingPrice(''); setStockQty(0); setMinStock(10)
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Add product failed')
    }
  }

  async function removeProduct(id: number) {
    if (!token) { setErr('Not signed in'); return }
    setErr(null)
    try {
      await api.post(`/api/products/${id}`, {}, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Delete failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Products</h2>
        <div className="text-xs text-gray-600">{user?.role === 'manager' ? 'Manager' : ''}</div>
      </div>

      <form className="border rounded p-4 space-y-3 bg-gray-50" onSubmit={addProduct}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} required />
          <input className="border rounded px-3 py-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="border rounded px-3 py-2" placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Cost price" type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} required />
          <input className="border rounded px-3 py-2" placeholder="Selling price" type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} required />
          <input className="border rounded px-3 py-2" placeholder="Stock qty" type="number" value={stockQty} onChange={(e) => setStockQty(Number(e.target.value))} />
          <input className="border rounded px-3 py-2" placeholder="Min stock" type="number" value={minStock} onChange={(e) => setMinStock(Number(e.target.value))} />
        </div>
        <button className="px-4 py-2 rounded bg-black text-white" type="submit">Add Product</button>
      </form>

      <div className="border rounded p-3">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-600">No products</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2">Name</th>
                <th className="py-2">Barcode</th>
                <th className="py-2">Price</th>
                <th className="py-2">Stock</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.product_id} className="border-t">
                  <td className="py-2">{p.name}</td>
                  <td className="py-2">{p.barcode}</td>
                  <td className="py-2">฿{Number(p.selling_price).toFixed(2)}</td>
                  <td className="py-2">{p.stock_quantity}</td>
                  <td className="py-2">
                    <button className="px-2 py-1 rounded border" onClick={() => removeProduct(p.product_id)}>Delete</button>
                  </td>
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
