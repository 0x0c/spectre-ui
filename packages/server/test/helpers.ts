import { createPool, type Database } from '../src/db.ts'
import { runMigrations } from '../src/migrate.ts'
import { buildApp } from '../src/app.ts'
import { loadConfig } from '../src/config.ts'
import type { FastifyInstance } from 'fastify'

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://spectre:spectre@localhost:5432/spectre_test'

let sharedDb: Database | undefined

export function testDb(): Database {
  sharedDb ??= createPool(TEST_DATABASE_URL)
  return sharedDb
}

export async function setupTestApp(): Promise<{ app: FastifyInstance; db: Database }> {
  const db = testDb()
  await runMigrations(db)
  await truncateAll(db)
  const config = loadConfig({ ...process.env, REQUIRE_APPROVAL_FOR_PRODUCTION: 'true' })
  const app = buildApp(db, config)
  return { app, db }
}

export async function truncateAll(db: Database): Promise<void> {
  await db.query(
    `TRUNCATE audit_log, telemetry_events, releases, document_versions, documents RESTART IDENTITY CASCADE`,
  )
}
