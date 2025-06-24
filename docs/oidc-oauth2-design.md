# 🔐 OIDC/OAuth2 認証機能設計書

## 📋 現状分析

現在のMCP Bridge Serverの状況：
- ✅ Express.jsベースのHTTP APIサーバー
- ✅ ルートハンドラーがモジュール化済み  
- ✅ React Admin UI搭載
- ❌ 認証機能なし（誰でもアクセス可能）

## 🎯 設計目標

### 主要要件
1. **段階的導入**: 既存機能を壊さずオプション機能として実装
2. **標準準拠**: OIDC/OAuth2標準に完全準拠
3. **マルチプロバイダー**: 複数の認証プロバイダーに対応
4. **エンタープライズ対応**: ロールベースアクセス制御（RBAC）
5. **設定の柔軟性**: 動的設定変更とホットリロード対応

## 🏗️ アーキテクチャ設計

### 1. ファイル構造
```
src/
├── auth/                      # 🆕 認証コア機能
│   ├── types/
│   │   ├── auth-types.ts      # 認証関連の型定義
│   │   ├── oidc-types.ts      # OIDC仕様の型定義
│   │   └── rbac-types.ts      # RBAC関連の型定義
│   ├── providers/
│   │   ├── base-provider.ts   # プロバイダー基底クラス
│   │   ├── google-provider.ts # Google OAuth2
│   │   ├── azure-provider.ts  # Microsoft Azure AD
│   │   ├── github-provider.ts # GitHub OAuth2
│   │   └── generic-oidc.ts    # 汎用OIDC対応
│   ├── managers/
│   │   ├── auth-manager.ts    # 認証管理の中核
│   │   ├── token-manager.ts   # JWT/トークン管理
│   │   ├── session-manager.ts # セッション管理
│   │   └── user-manager.ts    # ユーザー情報管理
│   └── utils/
│       ├── jwt-utils.ts       # JWT関連ユーティリティ
│       ├── pkce-utils.ts      # PKCE実装
│       └── crypto-utils.ts    # 暗号化ユーティリティ
├── middleware/
│   ├── auth-middleware.ts     # 🆕 認証ミドルウェア
│   ├── rbac-middleware.ts     # 🆕 RBAC ミドルウェア
│   ├── cors-middleware.ts     # 🆕 CORS設定強化
│   └── error-handler.ts       # 既存（認証エラー対応強化）
├── routes/
│   ├── auth.ts               # 🆕 認証エンドポイント
│   └── ... (既存ファイル、認証対応強化)
├── config/
│   └── auth-config.ts        # 🆕 認証設定管理
├── mcp/
│   ├── lifecycle/
│   │   ├── mcp-lifecycle-manager.ts    # 🆕 ライフサイクル管理
│   │   ├── global-instance-manager.ts  # 🆕 グローバルインスタンス管理
│   │   ├── user-instance-manager.ts    # 🆕 ユーザー別インスタンス管理
│   │   └── session-instance-manager.ts # 🆕 セッション別インスタンス管理
│   ├── templates/
│   │   └── path-template-resolver.ts   # 🆕 パステンプレート解決
│   └── federation/                     # 🔮 将来のHTTP フェデレーション
│       └── http-mcp-client.ts
```

### 2. 設定ファイル拡張 (`mcp-config.json`)
```json
{
  "global": {
    "httpPort": 3000,
    "listenAddress": "0.0.0.0",  // 認証有効時のみ適用
    "logLevel": "info"
  },
  "auth": {                    // 🆕 認証設定セクション
    "enabled": false,          // デフォルトは無効（後方互換性）
    "mode": "optional",        // "disabled" | "optional" | "required"
    "providers": [
      {
        "type": "google",
        "clientId": "${GOOGLE_CLIENT_ID}",
        "clientSecret": "${GOOGLE_CLIENT_SECRET}",
        "redirectUri": "http://localhost:3000/auth/callback/google"
      },
      {
        "type": "azure",
        "tenantId": "${AZURE_TENANT_ID}",
        "clientId": "${AZURE_CLIENT_ID}",
        "clientSecret": "${AZURE_CLIENT_SECRET}"
      }
    ],
    "rbac": {
      "defaultRole": "viewer",
      "roles": {
        "admin": {
          "permissions": ["*"]
        },
        "operator": {
          "permissions": ["read", "execute", "restart"]
        },
        "viewer": {
          "permissions": ["read"]
        }
      },
      "userMappings": [
        {
          "email": "admin@company.com",
          "role": "admin"
        }
      ]
    },
    "session": {
      "secret": "${SESSION_SECRET}",
      "maxAge": 86400000,      // 24時間
      "secure": true,
      "httpOnly": true
    },
    "jwt": {
      "issuer": "mcp-bridge",
      "audience": "mcp-bridge-api",
      "expiresIn": "1h"
    }
  },
  "servers": [...],           // 既存のMCPサーバー設定
  "toolAliases": [...]        // 既存のツール設定
}
```

## 🚀 実装計画（段階的アプローチ）

### Phase 1: 基盤構築 (1-2週間)
**目標**: 認証の基本インフラを実装

#### 1.1 認証設定管理
- [ ] `auth-config.ts` - 認証設定の読み込みと検証
- [ ] 環境変数サポート（`${VAR_NAME}`形式）
- [ ] 設定のホットリロード対応

#### 1.2 OIDC/OAuth2 基盤
- [ ] `base-provider.ts` - プロバイダー共通インターフェース
- [ ] `jwt-utils.ts` - JWT検証/生成ユーティリティ
- [ ] `pkce-utils.ts` - PKCE実装（セキュリティ強化）

#### 1.3 認証フロー実装
- [ ] `auth-manager.ts` - 認証フローの中央管理
- [ ] `/auth/login` - ログイン開始エンドポイント
- [ ] `/auth/callback` - OAuth2コールバック処理
- [ ] `/auth/logout` - ログアウト処理

### Phase 2: プロバイダー実装 (1-2週間)
**目標**: 主要認証プロバイダーの対応

#### 2.1 Google OAuth2
- [ ] `google-provider.ts`
- [ ] Google APIs連携
- [ ] ユーザー情報取得

#### 2.2 Microsoft Azure AD
- [ ] `azure-provider.ts`
- [ ] Microsoft Graph API連携
- [ ] Enterprise向け機能

#### 2.3 GitHub OAuth2
- [ ] `github-provider.ts`
- [ ] 開発者向けワークフロー

### Phase 3: API保護とRBAC (1-2週間)
**目標**: 既存APIの段階的保護

#### 3.1 認証ミドルウェア
- [ ] `auth-middleware.ts` - JWT検証ミドルウェア
- [ ] `rbac-middleware.ts` - 権限チェック
- [ ] 既存ルートファイルの更新

#### 3.2 Admin UI統合
- [ ] React UIにログイン画面追加
- [ ] 認証状態管理（Context API）
- [ ] 保護されたページの実装

#### 3.3 API エンドポイント保護
```typescript
// 保護レベルの定義
public:    ['/health', '/mcp/server-info']
viewer:    ['/mcp/servers', '/mcp/tools', '/mcp/logs']
operator:  ['/mcp/servers/*/retry', '/mcp/tools/call']
admin:     ['/mcp/config/*', '/mcp/server/restart']
```

### Phase 4: 高度な機能 (1週間)
**目標**: エンタープライズ機能の完成

#### 4.1 セッション管理
- [ ] `session-manager.ts` - セッション永続化
- [ ] Redis対応（オプション）
- [ ] セッション監査ログ

#### 4.2 ユーザー管理
- [ ] `user-manager.ts` - ユーザー情報キャッシュ
- [ ] 動的ロール変更
- [ ] ユーザー活動ログ

## 🔒 セキュリティ考慮事項

### 0. Listen Address セキュリティ
**重要**: ネットワークアクセス制御による段階的セキュリティ

#### ルール
- **認証無効時**: `127.0.0.1` または `::1` (localhost) 固定 - 外部アクセス不可
- **認証有効時**: 設定可能 - `0.0.0.0` / `::`, 特定IP等を許可

#### 実装方針
```typescript
// セキュリティチェック例
function getListenAddress(authConfig: AuthConfig, globalConfig: GlobalConfig): string {
  if (!authConfig.enabled) {
    // 認証無効時は強制的にlocalhostのみ
    logger.warn('Authentication is disabled. Forcing localhost-only access for security.');
    return globalConfig.listenAddress === '::1' ? '::1' : '127.0.0.1';
  }

  // 認証有効時のみ設定可能
  return globalConfig.listenAddress || '127.0.0.1';
}
```

#### 設定例
```json
{
  "global": {
    "httpPort": 3000,
    "listenAddress": "0.0.0.0",  // 認証有効時のみ適用
    "logLevel": "info"
  },
  "auth": {
    "enabled": true  // これがfalseの場合、listenAddressは無視される
  }
}
```

#### セキュリティメリット
1. **防御の多層化**: 認証 + ネットワークレベル制御
2. **設定ミス防止**: 認証なしで外部公開される事故を防ぐ
3. **段階的公開**: 認証実装後に安全にネットワーク公開可能

### 1. JWT セキュリティ
- **アルゴリズム**: RS256（非対称暗号化）
- **短い有効期限**: 1時間（リフレッシュトークン対応）
- **秘密鍵管理**: 環境変数または外部キー管理システム

### 2. CSRF/XSS対策
- **SameSite Cookie**: Strict設定
- **CSRF Token**: フォーム送信時の検証
- **Content Security Policy**: XSS攻撃防止

### 3. HTTPS強制
- **本番環境**: HTTPS必須
- **開発環境**: HTTP許可（設定可能）

## 🧪 テスト戦略

### 1. 単体テスト
- JWT検証ロジック
- PKCE実装
- 各プロバイダーのモック

### 2. 統合テスト
- 認証フロー全体
- RBAC権限チェック
- API保護テスト

### 3. E2Eテスト
- Admin UIログインフロー
- API認証テスト

## 📊 パフォーマンス考慮

### 1. JWT検証最適化
- 公開鍵キャッシュ
- 非同期検証処理

### 2. セッション最適化
- メモリキャッシュ
- Redis クラスター対応

## 🔄 マイグレーション戦略

### 1. 後方互換性
```typescript
// 既存のAPI呼び出しは認証なしで動作
if (!authConfig.enabled) {
  return next(); // 認証スキップ
}
```

### 2. 段階的移行
1. **Week 1**: 認証無効（現状維持）
2. **Week 2**: 認証オプション（一部ユーザーでテスト）
3. **Week 3**: 認証推奨（デフォルト有効）
4. **Week 4**: 認証必須（セキュリティ強化）

## 📝 実装ノート

### 依存関係
```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.0",           // JWT処理
    "express-session": "^1.17.3",      // セッション管理
    "passport": "^0.6.0",              // 認証戦略
    "passport-google-oauth20": "^2.0.0", // Google OAuth2
    "passport-azure-ad": "^4.3.4",     // Azure AD
    "passport-github2": "^0.1.12",     // GitHub OAuth2
    "node-cache": "^5.1.2",            // メモリキャッシュ
    "crypto": "built-in",               // 暗号化機能
    "helmet": "^6.1.5"                 // セキュリティヘッダー
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.0",
    "@types/express-session": "^1.17.0",
    "@types/passport": "^1.0.0",
    "@types/passport-google-oauth20": "^2.0.0"
  }
}
```

### 環境変数テンプレート
```bash
# Google OAuth2
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Microsoft Azure AD
AZURE_TENANT_ID=your_azure_tenant_id
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_client_secret

# GitHub OAuth2
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# JWT設定
JWT_PRIVATE_KEY=your_jwt_private_key
JWT_PUBLIC_KEY=your_jwt_public_key

# セッション設定
SESSION_SECRET=your_session_secret
```

## 🎯 次のステップ

1. **Phase 1開始**: 認証設定管理から実装開始
2. **プロトタイプ作成**: Google OAuth2での簡単な認証フロー
3. **テスト環境構築**: 認証機能のテスト用設定
4. **ドキュメント更新**: README.mdに認証設定手順を追加

---

**作成日**: 2025年6月17日  
**バージョン**: v1.0  
**ステータス**: 設計完了、実装待ち

## 🔄 MCP サーバー ライフサイクル管理

### 概要
STDIO接続のMCPサーバーを、認証情報に基づいて動的に管理する機能

### ライフサイクルモード

#### 1. **Global Mode** (グローバル共有)
- **特徴**: 全ユーザーで1つのMCPサーバーインスタンスを共有
- **用途**: 読み取り専用データ、共通ツール
- **セキュリティ**: データ分離なし（注意が必要）
- **リソース**: 最小限のメモリ・CPU使用

#### 2. **User Mode** (ユーザー別)
- **特徴**: ユーザーID（email/sub）ごとに独立したMCPサーバーインスタンス
- **用途**: ユーザー固有のデータ、個人設定
- **セキュリティ**: ユーザー間でのデータ完全分離
- **リソース**: ユーザー数 × MCPサーバー数

#### 3. **Session Mode** (セッション別)
- **特徴**: セッションごとに独立したMCPサーバーインスタンス
- **用途**: 一時的な作業、セッション固有の状態
- **セキュリティ**: 最高レベルの分離
- **リソース**: アクティブセッション数 × MCPサーバー数

### 設定例
```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/tmp"],
      "lifecycle": "global",        // 🆕 ライフサイクルモード
      "requireAuth": false          // 🆕 認証要求フラグ
    },
    {
      "name": "user-files", 
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/home/{userId}"],
      "lifecycle": "user",          // ユーザー別インスタンス
      "requireAuth": true,          // 認証必須
      "pathTemplates": {            // 🆕 パス テンプレート
        "userId": "auth.user.id",   // 認証情報からのマッピング
        "userEmail": "auth.user.email"
      }
    },
    {
      "name": "session-workspace",
      "command": "npx", 
      "args": ["@modelcontextprotocol/server-filesystem", "/tmp/session/{sessionId}"],
      "lifecycle": "session",       // セッション別インスタンス
      "requireAuth": true,
      "pathTemplates": {
        "sessionId": "session.id"
      }
    }
  ]
}
```

### アーキテクチャ設計

#### 新しいファイル構造
```
src/
├── mcp/
│   ├── lifecycle/
│   │   ├── mcp-lifecycle-manager.ts    # 🆕 ライフサイクル管理
│   │   ├── global-instance-manager.ts  # 🆕 グローバルインスタンス管理
│   │   ├── user-instance-manager.ts    # 🆕 ユーザー別インスタンス管理
│   │   └── session-instance-manager.ts # 🆕 セッション別インスタンス管理
│   ├── templates/
│   │   └── path-template-resolver.ts   # 🆕 パステンプレート解決
│   └── federation/                     # 🔮 将来のHTTP フェデレーション
│       └── http-mcp-client.ts
├── auth/
│   ├── context/
│   │   └── auth-context.ts             # 🆕 認証コンテキスト管理
```

#### コア実装

##### 1. ライフサイクル管理インターフェース
```typescript
// src/mcp/lifecycle/mcp-lifecycle-manager.ts
export interface MCPInstanceContext {
  lifecycleMode: 'global' | 'user' | 'session';
  userId?: string;
  userEmail?: string;
  sessionId?: string;
  authInfo?: AuthenticatedUser;
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  lifecycle: 'global' | 'user' | 'session';
  requireAuth: boolean;
  pathTemplates?: Record<string, string>;
  env?: Record<string, string>;
}

export class MCPLifecycleManager {
  async getOrCreateInstance(
    config: MCPServerConfig,
    context: MCPInstanceContext
  ): Promise<MCPServerInstance>;
  
  async terminateUserInstances(userId: string): Promise<void>;
  async terminateSessionInstances(sessionId: string): Promise<void>;
  async listActiveInstances(): Promise<MCPInstanceInfo[]>;
}
```

##### 2. パステンプレート解決
```typescript
// src/mcp/templates/path-template-resolver.ts
export class PathTemplateResolver {
  resolve(template: string, context: MCPInstanceContext): string {
    return template
      .replace(/{userId}/g, context.userId || 'anonymous')
      .replace(/{userEmail}/g, context.userEmail || 'anonymous')
      .replace(/{sessionId}/g, context.sessionId || 'default')
      .replace(/{timestamp}/g, Date.now().toString());
  }
  
  resolveArgs(args: string[], context: MCPInstanceContext): string[] {
    return args.map(arg => this.resolve(arg, context));
  }
}
```

##### 3. 認証コンテキスト統合
```typescript
// src/auth/context/auth-context.ts
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  roles: string[];
  sessionId: string;
}

export class AuthContextManager {
  extractContext(req: express.Request): MCPInstanceContext {
    const user = req.user as AuthenticatedUser;
    return {
      lifecycleMode: 'user', // または設定から決定
      userId: user?.id,
      userEmail: user?.email,
      sessionId: req.sessionID,
      authInfo: user
    };
  }
}
```

### セキュリティ考慮事項

#### 1. リソース制限
```typescript
export interface LifecycleResourceLimits {
  maxInstancesPerUser: number;        // デフォルト: 10
  maxInstancesPerSession: number;     // デフォルト: 5
  maxGlobalInstances: number;         // デフォルト: 50
  instanceTimeoutMinutes: number;     // デフォルト: 60
}
```

#### 2. パス注入攻撃防止
```typescript
export class SecurePathResolver {
  sanitizePath(path: string): string {
    // ディレクトリトラバーサル攻撃防止
    return path.replace(/\.\./g, '').replace(/[<>:"|?*]/g, '');
  }
  
  validateTemplate(template: string): boolean {
    // 許可されたテンプレート変数のみ
    const allowedVars = ['{userId}', '{userEmail}', '{sessionId}', '{timestamp}'];
    // 実装...
  }
}
```

#### 3. インスタンス分離
- **プロセス分離**: 各インスタンスは独立したプロセス
- **ファイルシステム分離**: ユーザー別ディレクトリ制限
- **権限制限**: 最小権限でのプロセス実行

### 実装フェーズ

#### Phase 1: 基本ライフサイクル (1-2週間)
- [ ] `MCPLifecycleManager` 基盤実装
- [ ] Global/User/Session モード基本機能
- [ ] パステンプレート解決機能

#### Phase 2: 認証統合 (1週間)
- [ ] 認証コンテキストとの統合
- [ ] セキュリティ制限実装
- [ ] インスタンス監視・管理

#### Phase 3: 高度な機能 (1週間)
- [ ] リソース制限・監視
- [ ] インスタンス自動クリーンアップ
- [ ] 管理UI（Admin画面でのインスタンス状況表示）

### 運用面での考慮

#### 1. モニタリング
```typescript
export interface MCPInstanceMetrics {
  instanceId: string;
  serverId: string;
  lifecycleMode: string;
  userId?: string;
  sessionId?: string;
  createdAt: Date;
  lastAccessed: Date;
  requestCount: number;
  memoryUsage: number;
  cpuUsage: number;
}
```

#### 2. ログ管理
- インスタンス作成/削除ログ
- ユーザー別アクセスログ
- リソース使用量ログ
- エラー・異常終了ログ

#### 3. 自動クリーンアップ
- 非アクティブインスタンスの自動終了
- セッション終了時のインスタンス削除
- ユーザーログアウト時のオプション削除

## 🔮 将来の HTTP フェデレーション

### 設計方針（将来実装）
```json
{
  "servers": [
    {
      "name": "remote-mcp",
      "type": "http",              // 🔮 HTTPクライアント
      "endpoint": "https://api.example.com/mcp",
      "lifecycle": "federated",    // 🔮 フェデレーション
      "auth": {
        "type": "oauth2",
        "tokenEndpoint": "...",
        "clientCredentials": "..."
      }
    }
  ]
}
```

---

**このライフサイクル管理機能により、MCPサーバーの柔軟で安全な運用が可能になります！特に企業環境での利用では、ユーザー分離が重要になりますね。** 🎯

# 🎨 ユーザー設定カスタマイズ機能

## 概要
ユーザー分離・セッション分離環境において、各ユーザーが自分の環境変数やMCPサーバー設定をカスタマイズできる機能

## アーキテクチャ

#### 1. 設定階層構造
```
システム設定（管理者のみ）
├── グローバル設定（全ユーザー共通）
├── サーバー設定テンプレート
│   ├── 管理者固定部分（変更不可）
│   └── ユーザーカスタマイズ可能部分
└── ユーザー設定（ユーザー個別）
    ├── 環境変数オーバーライド
    ├── サーバー有効/無効切り替え
    └── カスタムパラメータ
```

#### 2. 新しいファイル構造
```
src/
├── config/
│   ├── user-config-manager.ts          // 🆕 ユーザー設定管理
│   ├── config-template-engine.ts       // 🆕 設定テンプレート
│   └── config-validation.ts            // 🆕 設定検証
├── routes/
│   ├── user-config.ts                  // 🆕 ユーザー設定API
│   └── admin-config.ts                 // 🆕 管理者設定API（既存config.tsから分離）
├── auth/
│   ├── permissions/
│   │   ├── permission-manager.ts       // 🆕 権限管理
│   │   └── resource-access-control.ts  // 🆕 リソースアクセス制御
└── storage/
    ├── user-settings-store.ts           // 🆕 ユーザー設定永続化
    └── settings-encryption.ts           // 🆕 設定暗号化
```

#### 3. Admin UI と User UI の分離
```
admin-ui/                               # 管理者専用UI
├── src/pages/
│   ├── SystemSettings.tsx             # システム設定
│   ├── UserManagement.tsx             # ユーザー管理
│   ├── ServerTemplateManagement.tsx   # サーバーテンプレート管理
│   └── PermissionManagement.tsx       # 権限管理

user-ui/                                # 🆕 ユーザー専用UI
├── src/pages/
│   ├── MySettings.tsx                 # 個人設定
│   ├── MyServers.tsx                  # 利用可能サーバー管理
│   ├── MyEnvironment.tsx              # 環境変数設定
│   └── MyDashboard.tsx                # 個人ダッシュボード
```

### 設定管理の詳細設計

#### 1. サーバー設定テンプレート
```json
{
  "serverTemplates": [
    {
      "id": "user-filesystem",
      "name": "Personal File System",
      "description": "Access to your personal files",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "{userWorkspace}"],
      "lifecycle": "user",
      "requireAuth": true,
      "adminControlled": {
        "command": "npx",                    // 管理者固定
        "args": ["@modelcontextprotocol/server-filesystem", "{userWorkspace}"],
        "lifecycle": "user",                 // 管理者固定
        "requireAuth": true                  // 管理者固定
      },
      "userCustomizable": {
        "enabled": {                         // ユーザーが有効/無効切り替え可能
          "type": "boolean",
          "default": true,
          "description": "Enable personal file access"
        },
        "userWorkspace": {                   // ユーザーがパス設定可能
          "type": "path",
          "default": "/home/{userId}/workspace",
          "allowedPatterns": ["/home/{userId}/**"],
          "description": "Your workspace directory"
        },
        "maxFileSize": {                     // ユーザーが制限値設定可能
          "type": "integer",
          "default": 10485760,
          "min": 1048576,
          "max": 52428800,
          "description": "Maximum file size (bytes)"
        }
      },
      "envVariables": {
        "adminControlled": {
          "MCP_SERVER_TYPE": "filesystem",   // 管理者固定
          "SECURITY_LEVEL": "user"           // 管理者固定
        },
        "userCustomizable": {
          "DEBUG_LEVEL": {                   // ユーザー設定可能
            "type": "enum",
            "values": ["error", "warn", "info", "debug"],
            "default": "warn",
            "description": "Debug output level"
          },
          "CACHE_SIZE": {                    // ユーザー設定可能
            "type": "integer",
            "default": 100,
            "min": 10,
            "max": 1000,
            "description": "Cache size for file operations"
          }
        }
      }
    }
  ]
}
```

#### 2. ユーザー設定オーバーライド
```json
{
  "userId": "user123@example.com",
  "serverSettings": {
    "user-filesystem": {
      "enabled": true,
      "customization": {
        "userWorkspace": "/home/user123/my-projects",
        "maxFileSize": 20971520
      },
      "envVariables": {
        "DEBUG_LEVEL": "info",
        "CACHE_SIZE": 200
      }
    },
    "user-database": {
      "enabled": false                      // ユーザーが無効化
    }
  },
  "globalEnvOverrides": {                   // グローバル環境変数のオーバーライド
    "TIMEZONE": "Asia/Tokyo",
    "LANGUAGE": "ja-JP"
  }
}
```

### RBAC権限システム拡張

#### 1. 権限定義
```typescript
export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'system' | 'user' | 'server' | 'config';
}

export const PERMISSIONS = {
  // システム管理権限
  SYSTEM_ADMIN: 'system:admin',
  SYSTEM_CONFIG: 'system:config',
  USER_MANAGEMENT: 'system:users',
  
  // ユーザー権限
  USER_CONFIG_READ: 'user:config:read',
  USER_CONFIG_WRITE: 'user:config:write',
  USER_SERVERS_MANAGE: 'user:servers:manage',
  
  // サーバー管理権限
  SERVER_ADMIN: 'server:admin',
  SERVER_TEMPLATE_MANAGE: 'server:templates:manage',
  SERVER_INSTANCE_VIEW: 'server:instances:view',
  
  // リソースアクセス権限
  RESOURCE_READ: 'resource:read',
  RESOURCE_WRITE: 'resource:write',
  RESOURCE_DELETE: 'resource:delete'
} as const;

export interface Role {
  id: string;
  name: string;
  permissions: string[];
  isSystemRole: boolean;
}

export const ROLES = {
  SYSTEM_ADMIN: {
    id: 'system_admin',
    name: 'System Administrator',
    permissions: ['*'],
    isSystemRole: true
  },
  USER: {
    id: 'user',
    name: 'Regular User',
    permissions: [
      PERMISSIONS.USER_CONFIG_READ,
      PERMISSIONS.USER_CONFIG_WRITE,
      PERMISSIONS.USER_SERVERS_MANAGE,
      PERMISSIONS.RESOURCE_READ,
      PERMISSIONS.RESOURCE_WRITE
    ],
    isSystemRole: true
  },
  POWER_USER: {
    id: 'power_user',
    name: 'Power User',
    permissions: [
      ...ROLES.USER.permissions,
      PERMISSIONS.SERVER_INSTANCE_VIEW,
      PERMISSIONS.RESOURCE_DELETE
    ],
    isSystemRole: true
  }
};
```

#### 2. 権限チェックミドルウェア
```typescript
// src/auth/permissions/permission-manager.ts
export class PermissionManager {
  async checkPermission(
    user: AuthenticatedUser,
    permission: string,
    resource?: any
  ): Promise<boolean> {
    // ユーザーのロールから権限を確認
    const userRoles = await this.getUserRoles(user.id);
    
    for (const role of userRoles) {
      if (await this.roleHasPermission(role, permission, resource)) {
        return true;
      }
    }
    
    return false;
  }
  
  async checkResourceAccess(
    user: AuthenticatedUser,
    action: string,
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
    // リソース固有のアクセス制御
    switch (resourceType) {
      case 'user_config':
        // ユーザーは自分の設定のみアクセス可能
        return resourceId === user.id || this.isAdmin(user);
      
      case 'server_instance':
        // ユーザーは自分のインスタンスのみアクセス可能
        const instance = await this.getServerInstance(resourceId);
        return instance.userId === user.id || this.isAdmin(user);
      
      default:
        return false;
    }
  }
}

// 権限チェックミドルウェア
export const requirePermission = (permission: string) => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = req.user as AuthenticatedUser;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const hasPermission = await permissionManager.checkPermission(user, permission);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};
```

### API エンドポイント設計

#### 1. ユーザー設定API
```typescript
// src/routes/user-config.ts
const router = express.Router();

// ユーザーの設定テンプレート一覧取得
router.get('/templates', 
  requireAuth,
  requirePermission(PERMISSIONS.USER_CONFIG_READ),
  async (req, res) => {
    const user = req.user as AuthenticatedUser;
    const templates = await userConfigManager.getAvailableTemplates(user);
    res.json({ templates });
  }
);

// ユーザーの現在設定取得
router.get('/settings',
  requireAuth,
  requirePermission(PERMISSIONS.USER_CONFIG_READ),
  async (req, res) => {
    const user = req.user as AuthenticatedUser;
    const settings = await userConfigManager.getUserSettings(user.id);
    res.json({ settings });
  }
);

// ユーザー設定更新
router.put('/settings',
  requireAuth,
  requirePermission(PERMISSIONS.USER_CONFIG_WRITE),
  async (req, res) => {
    const user = req.user as AuthenticatedUser;
    const { settings } = req.body;
    
    // 設定検証
    const validationResult = await configValidator.validateUserSettings(
      settings, 
      user
    );
    
    if (!validationResult.valid) {
      return res.status(400).json({ 
        error: 'Invalid settings',
        details: validationResult.errors
      });
    }
    
    await userConfigManager.updateUserSettings(user.id, settings);
    res.json({ success: true });
  }
);

// サーバー有効/無効切り替え
router.post('/servers/:serverId/toggle',
  requireAuth,
  requirePermission(PERMISSIONS.USER_SERVERS_MANAGE),
  async (req, res) => {
    const user = req.user as AuthenticatedUser;
    const { serverId } = req.params;
    const { enabled } = req.body;
    
    await userConfigManager.toggleServerForUser(user.id, serverId, enabled);
    res.json({ success: true });
  }
);
```

#### 2. 管理者設定API
```typescript
// src/routes/admin-config.ts
const router = express.Router();

// サーバーテンプレート管理
router.get('/server-templates',
  requireAuth,
  requirePermission(PERMISSIONS.SERVER_TEMPLATE_MANAGE),
  async (req, res) => {
    const templates = await adminConfigManager.getServerTemplates();
    res.json({ templates });
  }
);

router.post('/server-templates',
  requireAuth,
  requirePermission(PERMISSIONS.SERVER_TEMPLATE_MANAGE),
  async (req, res) => {
    const { template } = req.body;
    
    const validationResult = await configValidator.validateServerTemplate(template);
    if (!validationResult.valid) {
      return res.status(400).json({ 
        error: 'Invalid template',
        details: validationResult.errors
      });
    }
    
    const createdTemplate = await adminConfigManager.createServerTemplate(template);
    res.json({ template: createdTemplate });
  }
);

// ユーザー設定監視・制御
router.get('/users/:userId/settings',
  requireAuth,
  requirePermission(PERMISSIONS.USER_MANAGEMENT),
  async (req, res) => {
    const { userId } = req.params;
    const settings = await userConfigManager.getUserSettings(userId);
    res.json({ settings });
  }
);
```

### Frontend (React UI) 拡張

#### 1. ユーザー設定画面
```typescript
// user-ui/src/pages/MySettings.tsx
export const MySettings = () => {
  const [templates, setTemplates] = useState<ServerTemplate[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const [templatesRes, settingsRes] = await Promise.all([
        api.getUserTemplates(),
        api.getUserSettings()
      ]);
      
      setTemplates(templatesRes.templates);
      setUserSettings(settingsRes.settings);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = async (
    serverId: string, 
    key: string, 
    value: any
  ) => {
    try {
      const updatedSettings = {
        ...userSettings,
        serverSettings: {
          ...userSettings.serverSettings,
          [serverId]: {
            ...userSettings.serverSettings[serverId],
            customization: {
              ...userSettings.serverSettings[serverId]?.customization,
              [key]: value
            }
          }
        }
      };
      
      await api.updateUserSettings(updatedSettings);
      setUserSettings(updatedSettings);
      toast.success('Settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const handleServerToggle = async (serverId: string, enabled: boolean) => {
    try {
      await api.toggleServer(serverId, enabled);
      setUserSettings(prev => ({
        ...prev,
        serverSettings: {
          ...prev.serverSettings,
          [serverId]: {
            ...prev.serverSettings[serverId],
            enabled
          }
        }
      }));
      toast.success(`Server ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to toggle server');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">My Settings</h1>
      
      {templates.map(template => (
        <ServerSettingsCard
          key={template.id}
          template={template}
          userSettings={userSettings.serverSettings[template.id]}
          onSettingChange={(key, value) => 
            handleSettingChange(template.id, key, value)
          }
          onToggle={(enabled) => 
            handleServerToggle(template.id, enabled)
          }
        />
      ))}
    </div>
  );
};

// コンポーネント例
const ServerSettingsCard = ({ 
  template, 
  userSettings, 
  onSettingChange, 
  onToggle 
}) => {
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">{template.name}</h3>
          <Switch
            checked={userSettings?.enabled ?? template.userCustomizable.enabled.default}
            onCheckedChange={onToggle}
          />
        </div>
        <p className="text-gray-600">{template.description}</p>
      </CardHeader>
      
      <CardContent>
        {Object.entries(template.userCustomizable).map(([key, config]) => (
          <div key={key} className="mb-4">
            <label className="block text-sm font-medium mb-2">
              {config.description}
            </label>
            
            {config.type === 'boolean' && (
              <Switch
                checked={userSettings?.customization?.[key] ?? config.default}
                onCheckedChange={(value) => onSettingChange(key, value)}
              />
            )}
            
            {config.type === 'integer' && (
              <input
                type="number"
                min={config.min}
                max={config.max}
                value={userSettings?.customization?.[key] ?? config.default}
                onChange={(e) => onSettingChange(key, parseInt(e.target.value))}
                className="w-full px-3 py-2 border rounded-md"
              />
            )}
            
            {config.type === 'enum' && (
              <select
                value={userSettings?.customization?.[key] ?? config.default}
                onChange={(e) => onSettingChange(key, e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                {config.values.map(value => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            )}
            
            {config.type === 'path' && (
              <input
                type="text"
                value={userSettings?.customization?.[key] ?? config.default}
                onChange={(e) => onSettingChange(key, e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder={config.default}
              />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
```

### セキュリティ考慮事項

#### 1. 設定検証
```typescript
export class ConfigValidator {
  async validateUserSettings(
    settings: UserSettings,
    user: AuthenticatedUser
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    
    for (const [serverId, serverSettings] of Object.entries(settings.serverSettings)) {
      const template = await this.getServerTemplate(serverId);
      
      // ユーザーがカスタマイズ可能な項目のみ許可
      for (const [key, value] of Object.entries(serverSettings.customization || {})) {
        if (!template.userCustomizable[key]) {
          errors.push(`Setting '${key}' is not customizable for server '${serverId}'`);
          continue;
        }
        
        const config = template.userCustomizable[key];
        
        // 型検証
        if (!this.validateType(value, config)) {
          errors.push(`Invalid type for '${key}' in server '${serverId}'`);
        }
        
        // 範囲検証
        if (!this.validateRange(value, config)) {
          errors.push(`Value out of range for '${key}' in server '${serverId}'`);
        }
        
        // パス検証（セキュリティ）
        if (config.type === 'path' && !this.validatePath(value, config, user)) {
          errors.push(`Invalid path for '${key}' in server '${serverId}'`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private validatePath(
    path: string, 
    config: any, 
    user: AuthenticatedUser
  ): boolean {
    // パストラバーサル攻撃防止
    if (path.includes('..')) return false;
    
    // 許可されたパターンチェック
    const allowedPatterns = config.allowedPatterns || [];
    const resolvedPatterns = allowedPatterns.map(pattern =>
      pattern.replace('{userId}', user.id)
    );
    
    return resolvedPatterns.some(pattern => {
      const regex = new RegExp(pattern.replace('**', '.*'));
      return regex.test(path);
    });
  }
}
```

### データベース・永続化

#### 1. ユーザー設定スキーマ
```sql
-- ユーザー設定テーブル
CREATE TABLE user_settings (
  user_id VARCHAR(255) PRIMARY KEY,
  settings_json TEXT NOT NULL,  -- 暗号化されたJSON
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1     -- 設定バージョン管理
);

-- サーバーテンプレートテーブル
CREATE TABLE server_templates (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_json TEXT NOT NULL,  -- テンプレート定義
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- ユーザー・サーバー関連テーブル
CREATE TABLE user_server_access (
  user_id VARCHAR(255),
  server_id VARCHAR(255),
  enabled BOOLEAN DEFAULT TRUE,
  custom_settings_json TEXT,    -- ユーザー固有の設定オーバーライド
  last_accessed TIMESTAMP,
  PRIMARY KEY (user_id, server_id)
);
```

#### 2. 設定暗号化
```typescript
// src/storage/settings-encryption.ts
export class SettingsEncryption {
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.SETTINGS_ENCRYPTION_KEY || 
      this.generateKey();
  }

  async encryptSettings(settings: UserSettings): Promise<string> {
    const plaintext = JSON.stringify(settings);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  async decryptSettings(encryptedSettings: string): Promise<UserSettings> {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedSettings, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }
}
```

---

**この設計により、エンタープライズレベルのユーザー設定カスタマイズ機能が実現できます！確かに複雑になりますが、真のマルチテナント環境では必須の機能ですね。** 🎯

特に重要なポイント：
1. **管理者とユーザーの権限分離**
2. **設定テンプレートによる柔軟性と制御**
3. **セキュリティ検証の多層化**
4. **UI/UXの分離（Admin UI vs User UI）**

このレベルの機能があれば、企業環境での本格的な利用が可能になります！ 🚀
