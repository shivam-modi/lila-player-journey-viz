import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchMatchesIndex, fetchMatchBundle, fetchHeatmap, fetchOverviewEvents } from './dataClient'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('dataClient', () => {
  it('fetches and parses the matches index', async () => {
    ;(fetch as any).mockResolvedValueOnce({ ok: true, json: async () => [{ match_id: 'm1' }] })
    const result = await fetchMatchesIndex()
    expect(fetch).toHaveBeenCalledWith('/data/matches_index.json')
    expect(result).toEqual([{ match_id: 'm1' }])
  })

  it('fetches a per-match bundle by id, escaping slashes in the filename', async () => {
    ;(fetch as any).mockResolvedValueOnce({ ok: true, json: async () => [] })
    await fetchMatchBundle('abc.nakama-0')
    expect(fetch).toHaveBeenCalledWith('/data/matches/abc.nakama-0.json')
  })

  it('fetches heatmap grids for a map', async () => {
    ;(fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ kills: [] }) })
    const result = await fetchHeatmap('AmbroseValley')
    expect(fetch).toHaveBeenCalledWith('/data/heatmaps/AmbroseValley.json')
    expect(result).toEqual({ kills: [] })
  })

  it('fetches overview events for a map', async () => {
    ;(fetch as any).mockResolvedValueOnce({ ok: true, json: async () => [{ date: '2026-02-10' }] })
    const result = await fetchOverviewEvents('AmbroseValley')
    expect(fetch).toHaveBeenCalledWith('/data/overview_events/AmbroseValley.json')
    expect(result).toEqual([{ date: '2026-02-10' }])
  })

  it('throws when a fetch is not ok', async () => {
    ;(fetch as any).mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(fetchMatchesIndex()).rejects.toThrow()
  })
})
