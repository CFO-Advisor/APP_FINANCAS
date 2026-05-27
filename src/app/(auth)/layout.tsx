import Link from 'next/link'
import { TrendingUp } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold">Finanças</span>
      </Link>
      {children}
    </div>
  )
}
