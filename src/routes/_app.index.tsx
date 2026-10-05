import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { useMode } from '#/lib/mode'
import { m } from '#/paraglide/messages'

/**
 * The home route shows nothing: it sends you to the screen for the device's
 * mode.
 *
 * The redirect happens after mount rather than in `beforeLoad`, because the
 * mode lives in `localStorage`: the server cannot know it.
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

  return <p className="text-sm text-muted-foreground">{m.home_opening()}</p>
}
