import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSessionId } from '../lib/analytics'

// Mock Supabase so tests don't need a real connection
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}))

describe('analytics', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('generates a session ID', () => {
    const id = getSessionId()
    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
  })

  it('returns the same session ID on subsequent calls', () => {
    const id1 = getSessionId()
    const id2 = getSessionId()
    expect(id1).toBe(id2)
  })

  it('generates a new session ID after clearing storage', () => {
    const id1 = getSessionId()
    sessionStorage.clear()
    const id2 = getSessionId()
    expect(id1).not.toBe(id2)
  })
})
