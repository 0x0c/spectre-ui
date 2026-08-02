import { useCallback, useEffect, useRef } from 'react'

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
 * 飾りではない。値の下限・上限は呼び出し側が渡す。
 */
export function Splitter({ orientation, label, value, min, max, fromPointer, onChange, step = KEYBOARD_STEP }: SplitterProps) {
  const draggingRef = useRef(false)

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!draggingRef.current) return
      onChange(fromPointer(event))
    },
    [fromPointer, onChange],
  )

  const stopDragging = useCallback(() => {
    draggingRef.current = false
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', stopDragging)
  }, [handlePointerMove])

  function startDragging(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    draggingRef.current = true
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)
  }

  // ドラッグの途中でこのスプリッタが消える（パネルが別のスロットへ移るなど）と、
  // pointerup が来ないまま listener だけが残る。アンマウント時に必ず外す。
  useEffect(() => stopDragging, [stopDragging])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const decrease = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp'
    const increase = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown'
    if (event.key !== decrease && event.key !== increase) return
    event.preventDefault()
    onChange(value + (event.key === increase ? step : -step))
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
