import { useExecution } from '../contexts/ExecutionContext'

export function EnergyGauge() {
  const { progress } = useExecution()

  if (progress.capacity === 0) return null

  // 体力: 満タンから始まり、タスク完了で減る
  // ゲージは90%で「ちょうどいい」、100%消費で溢れる（やりきった）
  const softCap = progress.capacity * 0.9
  const spent = progress.energy
  const staminaRatio = 1 - Math.min(spent / softCap, 1)
  const overflowing = spent >= softCap

  return (
    <div className="px-1">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-wabi-text-muted">体力</span>
        <span className="text-xs text-wabi-text-muted font-mono">
          {progress.stamina} 残り
        </span>
      </div>

      {/* メインゲージ — 右から左に減っていく */}
      <div className="relative h-2.5 bg-wabi-border/30 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${staminaRatio * 100}%`,
            background: staminaRatio > 0.5
              ? 'linear-gradient(90deg, #c4a882, #d4bc9a)'
              : staminaRatio > 0.2
                ? 'linear-gradient(90deg, #c4a882, #b89968)'
                : 'linear-gradient(90deg, #a08060, #8a6a4a)',
          }}
        />
        {overflowing && (
          <div className="absolute inset-0 rounded-full bg-wabi-check/20 animate-pulse" />
        )}
      </div>

      {/* エネルギー獲得バー — 下に小さく */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] text-wabi-text-muted">獲得</span>
        <div className="flex-1 h-1 bg-wabi-border/20 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out bg-wabi-check/60"
            style={{ width: `${progress.ratio * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-wabi-text-muted font-mono">
          {progress.energy}/{progress.capacity}
        </span>
      </div>

      {overflowing && (
        <p className="text-[10px] text-wabi-check mt-1 text-center">
          よくやった
        </p>
      )}
    </div>
  )
}
