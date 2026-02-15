import { useState } from 'react'
import { useRoutines } from '../contexts/RoutineContext'
import { useActionList } from '../contexts/ActionListContext'
import { ConceptRoutines } from './ConceptRoutines'
import { MonthlyCalendar } from './MonthlyCalendar'

export function Sidebar() {
  const { routines, selectedId, selectRoutine, createRoutine, deleteRoutine, renameRoutine } = useRoutines()
  const { addAction, removeAction, isItemAdded, actions } = useActionList()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [expandedRoutines, setExpandedRoutines] = useState<Set<string>>(new Set())

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

  const toggleExpand = (routineId: string) => {
    setExpandedRoutines(prev => {
      const next = new Set(prev)
      if (next.has(routineId)) next.delete(routineId)
      else next.add(routineId)
      return next
    })
  }

  const handleItemClick = (item: Parameters<typeof addAction>[0], routine: Parameters<typeof addAction>[1], phase: Parameters<typeof addAction>[2]) => {
    if (isItemAdded(item.id)) {
      const action = actions.find(a => a.sourceItemId === item.id)
      if (action) removeAction(action.id)
    } else {
      addAction(item, routine, phase)
    }
  }

  const handleAddAllPhase = (routine: Parameters<typeof addAction>[1], phase: Parameters<typeof addAction>[2]) => {
    for (const item of phase.items) {
      if (!isItemAdded(item.id)) {
        addAction(item, routine, phase)
      }
    }
  }

  const handleAddAllRoutine = (routine: Parameters<typeof addAction>[1]) => {
    for (const phase of routine.phases) {
      for (const item of phase.items) {
        if (!isItemAdded(item.id)) {
          addAction(item, routine, phase)
        }
      }
    }
  }

  const isRoutineFullyAdded = (routine: Parameters<typeof addAction>[1]) => {
    const items = routine.phases.flatMap(p => p.items)
    return items.length > 0 && items.every(item => isItemAdded(item.id))
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

      <nav className="overflow-y-auto px-2 flex-1">
        {routines.map(r => {
          const isExpanded = expandedRoutines.has(r.id)
          return (
            <div key={r.id}>
              {/* ルーティン名 */}
              <div
                className={`group flex items-center px-3 py-2 rounded-lg mb-0.5 cursor-pointer text-sm transition-colors ${
                  r.id === selectedId
                    ? 'bg-wabi-bg text-wabi-text font-medium'
                    : 'text-wabi-text-muted hover:bg-wabi-bg/50'
                }`}
                onClick={() => {
                  toggleExpand(r.id)
                  selectRoutine(r.id)
                }}
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
                    {/* 展開アイコン */}
                    <svg
                      width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
                      className={`shrink-0 mr-1.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    >
                      <path d="M3 1l5 4-5 4z" />
                    </svg>
                    <span className="flex-1 truncate">{r.name}</span>
                    {r.phases.flatMap(p => p.items).length > 0 && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          handleAddAllRoutine(r)
                        }}
                        className={`opacity-0 group-hover:opacity-100 text-[9px] ml-1 cursor-pointer px-1 py-0.5 rounded transition-colors ${
                          isRoutineFullyAdded(r)
                            ? 'text-wabi-accent/50'
                            : 'text-wabi-text-muted/50 hover:text-wabi-accent hover:bg-wabi-accent/10'
                        }`}
                        title="全アイテムを追加"
                      >
                        +全
                      </button>
                    )}
                    {routines.length > 1 && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          deleteRoutine(r.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-wabi-text-muted hover:text-wabi-timer text-xs ml-1 cursor-pointer"
                        title="削除"
                      >
                        ×
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* 展開: フェーズ + アイテム */}
              {isExpanded && (
                <div className="ml-2 mb-2">
                  {r.phases.length === 0 || r.phases.every(p => p.items.length === 0) ? (
                    <p className="px-2 py-2 text-[10px] text-wabi-text-muted/40 italic">
                      「編集」モードでアイテムを追加
                    </p>
                  ) : (
                    r.phases.map(phase => (
                      <div key={phase.id}>
                        {phase.title && (
                          <div className="flex items-center justify-between px-2 py-1">
                            <span className="text-[10px] font-medium text-wabi-text-muted/60">{phase.title}</span>
                            <button
                              onClick={() => handleAddAllPhase(r, phase)}
                              className="text-[9px] text-wabi-text-muted/40 hover:text-wabi-accent cursor-pointer"
                              title="全追加"
                            >
                              +全
                            </button>
                          </div>
                        )}
                        {phase.items.map(item => {
                          const added = isItemAdded(item.id)
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleItemClick(item, r, phase)}
                              className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-[11px] rounded cursor-pointer transition-colors ${
                                added
                                  ? 'text-wabi-accent bg-wabi-accent/5'
                                  : 'text-wabi-text-muted/70 hover:bg-wabi-bg/30 hover:text-wabi-text-muted'
                              }`}
                            >
                              <span className={`shrink-0 text-[8px] ${added ? 'text-wabi-accent' : 'text-wabi-text-muted/30'}`}>
                                {added ? '●' : '○'}
                              </span>
                              <span className="truncate">{item.title}</span>
                              {item.isMental && (
                                <span className="text-[8px] text-amber-600/50 shrink-0">m</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
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
