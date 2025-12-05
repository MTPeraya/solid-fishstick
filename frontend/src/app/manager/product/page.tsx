"use client"

import { useEffect, useState, useMemo } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

// Product type including all fields, though some are hidden in the table view
type Product = { product_id: number; barcode: string; name: string; brand?: string | null; category?: string | null; cost_price: string | number; selling_price: string | number; stock_quantity: number; min_stock: number }

// Editable type explicitly excludes fields that should be managed elsewhere
type EditableProduct = Omit<Product, 'product_id' | 'barcode' | 'stock_quantity' | 'min_stock'> & { barcode: string }

// Custom sorting function:
// 1. Low stock items (stock_quantity < min_stock) come first.
// 2. Then sort by difference (current stock - min threshold) ascending.
function sortInventory(a: Product, b: Product): number {
    const isLowA = a.stock_quantity < a.min_stock
    const isLowB = b.stock_quantity < b.min_stock
    
    // Low stock items come first
    if (isLowA && !isLowB) return -1; 
    if (!isLowA && isLowB) return 1;  

    // If they have the same low/ok status, sort by difference (current stock - min threshold) ascending
    const diffA = a.stock_quantity - a.min_stock
    const diffB = b.stock_quantity - b.min_stock
    
    return diffA - diffB
}

export default function ManagerProductPage() {
  const { token, user } = useAuth()
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  // State for search
  const [q, setQ] = useState('')

  // State for adding new product
  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [stockQty, setStockQty] = useState(0)
  const [minStock, setMinStock] = useState(10)

  // State for editing
  const [editId, setEditId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Partial<EditableProduct>>({})
  const [savingId, setSavingId] = useState<number | null>(null)

  async function load() {
    if (!token) return // Don't try to load if not authenticated

    setLoading(true)
    setErr(null)
    setOkMsg(null)
    try {
      const path = q.trim() ? `/api/products?q=${encodeURIComponent(q.trim())}` : "/api/products"
      // Note: Although the backend list_products endpoint doesn't require auth, 
      // the manager pages do, so we include the token for consistency across the page lifecycle.
      const data = await api.get(path) 
      setItems(data as Product[])
    } catch (e: any) {
      setErr(e?.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    const t = setTimeout(() => {
        // Debounced load when search query or token changes
        if (token) load()
    }, 250)
    return () => clearTimeout(t)
  }, [token, q])

  // Apply the custom sorting logic to the fetched items
  const sortedItems = useMemo(() => {
    if (items.length === 0) return items
    return [...items].sort(sortInventory)
  }, [items])


  async function addProduct(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setOkMsg(null)
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
      setOkMsg(`Product "${name.trim()}" added successfully.`)
      setBarcode(''); setName(''); setBrand(''); setCategory(''); setCostPrice(''); setSellingPrice(''); setStockQty(0); setMinStock(10)
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Add product failed')
    }
  }

  async function removeProduct(id: number) {
    if (!token) { setErr('Not signed in'); return }
    setErr(null)
    setOkMsg(null)
    try {
      // Note: Backend endpoint is DELETE /api/products/{product_id}
      await api.post(`/api/products/${id}`, {}, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      setOkMsg(`Product ID ${id} deleted successfully.`)
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Delete failed')
    }
  }
  
  function startEdit(p: Product) {
    setEditId(p.product_id)
    setEditData({
      name: p.name,
      brand: p.brand || '',
      category: p.category || '',
      cost_price: String(p.cost_price),
      selling_price: String(p.selling_price),
      // Stock fields are intentionally omitted from edit data on the Product page
    })
    setErr(null)
    setOkMsg(null)
  }

  function cancelEdit() {
    setEditId(null)
    setEditData({})
  }

  function handleEditChange(key: keyof EditableProduct, value: string | number) {
    setEditData(prev => ({ ...prev, [key]: value }))
  }

  async function saveEdit(id: number) {
    if (!token) { setErr('Not signed in'); return }
    setErr(null)
    setOkMsg(null)
    setSavingId(id)

    const payload: { [key: string]: any } = {}

    // Clean data before sending (excluding stock_quantity and min_stock)
    for (const [key, value] of Object.entries(editData)) {
        if (key === 'cost_price' || key === 'selling_price') {
            payload[key] = Number(value)
        } else if (key === 'name') {
             payload[key] = (value as string).trim()
        } else if (key === 'brand' || key === 'category') {
            payload[key] = (value as string).trim() || null
        }
    }
    
    // Logic to check selling price vs cost price
    const originalProduct = items.find(p => p.product_id === id)
    const currentCostPrice = payload.cost_price ?? Number(originalProduct?.cost_price)
    const currentSellingPrice = payload.selling_price ?? Number(originalProduct?.selling_price)
    
    if (currentSellingPrice < currentCostPrice) {
        setErr('Selling price cannot be less than cost price')
        setSavingId(null)
        return
    }

    try {
      // Note: Backend endpoint is PATCH /api/products/{product_id}
      await api.post(`/api/products/${id}`, payload, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      setOkMsg(`Product ID ${id} updated successfully.`)
      setEditId(null)
      setEditData({})
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Update failed')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Product Catalog Management</h2>
        <div className="flex items-center gap-2">
            <input className="border rounded px-3 py-2 w-64" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search catalog" disabled={editId !== null} />
            <div className="text-xs text-gray-600">{user?.role === 'manager' ? 'Manager' : ''}</div>
        </div>
      </div>

      <form className="border rounded p-4 space-y-3 bg-gray-50" onSubmit={addProduct}>
        <h3 className="text-base font-medium">Add New Product</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} required disabled={editId !== null} />
          <input className="border rounded px-3 py-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required disabled={editId !== null} />
          <input className="border rounded px-3 py-2" placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} disabled={editId !== null} />
          <input className="border rounded px-3 py-2" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={editId !== null} />
          <input className="border rounded px-3 py-2" placeholder="Cost price" type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} required disabled={editId !== null} />
          <input className="border rounded px-3 py-2" placeholder="Selling price" type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} required disabled={editId !== null} />
          <input className="border rounded px-3 py-2" placeholder="Initial Stock Qty" type="number" value={stockQty} onChange={(e) => setStockQty(Number(e.target.value))} disabled={editId !== null} />
          <input className="border rounded px-3 py-2" placeholder="Min Stock Threshold" type="number" value={minStock} onChange={(e) => setMinStock(Number(e.target.value))} disabled={editId !== null} />
        </div>
        <button className="px-4 py-2 rounded bg-black text-white" type="submit" disabled={loading || editId !== null}>Add Product</button>
      </form>

      {okMsg && <div className="text-sm text-green-700">{okMsg}</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="border rounded p-3">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-600">No products</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2">#</th>
                <th className="py-2">Barcode</th>
                <th className="py-2">Name</th>
                <th className="py-2">Brand</th>
                <th className="py-2">Category</th>
                <th className="py-2">Cost Price</th>
                <th className="py-2">Selling Price</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Use sortedItems here */}
              {sortedItems.map((p, index) => {
                const isEditing = p.product_id === editId
                return (
                  <tr key={p.product_id} className="border-t">
                    <td className="py-2">{index + 1}</td>
                    <td className="py-2">{p.barcode}</td>
                    <td className="py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={editData.name || ''}
                          onChange={(e) => handleEditChange('name', e.target.value)}
                          required
                        />
                      ) : (
                        p.name
                      )}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={editData.brand || ''}
                          onChange={(e) => handleEditChange('brand', e.target.value)}
                        />
                      ) : (
                        p.brand
                      )}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={editData.category || ''}
                          onChange={(e) => handleEditChange('category', e.target.value)}
                        />
                      ) : (
                        p.category
                      )}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          type="number"
                          step="0.01"
                          min="0.00"
                          value={editData.cost_price || ''}
                          onChange={(e) => handleEditChange('cost_price', e.target.value)}
                          required
                        />
                      ) : (
                        `฿${Number(p.cost_price).toFixed(2)}`
                      )}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          type="number"
                          step="0.01"
                          min="0.00"
                          value={editData.selling_price || ''}
                          onChange={(e) => handleEditChange('selling_price', e.target.value)}
                          required
                        />
                      ) : (
                        `฿${Number(p.selling_price).toFixed(2)}`
                      )}
                    </td>
                    <td className="py-2 flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            className="px-2 py-1 rounded bg-black text-white disabled:opacity-50"
                            onClick={() => saveEdit(p.product_id)}
                            disabled={
                              savingId === p.product_id || 
                              Number(editData.selling_price) < Number(editData.cost_price) || 
                              !editData.name || 
                              !editData.cost_price || 
                              !editData.selling_price
                            }
                          >
                            {savingId === p.product_id ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            className="px-2 py-1 rounded border"
                            onClick={cancelEdit}
                            disabled={savingId === p.product_id}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="px-2 py-1 rounded border"
                            onClick={() => startEdit(p)}
                            disabled={editId !== null}
                          >
                            Edit
                          </button>
                          <button
                            className="px-2 py-1 rounded border"
                            onClick={() => removeProduct(p.product_id)}
                            disabled={editId !== null}
                          >
                            Delete
                          </button>
                        </>
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