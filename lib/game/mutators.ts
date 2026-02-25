// Mutator system for post-wave draft selection
import { rng } from './seeded-rng'

export type MutatorId = string

export interface MutatorModifiers {
  // Damage multipliers (1.0 = no change)
  lightDamageMultiplier?: number
  heavyDamageMultiplier?: number
  pulseWaveDamageMultiplier?: number

  // Stat modifiers (additive, can be negative)
  maxHpBonus?: number
  maxEnergyBonus?: number

  // Speed multiplier
  speedMultiplier?: number

  // Cooldown modifiers (additive in seconds, can be negative)
  dashCooldownBonus?: number
  lightCooldownBonus?: number
  heavyCooldownBonus?: number

  // Cost modifiers (additive, can be negative)
  dashCostBonus?: number
  pulseWaveCostBonus?: number
  timeFlickerCostBonus?: number

  // Range/Arc modifiers (multipliers)
  pulseWaveRangeMultiplier?: number
  lightRangeMultiplier?: number
  heavyRangeMultiplier?: number

  // Other modifiers
  energyRegenMultiplier?: number
  knockbackMultiplier?: number
  iframesDurationMultiplier?: number
}

export interface Mutator {
  id: MutatorId
  name: string
  description: string
  icon: string // emoji or symbol for HUD display
  color: string // theme color for UI
  modifiers: MutatorModifiers
  rarity: 'common' | 'rare' | 'epic'
}

// ============================================================================
// MUTATOR POOL
// ============================================================================

export const MUTATOR_POOL: Mutator[] = [
  // === COMMON (pure buffs, smaller effects) ===
  {
    id: 'swift_strikes',
    name: 'Swift Strikes',
    description: '+15% movement speed',
    icon: '>>',
    color: '#22ffaa',
    modifiers: { speedMultiplier: 1.15 },
    rarity: 'common',
  },
  {
    id: 'energy_surge',
    name: 'Energy Surge',
    description: '+25% energy regeneration',
    icon: '++',
    color: '#5500ff',
    modifiers: { energyRegenMultiplier: 1.25 },
    rarity: 'common',
  },
  {
    id: 'thick_skin',
    name: 'Thick Skin',
    description: '+15 max HP',
    icon: '[]',
    color: '#ff4444',
    modifiers: { maxHpBonus: 15 },
    rarity: 'common',
  },
  {
    id: 'extended_reach',
    name: 'Extended Reach',
    description: '+20% light attack range',
    icon: '->',
    color: '#cc88ff',
    modifiers: { lightRangeMultiplier: 1.2 },
    rarity: 'common',
  },
  {
    id: 'deep_reserves',
    name: 'Deep Reserves',
    description: '+20 max energy',
    icon: '%%',
    color: '#6622ff',
    modifiers: { maxEnergyBonus: 20 },
    rarity: 'common',
  },

  // === RARE (trade-offs or larger buffs) ===
  {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    description: '+30% light damage, -20 max HP',
    icon: '!!',
    color: '#ff8822',
    modifiers: { lightDamageMultiplier: 1.3, maxHpBonus: -20 },
    rarity: 'rare',
  },
  {
    id: 'heavy_hitter',
    name: 'Heavy Hitter',
    description: '+50% heavy damage, +0.2s cooldown',
    icon: '##',
    color: '#ffaa22',
    modifiers: { heavyDamageMultiplier: 1.5, heavyCooldownBonus: 0.2 },
    rarity: 'rare',
  },
  {
    id: 'pulse_master',
    name: 'Pulse Master',
    description: '+40% pulse range, +10 energy cost',
    icon: '@@',
    color: '#7b2fff',
    modifiers: { pulseWaveRangeMultiplier: 1.4, pulseWaveCostBonus: 10 },
    rarity: 'rare',
  },
  {
    id: 'shadow_step',
    name: 'Shadow Step',
    description: 'Dash costs 0 energy, +0.3s cooldown',
    icon: '~~',
    color: '#b366ff',
    modifiers: { dashCostBonus: -20, dashCooldownBonus: 0.3 },
    rarity: 'rare',
  },
  {
    id: 'berserker',
    name: 'Berserker',
    description: '+25% all damage, -30% iframes',
    icon: '**',
    color: '#ff2244',
    modifiers: {
      lightDamageMultiplier: 1.25,
      heavyDamageMultiplier: 1.25,
      pulseWaveDamageMultiplier: 1.25,
      iframesDurationMultiplier: 0.7,
    },
    rarity: 'rare',
  },
  {
    id: 'quick_recovery',
    name: 'Quick Recovery',
    description: '-0.1s all attack cooldowns',
    icon: '<<',
    color: '#22ccff',
    modifiers: {
      lightCooldownBonus: -0.05,
      heavyCooldownBonus: -0.1,
    },
    rarity: 'rare',
  },
  {
    id: 'heavy_reach',
    name: 'Heavy Reach',
    description: '+25% heavy attack range',
    icon: '=>',
    color: '#ffcc44',
    modifiers: { heavyRangeMultiplier: 1.25 },
    rarity: 'rare',
  },

  // === EPIC (powerful trade-offs) ===
  {
    id: 'time_lord',
    name: 'Time Lord',
    description: 'Time Flicker costs 20 less energy',
    icon: '()',
    color: '#00ccff',
    modifiers: { timeFlickerCostBonus: -20 },
    rarity: 'epic',
  },
  {
    id: 'momentum',
    name: 'Momentum',
    description: '+40% speed, -25 max HP',
    icon: '!!!',
    color: '#22ffaa',
    modifiers: { speedMultiplier: 1.4, maxHpBonus: -25 },
    rarity: 'epic',
  },
  {
    id: 'fortress',
    name: 'Fortress',
    description: '+50 max HP, -20% speed',
    icon: '[#]',
    color: '#888899',
    modifiers: { maxHpBonus: 50, speedMultiplier: 0.8 },
    rarity: 'epic',
  },
  {
    id: 'devastating_force',
    name: 'Devastating Force',
    description: '+80% knockback, +0.1s cooldowns',
    icon: '|||',
    color: '#ffcc00',
    modifiers: {
      knockbackMultiplier: 1.8,
      lightCooldownBonus: 0.1,
      heavyCooldownBonus: 0.1,
    },
    rarity: 'epic',
  },
]

// ============================================================================
// SELECTION LOGIC
// ============================================================================

/**
 * Get random mutators for selection, excluding already owned ones.
 * Weighted by rarity: common (3x), rare (2x), epic (1x)
 */
export function getRandomMutators(
  count: number,
  ownedIds: MutatorId[]
): Mutator[] {
  const available = MUTATOR_POOL.filter((m) => !ownedIds.includes(m.id))

  if (available.length === 0) return []

  // Weighted selection based on rarity
  const weighted: Mutator[] = []
  for (const mutator of available) {
    const weight = mutator.rarity === 'common' ? 3 : mutator.rarity === 'rare' ? 2 : 1
    for (let i = 0; i < weight; i++) {
      weighted.push(mutator)
    }
  }

  // Shuffle using Fisher-Yates
  for (let i = weighted.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[weighted[i], weighted[j]] = [weighted[j], weighted[i]]
  }

  // Pick unique mutators
  const selected: Mutator[] = []
  const selectedIds = new Set<MutatorId>()

  for (const m of weighted) {
    if (!selectedIds.has(m.id) && selected.length < count) {
      selected.push(m)
      selectedIds.add(m.id)
    }
  }

  return selected
}

/**
 * Compute combined modifiers from all active mutators.
 * Multipliers stack multiplicatively, bonuses stack additively.
 */
export function computeCombinedModifiers(mutators: Mutator[]): MutatorModifiers {
  const combined: MutatorModifiers = {}

  for (const mutator of mutators) {
    for (const [key, value] of Object.entries(mutator.modifiers)) {
      const k = key as keyof MutatorModifiers
      if (k.endsWith('Multiplier')) {
        // Multipliers stack multiplicatively
        combined[k] = ((combined[k] as number | undefined) ?? 1) * (value as number)
      } else {
        // Bonuses stack additively
        combined[k] = ((combined[k] as number | undefined) ?? 0) + (value as number)
      }
    }
  }

  return combined
}
