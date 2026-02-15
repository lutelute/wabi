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

export default function App() {
  const [mode, setMode] = useState<AppMode>('execute')
  const [showSettings, setShowSettings] = useState(false)

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
                {/* Titlebar drag region */}
                <div className="titlebar-drag fixed top-0 left-0 right-0 h-12 z-10" />

                {/* Sidebar */}
                <Sidebar />

                {/* Main content */}
                <main className="flex-1 flex flex-col pt-12 overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-3 border-b border-wabi-border">
                    <ModeToggle mode={mode} onModeChange={setMode} />
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                      {/* リマインダーバー */}
                      <ReminderBar />

                      {/* 枯山水は最上部 */}
                      <KaresansuiStones />

                      {/* チェックイン (体力・心・気分・タグ・メモ 統合) */}
                      <CheckInSubmit />

                      {/* ルーティン実行 */}
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
                      <div className="p-6">
                        <RoutineEditor />
                      </div>
                    )}
                  </div>
                </main>
              </div>

              {/* Settings overlay */}
              {showSettings && <Settings onClose={() => setShowSettings(false)} />}
            </ReminderProvider>
          </SettingsProvider>
        </ExecutionProvider>
      </RoutineProvider>
    </DayProvider>
    </AuthGate>
  )
}
