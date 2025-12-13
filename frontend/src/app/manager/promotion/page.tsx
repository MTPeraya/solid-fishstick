"use client"

import { useEffect, useState, useMemo } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

// --- Types ---
type Promotion = {
  promotion_id: number
  promotion_name: string
  discount_type: 'PERCENTAGE' | 'FIXED'
  discount_value: string | number
  start_date: string // ISO date string
  end_date: string   // ISO date string
  is_active: boolean
}

type PromotionForm = Omit<Promotion, 'promotion_id'>

// Helper for formatting date strings to 'YYYY-MM-DD' for date inputs
const formatDateForInput = (dateString: string): string => {
  return dateString.split('T')[0] // Truncate timestamp part
}

export default function ManagerPromotionPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  // State for adding new promotion
  const [newPromo, setNewPromo] = useState<PromotionForm>({
    promotion_name: '',
    discount_type: 'PERCENTAGE',
    discount_value: '0.00',
    start_date: formatDateForInput(new Date().toISOString()),
    end_date: formatDateForInput(new Date().toISOString()),
    is_active: true,
  })

  // State for editing
  const [editId, setEditId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Partial<PromotionForm>>({})
  const [savingId, setSavingId] = useState<number | null>(null)

  async function load() {
    if (!token) return

    setLoading(true)
    setErr(null)
    setOkMsg(null)
    try {
      const data = await api.get("/api/promotions", { headers: { Authorization: `Bearer ${token}` } })
      setItems(data as Promotion[])
    } catch (e: any) {
      setErr(e?.message || 'Failed to load promotions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  // --- Add/Create Functionality ---
  function handleNewPromoChange(key: keyof PromotionForm, value: string | number | boolean) {
    setNewPromo(prev => ({ ...prev, [key]: value }))
  }
  
  const isNewPromoValid = useMemo(() => {
    const value = Number(newPromo.discount_value)
    const startDate = new Date(newPromo.start_date)
    const endDate = new Date(newPromo.end_date)
    
    if (!newPromo.promotion_name.trim() || isNaN(value) || value <= 0) return false;
    if (newPromo.discount_type === 'PERCENTAGE' && value > 100) return false;
    if (endDate < startDate) return false;
    return true;
  }, [newPromo])

  async function addPromotion(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setOkMsg(null)
    if (!token) { setErr('Not signed in'); return }
    if (!isNewPromoValid) { setErr('Invalid form data'); return }

    try {
      const payload = {
        ...newPromo,
        discount_value: newPromo.discount_value.toString(),
      }
      
      await api.post('/api/promotions', payload, { headers: { Authorization: `Bearer ${token}` } })
      
      setOkMsg(`Promotion "${newPromo.promotion_name.trim()}" added successfully.`)
      // Reset form
      setNewPromo({
        promotion_name: '',
        discount_type: 'PERCENTAGE',
        discount_value: '0.00',
        start_date: formatDateForInput(new Date().toISOString()),
        end_date: formatDateForInput(new Date().toISOString()),
        is_active: true,
      })
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Add promotion failed')
    }
  }

  // --- Edit/Update Functionality ---
  function startEdit(p: Promotion) {
    setEditId(p.promotion_id)
    setEditData({
      promotion_name: p.promotion_name,
      discount_type: p.discount_type,
      discount_value: String(p.discount_value),
      start_date: formatDateForInput(p.start_date),
      end_date: formatDateForInput(p.end_date),
      is_active: p.is_active,
    })
    setErr(null)
    setOkMsg(null)
  }

  function cancelEdit() {
    setEditId(null)
    setEditData({})
  }

  function handleEditChange(key: keyof PromotionForm, value: string | number | boolean) {
    setEditData(prev => ({ ...prev, [key]: value }))
  }

  async function saveEdit(id: number) {
    if (!token) { setErr('Not signed in'); return }
    setErr(null)
    setOkMsg(null)
    setSavingId(id)

    const originalPromo = items.find(p => p.promotion_id === id)
    if (!originalPromo) return;

    const payload: Partial<PromotionForm> = {}

    // Check for changes and format payload
    for (const [key, value] of Object.entries(editData)) {
      // Logic to compare against original values (handling string vs number differences)
      if (key === 'discount_value') {
        const oldValue = Number(originalPromo.discount_value).toFixed(2);
        const newValue = Number(value).toFixed(2);
        if (newValue !== oldValue) {
           payload[key] = Number(value)
        }
      } else if (key === 'start_date' || key === 'end_date') {
        const oldDate = formatDateForInput(originalPromo[key]);
        if (value !== oldDate) {
          payload[key] = value as string
        }
      } else if (key === 'is_active') {
        if (value !== originalPromo[key]) {
           payload[key] = value as boolean
        }
      } else {
        const k = key as keyof Promotion
        const oldVal = originalPromo[k]
        const oldStr = oldVal === undefined || oldVal === null ? '' : String(oldVal)
        const newStr = value === undefined || value === null ? '' : String(value)
        if (newStr !== oldStr) {
          payload[key as keyof PromotionForm] = value as any
        }
      }
    }
    
    // Safety check for empty payload
    if (Object.keys(payload).length === 0) {
        setErr('No changes detected.')
        setSavingId(null)
        setEditId(null)
        setEditData({})
        return
    }

    // Full validation before sending
    const finalData = { ...originalPromo, ...payload }
    const value = Number(finalData.discount_value)
    const startDate = new Date(finalData.start_date)
    const endDate = new Date(finalData.end_date)

    if (value <= 0 || (finalData.discount_type === 'PERCENTAGE' && value > 100)) {
        setErr('Invalid discount value.')
        setSavingId(null)
        return
    }
    if (endDate < startDate) {
        setErr('End date must be after start date.')
        setSavingId(null)
        return
    }
    
    try {
      // Convert Decimal strings for backend
      if (payload.discount_value !== undefined) {
        (payload as any).discount_value = payload.discount_value.toString();
      }

      await api.patch(`/api/promotions/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setOkMsg(`Promotion ID ${id} updated successfully.`)
      setEditId(null)
      setEditData({})
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Update failed')
    } finally {
      setSavingId(null)
    }
  }
  
  // --- Delete Functionality ---
  async function removePromotion(id: number) {
    if (!token) { setErr('Not signed in'); return }
    if (!confirm(`Are you sure you want to delete promotion ID ${id}? This will unlink it from all products.`)) return;

    setErr(null)
    setOkMsg(null)
    try {
      await api.delete(`/api/promotions/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      setOkMsg(`Promotion ID ${id} deleted successfully.`)
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Delete failed')
    }
  }

  const sortedItems = useMemo(() => {
    // Sort by end date, with active ones first
    return [...items].sort((a, b) => {
      if (a.is_active && !b.is_active) return -1
      if (!a.is_active && b.is_active) return 1
      return new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
    })
  }, [items])


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Product Promotion Management</h2>
        <button className="px-3 py-2 rounded border" onClick={load} disabled={loading || editId !== null}>Reload</button>
      </div>

      <form className="border rounded p-4 space-y-3 bg-gray-50" onSubmit={addPromotion}>
        <h3 className="text-base font-medium">Add New Promotion</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Promotion Name" value={newPromo.promotion_name} onChange={(e) => handleNewPromoChange('promotion_name', e.target.value)} required disabled={editId !== null} />
          
          <select 
            className="border rounded px-3 py-2" 
            value={newPromo.discount_type} 
            onChange={(e) => handleNewPromoChange('discount_type', e.target.value as 'PERCENTAGE' | 'FIXED')} 
            required disabled={editId !== null}
          >
            <option value="PERCENTAGE">Percentage (%)</option>
            <option value="FIXED">Fixed Amount (฿)</option>
          </select>
          
          <input className="border rounded px-3 py-2" placeholder="Discount Value (e.g. 20.00)" type="number" step="0.01" min="0.01" value={newPromo.discount_value} onChange={(e) => handleNewPromoChange('discount_value', e.target.value)} required disabled={editId !== null} />
          
          <label className="flex items-center gap-2 border rounded px-3 py-2 bg-white">
            Active:
            <input type="checkbox" checked={newPromo.is_active} onChange={(e) => handleNewPromoChange('is_active', e.target.checked)} disabled={editId !== null} />
          </label>
          
          <label className="flex flex-col">
            <span className="text-xs text-gray-500">Start Date</span>
            <input className="border rounded px-3 py-2 mt-1" type="date" value={newPromo.start_date} onChange={(e) => handleNewPromoChange('start_date', e.target.value)} required disabled={editId !== null} />
          </label>
          <label className="flex flex-col">
            <span className="text-xs text-gray-500">End Date</span>
            <input className="border rounded px-3 py-2 mt-1" type="date" value={newPromo.end_date} onChange={(e) => handleNewPromoChange('end_date', e.target.value)} required disabled={editId !== null} />
          </label>
        </div>
        <button className="px-4 py-2 rounded bg-black text-white disabled:opacity-50" type="submit" disabled={loading || editId !== null || !isNewPromoValid}>Add Promotion</button>
      </form>

      {okMsg && <div className="text-sm text-green-700">{okMsg}</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="border rounded p-3 overflow-auto">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-600">No promotions</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2">#</th>
                <th className="py-2">Name</th>
                <th className="py-2">Type</th>
                <th className="py-2">Value</th>
                <th className="py-2">Start Date</th>
                <th className="py-2">End Date</th>
                <th className="py-2">Active</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((p) => {
                const isEditing = p.promotion_id === editId
                return (
                  <tr key={p.promotion_id} className="border-t">
                    <td className="py-2">{p.promotion_id}</td>
                    <td className="py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={editData.promotion_name || ''}
                          onChange={(e) => handleEditChange('promotion_name', e.target.value)}
                          required
                        />
                      ) : (
                        p.promotion_name
                      )}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <select 
                            className="border rounded px-2 py-1 w-full" 
                            value={editData.discount_type || p.discount_type} 
                            onChange={(e) => handleEditChange('discount_type', e.target.value as 'PERCENTAGE' | 'FIXED')} 
                            required
                          >
                            <option value="PERCENTAGE">Percentage</option>
                            <option value="FIXED">Fixed</option>
                          </select>
                      ) : (
                        p.discount_type
                      )}
                    </td>
                    <td className="py-2">
                       {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-20"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={editData.discount_value || String(p.discount_value)}
                          onChange={(e) => handleEditChange('discount_value', e.target.value)}
                          required
                        />
                      ) : (
                        `${Number(p.discount_value).toFixed(2)} ${p.discount_type === 'PERCENTAGE' ? '%' : '฿'}`
                      )}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-32"
                          type="date"
                          value={editData.start_date || formatDateForInput(p.start_date)}
                          onChange={(e) => handleEditChange('start_date', e.target.value)}
                          required
                        />
                      ) : (
                        new Date(p.start_date).toLocaleDateString()
                      )}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-32"
                          type="date"
                          value={editData.end_date || formatDateForInput(p.end_date)}
                          onChange={(e) => handleEditChange('end_date', e.target.value)}
                          required
                        />
                      ) : (
                        new Date(p.end_date).toLocaleDateString()
                      )}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                         <input type="checkbox" checked={editData.is_active !== undefined ? editData.is_active : p.is_active} onChange={(e) => handleEditChange('is_active', e.target.checked)} />
                      ) : (
                        p.is_active ? 'Yes' : 'No'
                      )}
                    </td>
                    <td className="py-2 flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            className="px-2 py-1 rounded bg-black text-white disabled:opacity-50 text-xs"
                            onClick={() => saveEdit(p.promotion_id)}
                            disabled={savingId === p.promotion_id || !editData.promotion_name}
                          >
                            {savingId === p.promotion_id ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            className="px-2 py-1 rounded border text-xs"
                            onClick={cancelEdit}
                            disabled={savingId === p.promotion_id}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="px-2 py-1 rounded border text-xs"
                            onClick={() => startEdit(p)}
                            disabled={editId !== null}
                          >
                            Edit
                          </button>
                          <button
                            className="px-2 py-1 rounded border text-xs"
                            onClick={() => removePromotion(p.promotion_id)}
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
