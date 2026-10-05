import { useMutation } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { login } from '#/server/functions/auth'

export const Route = createFileRoute('/connexion')({
  beforeLoad: ({ context }) => {
    // Already signed in: no reason to see this form again.
    if (context.user) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signIn = useMutation({
    mutationFn: () => login({ data: { email, password } }),
    onSuccess: async () => {
      // Reload the router context so it sees the fresh session.
      await router.invalidate()
      await navigate({ to: '/' })
    },
  })

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10">
            <UtensilsCrossed className="size-6 text-primary" aria-hidden />
          </div>
          <div>
            <CardTitle>ChefLink</CardTitle>
            <CardDescription>Connectez-vous pour prendre le service.</CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              signIn.mutate()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {signIn.isError ? (
              <p role="alert" className="text-sm text-destructive">
                Identifiants invalides.
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={signIn.isPending}>
              {signIn.isPending ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
