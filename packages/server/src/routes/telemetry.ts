import type { FastifyInstance } from 'fastify'
import type { Database } from '../db.ts'

interface TelemetryEvent {
  screenId: string
  versionId?: string
  event: string
  properties?: Record<string, unknown>
}

/**
 * テレメトリ収集と対応率の集計 (SU-0004 Detailed design 項目5、docs/architecture.md §8)。
 *
 * `spectre.node.unknown` を集計することで「このコンポーネントを使うと現在の
 * ユーザの何%で劣化するか」が実測できる、というのが設計の狙い — この集計が
 * エディタへ還流して初めて前方互換戦略が運用可能になる (未実装のエディタ側は
 * SU-0003 が持つ)。
 */
export function registerTelemetryRoutes(app: FastifyInstance, db: Database): void {
  app.post<{ Body: TelemetryEvent[] }>('/api/telemetry', async (request, reply) => {
    const events = request.body
    if (!Array.isArray(events) || events.length === 0) {
      return reply.code(400).send({ error: 'events は空でない配列である必要があります' })
    }
    if (events.length > 500) {
      return reply.code(413).send({ error: '1リクエストにつき最大500件です' })
    }

    const client = await db.connect()
    try {
      await client.query('BEGIN')
      let accepted = 0
      for (const event of events) {
        if (!event.screenId || !event.event) continue
        // 1件ずつ SAVEPOINT で区切る。テレメトリはロスを許容するベストエフォートの
        // データなので (docs/architecture.md §8)、不正な versionId を持つ1件のために
        // バッチ全体をロールバックさせない。
        await client.query('SAVEPOINT telemetry_event')
        try {
          await client.query(
            `INSERT INTO telemetry_events (screen_id, version_id, event, properties)
             VALUES ($1, $2, $3, $4)`,
            [event.screenId, event.versionId ?? null, event.event, JSON.stringify(event.properties ?? {})],
          )
          await client.query('RELEASE SAVEPOINT telemetry_event')
          accepted++
        } catch {
          await client.query('ROLLBACK TO SAVEPOINT telemetry_event')
        }
      }
      await client.query('COMMIT')
      return reply.code(202).send({ accepted })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })

  app.get<{ Params: { screenId: string } }>('/api/screens/:screenId/adoption', async (request, reply) => {
    const counts = await db.query<{ event: string; count: string }>(
      `SELECT event, count(*) FROM telemetry_events WHERE screen_id = $1 GROUP BY event`,
      [request.params.screenId],
    )
    const byEvent = Object.fromEntries(counts.rows.map((r) => [r.event, Number(r.count)]))
    const loaded = byEvent['spectre.document.loaded'] ?? 0
    const degraded = byEvent['spectre.node.unknown'] ?? 0

    const byNodeType = await db.query<{ node_type: string; count: string }>(
      `SELECT properties->>'nodeType' AS node_type, count(*)
       FROM telemetry_events
       WHERE screen_id = $1 AND event = 'spectre.node.unknown'
       GROUP BY properties->>'nodeType'`,
      [request.params.screenId],
    )

    return reply.send({
      screenId: request.params.screenId,
      eventCounts: byEvent,
      // loaded が 0 のときの「対応率」は定義できない (分母がない) ので null。
      degradationRate: loaded > 0 ? degraded / loaded : null,
      degradationsByNodeType: Object.fromEntries(byNodeType.rows.map((r) => [r.node_type, Number(r.count)])),
    })
  })
}
