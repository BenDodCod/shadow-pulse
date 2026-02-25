import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client'

// localStorage key (matches existing implementation)
const LOCAL_STORAGE_KEY = 'shadowpulse_hs'

export interface GameScore {
  score: number
  waveReached: number
  levelReached: number
  durationSeconds?: number
  mutatorsSelected?: string[]
  deathCause?: string
}

export interface LeaderboardEntry {
  rank: number
  username: string | null
  displayName: string | null
  score: number
  waveReached: number
  levelReached: number
  playedAt: string
}

/**
 * Get the user's high score (checks both local storage and Supabase).
 */
export async function getHighScore(): Promise<number> {
  const localScore = getLocalHighScore()

  if (!isSupabaseConfigured()) {
    return localScore
  }

  const supabase = getSupabaseClient()
  if (!supabase) return localScore

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return localScore

    const { data } = await supabase
      .from('leaderboard')
      .select('score')
      .eq('user_id', user.id)
      .order('score', { ascending: false })
      .limit(1)
      .single()

    const remoteScore = data?.score ?? 0
    return Math.max(localScore, remoteScore)
  } catch {
    return localScore
  }
}

/**
 * Save a game score (saves to both local storage and Supabase if available).
 */
export async function saveScore(gameScore: GameScore): Promise<void> {
  // Always save locally first (immediate feedback)
  saveLocalHighScore(gameScore.score)

  if (!isSupabaseConfigured()) return

  const supabase = getSupabaseClient()
  if (!supabase) return

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const now = new Date().toISOString()

    // Save to game_sessions (personal history)
    await supabase.from('game_sessions').insert({
      user_id: user.id,
      score: gameScore.score,
      wave_reached: gameScore.waveReached,
      level_reached: gameScore.levelReached,
      duration_seconds: gameScore.durationSeconds,
      mutators_selected: gameScore.mutatorsSelected ?? [],
      death_cause: gameScore.deathCause,
      played_at: now,
    })

    // Check if this is a new personal best for the leaderboard
    const { data: existing } = await supabase
      .from('leaderboard')
      .select('score')
      .eq('user_id', user.id)
      .order('score', { ascending: false })
      .limit(1)
      .single()

    // Add to leaderboard if it's a new high score
    if (!existing || gameScore.score > existing.score) {
      await supabase.from('leaderboard').insert({
        user_id: user.id,
        score: gameScore.score,
        wave_reached: gameScore.waveReached,
        level_reached: gameScore.levelReached,
        played_at: now,
      })
    }
  } catch (error) {
    console.warn('Failed to save score to Supabase:', error)
    // Fail silently - local score is already saved
  }
}

/**
 * Get the global leaderboard.
 */
export async function getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured()) return []

  const supabase = getSupabaseClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase.rpc('get_leaderboard', {
      limit_count: limit
    })

    if (error) throw error

    return (data ?? []).map(entry => ({
      rank: entry.rank,
      username: entry.username,
      displayName: entry.display_name,
      score: entry.score,
      waveReached: entry.wave_reached,
      levelReached: entry.level_reached,
      playedAt: entry.played_at,
    }))
  } catch {
    return []
  }
}

/**
 * Get the user's personal score history.
 */
export async function getScoreHistory(limit = 50): Promise<GameScore[]> {
  if (!isSupabaseConfigured()) return []

  const supabase = getSupabaseClient()
  if (!supabase) return []

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('played_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data ?? []).map(session => ({
      score: session.score,
      waveReached: session.wave_reached,
      levelReached: session.level_reached,
      durationSeconds: session.duration_seconds ?? undefined,
      mutatorsSelected: (session.mutators_selected as string[]) ?? undefined,
      deathCause: session.death_cause ?? undefined,
    }))
  } catch {
    return []
  }
}

// ============ Local Storage Helpers ============

function getLocalHighScore(): number {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(LOCAL_STORAGE_KEY) || '0', 10)
}

function saveLocalHighScore(score: number): void {
  if (typeof window === 'undefined') return
  const current = getLocalHighScore()
  if (score > current) {
    localStorage.setItem(LOCAL_STORAGE_KEY, score.toString())
  }
}

/**
 * Get local high score (synchronous, for immediate access).
 */
export function getLocalHighScoreSync(): number {
  return getLocalHighScore()
}
