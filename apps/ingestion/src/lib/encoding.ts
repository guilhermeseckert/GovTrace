import chardet from 'chardet'
import iconv from 'iconv-lite'

/**
 * Detects the encoding of a buffer and transcodes it to UTF-8.
 * Canadian government CSV files may be ISO-8859-1, Windows-1252, or UTF-8.
 * Files may also contain a BOM (byte-order mark) which is stripped.
 * See Pitfall 5: CSV encoding issues with French-language content.
 */
export async function detectAndTranscode(
  buffer: Buffer,
): Promise<{ utf8Content: string; detectedEncoding: string }> {
  // Strip BOM if present (UTF-8 BOM: EF BB BF)
  const hasBom =
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf

  const contentBuffer = hasBom ? buffer.subarray(3) : buffer

  // Detect encoding using chardet
  const detected = chardet.detect(contentBuffer)
  const detectedEncoding = detected ?? 'UTF-8'

  // Transcode to UTF-8 using iconv-lite
  const utf8Content = iconv.decode(contentBuffer, detectedEncoding)

  return { utf8Content, detectedEncoding }
}
