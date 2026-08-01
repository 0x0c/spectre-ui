import { createHash } from 'node:crypto'

/** ドキュメント本文のチェックサム。`document_versions.checksum` と ETag の元になる。 */
export function checksumOf(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex')
}

/** 弱くない ETag。チェックサムをそのまま引用符で包む。 */
export function etagOf(checksum: string): string {
  return `"${checksum}"`
}
