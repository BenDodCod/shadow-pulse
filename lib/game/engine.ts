import { Player, createPlayer, updatePlayer, InputState } from './player'
import { Enemy, updateEnemy } from './enemy'
import { Camera, createCamera, shakeCamera, updateCamera } from './camera'
import { ParticleSystem, createParticleSystem, updateParticles, emitHitSparks, emitPulseWave, emitDeathExplosion, emitAmbientParticle } from './particles'
import { processPlayerAttacks, processEnemyAttacks, HitEffect } from './combat'
import { spawnWaveEnemies } from './waves'
import { render } from './renderer'
import { LevelTheme, Obstacle, getLevelTheme, getLevelNumber, isLevelTransition, generateObstacles } from './levels'
import * as S from './settings'
import { setArenaRadius } from './settings'

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
  }
}

export function updateGame(state: GameState, input: InputState, dt: number): void {
  if (state.gameOver) {
    return
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

  // Time scale from Time Flicker
  state.timeScale = state.player.timeFlickerActive ? S.TIME_FLICKER_SLOW : 1

  // Player update (always full speed - player is immune to time slow)
  updatePlayer(state.player, input, dt)

  // Enemies update with time scale
  for (const enemy of state.enemies) {
    updateEnemy(enemy, state.player, dt, state.timeScale)
  }

  // Combat - player attacks
  const playerCombat = processPlayerAttacks(state.player, state.enemies)
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

  // Pulse wave particles
  if (state.player.pulseWaveActive && state.player.pulseWaveTimer > S.PULSE_WAVE_DURATION - 0.05) {
    emitPulseWave(state.particles, state.player.pos, state.player.facing, S.PULSE_WAVE_ARC)
  }

  // Enemy attacks
  const enemyCombat = processEnemyAttacks(state.player, state.enemies)
  if (enemyCombat.playerDamaged) {
    shakeCamera(state.camera, enemyCombat.cameraShake.intensity, enemyCombat.cameraShake.duration)
    for (const effect of enemyCombat.hitEffects) {
      emitHitSparks(state.particles, effect.pos, '#ff2244', 10)
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
    }
  } else {
    if (state.waveTimer > 0) state.waveTimer -= dt
    if (state.enemies.length === 0) {
      state.waveActive = false
      state.waveTimer = S.WAVE_DELAY
      state.score += state.wave * 100
      // Heal between waves
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 20)
      state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + 30)
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
  )
}

export function resetGame(state: GameState): GameState {
  const hs = state.highScore
  const newState = createGameState()
  newState.highScore = hs
  return newState
}
