import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { getDb } from '#/db/client'
import { users } from '#/db/schema'
import {
  createSession,
  currentUser,
  destroyCurrentSession,
  verifyPassword,
  type SessionUser,
} from '#/server/auth'

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Identifiants invalides.')
    this.name = 'InvalidCredentialsError'
  }
}

const credentials = z.object({
  email: z.string().email("L'adresse e-mail n'est pas valide."),
  password: z.string().min(1, 'Mot de passe requis.'),
})

export const login = createServerFn({ method: 'POST' })
  .validator(credentials)
  .handler(async ({ data }): Promise<SessionUser> => {
    const [user] = await getDb()
      .select()
      .from(users)
      .where(eq(users.email, data.email.trim().toLowerCase()))
      .limit(1)

    /**
     * An unknown e-mail and a wrong password give the SAME error. Telling them
     * apart would turn this form into a tool for finding out who has an
     * account here.
     */
    if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
      throw new InvalidCredentialsError()
    }

    await createSession(user.id)

    return { id: user.id, email: user.email, name: user.name }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await destroyCurrentSession()

  return { ok: true }
})

/**
 * Who is signed in. Called by the root route before anything renders, it is
 * what decides whether you see the app or the login screen.
 */
export const me = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => currentUser()
)
