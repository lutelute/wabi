import { useState, useEffect } from 'react'
import { RoutineProvider } from './contexts/RoutineContext'
import { ExecutionProvider } from './contexts/ExecutionContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { DayProvider } from './contexts/DayContext'
import { ReminderProvider } from './contexts/ReminderContext'
import { Sidebar } from './components/Sidebar'
import { ModeToggle } from './components/ModeToggle'
import { RoutineEditor } from './components/RoutineEditor'
import { RoutineChecklist } from './components/RoutineChecklist'
import { NowFocus } from './components/NowFocus'
import { EnergyGauge } from './components/EnergyGauge'
import { KaresansuiStones } from './components/KaresansuiStones'
import { CheckInSubmit } from './components/CheckInSubmit'
import { ReminderBar } from './components/ReminderBar'
import { DailyNote } from './components/DailyNote'
import { Settings } from './components/Settings'
import { AuthGate } from './components/AuthGate'
import { storage } from './storage'

export type AppMode = 'edit' | 'execute'

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

export default function App() {
  const [mode, setMode] = useState<AppMode>('execute')
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    return storage.onOpenSettings(() => setShowSettings(true))
  }, [])

  return (
    <AuthGate>
    <DayProvider>
      <RoutineProvider>
        <ExecutionProvider>
          <SettingsProvider>
            <ReminderProvider>
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
                      <KaresansuiStones />
                      <CheckInSubmit />

                      {mode === 'execute' && (
                        <>
                          <EnergyGauge />
                          <NowFocus />
                          <RoutineChecklist />
                          <DailyNote />
                        </>
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
            </ReminderProvider>
          </SettingsProvider>
        </ExecutionProvider>
      </RoutineProvider>
    </DayProvider>
    </AuthGate>
  )
}
