import { useExecution } from '../contexts/ExecutionContext'

export function DeclinedInput() {
  const { declined, updateDeclined } = useExecution()

  return (
    <div className="border-t border-wabi-border pt-4">
      <label className="text-xs text-wabi-text-muted block mb-2">
        今日やらないと決めたこと
      </label>
      <textarea
        value={declined}
        onChange={e => updateDeclined(e.target.value)}
        placeholder="手放したこと、断ったこと、先送りにしたこと"
        className="w-full h-24 bg-wabi-surface border border-wabi-border rounded-lg p-3 text-sm leading-relaxed resize-none outline-none focus:border-wabi-accent"
        spellCheck={false}
      />
    </div>
  )
}
