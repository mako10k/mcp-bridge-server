# 既存コードとの統合ポイント

## 🔄 MCP ライフサイクル機能統合計画

### 現在のアーキテクチャ分析

#### 既存のMCPBridgeManager (`src/mcp-bridge-manager.ts`)
現在の実装では、すべてのMCPサーバーがグローバルインスタンスとして管理されています：

```typescript
// 現在の構造（推測）
class MCPBridgeManager {
  private servers: Map<string, MCPServerConnection>;
  
  async initialize(configPath: string): Promise<void> {
    // 全サーバーを起動時に初期化
  }
  
  async callTool(serverId: string, toolName: string, args: any): Promise<any> {
    // グローバルサーバーインスタンスに対してツール実行
  }
}
```

### 統合戦略

#### Phase 1: 段階的統合
1. **既存機能の保持**: 現在のグローバルモードを維持
2. **新機能の追加**: ライフサイクル管理を並行実装
3. **設定による切り替え**: config設定でモード選択

#### Phase 2: MCPBridgeManagerの拡張

```typescript
// 新しい統合アーキテクチャ
class MCPBridgeManager {
  private globalServers: Map<string, MCPServerConnection>;     // 既存
  private lifecycleManager: MCPLifecycleManager;               // 🆕 新機能
  private authContextManager: AuthContextManager;             // 🆕 新機能

  constructor() {
    this.globalServers = new Map();
    this.lifecycleManager = new MCPLifecycleManager();
    this.authContextManager = new AuthContextManager();
  }

  // 🆕 新しいメソッド：認証コンテキスト付きツール実行
  async callToolWithContext(
    serverId: string, 
    toolName: string, 
    args: any,
    req: express.Request  // 認証情報含む
  ): Promise<any> {
    const serverConfig = this.getServerConfig(serverId);
    
    if (serverConfig.lifecycle === 'global') {
      // 既存のグローバル実行
      return this.callTool(serverId, toolName, args);
    } else {
      // 新しいライフサイクル管理実行
      const context = this.authContextManager.extractContext(req);
      const instance = await this.lifecycleManager.getOrCreateInstance(
        serverConfig, 
        context
      );
      return instance.client.request('tools/call', {
        name: toolName,
        arguments: args
      });
    }
  }

  // 既存メソッドの互換性維持
  async callTool(serverId: string, toolName: string, args: any): Promise<any> {
    // 既存のグローバル実行ロジック（変更なし）
    const server = this.globalServers.get(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }
    return server.callTool(toolName, args);
  }
}
```

### ルートハンドラーの更新

#### 既存のツール実行エンドポイント
```typescript
// src/routes/tools.ts の更新例

// 既存：グローバル実行のみ
export const callToolHandler = (context: ToolRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { serverId } = req.params;
      const { name, arguments: toolArgs } = CallToolSchema.parse(req.body);
      
      const result = await context.mcpManager.callTool(serverId, name, toolArgs);
      res.json({ result });
    } catch (error) {
      // エラーハンドリング
    }
  };

// 🆕 新：ライフサイクル対応
export const callToolHandler = (context: ToolRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { serverId } = req.params;
      const { name, arguments: toolArgs } = CallToolSchema.parse(req.body);
      
      // 🆕 認証コンテキスト付きで実行
      const result = await context.mcpManager.callToolWithContext(
        serverId, 
        name, 
        toolArgs,
        req  // 認証情報・セッション情報含む
      );
      res.json({ result });
    } catch (error) {
      // エラーハンドリング
    }
  };
```

### 設定ファイルの後方互換性

#### 既存設定との互換性維持
```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/tmp"]
      // lifecycle未指定 → 自動的に"global"として扱う
    },
    {
      "name": "user-filesystem", 
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/home/{userId}"],
      "lifecycle": "user",     // 🆕 明示的にユーザー別指定
      "requireAuth": true      // 🆕 認証必須
    }
  ]
}
```

#### 設定移行戦略
1. **デフォルト値**: lifecycle未指定は"global"
2. **段階的移行**: 既存サーバーは変更なし、新サーバーで新機能利用
3. **検証機能**: 設定の整合性チェック（requireAuth + lifeCycle組み合わせ）

### データベース/永続化戦略

#### セッション・インスタンス情報の永続化
```typescript
// 将来的なデータベース統合
interface InstanceStore {
  saveInstanceInfo(instance: MCPServerInstance): Promise<void>;
  getInstanceInfo(instanceId: string): Promise<MCPServerInstance | null>;
  listUserInstances(userId: string): Promise<MCPServerInstance[]>;
  cleanupExpiredInstances(): Promise<void>;
}

// Redis実装例
class RedisInstanceStore implements InstanceStore {
  async saveInstanceInfo(instance: MCPServerInstance): Promise<void> {
    const key = `mcp:instance:${instance.id}`;
    const data = JSON.stringify({
      id: instance.id,
      serverId: instance.serverId,
      userId: instance.context.userId,
      sessionId: instance.context.sessionId,
      createdAt: instance.createdAt,
      lastAccessed: instance.lastAccessed
    });
    
    await this.redis.setex(key, 3600, data); // 1時間のTTL
  }
}
```

### 管理UI（Admin画面）の拡張

#### 新しい管理画面
1. **インスタンス一覧**: 全アクティブインスタンスの表示
2. **ユーザー別表示**: ユーザーごとのインスタンス利用状況
3. **リソース監視**: CPU/メモリ使用量のリアルタイム表示
4. **強制終了機能**: 管理者による手動インスタンス終了

#### React コンポーネント例
```typescript
// admin-ui/src/pages/InstanceManagement.tsx
export const InstanceManagement = () => {
  const [instances, setInstances] = useState<MCPInstanceInfo[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');

  useEffect(() => {
    // インスタンス一覧の取得
    fetchInstances();
  }, [selectedUser]);

  const handleTerminateInstance = async (instanceId: string) => {
    await api.terminateInstance(instanceId);
    fetchInstances(); // リフレッシュ
  };

  return (
    <div>
      <h2>MCP Instance Management</h2>
      <UserSelector value={selectedUser} onChange={setSelectedUser} />
      <InstanceTable 
        instances={instances}
        onTerminate={handleTerminateInstance}
      />
    </div>
  );
};
```

### パフォーマンス考慮事項

#### インスタンス起動の最適化
1. **プリウォーミング**: よく使われるサーバーの事前起動
2. **プール管理**: インスタンスの再利用
3. **非同期起動**: ユーザーを待たせない起動プロセス

#### メモリ使用量の最適化
1. **自動クリーンアップ**: 非アクティブインスタンスの定期削除
2. **リソース監視**: 制限超過時の自動対応
3. **インスタンス共有**: 同一設定の場合の可能な限りの共有

### 移行計画

#### Week 1-2: 基盤実装
- [x] MCPLifecycleManager基本実装
- [x] 既存MCPBridgeManagerとの統合ポイント作成
- [x] 設定ファイル拡張

#### Week 3: 認証統合
- [x] AuthContextManagerとの連携
- [x] ルートハンドラーの更新
- [ ] セキュリティ検証実装

#### Week 4: 管理機能
- [ ] Admin UI拡張
- [ ] 監視・メトリクス実装
- [ ] 自動クリーンアップ機能

#### Week 5: テスト・最適化
- [ ] 包括的テスト実装
- [ ] パフォーマンス最適化
- [ ] ドキュメント整備

---

**この統合計画により、既存機能を壊すことなく、新しいライフサイクル管理機能を安全に導入できます！** 🎯
