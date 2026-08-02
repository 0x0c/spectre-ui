import type { ActionDef } from '@spectre-ui/manifest/editor-schema'
import { editorManifest } from '../manifest/editorManifest'

export interface ActionParamField {
  name: string
  type: 'string' | 'number' | 'boolean' | 'expression' | 'json' | 'actions' | 'enum'
  enumValues?: string[]
  placeholder?: string
}

export interface ActionTypeDef extends ActionDef {
  params: ActionParamField[]
}

/**
 * どのアクション種別が存在するか（名前・非同期かどうか）はマニフェストから読む
 * (SU-0003 Detailed design 項目5の前半)。各種別のパラメータ形は
 * `spec/component-manifest.json` の対象外 — `packages/manifest/src/manifest.ts` の
 * コメントの通り、docs/spec/actions.md §2 が情報源であって、マニフェスト自身ではない。
 * このテーブルは、いつかマニフェストがアクションのパラメータ形まで持つようになったときに
 * 置き換えられる、明示的な手書き部分。
 */
const PARAM_SHAPES: Record<string, ActionParamField[]> = {
  setState: [
    { name: 'path', type: 'string', placeholder: 'form.email' },
    { name: 'value', type: 'expression', placeholder: '${...}' },
  ],
  toggleState: [{ name: 'path', type: 'string', placeholder: 'expanded' }],
  request: [
    { name: 'endpoint', type: 'string', placeholder: 'cart.add' },
    { name: 'method', type: 'enum', enumValues: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    { name: 'body', type: 'json' },
    { name: 'loadingPath', type: 'string', placeholder: 'loading.cart' },
    { name: 'timeoutMs', type: 'number' },
  ],
  navigate: [
    { name: 'mode', type: 'enum', enumValues: ['push', 'present', 'replace', 'route'] },
    { name: 'screen', type: 'string' },
    { name: 'route', type: 'string' },
    { name: 'params', type: 'json' },
  ],
  back: [],
  dismiss: [],
  showOverlay: [{ name: 'id', type: 'string' }],
  dismissOverlay: [{ name: 'id', type: 'string' }],
  openUrl: [
    { name: 'url', type: 'expression' },
    { name: 'mode', type: 'enum', enumValues: ['inApp', 'external'] },
  ],
  refresh: [{ name: 'preserveState', type: 'boolean' }],
  applyPatch: [{ name: 'patch', type: 'json' }],
  host: [
    { name: 'name', type: 'string', placeholder: 'share' },
    { name: 'params', type: 'json' },
    { name: 'resultPath', type: 'string' },
  ],
  track: [
    { name: 'event', type: 'string' },
    { name: 'properties', type: 'json' },
  ],
  sequence: [{ name: 'actions', type: 'actions' }],
  condition: [
    { name: 'if', type: 'expression', placeholder: '${state.agreed}' },
    { name: 'then', type: 'actions' },
    { name: 'else', type: 'actions' },
  ],
  delay: [{ name: 'ms', type: 'number' }],
  focus: [{ name: 'nodeId', type: 'string' }],
  scrollTo: [
    { name: 'nodeId', type: 'string' },
    { name: 'animated', type: 'boolean' },
  ],
}

export function actionCatalog(): ActionTypeDef[] {
  return editorManifest.actions.map((action) => ({ ...action, params: PARAM_SHAPES[action.name] ?? [] }))
}
