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
// Slash Trails
export const SLASH_TRAIL_DURATION = 0.15         // seconds trail lingers
export const SLASH_AFTER_IMAGE_ALPHA = 0.35       // ghost player opacity
export const SLASH_RIBBON_WIDTH = 6               // energy ribbon px

// Damage Feedback
export const DAMAGE_VIGNETTE_DURATION = 0.35   // seconds
export const DAMAGE_BLUR_DURATION = 0.12        // directional blur duration
export const DAMAGE_BLUR_DISTANCE = 18          // max pixel offset for blur effect

export const HIT_FREEZE_TAP = 0.03             // light attack micro freeze
export const HIT_FREEZE_HEAVY_PARTIAL = 0.07   // partially charged heavy
export const HIT_FREEZE_HEAVY_FULL = 0.16      // fully charged heavy (160ms)
export const HIT_FREEZE_PULSE = 0.09           // pulse wave
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

// Death Recap Hints
export const DEATH_HINTS: Record<string, string> = {
  normal: "Normal enemies swarm you. Keep moving and don't get surrounded!",
  sniper: "Snipers telegraph with a red laser. Dash diagonally when you see it!",
  heavy: "Heavy shockwaves have limited range. Stay outside and strike after!",
  fast: "Fast enemies dodge light attacks. Use heavy or pulse wave to catch them!",
  none: "Keep practicing! Use dash (Space/Shift) to avoid damage.",
}

// Pillars
export const PILLAR_HP = 30

// Arena Hazards
export const HAZARD_ZONE_DAMAGE = 8         // damage per second while standing in zone
export const HAZARD_PULSE_DAMAGE = 15       // instant damage when pulse fires
export const HAZARD_TRAP_DAMAGE = 12        // instant damage from wall trap
export const HAZARD_TRAP_RANGE = 220        // max range wall trap can hit player
export const SHRINK_START_WAVE = 10         // wave to start arena shrink
export const SHRINK_RATE = 1.5             // px per second
export const SHRINK_MIN_RADIUS = 210        // minimum arena radius

// Waves
export const WAVE_DELAY = 3.0
export let ARENA_RADIUS = 300 // mutable – updated by engine on level transition
export const ARENA_CENTER_X = GAME_WIDTH / 2
export const ARENA_CENTER_Y = GAME_HEIGHT / 2

export function setArenaRadius(r: number): void {
  ARENA_RADIUS = r
}

// Sprites
export const SPRITE_SIZE = 64 // px per frame in sprite sheet

// Visual Clarity Polish
export const DAMAGE_NUMBER_LIFETIME = 0.8       // seconds floating numbers are visible
export const AIM_ARC_ALPHA = 0.07               // opacity of the passive aim direction preview
export const TELEGRAPH_THRESHOLD = 0.4          // seconds before attack to show enemy warning ring
export const DAMAGE_NUMBER_COLORS: Record<string, string> = {
  light: '#cc99ff',
  heavy: '#ffaa22',
  pulse: '#44ccff',
}

// ── Difficulty System ─────────────────────────────────────────────────────────
export type DifficultyLevel = 'very_easy' | 'easy' | 'normal' | 'arcade'

export interface DifficultyPreset {
  enemyDamageMult: number   // multiplied on top of level-based scaling
  enemySpeedMult: number
  enemyHpMult: number
  playerHpBonus: number     // flat HP added to base PLAYER_HP (can be negative)
  waveCountMult: number     // scales enemy count per wave (min 1 per type)
  hazardDamageMult: number
  shrinkStartWave: number   // wave number when arena starts shrinking
}

export const DIFFICULTY_PRESETS: Record<DifficultyLevel | 'classroom', DifficultyPreset> = {
  // Grades 1-2 classroom and standalone option for very young/new players
  very_easy: {
    enemyDamageMult: 0.40, enemySpeedMult: 0.55, enemyHpMult: 0.60,
    playerHpBonus: 100, waveCountMult: 0.60, hazardDamageMult: 0.20, shrinkStartWave: 18,
  },
  easy: {
    enemyDamageMult: 0.60, enemySpeedMult: 0.72, enemyHpMult: 0.75,
    playerHpBonus: 50, waveCountMult: 0.75, hazardDamageMult: 0.50, shrinkStartWave: 12,
  },
  normal: {
    enemyDamageMult: 1.00, enemySpeedMult: 1.00, enemyHpMult: 1.00,
    playerHpBonus: 0,  waveCountMult: 1.00, hazardDamageMult: 1.00, shrinkStartWave: 10,
  },
  arcade: {
    enemyDamageMult: 1.25, enemySpeedMult: 1.12, enemyHpMult: 1.20,
    playerHpBonus: -15, waveCountMult: 1.20, hazardDamageMult: 1.25, shrinkStartWave: 8,
  },
  // Grades 3-6 classroom override (quiz-gated mutators, educational focus)
  classroom: {
    enemyDamageMult: 0.65, enemySpeedMult: 0.75, enemyHpMult: 0.80,
    playerHpBonus: 30,  waveCountMult: 0.75, hazardDamageMult: 0.40, shrinkStartWave: 14,
  },
}

// ── Hebrew Classroom Educational Layer ───────────────────────────────────────
export const QUESTION_FEEDBACK_DURATION = 2000   // ms to show correct answer after wrong attempt
export const KEYBOARD_PANEL_FADE_DELAY = 30000   // ms before panel fades (Grade 3-4)
export const LETTER_FLASH_LIFETIME = 1.2         // seconds letter flash visible
export const KEYBOARD_PANEL_GRADES = [1, 2, 3, 4] // grades that show the keyboard panel
export const LETTER_FLASH_GRADES = [1, 2, 3, 4]   // grades that show letter flashes
export const QUIZ_GRADES = [3, 4, 5, 6]            // grades that get the post-wave quiz
