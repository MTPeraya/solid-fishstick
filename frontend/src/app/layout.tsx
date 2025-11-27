import './globals.css'
import type { ReactNode } from 'react'
import { Playfair_Display } from 'next/font/google'

const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap' })

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${playfair.className} min-h-screen flex flex-col bg-gray-50 text-gray-900`}>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
