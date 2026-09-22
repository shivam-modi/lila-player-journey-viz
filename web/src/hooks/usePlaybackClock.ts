import { useEffect, useRef, useState } from 'react'

/**
 * Drives a requestAnimationFrame-based playback clock from 0 to durationMs.
 * Resets to 0 and pauses whenever resetKey changes (e.g. a new match is selected).
 */
export function usePlaybackClock(durationMs: number, resetKey: unknown) {
  const [currentTs, setCurrentTs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const rafRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)

  useEffect(() => {
    setCurrentTs(0)
    setPlaying(false)
  }, [resetKey])

  useEffect(() => {
    if (!playing) {
      lastFrameTimeRef.current = null
      return
    }
    const tick = (now: number) => {
      if (lastFrameTimeRef.current != null) {
        const delta = (now - lastFrameTimeRef.current) * speed
        setCurrentTs((t) => Math.min(durationMs, t + delta))
      }
      lastFrameTimeRef.current = now
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, speed, durationMs])

  useEffect(() => {
    if (currentTs >= durationMs && durationMs > 0) setPlaying(false)
  }, [currentTs, durationMs])

  return { currentTs, playing, speed, setCurrentTs, setPlaying, setSpeed }
}
