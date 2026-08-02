import { describe, expect, it, vi } from 'vitest'
import { createAuthoringClient } from './client'

function fakeFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'x',
    json: async () => body,
  }) as unknown as typeof fetch
}

describe('createAuthoringClient', () => {
  it('lists documents from GET /api/documents', async () => {
    const fetchImpl = fakeFetch(200, { documents: [{ id: '1' }] })
    const client = createAuthoringClient({ baseUrl: 'https://api.test', actor: 'alice', fetchImpl })

    const result = await client.listDocuments()

    expect(fetchImpl).toHaveBeenCalledWith('https://api.test/api/documents', expect.objectContaining({ method: 'GET' }))
    expect(result.documents).toEqual([{ id: '1' }])
  })

  it('sends the actor and expectedVersion on updateDraft (optimistic locking, ADR-0005)', async () => {
    const fetchImpl = fakeFetch(200, { version: { seq: 2 } })
    const client = createAuthoringClient({ baseUrl: 'https://api.test', actor: 'alice', fetchImpl })

    await client.updateDraft('doc-1', 1, { schemaVersion: '1.0', id: 'doc-1', root: { type: 'Screen', props: {} } } as never)

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]
    const sentBody = JSON.parse(init.body as string)
    expect(sentBody.actor).toBe('alice')
    expect(sentBody.expectedVersion).toBe(1)
  })

  it('throws with the server-provided error message on a non-2xx response', async () => {
    const fetchImpl = fakeFetch(409, { error: '下書きが他の変更で更新されています' })
    const client = createAuthoringClient({ baseUrl: 'https://api.test', actor: 'alice', fetchImpl })

    await expect(client.updateDraft('doc-1', 1, {} as never)).rejects.toThrow('下書きが他の変更で更新されています')
  })

  it('validate posts the optional seq and reports issues', async () => {
    const fetchImpl = fakeFetch(200, { valid: false, issues: [{ path: 'root', message: 'x', severity: 'error' }] })
    const client = createAuthoringClient({ baseUrl: 'https://api.test', actor: 'alice', fetchImpl })

    const result = await client.validate('doc-1', 3)

    expect(result.valid).toBe(false)
    expect(result.issues).toHaveLength(1)
  })
})
