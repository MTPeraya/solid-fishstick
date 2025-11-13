import './globals.css'
import type { ReactNode } from 'react'
import Navbar from '../components/global/Navbar'
import Footer from '../components/global/Footer'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}