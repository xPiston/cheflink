/**
 * Password hashing: PBKDF2-SHA256, through WebCrypto.
 *
 * Not scrypt, which would resist dedicated hardware better: the Workers runtime
 * does not expose `node:crypto.scrypt`, and WebCrypto - which is guaranteed
 * everywhere - does not know scrypt either. PBKDF2 is the best algorithm
 * available on this platform without shipping a third-party WebAssembly
 * implementation.
 *
 * 210,000 iterations: the OWASP recommendation for PBKDF2-HMAC-SHA256. The
 * count is stored WITH the hash, so raising it later does not break existing
 * passwords - they keep being verified with their own.
 *
 * Format: `pbkdf2$<iterations>$<salt in hex>$<hash in hex>`.
 */
const ITERATIONS = 210_000
const KEY_BITS = 256

export function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function fromHex(value: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array((value.length / 2) | 0)
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }

  return bytes
}

async function derive(password: string, salt: BufferSource, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    KEY_BITS
  )

  return toHex(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))

  return `pbkdf2$${ITERATIONS}$${toHex(salt.buffer)}$${await derive(password, salt, ITERATIONS)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, hash] = stored.split('$')
  if (scheme !== 'pbkdf2' || !iterations || !salt || !hash) {
    return false
  }

  const candidate = await derive(password, fromHex(salt), Number(iterations))

  return timingSafeEqual(candidate, hash)
}

/**
 * Constant-time comparison.
 *
 * `===` on two strings stops at the first differing character: the response
 * time would leak how many characters of the hash are correct. So we always
 * compare the whole thing. (`node:crypto.timingSafeEqual` does not exist here,
 * hence this hand-written version over strings of equal length.)
 */
function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false
  }

  let difference = 0
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return difference === 0
}
