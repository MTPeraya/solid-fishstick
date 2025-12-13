"use client"

import { useEffect, useMemo, useState, useCallback } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'

// --- New Types ---
type Promotion = {
  promotion_id: number
  promotion_name: string
  discount_type: 'PERCENTAGE' | 'FIXED'
  discount_value: string | number
  start_date: string
  end_date: string
  is_active: boolean
}

// Product type updated to include promotion_id
type Product = { product_id: number; barcode: string; name: string; brand?: string | null; category?: string | null; selling_price: string | number; stock_quantity: number; promotion_id?: number | null }
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
  const [memberPhoneError, setMemberPhoneError] = useState<string | null>(null)
  const [newMemberPhoneError, setNewMemberPhoneError] = useState<string | null>(null)

  const fetchPromotions = useCallback(async () => {
    if (!token) return
    try {
        // Only fetch promotions if logged in (token exists)
        const promoData = await api.get('/api/promotions?active_only=true', { headers: { Authorization: `Bearer ${token}` } })
        setPromotions(promoData as Promotion[]);
    } catch (e) {
        console.error("Failed to fetch promotions:", e)
        // This is not a critical error for POS function, so we don't display it to the cashier
    }
  }, [token])

  useEffect(() => {
      fetchPromotions()
  }, [fetchPromotions])


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

  const getPromoText = (productId?: number | null): string => {
    const product = cart.find(item => item.product.product_id === productId)?.product;
    const promoId = product?.promotion_id;
    if (!promoId) return '';

    // Check if the assigned promotion ID is currently active
    const promo = promotions.find(p => p.promotion_id === promoId);
    if (!promo) return '';

    const value = Number(promo.discount_value).toFixed(0);
    const type = promo.discount_type === 'PERCENTAGE' ? `${value}% OFF` : `฿${value} OFF`;

    return `(Promo: ${type})`;
  }

  async function checkout() {
    setErr(null)
    setOkMsg(null)
    if (!token) { setErr('Not signed in'); return }
    if (cart.length === 0) { setErr('Cart is empty'); return }
    const mp = memberPhone.trim()
    if (mp && !/^\d{10}$/.test(mp)) { setMemberPhoneError('Phone must be 10 digits'); return }
    setMemberPhoneError(null)
    
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
      
      const finalTotal = Number(data.total_amount).toFixed(2);
      const memberDisc = Number(data.membership_discount).toFixed(2);
      const productDisc = Number(data.product_discount).toFixed(2);
      const initialSubtotal = (Number(data.subtotal) + Number(data.product_discount)).toFixed(2)
      
      setOkMsg(`Sale completed. TX# ${data.transaction_id}. Paid: ฿${finalTotal} (Original Total: ฿${initialSubtotal}, Product Discount: ฿${productDisc}, Member Discount: ฿${memberDisc})`)
      
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
    if (!/^\d{10}$/.test(phone)) { setNewMemberPhoneError('Phone must be 10 digits'); return }
    setNewMemberPhoneError(null)
    setCreatingMember(true)
    try {
      const data = await api.post('/api/members', { name, phone }, { headers: { Authorization: `Bearer ${token}` } })
      setOkMsg(`Member created (#${data.member_id})`)
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Search products</label>
            <input className="mt-1 w-full border rounded px-3 py-2" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, brand, category, barcode" />
          </div>
          <div className="border rounded p-3 bg-gray-50 max-h-64 overflow-auto">
            {results.length === 0 ? (
              <div className="text-sm text-gray-600">No results</div>
            ) : (
              <ul className="space-y-2">
                {results.map((p) => (
                  <li key={p.product_id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.name} <span className="text-red-500 text-xs font-normal">{getPromoText(p.product_id)}</span></div> 
                      <div className="text-xs text-gray-600">{p.brand || ''} · {p.category || ''}</div>
                      <div className="text-xs">Barcode: {p.barcode}</div>
                    </div>
                    <button className="px-3 py-1 rounded bg-black text-white" onClick={() => addToCart(p)}>
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Scan barcode</label>
            <div className="mt-1 flex gap-2">
              <input className="flex-1 border rounded px-3 py-2" type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Barcode" onKeyDown={(e) => { if (e.key === 'Enter') addBarcode() }} />
              <button className="px-3 py-2 rounded bg-black text-white" onClick={addBarcode}>Add</button>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-medium">Cart</div>
            <div className="text-sm">Est. Pre-Discount Subtotal: ฿{subtotal.toFixed(2)}</div> 
          </div>
          <div className="border rounded p-3">
            {cart.length === 0 ? (
              <div className="text-sm text-gray-600">Cart is empty</div>
            ) : (
              <ul className="space-y-2">
                {cart.map((it) => (
                  <li key={it.product.product_id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{it.product.name}</div>
                      <div className="text-xs text-gray-600">
                         ฿{Number(it.product.selling_price).toFixed(2)} · Stock {it.product.stock_quantity} 
                         <span className="text-red-500 ml-1 text-xs font-normal">{getPromoText(it.product.product_id)}</span> 
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="px-2 py-1 rounded border" onClick={() => updateQty(it.product.product_id, it.quantity - 1)}>-</button>
                      <input className="w-14 border rounded px-2 py-1 text-center" type="number" min={1} value={it.quantity} onChange={(e) => updateQty(it.product.product_id, Number(e.target.value))} />
                      <button className="px-2 py-1 rounded border" onClick={() => updateQty(it.product.product_id, it.quantity + 1)}>+</button>
                      <button className="px-2 py-1 rounded border" onClick={() => removeItem(it.product.product_id)}>Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border rounded p-3">
            <div className="text-sm font-medium">Create Member</div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="w-full border rounded px-3 py-2" type="text" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Full name" />
              <div>
                <input className="w-full border rounded px-3 py-2" type="text" value={newMemberPhone} onChange={(e) => { setNewMemberPhone(e.target.value); if (e.target.value.trim() && !/^\d{10}$/.test(e.target.value.trim())) setNewMemberPhoneError('Phone must be 10 digits'); else setNewMemberPhoneError(null) }} placeholder="Phone number" />
                {newMemberPhoneError && <div className="text-xs text-red-600 mt-1">{newMemberPhoneError}</div>}
              </div>
              <button className="w-full px-4 py-2 rounded bg-black text-white disabled:opacity-60" onClick={createMember} disabled={creatingMember || !newMemberName.trim() || !newMemberPhone.trim() || !!newMemberPhoneError}>
                {creatingMember ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Member Phone (optional)</label>
              <input className="mt-1 w-full border rounded px-3 py-2" type="text" value={memberPhone} onChange={(e) => { setMemberPhone(e.target.value); if (e.target.value.trim() && !/^\d{10}$/.test(e.target.value.trim())) setMemberPhoneError('Phone must be 10 digits'); else setMemberPhoneError(null) }} placeholder="Phone number" />
              {memberPhoneError && <div className="text-xs text-red-600 mt-1">{memberPhoneError}</div>}
            </div>
            <div>
              <label className="text-sm font-medium">Payment method</label>
              <select className="mt-1 w-full border rounded px-3 py-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
                <option>Cash</option>
                <option>Card</option>
                <option>QR Code</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="w-full px-4 py-2 rounded bg-black text-white disabled:opacity-60" onClick={checkout} disabled={submitting || cart.length === 0 || (!!memberPhone.trim() && !!memberPhoneError)}>
                {submitting ? 'Processing…' : 'Checkout'}
              </button>
            </div>
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}
          {okMsg && <div className="text-sm text-green-700">{okMsg}</div>}
        </div>
      </div>
    </div>
  )
}
