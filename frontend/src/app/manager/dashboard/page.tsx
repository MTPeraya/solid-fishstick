"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { api } from "../../../lib/api"
import { useAuth } from "../../../hooks/useAuth"
import Link from 'next/link'

// Analytics Types
type ProductSales = {
  product_id: number
  name: string
  total_quantity: number
  total_revenue: number
  transaction_count: number
}

type DailySales = {
  date: string
  transaction_count: number
  total_sales: number
}

type PaymentMethod = {
  payment_method: string
  count: number
  total_amount: number
}

type CategorySales = {
  category: string
  total_quantity: number
  total_revenue: number
  transaction_count: number
}

type ProfitData = {
  total_revenue: number
  total_cost: number
  total_profit: number
  profit_margin: number
}

type Product = {
  product_id: number
  name: string
  stock_quantity: number
  min_stock: number
}

const formatCurrency = (amount: number): string => `฿${amount.toFixed(2)}`

export default function ManagerDashboardPage() {
  const { token } = useAuth()
  const [productSales, setProductSales] = useState<ProductSales[]>([])
  const [dailySales, setDailySales] = useState<DailySales[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [categorySales, setCategorySales] = useState<CategorySales[]>([])
  const [profitData, setProfitData] = useState<ProfitData | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      const headers = { Authorization: `Bearer ${token}` }
      
      const [productSalesData, dailySalesData, paymentData, categoryData, profitDataRes, productsData] = await Promise.all([
        api.get("/api/transactions/analytics/product-sales", { headers }) as Promise<ProductSales[]>,
        api.get("/api/transactions/analytics/daily-sales?days=30", { headers }) as Promise<DailySales[]>,
        api.get("/api/transactions/analytics/payment-methods", { headers }) as Promise<PaymentMethod[]>,
        api.get("/api/transactions/analytics/category-sales", { headers }) as Promise<CategorySales[]>,
        api.get("/api/transactions/analytics/profit", { headers }) as Promise<ProfitData>,
        api.get("/api/products") as Promise<any[]>
      ])

      setProductSales(productSalesData)
      setDailySales(dailySalesData)
      setPaymentMethods(paymentData)
      setCategorySales(categoryData)
      setProfitData(profitDataRes)
      setProducts(productsData.map(p => ({
        product_id: p.product_id,
        name: p.name,
        stock_quantity: Number(p.stock_quantity),
        min_stock: Number(p.min_stock),
      })))

    } catch (e: any) {
      setError(e?.message || "Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { loadData() }, [loadData])

  const analytics = useMemo(() => {
    const totalSales = productSales.reduce((sum, p) => sum + p.total_revenue, 0)
    const totalTransactions = dailySales.reduce((sum, d) => sum + d.transaction_count, 0)
    const lowStockCount = products.filter(p => p.stock_quantity < p.min_stock).length
    const avgDailySales = dailySales.length > 0 
      ? dailySales.reduce((sum, d) => sum + d.total_sales, 0) / dailySales.length 
      : 0
    
    const topProducts = productSales.slice(0, 10)
    const maxRevenue = Math.max(...topProducts.map(p => p.total_revenue), 1)
    const maxQuantity = Math.max(...topProducts.map(p => p.total_quantity), 1)
    
    const maxDailySales = Math.max(...dailySales.map(d => d.total_sales), 1)
    
    const totalPaymentAmount = paymentMethods.reduce((sum, pm) => sum + pm.total_amount, 0)
    
    return {
      totalSales,
      totalTransactions,
      lowStockCount,
      avgDailySales,
      topProducts,
      maxRevenue,
      maxQuantity,
      maxDailySales,
      totalPaymentAmount
    }
  }, [productSales, dailySales, products, paymentMethods])

  if (loading) return (
    <div className="text-sm text-gray-600">Loading analytics...</div>
  )

  if (error) return (
    <div className="text-sm text-red-600">Error: {error}</div>
  )

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-700">Total Revenue</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{formatCurrency(analytics.totalSales)}</p>
          <p className="text-xs text-blue-600 mt-1">Money earned from sales</p>
        </div>
        
        {profitData && (
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 border border-emerald-200 rounded-lg">
            <p className="text-sm font-medium text-emerald-700">Total Profit</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">{formatCurrency(profitData.total_profit)}</p>
            <p className="text-xs text-emerald-600 mt-1">{profitData.profit_margin.toFixed(1)}% margin</p>
          </div>
        )}
        
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-700">Transactions</p>
          <p className="text-2xl font-bold text-green-900 mt-1">{analytics.totalTransactions.toLocaleString()}</p>
          <p className="text-xs text-green-600 mt-1">Total completed</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 border border-purple-200 rounded-lg">
          <p className="text-sm font-medium text-purple-700">Avg Daily Sales</p>
          <p className="text-2xl font-bold text-purple-900 mt-1">{formatCurrency(analytics.avgDailySales)}</p>
          <p className="text-xs text-purple-600 mt-1">Last 30 days</p>
        </div>
        
        <Link 
          href="/manager/inventory" 
          className={`block p-4 border rounded-lg transition-all ${
            analytics.lowStockCount > 0 
              ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:shadow-lg' 
              : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 hover:shadow-md'
          }`}
        >
          <p className={`text-sm font-medium ${analytics.lowStockCount > 0 ? 'text-red-700' : 'text-gray-700'}`}>
            Low Stock Alert
          </p>
          <p className={`text-2xl font-bold mt-1 ${analytics.lowStockCount > 0 ? 'text-red-900' : 'text-gray-900'}`}>
            {analytics.lowStockCount}
          </p>
          <p className={`text-xs mt-1 ${analytics.lowStockCount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {analytics.lowStockCount > 0 ? 'Items need restocking' : 'All items in stock'}
          </p>
        </Link>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Products by Revenue - Horizontal Bar Chart */}
        <div className="bg-white p-5 border rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">🏆 Top Products by Revenue</h3>
          {analytics.topProducts.length === 0 ? (
            <p className="text-sm text-gray-500">No sales data available</p>
          ) : (
            <div className="space-y-3">
              {analytics.topProducts.slice(0, 8).map((product, idx) => {
                const widthPercent = (product.total_revenue / analytics.maxRevenue) * 100
                const colors = ['bg-blue-600', 'bg-blue-500', 'bg-blue-400', 'bg-blue-300']
                const color = colors[Math.min(idx, colors.length - 1)]
                return (
                  <div key={product.product_id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate flex-1 mr-2">
                        <span className="text-gray-400 mr-1">#{idx + 1}</span>
                        {product.name}
                      </span>
                      <span className="text-gray-700 font-semibold">{formatCurrency(product.total_revenue)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div 
                        className={`${color} h-2.5 rounded-full transition-all duration-500`}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {product.total_quantity} units • {product.transaction_count} orders
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Payment Methods - Donut/Pie Chart */}
        <div className="bg-white p-5 border rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">💳 Payment Methods Distribution</h3>
          {paymentMethods.length === 0 ? (
            <p className="text-sm text-gray-500">No payment data available</p>
          ) : (
            <div className="flex flex-col items-center">
              {/* Donut Chart */}
              <div className="relative w-48 h-48 mb-4">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  {(() => {
                    let currentAngle = 0
                    const colors = {
                      'Cash': '#10b981',
                      'Card': '#3b82f6',
                      'QR Code': '#8b5cf6'
                    } as Record<string, string>
                    
                    return paymentMethods.map((pm) => {
                      const percentage = analytics.totalPaymentAmount > 0 
                        ? (pm.total_amount / analytics.totalPaymentAmount) * 100 
                        : 0
                      const angle = (percentage / 100) * 360
                      const radius = 40
                      const innerRadius = 25
                      
                      const startAngle = currentAngle
                      const endAngle = currentAngle + angle
                      currentAngle = endAngle
                      
                      const startRad = (startAngle * Math.PI) / 180
                      const endRad = (endAngle * Math.PI) / 180
                      
                      const x1 = 50 + radius * Math.cos(startRad)
                      const y1 = 50 + radius * Math.sin(startRad)
                      const x2 = 50 + radius * Math.cos(endRad)
                      const y2 = 50 + radius * Math.sin(endRad)
                      
                      const x3 = 50 + innerRadius * Math.cos(endRad)
                      const y3 = 50 + innerRadius * Math.sin(endRad)
                      const x4 = 50 + innerRadius * Math.cos(startRad)
                      const y4 = 50 + innerRadius * Math.sin(startRad)
                      
                      const largeArc = angle > 180 ? 1 : 0
                      
                      const pathData = [
                        `M ${x1} ${y1}`,
                        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                        `L ${x3} ${y3}`,
                        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
                        'Z'
                      ].join(' ')
                      
                      return (
                        <path
                          key={pm.payment_method}
                          d={pathData}
                          fill={colors[pm.payment_method] || '#6b7280'}
                          className="hover:opacity-80 transition-opacity"
                        />
                      )
                    })
                  })()}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{paymentMethods.length}</div>
                    <div className="text-xs text-gray-500">Methods</div>
                  </div>
                </div>
              </div>
              
              {/* Legend */}
              <div className="w-full space-y-2">
                {paymentMethods.map((pm) => {
                  const percentage = analytics.totalPaymentAmount > 0 
                    ? (pm.total_amount / analytics.totalPaymentAmount) * 100 
                    : 0
                  const colors = {
                    'Cash': 'bg-green-500',
                    'Card': 'bg-blue-500',
                    'QR Code': 'bg-purple-500'
                  } as Record<string, string>
                  const color = colors[pm.payment_method] || 'bg-gray-500'
                  
                  return (
                    <div key={pm.payment_method} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${color}`} />
                        <span className="text-sm font-medium">{pm.payment_method}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{percentage.toFixed(1)}%</div>
                        <div className="text-xs text-gray-500">{formatCurrency(pm.total_amount)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Daily Sales Trend - Line Chart */}
        <div className="bg-white p-5 border rounded-lg shadow lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">📈 Sales Trend (Last 30 Days)</h3>
          {dailySales.length === 0 ? (
            <p className="text-sm text-gray-500">No sales data available</p>
          ) : (
            <div className="space-y-2">
              <div className="relative h-64 border-l border-b border-gray-200">
                <svg viewBox="0 0 1000 250" className="w-full h-full" preserveAspectRatio="none">
                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4].map((i) => (
                    <line
                      key={i}
                      x1="0"
                      y1={i * 62.5}
                      x2="1000"
                      y2={i * 62.5}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />
                  ))}
                  
                  {/* Area under line */}
                  <defs>
                    <linearGradient id="salesGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  
                  {dailySales.length > 1 && (
                    <>
                      <path
                        d={`M 0 250 ${dailySales.map((day, idx) => {
                          const x = (idx / (dailySales.length - 1)) * 1000
                          const y = 250 - ((day.total_sales / analytics.maxDailySales) * 250)
                          return `L ${x} ${y}`
                        }).join(' ')} L 1000 250 Z`}
                        fill="url(#salesGradient)"
                      />
                      
                      {/* Line */}
                      <path
                        d={dailySales.map((day, idx) => {
                          const x = (idx / (dailySales.length - 1)) * 1000
                          const y = 250 - ((day.total_sales / analytics.maxDailySales) * 250)
                          return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                        }).join(' ')}
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      
                      {/* Data points */}
                      {dailySales.map((day, idx) => {
                        const x = (idx / (dailySales.length - 1)) * 1000
                        const y = 250 - ((day.total_sales / analytics.maxDailySales) * 250)
                        return (
                          <g key={day.date}>
                            <circle
                              cx={x}
                              cy={y}
                              r="4"
                              fill="white"
                              stroke="#8b5cf6"
                              strokeWidth="2"
                              className="hover:r-6 transition-all"
                            />
                            <title>{`${new Date(day.date).toLocaleDateString()}\n${formatCurrency(day.total_sales)}\n${day.transaction_count} transactions`}</title>
                          </g>
                        )
                      })}
                    </>
                  )}
                </svg>
                
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-0 -ml-16 flex flex-col justify-between text-xs text-gray-500 text-right w-14">
                  <span className="block">{formatCurrency(analytics.maxDailySales)}</span>
                  <span className="block">{formatCurrency(analytics.maxDailySales * 0.75)}</span>
                  <span className="block">{formatCurrency(analytics.maxDailySales * 0.5)}</span>
                  <span className="block">{formatCurrency(analytics.maxDailySales * 0.25)}</span>
                  <span className="block">฿0</span>
                </div>
              </div>
              
              {/* X-axis labels */}
              <div className="flex justify-between text-xs text-gray-500 px-2">
                <span>{dailySales[0] ? new Date(dailySales[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                <span>{dailySales[Math.floor(dailySales.length / 2)] ? new Date(dailySales[Math.floor(dailySales.length / 2)].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                <span>Today</span>
              </div>
            </div>
          )}
        </div>

        {/* Category Rankings */}
        <div className="bg-white p-5 border rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">🏷️ Top Categories by Revenue</h3>
          {categorySales.length === 0 ? (
            <p className="text-sm text-gray-500">No category data available</p>
          ) : (
            <div className="space-y-4">
              {categorySales.slice(0, 6).map((category, idx) => {
                const totalCategoryRevenue = categorySales.reduce((sum, c) => sum + c.total_revenue, 0)
                const percentage = totalCategoryRevenue > 0 
                  ? (category.total_revenue / totalCategoryRevenue) * 100 
                  : 0
                
                const colors = [
                  'bg-indigo-600',
                  'bg-indigo-500',
                  'bg-purple-500',
                  'bg-violet-500',
                  'bg-indigo-400',
                  'bg-purple-400'
                ]
                const color = colors[idx % colors.length]
                
                const icons = {
                  'Drinks': '🥤',
                  'Dairy': '🥛',
                  'Bakery': '🍞',
                  'Groceries': '🛒',
                  'Personal Care': '🧴',
                  'Snacks': '🍿',
                  'Household': '🧹',
                  'Produce': '🥬',
                  'Frozen': '🧊',
                  'Canned': '🥫'
                } as Record<string, string>
                const icon = icons[category.category] || '📦'
                
                return (
                  <div key={category.category}>
                    <div className="flex justify-between items-center text-sm mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{icon}</span>
                        <div>
                          <div className="font-semibold">
                            <span className="text-gray-400 mr-1">#{idx + 1}</span>
                            {category.category}
                          </div>
                          <div className="text-xs text-gray-500">
                            {category.total_quantity} units • {category.transaction_count} orders
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-indigo-600">{formatCurrency(category.total_revenue)}</div>
                        <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div 
                        className={`${color} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top Products by Quantity - List with visual indicators */}
        <div className="bg-white p-5 border rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">📦 Most Popular Products (by quantity sold)</h3>
          {analytics.topProducts.length === 0 ? (
            <p className="text-sm text-gray-500">No sales data available</p>
          ) : (
            <div className="space-y-3">
              {[...analytics.topProducts]
                .sort((a, b) => b.total_quantity - a.total_quantity)
                .slice(0, 8)
                .map((product, idx) => {
                  const widthPercent = (product.total_quantity / analytics.maxQuantity) * 100
                  const colors = [
                    'bg-green-600',
                    'bg-green-500', 
                    'bg-emerald-500',
                    'bg-teal-500',
                    'bg-green-400',
                    'bg-emerald-400',
                    'bg-teal-400',
                    'bg-cyan-400'
                  ]
                  const color = colors[idx % colors.length]
                  
                  return (
                    <div key={product.product_id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium truncate flex-1 mr-2">
                          <span className="text-gray-400 mr-1">#{idx + 1}</span>
                          {product.name}
                        </span>
                        <span className="text-gray-700 font-semibold">{product.total_quantity} units</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div 
                          className={`${color} h-2.5 rounded-full transition-all duration-500`}
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Revenue: {formatCurrency(product.total_revenue)}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* Product Performance Table */}
      <div className="bg-white p-5 border rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">📊 Product Performance Summary</h3>
        {productSales.length === 0 ? (
          <p className="text-sm text-gray-500">No product sales data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-semibold">Rank</th>
                  <th className="text-left p-3 font-semibold">Product</th>
                  <th className="text-right p-3 font-semibold">Revenue</th>
                  <th className="text-right p-3 font-semibold">Qty Sold</th>
                  <th className="text-right p-3 font-semibold">Orders</th>
                  <th className="text-right p-3 font-semibold">Avg Price</th>
                </tr>
              </thead>
              <tbody>
                {productSales.slice(0, 15).map((product, idx) => (
                  <tr key={product.product_id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                        idx === 1 ? 'bg-gray-300 text-gray-700' :
                        idx === 2 ? 'bg-orange-400 text-orange-900' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="p-3 font-medium">{product.name}</td>
                    <td className="p-3 text-right font-semibold text-blue-600">{formatCurrency(product.total_revenue)}</td>
                    <td className="p-3 text-right">{product.total_quantity}</td>
                    <td className="p-3 text-right">{product.transaction_count}</td>
                    <td className="p-3 text-right text-gray-600">
                      {formatCurrency(product.total_revenue / product.total_quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
