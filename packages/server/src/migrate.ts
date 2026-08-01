import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.ts'
import { createPool, type Database } from './db.ts'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = resolve(here, '../migrations')

/**
 * 手書きの migrations/*.sql を、まだ当たっていないものだけ順番に流す簡易ランナー。
 *
 * node-pg-migrate のようなフレームワークを入れない代わりに、schema_migrations に
 * 適用済みファイル名を記録するだけの最小実装にしている — マイグレーションの本数が
 * 少ないうちは、フレームワークの学習・依存コストのほうが上回る。
 */
export async function runMigrations(db: Database): Promise<string[]> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `)

  const applied = new Set(
    (await db.query<{ filename: string }>('SELECT filename FROM schema_migrations')).rows.map(
      (r) => r.filename,
    ),
  )

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const newlyApplied: string[] = []
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8')
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
      await client.query('COMMIT')
      newlyApplied.push(file)
    } catch (error) {
      await client.query('ROLLBACK')
      throw new Error(`migration ${file} failed: ${(error as Error).message}`, { cause: error })
    } finally {
      client.release()
    }
  }
  return newlyApplied
}

async function main() {
  const config = loadConfig()
  const db = createPool(config.databaseUrl)
  try {
    const applied = await runMigrations(db)
    if (applied.length === 0) {
      console.log('マイグレーションは最新です。')
    } else {
      for (const file of applied) console.log(`  適用しました  ${file}`)
    }
  } finally {
    await db.end()
  }
}

// tsx で直接実行されたときだけ走らせる (テストからは runMigrations を直接呼ぶ)。
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
