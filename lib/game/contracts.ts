// Wave Contracts system - optional objectives with rewards

import { EnemyType } from './enemy'
import { rng } from './seeded-rng'

export type ContractId = string
export type ContractDifficulty = 'easy' | 'medium' | 'hard'
export type ConsumableType = 'nuke' | 'full_heal' | 'invincibility'

export interface WaveContract {
  id: ContractId
  name: string
  description: string
  difficulty: ContractDifficulty
  minWave?: number
  maxWave?: number
  requiresEnemyType?: EnemyType
  scoreBonus: number
  hpRestore: number
  energyRestore: number
  failurePenalty?: 'none' | 'drop_to_1hp'
  consumableReward?: ConsumableType
}

export interface ContractProgress {
  totalKills: number
  killsByType: Record<EnemyType, number>
  firstKillType: EnemyType | null
  killOrder: EnemyType[]
  waveStartTime: number
  killTimestamps: number[]
  damageTaken: number
  wasHit: boolean
  pulseWaveUsed: boolean
  timeFlickerUsed: boolean
  maxCombo: number
  finalCombo: number
}

export interface ContractState {
  contract: WaveContract | null
  progress: ContractProgress
  status: 'active' | 'completed' | 'failed'
  penaltyApplied: boolean
}

// ============================================================================
// CONTRACT POOL
// ============================================================================

export const CONTRACT_POOL: WaveContract[] = [
  // === EASY CONTRACTS ===
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Kill at least 1 enemy',
    difficulty: 'easy',
    maxWave: 3,
    scoreBonus: 200,
    hpRestore: 5,
    energyRestore: 10,
  },
  {
    id: 'combo_starter',
    name: 'Combo Starter',
    description: 'Reach a 2x combo',
    difficulty: 'easy',
    scoreBonus: 200,
    hpRestore: 5,
    energyRestore: 15,
  },
  {
    id: 'pulse_user',
    name: 'Pulse User',
    description: 'Use Pulse Wave at least once',
    difficulty: 'easy',
    scoreBonus: 200,
    hpRestore: 5,
    energyRestore: 10,
  },

  // === MEDIUM CONTRACTS ===
  {
    id: 'sniper_priority',
    name: 'Sniper Priority',
    description: 'Kill a Sniper first',
    difficulty: 'medium',
    minWave: 3,
    requiresEnemyType: 'sniper',
    scoreBonus: 350,
    hpRestore: 10,
    energyRestore: 15,
    failurePenalty: 'drop_to_1hp',
  },
  {
    id: 'untouchable',
    name: 'Untouchable',
    description: 'Take no damage this wave',
    difficulty: 'medium',
    minWave: 2,
    scoreBonus: 350,
    hpRestore: 15,
    energyRestore: 20,
    failurePenalty: 'drop_to_1hp',
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Kill 3 enemies in 10 seconds',
    difficulty: 'medium',
    minWave: 2,
    scoreBonus: 300,
    hpRestore: 8,
    energyRestore: 15,
    failurePenalty: 'drop_to_1hp',
  },
  {
    id: 'combo_chain',
    name: 'Combo Chain',
    description: 'Reach a 3x combo',
    difficulty: 'medium',
    minWave: 2,
    scoreBonus: 300,
    hpRestore: 8,
    energyRestore: 15,
    failurePenalty: 'drop_to_1hp',
  },

  // === HARD CONTRACTS ===
  {
    id: 'heavy_priority',
    name: 'Heavy Priority',
    description: 'Kill all Heavies before other enemies',
    difficulty: 'hard',
    minWave: 5,
    requiresEnemyType: 'heavy',
    scoreBonus: 500,
    hpRestore: 15,
    energyRestore: 25,
    failurePenalty: 'drop_to_1hp',
    consumableReward: 'nuke',
  },
  {
    id: 'perfect_rush',
    name: 'Perfect Rush',
    description: 'No damage + clear under 15 seconds',
    difficulty: 'hard',
    minWave: 4,
    scoreBonus: 500,
    hpRestore: 20,
    energyRestore: 30,
    failurePenalty: 'drop_to_1hp',
    consumableReward: 'invincibility',
  },
  {
    id: 'combo_master',
    name: 'Combo Master',
    description: 'End wave with 5x combo active',
    difficulty: 'hard',
    minWave: 3,
    scoreBonus: 450,
    hpRestore: 12,
    energyRestore: 20,
    failurePenalty: 'drop_to_1hp',
    consumableReward: 'full_heal',
  },
]

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function createContractProgress(): ContractProgress {
  return {
    totalKills: 0,
    killsByType: { normal: 0, sniper: 0, heavy: 0, fast: 0 },
    firstKillType: null,
    killOrder: [],
    waveStartTime: Date.now(),
    killTimestamps: [],
    damageTaken: 0,
    wasHit: false,
    pulseWaveUsed: false,
    timeFlickerUsed: false,
    maxCombo: 0,
    finalCombo: 0,
  }
}

export function createContractState(): ContractState {
  return {
    contract: null,
    progress: createContractProgress(),
    status: 'active',
    penaltyApplied: false,
  }
}

/**
 * Select an appropriate contract for the current wave
 */
export function selectContractForWave(
  wave: number,
  enemyTypes: EnemyType[]
): WaveContract {
  const eligible = CONTRACT_POOL.filter((c) => {
    if (c.minWave && wave < c.minWave) return false
    if (c.maxWave && wave > c.maxWave) return false
    if (c.requiresEnemyType && !enemyTypes.includes(c.requiresEnemyType)) return false
    return true
  })

  if (eligible.length === 0) {
    // Fallback to first_blood if nothing eligible
    return CONTRACT_POOL[0]
  }

  // Weight by difficulty based on wave number
  const weighted: WaveContract[] = []
  for (const contract of eligible) {
    let weight: number
    if (wave < 3) {
      // Early waves favor easy contracts
      weight = contract.difficulty === 'easy' ? 4 : contract.difficulty === 'medium' ? 1 : 0
    } else if (wave < 6) {
      // Mid waves favor medium contracts
      weight = contract.difficulty === 'easy' ? 1 : contract.difficulty === 'medium' ? 3 : 1
    } else {
      // Late waves favor harder contracts
      weight = contract.difficulty === 'easy' ? 1 : contract.difficulty === 'medium' ? 2 : 3
    }

    for (let i = 0; i < weight; i++) {
      weighted.push(contract)
    }
  }

  if (weighted.length === 0) {
    return eligible[0]
  }

  return weighted[Math.floor(rng() * weighted.length)]
}

/**
 * Check contract completion status during the wave
 */
export function checkContractCompletion(
  contract: WaveContract,
  progress: ContractProgress,
  enemyCounts: Record<EnemyType, number>
): 'active' | 'completed' | 'failed' {
  switch (contract.id) {
    case 'first_blood':
      return progress.totalKills >= 1 ? 'completed' : 'active'

    case 'combo_starter':
      return progress.maxCombo >= 2 ? 'completed' : 'active'

    case 'pulse_user':
      return progress.pulseWaveUsed ? 'completed' : 'active'

    case 'sniper_priority':
      if (progress.firstKillType === 'sniper') return 'completed'
      if (progress.firstKillType !== null && progress.firstKillType !== 'sniper') return 'failed'
      return 'active'

    case 'untouchable':
      return progress.wasHit ? 'failed' : 'active'

    case 'speed_demon': {
      const windowMs = 10000
      const now = Date.now()
      const recentKills = progress.killTimestamps.filter((t) => now - t <= windowMs)
      return recentKills.length >= 3 ? 'completed' : 'active'
    }

    case 'combo_chain':
      return progress.maxCombo >= 3 ? 'completed' : 'active'

    case 'heavy_priority': {
      const heavyCount = enemyCounts.heavy
      if (heavyCount === 0) return 'completed' // No heavies = auto-complete
      const heavyKills = progress.killsByType.heavy
      // Check if any non-heavy was killed before all heavies are dead
      for (let i = 0; i < progress.killOrder.length; i++) {
        const killType = progress.killOrder[i]
        const heaviesKilledSoFar = progress.killOrder.slice(0, i + 1).filter((t) => t === 'heavy').length
        if (killType !== 'heavy' && heaviesKilledSoFar < heavyCount) {
          return 'failed'
        }
      }
      return heavyKills >= heavyCount ? 'completed' : 'active'
    }

    case 'perfect_rush':
      if (progress.wasHit) return 'failed'
      return 'active' // Evaluated at wave end

    case 'combo_master':
      return 'active' // Evaluated at wave end

    default:
      return 'active'
  }
}

/**
 * Final contract evaluation at wave end
 */
export function finalizeContract(
  contract: WaveContract,
  progress: ContractProgress,
  enemyCounts: Record<EnemyType, number>
): 'completed' | 'failed' {
  const status = checkContractCompletion(contract, progress, enemyCounts)
  if (status === 'completed') return 'completed'
  if (status === 'failed') return 'failed'

  // Handle contracts that only complete at wave end
  switch (contract.id) {
    case 'untouchable':
      return progress.wasHit ? 'failed' : 'completed'

    case 'perfect_rush': {
      const elapsed = (Date.now() - progress.waveStartTime) / 1000
      return !progress.wasHit && elapsed <= 15 ? 'completed' : 'failed'
    }

    case 'combo_master':
      return progress.finalCombo >= 5 ? 'completed' : 'failed'

    default:
      return 'failed'
  }
}

/**
 * Get display text for contract progress
 */
export function getContractProgressText(
  contract: WaveContract,
  progress: ContractProgress,
  status: 'active' | 'completed' | 'failed'
): string {
  if (status === 'completed') return 'COMPLETE!'
  if (status === 'failed') return 'FAILED'

  switch (contract.id) {
    case 'first_blood':
      return `${progress.totalKills}/1 kills`

    case 'combo_starter':
      return `${progress.maxCombo}/2 combo`

    case 'combo_chain':
      return `${progress.maxCombo}/3 combo`

    case 'combo_master':
      return `${progress.maxCombo}/5 combo`

    case 'speed_demon': {
      const windowMs = 10000
      const now = Date.now()
      const recentKills = progress.killTimestamps.filter((t) => now - t <= windowMs)
      return `${recentKills.length}/3 in 10s`
    }

    case 'untouchable':
      return progress.wasHit ? 'HIT!' : 'No damage yet'

    case 'perfect_rush': {
      const elapsed = ((Date.now() - progress.waveStartTime) / 1000).toFixed(1)
      return `${elapsed}s | ${progress.wasHit ? 'HIT!' : 'Clean'}`
    }

    case 'sniper_priority':
      return progress.firstKillType ? `First: ${progress.firstKillType}` : 'Waiting...'

    case 'heavy_priority':
      return progress.firstKillType ? 'In progress...' : 'Waiting...'

    case 'pulse_user':
      return progress.pulseWaveUsed ? 'Used!' : 'Press L'

    default:
      return ''
  }
}

/**
 * Get color for difficulty badge
 */
export function getDifficultyColor(difficulty: ContractDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return '#44ff88'
    case 'medium':
      return '#ffaa22'
    case 'hard':
      return '#ff4466'
  }
}
