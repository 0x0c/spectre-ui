import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FastifyInstance } from 'fastify'
import type { Database } from '../db.ts'
import { etagOf } from '../checksum.ts'

const here = dirname(fileURLToPath(import.meta.url))
const manifestJson = readFileSync(resolve(here, '../../../../spec/component-manifest.json'), 'utf8')
const manifestData = JSON.parse(manifestJson) as { schemaVersion: string }

interface ActiveRelease {
  version_id: string
  channel: string
  body: unknown
  checksum: string
}

/**
 * 配信API: 現在の公開版の解決、イミュータブルな配信、クライアント検証用の
 * マニフェスト (SU-0004 Detailed design 項目2、docs/architecture.md §4)。
 *
 * ケイパビリティネゴシエーション (`Spectre-Capabilities` によるツリーの整形) は
 * まだ行わない — SU-0008 が受け持つ。ここではヘッダを読んでテレメトリに残すだけ。
 */
export function registerDeliveryRoutes(app: FastifyInstance, db: Database): void {
  app.get<{ Params: { screenId: string }; Querystring: { channel?: string } }>(
    '/screens/:screenId',
    async (request, reply) => {
      const channel = request.query.channel ?? 'production'
      const capabilities = request.headers['spectre-capabilities']
      if (capabilities) {
        request.log.info({ screenId: request.params.screenId, capabilities }, 'spectre.capabilities.declared')
      }

      const result = await db.query<ActiveRelease>(
        `SELECT r.version_id, r.channel, v.body, v.checksum
         FROM releases r
         JOIN document_versions v ON v.id = r.version_id
         JOIN documents d ON d.id = r.document_id
         WHERE d.screen_id = $1 AND r.channel = $2 AND r.superseded_by IS NULL`,
        [request.params.screenId, channel],
      )
      const release = result.rows[0]
      if (!release) return reply.code(404).send({ error: '公開されているドキュメントがありません' })

      const etag = etagOf(release.checksum)
      reply.header('ETag', etag)
      reply.header('Cache-Control', 'public, max-age=60')

      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).send()
      }
      return reply.send(release.body)
    },
  )

  app.get<{ Params: { documentId: string; versionId: string } }>(
    '/d/:documentId/:versionId',
    async (request, reply) => {
      const result = await db.query<{ body: unknown }>(
        `SELECT body FROM document_versions WHERE document_id = $1 AND id = $2`,
        [request.params.documentId, request.params.versionId],
      )
      if (!result.rows[0]) return reply.code(404).send({ error: 'ドキュメントが見つかりません' })
      // 内容アドレスなので条件付きリクエストは要らない — 中身は絶対に変わらない。
      reply.header('Cache-Control', 'public, max-age=31536000, immutable')
      return reply.send(result.rows[0].body)
    },
  )

  app.get<{ Params: { schemaVersion: string } }>('/manifest/:schemaVersion', async (request, reply) => {
    if (request.params.schemaVersion !== manifestData.schemaVersion) {
      return reply.code(404).send({ error: `schemaVersion "${request.params.schemaVersion}" は提供していません` })
    }
    reply.header('Content-Type', 'application/json')
    reply.header('Cache-Control', 'public, max-age=3600')
    return reply.send(manifestJson)
  })
}
