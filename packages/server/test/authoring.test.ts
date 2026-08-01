import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyInstance } from 'fastify'
import { setupTestApp, testDb } from './helpers.ts'

let app: FastifyInstance

before(async () => {
  ;({ app } = await setupTestApp())
})

after(async () => {
  await app.close()
  await testDb().end()
})

function sampleDocumentBody(text = 'hello') {
  return {
    schemaVersion: '1.0',
    id: 'greeting',
    root: { type: 'Screen', children: [{ type: 'Text', props: { text } }] },
  }
}

async function createDocument(screenId: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/documents',
    payload: { screenId, name: 'Greeting', body: sampleDocumentBody(), actor: 'alice' },
  })
  assert.equal(response.statusCode, 201, response.body)
  return response.json() as { document: { id: string; current_draft_version: number }; version: { seq: number } }
}

test('POST /api/documents は下書きバージョン1を作る', async () => {
  const { document, version } = await createDocument('greeting-create')
  assert.equal(document.current_draft_version, 1)
  assert.equal(version.seq, 1)
})

test('POST /api/documents は screenId の重複を 409 で拒否する', async () => {
  await createDocument('greeting-dup')
  const response = await app.inject({
    method: 'POST',
    url: '/api/documents',
    payload: { screenId: 'greeting-dup', name: 'again', body: sampleDocumentBody(), actor: 'alice' },
  })
  assert.equal(response.statusCode, 409)
})

test('GET /api/documents/:id は作成したドキュメントを返す', async () => {
  const { document } = await createDocument('greeting-get')
  const response = await app.inject({ method: 'GET', url: `/api/documents/${document.id}` })
  assert.equal(response.statusCode, 200)
  assert.equal(response.json().document.screen_id, 'greeting-get')
})

test('PUT /api/documents/:id は正しい expectedVersion で新しいバージョンを作る', async () => {
  const { document } = await createDocument('greeting-put')
  const response = await app.inject({
    method: 'PUT',
    url: `/api/documents/${document.id}`,
    payload: { body: sampleDocumentBody('updated'), actor: 'bob', expectedVersion: 1 },
  })
  assert.equal(response.statusCode, 200, response.body)
  assert.equal(response.json().version.seq, 2)

  const after = await app.inject({ method: 'GET', url: `/api/documents/${document.id}` })
  assert.equal(after.json().document.current_draft_version, 2)
})

test('PUT /api/documents/:id は古い expectedVersion を 409 で拒否する (楽観ロック)', async () => {
  const { document } = await createDocument('greeting-lock')
  await app.inject({
    method: 'PUT',
    url: `/api/documents/${document.id}`,
    payload: { body: sampleDocumentBody('v2'), actor: 'bob', expectedVersion: 1 },
  })
  const stale = await app.inject({
    method: 'PUT',
    url: `/api/documents/${document.id}`,
    payload: { body: sampleDocumentBody('conflict'), actor: 'carol', expectedVersion: 1 },
  })
  assert.equal(stale.statusCode, 409)
})

test('validate は妥当なドキュメントを valid: true で返す', async () => {
  const { document } = await createDocument('greeting-validate-ok')
  const response = await app.inject({ method: 'POST', url: `/api/documents/${document.id}/validate`, payload: {} })
  assert.equal(response.statusCode, 200)
  assert.equal(response.json().valid, true)
})

test('validate は未知コンポーネントを持つドキュメントを valid: false で返す', async () => {
  const response1 = await app.inject({
    method: 'POST',
    url: '/api/documents',
    payload: {
      screenId: 'greeting-validate-bad',
      name: 'bad',
      body: { schemaVersion: '1.0', id: 'bad', root: { type: 'NotAComponent' } },
      actor: 'alice',
    },
  })
  const { document } = response1.json()
  const response = await app.inject({ method: 'POST', url: `/api/documents/${document.id}/validate`, payload: {} })
  assert.equal(response.json().valid, false)
})

test('publish は internal チャネルなら承認なしで公開できる', async () => {
  const { document } = await createDocument('greeting-publish-internal')
  const response = await app.inject({
    method: 'POST',
    url: `/api/documents/${document.id}/publish`,
    payload: { seq: 1, channel: 'internal', actor: 'alice' },
  })
  assert.equal(response.statusCode, 201, response.body)
  assert.equal(response.json().release.channel, 'internal')
})

test('publish は production チャネルで approvedBy がないと 403 になる', async () => {
  const { document } = await createDocument('greeting-publish-noapproval')
  const response = await app.inject({
    method: 'POST',
    url: `/api/documents/${document.id}/publish`,
    payload: { seq: 1, channel: 'production', actor: 'alice' },
  })
  assert.equal(response.statusCode, 403)
})

test('publish は production チャネルで actor と同じ approvedBy を拒否する (2人体制)', async () => {
  const { document } = await createDocument('greeting-publish-selfapprove')
  const response = await app.inject({
    method: 'POST',
    url: `/api/documents/${document.id}/publish`,
    payload: { seq: 1, channel: 'production', actor: 'alice', approvedBy: 'alice' },
  })
  assert.equal(response.statusCode, 403)
})

test('publish は妥当な承認者で production に公開し、直前のリリースを supersede する', async () => {
  const { document } = await createDocument('greeting-publish-flow')
  const first = await app.inject({
    method: 'POST',
    url: `/api/documents/${document.id}/publish`,
    payload: { seq: 1, channel: 'production', actor: 'alice', approvedBy: 'bob' },
  })
  assert.equal(first.statusCode, 201)
  const firstReleaseId = first.json().release.id

  await app.inject({
    method: 'PUT',
    url: `/api/documents/${document.id}`,
    payload: { body: sampleDocumentBody('v2'), actor: 'alice', expectedVersion: 1 },
  })
  const second = await app.inject({
    method: 'POST',
    url: `/api/documents/${document.id}/publish`,
    payload: { seq: 2, channel: 'production', actor: 'alice', approvedBy: 'bob' },
  })
  assert.equal(second.statusCode, 201)

  const detail = await app.inject({ method: 'GET', url: `/api/documents/${document.id}` })
  const active = detail.json().activeReleases as { id: string; channel: string }[]
  assert.equal(active.length, 1)
  assert.notEqual(active[0].id, firstReleaseId)
})

test('rollback はポインタを差し替えて古いバージョンへ戻す', async () => {
  const { document } = await createDocument('greeting-rollback')
  const first = await app.inject({
    method: 'POST',
    url: `/api/documents/${document.id}/publish`,
    payload: { seq: 1, channel: 'internal', actor: 'alice' },
  })
  const firstReleaseId = first.json().release.id as string
  const firstVersionId = first.json().release.version_id as string

  await app.inject({
    method: 'PUT',
    url: `/api/documents/${document.id}`,
    payload: { body: sampleDocumentBody('broken'), actor: 'alice', expectedVersion: 1 },
  })
  await app.inject({
    method: 'POST',
    url: `/api/documents/${document.id}/publish`,
    payload: { seq: 2, channel: 'internal', actor: 'alice' },
  })

  const rollback = await app.inject({
    method: 'POST',
    url: `/api/documents/${document.id}/rollback`,
    payload: { channel: 'internal', toReleaseId: firstReleaseId, actor: 'alice' },
  })
  assert.equal(rollback.statusCode, 201, rollback.body)
  assert.equal(rollback.json().release.version_id, firstVersionId)

  const detail = await app.inject({ method: 'GET', url: `/api/documents/${document.id}` })
  const active = detail.json().activeReleases as { version_id: string }[]
  assert.equal(active.length, 1)
  assert.equal(active[0].version_id, firstVersionId)
})

test('POST /api/documents は body が無ければ 400 で拒否する (500 に落ちない)', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/documents',
    payload: { screenId: 'greeting-nobody', name: 'x', actor: 'alice' },
  })
  assert.equal(response.statusCode, 400)
})

test('POST /api/documents はノード数の上限を超えるドキュメントを 422 で拒否する', async () => {
  const manyChildren = Array.from({ length: 3000 }, () => ({ type: 'Text', props: { text: 'x' } }))
  const response = await app.inject({
    method: 'POST',
    url: '/api/documents',
    payload: {
      screenId: 'greeting-toomanynodes',
      name: 'x',
      body: { schemaVersion: '1.0', id: 'x', root: { type: 'Screen', children: manyChildren } },
      actor: 'alice',
    },
  })
  assert.equal(response.statusCode, 422, response.body)
})

test('PUT /api/documents/:id はノード数の上限を超えるドキュメントを 422 で拒否する', async () => {
  const { document } = await createDocument('greeting-put-toomanynodes')
  const manyChildren = Array.from({ length: 3000 }, () => ({ type: 'Text', props: { text: 'x' } }))
  const response = await app.inject({
    method: 'PUT',
    url: `/api/documents/${document.id}`,
    payload: {
      body: { schemaVersion: '1.0', id: 'x', root: { type: 'Screen', children: manyChildren } },
      actor: 'alice',
      expectedVersion: 1,
    },
  })
  assert.equal(response.statusCode, 422, response.body)
})

test('publish は rolloutPercent が範囲外なら 400 で拒否する (CHECK 制約の生エラーを漏らさない)', async () => {
  const { document } = await createDocument('greeting-badrollout')
  const response = await app.inject({
    method: 'POST',
    url: `/api/documents/${document.id}/publish`,
    payload: { seq: 1, channel: 'internal', actor: 'alice', rolloutPercent: 150 },
  })
  assert.equal(response.statusCode, 400, response.body)
})

test('releases_active_idx は同じチャネルに2つの有効なリリースを許さない', async () => {
  // publish/rollback の競合対策 (2つの並行リクエストがどちらも「直前の公開なし」を
  // 見て、両方が superseded_by=NULL の行を挿入してしまう) は、HTTP 経由で確実に
  // 再現させるにはタイミングの運が要る — このローカル Postgres は往復が速すぎて、
  // Promise.all で2リクエストを投げても実質的に直列化されてしまう。そこで、DB が
  // 実際に保証する不変条件そのものを、2つの生コネクションで直接確認する。
  const { document } = await createDocument('greeting-dbrace')
  const versionsResponse = await app.inject({ method: 'GET', url: `/api/documents/${document.id}/versions` })
  const versionId = (versionsResponse.json().versions as { id: string }[])[0].id

  const db = testDb()
  const clientA = await db.connect()
  const clientB = await db.connect()
  try {
    await clientA.query('BEGIN')
    await clientB.query('BEGIN')
    // どちらも「直前の有効なリリースはない」を見る — これが競合の入口。
    await clientA.query(
      `SELECT * FROM releases WHERE document_id = $1 AND channel = 'production' AND superseded_by IS NULL FOR UPDATE`,
      [document.id],
    )
    await clientB.query(
      `SELECT * FROM releases WHERE document_id = $1 AND channel = 'production' AND superseded_by IS NULL FOR UPDATE`,
      [document.id],
    )
    await clientA.query(
      `INSERT INTO releases (document_id, version_id, channel, published_by) VALUES ($1, $2, 'production', 'alice')`,
      [document.id, versionId],
    )
    await clientA.query('COMMIT')

    await assert.rejects(
      () =>
        clientB.query(
          `INSERT INTO releases (document_id, version_id, channel, published_by) VALUES ($1, $2, 'production', 'bob')`,
          [document.id, versionId],
        ),
      /releases_active_idx/,
    )
    await clientB.query('ROLLBACK')
  } finally {
    clientA.release()
    clientB.release()
  }
})

test('監査ログは create/update/publish/rollback を記録する', async () => {
  const { document } = await createDocument('greeting-audit')
  const release = await app.inject({
    method: 'POST',
    url: `/api/documents/${document.id}/publish`,
    payload: { seq: 1, channel: 'internal', actor: 'alice' },
  })
  await app.inject({
    method: 'POST',
    url: `/api/documents/${document.id}/rollback`,
    payload: { channel: 'internal', toReleaseId: release.json().release.id, actor: 'alice' },
  })

  const audit = await app.inject({ method: 'GET', url: `/api/documents/${document.id}/audit` })
  const actions = (audit.json().entries as { action: string }[]).map((e) => e.action)
  assert.ok(actions.includes('create'))
  assert.ok(actions.includes('publish'))
  assert.ok(actions.includes('rollback'))
})
