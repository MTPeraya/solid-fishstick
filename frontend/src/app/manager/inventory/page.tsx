'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

interface ProductInventory {
  product_id: number
  barcode: string
  name: string
  stock_quantity: number
  min_stock: number
  category: string | null
}

function ProductRow({ product, onUpdateStock }: { product: ProductInventory, onUpdateStock: (id: number, newStock: number) => void }) {
  const isLowStock = product.stock_quantity < product.min_stock
  const [newStock, setNewStock] = useState(product.stock_quantity.toString())
  const [isUpdating, setIsUpdating] = useState(false)
  const isChanged = product.stock_quantity.toString() !== newStock
  const stockInt = parseInt(newStock, 10)

  const handleUpdate = async () => {
    if (!isNaN(stockInt) && stockInt >= 0 && isChanged) {
      setIsUpdating(true)
      try {
        await onUpdateStock(product.product_id, stockInt)
        // Note: The parent component will re-fetch data, so we don't need to update state here.
      } catch (e) {
        console.error('Stock update failed:', e)
      } finally {
        setIsUpdating(false)
      }
    }
  }

  useEffect(() => {
    // Sync local state when prop changes from a refresh
    setNewStock(product.stock_quantity.toString())
  }, [product.stock_quantity])

  return (
    <tr className={`border-b hover:bg-gray-50 ${isLowStock ? 'bg-red-50' : ''}`}>
      <td className="p-3 text-sm font-medium">
        {isLowStock && (
          <span className="inline-block w-2 h-2 mr-2 rounded-full bg-red-600 animate-pulse" title="Low Stock"></span>
        )}
        {product.name}
      </td>
      <td className="p-3 text-sm">{product.barcode}</td>
      <td className="p-3 text-sm">{product.category || '-'}</td>
      <td className="p-3 text-sm">{product.min_stock}</td>
      <td className="p-3 text-sm">
        <span className={`font-semibold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
          {product.stock_quantity}
        </span>
      </td>
      <td className="p-3 text-sm flex items-center gap-2">
        <input 
          type="number" 
          min="0"
          value={newStock} 
          onChange={(e) => setNewStock(e.target.value)}
          className="w-20 border rounded-lg px-2 py-1 text-sm text-right"
          disabled={isUpdating}
        />
        <button
          onClick={handleUpdate}
          disabled={!isChanged || isNaN(stockInt) || stockInt < 0 || isUpdating}
          className="bg-blue-500 text-white text-xs px-3 py-1 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
        >
          {isUpdating ? 'Saving...' : 'Update'}
        </button>
      </td>
    </tr>
  )
}

export default function ManagerInventoryPage() {
  const { token } = useAuth()
  const [inventory, setInventory] = useState<ProductInventory[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    if (!token) return
    setError(null)
    setIsLoading(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const products = await api.get('/api/products', { headers }) as ProductInventory[]
      setInventory(products)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch inventory')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleUpdateStock = useCallback(async (id: number, newStock: number) => {
    if (!token) return

    const headers = { Authorization: `Bearer ${token}` }
    const url = `/api/products/${id}/stock`
    const body = { stock_quantity: newStock }

    await api.patch(url, body, { headers })
    
    // Refresh the data after a successful update
    fetchProducts()
  }, [token, fetchProducts])

  const filteredInventory = useMemo(() => {
    return inventory
      .filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        p.barcode.includes(search) ||
        (p.category || '').toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => (a.stock_quantity - a.min_stock) - (b.stock_quantity - b.min_stock)) 
  }, [inventory, search])

  const lowStockCount = inventory.filter(p => p.stock_quantity < p.min_stock).length

  if (isLoading) return <div className="text-sm text-gray-600 text-center py-10">Loading inventory...</div>
  if (error) return <div className="text-sm text-red-600 text-center py-10">Error: {error}</div>

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Inventory Status and Stock Management</h2>
      <div className="flex justify-between items-center p-3 border rounded-lg bg-white shadow-sm">
        <div className="text-sm">
          Total Products: <span className="font-semibold">{inventory.length}</span>
          {lowStockCount > 0 ? (
            <span className="ml-4 text-red-600 font-bold">
              ⚠️ {lowStockCount} items below minimum stock!
            </span>
          ) : (
            <span className="ml-4 text-green-600 font-semibold">
              All stocks look good.
            </span>
          )}
        </div>
        <input
          type="text"
          placeholder="Search by name, barcode, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 w-full max-w-xs focus:ring-black focus:border-black"
        />
      </div>

      <div className="overflow-x-auto border rounded-lg shadow-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product Name</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Barcode</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Min Stock (Reorder Point)</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Current Stock</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Update Stock</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredInventory.map(product => (
              <ProductRow 
                key={product.product_id} 
                product={product} 
                onUpdateStock={handleUpdateStock} 
              />
            ))}
          </tbody>
        </table>
        {filteredInventory.length === 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">
            {search ? 'No products match your search.' : 'No products in inventory.'}
          </div>
        )}
      </div>
    </div>
  )
}