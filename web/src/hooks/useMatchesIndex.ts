import { useAsyncData } from './useAsyncData'
import { fetchMatchesIndex } from '../lib/dataClient'
import type { MatchIndexEntry } from '../lib/types'

export function useMatchesIndex() {
  return useAsyncData<MatchIndexEntry[]>(fetchMatchesIndex, [])
}
