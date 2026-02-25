/**
 * Seeded PRNG module for Daily Challenge mode.
 *
 * Provides a module-level rng() function that defaults to Math.random but
 * can be swapped to a deterministic seeded generator. All game code that
 * needs reproducible randomness imports rng() from here instead of calling
 * Math.random() directly.
 */

// Module-level RNG function — defaults to Math.random
let _rng: () => number = Math.random

/** Use this everywhere in game code instead of Math.random() */
export function rng(): number {
  return _rng()
}

/** Swap in a seeded (or any custom) RNG */
export function setRng(fn: () => number): void {
  _rng = fn
}

/** Reset back to Math.random (normal game mode) */
export function resetToMathRandom(): void {
  _rng = Math.random
}

/**
 * Hash a date string (YYYY-MM-DD) to a 32-bit integer seed.
 * Same date always produces same seed across all players/devices.
 */
export function getDailySeed(dateStr?: string): number {
  const date = dateStr ?? new Date().toISOString().slice(0, 10)
  let hash = 0
  for (let i = 0; i < date.length; i++) {
    const char = date.charCodeAt(i)
    hash = Math.imul(31, hash) + char
    hash |= 0 // force 32-bit signed int
  }
  return Math.abs(hash) || 1 // ensure non-zero
}

/**
 * Create a mulberry32 seeded PRNG.
 * Fast, good distribution, passes most randomness tests.
 */
export function createSeededRng(seed: number): () => number {
  let s = seed >>> 0 // treat as uint32
  return function (): number {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
