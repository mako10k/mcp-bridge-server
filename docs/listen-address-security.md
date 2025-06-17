# Listen Address セキュリティ実装メモ

## 現在の実装状況
現在のindex.tsでは、以下の3箇所でlisten addressが `'127.0.0.1'` (または `::1`) にハードコードされている：

1. `restartServerOnNewPort()` 関数内 (line 69)
2. `startServer()` 関数内 (line 188) 
3. `isPortAvailable()` 関数内 (line 233)

## 実装時の変更点

### 1. 設定管理
```typescript
// src/config/auth-config.ts
export function getSecureListenAddress(
  authConfig: AuthConfig, 
  globalConfig: GlobalConfig
): string {
  if (!authConfig.enabled) {
    logger.warn('Authentication disabled. Forcing localhost-only access for security.');
    return globalConfig.listenAddress === '::1' ? '::1' : '127.0.0.1';
  }
  
  const address = globalConfig.listenAddress || '127.0.0.1';
  if (address !== '127.0.0.1' && address !== '::1') {
    logger.info(`Authentication enabled. Allowing network access on: ${address}`);
  }
  
  return address;
}
```

### 2. index.ts変更箇所
```typescript
// グローバル変数として定義
let currentListenAddress: string = '127.0.0.1';

// 設定読み込み時
currentListenAddress = getSecureListenAddress(authConfig, globalConfig);

// server.listen呼び出し時
server = app.listen(port, currentListenAddress, () => {
  logger.info(`Server running on ${currentListenAddress}:${port}`);
});
```

### 3. セキュリティ警告
- 認証無効 + 外部公開設定時: エラーレベルの警告
- 認証有効 + 外部公開時: 情報レベルのログ
- 設定変更時: セキュリティ監査ログ

### 4. Admin UI対応
- Global Settingsページに Listen Address 設定追加
- 認証無効時は設定欄を無効化
- セキュリティ注意喚起メッセージ表示

## テストケース
1. 認証無効 + listenAddress設定 → localhost強制
2. 認証有効 + デフォルト → localhost
3. 認証有効 + 0.0.0.0設定 → 外部アクセス許可
4. 設定動的変更 → サーバー再起動 + アドレス変更

## セキュリティチェック
- [ ] 認証無効時の外部アクセス遮断確認
- [ ] 設定ファイル検証（無効な組み合わせの拒否）
- [ ] ログ出力の適切性確認
- [ ] Admin UIでの設定制御確認
