"use client"

import { useEffect, useMemo, useState, useCallback } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'

type Promotion = {
  promotion_id: number
  promotion_name: string
  discount_type: 'PERCENTAGE' | 'FIXED'
  discount_value: string | number
  start_date: string
  end_date: string
  is_active: boolean
}

type Product = { 
  product_id: number
  barcode: string
  name: string
  brand?: string | null
  category?: string | null
  selling_price: string | number
  stock_quantity: number
  promotion_id?: number | null
}

type CartItem = { product: Product; quantity: number }

export default function PosPage() {
  const { token } = useAuth()
  const [q, setQ] = useState('')
  const [barcode, setBarcode] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'QR Code'>('Cash')
  const [memberPhone, setMemberPhone] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberPhone, setNewMemberPhone] = useState('')
  const [creatingMember, setCreatingMember] = useState(false)
  const [showCreateMember, setShowCreateMember] = useState(false)
  const [memberDiscountRate, setMemberDiscountRate] = useState<number>(0)

  const fetchPromotions = useCallback(async () => {
    if (!token) return
    try {
      const promoData = await api.get('/api/promotions?active_only=true', { headers: { Authorization: `Bearer ${token}` } })
      setPromotions(promoData as Promotion[])
    } catch (e) {
      console.error("Failed to fetch promotions:", e)
    }
  }, [token])

  useEffect(() => { fetchPromotions() }, [fetchPromotions])

  // Fetch member discount rate when phone changes
  useEffect(() => {
    const fetchMemberDiscount = async () => {
      const phone = memberPhone.trim()
      if (!token || !phone || !/^\d{10}$/.test(phone)) {
        setMemberDiscountRate(0)
        return
      }
      
      try {
        const members = await api.get(`/api/members?q=${encodeURIComponent(phone)}`, { 
          headers: { Authorization: `Bearer ${token}` } 
        }) as any[]
        
        if (members && members.length > 0) {
          const member = members.find((m: any) => m.phone === phone)
          if (member) {
            // Use current_discount_rate which reflects the rolling-year tier
            const rate = Number(member.current_discount_rate || member.discount_rate) || 0
            setMemberDiscountRate(rate)
          } else {
            setMemberDiscountRate(0)
          }
        } else {
          setMemberDiscountRate(0)
        }
      } catch (e) {
        console.error('Failed to fetch member:', e)
        setMemberDiscountRate(0)
      }
    }
    
    const timer = setTimeout(fetchMemberDiscount, 500)
    return () => clearTimeout(timer)
  }, [memberPhone, token])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!q.trim()) { setResults([]); return }
      try {
        const data = await api.get(`/api/products?q=${encodeURIComponent(q.trim())}`)
        if (!cancelled) setResults(data as Product[])
      } catch (e: any) {
        if (!cancelled) setResults([])
      }
    }
    const t = setTimeout(run, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q])

  async function addBarcode() {
    setErr(null)
    setOkMsg(null)
    const code = barcode.trim()
    if (!code) return
    try {
      const data = await api.get(`/api/products?barcode=${encodeURIComponent(code)}`)
      const list = (data as Product[])
      if (list.length === 0) throw new Error('Product not found')
      addToCart(list[0])
      setBarcode('')
    } catch (e: any) {
      setErr(e?.message || 'Product lookup failed')
    }
  }

  function addToCart(p: Product) {
    setCart((prev) => {
      const idx = prev.findIndex((it) => it.product.product_id === p.product_id)
      if (idx >= 0) {
        const next = [...prev]
        if (next[idx].quantity + 1 > p.stock_quantity) {
          setErr(`Cannot add more than available stock (${p.stock_quantity}) for ${p.name}`)
          return prev
        }
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        return next
      }
      return [...prev, { product: p, quantity: 1 }]
    })
    setErr(null)
  }

  function updateQty(pid: number, qty: number) {
    setCart((prev) => prev.map((it) => {
      if (it.product.product_id === pid) {
        const newQty = Math.max(1, qty)
        if (newQty > it.product.stock_quantity) {
          setErr(`Cannot exceed available stock (${it.product.stock_quantity}) for ${it.product.name}`)
          return it
        }
        return { ...it, quantity: newQty }
      }
      return it
    }))
    setErr(null)
  }

  function removeItem(pid: number) {
    setCart((prev) => prev.filter((it) => it.product.product_id !== pid))
  }

  const subtotal = useMemo(() => cart.reduce((sum, it) => sum + Number(it.product.selling_price) * it.quantity, 0), [cart])
  
  const estimatedDiscounts = useMemo(() => {
    let promoDiscount = 0
    
    // Calculate promotion discounts
    cart.forEach(item => {
      const promo = promotions.find(p => p.promotion_id === item.product.promotion_id)
      if (promo) {
        const itemTotal = Number(item.product.selling_price) * item.quantity
        if (promo.discount_type === 'PERCENTAGE') {
          promoDiscount += itemTotal * (Number(promo.discount_value) / 100)
        } else if (promo.discount_type === 'FIXED') {
          promoDiscount += Number(promo.discount_value) * item.quantity
        }
      }
    })
    
    const subtotalAfterPromo = subtotal - promoDiscount
    
    // Calculate member discount using actual member's discount rate
    const memberDiscount = memberDiscountRate > 0 ? subtotalAfterPromo * (memberDiscountRate / 100) : 0
    
    const estimatedTotal = subtotalAfterPromo - memberDiscount
    
    return {
      promoDiscount,
      memberDiscount,
      subtotalAfterPromo,
      estimatedTotal
    }
  }, [cart, promotions, subtotal, memberDiscountRate])

  const getPromoText = (productId?: number | null): string => {
    const product = cart.find(item => item.product.product_id === productId)?.product || results.find(p => p.product_id === productId)
    const promoId = product?.promotion_id
    if (!promoId) return ''

    const promo = promotions.find(p => p.promotion_id === promoId)
    if (!promo) return ''

    const value = Number(promo.discount_value).toFixed(0)
    const type = promo.discount_type === 'PERCENTAGE' ? `${value}%` : `฿${value}`

    return type
  }

  async function checkout() {
    setErr(null)
    setOkMsg(null)
    if (!token) { setErr('Not signed in'); return }
    if (cart.length === 0) { setErr('Cart is empty'); return }
    const mp = memberPhone.trim()
    if (mp && !/^\d{10}$/.test(mp)) { setErr('Phone must be 10 digits'); return }

    const overStockItem = cart.find(item => item.quantity > item.product.stock_quantity)
    if (overStockItem) {
      setErr(`Quantity for ${overStockItem.product.name} exceeds available stock (${overStockItem.product.stock_quantity})`)
      return
    }

    setSubmitting(true)
    try {
      const items = cart.map((it) => ({ product_id: it.product.product_id, quantity: it.quantity }))
      const body: any = { items, payment_method: paymentMethod }
      const phone = memberPhone.trim()
      if (phone) body.member_phone = phone
      const data = await api.post('/api/transactions', body, { headers: { Authorization: `Bearer ${token}` } })

      const finalTotal = Number(data.total_amount).toFixed(2)
      const memberDisc = Number(data.membership_discount).toFixed(2)
      const productDisc = Number(data.product_discount).toFixed(2)

      setOkMsg(`✅ Sale completed! Transaction #${data.transaction_id} | Total: ฿${finalTotal}`)

      setCart([])
      setQ('')
      setResults([])
      setMemberPhone('')
      fetchPromotions()
    } catch (e: any) {
      setErr(e?.message || 'Checkout failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function createMember() {
    setErr(null)
    setOkMsg(null)
    if (!token) { setErr('Not signed in'); return }
    const name = newMemberName.trim()
    const phone = newMemberPhone.trim()
    if (!name || !phone) { setErr('Name and phone required'); return }
    if (!/^\d{10}$/.test(phone)) { setErr('Phone must be 10 digits'); return }
    setCreatingMember(true)
    try {
      const data = await api.post('/api/members', { name, phone }, { headers: { Authorization: `Bearer ${token}` } })
      setOkMsg(`✅ Member created! ID: ${data.member_id}`)
      setMemberPhone(data.phone)
      setNewMemberName('')
      setNewMemberPhone('')
    } catch (e: any) {
      setErr(e?.message || 'Create member failed')
    } finally {
      setCreatingMember(false)
    }
  }

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4 overflow-hidden">
      {/* Left Panel - Product Search */}
      <div className="w-96 flex flex-col space-y-4 shrink-0">
        {/* Search Box */}
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <label className="text-sm font-semibold text-gray-700 block mb-2">🔍 Search Products</label>
          <input 
            className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:outline-none" 
            type="text" 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            placeholder="Name, brand, category..." 
          />
        </div>

        {/* Barcode Scanner */}
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <label className="text-sm font-semibold text-gray-700 block mb-2">📷 Scan Barcode</label>
          <div className="flex gap-2">
            <input 
              className="flex-1 border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:outline-none" 
              type="text" 
              value={barcode} 
              onChange={(e) => setBarcode(e.target.value)} 
              placeholder="Scan or type barcode" 
              onKeyDown={(e) => { if (e.key === 'Enter') addBarcode() }} 
            />
            <button 
              className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors" 
              onClick={addBarcode}
            >
              Add
            </button>
          </div>
        </div>

        {/* Search Results */}
        <div className="bg-white border rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="p-4 border-b bg-gray-50 shrink-0">
            <h3 className="font-semibold text-gray-700">Search Results</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {results.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <div className="text-4xl mb-2">📦</div>
                <div className="text-sm">No products found</div>
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((p) => {
                  const promo = getPromoText(p.product_id)
                  return (
                    <div key={p.product_id} className="border rounded-lg p-3 hover:border-blue-500 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{p.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{p.brand} • {p.category}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-semibold text-gray-900">฿{Number(p.selling_price).toFixed(2)}</span>
                            {promo && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                                {promo} OFF
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">Stock: {p.stock_quantity}</div>
                        </div>
                        <button 
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shrink-0" 
                          onClick={() => addToCart(p)}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Cart & Checkout */}
      <div className="flex-1 flex flex-col space-y-4 min-w-0">
        {/* Cart */}
        <div className="bg-white border rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="p-4 border-b bg-gray-50 shrink-0">
            <h3 className="font-semibold text-gray-700">🛒 Cart ({cart.length} items)</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <div className="text-5xl mb-3">🛒</div>
                <div className="text-lg font-medium">Cart is empty</div>
                <div className="text-sm mt-1">Add products to get started</div>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((it) => {
                  const promo = getPromoText(it.product.product_id)
                  return (
                    <div key={it.product.product_id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900">{it.product.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-600">฿{Number(it.product.selling_price).toFixed(2)}</span>
                            {promo && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                                {promo} OFF
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">Stock: {it.product.stock_quantity}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            className="w-8 h-8 rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 flex items-center justify-center font-bold text-gray-700" 
                            onClick={() => updateQty(it.product.product_id, it.quantity - 1)}
                          >
                            −
                          </button>
                          <div className="w-16 border-2 border-gray-300 rounded-lg px-2 py-1.5 text-center font-semibold bg-gray-50">
                            {it.quantity}
                          </div>
                          <button 
                            className="w-8 h-8 rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 flex items-center justify-center font-bold text-gray-700" 
                            onClick={() => updateQty(it.product.product_id, it.quantity + 1)}
                          >
                            +
                          </button>
                          <button 
                            className="ml-2 px-3 py-1.5 rounded-lg border-2 border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors" 
                            onClick={() => removeItem(it.product.product_id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t flex justify-between text-sm">
                        <span className="text-gray-600">Line Total:</span>
                        <span className="font-semibold text-gray-900">฿{(Number(it.product.selling_price) * it.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Member & Payment */}
        <div className="bg-white border rounded-lg p-3 shadow-sm space-y-3 shrink-0">
          {/* Member Create - Collapsible */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
            <button
              className="w-full p-2.5 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
              onClick={() => setShowCreateMember(!showCreateMember)}
            >
              <span>➕ Create Member</span>
              <span className="text-gray-400 text-xs">{showCreateMember ? '▼' : '▶'}</span>
            </button>
            <div className={`transition-all duration-300 ease-in-out ${showCreateMember ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="p-2.5 pt-0 border-t">
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <input 
                    className="border-2 border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none" 
                    type="text" 
                    value={newMemberName} 
                    onChange={(e) => setNewMemberName(e.target.value)} 
                    placeholder="Full name" 
                  />
                  <input 
                    className="border-2 border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none" 
                    type="text" 
                    value={newMemberPhone} 
                    onChange={(e) => setNewMemberPhone(e.target.value)} 
                    placeholder="Phone (10 digits)" 
                  />
                  <button 
                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                    onClick={createMember} 
                    disabled={creatingMember || !newMemberName.trim() || !newMemberPhone.trim()}
                  >
                    {creatingMember ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Total Summary */}
          {cart.length > 0 && (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 rounded-lg p-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold text-gray-900">฿{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className={estimatedDiscounts.promoDiscount > 0 ? "text-red-600" : "text-gray-400"}>Promotion Discount:</span>
                  <span className={`font-semibold ${estimatedDiscounts.promoDiscount > 0 ? "text-red-600" : "text-gray-400"}`}>
                    -฿{estimatedDiscounts.promoDiscount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className={estimatedDiscounts.memberDiscount > 0 ? "text-blue-600" : "text-gray-400"}>
                    Member Discount {memberDiscountRate > 0 ? `(${memberDiscountRate}%)` : ''}:
                  </span>
                  <span className={`font-semibold ${estimatedDiscounts.memberDiscount > 0 ? "text-blue-600" : "text-gray-400"}`}>
                    -฿{estimatedDiscounts.memberDiscount.toFixed(2)}
                  </span>
                </div>
                <div className="border-t-2 border-gray-300 pt-1.5 mt-1.5">
                  <div className="flex justify-between">
                    <span className="font-bold text-sm text-gray-900">Estimated Total:</span>
                    <span className="font-bold text-lg text-green-600">฿{estimatedDiscounts.estimatedTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Checkout Section */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">👤 Member Phone</label>
              <input 
                className="w-full border-2 border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none" 
                type="text" 
                value={memberPhone} 
                onChange={(e) => setMemberPhone(e.target.value)} 
                placeholder="Optional" 
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">💳 Payment</label>
              <select 
                className="w-full border-2 border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none h-[38px]" 
                value={paymentMethod} 
                onChange={(e) => setPaymentMethod(e.target.value as any)}
              >
                <option>Cash</option>
                <option>Card</option>
                <option>QR Code</option>
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <button 
                className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-base hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg h-[38px]" 
                onClick={checkout} 
                disabled={submitting || cart.length === 0}
              >
                {submitting ? 'Processing...' : `Pay ฿${estimatedDiscounts.estimatedTotal.toFixed(2)}`}
              </button>
            </div>
          </div>

          {/* Messages */}
          {err && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-2 text-xs text-red-700 font-medium">
              ❌ {err}
            </div>
          )}
          {okMsg && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-2 text-xs text-green-700 font-medium">
              {okMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
