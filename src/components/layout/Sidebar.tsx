import { Link, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { getIndex } from '../../utils/storage'
import { labelMonth } from '../../utils/formatting'
import { currentYearMonth } from '../../hooks/useMonthData'

interface Props {
  onClose?: () => void
}

export function Sidebar({ onClose }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const months = getIndex()
  const activeYM = location.pathname.startsWith('/statement/')
    ? location.pathname.split('/statement/')[1]
    : null

  function addMonth() {
    const ym = currentYearMonth()
    navigate(`/statement/${ym}`)
    onClose?.()
  }

  function navTo(ym: string) {
    navigate(`/statement/${ym}`)
    onClose?.()
  }

  return (
    <aside className="flex flex-col h-full bg-gray-900 text-gray-300 w-60 flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-700/50">
        <Link to="/" onClick={onClose} className="flex items-center gap-2 no-underline">
          <span className="text-emerald-400 text-lg">◈</span>
          <span className="font-semibold text-white text-sm tracking-wide">Household P&L</span>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="px-3 pt-4 pb-2 space-y-0.5">
        <Link
          to="/"
          onClick={onClose}
          className={clsx(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm no-underline transition-colors',
            location.pathname === '/'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
          )}
        >
          <span>⬛</span> Dashboard
        </Link>
        <Link
          to="/settings"
          onClick={onClose}
          className={clsx(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm no-underline transition-colors',
            location.pathname === '/settings'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
          )}
        >
          <span>⚙</span> Settings
        </Link>
      </nav>

      {/* Month list */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Months</span>
        <button
          onClick={addMonth}
          className="text-gray-500 hover:text-emerald-400 text-lg leading-none transition-colors"
          title="Open current month"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
        {months.length === 0 && (
          <p className="text-xs text-gray-600 px-3 py-2">No months yet. Click + to start.</p>
        )}
        {[...months].reverse().map((ym) => (
          <button
            key={ym}
            onClick={() => navTo(ym)}
            className={clsx(
              'w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
              activeYM === ym
                ? 'bg-emerald-700/30 text-emerald-300'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
            )}
          >
            <span>{labelMonth(ym)}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
