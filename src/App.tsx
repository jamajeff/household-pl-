import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { PageShell } from './components/layout/PageShell'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { StatementPage } from './components/statement/StatementPage'
import { SettingsPage } from './components/dashboard/SettingsPage'
import { NetWorthPage } from './components/networth/NetWorthPage'
import { currentYearMonth } from './hooks/useMonthData'

function StatementRoute() {
  const { yearMonth } = useParams<{ yearMonth: string }>()
  if (!yearMonth) return <Navigate to={`/statement/${currentYearMonth()}`} replace />
  return <StatementPage yearMonth={yearMonth} />
}

export default function App() {
  return (
    <BrowserRouter>
      <PageShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/statement/:yearMonth" element={<StatementRoute />} />
          <Route path="/networth" element={<NetWorthPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageShell>
    </BrowserRouter>
  )
}
