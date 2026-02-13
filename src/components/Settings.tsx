import { useState, useEffect } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { storage } from '../storage'

interface Props {
  onClose: () => void
}

export function Settings({ onClose }: Props) {
  const { settings, updateSetting } = useSettings()
  const [clearing, setClearing] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<string>('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) return
    return window.electronAPI.onUpdateStatus((status: string) => {
      setUpdateStatus(status)
    })
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

          {/* バージョン + アップデート */}
          <div className="pt-2 border-t border-wabi-border/50 space-y-2">
            <p className="text-xs text-wabi-text-muted text-center">
              侘び v0.2.0
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
                {updateStatus && (
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
