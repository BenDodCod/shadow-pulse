// Wave Affix system - enemy modifiers applied per wave
import { rng } from './seeded-rng'

export type AffixId = 'swift' | 'frenzied' | 'armored' | 'regenerating' | 'volatile' | 'berserker'
export type AffixTier = 'mild' | 'medium' | 'strong'

export interface WaveAffix {
  id: AffixId
  name: string
  description: string
  tier: AffixTier
  color: string // For visual aura tint
  icon: string // 2-char symbol for HUD icon
  minWave: number // Earliest wave this can appear

  // Stat modifiers (applied multiplicatively to enemy stats)
  speedMultiplier?: number // Movement speed
  attackSpeedMultiplier?: number // Attack cooldown divisor (higher = faster)
  damageReduction?: number // Flat % damage reduction (0.0 - 1.0)
  regenPerSecond?: number // HP regenerated per second

  // Special behavior flags
  explodesOnDeath?: boolean // Volatile: creates explosion when killed
  explosionDamage?: number // Damage dealt by explosion
  explosionRadius?: number // Radius of explosion
  berserkerThreshold?: number // HP % threshold to trigger berserk mode
  berserkerDamageMultiplier?: number // Extra damage when berserking
}

export interface EnemyAffixState {
  affix: WaveAffix | null
  isBerserking: boolean // For Berserker affix tracking
  regenAccumulator: number // For Regenerating affix partial HP
}

export const AFFIX_POOL: WaveAffix[] = [
  // === MILD TIER (waves 2+) ===
  {
    id: 'swift',
    name: 'Swift',
    description: 'Enemies move 30% faster',
    tier: 'mild',
    color: '#22ffaa', // Green tint
    icon: '>>',
    minWave: 2,
    speedMultiplier: 1.3,
  },
  {
    id: 'frenzied',
    name: 'Frenzied',
    description: 'Enemies attack 25% faster',
    tier: 'mild',
    color: '#ffaa22', // Orange tint
    icon: '!!',
    minWave: 2,
    attackSpeedMultiplier: 1.25,
  },

  // === MEDIUM TIER (waves 5+) ===
  {
    id: 'armored',
    name: 'Armored',
    description: 'Enemies take 25% less damage',
    tier: 'medium',
    color: '#8888aa', // Gray/steel tint
    icon: '[]',
    minWave: 5,
    damageReduction: 0.25,
  },
  {
    id: 'regenerating',
    name: 'Regenerating',
    description: 'Enemies heal 3 HP per second',
    tier: 'medium',
    color: '#44ff88', // Bright green
    icon: '++',
    minWave: 5,
    regenPerSecond: 3,
  },

  // === STRONG TIER (waves 8+) ===
  {
    id: 'volatile',
    name: 'Volatile',
    description: 'Enemies explode on death',
    tier: 'strong',
    color: '#ff4444', // Red tint
    icon: '**',
    minWave: 8,
    explodesOnDeath: true,
    explosionDamage: 15,
    explosionRadius: 60,
  },
  {
    id: 'berserker',
    name: 'Berserker',
    description: 'Enemies deal +50% damage below 40% HP',
    tier: 'strong',
    color: '#ff2266', // Crimson tint
    icon: '^^',
    minWave: 8,
    berserkerThreshold: 0.4,
    berserkerDamageMultiplier: 1.5,
  },
]

/**
 * Select an affix for a wave based on tier weighting
 * Wave 1 has no affix (tutorial)
 * Early waves favor mild, later waves favor stronger affixes
 */
export function selectAffixForWave(wave: number): WaveAffix | null {
  // Wave 1 has no affix (tutorial wave)
  if (wave <= 1) return null

  // Filter eligible affixes based on minWave
  const eligible = AFFIX_POOL.filter((a) => wave >= a.minWave)
  if (eligible.length === 0) return null

  // Weight by tier based on wave progression
  const weighted: WaveAffix[] = []
  for (const affix of eligible) {
    let weight: number

    if (wave < 5) {
      // Early waves: only mild affixes
      weight = affix.tier === 'mild' ? 3 : 0
    } else if (wave < 8) {
      // Mid waves: mild and medium
      weight = affix.tier === 'mild' ? 2 : affix.tier === 'medium' ? 3 : 0
    } else if (wave < 12) {
      // Late-mid: all tiers, medium favored
      weight = affix.tier === 'mild' ? 1 : affix.tier === 'medium' ? 3 : 2
    } else {
      // Endgame: strong affixes favored
      weight = affix.tier === 'mild' ? 1 : affix.tier === 'medium' ? 2 : 4
    }

    for (let i = 0; i < weight; i++) {
      weighted.push(affix)
    }
  }

  if (weighted.length === 0) return null
  return weighted[Math.floor(rng() * weighted.length)]
}

/**
 * Create default affix state for an enemy
 */
export function createEnemyAffixState(affix: WaveAffix | null): EnemyAffixState {
  return {
    affix,
    isBerserking: false,
    regenAccumulator: 0,
  }
}
