import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import LogoutButton from '@/components/LogoutButton'

export const metadata: Metadata = { title: 'Kargo Hiring', robots: { index: false, follow: false } }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-gray-200 bg-white">
          <nav className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold">Kargo Hiring</Link>
            <Link href="/" className="text-gray-600 hover:text-black">Candidates</Link>
            <Link href="/upload" className="text-gray-600 hover:text-black">Upload CVs</Link>
            <Link href="/rubric" className="text-gray-600 hover:text-black">Rubric</Link>
            <span className="flex-1" />
            <LogoutButton />
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
