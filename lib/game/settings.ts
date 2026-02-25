// ========================
// SHADOW PULSE - Settings
// ========================

// Window
export const GAME_WIDTH = 1280
export const GAME_HEIGHT = 720

// Colors
export const BG_COLOR = '#0f0f19'
export const PLAYER_COLOR = '#7800ff'
export const PLAYER_DASH_COLOR = '#b366ff'
export const ENERGY_COLOR = '#5000ff'
export const ENERGY_BG_COLOR = '#1a1a2e'
export const HP_COLOR = '#ff2244'
export const HP_BG_COLOR = '#1a1a2e'
export const ENEMY_COLORS = {
  normal: '#ff3344',
  sniper: '#ffaa22',
  heavy: '#ff6633',
  fast: '#22ffaa',
}
export const PULSE_WAVE_COLOR = '#6622ff'
export const NEON_GLOW = '#7b2fff'
export const HIT_FLASH_COLOR = '#ffffff'

// Player
export const PLAYER_SPEED = 280
export const PLAYER_SIZE = 20
export const PLAYER_HP = 100
export const PLAYER_IFRAMES = 0.5

// Dash
export const DASH_SPEED = 900
export const DASH_DURATION = 0.12
export const DASH_COST = 20
export const DASH_COOLDOWN = 0.3

// Energy
export const MAX_ENERGY = 100
export const ENERGY_REGEN = 8
export const ENERGY_PER_HIT = 12
export const ENERGY_PERFECT_DODGE = 25

// Combat - Light Attack
export const LIGHT_DAMAGE = 12
export const LIGHT_RANGE = 55
export const LIGHT_ARC = Math.PI * 0.6
export const LIGHT_DURATION = 0.12
export const LIGHT_COOLDOWN = 0.18
export const LIGHT_KNOCKBACK = 120

// Combat - Heavy Attack
export const HEAVY_DAMAGE = 30
export const HEAVY_RANGE = 70
export const HEAVY_ARC = Math.PI * 0.8
export const HEAVY_DURATION = 0.25
export const HEAVY_CHARGE_TIME = 0.3
export const HEAVY_COOLDOWN = 0.4
export const HEAVY_KNOCKBACK = 250

// Combat - Pulse Wave
export const PULSE_WAVE_DAMAGE = 20
export const PULSE_WAVE_RANGE = 150
export const PULSE_WAVE_ARC = Math.PI * 0.5
export const PULSE_WAVE_COST = 35
export const PULSE_WAVE_KNOCKBACK = 350
export const PULSE_WAVE_DURATION = 0.3

// Combat - Time Flicker
export const TIME_FLICKER_DURATION = 1.5
export const TIME_FLICKER_COST = 40
export const TIME_FLICKER_SLOW = 0.15

// Hit Feel
export const HIT_FREEZE_TIME = 0.045
export const CAMERA_SHAKE_INTENSITY = 6
export const CAMERA_SHAKE_DURATION = 0.12
export const HEAVY_SHAKE_INTENSITY = 12
export const HEAVY_SHAKE_DURATION = 0.2

// Last Stand (one-time lethal hit survival)
export const LAST_STAND_SLOW_MO_DURATION = 1.0  // Duration of slow-mo effect
export const LAST_STAND_SLOW_MO_SCALE = 0.15    // Time scale during slow-mo (15% speed)
export const LAST_STAND_IFRAMES = 1.5           // Invincibility after Last Stand
export const LAST_STAND_HP = 1                  // HP player survives with

// Enemies
export const ENEMY_SIZE = 18

export const NORMAL_ENEMY = {
  hp: 40,
  speed: 100,
  damage: 8,
  attackRange: 45,
  attackCooldown: 1.2,
  color: ENEMY_COLORS.normal,
}

export const SNIPER_ENEMY = {
  hp: 25,
  speed: 60,
  damage: 15,
  attackRange: 300,
  attackCooldown: 2.5,
  preferredDistance: 200,
  color: ENEMY_COLORS.sniper,
}

export const HEAVY_ENEMY = {
  hp: 120,
  speed: 50,
  damage: 25,
  attackRange: 55,
  attackCooldown: 2.0,
  shockwaveRange: 80,
  color: ENEMY_COLORS.heavy,
}

export const FAST_ENEMY = {
  hp: 30,
  speed: 200,
  damage: 10,
  attackRange: 40,
  attackCooldown: 0.8,
  dodgeChance: 0.4,
  color: ENEMY_COLORS.fast,
}

// Contract Banner
export const CONTRACT_BANNER_Y = 70
export const CONTRACT_BANNER_HEIGHT = 50

// Waves
export const WAVE_DELAY = 3.0
export let ARENA_RADIUS = 300 // mutable – updated by engine on level transition
export const ARENA_CENTER_X = GAME_WIDTH / 2
export const ARENA_CENTER_Y = GAME_HEIGHT / 2

export function setArenaRadius(r: number): void {
  ARENA_RADIUS = r
}
