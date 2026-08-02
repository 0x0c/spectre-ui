import { useEffect, useRef } from 'react'

const KEYBOARD_STEP = 16

export interface SplitterProps {
  /** `vertical` は左右の境界（左右方向にドラッグする）、`horizontal` は上下の境界。 */
  orientation: 'vertical' | 'horizontal'
  label: string
  value: number
  min: number
  max: number
  /** 画面座標から新しい値を求める。左右幅は px、中央の分割は比率と、単位が境界ごとに違う。 */
  fromPointer: (event: { clientX: number; clientY: number }) => number
  onChange: (value: number) => void
  /** キーボード操作の1回ぶん。比率の境界では px ではなく比率で渡す。 */
  step?: number
}

/**
 * パネルとパネルの境界 (SU-0013 Detailed design 項目2)。
 *
 * ポインタでドラッグして動かすほか、フォーカスを当てて矢印キーでも動かせる。
 * ポインティングデバイスを持たない利用者を締め出さないための経路であって、
 * 飾りではない。値は [min, max] に丸めてから渡す — 下限だけでなく上限も要る。
 * 上限がないと、反対側のパネルを画面の外へ押し出せてしまう。
 */
export function Splitter({ orientation, label, value, min, max, fromPointer, onChange, step = KEYBOARD_STEP }: SplitterProps) {
  // ドラッグ中に onChange が呼ばれるたび、呼び出し側は新しいクロージャを渡してくる
  // （インラインのアロー関数）。listener 側がその識別子に依存すると、値が動くたびに
  // 付け外しが起き、2回目以降の pointermove を取り逃がす。最新の関数は ref で持つ。
  const latest = useRef({ fromPointer, onChange, min, max })
  latest.current = { fromPointer, onChange, min, max }

  const draggingRef = useRef(false)

  // listener は識別子が変わらない1組だけを使い回す。
  const handlersRef = useRef<{ move: (event: PointerEvent) => void; up: () => void } | null>(null)
  if (handlersRef.current === null) {
    const move = (event: PointerEvent) => {
      if (!draggingRef.current) return
      const { fromPointer: from, onChange: change, min: lo, max: hi } = latest.current
      change(Math.min(hi, Math.max(lo, from(event))))
    }
    const up = () => {
      draggingRef.current = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    handlersRef.current = { move, up }
  }
  const handlers = handlersRef.current

  // ドラッグの途中でこのスプリッタが消える（パネルが別のスロットへ移るなど）と、
  // pointerup が来ないまま listener だけが残る。アンマウント時に必ず外す。
  useEffect(() => () => handlers.up(), [handlers])

  function startDragging(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    draggingRef.current = true
    window.addEventListener('pointermove', handlers.move)
    window.addEventListener('pointerup', handlers.up)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const decrease = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp'
    const increase = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown'
    if (event.key !== decrease && event.key !== increase) return
    event.preventDefault()
    onChange(Math.min(max, Math.max(min, value + (event.key === increase ? step : -step))))
  }

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={Math.round(value * 100) / 100}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      className={`splitter splitter-${orientation}`}
      onPointerDown={startDragging}
      onKeyDown={handleKeyDown}
    />
  )
}
