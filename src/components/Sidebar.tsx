import { useState } from 'react'
import { useRoutines } from '../contexts/RoutineContext'
import { ConceptRoutines } from './ConceptRoutines'
import { MonthlyCalendar } from './MonthlyCalendar'

export function Sidebar() {
  const { routines, selectedId, selectRoutine, createRoutine, deleteRoutine, renameRoutine } = useRoutines()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleAdd = () => {
    const name = newName.trim()
    if (name) {
      createRoutine(name)
      setNewName('')
      setAdding(false)
    }
  }

  const handleRename = (id: string) => {
    const name = editName.trim()
    if (name) {
      renameRoutine(id, name)
    }
    setEditingId(null)
  }

  return (
    <aside className="w-56 md:w-56 shrink-0 bg-wabi-surface border-r border-wabi-border flex flex-col pt-4 md:pt-12 h-full">
      {/* Section 1: ルーティン */}
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-wabi-text-muted">ルーティン</h2>
        <button
          onClick={() => setAdding(true)}
          className="text-wabi-text-muted hover:text-wabi-text text-lg leading-none cursor-pointer"
          title="新規作成"
        >
          +
        </button>
      </div>

      <nav className="overflow-y-auto px-2">
        {routines.map(r => (
          <div
            key={r.id}
            className={`group flex items-center px-3 py-2 rounded-lg mb-0.5 cursor-pointer text-sm transition-colors ${
              r.id === selectedId
                ? 'bg-wabi-bg text-wabi-text font-medium'
                : 'text-wabi-text-muted hover:bg-wabi-bg/50'
            }`}
            onClick={() => selectRoutine(r.id)}
            onDoubleClick={() => {
              setEditingId(r.id)
              setEditName(r.name)
            }}
          >
            {editingId === r.id ? (
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => handleRename(r.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleRename(r.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="flex-1 bg-transparent outline-none border-b border-wabi-accent text-sm"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="flex-1 truncate">{r.name}</span>
                {routines.length > 1 && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      deleteRoutine(r.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-wabi-text-muted hover:text-wabi-timer text-xs ml-2 cursor-pointer"
                    title="削除"
                  >
                    ×
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </nav>

      {adding && (
        <div className="px-3 py-2 border-t border-wabi-border">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAdd()
              if (e.key === 'Escape') { setAdding(false); setNewName('') }
            }}
            onBlur={() => { if (!newName.trim()) setAdding(false) }}
            placeholder="ルーティン名"
            className="w-full bg-wabi-bg border border-wabi-border rounded px-2 py-1 text-sm outline-none focus:border-wabi-accent"
          />
        </div>
      )}

      {/* Section 2: ひとこと */}
      <div className="border-t border-wabi-border px-3 py-3">
        <ConceptRoutines />
      </div>

      {/* Section 3: カレンダー */}
      <div className="border-t border-wabi-border px-2 py-3 mt-auto">
        <MonthlyCalendar compact />
      </div>
    </aside>
  )
}
