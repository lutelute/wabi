import { useState, useEffect } from 'react'
import { RoutineProvider } from './contexts/RoutineContext'
import { ExecutionProvider } from './contexts/ExecutionContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { Sidebar } from './components/Sidebar'
import { ModeToggle } from './components/ModeToggle'
import { RoutineEditor } from './components/RoutineEditor'
import { RoutineChecklist } from './components/RoutineChecklist'
import { NowFocus } from './components/NowFocus'
import { EnergyGauge } from './components/EnergyGauge'
import { KaresansuiStones } from './components/KaresansuiStones'
import { DeclinedInput } from './components/DeclinedInput'
import { Settings } from './components/Settings'
import { storage } from './storage'

export type AppMode = 'edit' | 'execute'

export default function App() {
  const [mode, setMode] = useState<AppMode>('execute')
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    return storage.onOpenSettings(() => setShowSettings(true))
  }, [])

  return (
    <RoutineProvider>
      <ExecutionProvider>
        <SettingsProvider>
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
                {/* 枯山水は常時表示 */}
                <div className="p-6 space-y-6">
                  {mode === 'execute' && <EnergyGauge />}
                  <KaresansuiStones />
                  {mode === 'execute' && (
                    <>
                      <NowFocus />
                      <RoutineChecklist />
                      <DeclinedInput />
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
        </SettingsProvider>
      </ExecutionProvider>
    </RoutineProvider>
  )
}
