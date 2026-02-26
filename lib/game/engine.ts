import { Player, createPlayer, updatePlayer, InputState, AttackType } from './player'
import { Enemy, EnemyType, updateEnemy } from './enemy'
import { distance, normalize, sub, scale, add } from './vec2'
import { Camera, createCamera, shakeCamera, updateCamera } from './camera'
import { ParticleSystem, createParticleSystem, updateParticles, emitHitSparks, emitPulseWave, emitDeathExplosion, emitTypedDeathExplosion, emitAffixDeathEffect, emitAmbientParticle } from './particles'
import { processPlayerAttacks, processEnemyAttacks, HitEffect } from './combat'
import { spawnWaveEnemies, WaveEvent, selectWaveEvent } from './waves'
import { render, DailyEntry } from './renderer'
import { AssetCache } from './assetLoader'
import { LevelTheme, Obstacle, Hazard, getLevelTheme, getLevelNumber, isLevelTransition, generateObstacles, generateHazards } from './levels'
import * as S from './settings'
import { setArenaRadius } from './settings'
import { Mutator, MutatorModifiers, getRandomMutators, computeCombinedModifiers } from './mutators'
import {
  ContractState,
  ConsumableType,
  createContractState,
  createContractProgress,
  selectContractForWave,
  checkContractCompletion,
  finalizeContract,
} from './contracts'
import { WaveAffix, selectAffixForWave } from './affixes'
import { rng, setRng, resetToMathRandom, getDailySeed, createSeededRng } from './seeded-rng'
import { audio } from './audio'

export interface SlashTrail {
  pos: { x: number; y: number }
  facing: number
  attackType: AttackType
  age: number
  maxAge: number
}

export interface DamageNumber {
  value: number
  pos: { x: number; y: number }
  vel: { x: number; y: number }
  age: number
  lifetime: number
  color: string
}

export interface GameState {
  player: Player
  enemies: Enemy[]
  camera: Camera
  particles: ParticleSystem
  hitEffects: HitEffect[]
  wave: number
  waveTimer: number
  waveActive: boolean
  currentAffix: WaveAffix | null
  hitFreezeTimer: number
  score: number
  highScore: number
  gameOver: boolean
  timeScale: number
  // Level system
  level: number
  levelTheme: LevelTheme
  obstacles: Obstacle[]
  hazards: Hazard[]
  // Wave Events (player choice pre-wave challenge)
  pendingWaveEvent: WaveEvent | null
  activeWaveEvent: WaveEvent | null
  waveEventTimer: number
  surgeZone: { x: number; y: number; radius: number } | null
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
  // Damage feedback
  damageFlashTimer: number
  damageDir: { x: number; y: number }
  // Slash trails
  slashTrails: SlashTrail[]
  // Floating damage numbers
  damageNumbers: DamageNumber[]
  // Daily Challenge
  isDailyChallenge: boolean
  challengeDate: string
  // Mutator selection feedback overlay
  mutatorFeedback: { name: string; description: string; color: string; timer: number } | null
  // Mutator ceremony
  mutatorSelectionTimer: number
  mutatorPeekActive: boolean
  playerRarityGlowTimer: number
  playerRarityGlowColor: string
  // Consumables
  consumables: ConsumableType[]
  consumableActive: { type: ConsumableType; timer: number } | null
}

export function createGameState(isDailyChallenge = false): GameState {
  const challengeDate = new Date().toISOString().slice(0, 10)
  if (isDailyChallenge) {
    setRng(createSeededRng(getDailySeed(challengeDate)))
  } else {
    resetToMathRandom()
  }

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
    currentAffix: null,
    hitFreezeTimer: 0,
    score: 0,
    highScore: parseInt(typeof window !== 'undefined' ? localStorage.getItem('shadowpulse_hs') || '0' : '0'),
    gameOver: false,
    timeScale: 1,
    level: 1,
    levelTheme: startTheme,
    obstacles: [],
    hazards: [],
    pendingWaveEvent: null,
    activeWaveEvent: null,
    waveEventTimer: 0,
    surgeZone: null,
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
    // Damage feedback
    damageFlashTimer: 0,
    damageDir: { x: 0, y: 0 },
    // Slash trails
    slashTrails: [],
    // Floating damage numbers
    damageNumbers: [],
    // Daily Challenge
    isDailyChallenge,
    challengeDate,
    mutatorFeedback: null,
    // Mutator ceremony
    mutatorSelectionTimer: 0,
    mutatorPeekActive: false,
    playerRarityGlowTimer: 0,
    playerRarityGlowColor: '#7b2fff',
    // Consumables
    consumables: [],
    consumableActive: null,
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
    state.mutatorSelectionTimer += dt
    state.mutatorPeekActive = input.mutatorPeek ?? false
    if (state.mutatorSelectionInput !== null) {
      const choiceIndex = state.mutatorSelectionInput - 1
      if (choiceIndex >= 0 && choiceIndex < state.mutatorChoices.length) {
        const chosen = state.mutatorChoices[choiceIndex]
        // Determine stack level (0-indexed count of prior picks of this mutator)
        const priorCount = state.activeMutators.filter(m => m.id === chosen.id).length
        let feedbackDesc = chosen.description
        if (priorCount > 0 && chosen.stackEffects) {
          // Re-pick: apply the stack effect at this level
          const stackEffect = chosen.stackEffects[priorCount - 1]
          if (stackEffect) {
            feedbackDesc = stackEffect.description
            // Create a virtual mutator with just the delta modifiers for this stack
            const stackMutator = { ...chosen, modifiers: stackEffect.modifierDelta as MutatorModifiers }
            state.activeMutators.push(stackMutator)
          } else {
            state.activeMutators.push(chosen)
          }
        } else {
          state.activeMutators.push(chosen)
        }
        state.combinedModifiers = computeCombinedModifiers(state.activeMutators)
        applyMutatorStats(state.player, state.combinedModifiers)
        // Check if a synergy is now active
        const activeIdsAfter = new Set(state.activeMutators.map(m => m.id))
        const synergyHit = (chosen.synergizes ?? []).filter(id => activeIdsAfter.has(id))
        const synergyText = synergyHit.length > 0
          ? ` ⚡ ${synergyHit.map(id => state.activeMutators.find(m => m.id === id)?.name ?? id).join(' + ')}`
          : ''
        state.mutatorFeedback = { name: chosen.name, description: feedbackDesc + synergyText, color: chosen.color, timer: 2.5 }
        state.playerRarityGlowTimer = 2.0
        state.playerRarityGlowColor = chosen.color
        audio.playMutatorSelect(chosen.rarity as 'common' | 'rare' | 'epic')
      }
      state.mutatorSelectionActive = false
      state.mutatorChoices = []
      state.mutatorSelectionInput = null
      state.mutatorPeekActive = false
    }
    return // Game paused during selection
  }

  // Hit freeze
  if (state.hitFreezeTimer > 0) {
    state.hitFreezeTimer -= dt
    return // Freeze everything
  }

  // Damage flash timer
  if (state.damageFlashTimer > 0) {
    state.damageFlashTimer -= dt
  }

  // Level-up announcement timer
  if (state.levelUpTimer > 0) {
    state.levelUpTimer -= dt
  }

  // Player rarity glow timer
  if (state.playerRarityGlowTimer > 0) {
    state.playerRarityGlowTimer -= dt
  }

  // Mutator feedback fade timer
  if (state.mutatorFeedback) {
    state.mutatorFeedback.timer -= dt
    if (state.mutatorFeedback.timer <= 0) state.mutatorFeedback = null
  }

  // Last Stand slow-mo timer
  if (state.lastStandActive) {
    state.lastStandTimer -= dt
    if (state.lastStandTimer <= 0) {
      state.lastStandActive = false
      state.lastStandTimer = 0
      audio.resumeMusic()
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

  // Consumable activation (Q key)
  if (input.consumableActivate && state.consumables.length > 0 && state.consumableActive === null) {
    const type = state.consumables.shift()!
    switch (type) {
      case 'nuke':
        for (const enemy of state.enemies) {
          if (enemy.isAlive) {
            state.score += 50
            enemy.hp = 0
            enemy.isAlive = false
          }
        }
        state.consumableActive = { type: 'nuke', timer: 0.5 }
        shakeCamera(state.camera, 18, 0.4)
        audio.playConsumable('nuke')
        break
      case 'full_heal':
        state.player.hp = state.player.maxHp
        state.consumableActive = { type: 'full_heal', timer: 0.8 }
        audio.playConsumable('full_heal')
        break
      case 'invincibility':
        state.player.iframes = 3.0
        state.consumableActive = { type: 'invincibility', timer: 3.0 }
        audio.playConsumable('invincibility')
        break
    }
  }

  // Decay consumable active timer
  if (state.consumableActive) {
    state.consumableActive.timer -= dt
    if (state.consumableActive.timer <= 0) state.consumableActive = null
  }

  // Player update (always full speed - player is immune to time slow)
  const prevAttacking = state.player.attacking
  const prevTimeFlicker = state.player.timeFlickerActive
  const prevDashing = state.player.isDashing
  updatePlayer(state.player, input, dt, state.combinedModifiers)

  // Audio: time flicker activation
  if (state.player.timeFlickerActive && !prevTimeFlicker) {
    audio.playAttack('flicker')
  }

  // Audio: dash start
  if (state.player.isDashing && !prevDashing) {
    audio.playDash()
  }

  // Player-obstacle collision (push player out of pillars)
  for (const obs of state.obstacles) {
    const effR = obs.state === 'rubble' ? obs.rubbleRadius : obs.radius
    const obsPos = { x: obs.x, y: obs.y }
    const d = distance(state.player.pos, obsPos)
    const minDist = S.PLAYER_SIZE + effR
    if (d < minDist && d > 0.001) {
      const push = normalize(sub(state.player.pos, obsPos))
      const amt = minDist - d
      state.player.pos = add(state.player.pos, scale(push, amt + 0.5))
    }
  }

  // Auto-attack injection (Power Fantasy mutators)
  if (state.combinedModifiers.autoLightAttack) {
    if (state.player.attacking === 'none' && state.player.attackCooldown <= 0 && !state.player.isDashing && !state.player.heavyCharging) {
      input.lightAttack = true
      // Re-run player update with injected input to trigger the attack
      updatePlayer(state.player, { ...input, lightAttack: true }, 0, state.combinedModifiers)
    }
  }
  if (state.combinedModifiers.autoPulseWave) {
    if (state.player.energy >= 80 && state.player.attacking === 'none' && !state.player.isDashing && state.player.attackCooldown <= 0) {
      updatePlayer(state.player, { ...input, pulseWave: true }, 0, state.combinedModifiers)
    }
  }

  // Dash damage (swift_strikes stack 3)
  if (state.combinedModifiers.dashDamagesEnemies && state.player.isDashing) {
    for (const enemy of state.enemies) {
      if (!enemy.isAlive) continue
      const d = distance(state.player.pos, enemy.pos)
      if (d < S.PLAYER_SIZE + enemy.size + 8) {
        enemy.hp -= 8 * dt
        if (enemy.hp <= 0) {
          enemy.hp = 0
          enemy.isAlive = false
        }
        emitHitSparks(state.particles, enemy.pos, '#22ffaa', 4)
      }
    }
  }

  // Slash trail recording — detect new attack start
  if (state.player.attacking !== 'none' && prevAttacking === 'none') {
    state.slashTrails.push({
      pos: { x: state.player.pos.x, y: state.player.pos.y },
      facing: state.player.facing,
      attackType: state.player.attacking,
      age: 0,
      maxAge: S.SLASH_TRAIL_DURATION,
    })
  }

  // Decay slash trails
  for (let i = state.slashTrails.length - 1; i >= 0; i--) {
    state.slashTrails[i].age += dt
    if (state.slashTrails[i].age >= state.slashTrails[i].maxAge) {
      state.slashTrails.splice(i, 1)
    }
  }

  // Enemies update with time scale
  for (const enemy of state.enemies) {
    updateEnemy(enemy, state.player, dt, state.timeScale)
  }

  // Enemy-obstacle collision (push enemies out of pillars)
  for (const enemy of state.enemies) {
    if (!enemy.isAlive) continue
    for (const obs of state.obstacles) {
      const effR = obs.state === 'rubble' ? obs.rubbleRadius : obs.radius
      const obsPos = { x: obs.x, y: obs.y }
      const d = distance(enemy.pos, obsPos)
      const minDist = enemy.size + effR
      if (d < minDist && d > 0.001) {
        const push = normalize(sub(enemy.pos, obsPos))
        enemy.pos = add(enemy.pos, scale(push, minDist - d + 0.5))
      }
    }
  }

  // Combat - player attacks
  // Surge zone: 2× damage when player is inside the zone
  const surgeActive = state.surgeZone !== null && distance(state.player.pos, state.surgeZone) < state.surgeZone.radius
  const effectiveMods = surgeActive
    ? {
        ...state.combinedModifiers,
        lightDamageMultiplier: (state.combinedModifiers.lightDamageMultiplier ?? 1) * 2,
        heavyDamageMultiplier: (state.combinedModifiers.heavyDamageMultiplier ?? 1) * 2,
        pulseWaveDamageMultiplier: (state.combinedModifiers.pulseWaveDamageMultiplier ?? 1) * 2,
      }
    : state.combinedModifiers
  const playerCombat = processPlayerAttacks(state.player, state.enemies, effectiveMods)
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

  // Spawn floating damage numbers
  for (const hit of playerCombat.damageHits) {
    state.damageNumbers.push({
      value: hit.damage,
      pos: { x: hit.pos.x, y: hit.pos.y },
      vel: { x: (Math.random() - 0.5) * 30, y: -55 },
      age: 0,
      lifetime: S.DAMAGE_NUMBER_LIFETIME,
      color: S.DAMAGE_NUMBER_COLORS[hit.hitType] ?? '#ffffff',
    })
  }

  // Audio: attack sounds (on new attack start)
  if (state.player.attacking !== 'none' && prevAttacking === 'none') {
    if (state.player.attacking === 'light') audio.playAttack('light')
    else if (state.player.attacking === 'heavy') audio.playAttack('heavy')
    else if (state.player.attacking === 'pulse_wave') audio.playAttack('pulse')
  }
  // Audio: enemy deaths
  for (const type of playerCombat.killedEnemyTypes) {
    audio.playEnemyDeath(type)
  }

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

  // Player attacks damage pillars (arc check, first-frame only)
  if (state.player.attacking !== 'none' && state.player.attackTime >= 0.01 && state.obstacles.length > 0) {
    const mods = state.combinedModifiers
    let pillarRange = 0
    let pillarArc = 0
    let pillarDmg = 0
    const p = state.player
    switch (p.attacking) {
      case 'light':
        pillarRange = S.LIGHT_RANGE * (mods.lightRangeMultiplier ?? 1)
        pillarArc = S.LIGHT_ARC
        pillarDmg = Math.round((S.LIGHT_DAMAGE + (p.comboCount - 1) * 3) * (mods.lightDamageMultiplier ?? 1))
        break
      case 'heavy':
        pillarRange = S.HEAVY_RANGE * (mods.heavyRangeMultiplier ?? 1)
        pillarArc = S.HEAVY_ARC
        pillarDmg = Math.round(S.HEAVY_DAMAGE * (mods.heavyDamageMultiplier ?? 1))
        break
      case 'pulse_wave':
        pillarRange = S.PULSE_WAVE_RANGE * (mods.pulseWaveRangeMultiplier ?? 1)
        pillarArc = S.PULSE_WAVE_ARC
        pillarDmg = Math.round(S.PULSE_WAVE_DAMAGE * (mods.pulseWaveDamageMultiplier ?? 1))
        break
    }
    const attackProg = p.attacking === 'light'
      ? (S.LIGHT_DURATION - p.attackTime) / S.LIGHT_DURATION
      : p.attacking === 'heavy'
        ? (S.HEAVY_DURATION - p.attackTime) / S.HEAVY_DURATION
        : (S.PULSE_WAVE_DURATION - p.attackTime) / S.PULSE_WAVE_DURATION
    if (attackProg <= 0.5) {
      for (const obs of state.obstacles) {
        if (obs.state === 'rubble') continue
        const obsPos = { x: obs.x, y: obs.y }
        const d = distance(p.pos, obsPos)
        if (d > pillarRange + obs.radius) continue
        const ang = Math.atan2(obsPos.y - p.pos.y, obsPos.x - p.pos.x)
        let diff = ang - p.facing
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        if (Math.abs(diff) > pillarArc / 2) continue
        const prevState = obs.state
        obs.hp = Math.max(0, obs.hp - pillarDmg)
        obs.state = obs.hp > obs.maxHp * 0.5 ? 'intact' : obs.hp > 0 ? 'cracked' : 'rubble'
        if (obs.state !== prevState) {
          // Emit debris particles on state change
          emitHitSparks(state.particles, obsPos, state.levelTheme.glowColor, obs.state === 'rubble' ? 20 : 10)
        }
      }
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
    audio.playLastStand()
  }

  if (enemyCombat.playerDamaged) {
    state.damageFlashTimer = S.DAMAGE_VIGNETTE_DURATION
    state.damageDir = enemyCombat.damageDir
    if (!enemyCombat.lastStandTriggered) audio.playHit(enemyCombat.damageDealt)
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

  // Arena hazards update
  if (state.hazards.length > 0 && state.player.isAlive && state.waveActive) {
    for (const hz of state.hazards) {
      const wasActive = hz.active
      hz.timer -= dt
      if (hz.timer <= 0) {
        hz.active = !hz.active
        hz.timer = hz.active ? hz.onDuration : hz.offDuration
      }

      if (hz.type === 'floor_zone' && hz.active) {
        // Damage player if inside zone
        const d = distance(state.player.pos, hz.pos)
        if (d < hz.radius + S.PLAYER_SIZE && state.player.iframes <= 0 && !state.player.isDashing) {
          state.player.hp -= S.HAZARD_ZONE_DAMAGE * dt
          if (state.player.hp <= 0) { state.player.hp = 0; state.player.isAlive = false }
          state.damageFlashTimer = Math.max(state.damageFlashTimer, 0.1)
          shakeCamera(state.camera, 4, 0.1)
        }
      }

      if (hz.type === 'wall_trap' && !wasActive && hz.active) {
        // Trap just fired — check if player is in range and in front of trap
        const trapAngle = hz.trapAngle ?? 0
        const toPlayer = sub(state.player.pos, hz.pos)
        const d = distance(state.player.pos, hz.pos)
        if (d < S.HAZARD_TRAP_RANGE) {
          const ang = Math.atan2(toPlayer.y, toPlayer.x)
          let diff = ang - trapAngle
          while (diff > Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          if (Math.abs(diff) < Math.PI / 3 && state.player.iframes <= 0 && !state.player.isDashing) {
            state.player.hp -= S.HAZARD_TRAP_DAMAGE
            state.player.iframes = S.PLAYER_IFRAMES * 0.8
            if (state.player.hp <= 0) { state.player.hp = 0; state.player.isAlive = false }
            state.damageFlashTimer = S.DAMAGE_VIGNETTE_DURATION
            state.damageDir = normalize(sub(state.player.pos, hz.pos))
            shakeCamera(state.camera, 8, 0.15)
            emitHitSparks(state.particles, state.player.pos, hz.color, 8)
          }
        }
        // Emit visual sparks from trap
        emitHitSparks(state.particles, hz.pos, hz.color, 12)
      }

      if (hz.type === 'pulse_center' && !wasActive && hz.active) {
        // Pulse shockwave — damage player and enemies in radius
        const playerDist = distance(state.player.pos, hz.pos)
        if (playerDist < hz.radius && state.player.iframes <= 0 && !state.player.isDashing) {
          state.player.hp -= S.HAZARD_PULSE_DAMAGE
          state.player.iframes = S.PLAYER_IFRAMES
          if (state.player.hp <= 0) { state.player.hp = 0; state.player.isAlive = false }
          state.damageFlashTimer = S.DAMAGE_VIGNETTE_DURATION
          state.damageDir = normalize(sub(state.player.pos, hz.pos))
          shakeCamera(state.camera, 12, 0.2)
        }
        // Damage enemies in range too (helpful to player)
        for (const enemy of state.enemies) {
          if (!enemy.isAlive) continue
          if (distance(enemy.pos, hz.pos) < hz.radius) {
            enemy.hp -= S.HAZARD_PULSE_DAMAGE
            if (enemy.hp <= 0) { enemy.hp = 0; enemy.isAlive = false }
          }
        }
        // Big particle ring
        emitPulseWave(state.particles, hz.pos, 0, Math.PI * 2)
        emitHitSparks(state.particles, hz.pos, hz.color, 20)
        shakeCamera(state.camera, 10, 0.3)
      }
    }
  }

  // Arena shrink (starts at SHRINK_START_WAVE)
  if (state.wave >= S.SHRINK_START_WAVE && state.waveActive) {
    const newRadius = Math.max(S.SHRINK_MIN_RADIUS, S.ARENA_RADIUS - S.SHRINK_RATE * dt)
    setArenaRadius(newRadius)
  }

  // Death explosions
  for (const enemy of state.enemies) {
    if (!enemy.isAlive && enemy.hp <= 0) {
      emitTypedDeathExplosion(enemy.type, enemy.pos, state.particles)

      // Affix death effects
      const affix = enemy.affixState.affix
      if (affix) {
        emitAffixDeathEffect(affix, enemy.pos, state.particles)

        // Volatile: player damage + chain damage to nearby enemies
        if (affix.explodesOnDeath && state.player.isAlive) {
          const explosionRadius = affix.explosionRadius ?? 60
          const explosionDamage = affix.explosionDamage ?? 15

          // Damage player if in range
          const playerDist = distance(enemy.pos, state.player.pos)
          if (playerDist <= explosionRadius + S.PLAYER_SIZE) {
            if (state.player.iframes <= 0 && !state.player.isDashing) {
              state.player.hp -= explosionDamage
              state.player.iframes = S.PLAYER_IFRAMES * 0.5
              state.player.flashTimer = 0.1
              shakeCamera(state.camera, 8, 0.15)
            }
          }

          // Chain damage to nearby alive enemies
          for (const other of state.enemies) {
            if (other === enemy || !other.isAlive) continue
            const chainDist = distance(enemy.pos, other.pos)
            if (chainDist <= explosionRadius) {
              const chainDamage = Math.round(explosionDamage * 0.5)
              other.hp -= chainDamage
              if (other.hp <= 0) {
                other.hp = 0
                other.isAlive = false
              }
              emitHitSparks(state.particles, other.pos, '#ff8844', 6)
            }
          }
        }
      }

      enemy.hp = -999 // prevent re-triggering
    }
  }

  // Clean dead enemies
  state.enemies = state.enemies.filter(e => e.isAlive)

  // Wave management
  if (!state.waveActive) {
    // Wave Event offer: Y to accept, N to reject
    if (state.pendingWaveEvent !== null) {
      if (input.acceptWaveEvent) {
        state.activeWaveEvent = state.pendingWaveEvent
        state.pendingWaveEvent = null
        // Give instant rewards
        if (state.activeWaveEvent.bonusHp) {
          state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.activeWaveEvent.bonusHp)
        }
        if (state.activeWaveEvent.bonusEnergy) {
          state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + state.activeWaveEvent.bonusEnergy)
        }
      } else if (input.rejectWaveEvent) {
        state.activeWaveEvent = null
        state.pendingWaveEvent = null
      }
    }

    // Timer only counts down while no event is pending (pause during offer)
    if (state.pendingWaveEvent === null) {
      state.waveTimer -= dt
    }

    if (state.waveTimer <= 0 && state.pendingWaveEvent === null) {
      state.wave++

      // ── Level transition ──
      const newLevel = getLevelNumber(state.wave)
      if (newLevel !== state.level || isLevelTransition(state.wave)) {
        state.level = newLevel
        state.levelTheme = getLevelTheme(state.wave)
        state.obstacles = generateObstacles(state.levelTheme, S.ARENA_CENTER_X, S.ARENA_CENTER_Y)
        state.hazards = generateHazards(state.levelTheme, S.ARENA_CENTER_X, S.ARENA_CENTER_Y)
        setArenaRadius(state.levelTheme.arenaRadius)
        state.levelUpTimer = 3.0
        state.levelUpName = state.levelTheme.name
        audio.playLevelUp()
      }

      const { arenaRadius, difficultyMult } = state.levelTheme

      // Select affix for this wave
      state.currentAffix = selectAffixForWave(state.wave)

      // Spawn enemies — double_enemies event spawns 1.5× count
      const isDoubleEnemies = state.activeWaveEvent?.effectType === 'double_enemies'
      let enemies = spawnWaveEnemies(state.wave, arenaRadius, S.ARENA_CENTER_X, S.ARENA_CENTER_Y, difficultyMult, state.currentAffix)
      if (isDoubleEnemies) {
        const extras = spawnWaveEnemies(state.wave, arenaRadius, S.ARENA_CENTER_X, S.ARENA_CENTER_Y, difficultyMult, state.currentAffix)
        // Add half the count of extras (50% more)
        enemies = enemies.concat(extras.slice(0, Math.ceil(extras.length * 0.5)))
      }
      state.enemies = enemies

      // enemy_frenzy: boost speed and attack rate of all enemies
      if (state.activeWaveEvent?.effectType === 'enemy_frenzy') {
        for (const enemy of state.enemies) {
          enemy.speed *= 1.5
          enemy.attackCooldown *= 0.66
        }
      }

      // surge_zone: place a power zone at a random spot in arena
      if (state.activeWaveEvent?.effectType === 'surge_zone') {
        const ang = rng() * Math.PI * 2
        const dist = arenaRadius * 0.35
        state.surgeZone = { x: S.ARENA_CENTER_X + Math.cos(ang) * dist, y: S.ARENA_CENTER_Y + Math.sin(ang) * dist, radius: 80 }
      } else {
        state.surgeZone = null
      }

      // Reset pillars to intact for each new wave
      for (const obs of state.obstacles) {
        obs.hp = obs.maxHp
        obs.state = 'intact'
      }
      state.waveActive = true
      state.waveTimer = 2.5
      audio.setMusicIntensity(state.wave)
      audio.playWaveStart(state.wave)

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
      audio.playWaveEnd()

      // Apply wave event score bonus if accepted
      if (state.activeWaveEvent) {
        state.score += state.activeWaveEvent.bonusScore
        state.activeWaveEvent = null
      }
      state.surgeZone = null

      // Select wave event for next wave (shown during inter-wave break)
      state.pendingWaveEvent = selectWaveEvent(state.wave + 1)

      // Finalize contract
      const contract = state.contractState.contract
      const progress = state.contractState.progress
      progress.finalCombo = state.player.comboCount
      if (contract && state.contractState.status === 'active') {
        const finalStatus = finalizeContract(contract, progress, state.originalEnemyCounts)
        state.contractState.status = finalStatus
        audio.playContractResult(finalStatus === 'completed')

        // Apply rewards if completed
        if (finalStatus === 'completed') {
          state.score += contract.scoreBonus
          state.player.hp = Math.min(state.player.maxHp, state.player.hp + contract.hpRestore)
          state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + contract.energyRestore)
          if (contract.consumableReward) {
            state.consumables.push(contract.consumableReward)
          }
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
          state.mutatorSelectionTimer = 0
        }
      }
    }
  }

  // Contract failure penalty — applied once when status transitions to 'failed'
  if (
    state.contractState.contract &&
    state.contractState.status === 'failed' &&
    !state.contractState.penaltyApplied
  ) {
    state.contractState.penaltyApplied = true
    if (state.contractState.contract.failurePenalty === 'drop_to_1hp' && state.player.isAlive && state.player.hp > 1) {
      state.player.hp = 1
      state.player.flashTimer = 0.5
      state.damageFlashTimer = S.DAMAGE_VIGNETTE_DURATION
      state.damageDir = { x: 0, y: 0 }
      shakeCamera(state.camera, 14, 0.3)
    }
  }

  // Hit effects timer
  for (let i = state.hitEffects.length - 1; i >= 0; i--) {
    state.hitEffects[i].time -= dt
    if (state.hitEffects[i].time <= 0) {
      state.hitEffects.splice(i, 1)
    }
  }

  // Damage numbers — age and cull
  for (let i = state.damageNumbers.length - 1; i >= 0; i--) {
    state.damageNumbers[i].age += dt
    if (state.damageNumbers[i].age >= state.damageNumbers[i].lifetime) {
      state.damageNumbers.splice(i, 1)
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

export function renderGame(
  state: GameState,
  ctx: CanvasRenderingContext2D,
  dailyLeaderboard?: DailyEntry[],
  assets?: AssetCache | null,
): void {
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
    state.hazards,
    state.level,
    state.levelUpTimer,
    state.levelUpName,
    // Mutator system
    state.mutatorSelectionActive,
    state.mutatorChoices,
    state.activeMutators,
    // Contract system
    state.contractState,
    // Affix system
    state.currentAffix,
    // Last Stand system
    state.lastStandActive,
    state.lastStandTimer,
    state.lastStandUsed,
    // Death recap
    state.damageByEnemyType,
    // Daily Challenge
    state.isDailyChallenge,
    dailyLeaderboard,
    // Mutator feedback
    state.mutatorFeedback,
    // Damage feedback
    state.damageFlashTimer,
    state.damageDir,
    // Slash trails
    state.slashTrails,
    // Mutator ceremony
    state.mutatorSelectionTimer,
    state.mutatorPeekActive,
    state.playerRarityGlowTimer,
    state.playerRarityGlowColor,
    // Consumables
    state.consumables,
    state.consumableActive,
    // Wave events
    state.pendingWaveEvent,
    state.activeWaveEvent,
    state.surgeZone,
    // Sprite assets
    assets,
    // Damage numbers
    state.damageNumbers,
  )
}

export function resetGame(state: GameState): GameState {
  const hs = state.highScore
  const newState = createGameState(state.isDailyChallenge)
  newState.highScore = hs
  return newState
}
