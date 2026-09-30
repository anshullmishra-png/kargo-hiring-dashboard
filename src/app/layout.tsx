import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import LogoutButton from '@/components/LogoutButton'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-inter' })

export const metadata: Metadata = { title: 'Kargo Hiring', robots: { index: false, follow: false } }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <header className="sticky top-0 z-50 border-b border-line bg-sand/85 backdrop-blur-md">
          <nav className="mx-auto flex h-16 max-w-page items-center gap-7 px-4 text-sm">
            <Link href="/" className="flex items-center gap-2.5 text-[17px] font-extrabold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-terra text-sm text-white shadow-btn">K</span>
              <span>
                Kargo<span className="text-terra"> Hiring</span>
              </span>
            </Link>
            <Link href="/" className="font-medium text-inkmut hover:text-ink">Candidates</Link>
            <Link href="/upload" className="font-medium text-inkmut hover:text-ink">Upload CVs</Link>
            <Link href="/rubric" className="font-medium text-inkmut hover:text-ink">Rubric</Link>
            <span className="flex-1" />
            <LogoutButton />
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
