import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { OverlayPanel } from './OverlayPanel'
import { EMPTY_DOCUMENT, useDocumentStore } from '../store/documentStore'

function overlays() {
  return (useDocumentStore.getState().document.overlays ?? []) as (Record<string, unknown> & { id: string })[]
}

describe('OverlayPanel', () => {
  beforeEach(() => {
    useDocumentStore.getState().loadDocument(EMPTY_DOCUMENT)
  })

  it('adds an overlay of each kind, with only the keys the schema requires', () => {
    render(<OverlayPanel />)

    fireEvent.click(screen.getByRole('button', { name: '+ シート' }))
    fireEvent.click(screen.getByRole('button', { name: '+ アラート' }))

    const [sheet, alert] = overlays()
    expect(sheet.kind).toBe('sheet')
    expect(sheet.root).toBeDefined()
    // presentation は書かれていない。既定値で補われないことが仕様 (docs/spec/schema.md §3.1)
    expect(sheet.presentation).toBeUndefined()
    expect(alert.kind).toBe('alert')
    expect(alert.buttons).toHaveLength(2)
  })

  it('writes a presentation option, and removes the key again when set back to unspecified', () => {
    render(<OverlayPanel />)
    fireEvent.click(screen.getByRole('button', { name: '+ シート' }))

    fireEvent.change(screen.getByLabelText('style'), { target: { value: 'dialog' } })
    expect((overlays()[0].presentation as Record<string, unknown>).style).toBe('dialog')

    fireEvent.change(screen.getByLabelText('style'), { target: { value: '' } })
    expect((overlays()[0].presentation as Record<string, unknown>).style).toBeUndefined()
  })

  it('offers no presentation block for a toast, which the schema refuses one on', () => {
    render(<OverlayPanel />)
    fireEvent.click(screen.getByRole('button', { name: '+ トースト' }))

    expect(screen.queryByLabelText('style')).not.toBeInTheDocument()
    expect(screen.getByLabelText('durationMs')).toBeInTheDocument()
  })

  it('edits the alert display options', () => {
    render(<OverlayPanel />)
    fireEvent.click(screen.getByRole('button', { name: '+ アラート' }))

    fireEvent.change(screen.getByLabelText('tone'), { target: { value: 'error' } })
    fireEvent.change(screen.getByLabelText('buttonLayout'), { target: { value: 'vertical' } })

    expect(overlays()[0].tone).toBe('error')
    expect(overlays()[0].buttonLayout).toBe('vertical')
  })

  it('deletes the selected overlay', () => {
    render(<OverlayPanel />)
    fireEvent.click(screen.getByRole('button', { name: '+ シート' }))
    expect(overlays()).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(overlays()).toHaveLength(0)
  })
})
