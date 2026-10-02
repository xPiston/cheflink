import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { useMode } from '#/lib/mode'

/**
 * L'accueil n'affiche rien : il envoie sur l'ecran du mode de l'appareil.
 *
 * La redirection se fait apres le montage et non dans `beforeLoad`, parce que
 * le mode vit dans `localStorage` : le serveur ne peut pas le connaitre.
 */
export const Route = createFileRoute('/_app/')({
  component: HomeRedirect,
})

function HomeRedirect() {
  const [mode] = useMode()
  const navigate = useNavigate()

  useEffect(() => {
    void navigate({ to: mode === 'cuisine' ? '/cuisine' : '/bar', replace: true })
  }, [mode, navigate])

  return <p className="text-sm text-muted-foreground">Ouverture du service...</p>
}
