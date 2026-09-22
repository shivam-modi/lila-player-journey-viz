import { useAsyncData } from './useAsyncData'
import { fetchMatchBundle } from '../lib/dataClient'
import type { MatchEvent } from '../lib/types'

export function useMatchBundle(matchId: string | null) {
  return useAsyncData<MatchEvent[]>(matchId ? () => fetchMatchBundle(matchId) : null, [matchId])
}
