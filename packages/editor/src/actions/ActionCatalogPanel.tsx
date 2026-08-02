import { actionCatalog } from './actionCatalog'

/**
 * アクションカタログの一覧表示 (SU-0003 Detailed design 項目5、マニフェスト由来の部分)。
 * サーバ応答プロトコル (`onSuccess`/`onError` の適用順など、docs/spec/actions.md §3) の
 * UX はこの一巡目では薄く、この表と各カードのパラメータ編集どまり。
 */
export function ActionCatalogPanel() {
  const catalog = actionCatalog()
  return (
    <div className="action-catalog-panel">
      <table>
        <thead>
          <tr>
            <th>アクション</th>
            <th>非同期</th>
            <th>パラメータ</th>
          </tr>
        </thead>
        <tbody>
          {catalog.map((action) => (
            <tr key={action.name}>
              <td>{action.name}</td>
              <td>{action.async ? '✓' : ''}</td>
              <td>{action.params.map((p) => p.name).join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
