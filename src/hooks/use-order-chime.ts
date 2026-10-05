import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The kitchen chime, synthesised with the Web Audio API.
 *
 * No audio file: two generated notes weigh zero bytes, raise no licensing
 * question, and sound identical on every tablet.
 *
 * THE IMPORTANT PART: browsers refuse to play a sound before the user has
 * interacted with the page. A tablet set down in the kitchen, opened in the
 * morning and never touched again, would therefore NEVER ring - silently, with
 * nothing to signal it. Hence `enabled`: until a real tap has unlocked the
 * audio context, the screen shows a button to do it. A button to tap at the
 * start of service beats a chime you discover at 8pm has never worked.
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

    // Two short rising notes: audible over kitchen noise without grating when
    // five arrive in a row.
    const start = context.currentTime
    for (const [index, frequency] of [880, 1174.66].entries()) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.value = frequency

      const at = start + index * 0.18
      // An envelope rather than a constant gain: a sound that starts and
      // stops abruptly produces an unpleasant click.
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
