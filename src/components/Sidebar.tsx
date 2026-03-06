import { useState, useRef, useCallback } from 'react'
import { useRoutines } from '../contexts/RoutineContext'
import { useActionList } from '../contexts/ActionListContext'
import { ConceptRoutines } from './ConceptRoutines'
import { MonthlyCalendar } from './MonthlyCalendar'
import { ROUTINE_COLORS } from '../types/routine'

const MIN_WIDTH = 160
const MAX_WIDTH = 400
const DEFAULT_WIDTH = 224

export function Sidebar() {
  const { routines, selectedId, selectRoutine, createRoutine, deleteRoutine, renameRoutine, updateRoutineColor, updateRoutineMemo } = useRoutines()
  const { addAction, removeAction, isItemAdded, getItemCount, actions } = useActionList()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const sidebarRef = useRef<HTMLElement>(null)

  // リサイズ
  const [width, setWidth] = useState(DEFAULT_WIDTH)

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = width
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const handleMove = (ev: PointerEvent) => {
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + ev.clientX - startX)))
    }
    const handleUp = () => {
      target.removeEventListener('pointermove', handleMove)
      target.removeEventListener('pointerup', handleUp)
    }
    target.addEventListener('pointermove', handleMove)
    target.addEventListener('pointerup', handleUp)
  }, [width])

  // ホバーポップアップ（fixed位置）
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoverRect, setHoverRect] = useState<{ top: number; left: number } | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearHoverTimer = () => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null } }

  const scheduleHover = (id: string, el: HTMLElement) => {
    clearHoverTimer()
    hoverTimer.current = setTimeout(() => {
      const rect = el.getBoundingClientRect()
      setHoverRect({ top: rect.top, left: rect.right + 4 })
      setHoveredId(id)
    }, 300)
  }
  const scheduleLeave = () => {
    clearHoverTimer()
    hoverTimer.current = setTimeout(() => { setHoveredId(null); setHoverRect(null) }, 200)
  }

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
    if (name) renameRoutine(id, name)
    setEditingId(null)
  }

  const handleItemClick = (item: Parameters<typeof addAction>[0], routine: Parameters<typeof addAction>[1], phase: Parameters<typeof addAction>[2]) => {
    if (isItemAdded(item.id)) {
      const action = actions.find(a => a.sourceItemId === item.id)
      if (action) removeAction(action.id)
    } else {
      addAction(item, routine, phase)
    }
  }

  const handleAddAllRoutine = (routine: Parameters<typeof addAction>[1]) => {
    for (const phase of routine.phases) {
      for (const item of phase.items) {
        if (!isItemAdded(item.id)) addAction(item, routine, phase)
      }
    }
  }

  const handleRemoveAllRoutine = (routine: Parameters<typeof addAction>[1]) => {
    for (const phase of routine.phases) {
      for (const item of phase.items) {
        if (isItemAdded(item.id)) {
          const action = actions.find(a => a.sourceItemId === item.id)
          if (action) removeAction(action.id)
        }
      }
    }
  }

  const isRoutineFullyAdded = (routine: Parameters<typeof addAction>[1]) => {
    const items = routine.phases.flatMap(p => p.items)
    return items.length > 0 && items.every(item => isItemAdded(item.id))
  }

  const isRoutinePartiallyAdded = (routine: Parameters<typeof addAction>[1]) => {
    const items = routine.phases.flatMap(p => p.items)
    return items.length > 0 && items.some(item => isItemAdded(item.id)) && !items.every(item => isItemAdded(item.id))
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleRoutineClick = (r: Parameters<typeof addAction>[1]) => {
    selectRoutine(r.id)
    toggleExpanded(r.id)
  }

  const handleToggleAll = (e: React.MouseEvent, r: Parameters<typeof addAction>[1]) => {
    e.stopPropagation()
    const items = r.phases.flatMap(p => p.items)
    if (items.length === 0) return
    if (isRoutineFullyAdded(r)) {
      handleRemoveAllRoutine(r)
    } else {
      handleAddAllRoutine(r)
    }
  }

  // ホバー中のルーティンデータ
  const hoveredRoutine = hoveredId ? routines.find(r => r.id === hoveredId) : null

  return (
    <aside
      ref={sidebarRef}
      style={{ width }}
      className="shrink-0 bg-wabi-surface border-r border-wabi-border flex flex-col pt-4 md:pt-12 h-full relative"
    >
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
          const allItems = r.phases.flatMap(p => p.items)
          const hasItems = allItems.length > 0
          const fullyAdded = hasItems && isRoutineFullyAdded(r)
          const partiallyAdded = hasItems && isRoutinePartiallyAdded(r)
          const expanded = expandedIds.has(r.id)
          const addedCount = allItems.filter(i => isItemAdded(i.id)).length

          return (
            <div key={r.id}>
              {/* ルーティン名 */}
              <div
                className={`group flex items-center px-3 py-2 rounded-lg mb-0.5 cursor-pointer text-sm transition-colors ${
                  fullyAdded
                    ? 'bg-wabi-accent/10 text-wabi-accent font-medium'
                    : r.id === selectedId
                      ? 'bg-wabi-bg text-wabi-text font-medium'
                      : 'text-wabi-text-muted hover:bg-wabi-bg/50'
                }`}
                onClick={() => handleRoutineClick(r)}
                onMouseEnter={e => scheduleHover(r.id, e.currentTarget)}
                onMouseLeave={scheduleLeave}
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
                    {/* 展開矢印 */}
                    {hasItems && (
                      <svg
                        width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
                        className={`shrink-0 mr-1.5 text-wabi-text-muted/40 transition-transform ${expanded ? 'rotate-90' : ''}`}
                      >
                        <path d="M3 1.5L7 5L3 8.5" />
                      </svg>
                    )}

                    {/* ルーティン名 + マーカーハイライト */}
                    <span className="flex-1 truncate relative">
                      {r.name}
                      {r.color && (
                        <span
                          className="absolute left-0 right-0 bottom-0 h-[45%] rounded-sm"
                          style={{ backgroundColor: r.color, opacity: 0.18 }}
                        />
                      )}
                    </span>

                    {/* 全追加/全外しトグル */}
                    {hasItems && (
                      <button
                        onClick={e => handleToggleAll(e, r)}
                        className={`shrink-0 ml-1 text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                          fullyAdded
                            ? 'text-wabi-accent bg-wabi-accent/10 hover:bg-wabi-accent/20'
                            : partiallyAdded
                              ? 'text-wabi-text-muted/60 hover:text-wabi-accent hover:bg-wabi-accent/10'
                              : 'text-wabi-text-muted/30 hover:text-wabi-accent hover:bg-wabi-accent/10'
                        }`}
                        title={fullyAdded ? '全て外す' : '全て入れる'}
                      >
                        {fullyAdded ? '全✓' : partiallyAdded ? `${addedCount}/${allItems.length}` : '全入'}
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

              {/* 展開時: フェーズ + アイテム一覧 */}
              {expanded && hasItems && (
                <div className="ml-3 mr-1 mb-1">
                  {r.phases.map(phase => (
                    <div key={phase.id}>
                      {phase.title && (
                        <div className="text-[9px] font-medium text-wabi-text-muted/50 px-2 pt-1.5 pb-0.5">
                          {phase.title}
                        </div>
                      )}
                      {phase.items.map(item => {
                        const added = isItemAdded(item.id)
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleItemClick(item, r, phase)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-[11px] transition-colors ${
                              added
                                ? 'text-wabi-accent bg-wabi-accent/5'
                                : 'text-wabi-text-muted/60 hover:bg-wabi-bg/50 hover:text-wabi-text-muted'
                            }`}
                          >
                            <span className={`shrink-0 w-3 h-3 rounded-full border flex items-center justify-center transition-colors ${
                              added ? 'border-wabi-accent bg-wabi-accent' : 'border-wabi-border'
                            }`}>
                              {added && (
                                <svg width="7" height="6" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            <span className="flex-1 truncate">{item.title}</span>
                            {item.duration && (
                              <span className="text-[9px] text-wabi-text-muted/30 shrink-0 font-mono">{item.duration}m</span>
                            )}
                            {item.isMental && <span className="text-[8px] text-amber-600/40 shrink-0">m</span>}
                            {item.isRest && <span className="text-[8px] text-indigo-500/40 shrink-0">r</span>}
                          </div>
                        )
                      })}
                    </div>
                  ))}
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

      {/* リサイズハンドル */}
      <div
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-wabi-accent/20 active:bg-wabi-accent/40 transition-colors z-10"
        onPointerDown={handleResizeStart}
      />

      {/* ホバーポップアップ（fixed: overflow影響なし） */}
      {hoveredRoutine && hoverRect && (() => {
        const items = hoveredRoutine.phases.flatMap(p => p.items)
        const hasItems = items.length > 0
        const totalAdded = items.reduce((n, i) => n + getItemCount(i.id), 0)
        return (
          <div
            className="fixed z-50 bg-wabi-surface border border-wabi-border rounded-lg shadow-lg p-2 min-w-52 max-w-72"
            style={{ top: hoverRect.top, left: hoverRect.left }}
            onMouseEnter={clearHoverTimer}
            onMouseLeave={scheduleLeave}
          >
            {/* ヘッダー */}
            <div className={`flex items-center justify-between ${hasItems || hoveredRoutine.memo ? 'mb-1.5 pb-1 border-b border-wabi-border/50' : ''}`}>
              <span className="text-[11px] font-medium text-wabi-text truncate relative">
                {hoveredRoutine.name}
                {hoveredRoutine.color && (
                  <span
                    className="absolute left-0 right-0 bottom-0 h-[45%] rounded-sm"
                    style={{ backgroundColor: hoveredRoutine.color, opacity: 0.18 }}
                  />
                )}
              </span>
              {hasItems && (
                <span className="text-[9px] text-wabi-text-muted/40 ml-2 shrink-0">
                  {totalAdded > 0 ? `${totalAdded}件追加済` : `${items.length}件`}
                </span>
              )}
            </div>

            {/* アイテムリスト */}
            {hasItems ? (
              hoveredRoutine.phases.map(phase => (
                <div key={phase.id}>
                  {phase.title && (
                    <div className="text-[9px] font-medium text-wabi-text-muted/50 px-1 pt-1.5 pb-0.5">
                      {phase.title}
                    </div>
                  )}
                  {phase.items.map(item => {
                    const count = getItemCount(item.id)
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-1 px-1 py-1 text-[11px] rounded"
                      >
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            addAction(item, hoveredRoutine, phase)
                          }}
                          className="shrink-0 text-[10px] text-wabi-text-muted/40 hover:text-wabi-accent cursor-pointer w-4 h-4 flex items-center justify-center rounded hover:bg-wabi-accent/10 transition-colors"
                          title="追加"
                        >
                          +
                        </button>
                        <span className={`flex-1 truncate ${count > 0 ? 'text-wabi-accent' : 'text-wabi-text-muted/70'}`}>
                          {item.title}
                        </span>
                        {count > 0 && (
                          <span className="text-[9px] text-wabi-accent/60 shrink-0 font-mono">
                            {count}
                          </span>
                        )}
                        {item.isMental && <span className="text-[8px] text-amber-600/50 shrink-0">m</span>}
                        {item.isRest && <span className="text-[8px] text-indigo-500/50 shrink-0">r</span>}
                      </div>
                    )
                  })}
                </div>
              ))
            ) : (
              <p className="text-[10px] text-wabi-text-muted/40 italic pt-1">エントリーなし</p>
            )}

            {/* カラーパレット */}
            <div className="mt-1.5 pt-1.5 border-t border-wabi-border/30 flex gap-1 flex-wrap">
              {ROUTINE_COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={e => {
                    e.stopPropagation()
                    updateRoutineColor(hoveredRoutine.id, c.value)
                  }}
                  className={`w-4 h-4 rounded cursor-pointer transition-transform hover:scale-125 ${
                    (hoveredRoutine.color || '') === c.value ? 'ring-1.5 ring-wabi-accent ring-offset-1' : ''
                  }`}
                  style={{
                    backgroundColor: c.value ? `${c.value}50` : 'transparent',
                    border: c.value ? 'none' : '1px dashed #aaa',
                  }}
                  title={c.id === 'none' ? '色なし' : c.id}
                />
              ))}
            </div>

            {/* メモ欄 */}
            <div className="mt-1.5 pt-1 border-t border-wabi-border/30">
              <textarea
                value={hoveredRoutine.memo || ''}
                onChange={e => updateRoutineMemo(hoveredRoutine.id, e.target.value)}
                placeholder="メモ..."
                rows={2}
                className="w-full text-[10px] text-wabi-text-muted bg-transparent outline-none resize-none placeholder:text-wabi-text-muted/30 leading-relaxed"
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>
        )
      })()}
    </aside>
  )
}
