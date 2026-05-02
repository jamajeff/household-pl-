import { useState } from 'react'
import { Sidebar } from './Sidebar'

interface Props {
  children: React.ReactNode
}

export function PageShell({ children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="relative flex flex-col w-60 z-50">
            <Sidebar onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
          >
            ☰
          </button>
          <span className="font-semibold text-gray-800 text-sm">Household P&L</span>
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
