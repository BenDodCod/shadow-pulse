import { Vec2, vec2, add, scale, normalize, length, fromAngle, distance } from './vec2'
import * as S from './settings'

export type AttackType = 'none' | 'light' | 'heavy' | 'pulse_wave'

export interface Player {
  pos: Vec2
  vel: Vec2
  facing: number // angle in radians
  hp: number
  maxHp: number
  energy: number
  maxEnergy: number

  // Movement
  speed: number
  isDashing: boolean
  dashTime: number
  dashCooldown: number
  dashDir: Vec2

  // Combat
  attacking: AttackType
  attackTime: number
  attackCooldown: number
  comboCount: number
  comboTimer: number
  heavyCharging: boolean
  heavyChargeTime: number

  // Abilities
  timeFlickerActive: boolean
  timeFlickerTimer: number
  pulseWaveActive: boolean
  pulseWaveTimer: number

  // Defense
  iframes: number
  isAlive: boolean

  // Visual
  flashTimer: number
  trailPositions: Vec2[]
}

export function createPlayer(): Player {
  return {
    pos: vec2(S.ARENA_CENTER_X, S.ARENA_CENTER_Y),
    vel: vec2(0, 0),
    facing: 0,
    hp: S.PLAYER_HP,
    maxHp: S.PLAYER_HP,
    energy: 50,
    maxEnergy: S.MAX_ENERGY,
    speed: S.PLAYER_SPEED,
    isDashing: false,
    dashTime: 0,
    dashCooldown: 0,
    dashDir: vec2(1, 0),
    attacking: 'none',
    attackTime: 0,
    attackCooldown: 0,
    comboCount: 0,
    comboTimer: 0,
    heavyCharging: false,
    heavyChargeTime: 0,
    timeFlickerActive: false,
    timeFlickerTimer: 0,
    pulseWaveActive: false,
    pulseWaveTimer: 0,
    iframes: 0,
    isAlive: true,
    flashTimer: 0,
    trailPositions: [],
  }
}

export interface InputState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  dash: boolean
  lightAttack: boolean
  heavyAttack: boolean
  heavyRelease: boolean
  pulseWave: boolean
  timeFlicker: boolean
}

export function getMovementDirection(input: InputState): Vec2 {
  let dx = 0
  let dy = 0
  if (input.up) dy -= 1
  if (input.down) dy += 1
  if (input.left) dx -= 1
  if (input.right) dx += 1
  const dir = vec2(dx, dy)
  return length(dir) > 0 ? normalize(dir) : dir
}

export function updatePlayer(player: Player, input: InputState, dt: number): void {
  if (!player.isAlive) return

  // Timers
  if (player.iframes > 0) player.iframes -= dt
  if (player.flashTimer > 0) player.flashTimer -= dt
  if (player.dashCooldown > 0) player.dashCooldown -= dt
  if (player.attackCooldown > 0) player.attackCooldown -= dt
  if (player.comboTimer > 0) {
    player.comboTimer -= dt
    if (player.comboTimer <= 0) player.comboCount = 0
  }

  // Time Flicker
  if (player.timeFlickerActive) {
    player.timeFlickerTimer -= dt
    if (player.timeFlickerTimer <= 0) {
      player.timeFlickerActive = false
    }
  }

  // Pulse Wave timer
  if (player.pulseWaveActive) {
    player.pulseWaveTimer -= dt
    if (player.pulseWaveTimer <= 0) {
      player.pulseWaveActive = false
    }
  }

  // Attack timers
  if (player.attacking !== 'none') {
    player.attackTime -= dt
    if (player.attackTime <= 0) {
      player.attacking = 'none'
    }
  }

  const dir = getMovementDirection(input)

  // Update facing direction based on movement
  if (length(dir) > 0) {
    player.facing = Math.atan2(dir.y, dir.x)
  }

  // Heavy charge
  if (input.heavyAttack && !player.heavyCharging && player.attacking === 'none' && player.attackCooldown <= 0) {
    player.heavyCharging = true
    player.heavyChargeTime = 0
  }
  if (player.heavyCharging) {
    player.heavyChargeTime += dt
    if (input.heavyRelease || player.heavyChargeTime >= S.HEAVY_CHARGE_TIME) {
      player.heavyCharging = false
      player.attacking = 'heavy'
      player.attackTime = S.HEAVY_DURATION
      player.attackCooldown = S.HEAVY_COOLDOWN
      player.comboCount = 0
      player.comboTimer = 0
    }
  }

  // Dash
  if (input.dash && !player.isDashing && player.dashCooldown <= 0 && player.energy >= S.DASH_COST && player.attacking === 'none') {
    player.isDashing = true
    player.dashTime = S.DASH_DURATION
    player.energy -= S.DASH_COST
    player.dashCooldown = S.DASH_COOLDOWN
    player.dashDir = length(dir) > 0 ? dir : fromAngle(player.facing)
    player.iframes = S.DASH_DURATION + 0.05
  }

  if (player.isDashing) {
    player.dashTime -= dt
    player.vel = scale(player.dashDir, S.DASH_SPEED)
    if (player.dashTime <= 0) {
      player.isDashing = false
    }
  } else if (player.attacking !== 'none') {
    // Slow movement during attacks
    player.vel = scale(dir, player.speed * 0.3)
  } else if (player.heavyCharging) {
    player.vel = scale(dir, player.speed * 0.2)
  } else {
    player.vel = scale(dir, player.speed)
  }

  // Light attack
  if (input.lightAttack && player.attacking === 'none' && player.attackCooldown <= 0 && !player.heavyCharging && !player.isDashing) {
    player.attacking = 'light'
    player.attackTime = S.LIGHT_DURATION
    player.attackCooldown = S.LIGHT_COOLDOWN
    player.comboCount = Math.min(player.comboCount + 1, 3)
    player.comboTimer = 0.6
  }

  // Pulse Wave
  if (input.pulseWave && player.energy >= S.PULSE_WAVE_COST && player.attacking === 'none' && !player.isDashing) {
    player.pulseWaveActive = true
    player.pulseWaveTimer = S.PULSE_WAVE_DURATION
    player.energy -= S.PULSE_WAVE_COST
    player.attacking = 'pulse_wave'
    player.attackTime = S.PULSE_WAVE_DURATION
    player.attackCooldown = 0.5
  }

  // Time Flicker
  if (input.timeFlicker && player.energy >= S.TIME_FLICKER_COST && !player.timeFlickerActive) {
    player.timeFlickerActive = true
    player.timeFlickerTimer = S.TIME_FLICKER_DURATION
    player.energy -= S.TIME_FLICKER_COST
  }

  // Energy regen
  player.energy = Math.min(player.maxEnergy, player.energy + S.ENERGY_REGEN * dt)

  // Apply velocity
  player.pos = add(player.pos, scale(player.vel, dt))

  // Arena bounds
  const dx = player.pos.x - S.ARENA_CENTER_X
  const dy = player.pos.y - S.ARENA_CENTER_Y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > S.ARENA_RADIUS - S.PLAYER_SIZE) {
    const norm = normalize(vec2(dx, dy))
    player.pos = add(vec2(S.ARENA_CENTER_X, S.ARENA_CENTER_Y), scale(norm, S.ARENA_RADIUS - S.PLAYER_SIZE))
  }

  // Trail
  if (player.isDashing) {
    player.trailPositions.push({ ...player.pos })
    if (player.trailPositions.length > 8) player.trailPositions.shift()
  } else {
    if (player.trailPositions.length > 0) player.trailPositions.shift()
  }
}

export function damagePlayer(player: Player, damage: number): boolean {
  if (player.iframes > 0 || player.isDashing || !player.isAlive) return false
  player.hp -= damage
  player.iframes = S.PLAYER_IFRAMES
  player.flashTimer = 0.1
  if (player.hp <= 0) {
    player.hp = 0
    player.isAlive = false
  }
  return true
}
