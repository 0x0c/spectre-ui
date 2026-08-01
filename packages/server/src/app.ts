import Fastify, { type FastifyInstance, type FastifyError } from 'fastify'
import type { Database } from './db.ts'
import type { ServerConfig } from './config.ts'
import { registerAuthoringRoutes } from './routes/authoring.ts'
import { registerDeliveryRoutes } from './routes/delivery.ts'
import { registerTelemetryRoutes } from './routes/telemetry.ts'

/**
 * Fastify アプリの組み立て。ポートを bind しないので、テストは
 * `app.inject()` で直接リクエストを投げられる。
 *
 * オーサリング面と配信面は同一コードベースだが別デプロイ、という ADR-0007 の方針は
 * ここでは1プロセスにまとめている — 「別デプロイにできる」ことは、ルーティングを
 * このモジュールのように分けておけば足りる。実際に分けて動かすかはデプロイ時の
 * 判断で、コード上の制約にはしない。
 */
export function buildApp(db: Database, config: ServerConfig): FastifyInstance {
  const app = Fastify({ logger: true })

  // ハンドラが投げっぱなしにした例外 (DB制約違反や不正な入力の型エラーなど) は、
  // デフォルトのままだと Postgres/Node の生メッセージがそのままクライアントへ
  // 漏れる。4xx 相当 (Fastify 自身が付けた statusCode を含む) はメッセージごと
  // 返すが、5xx は詳細をログへ落として汎用メッセージだけを返す。
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error)
    const statusCode = typeof error.statusCode === 'number' && error.statusCode < 500 ? error.statusCode : 500
    if (statusCode < 500) {
      return reply.code(statusCode).send({ error: error.message })
    }
    return reply.code(500).send({ error: '内部エラーが発生しました' })
  })

  app.get('/healthz', async () => ({ ok: true }))

  registerAuthoringRoutes(app, db, config)
  registerDeliveryRoutes(app, db)
  registerTelemetryRoutes(app, db)

  return app
}
