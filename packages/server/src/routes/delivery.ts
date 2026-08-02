import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FastifyInstance } from 'fastify'
import { degradeDocumentTree, loadManifest } from '@spectre-ui/manifest'
import type { Database } from '../db.ts'
import { etagOf } from '../checksum.ts'

const here = dirname(fileURLToPath(import.meta.url))
const manifestPath = resolve(here, '../../../../spec/component-manifest.json')
const manifestJson = readFileSync(manifestPath, 'utf8')
const manifestData = JSON.parse(manifestJson) as { schemaVersion: string }
const manifest = loadManifest(manifestPath)

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
 * ケイパビリティネゴシエーション (`Spectre-Schema` / `Spectre-Components` による
 * ツリーの整形、docs/compatibility.md §2、SU-0008 項目2) はここで行う。
 */
export function registerDeliveryRoutes(app: FastifyInstance, db: Database): void {
  app.get<{ Params: { screenId: string }; Querystring: { channel?: string } }>(
    '/screens/:screenId',
    async (request, reply) => {
      const channel = request.query.channel ?? 'production'
      const declared = {
        schemaVersion: request.headers['spectre-schema'] as string | undefined,
        componentsHash: request.headers['spectre-components'] as string | undefined,
      }
      if (declared.schemaVersion || declared.componentsHash) {
        request.log.info({ screenId: request.params.screenId, ...declared }, 'spectre.capabilities.declared')
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

      const shaped = degradeDocumentTree(release.body, manifest, declared)
      // ケイパビリティ込みでハッシュを取る: CDN が新しいクライアント向けの応答を
      // 古いクライアントへ誤って返さないようにするため (docs/compatibility.md §2)。
      const etag = etagOf(`${release.checksum}:${declared.schemaVersion ?? ''}:${declared.componentsHash ?? ''}`)
      reply.header('ETag', etag)
      reply.header('Cache-Control', 'public, max-age=60')
      reply.header('Vary', 'Spectre-Schema, Spectre-Components')

      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).send()
      }
      return reply.send(shaped)
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
