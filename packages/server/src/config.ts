/** 環境変数からの設定読み込み。デフォルトはローカル開発向け。 */
export interface ServerConfig {
  databaseUrl: string
  port: number
  /**
   * production チャネルへの公開に2人目の承認を要求するか。
   * 実運用の RBAC (誰が承認者になれるか) はまだない — 本番導入までに
   * 認証基盤と統合する必要がある (docs/architecture.md §7 「オーサリング権限の濫用」)。
   */
  requireApprovalForProduction: boolean
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    databaseUrl: env.DATABASE_URL ?? 'postgres://spectre:spectre@localhost:5432/spectre_dev',
    port: env.PORT ? Number(env.PORT) : 3000,
    requireApprovalForProduction: env.REQUIRE_APPROVAL_FOR_PRODUCTION !== 'false',
  }
}
