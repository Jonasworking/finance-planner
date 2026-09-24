import { describe, expect, it } from 'vitest'
import { classifyHost, PRODUCTION_HOST, readiness } from './readiness'

describe('classifyHost', () => {
  it('knows the final address, the old ones, previews and local servers', () => {
    expect(classifyHost(PRODUCTION_HOST)).toBe('production')
    expect(classifyHost('finance-planner-jonasworkings-projects.vercel.app')).toBe('old-address')
    expect(classifyHost('finance-planner-gilt-eight.vercel.app')).toBe('old-address')
    expect(classifyHost('finance-planner-git-phase-6-pwa-jonasworkings-projects.vercel.app')).toBe(
      'preview',
    )
    expect(classifyHost('finance-planner-n4g0mcgar-jonasworkings-projects.vercel.app')).toBe(
      'preview',
    )
    for (const host of ['localhost', '127.0.0.1', '[::1]', 'macbook.local', '192.168.1.20']) {
      expect(classifyHost(host)).toBe('local')
    }
  })
})

describe('readiness', () => {
  const ready = {
    host: 'production',
    standalone: true,
    storage: 'persisted',
    lastBackupAt: 1,
  } as const

  it('is ready only with all four checks done', () => {
    expect(readiness(ready)).toEqual({
      checks: [
        { id: 'address', done: true },
        { id: 'installed', done: true },
        { id: 'storage', done: true },
        { id: 'backup', done: true },
      ],
      ready: true,
      doneCount: 4,
    })
    expect(readiness({ ...ready, host: 'old-address' }).ready).toBe(false)
    expect(readiness({ ...ready, standalone: false }).ready).toBe(false)
    expect(readiness({ ...ready, storage: 'not-persisted' }).ready).toBe(false)
    const noBackup = readiness({ ...ready, lastBackupAt: null })
    expect(noBackup.ready).toBe(false)
    expect(noBackup.doneCount).toBe(3)
  })

  it('does not block on a browser that cannot be asked to keep storage', () => {
    expect(readiness({ ...ready, storage: 'unsupported' }).ready).toBe(true)
  })
})
