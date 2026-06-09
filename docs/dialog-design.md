# wabi 対話レイヤー設計 — 「語り」

> 作成: 2026-06-08 / 対象バージョン: v1.5.x 以降
> 目的: スライダー・タグ・チェックボックスの**入力をなくし、会話そのものを入力にする**。
> ユーザーは喋る（打つ）だけ。4軸の数値化・タグ抽出・記録はすべてAIが裏で行う。

## 0. 原則

- **対話は入力ではなく整理** — AIは聞き役。数値はAIが推定し、ユーザーは「うん/ちがう」だけ
- **責めない・採点しない・誘導しない** — wabiの思想をそのまま対話の作法にする
- **記録は必ず確認してから** — 推定値を見せ、同意を得てから書き込む
- **どの入口から来ても同じ器に落ちる** — 正規ストレージ（保存・同期・Obsidian・庭）を通す

## 1. 全体アーキテクチャ

```
入口（どれからでも）            共通受け口                     器
┌────────────────┐
│ L1: Claude Code │─┐
│  (wabi-mcp)     │ │  ┌────────────────────┐   ┌──────────────────┐
├────────────────┤ ├─▶│ L0: wabi Local API   │──▶│ 正規ストレージ      │
│ L2: アプリ内チャット│ │  │ 127.0.0.1:51722     │   │ DayContext経由     │
│  (Claude API)   │─┘  │ (Electron main内)    │   │ → store/sync/      │
├────────────────┤    └────────────────────┘   │   Obsidian/庭/枯山水 │
│ L3: 音声        │ ※L2はアプリ内なのでHTTP不要、    └──────────────────┘
│  (fn fn / マイク) │   直接Context関数を呼ぶ
└────────────────┘
```

## 2. L0 — wabi Local API（受け口・基盤）

Electron main プロセスに 127.0.0.1 限定の小型HTTPサーバーを追加。

### エンドポイント

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/health` | 起動確認 + バージョン |
| GET | `/api/today` | 今日の状態（チェックイン・気分・アクション・メモ） |
| GET | `/api/recent?days=7` | 直近N日のサマリー（対話の文脈用） |
| POST | `/api/checkin` | `{stamina, mental, wave, bodyTemp, tags[], comment}` |
| POST | `/api/mood` | `{mood: heavy\|cloudy\|flat\|calm\|light}` |
| POST | `/api/note` | `{text, mode: append\|replace}` 心のメモ |
| POST | `/api/declined` | `{text, mode: append\|replace}` 手放したこと |
| POST | `/api/action-check` | `{title}` タイトル一致でアクション完了 |

### データフロー（書き込み）

```
HTTP受信(main) → webContents.send('external:checkin', data)
  → レンダラー DayContext が正規の addCheckIn() を実行
  → 画面即反映・デバウンス保存・クラウド同期・Obsidianエクスポート すべて正規ルート
```

mainがstoreを直接書かない理由: レンダラーのメモリ状態と乖離し、後勝ち上書きが起きるため。

### セキュリティ

- `127.0.0.1` バインドのみ（外部から到達不可）
- 初回起動時にトークン生成 → `~/Library/Application Support/wabi/api-token` に保存
- リクエストは `Authorization: Bearer <token>` 必須。MCPサーバーはこのファイルを読む
- 個人ツールなのでこれ以上は盛らない

### アプリ未起動時

- MCPが `/api/health` 失敗を検知 → 「wabiを起動して」と案内 + `open -a wabi` を提案
- （拡張余地）Supabase直書きフォールバックは**やらない**: pull戦略が「ローカル空のときだけ」なので当日反映されない

## 3. L1 — Claude Code経路（wabi-mcp + 対話スキル）

### wabi-mcp（Node製 stdio MCPサーバー）

場所: `tools/wabi-mcp/`（このリポジトリ内）。登録: `claude mcp add wabi -- node <path>/index.mjs`

| ツール | 対応API | 説明文の要点 |
|---|---|---|
| `wabi_get_context` | GET /today + /recent | 対話開始時に必ず呼ぶ。昨日までの流れを踏まえて声をかけられる |
| `wabi_checkin` | POST /checkin | 4軸は0-100。**ユーザーに推定値を確認してから**呼ぶ |
| `wabi_mood` | POST /mood | 5値 |
| `wabi_note` | POST /note | 対話の要約を心のメモに残す |
| `wabi_declined` | POST /declined | やらない決断 |
| `wabi_action_check` | POST /action-check | 「あれ終わった」発言を拾って完了化 |

### スキル「wabi-talk」（~/.claude/skills/ or プロジェクトスキル）

対話のファシリテーション作法:

1. `wabi_get_context` で文脈を読む →「昨日は波が高かったね。今日はどう？」
2. **3〜5往復で短く**。質問は一度にひとつ。オープン→具体の順
3. 4軸への変換目安:
   - 体温: 体の冷え/火照り・だるさの言及
   - 体力: 残量感（「もう無理」=低、「まだやれる」=高）
   - 淀: 頭の濁り/クリアさ（「もやもや」「すっきり」）
   - 波: ざわつき/静けさ（「焦ってる」「落ち着いてる」）
4. 推定値+タグを提示 →「こう記録していい？」→ 同意後にツール実行
5. 手放すものを一つ聞く（任意）→ `wabi_declined`
6. 一言で締める。説教・助言の押し付けをしない

### 音声（実装ゼロ）

macOS音声入力（fnキー2回）でClaude Codeに喋ればL1がそのまま音声対応になる。

## 4. L2 — アプリ内チャット「語り」（Claude API直結）

- wabi右カラム or モーダルに「語り」パネル
- Claude API（`claude-haiku-4-5` 既定、Settingsで変更可）+ tool use
- ツール定義はL1と同一概念だが、アプリ内なのでHTTPを経ず**直接Context関数を呼ぶ**
- システムプロンプト = wabi-talkの作法 + 直近7日サマリーを注入。プロンプトキャッシング適用
- 会話ログは `DayState.talks?: {time, role, text}[]` に保存（振り返り素材）
- APIキーはSettings（electron-store）。Web版は当面非対応（キー露出回避）
- 実装時は claude-api スキルを参照すること

## 5. L3 — 音声フルパイプライン（必要になったら）

- 第一選択: **OSの音声入力で済ませる**（L1/L2のテキスト欄に喋る）— 実装ゼロ
- 専用実装する場合: L2にマイクボタン → Whisper API（or whisper.cpp）でSTT → 同じ対話ループ
- 読み上げ: macOS `say` / Web Speech API。侘び的には**読み上げない**のが基本（静けさ優先）

## 6. データモデル変更

```ts
// CheckIn に追加（任意・後方互換）
source?: 'manual' | 'dialog'   // 対話経由の記録を区別

// DayState に追加（L2用）
talks?: { time: string; role: 'user' | 'ai'; text: string }[]
```

## 7. 段階的実装計画

| Phase | 内容 | 規模 | 成果 |
|---|---|---|---|
| **1** | L0受け口 + L1 wabi-mcp + wabi-talkスキル | 半日 | Claude Codeと話すだけで記録。音声もOS機能で即可 |
| **2** | L2アプリ内チャット | 1日 | wabi単体で完結する対話。iPhone対応は別途検討 |
| **3** | L3音声専用UI | 必要時 | マイクボタン・ハンズフリー |

## 8. 制約・将来メモ

- L0はElectron版のみ（PWAはlocalhostサーバー不可）。**iPhoneからの対話**は将来 Supabase Edge Functions + リアルタイム購読（同期戦略の改修が前提）
- 同期のpullが「ローカル空のときだけ」の現仕様は、外部書き込みと相性が悪い。L0経由（正規ルート）で書く限り問題ないが、Supabase直書きは避けること
- 対話ログをObsidianに書き出すかは未決（プライバシー的に「書き出さない」がデフォルト）
