import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('keeps custom font sizes next to text colors', () => {
    expect(cn('text-label', 'text-fg-muted')).toBe('text-label text-fg-muted')
    expect(cn('text-saved', 'text-display')).toBe('text-saved text-display')
    expect(cn('text-caption text-fg-subtle uppercase')).toBe(
      'text-caption text-fg-subtle uppercase',
    )
  })

  it('still resolves real conflicts', () => {
    expect(cn('text-h2', 'text-h1')).toBe('text-h1')
    expect(cn('text-base', 'text-h2')).toBe('text-h2')
    expect(cn('text-fg-muted', 'text-fg')).toBe('text-fg')
    expect(cn('shadow-card', 'shadow-sheet')).toBe('shadow-sheet')
    expect(cn('p-4', false, undefined, 'p-5')).toBe('p-5')
  })
})
