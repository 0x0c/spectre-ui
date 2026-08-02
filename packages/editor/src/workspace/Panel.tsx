import type { ReactNode } from 'react'
import { type PanelId, type SlotId, useWorkspaceStore } from '../store/workspaceStore'

export interface PanelProps {
  id: PanelId
  slot: SlotId
  title: string
  children: ReactNode
}

/**
 * パネルの外枠 (SU-0013 Detailed design 項目3)。ヘッダにパネル名とハンドルを載せる。
 *
 * 移動の操作は2通り用意してある。ハンドルを掴んで別のパネルのヘッダの上で離すと、
 * 2つのスロットが入れ替わる。ハンドルにフォーカスを当てて矢印キーを押すと、次の
 * スロットへ送られる。ポインタでの入れ替えだけにすると、キーボードしか使わない
 * 利用者がパネルを動かせなくなる。
 */
export function Panel({ id, slot, title, children }: PanelProps) {
  const draggingPanel = useWorkspaceStore((s) => s.draggingPanel)
  const beginPanelDrag = useWorkspaceStore((s) => s.beginPanelDrag)
  const endPanelDrag = useWorkspaceStore((s) => s.endPanelDrag)
  const movePanel = useWorkspaceStore((s) => s.movePanel)
  const cyclePanel = useWorkspaceStore((s) => s.cyclePanel)

  const isDropTarget = draggingPanel !== null && draggingPanel !== id

  function handleHeaderPointerUp() {
    if (draggingPanel && draggingPanel !== id) {
      movePanel(draggingPanel, slot)
    }
    endPanelDrag()
  }

  function handleHandleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    if (!forward && !backward) return
    event.preventDefault()
    cyclePanel(id, forward ? 1 : -1)
  }

  return (
    <section
      className={`panel${isDropTarget ? ' panel-drop-target' : ''}`}
      aria-label={title}
      data-panel={id}
      data-slot={slot}
    >
      <header className="panel-header" onPointerUp={handleHeaderPointerUp}>
        <button
          type="button"
          className="panel-handle"
          aria-label={`${title}を移動`}
          onPointerDown={() => beginPanelDrag(id)}
          onKeyDown={handleHandleKeyDown}
        >
          ⠿
        </button>
        <span className="panel-title">{title}</span>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  )
}
