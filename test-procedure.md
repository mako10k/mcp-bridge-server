# 設定ホットリロード機能のテスト手順

## 基本テスト

1. サーバーを起動する
```bash
PORT=3004 npm run watch -- --config ./test-config.json
```

2. 別のターミナルウィンドウで以下のコマンドを実行して、現在のサーバー状態を確認
```bash
curl http://localhost:3004/health
curl http://localhost:3004/mcp/servers
```

3. `test-config.json` を編集して設定を変更（例：サーバー名や設定値）

4. サーバーログを確認して、設定変更が自動的に検出されたことを確認
   - ログには `Configuration reloaded successfully` などのメッセージが表示されるはず

5. 再度サーバー状態を確認して、変更が反映されていることを確認
```bash
curl http://localhost:3004/mcp/servers
```

## 設定ファイルの交換テスト

現在の `test-config.json` の代わりに `test-config-updated.json` の内容に置き換える：

```bash
cp test-config-updated.json test-config.json
```

サーバーログを確認して、新しい設定が適用されたことを確認。新しく追加されたサーバーが表示されるはずです。

## 複数設定ファイルのテスト

追加の設定ファイルを使用して起動：

```bash
PORT=3004 npm run watch -- --config ./test-config.json --add-config ./platform-config.json
```

両方の設定がマージされ、両方のサーバー設定が有効になっていることを確認。

## エラーケースのテスト

1. 設定ファイルに無効な構文（例：不正なJSONフォーマット）を追加
```bash
echo "invalid json" >> test-config.json
```

2. サーバーログを確認して、エラーが適切に処理されているか確認
   - サーバーはエラーを報告すべきですが、クラッシュせずに動作し続けるはずです

3. 有効な設定に戻す
```bash
cp test-config-updated.json test-config.json
```

## プラットフォーム固有の設定テスト

このテストは単一のプラットフォームでは完全にテストできませんが、正しく設定が読み込まれることを確認できます：

1. ホームディレクトリに `.mcp-bridge` フォルダを作成
```bash
mkdir -p ~/.mcp-bridge
```

2. ユーザー設定を作成
```bash
cp platform-config.json ~/.mcp-bridge/config.json
```

3. サーバーを再起動して、ユーザー設定が読み込まれることを確認

## テスト結果の記録

テスト結果を `.test-results.md` に記録：

1. 各テストケースの成功/失敗
2. 発見された問題や改善点
3. 追加のテストケースの提案
