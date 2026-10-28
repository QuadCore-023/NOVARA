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
  const [activeTab, setActiveTab] = useState<'stats' | 'settings'>('stats')

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

  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState<string>('')
  const [settingsNewUsername, setSettingsNewUsername] = useState<string>('')
  const [settingsNewPassword, setSettingsNewPassword] = useState<string>('')
  const [settingsMessage, setSettingsMessage] = useState<string>('')
  const [settingsError, setSettingsError] = useState<string>('')
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false)

  const [confirmClearText, setConfirmClearText] = useState<string>('')
  const [clearingData, setClearingData] = useState<boolean>(false)
  const [clearMessage, setClearMessage] = useState<string>('')
  const [clearError, setClearError] = useState<string>('')

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
    setActiveTab('stats')
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
      setSettingsMessage('Credentials updated successfully!')
    } catch (err: any) {
      setSettingsError(err.message || 'Update failed')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleClearAllData = async () => {
    if (confirmClearText !== 'CONFIRM') return
    setClearingData(true)
    setClearError('')
    setClearMessage('')
    try {
      const res = await fetch('/api/stats', {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to clear data')
      }
      setRows([])
      setConfirmClearText('')
      setClearMessage('All profile stats data has been cleared.')
    } catch (err: any) {
      setClearError(err.message || 'Error clearing data')
    } finally {
      setClearingData(false)
    }
  }

  const handleDeleteSingleRow = async (id: number) => {
    try {
      const res = await fetch(`/api/stats?id=${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include',
      })
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id))
        setSelectedRow(null)
      }
    } catch {}
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
      return `${Number.isInteger(value) ? String(value) : value.toFixed(2)}%`
    }
    return String(value)
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-400 text-sm">
        Loading portal...
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-purple-900/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-blue-900/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 max-w-md w-full mx-auto p-8 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
              NOVARA
            </span>{' '}
            Admin
          </h2>
          <p className="text-gray-400 mb-8 text-sm">Login to manage NOVARA profile stats</p>
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Username</label>
              <input
                type="text"
                placeholder="Username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
              <input
                type="password"
                placeholder="Password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {loginError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors mt-4 shadow-lg shadow-purple-500/20"
            >
              {loginLoading ? 'Signing in...' : 'Access Dashboard'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="bg-gray-900 border-b border-gray-800 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center gap-4">
            <div className="flex items-center space-x-3 shrink-0">
              <span className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                NOVARA Admin
              </span>
              <span className="bg-purple-600/20 border border-purple-500/40 text-purple-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {filteredAndSortedRows.length}
                {filteredAndSortedRows.length !== rows.length ? ` / ${rows.length}` : ''} records
              </span>
            </div>

            <div className="flex items-center space-x-2 overflow-x-auto py-2">
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                  activeTab === 'stats'
                    ? 'bg-gray-800 text-purple-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Profile Stats
              </button>
              <button
                onClick={() => {
                  setSettingsError('')
                  setSettingsMessage('')
                  setClearError('')
                  setClearMessage('')
                  setSettingsNewUsername(currentUsername)
                  setActiveTab('settings')
                }}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                  activeTab === 'settings'
                    ? 'bg-gray-800 text-purple-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Settings
              </button>
              <div className="pl-3 ml-2 border-l border-gray-700 shrink-0">
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors px-2 py-1"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-white">Profile Stats Uploads</h1>
                <p className="text-sm text-gray-400">
                  Live player telemetry uploaded from the NOVARA Unity client
                </p>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={() => fetchStats()}
                  disabled={loadingStats}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loadingStats ? 'Refreshing...' : 'Refresh'}
                </button>
                <button
                  onClick={handleExportCsv}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-purple-500/20"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by playerName or deviceId..."
                  className="w-full sm:max-w-sm bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="text-xs text-gray-400">
                  Showing <span className="text-white font-semibold">{filteredAndSortedRows.length}</span> of{' '}
                  <span className="text-white font-semibold">{rows.length}</span> total rows
                </div>
              </div>

              {statsError && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3">
                  {statsError}
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-900">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/80 text-gray-400">
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="py-3 px-3.5 font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-gray-800 hover:text-purple-400 transition-colors"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {col.label}
                            {sortCol === col.key && (
                              <span className="text-purple-400">{sortDir === 'asc' ? '▲' : '▼'}</span>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredAndSortedRows.length === 0 ? (
                      <tr>
                        <td colSpan={COLUMNS.length} className="py-12 text-center text-gray-500 text-sm">
                          {loadingStats ? 'Loading records...' : 'No profile stats found'}
                        </td>
                      </tr>
                    ) : (
                      filteredAndSortedRows.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedRow(row)}
                          className="hover:bg-gray-800/70 cursor-pointer transition-colors"
                        >
                          {COLUMNS.map((col) => (
                            <td key={col.key} className="py-3 px-3.5 whitespace-nowrap text-gray-200">
                              {col.key === 'masteryRank' && row.masteryRank ? (
                                <span className="bg-purple-600/20 border border-purple-500/40 text-purple-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                  {row.masteryRank}
                                </span>
                              ) : col.key === 'correctAnswers' ? (
                                <span className="text-emerald-400 font-medium">
                                  {formatValue(col.key, row[col.key])}
                                </span>
                              ) : col.key === 'wrongAnswers' ? (
                                <span className="text-rose-400 font-medium">
                                  {formatValue(col.key, row[col.key])}
                                </span>
                              ) : (
                                formatValue(col.key, row[col.key])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <h1 className="text-2xl font-extrabold text-white text-center">Admin Settings</h1>

            <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-2">Update Credentials</h2>
              <p className="text-gray-400 text-sm mb-6">
                Change your admin portal login username and password here.
              </p>

              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">New Username</label>
                  <input
                    type="text"
                    required
                    value={settingsNewUsername}
                    onChange={(e) => setSettingsNewUsername(e.target.value)}
                    placeholder="Enter new username"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    New Password (leave blank to keep current)
                  </label>
                  <input
                    type="password"
                    value={settingsNewPassword}
                    onChange={(e) => setSettingsNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Current Password (required to confirm)
                  </label>
                  <input
                    type="password"
                    required
                    value={settingsCurrentPassword}
                    onChange={(e) => setSettingsCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {settingsError && (
                  <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                    {settingsError}
                  </p>
                )}
                {settingsMessage && (
                  <p className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3 py-2">
                    {settingsMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors mt-4 shadow-lg shadow-purple-500/20"
                >
                  {settingsSaving ? 'Saving...' : 'Save New Credentials'}
                </button>
              </form>
            </div>

            <div className="bg-red-950/30 p-8 rounded-xl border border-red-900/50 shadow-xl">
              <h2 className="text-xl font-bold text-red-500 mb-2">Danger Zone</h2>
              <p className="text-red-400/70 text-sm mb-6">
                Permanently delete all uploaded rows in <code className="text-red-300">profile_stats</code> (useful for cleaning out test data). Type <span className="font-bold text-red-300">CONFIRM</span> below to unlock.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={confirmClearText}
                  onChange={(e) => setConfirmClearText(e.target.value)}
                  placeholder="Type CONFIRM to enable"
                  className="flex-1 bg-gray-900 border border-red-900/60 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="button"
                  disabled={confirmClearText !== 'CONFIRM' || clearingData}
                  onClick={handleClearAllData}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors shrink-0"
                >
                  {clearingData ? 'Clearing...' : `Clear All Data (${rows.length})`}
                </button>
              </div>

              {clearError && <p className="text-xs text-red-400 mt-3">{clearError}</p>}
              {clearMessage && <p className="text-xs text-emerald-400 mt-3">{clearMessage}</p>}
            </div>
          </div>
        )}
      </main>

      {selectedRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedRow(null)}
        >
          <div
            className="w-full max-w-md bg-gray-800 rounded-xl border border-gray-700 shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-700">
              <h2 className="text-base font-bold text-white">Record Details (#{selectedRow.id})</h2>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-900 border border-gray-700"
              >
                Close
              </button>
            </div>
            <dl className="mt-3 divide-y divide-gray-700/60 text-xs">
              {COLUMNS.map((col) => (
                <div key={col.key} className="py-2.5 flex justify-between gap-4">
                  <dt className="font-medium text-gray-400">{col.label}</dt>
                  <dd className="text-gray-100 font-semibold break-all text-right">
                    {formatValue(col.key, selectedRow[col.key])}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 pt-4 border-t border-gray-700 flex justify-between items-center">
              <button
                onClick={() => handleDeleteSingleRow(selectedRow.id)}
                className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/40 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors"
              >
                Delete Record
              </button>
              <button
                onClick={() => setSelectedRow(null)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
