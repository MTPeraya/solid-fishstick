'use client'

import { useState } from 'react'

export default function DocumentUploader() {
  const [file, setFile] = useState<File | null>(null)
  return (
    <div className="space-y-2">
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      {file && <div className="text-sm">{file.name}</div>}
    </div>
  )
}