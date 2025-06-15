# ツール管理機能のリネーム計画

## 目的
MCP Bridgeの「Direct Registration」と「Tool Export/Registration Patterns」機能に、より直感的でわかりやすい英語の名前を付ける。

## 新しい名前の提案
1. 「Direct Registration」→「**Tool Aliasing**」（ツールのエイリアス化）
2. 「Registration Patterns」→「**Auto Tool Discovery**」（ツールの自動検出）

## 実装計画

### 1. コード変更
- [ ] src/bridge-tool-registry.ts - メイン機能コード
- [ ] src/config/mcp-config.ts - 設定スキーマ定義
- [ ] mcp-config.json - サンプル設定ファイル
- [ ] test-config.json - テスト設定ファイル
- [ ] test-config-updated.json - テスト設定ファイル更新版
- [ ] examples/ 内のサンプル設定ファイル

### 2. 名前の変更一覧

#### Direct Registration → Tool Aliasing 関連
- [ ] `directTools` → `toolAliases`
- [ ] `register_direct_tool` → `create_tool_alias`
- [ ] `unregister_direct_tool` → `remove_tool_alias`
- [ ] `handleRegisterDirectTool` → `handleCreateToolAlias`
- [ ] `handleUnregisterDirectTool` → `handleRemoveToolAlias`
- [ ] `registerDirectTool` → `createToolAlias`
- [ ] その他関連する変数名、関数名、コメント

#### Registration Patterns → Auto Tool Discovery 関連
- [ ] `registrationPatterns` → `toolDiscoveryRules`
- [ ] `applyRegistrationPatterns` → `applyDiscoveryRules`
- [ ] `shouldRegisterTool` → `shouldDiscoverTool`
- [ ] その他関連する変数名、関数名、コメント

### 3. ドキュメント更新
- [ ] README.md - 機能の説明を更新
- [ ] CHANGELOG.md - 変更内容を追加
- [ ] コードコメントの更新
- [ ] 新しい機能説明ドキュメントの作成（docs/tool-management.md）

### 4. 後方互換性の確保
- [ ] 古い設定フォーマットを読み込める移行コードの追加
- [ ] 非推奨警告の出力（古い名前が使用された場合）

### 5. テスト
- [ ] 既存のテストを更新
- [ ] 新しい名前での動作確認テスト
- [ ] 後方互換性テスト

## スケジュール
1. コード変更（1-2日）
2. ドキュメント更新（1日）
3. テスト実行と修正（1日）
4. コードレビュー（1-2日）
5. マージとリリース（1日）

## レビュー視点
- 新しい名称が直感的か
- 後方互換性が適切に維持されているか
- ドキュメントが明確に更新されているか
- コードの品質が維持されているか
