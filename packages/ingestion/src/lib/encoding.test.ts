import { describe, it, expect } from 'vitest'
import { detectAndTranscode } from './encoding.ts'

describe('detectAndTranscode', () => {
  it('Test 1: ISO-8859-1 encoded "Montréal" → returns string containing exactly "Montréal"', async () => {
    // ISO-8859-1 encoding of "Montréal": é is 0xE9 in ISO-8859-1
    const iso88591Buffer = Buffer.from([
      0x4d, 0x6f, 0x6e, 0x74, 0x72, 0xe9, 0x61, 0x6c,
    ])
    const result = await detectAndTranscode(iso88591Buffer)
    expect(result.utf8Content).toContain('Montréal')
    expect(result.utf8Content).not.toContain('MontrÃ©al')
  })

  it('Test 2: UTF-8 encoded "Montréal" → returns string containing exactly "Montréal"', async () => {
    // UTF-8 encoding of "Montréal": é is 0xC3 0xA9 in UTF-8
    const utf8Buffer = Buffer.from('Montréal', 'utf8')
    const result = await detectAndTranscode(utf8Buffer)
    expect(result.utf8Content).toContain('Montréal')
  })

  it('Test 3: Windows-1252 encoded text → returns correct UTF-8 string', async () => {
    // Windows-1252: smart quote characters 0x93 0x94 (left/right double quotes)
    const win1252Buffer = Buffer.from([
      0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x93, 0x57, 0x6f, 0x72, 0x6c, 0x64, 0x94
    ])
    const result = await detectAndTranscode(win1252Buffer)
    // Should not throw and should return a valid UTF-8 string
    expect(typeof result.utf8Content).toBe('string')
    expect(result.utf8Content.length).toBeGreaterThan(0)
  })

  it('Test 4: Buffer with UTF-8 BOM (0xEF 0xBB 0xBF) → BOM stripped from output string', async () => {
    const bomPrefix = Buffer.from([0xef, 0xbb, 0xbf])
    const textBuffer = Buffer.from('Hello World', 'utf8')
    const bufferWithBom = Buffer.concat([bomPrefix, textBuffer])
    const result = await detectAndTranscode(bufferWithBom)
    // BOM should be stripped — string should start with 'H', not the BOM character
    expect(result.utf8Content).toBe('Hello World')
    expect(result.utf8Content.charCodeAt(0)).not.toBe(0xfeff)
  })

  it('Test 5: Returns detectedEncoding string', async () => {
    const utf8Buffer = Buffer.from('Hello', 'utf8')
    const result = await detectAndTranscode(utf8Buffer)
    expect(typeof result.detectedEncoding).toBe('string')
    expect(result.detectedEncoding.length).toBeGreaterThan(0)
  })
})
