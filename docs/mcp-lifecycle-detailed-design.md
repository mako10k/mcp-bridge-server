# MCP サーバー ライフサイクル管理 - 実装詳細

## 🎯 概要
認証機能と統合して、MCPサーバーをユーザー・セッション別に動的に管理する機能の実装詳細。

## 📁 ファイル構造

```
src/
├── mcp/
│   ├── lifecycle/
│   │   ├── types.ts                     # 型定義
│   │   ├── mcp-lifecycle-manager.ts     # メインマネージャー
│   │   ├── global-instance-manager.ts   # グローバル管理
│   │   ├── user-instance-manager.ts     # ユーザー別管理
│   │   ├── session-instance-manager.ts  # セッション別管理
│   │   └── instance-cleanup.ts          # クリーンアップ処理
│   ├── templates/
│   │   ├── path-template-resolver.ts    # パステンプレート
│   │   └── security-validator.ts        # セキュリティ検証
│   └── monitoring/
│       ├── instance-metrics.ts          # メトリクス収集
│       └── resource-monitor.ts          # リソース監視
```

## 🔧 核心実装

### 1. 型定義 (`src/mcp/lifecycle/types.ts`)

```typescript
export type LifecycleMode = 'global' | 'user' | 'session';

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  lifecycle: LifecycleMode;
  requireAuth: boolean;
  pathTemplates?: Record<string, string>;
  env?: Record<string, string>;
  resourceLimits?: {
    maxMemoryMB?: number;
    maxCpuPercent?: number;
    timeoutMinutes?: number;
  };
}

export interface MCPInstanceContext {
  lifecycleMode: LifecycleMode;
  userId?: string;
  userEmail?: string;
  sessionId?: string;
  authInfo?: AuthenticatedUser;
  requestId: string;
  timestamp: Date;
}

export interface MCPServerInstance {
  id: string;
  serverId: string;
  config: MCPServerConfig;
  context: MCPInstanceContext;
  process: ChildProcess;
  client: MCPClient;
  createdAt: Date;
  lastAccessed: Date;
  requestCount: number;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
}

export interface InstanceKey {
  serverId: string;
  lifecycleMode: LifecycleMode;
  userId?: string;
  sessionId?: string;
}
```

### 2. メインマネージャー (`src/mcp/lifecycle/mcp-lifecycle-manager.ts`)

```typescript
import { EventEmitter } from 'events';

export class MCPLifecycleManager extends EventEmitter {
  private globalManager: GlobalInstanceManager;
  private userManager: UserInstanceManager;
  private sessionManager: SessionInstanceManager;
  private templateResolver: PathTemplateResolver;
  private securityValidator: SecurityValidator;
  private instanceMetrics: InstanceMetrics;

  constructor() {
    super();
    this.globalManager = new GlobalInstanceManager();
    this.userManager = new UserInstanceManager();
    this.sessionManager = new SessionInstanceManager();
    this.templateResolver = new PathTemplateResolver();
    this.securityValidator = new SecurityValidator();
    this.instanceMetrics = new InstanceMetrics();
  }

  async getOrCreateInstance(
    config: MCPServerConfig,
    context: MCPInstanceContext
  ): Promise<MCPServerInstance> {
    // セキュリティ検証
    await this.securityValidator.validateConfig(config, context);
    
    // テンプレート解決
    const resolvedConfig = await this.templateResolver.resolve(config, context);
    
    // ライフサイクルモード別の処理
    switch (context.lifecycleMode) {
      case 'global':
        return this.globalManager.getOrCreateInstance(resolvedConfig, context);
      case 'user':
        if (!context.userId) throw new Error('User ID required for user lifecycle');
        return this.userManager.getOrCreateInstance(resolvedConfig, context);
      case 'session':
        if (!context.sessionId) throw new Error('Session ID required for session lifecycle');
        return this.sessionManager.getOrCreateInstance(resolvedConfig, context);
      default:
        throw new Error(`Unsupported lifecycle mode: ${context.lifecycleMode}`);
    }
  }

  async terminateInstance(instanceId: string): Promise<void> {
    // 全マネージャーから検索して削除
    for (const manager of [this.globalManager, this.userManager, this.sessionManager]) {
      if (await manager.hasInstance(instanceId)) {
        await manager.terminateInstance(instanceId);
        break;
      }
    }
  }

  async terminateUserInstances(userId: string): Promise<void> {
    await this.userManager.terminateUserInstances(userId);
    // セッションマネージャーからも該当ユーザーのセッション削除
    await this.sessionManager.terminateUserSessions(userId);
  }

  async terminateSessionInstances(sessionId: string): Promise<void> {
    await this.sessionManager.terminateSessionInstances(sessionId);
  }

  async listActiveInstances(): Promise<MCPInstanceInfo[]> {
    const instances = await Promise.all([
      this.globalManager.listInstances(),
      this.userManager.listInstances(),
      this.sessionManager.listInstances()
    ]);
    
    return instances.flat();
  }

  async getInstanceMetrics(): Promise<Record<string, any>> {
    return this.instanceMetrics.getAggregatedMetrics();
  }
}
```

### 3. パステンプレート解決 (`src/mcp/templates/path-template-resolver.ts`)

```typescript
export class PathTemplateResolver {
  private securityValidator: SecurityValidator;

  constructor() {
    this.securityValidator = new SecurityValidator();
  }

  async resolve(
    config: MCPServerConfig, 
    context: MCPInstanceContext
  ): Promise<MCPServerConfig> {
    const resolvedConfig = { ...config };
    
    // 引数のテンプレート解決
    resolvedConfig.args = config.args.map(arg => 
      this.resolveTemplate(arg, context)
    );
    
    // 環境変数のテンプレート解決
    if (config.env) {
      resolvedConfig.env = {};
      for (const [key, value] of Object.entries(config.env)) {
        resolvedConfig.env[key] = this.resolveTemplate(value, context);
      }
    }
    
    // セキュリティ検証
    await this.securityValidator.validateResolvedPaths(resolvedConfig);
    
    return resolvedConfig;
  }

  private resolveTemplate(template: string, context: MCPInstanceContext): string {
    return template
      .replace(/{userId}/g, this.sanitize(context.userId || 'anonymous'))
      .replace(/{userEmail}/g, this.sanitize(context.userEmail || 'anonymous'))
      .replace(/{sessionId}/g, this.sanitize(context.sessionId || 'default'))
      .replace(/{timestamp}/g, context.timestamp.getTime().toString())
      .replace(/{requestId}/g, this.sanitize(context.requestId));
  }

  private sanitize(value: string): string {
    // ディレクトリトラバーサル攻撃防止
    return value
      .replace(/\.\./g, '')           // ../ 除去
      .replace(/[<>:"|?*]/g, '')      // 危険な文字除去
      .replace(/[\/\\]/g, '_')        // スラッシュをアンダースコアに
      .substring(0, 100);             // 長さ制限
  }
}
```

### 4. ユーザー別インスタンス管理 (`src/mcp/lifecycle/user-instance-manager.ts`)

```typescript
export class UserInstanceManager {
  private userInstances: Map<string, Map<string, MCPServerInstance>> = new Map();
  private resourceLimits: ResourceLimits;

  constructor(resourceLimits?: ResourceLimits) {
    this.resourceLimits = resourceLimits || {
      maxInstancesPerUser: 10,
      maxTotalInstances: 100,
      instanceTimeoutMinutes: 60
    };
  }

  async getOrCreateInstance(
    config: MCPServerConfig,
    context: MCPInstanceContext
  ): Promise<MCPServerInstance> {
    const userId = context.userId!;
    const instanceKey = this.getInstanceKey(config.name, userId);
    
    // リソース制限チェック
    await this.checkResourceLimits(userId);
    
    // 既存インスタンス確認
    if (this.userInstances.has(userId)) {
      const userMap = this.userInstances.get(userId)!;
      if (userMap.has(instanceKey)) {
        const instance = userMap.get(instanceKey)!;
        instance.lastAccessed = new Date();
        instance.requestCount++;
        return instance;
      }
    }
    
    // 新規インスタンス作成
    const instance = await this.createInstance(config, context);
    
    // マップに登録
    if (!this.userInstances.has(userId)) {
      this.userInstances.set(userId, new Map());
    }
    this.userInstances.get(userId)!.set(instanceKey, instance);
    
    // タイムアウト設定
    this.setInstanceTimeout(instance);
    
    return instance;
  }

  private async checkResourceLimits(userId: string): Promise<void> {
    const userMap = this.userInstances.get(userId);
    if (userMap && userMap.size >= this.resourceLimits.maxInstancesPerUser) {
      // 最も古いインスタンスを削除
      await this.cleanupOldestInstance(userId);
    }
    
    const totalInstances = Array.from(this.userInstances.values())
      .reduce((sum, map) => sum + map.size, 0);
    
    if (totalInstances >= this.resourceLimits.maxTotalInstances) {
      throw new Error('Maximum number of total instances reached');
    }
  }

  private async createInstance(
    config: MCPServerConfig,
    context: MCPInstanceContext
  ): Promise<MCPServerInstance> {
    const instanceId = this.generateInstanceId(config.name, context);
    
    // プロセス起動
    const process = spawn(config.command, config.args, {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // MCPクライアント作成
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args
    });
    
    const client = new Client({
      name: `mcp-bridge-${instanceId}`,
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    await client.connect(transport);
    
    const instance: MCPServerInstance = {
      id: instanceId,
      serverId: config.name,
      config,
      context,
      process,
      client,
      createdAt: new Date(),
      lastAccessed: new Date(),
      requestCount: 1,
      status: 'running'
    };
    
    // プロセス監視
    this.setupProcessMonitoring(instance);
    
    return instance;
  }

  private setInstanceTimeout(instance: MCPServerInstance): void {
    const timeoutMs = this.resourceLimits.instanceTimeoutMinutes * 60 * 1000;
    
    setTimeout(async () => {
      const idleTime = Date.now() - instance.lastAccessed.getTime();
      if (idleTime >= timeoutMs) {
        await this.terminateInstance(instance.id);
      }
    }, timeoutMs);
  }

  async terminateUserInstances(userId: string): Promise<void> {
    const userMap = this.userInstances.get(userId);
    if (userMap) {
      for (const instance of userMap.values()) {
        await this.terminateInstance(instance.id);
      }
      this.userInstances.delete(userId);
    }
  }

  private getInstanceKey(serverId: string, userId: string): string {
    return `${serverId}:${userId}`;
  }

  private generateInstanceId(serverId: string, context: MCPInstanceContext): string {
    return `${serverId}-${context.userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}
```

## 🔒 セキュリティ実装

### セキュリティ検証 (`src/mcp/templates/security-validator.ts`)

```typescript
export class SecurityValidator {
  private allowedPathPatterns: RegExp[] = [
    /^\/tmp\/[a-zA-Z0-9_-]+$/,              // /tmp/safe-paths
    /^\/home\/[a-zA-Z0-9_-]+\/workspace$/,  // user workspaces
    /^\/data\/users\/[a-zA-Z0-9_-]+$/       // user data directories
  ];

  async validateConfig(
    config: MCPServerConfig,
    context: MCPInstanceContext
  ): Promise<void> {
    // 認証要求チェック
    if (config.requireAuth && !context.authInfo) {
      throw new Error('Authentication required for this MCP server');
    }

    // ライフサイクルモード検証
    this.validateLifecycleMode(config, context);

    // コマンド安全性チェック
    this.validateCommand(config.command);

    // 引数の事前検証
    for (const arg of config.args) {
      this.validateArgument(arg);
    }
  }

  async validateResolvedPaths(config: MCPServerConfig): Promise<void> {
    for (const arg of config.args) {
      if (this.isPath(arg)) {
        this.validatePath(arg);
      }
    }
  }

  private validatePath(path: string): void {
    // 絶対パスの安全性チェック
    const normalizedPath = path.normalize();
    
    // パストラバーサル検証
    if (normalizedPath.includes('..')) {
      throw new Error(`Unsafe path detected: ${path}`);
    }
    
    // 許可されたパターンチェック
    const isAllowed = this.allowedPathPatterns.some(pattern => 
      pattern.test(normalizedPath)
    );
    
    if (!isAllowed) {
      throw new Error(`Path not allowed: ${path}`);
    }
  }

  private validateCommand(command: string): void {
    const allowedCommands = ['npx', 'node', 'python', 'python3'];
    const commandBase = command.split(' ')[0];
    
    if (!allowedCommands.includes(commandBase)) {
      throw new Error(`Command not allowed: ${command}`);
    }
  }

  private isPath(arg: string): boolean {
    return arg.startsWith('/') || arg.includes('\\') || arg.includes('./');
  }
}
```

## 📊 監視・メトリクス

### インスタンスメトリクス (`src/mcp/monitoring/instance-metrics.ts`)

```typescript
export class InstanceMetrics {
  private metrics: Map<string, MCPInstanceMetric[]> = new Map();

  recordInstanceAccess(instanceId: string, userId?: string): void {
    const metric: MCPInstanceMetric = {
      instanceId,
      userId,
      timestamp: new Date(),
      type: 'access',
      value: 1
    };
    
    this.addMetric(instanceId, metric);
  }

  recordResourceUsage(instanceId: string, memoryMB: number, cpuPercent: number): void {
    const memoryMetric: MCPInstanceMetric = {
      instanceId,
      timestamp: new Date(),
      type: 'memory',
      value: memoryMB
    };
    
    const cpuMetric: MCPInstanceMetric = {
      instanceId,
      timestamp: new Date(),
      type: 'cpu',
      value: cpuPercent
    };
    
    this.addMetric(instanceId, memoryMetric);
    this.addMetric(instanceId, cpuMetric);
  }

  getInstanceMetrics(instanceId: string): MCPInstanceMetric[] {
    return this.metrics.get(instanceId) || [];
  }

  getAggregatedMetrics(): InstanceSummary {
    const totalInstances = this.metrics.size;
    const totalAccesses = Array.from(this.metrics.values())
      .flat()
      .filter(m => m.type === 'access')
      .length;
    
    return {
      totalInstances,
      totalAccesses,
      activeUsers: this.getUniqueUsers().length,
      averageMemoryUsage: this.calculateAverageMetric('memory'),
      averageCpuUsage: this.calculateAverageMetric('cpu')
    };
  }

  private addMetric(instanceId: string, metric: MCPInstanceMetric): void {
    if (!this.metrics.has(instanceId)) {
      this.metrics.set(instanceId, []);
    }
    
    const instanceMetrics = this.metrics.get(instanceId)!;
    instanceMetrics.push(metric);
    
    // 古いメトリクスの削除（メモリ節約）
    if (instanceMetrics.length > 1000) {
      instanceMetrics.splice(0, 100);
    }
  }
}
```

## 🧪 テスト戦略

### 単体テスト例
```typescript
// tests/mcp/lifecycle/user-instance-manager.test.ts
describe('UserInstanceManager', () => {
  it('should create separate instances for different users', async () => {
    const manager = new UserInstanceManager();
    
    const config = createTestConfig();
    const context1 = createTestContext({ userId: 'user1' });
    const context2 = createTestContext({ userId: 'user2' });
    
    const instance1 = await manager.getOrCreateInstance(config, context1);
    const instance2 = await manager.getOrCreateInstance(config, context2);
    
    expect(instance1.id).not.toBe(instance2.id);
    expect(instance1.context.userId).toBe('user1');
    expect(instance2.context.userId).toBe('user2');
  });
  
  it('should reuse instance for same user', async () => {
    const manager = new UserInstanceManager();
    
    const config = createTestConfig();
    const context = createTestContext({ userId: 'user1' });
    
    const instance1 = await manager.getOrCreateInstance(config, context);
    const instance2 = await manager.getOrCreateInstance(config, context);
    
    expect(instance1.id).toBe(instance2.id);
    expect(instance2.requestCount).toBe(2);
  });
});
```

---

**この詳細設計により、安全で効率的なMCPサーバーライフサイクル管理が実現できます！** 🚀
