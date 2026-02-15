import { useState, useEffect, useRef } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { storage } from '../storage'
import { getSupabase, isCloudEnabled } from '../sync/supabaseClient'
import type { BackupData } from '../types/routine'

interface Props {
  onClose: () => void
}

export function Settings({ onClose }: Props) {
  const { settings, updateSetting } = useSettings()
  const [clearing, setClearing] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<string>('')
  const [downloadPercent, setDownloadPercent] = useState<number>(-1)
  const [backupStatus, setBackupStatus] = useState<string>('')
  const [obsidianStatus, setObsidianStatus] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isElectron = !!window.electronAPI

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) return
    const unsub1 = window.electronAPI.onUpdateStatus((status: string) => {
      setUpdateStatus(status)
    })
    const unsub2 = window.electronAPI.onUpdateProgress?.((percent: number) => {
      setDownloadPercent(percent)
    })
    return () => { unsub1(); unsub2?.() }
  }, [])

  const update = updateSetting

  const handleClearToday = async () => {
    if (!confirm('今日の実行データをリセットしますか？')) return
    const key = `wabi:exec:`
    // リロードでリセット
    window.location.reload()
  }

  const handleClearAll = async () => {
    setClearing(true)
    await storage.clearExecutions()
    setClearing(false)
    window.location.reload()
  }

  const handleExport = async () => {
    setBackupStatus('')
    if (isElectron) {
      const result = await window.electronAPI.exportBackup()
      setBackupStatus(result.success ? 'エクスポート完了' : 'キャンセルされました')
    } else {
      const data = storage.exportBackupWeb()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `wabi-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setBackupStatus('エクスポート完了')
    }
  }

  const handleImport = async () => {
    setBackupStatus('')
    if (isElectron) {
      const result = await window.electronAPI.importBackup()
      if (result.success) {
        setBackupStatus('インポート完了。再読み込みします…')
        setTimeout(() => window.location.reload(), 1000)
      } else if (result.error) {
        setBackupStatus(`エラー: ${result.error}`)
      }
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as BackupData
        if (!data.version || !data.routines) {
          setBackupStatus('無効なバックアップファイルです')
          return
        }
        if (!confirm(`${data.exportedAt?.slice(0, 10) ?? '不明'} のバックアップを復元しますか？\n現在のデータは上書きされます。`)) return
        const ok = storage.importBackupWeb(data)
        if (ok) {
          setBackupStatus('インポート完了。再読み込みします…')
          setTimeout(() => window.location.reload(), 1000)
        } else {
          setBackupStatus('インポートに失敗しました')
        }
      } catch {
        setBackupStatus('ファイルの読み込みに失敗しました')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleLogout = async () => {
    const supabase = getSupabase()
    if (!supabase) return
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative bg-wabi-bg border border-wabi-border rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-wabi-border">
          <h2 className="text-base font-medium text-wabi-text">設定</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-wabi-text-muted hover:text-wabi-text text-lg leading-none cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">

          {/* タイマー */}
          <Section title="タイマー">
            <ToggleRow
              label="完了時に通知"
              description="タイマー終了時にシステム通知を送る"
              value={settings.timerNotification}
              onChange={v => update('timerNotification', v)}
            />
          </Section>

          {/* 体力 */}
          <Section title="体力">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-wabi-text">ソフトキャップ</p>
                  <p className="text-xs text-wabi-text-muted mt-0.5">「よくやった」が表示される閾値</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={5}
                    value={Math.round((settings.softCapRatio ?? 0.9) * 100)}
                    onChange={e => update('softCapRatio', Number(e.target.value) / 100)}
                    className="w-20 h-1 accent-wabi-accent cursor-pointer"
                    style={{ accentColor: '#c4a882' }}
                  />
                  <span className="text-sm font-mono text-wabi-text-muted w-8 text-center">
                    {Math.round((settings.softCapRatio ?? 0.9) * 100)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-wabi-text">重みの範囲</p>
                  <p className="text-xs text-wabi-text-muted mt-0.5">スライダーの最大値</p>
                </div>
                <div className="flex gap-1">
                  {([5, 10] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => update('weightMax', v)}
                      className={`px-3 py-1 text-xs rounded-lg cursor-pointer transition-colors ${
                        (settings.weightMax ?? 5) === v
                          ? 'bg-wabi-accent/20 text-wabi-text font-medium'
                          : 'text-wabi-text-muted hover:bg-wabi-surface'
                      }`}
                    >
                      1-{v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-wabi-text">デフォルトの重み</p>
                  <p className="text-xs text-wabi-text-muted mt-0.5">新規タスクの初期ウェイト</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={settings.weightMax ?? 5}
                    value={settings.defaultWeight}
                    onChange={e => update('defaultWeight', Number(e.target.value))}
                    className="w-20 h-1 accent-wabi-accent cursor-pointer"
                    style={{ accentColor: '#c4a882' }}
                  />
                  <span className="text-sm font-mono text-wabi-text-muted w-4 text-center">
                    {settings.defaultWeight}
                  </span>
                </div>
              </div>
            </div>
          </Section>

          {/* 枯山水 */}
          <Section title="枯山水">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-wabi-text">砂粒の密度</p>
                  <p className="text-xs text-wabi-text-muted mt-0.5">アニメーションの粒子数</p>
                </div>
                <div className="flex gap-1">
                  {(['low', 'normal', 'high'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => update('particleCount', v)}
                      className={`px-3 py-1 text-xs rounded-lg cursor-pointer transition-colors ${
                        settings.particleCount === v
                          ? 'bg-wabi-accent/20 text-wabi-text font-medium'
                          : 'text-wabi-text-muted hover:bg-wabi-surface'
                      }`}
                    >
                      {{ low: '少', normal: '標準', high: '多' }[v]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-wabi-text">砂紋リング数</p>
                  <p className="text-xs text-wabi-text-muted mt-0.5">同心円の本数</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={3}
                    max={15}
                    value={settings.karesansuiRings ?? 10}
                    onChange={e => update('karesansuiRings', Number(e.target.value))}
                    className="w-20 h-1 accent-wabi-accent cursor-pointer"
                    style={{ accentColor: '#c4a882' }}
                  />
                  <span className="text-sm font-mono text-wabi-text-muted w-4 text-center">
                    {settings.karesansuiRings ?? 10}
                  </span>
                </div>
              </div>
            </div>
          </Section>

          {/* 概念ルーティン & リマインダー */}
          <Section title="ガイド">
            <div className="space-y-4">
              <ToggleRow
                label="概念ルーティン"
                description="時間帯に応じたソフトな提案を表示"
                value={settings.conceptRoutinesEnabled}
                onChange={v => update('conceptRoutinesEnabled', v)}
              />
              <ToggleRow
                label="リマインダー音"
                description="リマインダー発火時にサウンド通知"
                value={settings.reminderSoundEnabled}
                onChange={v => update('reminderSoundEnabled', v)}
              />
            </div>
          </Section>

          {/* データ */}
          <Section title="データ">
            <div className="space-y-3">
              <button
                onClick={handleClearAll}
                disabled={clearing}
                className="text-sm text-wabi-timer hover:text-wabi-text cursor-pointer disabled:opacity-50"
              >
                {clearing ? 'クリア中…' : '実行履歴をすべてクリア'}
              </button>
              <p className="text-xs text-wabi-text-muted">
                ルーティン定義は保持されます。今日・今週・今月の進捗データがリセットされます。
              </p>
            </div>
          </Section>

          {/* バックアップ */}
          <Section title="バックアップ">
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="px-3 py-1.5 text-xs bg-wabi-surface border border-wabi-border rounded-lg hover:bg-wabi-accent/10 cursor-pointer transition-colors"
                >
                  エクスポート
                </button>
                <button
                  onClick={handleImport}
                  className="px-3 py-1.5 text-xs bg-wabi-surface border border-wabi-border rounded-lg hover:bg-wabi-accent/10 cursor-pointer transition-colors"
                >
                  インポート
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelected}
                  className="hidden"
                />
              </div>
              {backupStatus && (
                <p className="text-xs text-wabi-text-muted">{backupStatus}</p>
              )}
              <p className="text-xs text-wabi-text-muted">
                全データ（ルーティン・実行履歴・設定）をJSONファイルとして保存・復元できます。
              </p>
            </div>
          </Section>

          {/* Obsidian連携 (Electron版のみ) */}
          {isElectron && (
            <Section title="Obsidian連携">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-wabi-text">デイリーノートフォルダ</p>
                  <p className="text-xs text-wabi-text-muted mt-0.5">YYYY-MM-DD.md が保存されるフォルダ</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const selected = await window.electronAPI.selectObsidianVault()
                      if (selected) update('obsidianVaultPath', selected)
                    }}
                    className="px-3 py-1.5 text-xs bg-wabi-surface border border-wabi-border rounded-lg hover:bg-wabi-accent/10 cursor-pointer transition-colors shrink-0"
                  >
                    フォルダ選択
                  </button>
                  <span className="text-xs text-wabi-text-muted truncate">
                    {settings.obsidianVaultPath || '未設定'}
                  </span>
                </div>
                {settings.obsidianVaultPath && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        setObsidianStatus('')
                        const result = await window.electronAPI.exportToObsidian()
                        setObsidianStatus(result.success ? '書き出し完了' : `エラー: ${result.error}`)
                      }}
                      className="px-3 py-1.5 text-xs bg-wabi-surface border border-wabi-border rounded-lg hover:bg-wabi-accent/10 cursor-pointer transition-colors"
                    >
                      今すぐ書き出し
                    </button>
                    <button
                      onClick={() => update('obsidianVaultPath', '' as any)}
                      className="text-xs text-wabi-text-muted hover:text-wabi-timer cursor-pointer"
                    >
                      解除
                    </button>
                  </div>
                )}
                {obsidianStatus && (
                  <p className="text-xs text-wabi-text-muted">{obsidianStatus}</p>
                )}
                <p className="text-xs text-wabi-text-muted">
                  設定するとデータ保存時に自動でObsidianのデイリーノート（YAML frontmatter）に書き出します。
                </p>
              </div>
            </Section>
          )}

          {/* アカウント */}
          <Section title="アカウント">
            <AccountSection onLogout={handleLogout} />
          </Section>

          {/* バージョン + アップデート */}
          <div className="pt-2 border-t border-wabi-border/50 space-y-2">
            <p className="text-xs text-wabi-text-muted text-center">
              侘び v1.0.0
            </p>
            {window.electronAPI?.checkForUpdates && (
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => {
                    setUpdateStatus('確認中…')
                    window.electronAPI.checkForUpdates()
                  }}
                  className="text-xs text-wabi-accent hover:text-wabi-text cursor-pointer"
                >
                  アップデートを確認
                </button>
                {downloadPercent >= 0 && (
                  <div className="w-full max-w-[200px] mx-auto space-y-1">
                    <div className="h-1.5 bg-wabi-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-wabi-text-muted rounded-full transition-all duration-300"
                        style={{ width: `${downloadPercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-wabi-text-muted text-center">{downloadPercent}%</p>
                  </div>
                )}
                {updateStatus && downloadPercent < 0 && (
                  <p className="text-[10px] text-wabi-text-muted">{updateStatus}</p>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-wabi-text-muted mb-3">{title}</h3>
      {children}
    </div>
  )
}

function AccountSection({ onLogout }: { onLogout: () => void }) {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [checkLoading, setCheckLoading] = useState(true)
  const [showLogin, setShowLogin] = useState(false)
  const [loginEmail, setLoginEmail] = useState('lutebass@gmail.com')
  const [loginPassword, setLoginPassword] = useState('bib4pQpzAi7QGQiB')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) { setCheckLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null)
      setCheckLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null)
      if (session) setShowLogin(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (checkLoading) return <p className="text-xs text-wabi-text-muted">確認中…</p>

  if (!isCloudEnabled()) {
    return <p className="text-xs text-wabi-text-muted">クラウド同期は未設定です（環境変数が必要）</p>
  }

  if (userEmail) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-wabi-text">{userEmail}</p>
        <p className="text-xs text-wabi-text-muted">クラウド同期が有効です</p>
        <button
          onClick={onLogout}
          className="text-sm text-wabi-timer hover:text-wabi-text cursor-pointer"
        >
          ログアウト
        </button>
      </div>
    )
  }

  if (!showLogin) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-wabi-text-muted">ログインするとデータがクラウドに同期されます</p>
        <button
          onClick={() => setShowLogin(true)}
          className="text-sm text-wabi-accent hover:text-wabi-text cursor-pointer"
        >
          ログイン
        </button>
      </div>
    )
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    const supabase = getSupabase()
    if (!supabase) return
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })
      if (error) {
        setLoginError(error.message === 'Invalid login credentials' ? 'メールアドレスまたはパスワードが違います' : error.message)
      }
    } finally {
      setLoginLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-2">
      <input
        type="email"
        value={loginEmail}
        onChange={e => setLoginEmail(e.target.value)}
        placeholder="メールアドレス"
        required
        className="w-full px-3 py-2 text-xs border border-wabi-border rounded-lg bg-wabi-surface text-wabi-text placeholder:text-wabi-text-muted focus:outline-none focus:border-wabi-accent"
      />
      <input
        type="password"
        value={loginPassword}
        onChange={e => setLoginPassword(e.target.value)}
        placeholder="パスワード"
        required
        minLength={6}
        className="w-full px-3 py-2 text-xs border border-wabi-border rounded-lg bg-wabi-surface text-wabi-text placeholder:text-wabi-text-muted focus:outline-none focus:border-wabi-accent"
      />
      {loginError && <p className="text-xs text-wabi-timer">{loginError}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loginLoading}
          className="px-3 py-1.5 text-xs bg-wabi-accent/20 text-wabi-text rounded-lg hover:bg-wabi-accent/30 cursor-pointer disabled:opacity-50"
        >
          {loginLoading ? '処理中…' : 'ログイン'}
        </button>
        <button
          type="button"
          onClick={() => { setShowLogin(false); setLoginError('') }}
          className="text-xs text-wabi-text-muted hover:text-wabi-text cursor-pointer"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}

function ToggleRow({ label, description, value, onChange }: {
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-wabi-text">{label}</p>
        <p className="text-xs text-wabi-text-muted mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
          value ? 'bg-wabi-check' : 'bg-wabi-border'
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
