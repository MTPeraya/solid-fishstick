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
  const [memberId, setMemberId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [promotions, setPromotions] = useState<Promotion[]>([])

  const fetchPromotions = useCallback(async () => {
    if (!token) return
    try {
        // Only fetch promotions if logged in (token exists)
        const promoData = await api.get('/api/promotions', { headers: { Authorization: `Bearer ${token}` } })
        // Filter to only include currently active promotions
        const activePromos = (promoData as Promotion[]).filter(p => p.is_active && new Date(p.end_date) >= new Date())
        setPromotions(activePromos);
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

  // 🟢 Helper to get promotion display text
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
    
    const overStockItem = cart.find(item => item.quantity > item.product.stock_quantity)
    if (overStockItem) {
        setErr(`Quantity for ${overStockItem.product.name} exceeds available stock (${overStockItem.product.stock_quantity})`)
        return
    }

    setSubmitting(true)
    try {
      const items = cart.map((it) => ({ product_id: it.product.product_id, quantity: it.quantity }))
      const body: any = { items, payment_method: paymentMethod }
      const mid = memberId.trim()
      if (mid) body.member_id = Number(mid)
      const data = await api.post('/api/transactions', body, { headers: { Authorization: `Bearer ${token}` } })
      
      const finalTotal = Number(data.total_amount).toFixed(2);
      const memberDisc = Number(data.membership_discount).toFixed(2);
      const productDisc = Number(data.product_discount).toFixed(2);
      const initialSubtotal = (Number(data.subtotal) + Number(data.product_discount)).toFixed(2)
      
      setOkMsg(`Sale completed. TX# ${data.transaction_id}. Paid: ฿${finalTotal} (Original Total: ฿${initialSubtotal}, Product Discount: ฿${productDisc}, Member Discount: ฿${memberDisc})`)
      
      setCart([])
      setQ('')
      setResults([])
      setMemberId('')
      fetchPromotions() 
    } catch (e: any) {
      setErr(e?.message || 'Checkout failed')
    } finally {
      setSubmitting(false)
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Member ID (optional)</label>
              <input className="mt-1 w-full border rounded px-3 py-2" type="text" value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="Member ID" />
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
              <button className="w-full px-4 py-2 rounded bg-black text-white disabled:opacity-60" onClick={checkout} disabled={submitting || cart.length === 0}>
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