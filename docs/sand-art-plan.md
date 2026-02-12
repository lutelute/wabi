# 砂絵アート ビジュアルフィードバック — 設計プラン

## 概要

wabiアプリのルーティン実行画面に、タスク進捗に連動する砂絵アートビジュアルを組み込む。
1日の始まりはノイズ状態(乱雑な砂粒)で、タスクをチェックするごとにパーティクルが整列し、
全タスク完了時に美しい幾何学模様に収斂する。
「侘び」の世界観にふさわしい、砂庭(枯山水)を想起させる表現を目指す。

---

## 1. ビジュアルアルゴリズム

### 1.1 パーティクルシステム

- **パーティクル数**: 200〜400個
- **各パーティクルの属性**:
  - `x, y`: 現在位置
  - `targetX, targetY`: 目標位置(精錬度に応じて計算)
  - `noiseOffsetX, noiseOffsetY`: ノイズ用のランダムオフセット
  - `size`: 粒のサイズ(1〜3px)
  - `opacity`: 透明度(0.3〜1.0)
  - `color`: wabiカラーパレットから選択
  - `phaseIndex`: 所属フェーズ

### 1.2 精錬度(refinement)の計算

```
refinement = progress.total === 0 ? 0 : progress.done / progress.total
// 0.0(ノイズ) → 1.0(完全整列)
```

### 1.3 目標パターン — 同心円(枯山水の砂紋)

フェーズ数に応じた同心円を基本パターンとする。
各フェーズの完了が1つの環の形成に対応するため、進捗との意味的な結びつきが強い。

### 1.4 ノイズ関数

外部ライブラリ不要。各パーティクルに固有のランダムオフセットを持たせ、sin/cos の合成で擬似ノイズを生成。

```
noiseX = sin(time * 0.001 + offsetX) * amplitude
noiseY = cos(time * 0.0013 + offsetY) * amplitude
amplitude = canvasRadius * 0.4 * (1 - refinement)
```

refinement が上がるほど amplitude が小さくなり、ノイズが減衰する。

### 1.5 整列ロジック(補間)

```
currentX = lerp(noiseX, targetX, easeInOutCubic(refinement))
currentY = lerp(noiseY, targetY, easeInOutCubic(refinement))
```

- イージング: `easeInOutCubic`。序盤は緩やかに、後半で加速して収斂感を出す
- トランジション: refinement 変化時に 700〜1000ms かけてアニメーション。変化検知時のみ rAF ループ起動、完了後停止(省電力)

### 1.6 チェック時の演出

- **パルス波**: チェックしたフェーズの環が一瞬外側に広がり戻る(300ms)
- **発光**: パーティクル全体の opacity を一時的に上げる(バッテリーチャージ感)
- **色変化**: `wabi-check`(#7a9e7e)の波紋が中心から広がる

### 1.7 全完了時の特別演出

- パーティクルが完全整列し、ゆっくり回転(1回転/60秒)
- opacity が微妙に脈動(呼吸するような動き)

---

## 2. UI配置 — NowFocus 直上に専用セクション

```
┌─────────────────────────────┐
│  [SandArtCanvas]            │  ← 新規: 160px高
│   ○ ○  ○   ○  ○            │
│    ○  ○ ○ ○  ○  ○          │
│   ○○  ○ ○ ○○  ○            │
│                   "3 / 8"   │
├─────────────────────────────┤
│  NowFocus カード             │  ← 既存
├─────────────────────────────┤
│  RoutineChecklist            │  ← 既存
└─────────────────────────────┘
```

**理由**: NowFocusの背景にするとテキスト可読性が低下する。独立セクションとして「見る」体験と「使う」体験を分離。

---

## 3. コンポーネント構成

```
src/components/SandArt/
  SandArtCanvas.tsx    — Canvas描画メインコンポーネント
  useParticles.ts      — パーティクル生成・更新ロジック
  useAnimationLoop.ts  — requestAnimationFrame 管理
  patterns.ts          — 幾何学パターンの目標座標計算(純粋関数)
  easing.ts            — lerp, easeInOutCubic(純粋関数)
  types.ts             — Particle, AnimationState 型定義
```

既存ファイルの変更は `App.tsx` に `<SandArtCanvas />` を配置するのみ。
`ExecutionContext` は変更不要(既存の `progress` をそのまま使用)。

---

## 4. 実装ステップ

### Phase 1: 静的パーティクル描画
- types.ts, patterns.ts, SandArtCanvas.tsx を作成
- 固定 refinement でパーティクル描画確認
- App.tsx に配置

### Phase 2: 精錬度連動
- easing.ts, useParticles.ts を作成
- useExecution() の progress から refinement 計算
- チェック操作で砂絵の整列度が変化することを確認

### Phase 3: アニメーション
- useAnimationLoop.ts を作成
- refinement 変化時のトランジション(700ms)
- チェック時パルス波エフェクト
- 静止時 CPU 消費ゼロを確認

### Phase 4: ビジュアル調整
- wabiカラーパレットとの統合
- 全完了時の演出
- ウィンドウリサイズ対応、Retina 対応

---

## 5. カラーパレット

| 用途 | 変数 | 値 |
|------|------|-----|
| Canvas背景 | wabi-surface | #f5f0eb |
| パーティクル(ノイズ時) | wabi-border | #e8e0d8 |
| パーティクル(整列時) | wabi-accent | #c4a882 |
| チェック時パルス | wabi-check | #7a9e7e |
| 進捗テキスト | wabi-text-muted | #8a8480 |

---

## 6. パフォーマンス

- アニメーション中のみ rAF。静止時は最終フレームを保持して停止
- 外部ライブラリ不使用(sin/cos ベースのノイズ)
- devicePixelRatio 対応
- パーティクル配列は初回生成のみ、位置更新は mutate
