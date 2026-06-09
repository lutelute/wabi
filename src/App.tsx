import { useState, useEffect } from 'react'
import { RoutineProvider } from './contexts/RoutineContext'
import { ActionListProvider } from './contexts/ActionListContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { DayProvider } from './contexts/DayContext'
import { ReminderProvider } from './contexts/ReminderContext'
import { Sidebar } from './components/Sidebar'
import { ModeToggle } from './components/ModeToggle'
import { RoutineEditor } from './components/RoutineEditor'
import { ActionChecklist } from './components/ActionChecklist'
import { NowFocus } from './components/NowFocus'
import { KaresansuiStones } from './components/KaresansuiStones'
import { CheckInSubmit } from './components/CheckInSubmit'
import { ReminderBar } from './components/ReminderBar'
import { DailyNote } from './components/DailyNote'
import { DayClosing } from './components/DayClosing'
import { ExportButton } from './components/ExportButton'
import { Settings } from './components/Settings'
import { AuthGate } from './components/AuthGate'
import { WeeklyReview } from './components/WeeklyReview'
import { ExternalBridge } from './components/ExternalBridge'
import { storage } from './storage'

export type AppMode = 'edit' | 'execute'

const isElectron = typeof window !== 'undefined' && !!window.electronAPI
const isDev = import.meta.env.DEV

export default function App() {
  const [mode, setMode] = useState<AppMode>('execute')
  const [showSettings, setShowSettings] = useState(false)
  const [showWeekly, setShowWeekly] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    return storage.onOpenSettings(() => setShowSettings(true))
  }, [])

  return (
    <DayProvider>
      <RoutineProvider>
        <ActionListProvider>
          <SettingsProvider>
            <ReminderProvider>
              {/* 対話レイヤーは認証UIと独立にマウント（AuthGateのloadingでブロックされない） */}
              <ExternalBridge />
              <AuthGate>
              <div className="flex h-full">
                {/* Titlebar drag region (Electron only) */}
                {isElectron && (
                  <div className="titlebar-drag fixed top-0 left-0 right-0 h-12 z-10" />
                )}

                {/* Sidebar - desktop: always visible, mobile: overlay */}
                <div className="hidden md:block">
                  <Sidebar />
                </div>

                {/* Mobile sidebar overlay */}
                {sidebarOpen && (
                  <div className="fixed inset-0 z-40 md:hidden" onClick={() => setSidebarOpen(false)}>
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
                    <div
                      className="relative w-64 h-full"
                      onClick={e => e.stopPropagation()}
                    >
                      <Sidebar />
                    </div>
                  </div>
                )}

                {/* Main content */}
                <main className={`flex-1 flex flex-col overflow-hidden ${isElectron ? 'pt-12' : 'pt-0 safe-top'}`}>
                  <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-wabi-border">
                    {/* Mobile menu button */}
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="md:hidden text-wabi-text-muted hover:text-wabi-text cursor-pointer mr-3"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 5h14M3 10h14M3 15h14" />
                      </svg>
                    </button>
                    <ModeToggle mode={mode} onModeChange={setMode} />
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => setShowWeekly(true)}
                        className="text-wabi-text-muted/50 hover:text-wabi-text-muted cursor-pointer px-1.5 py-1 rounded transition-colors hover:bg-wabi-surface"
                        title="庭を眺める（7日の振り返り）"
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2">
                          <circle cx="10" cy="10" r="2.5" />
                          <circle cx="10" cy="10" r="5.5" opacity="0.6" />
                          <circle cx="10" cy="10" r="8.5" opacity="0.3" />
                        </svg>
                      </button>
                      <ExportButton />
                      {isDev && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-wabi-timer/20 text-wabi-timer rounded uppercase tracking-wider">dev</span>
                      )}
                    </div>
                    {/* Mobile settings button */}
                    {!isElectron && (
                      <button
                        onClick={() => setShowSettings(true)}
                        className="md:hidden text-wabi-text-muted hover:text-wabi-text cursor-pointer ml-3"
                      >
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="10" cy="10" r="3" />
                          <path d="M10 1v3M10 16v3M1 10h3M16 10h3M3.5 3.5l2 2M14.5 14.5l2 2M3.5 16.5l2-2M14.5 5.5l2-2" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto safe-bottom">
                    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                      <ReminderBar />
                      <NowFocus />
                      <KaresansuiStones />
                      <DailyNote />
                      <DayClosing />

                      {mode === 'execute' && (
                        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                          {/* 左: 侘び (アクションリスト) */}
                          <div className="flex-1 min-w-0">
                            <ActionChecklist />
                          </div>
                          {/* 右: 寂び (チェックイン) */}
                          <div className="w-full md:w-72 lg:w-80 shrink-0 space-y-4">
                            <CheckInSubmit />
                          </div>
                        </div>
                      )}
                    </div>
                    {mode === 'edit' && (
                      <div className="p-4 md:p-6">
                        <RoutineEditor />
                      </div>
                    )}
                  </div>
                </main>
              </div>

              {showSettings && <Settings onClose={() => setShowSettings(false)} />}
              {showWeekly && <WeeklyReview onClose={() => setShowWeekly(false)} />}
              </AuthGate>
            </ReminderProvider>
          </SettingsProvider>
        </ActionListProvider>
      </RoutineProvider>
    </DayProvider>
  )
}
