# MCP サーバーリトライメカニズム仕様

## 目的
MCPサーバー接続の安定性を高め、一時的な障害からの自動復旧機能を提供する。

## 機能要件

### 1. 自動リトライ機能
- サーバー接続失敗時に自動的にリトライを行う
- 設定可能なリトライ間隔と最大リトライ回数
- リトライ中のステータス追跡と管理

### 2. 条件付きリトライ
- ツール呼び出しが試行された場合は、最大リトライ回数に達していても再度リトライを行う
- 任意のタイミングでユーザーがリトライを強制できる機能

### 3. サーバーステータス管理
- 各サーバーの現在のステータス追跡（接続済み、切断、リトライ中、障害）
- サーバー一覧エンドポイントでステータス情報を返す
- リトライ回数、最終接続試行時間などの詳細情報の提供

### 4. リトライ強制機能
- リトライ停止中のサーバーに対して強制的にリトライを実行するAPIエンドポイント
- サーバーIDを指定して特定のサーバーだけリトライさせる機能

## 技術的仕様

### サーバーステータス定義
```typescript
enum MCPServerStatus {
  CONNECTED = 'connected',      // 接続済み
  DISCONNECTED = 'disconnected',// 切断状態
  CONNECTING = 'connecting',    // 接続試行中
  RETRYING = 'retrying',        // リトライ中
  FAILED = 'failed'             // 最大リトライ回数に達し失敗
}
```

### サーバーステータス追跡
```typescript
interface MCPServerStatusInfo {
  status: MCPServerStatus;      // 現在のステータス
  retryCount: number;           // 現在のリトライ回数
  maxRetries: number;           // 設定された最大リトライ回数
  lastRetryTime: Date | null;   // 最後にリトライした時間
  errorMessage: string | null;  // 最新のエラーメッセージ
}
```

### APIエンドポイント
1. **サーバー一覧（拡張）**:
   - `GET /mcp/servers` - 各サーバーの現在のステータス情報を含めて返す

2. **リトライ強制**:
   - `POST /mcp/servers/:serverId/retry` - 指定したサーバーのリトライを強制実行
   - `POST /mcp/servers/retry-all` - すべての失敗しているサーバーのリトライを強制実行

3. **ツール向けMCPエンドポイント**:
   - `retry_server` - リトライを強制実行するためのツール
   - `get_server_status` - サーバーの詳細なステータスを取得するツール

## 実装計画
1. MCPServerStatus列挙型とMCPServerStatusInfoインターフェースの定義
2. MCPBridgeManagerにステータス追跡機能を追加
3. 自動リトライロジックの実装
4. ツール呼び出し時のリトライロジック実装
5. 拡張されたサーバー一覧エンドポイントの実装
6. リトライ強制APIエンドポイントの実装
7. 対応するツールの実装
8. テストとデバッグ
