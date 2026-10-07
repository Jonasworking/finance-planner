import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTO_RELOAD_KEY } from '@/shared/lib/reloadOnce'
import { AppError } from './AppError'

const renderWithError = (error: Error) => {
  const Broken = () => {
    throw error
  }
  const router = createMemoryRouter([{ path: '/', Component: Broken, ErrorBoundary: AppError }])
  return render(<RouterProvider router={router} />)
}

let reload: ReturnType<typeof vi.fn>

beforeEach(() => {
  sessionStorage.clear()
  reload = vi.fn()
  vi.stubGlobal('location', { ...window.location, reload })
  // React logs every error a boundary catches – expected here.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AppError', () => {
  it('shows any unexpected error in German, says the data is safe and never reloads by itself', async () => {
    renderWithError(new Error('Cannot read properties of undefined'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Etwas ist schiefgelaufen')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Deine Daten liegen sicher auf diesem Gerät.',
    )
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(AUTO_RELOAD_KEY)).toBeNull()

    screen.getByRole('button', { name: 'Neu laden' }).click()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('says so when a part could not be loaded and a reload was already tried', async () => {
    sessionStorage.setItem(AUTO_RELOAD_KEY, String(Date.now()))
    renderWithError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Die App konnte nicht geladen werden',
    )
    expect(reload).not.toHaveBeenCalled()
  })
})
