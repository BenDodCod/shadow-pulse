import { getSupabaseClient, isSupabaseConfigured } from './client'

export interface DailyEntry {
  rank: number
  player_name: string
  score: number
  wave_reached: number
  is_you: boolean
}

/**
 * Get or create an anonymous player ID stored in localStorage.
 * Used to identify the same player across sessions without auth.
 */
export function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return 'server'
  const key = 'shadowpulse_player_id'
  let id = localStorage.getItem(key)
  if (!id) {
    // Fallback UUID that works in non-secure contexts (HTTP dev)
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
    localStorage.setItem(key, id)
  }
  return id
}

/**
 * Submit (or upsert) a daily challenge score.
 * Only updates if the new score is higher than the existing one.
 */
export async function submitDailyChallengeScore(params: {
  date: string
  playerId: string
  playerName: string
  score: number
  waveReached: number
  seed: string
}): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const { date, playerId, playerName, score, waveReached, seed } = params

  // Check existing score for this player today
  const { data: existing } = await supabase
    .from('daily_challenge_scores')
    .select('id, score')
    .eq('challenge_date', date)
    .eq('player_id', playerId)
    .maybeSingle()

  if (existing) {
    // Only update if new score is higher
    if (score > existing.score) {
      await supabase
        .from('daily_challenge_scores')
        .update({ score, wave_reached: waveReached, submitted_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
  } else {
    await supabase.from('daily_challenge_scores').insert({
      challenge_date: date,
      player_id: playerId,
      player_name: playerName,
      score,
      wave_reached: waveReached,
      seed,
    })
  }
}

/**
 * Fetch the top N daily challenge scores for a given date.
 * Marks the entry belonging to the current player with is_you = true.
 */
export async function getDailyLeaderboard(
  date: string,
  playerId: string,
  limit = 10,
): Promise<DailyEntry[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('daily_challenge_scores')
    .select('player_name, score, wave_reached, player_id')
    .eq('challenge_date', date)
    .order('score', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((row, index) => ({
    rank: index + 1,
    player_name: row.player_name,
    score: row.score,
    wave_reached: row.wave_reached,
    is_you: row.player_id === playerId,
  }))
}

export interface AllTimeEntry {
  rank: number
  player_name: string
  score: number
  wave_reached: number
  is_you: boolean
}

/**
 * Fetch the all-time top N scores across all daily challenges.
 * Returns the single best score per player.
 */
export async function getAllTimeLeaderboard(
  playerId: string,
  limit = 10,
): Promise<AllTimeEntry[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseClient()
  if (!supabase) return []

  // Use a raw query via rpc or fallback to client-side dedup.
  // Supabase JS doesn't support DISTINCT ON directly, so we fetch more rows
  // and deduplicate in JS (simple and works for small leaderboards).
  const { data, error } = await supabase
    .from('daily_challenge_scores')
    .select('player_id, player_name, score, wave_reached')
    .order('score', { ascending: false })
    .limit(limit * 5) // fetch extra to ensure we have enough unique players after dedup

  if (error || !data) return []

  // Keep only the highest score per player_id
  const seen = new Set<string>()
  const deduped: typeof data = []
  for (const row of data) {
    if (!seen.has(row.player_id)) {
      seen.add(row.player_id)
      deduped.push(row)
    }
    if (deduped.length >= limit) break
  }

  return deduped.map((row, index) => ({
    rank: index + 1,
    player_name: row.player_name,
    score: row.score,
    wave_reached: row.wave_reached,
    is_you: row.player_id === playerId,
  }))
}
