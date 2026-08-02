import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DndContext } from '@dnd-kit/core'
import { editorManifest } from '../manifest/editorManifest'
import { EMPTY_DOCUMENT, useDocumentStore } from '../store/documentStore'
import { Palette } from './Palette'

beforeEach(() => {
  useDocumentStore.getState().loadDocument(EMPTY_DOCUMENT)
})

function renderPalette() {
  return render(
    <DndContext>
      <Palette />
    </DndContext>,
  )
}

describe('Palette', () => {
  it('renders one item for every non-root-only cataloged component (manifest-driven, SU-0003 design point 1)', () => {
    renderPalette()
    const expected = editorManifest.components.filter((c) => !c.rootOnly)
    expect(expected.length).toBeGreaterThan(0)
    for (const component of expected) {
      expect(screen.getByRole('button', { name: new RegExp(`^${component.name}\\b`) })).toBeInTheDocument()
    }
  })

  it('does not offer Screen in the palette (it is the document root, not a draggable child)', () => {
    renderPalette()
    expect(screen.queryByRole('button', { name: /^Screen\b/ })).not.toBeInTheDocument()
  })

  it('groups components by category with a visible heading', () => {
    renderPalette()
    expect(screen.getByText('レイアウト')).toBeInTheDocument()
    expect(screen.getByText('表示')).toBeInTheDocument()
    expect(screen.getByText('入力')).toBeInTheDocument()
  })

  it('clicking a palette item adds that component to the document (keyboard/screen-reader-reachable path, not just drag)', () => {
    renderPalette()
    // dnd-kit の PointerSensor は pointerdown/pointermove を要求し、jsdom の
    // Pointer Events 実装は不完全なため userEvent.click 相当のポインタシーケンス全体は
    // 再現できない。ここで検証したいのはドラッグではなくクリックの結果なので、
    // click イベント単体を送る fireEvent で十分。
    fireEvent.click(screen.getByRole('button', { name: /^Text\b/ }))

    const doc = useDocumentStore.getState().document
    expect(doc.root.children).toHaveLength(1)
    expect(doc.root.children?.[0].type).toBe('Text')
  })
})
