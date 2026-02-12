import { useState, useEffect } from 'react'
import { storage } from '../storage'
import type { AppSettings } from '../types/routine'
import { DEFAULT_SETTINGS } from '../types/routine'

interface Props {
  onClose: () => void
}

export function Settings({ onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [clearing, setClearing] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    storage.getSettings().then(setSettings)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    storage.saveSettings(next).then(() => {
      setSaved(true)
      setTimeout(() => setSaved(false), 1200)
    })
  }

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
            {saved && (
              <span className="text-xs text-wabi-check animate-pulse">保存済み</span>
            )}
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

          {/* ルーティン */}
          <Section title="ルーティン">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-wabi-text">デフォルトの重み</p>
                <p className="text-xs text-wabi-text-muted mt-0.5">新規タスクの初期ウェイト</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={5}
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
          </Section>

          {/* 表示 */}
          <Section title="表示">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-wabi-text">砂粒の密度</p>
                <p className="text-xs text-wabi-text-muted mt-0.5">枯山水アニメーションの粒子数</p>
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

          {/* バージョン */}
          <div className="pt-2 border-t border-wabi-border/50">
            <p className="text-xs text-wabi-text-muted text-center">
              侘び v0.1.0
            </p>
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
