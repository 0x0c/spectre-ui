import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_DOCUMENT, useDocumentStore } from '../../store/documentStore'
import { BindingPicker } from './BindingPicker'

beforeEach(() => {
  useDocumentStore.getState().loadDocument(EMPTY_DOCUMENT)
  useDocumentStore.getState().updateDocumentField('data', { product: { stock: 3 } })
})

describe('BindingPicker — expression mode', () => {
  it('parses an existing ${data.x} expression into scope + path', () => {
    render(<BindingPicker mode="expression" value="${data.product.stock}" onChange={() => {}} />)
    expect(screen.getByLabelText('スコープ')).toHaveValue('data')
    expect(screen.getByLabelText('パス')).toHaveValue('product.stock')
  })

  it('re-syncs scope/path when the value prop changes externally (e.g. edited via the adjacent raw text input)', () => {
    const { rerender } = render(<BindingPicker mode="expression" value="${data.product.stock}" onChange={() => {}} />)
    expect(screen.getByLabelText('パス')).toHaveValue('product.stock')

    // simulates ExpressionField's raw <input> producing a new value independently of this picker
    rerender(<BindingPicker mode="expression" value="${state.qty}" onChange={() => {}} />)

    expect(screen.getByLabelText('スコープ')).toHaveValue('state')
    expect(screen.getByLabelText('パス')).toHaveValue('qty')
  })

  it('emits a properly wrapped ${scope.path} expression when the path changes', () => {
    let lastValue = ''
    render(<BindingPicker mode="expression" value="" onChange={(v) => (lastValue = v)} />)
    fireEvent.change(screen.getByLabelText('パス'), { target: { value: 'product.stock' } })
    expect(lastValue).toBe('${data.product.stock}')
  })

  it('does not call onChange while the path is empty', () => {
    let calls = 0
    render(
      <BindingPicker
        mode="expression"
        value=""
        onChange={() => {
          calls += 1
        }}
      />,
    )
    fireEvent.change(screen.getByLabelText('パス'), { target: { value: '' } })
    expect(calls).toBe(0)
  })
})

describe('BindingPicker — statePath mode', () => {
  it('has no scope selector and treats the value as a bare path', () => {
    render(<BindingPicker mode="statePath" value="qty" onChange={() => {}} />)
    expect(screen.queryByLabelText('スコープ')).not.toBeInTheDocument()
    expect(screen.getByLabelText('パス')).toHaveValue('qty')
  })

  it('emits the bare path, not wrapped in ${...}', () => {
    let lastValue = ''
    render(<BindingPicker mode="statePath" value="" onChange={(v) => (lastValue = v)} />)
    fireEvent.change(screen.getByLabelText('パス'), { target: { value: 'newField' } })
    expect(lastValue).toBe('newField')
  })
})
