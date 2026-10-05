import { eq, lt } from 'drizzle-orm'
import { getCookie, setCookie } from '@tanstack/react-start/server'

import { getDb } from '#/db/client'
import { sessions, users, type UserRow } from '#/db/schema'
import { toHex } from './password'

export { hashPassword, verifyPassword } from './password'

export const SESSION_COOKIE = 'bar_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type SessionUser = {
  id: string
  email: string
  name: string
}

export async function createSession(userId: string): Promise<string> {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer)

  await getDb()
    .insert(sessions)
    .values({ token, userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) })

  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS / 1000,
  })

  return token
}

export async function destroyCurrentSession(): Promise<void> {
  const token = getCookie(SESSION_COOKIE)

  if (token) {
    await getDb().delete(sessions).where(eq(sessions.token, token))
  }

  setCookie(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
}

/**
 * The user of the current request, or null.
 *
 * Expired sessions are deleted along the way rather than by a scheduled job:
 * the table stays small without one more moving part to watch.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const token = getCookie(SESSION_COOKIE)
  if (!token) {
    return null
  }

  const db = getDb()
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.token, token))
    .limit(1)

  if (!row) {
    return null
  }

  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
    return null
  }

  return toSessionUser(row.user)
}

export class UnauthenticatedError extends Error {
  constructor() {
    super('Connexion requise.')
    this.name = 'UnauthenticatedError'
  }
}

/** Call this at the top of every server function that touches data. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser()
  if (!user) {
    throw new UnauthenticatedError()
  }

  return user
}

export function toSessionUser(user: UserRow): SessionUser {
  return { id: user.id, email: user.email, name: user.name }
}

export function newId(): string {
  return crypto.randomUUID()
}
