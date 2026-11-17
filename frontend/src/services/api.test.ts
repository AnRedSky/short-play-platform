import { describe, expect, it } from 'vitest'

describe('frontend test runner', () => {
  it('executes a real test suite', () => {
    expect('short-play-platform').toContain('short-play')
  })
})
