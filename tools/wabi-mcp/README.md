# wabi-mcp

wabi の対話レイヤー（L1）。Claude Code から会話するだけで、wabi に体と心の状態を記録できる MCP サーバー。

依存ゼロ。Node 18+ の標準機能（`fetch`・`readline`）だけで動く。

## しくみ

```
Claude Code ──(MCP/stdio)──▶ wabi-mcp ──(HTTP)──▶ wabi Local API ──▶ 正規ストレージ
                                  ▲                  (127.0.0.1)        （庭・同期・Obsidian）
                                  └ wabi-api.json を読んで接続先と token を取得
```

wabi アプリ（Electron版）を起動すると、`~/Library/Application Support/wabi/wabi-api.json` に
ポートとトークンが書き出される。wabi-mcp はそれを読んで Local API に接続する。

## 登録

```bash
claude mcp add wabi -s user -- node /ABSOLUTE/PATH/to/wabi/tools/wabi-mcp/index.mjs
```

登録後、Claude Code を再起動すると `wabi_*` ツールが使えるようになる。

## ツール

| ツール | 役割 |
|---|---|
| `wabi_get_context` | 対話開始時に呼ぶ。今日と直近数日の状態を返す |
| `wabi_checkin` | 4軸（体力・淀・波・体温）を記録。**推定値は確認してから** |
| `wabi_mood` | 気分5段階を記録 |
| `wabi_note` | 心のメモに追記 |
| `wabi_declined` | 「やらないと決めたこと」を記録 |
| `wabi_action_check` | アクションをタイトル一致で完了化 |

## 使い方

Claude Code で「振り返りしよう」「今日のチェックインして」などと話しかけると、
`wabi-talk` スキルが対話をファシリテートし、会話から推定した値を確認のうえ記録する。

## トラブルシューティング

- **「wabiアプリが起動していないようです」** → wabi.app を起動してから再試行
- 開発時に dev サーバーへ向けたい → `WABI_API_FILE` 環境変数で wabi-api.json のパスを明示
