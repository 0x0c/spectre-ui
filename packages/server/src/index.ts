import { loadConfig } from './config.ts'
import { createPool } from './db.ts'
import { runMigrations } from './migrate.ts'
import { buildApp } from './app.ts'

const config = loadConfig()
const db = createPool(config.databaseUrl)
await runMigrations(db)

const app = buildApp(db, config)

app.listen({ port: config.port, host: '0.0.0.0' }, (error) => {
  if (error) {
    app.log.error(error)
    process.exit(1)
  }
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close()
    await db.end()
    process.exit(0)
  })
}
