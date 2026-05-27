import { AppNavbar } from '@/components/layout/app-navbar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppNavbar />
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
