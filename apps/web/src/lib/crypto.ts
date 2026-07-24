/**
 * Client-side AES-256-GCM encryption for secret notes.
 * Key is derived from a user-supplied master password via PBKDF2.
 *
 * Encrypted payload format (base64-encoded JSON stored in note.content):
 *   { v: 1, salt: <hex>, iv: <hex>, data: <hex> }
 */

const PBKDF2_ITERATIONS = 310_000
const SALT_BYTES = 16
const IV_BYTES = 12

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return arr
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export interface EncryptedPayload {
  v: 1
  salt: string
  iv: string
  data: string
}

/** Encrypt a plaintext string with the given master password. */
export async function encrypt(plaintext: string, password: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(password, salt)
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  return { v: 1, salt: bytesToHex(salt), iv: bytesToHex(iv), data: bytesToHex(new Uint8Array(ciphertext)) }
}

/** Decrypt an EncryptedPayload with the given master password. Throws on wrong password. */
export async function decrypt(payload: EncryptedPayload, password: string): Promise<string> {
  const salt = hexToBytes(payload.salt)
  const iv = hexToBytes(payload.iv)
  const data = hexToBytes(payload.data)
  const key = await deriveKey(password, salt)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(plaintext)
}

/** Check whether a note content object is an encrypted payload. */
export function isEncryptedPayload(content: unknown): content is EncryptedPayload {
  return (
    typeof content === 'object' &&
    content !== null &&
    (content as Record<string, unknown>)['v'] === 1 &&
    typeof (content as Record<string, unknown>)['salt'] === 'string' &&
    typeof (content as Record<string, unknown>)['iv'] === 'string' &&
    typeof (content as Record<string, unknown>)['data'] === 'string'
  )
}
