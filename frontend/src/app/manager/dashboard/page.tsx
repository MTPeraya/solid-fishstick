"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { api } from "../../../lib/api"
import { useAuth } from "../../../hooks/useAuth"
import Link from 'next/link' // Import Link for navigation

// Types based on backend models/routes
type Tx = {
  transaction_id: number
  transaction_date: string
  employee_id: string
  member_id?: number | null
  subtotal: string | number
  total_amount: string | number
  payment_method: string
}

type Product = {
  product_id: number
  name: string
  stock_quantity: number
  min_stock: number
}

// Helper for displaying currency
const formatCurrency = (amount: string | number): string => 
  `฿${Number(amount).toFixed(2)}`


export default function ManagerDashboardPage() {
  const { token } = useAuth()
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      // 1. Fetch transactions (uses list_transactions route)
      // Fetch a large limit of transactions for comprehensive sales data
      const txData = await api.get("/api/transactions?limit=1000", { headers: { Authorization: `Bearer ${token}` } }) as Tx[]
      setTransactions(txData)

      // 2. Fetch all products for inventory check (uses list_products route)
      const prodData = await api.get("/api/products") as any[]
      setProducts(prodData.map(p => ({
        product_id: p.product_id,
        name: p.name,
        stock_quantity: Number(p.stock_quantity),
        min_stock: Number(p.min_stock),
      })))

    } catch (e: any) {
      setError(e?.message || "Failed to load dashboard data")
      setTransactions([])
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { loadData() }, [loadData])

  const { totalSales, totalTransactions, lowStockProducts, totalLowStockCount } = useMemo(() => {
    // KPI Calculation
    const totalSales = transactions.reduce((sum, tx) => sum + Number(tx.total_amount), 0)
    const totalTransactions = transactions.length
    
    // Low Stock Calculation
    const allLowStock = products.filter(p => p.stock_quantity < p.min_stock)
    
    return {
      totalSales: formatCurrency(totalSales),
      totalTransactions: totalTransactions.toLocaleString(),
      lowStockProducts: allLowStock.slice(0, 10), // Limit to top 10 for dashboard view
      totalLowStockCount: allLowStock.length, // use the full count
    }
  }, [transactions, products])

  if (loading) return (
    <div className="text-sm text-gray-600">Loading dashboard data...</div>
  )

  if (error) return (
    <div className="text-sm text-red-600">Error: {error}</div>
  )

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Overview</h2>
      
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Sales KPI (no link) */}
        <div className="bg-white p-4 border rounded-lg shadow">
          <p className="text-sm font-medium text-gray-500">Total Sales</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalSales}</p>
          <p className="text-xs text-gray-500">from {totalTransactions} transactions</p>
        </div>
        
        {/* Total Transactions KPI (no link) */}
        <div className="bg-white p-4 border rounded-lg shadow">
          <p className="text-sm font-medium text-gray-500">Total Transactions</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalTransactions}</p>
          <p className="text-xs text-gray-500">all time</p>
        </div>
        
        {/* Low Stock Products KPI - NOW LINKS TO INVENTORY */}
        <Link href="/manager/inventory" className="block bg-white p-4 border rounded-lg shadow hover:shadow-lg transition-shadow">
          <p className="text-sm font-medium text-gray-500">Low Stock Products</p>
          <p className={`text-2xl font-bold mt-1 ${totalLowStockCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{totalLowStockCount.toLocaleString()}</p>
          <p className="text-xs text-gray-500">items below minimum threshold</p>
        </Link>
      </div>

      {/* Low Stock Alert - NOW LINKS TO INVENTORY */}
      {lowStockProducts.length > 0 && (
        <Link href="/manager/inventory" className="block border border-red-300 bg-red-50 p-4 rounded-lg space-y-3 hover:border-red-500 transition-colors">
          <h3 className="text-lg font-medium text-red-700">⚠️ Low Stock Alert ({lowStockProducts.length})</h3>
          <ul className="space-y-2">
            {lowStockProducts.map((p) => (
              <li key={p.product_id} className="text-sm text-red-600">
                {p.name}: {p.stock_quantity} in stock (Min: {p.min_stock})
              </li>
            ))}
          </ul>
        </Link>
      )}
      
      {/* Transaction History Summary (Last 10) */}
      <h2 className="text-xl font-semibold pt-4">Recent Transactions</h2>
      <div className="border rounded overflow-auto">
        {transactions.length === 0 ? (
          <div className="p-3 text-sm text-gray-600">No transactions loaded</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">#</th>
                <th className="p-2">Date</th>
                <th className="p-2">Cashier</th>
                <th className="p-2">Member</th>
                <th className="p-2">Total</th>
                <th className="p-2">Method</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map((t) => (
                <tr key={t.transaction_id} className="border-t">
                  <td className="p-2">{t.transaction_id}</td>
                  <td className="p-2">{new Date(t.transaction_date).toLocaleString()}</td>
                  <td className="p-2">{t.employee_id}</td>
                  <td className="p-2">{t.member_id ?? "N/A"}</td>
                  <td className="p-2">{formatCurrency(t.total_amount)}</td>
                  <td className="p-2">{t.payment_method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}