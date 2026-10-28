import React, { useEffect, useMemo, useState } from 'react'
import type { ProfileStat, SortColumn, SortDirection } from './types'

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'playerName', label: 'playerName' },
  { key: 'deviceId', label: 'deviceId' },
  { key: 'installedModules', label: 'installedModules' },
  { key: 'availableQuestions', label: 'availableQuestions' },
  { key: 'answeredQuestions', label: 'answeredQuestions' },
  { key: 'correctAnswers', label: 'correctAnswers' },
  { key: 'wrongAnswers', label: 'wrongAnswers' },
  { key: 'accuracy', label: 'accuracy' },
  { key: 'masteryRank', label: 'masteryRank' },
  { key: 'sentAtUtc', label: 'sentAtUtc' },
  { key: 'created_at', label: 'created_at' },
]

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('novara_token'))
  const [authenticated, setAuthenticated] = useState<boolean>(false)
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true)
  const [currentUsername, setCurrentUsername] = useState<string>('admin')

  const [loginUsername, setLoginUsername] = useState<string>('')
  const [loginPassword, setLoginPassword] = useState<string>('')
  const [loginError, setLoginError] = useState<string>('')
  const [loginLoading, setLoginLoading] = useState<boolean>(false)

  const [rows, setRows] = useState<ProfileStat[]>([])
  const [loadingStats, setLoadingStats] = useState<boolean>(false)
  const [statsError, setStatsError] = useState<string>('')

  const [search, setSearch] = useState<string>('')
  const [sortCol, setSortCol] = useState<SortColumn>('created_at')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')
  const [selectedRow, setSelectedRow] = useState<ProfileStat | null>(null)

  const [showSettings, setShowSettings] = useState<boolean>(false)
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState<string>('')
  const [settingsNewUsername, setSettingsNewUsername] = useState<string>('')
  const [settingsNewPassword, setSettingsNewPassword] = useState<string>('')
  const [settingsMessage, setSettingsMessage] = useState<string>('')
  const [settingsError, setSettingsError] = useState<string>('')
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false)

  const getHeaders = (customToken?: string | null) => {
    const activeToken = customToken !== undefined ? customToken : token
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`
    }
    return headers
  }

  const fetchStats = async (overrideToken?: string | null) => {
    setLoadingStats(true)
    setStatsError('')
    try {
      const res = await fetch('/api/stats', {
        headers: getHeaders(overrideToken),
        credentials: 'include',
      })
      if (res.status === 401) {
        setAuthenticated(false)
        localStorage.removeItem('novara_token')
        setToken(null)
        return
      }
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load stats')
      }
      setRows(data.rows || [])
      if (data.username) {
        setCurrentUsername(data.username)
        setSettingsNewUsername(data.username)
      }
      setAuthenticated(true)
    } catch (err: any) {
      setStatsError(err.message || 'Error loading stats')
    } finally {
      setLoadingStats(false)
      setCheckingAuth(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: loginUsername.trim() || undefined,
          password: loginPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials')
      }
      if (data.token) {
        localStorage.setItem('novara_token', data.token)
        setToken(data.token)
      }
      if (data.username) {
        setCurrentUsername(data.username)
        setSettingsNewUsername(data.username)
      }
      setLoginPassword('')
      setAuthenticated(true)
      await fetchStats(data.token)
    } catch (err: any) {
      setLoginError(err.message || 'Login failed')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/login', { method: 'DELETE', credentials: 'include' }).catch(() => {})
    localStorage.removeItem('novara_token')
    setToken(null)
    setAuthenticated(false)
    setRows([])
  }

  const handleExportCsv = async () => {
    try {
      const res = await fetch('/api/export', {
        headers: getHeaders(),
        credentials: 'include',
      })
      if (!res.ok) {
        throw new Error('Export failed')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'novara_profile_stats.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setStatsError(err.message || 'Failed to export CSV')
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSettingsSaving(true)
    setSettingsError('')
    setSettingsMessage('')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: settingsCurrentPassword,
          newUsername: settingsNewUsername.trim(),
          newPassword: settingsNewPassword || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update settings')
      }
      if (data.token) {
        localStorage.setItem('novara_token', data.token)
        setToken(data.token)
      }
      if (data.username) {
        setCurrentUsername(data.username)
      }
      setSettingsCurrentPassword('')
      setSettingsNewPassword('')
      setSettingsMessage('Credentials updated.')
    } catch (err: any) {
      setSettingsError(err.message || 'Update failed')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const filteredAndSortedRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? rows.filter(
          (r) =>
            (r.playerName || '').toLowerCase().includes(q) ||
            (r.deviceId || '').toLowerCase().includes(q)
        )
      : rows

    return [...filtered].sort((a, b) => {
      const valA = a[sortCol]
      const valB = b[sortCol]
      if (valA === valB) return 0
      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1

      const cmp =
        typeof valA === 'number' && typeof valB === 'number'
          ? valA - valB
          : String(valA).localeCompare(String(valB), undefined, { numeric: true })

      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, search, sortCol, sortDir])

  const formatValue = (col: SortColumn, value: unknown) => {
    if (value === null || value === undefined || value === '') return '-'
    if (col === 'accuracy' && typeof value === 'number') {
      return Number.isInteger(value) ? String(value) : value.toFixed(2)
    }
    return String(value)
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
        Loading...
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h1 className="text-lg font-semibold text-slate-900 mb-1">NOVARA Admin</h1>
          <p className="text-xs text-slate-500 mb-5">Sign in to view profile stats uploads</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="admin"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            {loginError && <p className="text-xs text-red-600">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold tracking-tight">NOVARA Profile Stats</h1>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              Total: {filteredAndSortedRows.length}
              {filteredAndSortedRows.length !== rows.length ? ` / ${rows.length}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fetchStats()}
              disabled={loadingStats}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loadingStats ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={handleExportCsv}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </button>
            <button
              onClick={() => {
                setSettingsError('')
                setSettingsMessage('')
                setSettingsNewUsername(currentUsername)
                setShowSettings(true)
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by playerName or deviceId..."
            className="w-full sm:max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          {statsError && <p className="text-xs text-red-600">{statsError}</p>}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="py-2.5 px-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-slate-100"
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortCol === col.key && (
                          <span>{sortDir === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="py-8 text-center text-slate-400">
                      {loadingStats ? 'Loading records...' : 'No records found'}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedRow(row)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      {COLUMNS.map((col) => (
                        <td key={col.key} className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                          {formatValue(col.key, row[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {selectedRow && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedRow(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-lg p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold">Record Details (#{selectedRow.id})</h2>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>
            <dl className="mt-3 divide-y divide-slate-100 text-xs">
              {COLUMNS.map((col) => (
                <div key={col.key} className="py-2 flex justify-between gap-4">
                  <dt className="font-medium text-slate-500">{col.label}</dt>
                  <dd className="text-slate-900 break-all text-right">
                    {formatValue(col.key, selectedRow[col.key])}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {showSettings && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-sm font-semibold">Admin Account Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSaveSettings} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  New Username
                </label>
                <input
                  type="text"
                  required
                  value={settingsNewUsername}
                  onChange={(e) => setSettingsNewUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={settingsNewPassword}
                  onChange={(e) => setSettingsNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Current Password (required)
                </label>
                <input
                  type="password"
                  required
                  value={settingsCurrentPassword}
                  onChange={(e) => setSettingsCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              {settingsError && <p className="text-xs text-red-600">{settingsError}</p>}
              {settingsMessage && <p className="text-xs text-emerald-600">{settingsMessage}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {settingsSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
