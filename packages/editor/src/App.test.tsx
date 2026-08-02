import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('mounts the full editor shell and loads the bundled sample document without crashing', async () => {
    render(<App />)

    // the sample doc (examples/screens/product-detail.json) loads asynchronously via an effect
    await waitFor(() => expect(screen.getByText('商品詳細')).toBeInTheDocument())

    // every major panel rendered
    expect(screen.getByText('レイアウト')).toBeInTheDocument() // palette category
    expect(screen.getByRole('tree')).toBeInTheDocument() // tree panel
    expect(screen.getByText('データ')).toBeInTheDocument() // bottom tab
    expect(screen.getByText(/近似プレビューです/)).toBeInTheDocument() // fidelity banner
  })
})
