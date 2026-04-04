import { describe, it, expect } from 'vitest'
import { deriveSourceKey } from './hash.ts'

describe('deriveSourceKey', () => {
  it('Test 1: Same fields always produce same SHA-256 hex string (deterministic)', () => {
    const fields = ['John Smith', '500.00', '2024-01-15', '35001', 'Liberal Party']
    const key1 = deriveSourceKey(fields)
    const key2 = deriveSourceKey(fields)
    expect(key1).toBe(key2)
  })

  it('Test 2: Different order of same fields produces different key (order matters)', () => {
    const fields1 = ['John Smith', '500.00', '2024-01-15']
    const fields2 = ['500.00', 'John Smith', '2024-01-15']
    const key1 = deriveSourceKey(fields1)
    const key2 = deriveSourceKey(fields2)
    expect(key1).not.toBe(key2)
  })

  it('Test 3: Empty string fields still produce consistent key', () => {
    const fieldsWithEmpty = ['John Smith', '', '2024-01-15', '']
    const key1 = deriveSourceKey(fieldsWithEmpty)
    const key2 = deriveSourceKey(fieldsWithEmpty)
    expect(key1).toBe(key2)
  })

  it('Test 4: Returns 64-character lowercase hex string', () => {
    const fields = ['contributor', 'amount', 'date']
    const key = deriveSourceKey(fields)
    expect(key).toHaveLength(64)
    expect(key).toMatch(/^[0-9a-f]{64}$/)
  })
})
