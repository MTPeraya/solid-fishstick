import Link from 'next/link'
import SearchBar from './SearchBar'

export default function Navbar() {
  return (
    <header className="border-b">
      <div className="max-w-6xl mx-auto p-4 flex items-center gap-4">
        <Link href="/" className="font-bold">App</Link>
        <nav className="flex items-center gap-4">
          <Link href="/about-us">About</Link>
          <Link href="/buy">Buy</Link>
        </nav>
        <div className="ml-auto">
          <SearchBar />
        </div>
      </div>
    </header>
  )
}