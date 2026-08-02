import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import {
  loadManifest,
  validateDocument,
  checkResourceLimits,
  hasErrors,
  type ValidationIssue,
} from '@spectre-ui/manifest'
import type { Database } from '../db.ts'
import { checksumOf } from '../checksum.ts'
import type { ServerConfig } from '../config.ts'

const manifest = loadManifest()

interface DocumentRow {
  id: string
  screen_id: string
  name: string
  current_draft_version: number
  created_by: string
  created_at: string
  updated_at: string
}

interface DocumentVersionRow {
  id: string
  document_id: string
  seq: number
  body: unknown
  checksum: string
  author: string
  created_at: string
}

interface ReleaseRow {
  id: string
  document_id: string
  version_id: string
  channel: string
  rollout_percent: number
  targeting: unknown
  published_at: string
  published_by: string
  approved_by: string | null
  superseded_by: string | null
  superseded_at: string | null
}

const CHANNELS = ['internal', 'canary', 'production'] as const
type Channel = (typeof CHANNELS)[number]

function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value)
}

/**
 * オーサリングAPI: 下書きの作成・更新・検証・公開・ロールバック・監査ログ
 * (SU-0004 Detailed design 項目1、docs/architecture.md §4)。
 *
 * 認可はまだない — `actor` はリクエストボディで自己申告する。実運用に入る前に
 * 認証基盤と統合する必要がある (docs/architecture.md §7)。
 */
export function registerAuthoringRoutes(app: FastifyInstance, db: Database, config: ServerConfig): void {
  app.post<{ Body: { screenId: string; name: string; body: unknown; actor: string } }>(
    '/api/documents',
    async (request, reply) => {
      const { screenId, name, body, actor } = request.body
      if (!screenId || !name || !actor || body === undefined) {
        return reply.code(400).send({ error: 'screenId, name, body, actor は必須です' })
      }
      const limitIssues = checkResourceLimits(body)
      if (hasErrors(limitIssues)) {
        return reply.code(422).send({ error: 'ドキュメントの上限を超えています', issues: limitIssues })
      }

      const client = await db.connect()
      try {
        await client.query('BEGIN')
        const doc = await client.query<DocumentRow>(
          `INSERT INTO documents (screen_id, name, current_draft_version, created_by)
           VALUES ($1, $2, 1, $3) RETURNING *`,
          [screenId, name, actor],
        )
        const documentId = doc.rows[0].id
        const version = await client.query<DocumentVersionRow>(
          `INSERT INTO document_versions (document_id, seq, body, checksum, author)
           VALUES ($1, 1, $2, $3, $4) RETURNING *`,
          [documentId, body, checksumOf(body), actor],
        )
        await client.query(
          `INSERT INTO audit_log (actor, action, document_id, version_id, diff)
           VALUES ($1, 'create', $2, $3, $4)`,
          [actor, documentId, version.rows[0].id, JSON.stringify({ screenId, name })],
        )
        await client.query('COMMIT')
        return reply.code(201).send({ document: doc.rows[0], version: version.rows[0] })
      } catch (error) {
        await client.query('ROLLBACK')
        if (isUniqueViolation(error)) {
          return reply.code(409).send({ error: `screenId "${screenId}" は既に使われています` })
        }
        throw error
      } finally {
        client.release()
      }
    },
  )

  app.get('/api/documents', async () => {
    const result = await db.query<DocumentRow>('SELECT * FROM documents ORDER BY created_at DESC')
    return { documents: result.rows }
  })

  app.get<{ Params: { id: string } }>('/api/documents/:id', async (request, reply) => {
    const document = await findDocument(db, request.params.id)
    if (!document) return reply.code(404).send({ error: 'ドキュメントが見つかりません' })

    const releases = await db.query<ReleaseRow>(
      `SELECT * FROM releases WHERE document_id = $1 AND superseded_by IS NULL`,
      [document.id],
    )
    return { document, activeReleases: releases.rows }
  })

  app.get<{ Params: { id: string } }>('/api/documents/:id/versions', async (request, reply) => {
    const document = await findDocument(db, request.params.id)
    if (!document) return reply.code(404).send({ error: 'ドキュメントが見つかりません' })
    const versions = await db.query<DocumentVersionRow>(
      `SELECT id, document_id, seq, checksum, author, created_at FROM document_versions
       WHERE document_id = $1 ORDER BY seq DESC`,
      [document.id],
    )
    return { versions: versions.rows }
  })

  app.get<{ Params: { id: string } }>('/api/documents/:id/audit', async (request, reply) => {
    const document = await findDocument(db, request.params.id)
    if (!document) return reply.code(404).send({ error: 'ドキュメントが見つかりません' })
    const entries = await db.query(
      `SELECT * FROM audit_log WHERE document_id = $1 ORDER BY at DESC`,
      [document.id],
    )
    return { entries: entries.rows }
  })

  app.put<{ Params: { id: string }; Body: { body: unknown; actor: string; expectedVersion: number } }>(
    '/api/documents/:id',
    async (request, reply) => {
      const document = await findDocument(db, request.params.id)
      if (!document) return reply.code(404).send({ error: 'ドキュメントが見つかりません' })

      const { body, actor, expectedVersion } = request.body
      if (!actor || typeof expectedVersion !== 'number' || body === undefined) {
        return reply.code(400).send({ error: 'body, actor, expectedVersion は必須です' })
      }
      const limitIssues = checkResourceLimits(body)
      if (hasErrors(limitIssues)) {
        return reply.code(422).send({ error: 'ドキュメントの上限を超えています', issues: limitIssues })
      }
      // 楽観ロック: 呼び出し元が最後に見ていたバージョンと現在の下書きが
      // 一致しないなら、誰かが先に書き込んでいる。この事前チェックは競合を狭めるだけで
      // 排除はしない — 実際の排他は `document_versions (document_id, seq)` の UNIQUE
      // 制約が担い、その違反を下の catch で 409 に変換する。
      if (expectedVersion !== document.current_draft_version) {
        return reply.code(409).send({
          error: '下書きが他の変更で更新されています',
          currentVersion: document.current_draft_version,
        })
      }

      const client = await db.connect()
      try {
        await client.query('BEGIN')
        const nextSeq = document.current_draft_version + 1
        const version = await client.query<DocumentVersionRow>(
          `INSERT INTO document_versions (document_id, seq, body, checksum, author)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [document.id, nextSeq, body, checksumOf(body), actor],
        )
        await client.query(
          `UPDATE documents SET current_draft_version = $1, updated_at = now() WHERE id = $2`,
          [nextSeq, document.id],
        )
        await client.query(
          `INSERT INTO audit_log (actor, action, document_id, version_id) VALUES ($1, 'update', $2, $3)`,
          [actor, document.id, version.rows[0].id],
        )
        await client.query('COMMIT')
        return reply.send({ version: version.rows[0] })
      } catch (error) {
        await client.query('ROLLBACK')
        if (isUniqueViolation(error)) {
          const fresh = await findDocument(db, document.id)
          return reply.code(409).send({
            error: '下書きが他の変更で更新されています',
            currentVersion: fresh?.current_draft_version ?? document.current_draft_version,
          })
        }
        throw error
      } finally {
        client.release()
      }
    },
  )

  app.post<{ Params: { id: string }; Body: { seq?: number } }>(
    '/api/documents/:id/validate',
    async (request, reply) => {
      const document = await findDocument(db, request.params.id)
      if (!document) return reply.code(404).send({ error: 'ドキュメントが見つかりません' })
      const version = await findVersion(db, document.id, request.body?.seq ?? document.current_draft_version)
      if (!version) return reply.code(404).send({ error: 'バージョンが見つかりません' })

      const issues = validateDocument(version.body, manifest)
      return reply.send({ valid: !hasErrors(issues), issues })
    },
  )

  app.post<{
    Params: { id: string }
    Body: {
      seq: number
      channel: string
      actor: string
      rolloutPercent?: number
      targeting?: unknown
      approvedBy?: string
    }
  }>('/api/documents/:id/publish', async (request, reply) => {
    const document = await findDocument(db, request.params.id)
    if (!document) return reply.code(404).send({ error: 'ドキュメントが見つかりません' })

    const { seq, channel, actor, rolloutPercent = 100, targeting = {}, approvedBy } = request.body
    if (!isChannel(channel)) {
      return reply.code(400).send({ error: `channel は ${CHANNELS.join('/')} のいずれかです` })
    }
    if (!actor) return reply.code(400).send({ error: 'actor は必須です' })
    if (!Number.isInteger(rolloutPercent) || rolloutPercent < 0 || rolloutPercent > 100) {
      return reply.code(400).send({ error: 'rolloutPercent は 0 以上 100 以下の整数です' })
    }

    // 本番チャネルは2人体制を要求する (docs/architecture.md §7)。実運用の承認フローが
    // 実装されるまでの間、承認者がリクエスト元と異なることだけを確認する。
    if (channel === 'production' && config.requireApprovalForProduction) {
      if (!approvedBy || approvedBy === actor) {
        return reply.code(403).send({
          error: '本番チャネルへの公開には actor 以外の approvedBy が必要です',
        })
      }
    }

    const version = await findVersion(db, document.id, seq)
    if (!version) return reply.code(404).send({ error: 'バージョンが見つかりません' })

    const issues = validateDocument(version.body, manifest)
    if (hasErrors(issues)) {
      return reply.code(422).send({ error: '検証に失敗しました', issues })
    }

    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const previous = await client.query<ReleaseRow>(
        `SELECT * FROM releases WHERE document_id = $1 AND channel = $2 AND superseded_by IS NULL FOR UPDATE`,
        [document.id, channel],
      )
      // 新しい行の id を先に決め、古い行の superseded_by を立ててから新しい行を
      // 挿入する。逆順だと、`releases_active_idx` (document_id, channel の部分
      // ユニークインデックス) が同一トランザクション内で一時的に2行を「有効」と
      // 見なして自分自身の INSERT を弾いてしまう。
      const newReleaseId = randomUUID()
      if (previous.rows[0]) {
        await client.query(
          `UPDATE releases SET superseded_by = $1, superseded_at = now() WHERE id = $2`,
          [newReleaseId, previous.rows[0].id],
        )
      }
      const release = await client.query<ReleaseRow>(
        `INSERT INTO releases (id, document_id, version_id, channel, rollout_percent, targeting, published_by, approved_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [newReleaseId, document.id, version.id, channel, rolloutPercent, JSON.stringify(targeting), actor, approvedBy ?? null],
      )
      await client.query(
        `INSERT INTO audit_log (actor, action, document_id, version_id, diff)
         VALUES ($1, 'publish', $2, $3, $4)`,
        [actor, document.id, version.id, JSON.stringify({ channel, rolloutPercent, approvedBy })],
      )
      await client.query('COMMIT')
      return reply.code(201).send({ release: release.rows[0] })
    } catch (error) {
      await client.query('ROLLBACK')
      // `releases_active_idx` (document_id, channel の部分ユニークインデックス) が、
      // 同じチャネルへ競合する公開の一方を弾く。もう一方が先に有効になっているので、
      // 呼び出し元は最新の状態を読み直してやり直す。
      if (isUniqueViolation(error)) {
        return reply.code(409).send({ error: '同じチャネルへの公開が競合しました。やり直してください' })
      }
      throw error
    } finally {
      client.release()
    }
  })

  app.post<{ Params: { id: string }; Body: { channel: string; toReleaseId: string; actor: string } }>(
    '/api/documents/:id/rollback',
    async (request, reply) => {
      const document = await findDocument(db, request.params.id)
      if (!document) return reply.code(404).send({ error: 'ドキュメントが見つかりません' })

      const { channel, toReleaseId, actor } = request.body
      if (!isChannel(channel) || !toReleaseId || !actor) {
        return reply.code(400).send({ error: 'channel, toReleaseId, actor は必須です' })
      }

      const target = await db.query<ReleaseRow>(
        `SELECT * FROM releases WHERE id = $1 AND document_id = $2 AND channel = $3`,
        [toReleaseId, document.id, channel],
      )
      if (!target.rows[0]) return reply.code(404).send({ error: 'ロールバック先のリリースが見つかりません' })

      const client = await db.connect()
      try {
        await client.query('BEGIN')
        const previous = await client.query<ReleaseRow>(
          `SELECT * FROM releases WHERE document_id = $1 AND channel = $2 AND superseded_by IS NULL FOR UPDATE`,
          [document.id, channel],
        )
        // ロールバックはポインタの差し替え — 同じ version_id を指す新しい releases 行を
        // 作るだけで、document_versions の書き換えは起きない (ADR-0007)。id を先に決め、
        // 古い行の superseded_by を立ててから新しい行を挿入する順序は publish と同じ理由
        // (`releases_active_idx` への自己違反を避けるため) で必須。
        const newReleaseId = randomUUID()
        if (previous.rows[0]) {
          await client.query(
            `UPDATE releases SET superseded_by = $1, superseded_at = now() WHERE id = $2`,
            [newReleaseId, previous.rows[0].id],
          )
        }
        const release = await client.query<ReleaseRow>(
          `INSERT INTO releases (id, document_id, version_id, channel, rollout_percent, targeting, published_by)
           VALUES ($1, $2, $3, $4, 100, '{}'::jsonb, $5) RETURNING *`,
          [newReleaseId, document.id, target.rows[0].version_id, channel, actor],
        )
        await client.query(
          `INSERT INTO audit_log (actor, action, document_id, version_id, diff)
           VALUES ($1, 'rollback', $2, $3, $4)`,
          [actor, document.id, target.rows[0].version_id, JSON.stringify({ channel, toReleaseId })],
        )
        await client.query('COMMIT')
        return reply.code(201).send({ release: release.rows[0] })
      } catch (error) {
        await client.query('ROLLBACK')
        if (isUniqueViolation(error)) {
          return reply.code(409).send({ error: '同じチャネルへのロールバックが競合しました。やり直してください' })
        }
        throw error
      } finally {
        client.release()
      }
    },
  )
}

async function findDocument(db: Database, id: string): Promise<DocumentRow | null> {
  const byId = await db.query<DocumentRow>('SELECT * FROM documents WHERE id = $1', [id])
  return byId.rows[0] ?? null
}

async function findVersion(db: Database, documentId: string, seq: number): Promise<DocumentVersionRow | null> {
  const result = await db.query<DocumentVersionRow>(
    'SELECT * FROM document_versions WHERE document_id = $1 AND seq = $2',
    [documentId, seq],
  )
  return result.rows[0] ?? null
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
}

export type { ValidationIssue }
