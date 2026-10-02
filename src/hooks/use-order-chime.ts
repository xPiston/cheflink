import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * La sonnerie de la cuisine, synthetisee avec l'API Web Audio.
 *
 * Pas de fichier audio : deux notes generees pesent zero octet, ne posent
 * aucune question de licence, et sonnent identiquement sur toutes les
 * tablettes.
 *
 * LE POINT IMPORTANT : les navigateurs interdisent de jouer un son avant que
 * l'utilisateur ait interagi avec la page. Une tablette posee en cuisine qu'on
 * ouvre et qu'on ne touche plus ne sonnerait donc JAMAIS, en silence, sans que
 * rien ne le signale. D'ou `enabled` : tant que le contexte audio n'a pas ete
 * debloque par un vrai clic, l'ecran affiche un bouton pour le faire. Mieux
 * vaut un bouton a taper en debut de service qu'une sonnerie dont on decouvre
 * a 20 h qu'elle ne marche pas.
 */
export function useOrderChime() {
  const contextRef = useRef<AudioContext | null>(null)
  const [enabled, setEnabled] = useState(false)

  const enable = useCallback(async () => {
    const AudioContextCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextCtor) {
      return false
    }

    const context = contextRef.current ?? new AudioContextCtor()
    contextRef.current = context

    if (context.state === 'suspended') {
      await context.resume()
    }

    const ready = context.state === 'running'
    setEnabled(ready)

    return ready
  }, [])

  const play = useCallback(() => {
    const context = contextRef.current
    if (!context || context.state !== 'running') {
      return
    }

    // Deux notes montantes, courtes : audible dans le bruit d'une cuisine sans
    // etre agressif quand il en arrive cinq a la suite.
    const start = context.currentTime
    for (const [index, frequency] of [880, 1174.66].entries()) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.value = frequency

      const at = start + index * 0.18
      // Une enveloppe plutot qu'un gain constant : un son qui demarre et
      // s'arrete net produit un "clic" desagreable.
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)

      oscillator.connect(gain).connect(context.destination)
      oscillator.start(at)
      oscillator.stop(at + 0.18)
    }
  }, [])

  useEffect(() => {
    return () => {
      void contextRef.current?.close()
      contextRef.current = null
    }
  }, [])

  return { enabled, enable, play }
}
