import { Player, createPlayer, updatePlayer, InputState } from './player'
import { Enemy, EnemyType, updateEnemy } from './enemy'
import { Camera, createCamera, shakeCamera, updateCamera } from './camera'
import { ParticleSystem, createParticleSystem, updateParticles, emitHitSparks, emitPulseWave, emitDeathExplosion, emitAmbientParticle } from './particles'
import { processPlayerAttacks, processEnemyAttacks, HitEffect } from './combat'
import { spawnWaveEnemies } from './waves'
import { render } from './renderer'
import { LevelTheme, Obstacle, getLevelTheme, getLevelNumber, isLevelTransition, generateObstacles } from './levels'
import * as S from './settings'
import { setArenaRadius } from './settings'
import { Mutator, MutatorModifiers, getRandomMutators, computeCombinedModifiers } from './mutators'
import {
  ContractState,
  createContractState,
  createContractProgress,
  selectContractForWave,
  checkContractCompletion,
  finalizeContract,
} from './contracts'

export interface GameState {
  player: Player
  enemies: Enemy[]
  camera: Camera
  particles: ParticleSystem
  hitEffects: HitEffect[]
  wave: number
  waveTimer: number
  waveActive: boolean
  hitFreezeTimer: number
  score: number
  highScore: number
  gameOver: boolean
  timeScale: number
  // Level system
  level: number
  levelTheme: LevelTheme
  obstacles: Obstacle[]
  levelUpTimer: number
  levelUpName: string
  // Mutator system
  activeMutators: Mutator[]
  combinedModifiers: MutatorModifiers
  mutatorSelectionActive: boolean
  mutatorChoices: Mutator[]
  mutatorSelectionInput: number | null
  // Contract system
  contractState: ContractState
  originalEnemyCounts: Record<EnemyType, number>
  // Last Stand system (one-time lethal hit survival)
  lastStandUsed: boolean
  lastStandActive: boolean
  lastStandTimer: number
  // Death recap (damage tracking by enemy type)
  damageByEnemyType: Record<EnemyType, number>
}

export function createGameState(): GameState {
  const startTheme = getLevelTheme(1)
  return {
    player: createPlayer(),
    enemies: [],
    camera: createCamera(),
    particles: createParticleSystem(),
    hitEffects: [],
    wave: 0,
    waveTimer: 2.0,
    waveActive: false,
    hitFreezeTimer: 0,
    score: 0,
    highScore: parseInt(typeof window !== 'undefined' ? localStorage.getItem('shadowpulse_hs') || '0' : '0'),
    gameOver: false,
    timeScale: 1,
    level: 1,
    levelTheme: startTheme,
    obstacles: [],
    levelUpTimer: 0,
    levelUpName: '',
    // Mutator system
    activeMutators: [],
    combinedModifiers: {},
    mutatorSelectionActive: false,
    mutatorChoices: [],
    mutatorSelectionInput: null,
    // Contract system
    contractState: createContractState(),
    originalEnemyCounts: { normal: 0, sniper: 0, heavy: 0, fast: 0 },
    // Last Stand system
    lastStandUsed: false,
    lastStandActive: false,
    lastStandTimer: 0,
    // Death recap
    damageByEnemyType: { normal: 0, sniper: 0, heavy: 0, fast: 0 },
  }
}

// Apply mutator stat changes to player
function applyMutatorStats(player: Player, mods: MutatorModifiers): void {
  // Recalculate max HP
  const baseMaxHp = S.PLAYER_HP
  player.maxHp = baseMaxHp + (mods.maxHpBonus ?? 0)
  player.hp = Math.min(player.hp, player.maxHp)

  // Recalculate max energy
  const baseMaxEnergy = S.MAX_ENERGY
  player.maxEnergy = baseMaxEnergy + (mods.maxEnergyBonus ?? 0)
  player.energy = Math.min(player.energy, player.maxEnergy)

  // Speed is applied dynamically in updatePlayer
}

export function updateGame(state: GameState, input: InputState, dt: number): void {
  if (state.gameOver) {
    return
  }

  // Mutator selection pauses the game
  if (state.mutatorSelectionActive) {
    if (state.mutatorSelectionInput !== null) {
      const choiceIndex = state.mutatorSelectionInput - 1
      if (choiceIndex >= 0 && choiceIndex < state.mutatorChoices.length) {
        const chosen = state.mutatorChoices[choiceIndex]
        state.activeMutators.push(chosen)
        state.combinedModifiers = computeCombinedModifiers(state.activeMutators)
        applyMutatorStats(state.player, state.combinedModifiers)
      }
      state.mutatorSelectionActive = false
      state.mutatorChoices = []
      state.mutatorSelectionInput = null
    }
    return // Game paused during selection
  }

  // Hit freeze
  if (state.hitFreezeTimer > 0) {
    state.hitFreezeTimer -= dt
    return // Freeze everything
  }

  // Level-up announcement timer
  if (state.levelUpTimer > 0) {
    state.levelUpTimer -= dt
  }

  // Last Stand slow-mo timer
  if (state.lastStandActive) {
    state.lastStandTimer -= dt
    if (state.lastStandTimer <= 0) {
      state.lastStandActive = false
      state.lastStandTimer = 0
    }
  }

  // Time scale from Time Flicker or Last Stand
  if (state.lastStandActive) {
    state.timeScale = S.LAST_STAND_SLOW_MO_SCALE
  } else if (state.player.timeFlickerActive) {
    state.timeScale = S.TIME_FLICKER_SLOW
  } else {
    state.timeScale = 1
  }

  // Player update (always full speed - player is immune to time slow)
  updatePlayer(state.player, input, dt, state.combinedModifiers)

  // Enemies update with time scale
  for (const enemy of state.enemies) {
    updateEnemy(enemy, state.player, dt, state.timeScale)
  }

  // Combat - player attacks
  const playerCombat = processPlayerAttacks(state.player, state.enemies, state.combinedModifiers)
  if (playerCombat.hitFreeze > 0) {
    state.hitFreezeTimer = playerCombat.hitFreeze
  }
  if (playerCombat.cameraShake.intensity > 0) {
    shakeCamera(state.camera, playerCombat.cameraShake.intensity, playerCombat.cameraShake.duration)
  }
  for (const effect of playerCombat.hitEffects) {
    state.hitEffects.push(effect)
    emitHitSparks(state.particles, effect.pos, effect.type === 'pulse' ? '#7b2fff' : '#ffffff', effect.type === 'heavy' ? 15 : 8)
  }
  state.score += playerCombat.enemiesKilled * 50

  // Contract progress tracking - kills
  const cProgress = state.contractState.progress
  const cContract = state.contractState.contract
  for (const type of playerCombat.killedEnemyTypes) {
    cProgress.totalKills++
    cProgress.killsByType[type]++
    cProgress.killOrder.push(type)
    cProgress.killTimestamps.push(Date.now())
    if (cProgress.firstKillType === null) {
      cProgress.firstKillType = type
    }
  }

  // Track max combo
  cProgress.maxCombo = Math.max(cProgress.maxCombo, state.player.comboCount)

  // Track pulse wave usage
  if (state.player.pulseWaveActive) {
    cProgress.pulseWaveUsed = true
  }

  // Track time flicker usage
  if (state.player.timeFlickerActive) {
    cProgress.timeFlickerUsed = true
  }

  // Check contract completion (only if active)
  if (cContract && state.contractState.status === 'active') {
    const status = checkContractCompletion(cContract, cProgress, state.originalEnemyCounts)
    if (status !== 'active') {
      state.contractState.status = status
    }
  }

  // Pulse wave particles
  if (state.player.pulseWaveActive && state.player.pulseWaveTimer > S.PULSE_WAVE_DURATION - 0.05) {
    emitPulseWave(state.particles, state.player.pos, state.player.facing, S.PULSE_WAVE_ARC)
  }

  // Enemy attacks - pass whether Last Stand can be triggered
  const canTriggerLastStand = !state.lastStandUsed
  const enemyCombat = processEnemyAttacks(state.player, state.enemies, canTriggerLastStand)

  // Handle Last Stand trigger
  if (enemyCombat.lastStandTriggered) {
    state.lastStandUsed = true
    state.lastStandActive = true
    state.lastStandTimer = S.LAST_STAND_SLOW_MO_DURATION
    // Extra dramatic camera shake for Last Stand
    shakeCamera(state.camera, 20, 0.4)
  }

  if (enemyCombat.playerDamaged) {
    shakeCamera(state.camera, enemyCombat.cameraShake.intensity, enemyCombat.cameraShake.duration)
    for (const effect of enemyCombat.hitEffects) {
      // Different particle color for Last Stand
      const particleColor = enemyCombat.lastStandTriggered ? '#ffaa00' : '#ff2244'
      emitHitSparks(state.particles, effect.pos, particleColor, enemyCombat.lastStandTriggered ? 20 : 10)
    }
    // Track damage for death recap
    if (enemyCombat.damageSourceType) {
      state.damageByEnemyType[enemyCombat.damageSourceType] += enemyCombat.damageDealt
    }
    // Track damage for contract
    cProgress.wasHit = true
    // Re-check contract for immediate failure (e.g., Untouchable)
    if (cContract && state.contractState.status === 'active') {
      const status = checkContractCompletion(cContract, cProgress, state.originalEnemyCounts)
      if (status === 'failed') {
        state.contractState.status = 'failed'
      }
    }
  }

  // Death explosions
  for (const enemy of state.enemies) {
    if (!enemy.isAlive && enemy.hp <= 0) {
      emitDeathExplosion(state.particles, enemy.pos, enemy.color)
      enemy.hp = -999 // prevent re-triggering
    }
  }

  // Clean dead enemies
  state.enemies = state.enemies.filter(e => e.isAlive)

  // Wave management
  if (!state.waveActive) {
    state.waveTimer -= dt
    if (state.waveTimer <= 0) {
      state.wave++

      // ── Level transition ──
      const newLevel = getLevelNumber(state.wave)
      if (newLevel !== state.level || isLevelTransition(state.wave)) {
        state.level = newLevel
        state.levelTheme = getLevelTheme(state.wave)
        state.obstacles = generateObstacles(state.levelTheme, S.ARENA_CENTER_X, S.ARENA_CENTER_Y)
        setArenaRadius(state.levelTheme.arenaRadius)
        state.levelUpTimer = 3.0
        state.levelUpName = state.levelTheme.name
      }

      const { arenaRadius, difficultyMult } = state.levelTheme
      state.enemies = spawnWaveEnemies(state.wave, arenaRadius, S.ARENA_CENTER_X, S.ARENA_CENTER_Y, difficultyMult)
      state.waveActive = true
      state.waveTimer = 2.5

      // Contract system - count enemies and select contract
      state.originalEnemyCounts = { normal: 0, sniper: 0, heavy: 0, fast: 0 }
      for (const e of state.enemies) {
        state.originalEnemyCounts[e.type]++
      }
      const enemyTypes = [...new Set(state.enemies.map((e) => e.type))] as EnemyType[]
      state.contractState = {
        contract: selectContractForWave(state.wave, enemyTypes),
        progress: createContractProgress(),
        status: 'active',
      }
    }
  } else {
    if (state.waveTimer > 0) state.waveTimer -= dt
    if (state.enemies.length === 0) {
      state.waveActive = false
      state.waveTimer = S.WAVE_DELAY
      state.score += state.wave * 100

      // Finalize contract
      const contract = state.contractState.contract
      const progress = state.contractState.progress
      progress.finalCombo = state.player.comboCount
      if (contract && state.contractState.status === 'active') {
        const finalStatus = finalizeContract(contract, progress, state.originalEnemyCounts)
        state.contractState.status = finalStatus

        // Apply rewards if completed
        if (finalStatus === 'completed') {
          state.score += contract.scoreBonus
          state.player.hp = Math.min(state.player.maxHp, state.player.hp + contract.hpRestore)
          state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + contract.energyRestore)
        }
      }

      // Base healing between waves (reduced since contracts provide healing)
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 10)
      state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + 15)

      // Trigger mutator selection (after wave 1+)
      if (state.wave >= 1) {
        const ownedIds = state.activeMutators.map((m) => m.id)
        state.mutatorChoices = getRandomMutators(3, ownedIds)
        if (state.mutatorChoices.length > 0) {
          state.mutatorSelectionActive = true
        }
      }
    }
  }

  // Hit effects timer
  for (let i = state.hitEffects.length - 1; i >= 0; i--) {
    state.hitEffects[i].time -= dt
    if (state.hitEffects[i].time <= 0) {
      state.hitEffects.splice(i, 1)
    }
  }

  // Particles
  updateParticles(state.particles, dt)
  const r = state.levelTheme.arenaRadius
  emitAmbientParticle(state.particles, {
    x: S.ARENA_CENTER_X - r,
    y: S.ARENA_CENTER_Y - r,
    w: r * 2,
    h: r * 2,
  })

  // Camera
  updateCamera(state.camera, dt)

  // Game over
  if (!state.player.isAlive) {
    state.gameOver = true
    if (state.score > state.highScore) {
      state.highScore = state.score
      if (typeof window !== 'undefined') {
        localStorage.setItem('shadowpulse_hs', state.score.toString())
      }
    }
  }
}

export function renderGame(state: GameState, ctx: CanvasRenderingContext2D): void {
  render(
    ctx,
    state.player,
    state.enemies,
    state.camera,
    state.particles,
    state.wave,
    state.waveTimer > 0 && state.waveActive ? state.waveTimer : 0,
    state.gameOver,
    state.score,
    state.highScore,
    state.levelTheme,
    state.obstacles,
    state.level,
    state.levelUpTimer,
    state.levelUpName,
    // Mutator system
    state.mutatorSelectionActive,
    state.mutatorChoices,
    state.activeMutators,
    // Contract system
    state.contractState,
    // Last Stand system
    state.lastStandActive,
    state.lastStandTimer,
    state.lastStandUsed,
    // Death recap
    state.damageByEnemyType,
  )
}

export function resetGame(state: GameState): GameState {
  const hs = state.highScore
  const newState = createGameState()
  newState.highScore = hs
  return newState
}
