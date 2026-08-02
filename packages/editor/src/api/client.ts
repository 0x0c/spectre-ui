import type { SpectreDocument } from '@spectre-ui/manifest/generated'

/**
 * `packages/server` (SU-0004) のオーサリング API への薄いクライアント。
 *
 * この一巡目のエディタは、ローカル/サンプルドキュメントに対して**オフラインで**動くことを
 * 主な動線にしている (roadmap の Log 参照) — このクライアントはどの画面からも呼ばれておらず、
 * 「実サーバと繋げるとしたらここ」という配線点として置いてある、意図的な stretch goal。
 * バージョン競合 (楽観ロック)・公開・ロールバックの UI はまだない。
 */

export interface AuthoringClientOptions {
  baseUrl: string
  actor: string
  fetchImpl?: typeof fetch
}

export interface DocumentSummary {
  id: string
  screen_id: string
  name: string
  current_draft_version: number
}

export interface DocumentVersion {
  id: string
  document_id: string
  seq: number
  body: unknown
  checksum: string
  author: string
  created_at: string
}

export interface ValidationResult {
  valid: boolean
  issues: { path: string; message: string; severity: 'error' | 'warning' }[]
}

async function request<T>(baseUrl: string, path: string, init: RequestInit, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(`${baseUrl}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
  const body = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message = (body as { error?: string } | undefined)?.error ?? `${response.status} ${response.statusText}`
    throw new Error(message)
  }
  return body as T
}

export function createAuthoringClient({ baseUrl, actor, fetchImpl = fetch }: AuthoringClientOptions) {
  return {
    listDocuments(): Promise<{ documents: DocumentSummary[] }> {
      return request(baseUrl, '/api/documents', { method: 'GET' }, fetchImpl)
    },

    createDocument(screenId: string, name: string, body: SpectreDocument): Promise<{ document: DocumentSummary; version: DocumentVersion }> {
      return request(baseUrl, '/api/documents', { method: 'POST', body: JSON.stringify({ screenId, name, body, actor }) }, fetchImpl)
    },

    updateDraft(documentId: string, expectedVersion: number, body: SpectreDocument): Promise<{ version: DocumentVersion }> {
      return request(
        baseUrl,
        `/api/documents/${documentId}`,
        { method: 'PUT', body: JSON.stringify({ body, actor, expectedVersion }) },
        fetchImpl,
      )
    },

    validate(documentId: string, seq?: number): Promise<ValidationResult> {
      return request(baseUrl, `/api/documents/${documentId}/validate`, { method: 'POST', body: JSON.stringify({ seq }) }, fetchImpl)
    },

    publish(documentId: string, seq: number, channel: 'internal' | 'canary' | 'production', options?: { rolloutPercent?: number; approvedBy?: string }) {
      return request<{ release: unknown }>(
        baseUrl,
        `/api/documents/${documentId}/publish`,
        { method: 'POST', body: JSON.stringify({ seq, channel, actor, ...options }) },
        fetchImpl,
      )
    },
  }
}

export type AuthoringClient = ReturnType<typeof createAuthoringClient>
