/**
 * Hachage des mots de passe : PBKDF2-SHA256, via WebCrypto.
 *
 * Pas scrypt, qui serait pourtant plus resistant au materiel specialise : le
 * runtime des Workers n'expose pas `node:crypto.scrypt`, et WebCrypto - qui, lui,
 * est garanti partout - ne connait pas scrypt non plus. PBKDF2 est le meilleur
 * algorithme disponible sur cette plateforme sans embarquer une implementation
 * tierce en WebAssembly.
 *
 * 210 000 iterations : la recommandation OWASP pour PBKDF2-HMAC-SHA256. Le
 * compte est stocke AVEC le hash, de sorte qu'augmenter ce nombre plus tard ne
 * casse pas les mots de passe existants - ils continueront d'etre verifies avec
 * le leur.
 *
 * Format : `pbkdf2$<iterations>$<sel en hex>$<hash en hex>`.
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
 * Comparaison a temps constant.
 *
 * `===` sur deux chaines s'arrete au premier caractere different : le temps de
 * reponse laisserait fuir combien de caracteres du hash sont corrects. On
 * compare donc toujours la totalite. (`node:crypto.timingSafeEqual` n'existe pas
 * ici, d'ou cette version a la main sur des chaines de meme longueur.)
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
