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

  // Power Fantasy — auto-attack / special mechanics
  autoLightAttack?: boolean       // light attack fires automatically on cooldown
  autoPulseWave?: boolean         // pulse wave fires automatically when energy > 80
  heavyChainCount?: number        // heavy chains to N nearest enemies after primary hit
  dashDamagesEnemies?: boolean    // dashing through enemies deals damage
  movementTrail?: boolean         // player leaves an afterimage trail while moving fast
}

export interface MutatorStackEffect {
  stackLevel: number    // which pick (2nd pick = level 2, etc.)
  description: string
  modifierDelta: Partial<MutatorModifiers>
}

export interface Mutator {
  id: MutatorId
  name: string
  description: string
  icon: string // emoji or symbol for HUD display
  color: string // theme color for UI
  modifiers: MutatorModifiers
  rarity: 'common' | 'rare' | 'epic'
  synergizes?: MutatorId[]            // IDs that combo well with this mutator
  stackEffects?: MutatorStackEffect[] // if present, mutator can be picked multiple times
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
    synergizes: ['momentum', 'auto_light'],
    stackEffects: [
      {
        stackLevel: 2,
        description: '+15% speed + movement afterimage',
        modifierDelta: { speedMultiplier: 1.15, movementTrail: true },
      },
      {
        stackLevel: 3,
        description: '+15% speed + dash damages enemies',
        modifierDelta: { speedMultiplier: 1.15, dashDamagesEnemies: true },
      },
    ],
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
    synergizes: ['chain_heavy'],
  },
  {
    id: 'pulse_master',
    name: 'Pulse Master',
    description: '+40% pulse range, +10 energy cost',
    icon: '@@',
    color: '#7b2fff',
    modifiers: { pulseWaveRangeMultiplier: 1.4, pulseWaveCostBonus: 10 },
    rarity: 'rare',
    synergizes: ['auto_pulse'],
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
    synergizes: ['chain_heavy'],
  },

  // === NEW EPIC — Power Fantasy ===
  {
    id: 'auto_light',
    name: 'Shadow Reflexes',
    description: 'Light attack fires automatically every 0.8s',
    icon: '\u00bb\u00bb',
    color: '#cc88ff',
    modifiers: { autoLightAttack: true },
    rarity: 'epic',
    synergizes: ['swift_strikes', 'glass_cannon', 'quick_recovery'],
  },
  {
    id: 'auto_pulse',
    name: 'Pulse Resonance',
    description: 'Pulse wave fires automatically when energy > 80',
    icon: '\u25cb\u25cb',
    color: '#7b2fff',
    modifiers: { autoPulseWave: true },
    rarity: 'epic',
    synergizes: ['pulse_master', 'energy_surge', 'deep_reserves'],
  },
  {
    id: 'chain_heavy',
    name: 'Chain Devastation',
    description: 'Heavy attack chains to 2 nearest enemies (60% dmg)',
    icon: '\u26a1\u26a1',
    color: '#ffaa22',
    modifiers: { heavyChainCount: 2 },
    rarity: 'epic',
    synergizes: ['heavy_hitter', 'devastating_force'],
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
  // Count how many of each mutator is already owned (for stacking)
  const ownedCount: Record<string, number> = {}
  for (const id of ownedIds) {
    ownedCount[id] = (ownedCount[id] || 0) + 1
  }

  const available = MUTATOR_POOL.filter((m) => {
    const count = ownedCount[m.id] || 0
    if (count === 0) return true // Not owned yet
    if (m.stackEffects && count <= m.stackEffects.length) return true // Can still stack
    return false
  })

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

/** Pick `count` guaranteed-epic mutators (boss reward). Falls back to any rarity if epics run out. */
export function getEpicMutators(count: number, ownedIds: MutatorId[]): Mutator[] {
  const ownedCount: Record<string, number> = {}
  for (const id of ownedIds) {
    ownedCount[id] = (ownedCount[id] || 0) + 1
  }
  const available = MUTATOR_POOL.filter((m) => {
    const c = ownedCount[m.id] || 0
    if (c === 0) return true
    if (m.stackEffects && c <= m.stackEffects.length) return true
    return false
  })
  const epics = available.filter(m => m.rarity === 'epic')
  const pool = epics.length >= count ? epics : available
  // Shuffle
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const selected: Mutator[] = []
  const seenIds = new Set<MutatorId>()
  for (const m of shuffled) {
    if (!seenIds.has(m.id) && selected.length < count) {
      selected.push(m)
      seenIds.add(m.id)
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
      if (typeof value === 'boolean') {
        // Booleans: true if any mutator has it true
        ;(combined as Record<string, unknown>)[k] = value || (combined as Record<string, unknown>)[k] || false
      } else if (k.endsWith('Multiplier')) {
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
