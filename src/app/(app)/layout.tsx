import { AppSidebar } from '@/components/layout/app-sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar: flex child on desktop, fixed drawer on mobile */}
      <AppSidebar />

      {/* Main content: takes remaining space */}
      {/* pt-14 on mobile accounts for the fixed top bar height */}
      <main className="flex min-h-screen flex-1 flex-col overflow-x-hidden pt-14 md:pt-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
          {children}
        </div>
      </main>
    </div>
  )
}
