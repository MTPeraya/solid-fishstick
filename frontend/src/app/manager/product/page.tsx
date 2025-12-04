'use client'

import { useState, useMemo, useCallback, FormEvent, useEffect } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

interface ProductDetail {
  product_id: number
  barcode: string
  name: string
  brand: string | null
  category: string | null

  cost_price: string | number
  selling_price: string | number
  stock_quantity: number
  min_stock: number
  promotion_id: number | null
}

// Interface for fetching and display (can be simplified if needed)
interface PromotionInfo {
  id: number
  name: string
}

// Mock Promotion List (In a real app, this would be fetched from a /api/promotions endpoint)
const PROMOTIONS: PromotionInfo[] = [
  { id: 1, name: 'Summer Beverage Sale (20% OFF)' },
  { id: 2, name: 'Snack Clearance (5 Baht OFF)' },
]


// Reusable Modal Component
function Modal({ children, isOpen, onClose, title }: { children: React.ReactNode, isOpen: boolean, onClose: () => void, title: string }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Add/Edit Product Form
function ProductForm({ 
  product, 
  onSave, 
  onClose,
  promotions = [],
  error,
  isLoading
}: { 
  product: ProductDetail | null, 
  onSave: (data: any, id?: number) => Promise<void>, 
  onClose: () => void,
  promotions: PromotionInfo[],
  error: string | null,
  isLoading: boolean
}) {
  const [data, setData] = useState<any>(product || {
    barcode: '',
    name: '',
    brand: '',
    category: '',
    cost_price: 0,
    selling_price: 0,
    stock_quantity: 0,
    min_stock: 10,
    promotion_id: null,
  })

  const isEditing = !!product

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    let processedValue: string | number | null = value
    
    if (type === 'number' || name.includes('price') || name.includes('stock')) {
      processedValue = parseFloat(value)
      if (isNaN(processedValue)) processedValue = 0
    } else if (value === '') {
      processedValue = null
    }

    setData((prev: any) => ({ 
      ...prev, 
      [name]: processedValue
    }))
  }
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSave(data, product?.product_id)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-2 gap-4">
        <input
          name="name"
          type="text"
          placeholder="Product Name"
          value={data.name || ''}
          onChange={handleChange}
          required
          className="border rounded-lg w-full px-3 py-2"
          disabled={isLoading}
        />
        <input
          name="barcode"
          type="text"
          placeholder="Barcode (e.g., 885...)"
          value={data.barcode || ''}
          onChange={handleChange}
          required
          className="border rounded-lg w-full px-3 py-2"
          disabled={isEditing || isLoading}
        />
        <input
          name="brand"
          type="text"
          placeholder="Brand (Optional)"
          value={data.brand || ''}
          onChange={handleChange}
          className="border rounded-lg w-full px-3 py-2"
          disabled={isLoading}
        />
        <input
          name="category"
          type="text"
          placeholder="Category (Optional)"
          value={data.category || ''}
          onChange={handleChange}
          className="border rounded-lg w-full px-3 py-2"
          disabled={isLoading}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <input
          name="cost_price"
          type="number"
          step="0.01"
          min="0"
          placeholder="Cost Price"
          value={data.cost_price}
          onChange={handleChange}
          required
          className="border rounded-lg w-full px-3 py-2"
          disabled={isLoading}
        />
        <input
          name="selling_price"
          type="number"
          step="0.01"
          min="0"
          placeholder="Selling Price"
          value={data.selling_price}
          onChange={handleChange}
          required
          className="border rounded-lg w-full px-3 py-2"
          disabled={isLoading}
        />
      </div>
      {!isEditing && (
        <div className="grid grid-cols-2 gap-4">
          <input
            name="stock_quantity"
            type="number"
            step="1"
            min="0"
            placeholder="Initial Stock Quantity"
            value={data.stock_quantity}
            onChange={handleChange}
            required
            className="border rounded-lg w-full px-3 py-2"
            disabled={isLoading}
          />
          <input
            name="min_stock"
            type="number"
            step="1"
            min="1"
            placeholder="Minimum Stock"
            value={data.min_stock}
            onChange={handleChange}
            required
            className="border rounded-lg w-full px-3 py-2"
            disabled={isLoading}
          />
        </div>
      )}
      <select
        name="promotion_id"
        // Convert to string for select value comparison
        value={data.promotion_id ? data.promotion_id.toString() : ''}
        onChange={handleChange}
        className="border rounded-lg w-full px-3 py-2"
        disabled={isLoading}
      >
        <option value="">No Active Promotion</option>
        {promotions.map((promo) => (
          <option key={promo.id} value={promo.id}>
            {promo.name}
          </option>
        ))}
      </select>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-100" disabled={isLoading}>Cancel</button>
        <button type="submit" className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 disabled:bg-gray-400" disabled={isLoading}>
          {isLoading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Product')}
        </button>
      </div>
    </form>
  )
}


export default function ManagerProductPage() {
  const { token } = useAuth()
  const [products, setProducts] = useState<ProductDetail[]>([])
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      // The API returns Decimal fields (cost_price, selling_price) as strings.
      const fetchedProducts = await api.get('/api/products', { headers }) as ProductDetail[]
      setProducts(fetchedProducts)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch product list')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleOpenModal = useCallback((product: ProductDetail | null = null) => {
    setEditingProduct(product)
    setFormError(null)
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setEditingProduct(null)
    setFormError(null)
  }, [])

  const handleSaveProduct = useCallback(async (data: any, id?: number) => {
    if (!token) return

    setIsSaving(true)
    setFormError(null)
    const headers = { Authorization: `Bearer ${token}` }
    
    try {
      if (id) {
        // Edit existing product: PUT /api/products/{id}
        const updateData = Object.fromEntries(
            Object.entries(data).filter(([key, value]) => value !== null && key !== 'product_id' && key !== 'barcode')
        );
        await api.put(`/api/products/${id}`, updateData, { headers })
      } else {
        // Add new product: POST /api/products
        await api.post('/api/products', data, { headers })
      }
      
      // Refresh list and close modal
      await fetchProducts()
      handleCloseModal()
    } catch (e: any) {
      setFormError(e.message || 'Operation failed')
    } finally {
      setIsSaving(false)
    }
  }, [token, fetchProducts, handleCloseModal])

  const handleDeleteProduct = useCallback(async (id: number) => {
    if (!token) return
    if (confirm('Are you sure you want to delete this product from the catalog? This action cannot be undone.')) {
      setError(null)
      try {
        const headers = { Authorization: `Bearer ${token}` }
        // Delete product: DELETE /api/products/{id}
        await api.delete(`/api/products/${id}`, { headers })
        
        // Refresh list
        await fetchProducts()
      } catch (e: any) {
        setError(e.message || 'Failed to delete product')
      }
    }
  }, [token, fetchProducts])

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.barcode.includes(search) ||
      (p.brand || '').toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => a.product_id - b.product_id)
  }, [products, search])

  const getPromotionName = (id: number | null) => {
    if (!id) return '-';
    return PROMOTIONS.find(p => p.id === id)?.name || `Promo ID ${id}`;
  }


  if (isLoading) return <div className="text-sm text-gray-600 text-center py-10">Loading product catalog...</div>
  if (error) return <div className="text-sm text-red-600 text-center py-10">Error: {error}</div>

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Product Catalog Management ({products.length} Items)</h2>
      
      <div className="flex justify-between items-center p-3 border rounded-lg bg-white shadow-sm">
        <button 
          onClick={() => handleOpenModal()} 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add New Product
        </button>
        <input
          type="text"
          placeholder="Search product by name, barcode, or brand..."
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
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Selling Price</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cost Price</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Promotion</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.map(product => (
              <tr key={product.product_id} className="border-b hover:bg-gray-50">
                <td className="p-3 text-sm font-medium">{product.name}</td>
                <td className="p-3 text-sm">{product.barcode}</td>
                <td className="p-3 text-sm">{product.category || '-'}</td>
                {/* FIX: Convert to Number before calling toFixed() */}
                <td className="p-3 text-sm font-semibold text-green-700">{Number(product.selling_price).toFixed(2)}</td>
                <td className="p-3 text-sm text-gray-500">{Number(product.cost_price).toFixed(2)}</td>
                <td className="p-3 text-sm">
                  {getPromotionName(product.promotion_id)}
                </td>
                <td className="p-3 text-sm space-x-2">
                  <button 
                    onClick={() => handleOpenModal(product)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteProduct(product.product_id)}
                    className="text-red-600 hover:text-red-800 text-xs font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredProducts.length === 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">
            {search ? 'No products match your search.' : 'The product catalog is empty.'}
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        title={editingProduct ? 'Edit Product Details' : 'Add New Product to Catalog'}
      >
        <ProductForm 
          product={editingProduct} 
          onSave={handleSaveProduct} 
          onClose={handleCloseModal}
          promotions={PROMOTIONS}
          error={formError}
          isLoading={isSaving}
        />
      </Modal>
    </div>
  )
}