'use client'

import { useState } from 'react'

export default function SearchBar() {
  const [q, setQ] = useState('')
  return (
    <input
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder="Search..."
      className="border rounded px-3 py-2"
    />
  )
}