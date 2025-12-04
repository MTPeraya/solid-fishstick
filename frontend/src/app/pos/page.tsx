"use client"

import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'

type Product = { product_id: number; barcode: string; name: string; brand?: string | null; category?: string | null; selling_price: number | string; stock_quantity: number }
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
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        return next
      }
      return [...prev, { product: p, quantity: 1 }]
    })
  }

  function updateQty(pid: number, qty: number) {
    setCart((prev) => prev.map((it) => it.product.product_id === pid ? { ...it, quantity: Math.max(1, qty) } : it))
  }

  function removeItem(pid: number) {
    setCart((prev) => prev.filter((it) => it.product.product_id !== pid))
  }

  const subtotal = useMemo(() => cart.reduce((sum, it) => sum + Number(it.product.selling_price) * it.quantity, 0), [cart])

  async function checkout() {
    setErr(null)
    setOkMsg(null)
    if (!token) { setErr('Not signed in'); return }
    if (cart.length === 0) { setErr('Cart is empty'); return }
    setSubmitting(true)
    try {
      const items = cart.map((it) => ({ product_id: it.product.product_id, quantity: it.quantity }))
      const body: any = { items, payment_method: paymentMethod }
      const mid = memberId.trim()
      if (mid) body.member_id = Number(mid)
      const data = await api.post('/api/transactions', body, { headers: { Authorization: `Bearer ${token}` } })
      setOkMsg(`Sale completed. TX# ${data.transaction_id}`)
      setCart([])
      setQ('')
      setResults([])
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
                      <div className="font-medium">{p.name}</div>
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
            <div className="text-sm">Subtotal: ฿{subtotal.toFixed(2)}</div>
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
                      <div className="text-xs text-gray-600">฿{Number(it.product.selling_price).toFixed(2)} · Stock {it.product.stock_quantity}</div>
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
