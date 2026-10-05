import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { getDb } from '#/db/client'
import { users } from '#/db/schema'
import { m } from '#/paraglide/messages'
import {
  createSession,
  currentUser,
  destroyCurrentSession,
  verifyPassword,
  type SessionUser,
} from '#/server/auth'

export class InvalidCredentialsError extends Error {
  constructor() {
    super(m.error_invalid_credentials())
    this.name = 'InvalidCredentialsError'
  }
}

/**
 * The validation messages are functions, not strings.
 *
 * A schema is built once, when the module is first imported; a message has to
 * be read once per request, in the language of whoever sent it. Zod calls these
 * callbacks at parse time - inside the request, where `src/server.ts` has set
 * the locale - so the same schema answers in French to the bar and in English
 * to an English tablet. Written as plain strings they would be frozen in
 * whatever language the server started in.
 */
const credentials = z.object({
  email: z.string().email({ error: () => m.error_email_invalid() }),
  password: z.string().min(1, { error: () => m.error_password_required() }),
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
