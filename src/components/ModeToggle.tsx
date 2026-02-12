import type { AppMode } from '../App'

interface ModeToggleProps {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="titlebar-no-drag flex bg-wabi-surface rounded-lg p-0.5">
      <button
        onClick={() => onModeChange('execute')}
        className={`px-3 py-1 text-sm rounded-md transition-colors cursor-pointer ${
          mode === 'execute'
            ? 'bg-wabi-bg text-wabi-text shadow-sm'
            : 'text-wabi-text-muted hover:text-wabi-text'
        }`}
      >
        実行
      </button>
      <button
        onClick={() => onModeChange('edit')}
        className={`px-3 py-1 text-sm rounded-md transition-colors cursor-pointer ${
          mode === 'edit'
            ? 'bg-wabi-bg text-wabi-text shadow-sm'
            : 'text-wabi-text-muted hover:text-wabi-text'
        }`}
      >
        編集
      </button>
    </div>
  )
}
