# 🔐 OIDC/OAuth2 実装チェックリスト

## Phase 1: 基盤構築 🟢

### 🔒 セキュリティ強化機能
- [x] **Listen Address セキュリティ実装**
  - [x] 認証無効時: `127.0.0.1` または `::1` 強制設定
  - [x] 認証有効時: 設定可能（`listenAddress` config対応）
  - [x] 設定変更時のセキュリティ警告ログ
  - [ ] Admin UIでのListen Address設定UI

### 🛠️ ユーザー設定カスタマイズ基盤
- [x] **設定テンプレートシステム**
  - [x] `src/config/config-template-engine.ts` - 設定テンプレートエンジン
  - [x] `ServerConfigTemplate` 型定義とスキーマ実装
  - [x] パラメータ展開システム（{userId}, {userEmail}, etc.）
  - [x] テンプレート検証システム
- [x] **設定検証・セキュリティ**
  - [x] `src/config/config-validation.ts` - 設定検証システム
  - [x] `SecurityValidator` - パスインジェクション防止
  - [x] `PathValidator` - パス形式検証
  - [x] 動的制約検証システム

### 1.1 認証設定管理
- [x] `src/config/auth-config.ts` - 認証設定の読み込みと検証
  - [x] 環境変数置換（`${VAR_NAME}`形式）
  - [x] Zod スキーマによる設定検証
  - [x] 設定のホットリロード対応
- [x] `mcp-config.json` に auth セクション追加
- [x] 環境変数テンプレート `.env.example` 作成

### 1.2 型定義
- [x] `src/auth/types/auth-types.ts` - 認証関連の型定義
- [x] `src/auth/types/oidc-types.ts` - OIDC仕様の型定義
- [x] `src/auth/types/rbac-types.ts` - RBAC関連の型定義

### 1.3 OIDC/OAuth2 基盤
- [x] `src/auth/providers/base-provider.ts` - プロバイダー基底クラス
 - [x] `src/auth/utils/jwt-utils.ts` - JWT検証/生成ユーティリティ
- [x] `src/auth/utils/pkce-utils.ts` - PKCE実装
- [x] `src/auth/utils/crypto-utils.ts` - 暗号化ユーティリティ

### 1.4 認証フロー実装
- [x] `src/auth/managers/auth-manager.ts` - 認証フローの中央管理
- [x] `src/routes/auth.ts` - 認証エンドポイント
  - [x] `GET /auth/login/:provider` - ログイン開始
  - [x] `GET /auth/callback/:provider` - OAuth2コールバック
  - [x] `POST /auth/logout` - ログアウト
  - [x] `GET /auth/user` - ユーザー情報取得
  - [x] `GET /auth/status` - 認証ステータス確認
  - [x] `POST /auth/refresh` - トークンリフレッシュ（TODO実装）

### 1.5 テスト
- [ ] 認証設定の単体テスト
- [ ] JWT ユーティリティのテスト
- [x] PKCE 実装のテスト

## Phase 1.5: MCP ライフサイクル管理 🟢
### 🔄 基本ライフサイクル実装
- [x] **MCPLifecycleManager 基盤**
  - [x] ライフサイクルモード定義（Global/User/Session）
  - [x] MCPInstanceContext インターフェース実装
  - [x] 基本的なインスタンス管理機能

- [x] **パステンプレート機能**
  - [x] PathTemplateResolver 実装
  - [x] テンプレート変数解決（{userId}, {sessionId} など）
  - [x] セキュリティ検証（ディレクトリトラバーサル防止）

- [x] **インスタンス管理機能**
  - [x] GlobalInstanceManager - 共有インスタンス管理
  - [x] UserInstanceManager - ユーザー別インスタンス管理
  - [x] SessionInstanceManager - セッション別インスタンス管理

### 🔒 セキュリティ・制限機能
 - [x] **リソース制限**
  - [x] ユーザー別最大インスタンス数制限
  - [x] セッション別最大インスタンス数制限
  - [x] インスタンスタイムアウト機能

 - [x] **セキュリティ強化**
  - [x] パス注入攻撃防止
  - [x] プロセス分離確保
  - [ ] 最小権限でのプロセス実行

### 📊 監視・運用機能
- [x] **インスタンス監視**
  - [x] インスタンスメトリクス収集
  - [x] 自動クリーンアップ機能
  - [ ] 管理UI（Admin画面での状況表示）

- [ ] **ログ・監査**
  - [ ] インスタンス作成/削除ログ
  - [ ] ユーザー別アクセスログ
  - [x] リソース使用量ログ

## Phase 2: プロバイダー実装 ⏳

### 🛠️ ユーザー設定管理システム
- [ ] **ユーザー設定マネージャー**
  - [ ] `src/config/user-config-manager.ts` - ユーザー設定管理
  - [ ] 設定マージ・オーバーライドロジック
  - [ ] インスタンス更新・再起動連携
  - [ ] 設定バリデーション統合
- [ ] **永続化システム**
  - [ ] `src/storage/user-settings-store.ts` - 設定永続化インターフェース
  - [ ] `FileBasedSettingsStore` 実装
  - [ ] `DatabaseSettingsStore` 実装（オプション）
  - [ ] `src/storage/settings-encryption.ts` - 設定暗号化
- [ ] **ユーザー設定API**
  - [ ] `src/routes/user-config.ts` - ユーザー設定APIエンドポイント
  - [ ] 権限チェック統合
  - [ ] エラーハンドリング
  - [ ] API テスト

### 2.1 Google OAuth2
- [x] `src/auth/providers/google-provider.ts`
- [x] Google People API 連携
- [x] プロフィール情報取得
- [x] テストケース作成

### 2.2 Microsoft Azure AD
- [x] `src/auth/providers/azure-provider.ts`
- [x] Microsoft Graph API 連携
- [x] テナント情報取得
- [x] テストケース作成

### 2.3 GitHub OAuth2
 - [x] `src/auth/providers/github-provider.ts`
 - [x] GitHub API 連携
 - [x] ユーザー情報取得
 - [x] テストケース作成

### 2.4 汎用OIDC
- [x] `src/auth/providers/generic-oidc.ts`
- [x] OpenID Connect Discovery 対応
- [x] カスタムプロバイダー対応

## Phase 3: API保護とRBAC ⏳

### 3.1 認証ミドルウェア
- [ ] `src/middleware/auth-middleware.ts` - JWT検証ミドルウェア
  - [ ] Bearer トークン検証
  - [ ] Cookie セッション検証
  - [ ] エラーハンドリング
- [ ] `src/middleware/rbac-middleware.ts` - 権限チェック
  - [ ] ロールベースアクセス制御
  - [ ] パーミッション検証
  - [ ] 動的権限チェック

### 3.2 既存ルートの更新
- [ ] `src/routes/health.ts` - パブリックアクセス維持
- [ ] `src/routes/mcp-servers.ts` - viewer権限以上
- [ ] `src/routes/tools.ts` - viewer権限以上（実行はoperator）
- [ ] `src/routes/tool-aliases.ts` - operator権限以上
- [ ] `src/routes/config.ts` - admin権限必須
- [ ] `src/routes/logs.ts` - viewer権限以上
- [ ] `src/routes/server-management.ts` - admin権限必須

### 3.3 コンテキスト強化
- [ ] 各ルートハンドラーにユーザー情報を渡すよう更新
- [ ] 認証情報をログに記録
- [ ] 監査ログの実装

## Phase 4: 高度な機能 ⏳

### 🎨 User UI (ユーザー専用インターフェース)
- [ ] **User UI 基盤構築**
  - [ ] `user-ui/` ディレクトリ作成とプロジェクト設定
  - [ ] Vite + React + TypeScript + Tailwind CSS セットアップ
  - [ ] 認証統合（AuthContext）
  - [ ] APIクライアント設定
- [ ] **ユーザー設定ページ**
  - [ ] `user-ui/src/pages/MySettings.tsx` - メイン設定ページ
  - [ ] `ServerSettingsCard` コンポーネント
  - [ ] `SettingInput` 動的コンポーネント
  - [ ] リアルタイム設定検証
- [ ] **高度なUI機能**
  - [ ] 設定プレビュー機能
  - [ ] エクスポート/インポート機能
  - [ ] 設定リセット機能
  - [ ] `SettingsSidebar` - 概要表示
- [ ] **User UI と Admin UI の分離**
  - [ ] ルーティング分離（/admin vs /user）
  - [ ] 権限ベースアクセス制御
  - [ ] UI/UX デザインの違い

### 4.1 セッション管理
- [ ] `src/auth/managers/session-manager.ts`
- [ ] Redis対応（オプション）
- [ ] セッション監査ログ
- [ ] セッション有効期限管理

### 4.2 ユーザー管理
- [ ] `src/auth/managers/user-manager.ts`
- [ ] ユーザー情報キャッシュ
- [ ] 動的ロール変更API
- [ ] ユーザー活動ログ

### 4.3 トークン管理
- [ ] `src/auth/managers/token-manager.ts`
- [ ] リフレッシュトークン対応
- [ ] トークン取り消し機能
- [ ] トークン監査ログ

## UI統合 🎨

### Admin UI (React)
- [ ] `admin-ui/src/contexts/AuthContext.tsx` - 認証状態管理
- [ ] `admin-ui/src/components/LoginPage.tsx` - ログイン画面
- [ ] `admin-ui/src/components/UserProfile.tsx` - ユーザープロフィール
- [ ] `admin-ui/src/hooks/useAuth.ts` - 認証フック
- [ ] 保護されたルートの実装
- [ ] ログイン/ログアウト UI

## セキュリティ強化 🔒

### セキュリティヘッダー
- [ ] Helmet.js 統合
- [ ] Content Security Policy
- [ ] HSTS (HTTP Strict Transport Security)
- [ ] X-Frame-Options

### CORS設定
- [ ] `src/middleware/cors-middleware.ts`
- [ ] オリジン制限
- [ ] 認証情報付きリクエスト対応

### 入力検証
- [ ] Zod スキーマによるリクエスト検証
- [ ] サニタイゼーション
- [ ] レート制限

## テスト 🧪

### 単体テスト
- [ ] JWT ユーティリティ
- [ ] PKCE 実装
- [ ] 各プロバイダー
- [ ] ミドルウェア

### 統合テスト
- [ ] 認証フロー全体
- [ ] RBAC権限チェック
- [ ] API保護テスト

### E2Eテスト
- [ ] Admin UI ログインフロー
- [ ] API認証テスト
- [ ] セッション管理テスト

## ドキュメント 📚

### 設定ガイド
- [ ] README.md 更新（認証設定手順）
- [ ] 環境変数説明
- [ ] プロバイダー設定例

### API ドキュメント
- [ ] 認証エンドポイント
- [ ] エラーレスポンス
- [ ] 権限レベル説明

### 開発者ガイド
- [ ] ローカル開発セットアップ
- [ ] テスト用認証設定
- [ ] デバッグ手順

## デプロイメント 🚀

### Docker対応
- [ ] Dockerfile 更新（認証依存関係）
- [ ] docker-compose.yml 更新
- [ ] 環境変数設定例

### 本番環境
- [ ] HTTPS設定確認
- [ ] セキュリティ設定検証
- [ ] パフォーマンステスト

---

## 実装優先度

### 🔥 Critical (Phase 1)
- 認証設定管理
- JWT基盤
- 基本認証フロー
- **ユーザー設定カスタマイズ基盤（設定テンプレート）**

### 🟡 Important (Phase 2-3)
- Google OAuth2
- API保護
- RBAC実装
- **ユーザー設定管理システム（永続化・検証）**

### 🟢 Nice to have (Phase 4)
- セッション管理
- 複数プロバイダー
- 高度なUI
- **User UI（ユーザー専用インターフェース）**

### 📊 統合・最適化 (Phase 5)
- [ ] **全コンポーネント統合テスト**
  - [ ] 認証 + ライフサイクル + ユーザー設定の統合
  - [ ] セキュリティテスト（パスインジェクション、権限昇格）
  - [ ] パフォーマンステスト（多数ユーザー、多数インスタンス）
  - [ ] エラーハンドリングテスト
- [ ] **ドキュメント・最適化**
  - [ ] API ドキュメント作成（OpenAPI/Swagger）
  - [ ] ユーザーガイド作成
  - [ ] 管理者ガイド作成
  - [ ] パフォーマンス最適化
  - [ ] 本番環境デプロイメント準備

---

**最終更新**: 2025年6月21日
