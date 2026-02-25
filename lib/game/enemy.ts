import { Vec2, vec2, sub, add, scale, normalize, distance, length, fromAngle, angleBetween } from './vec2'
import * as S from './settings'
import type { Player } from './player'

export type EnemyType = 'normal' | 'sniper' | 'heavy' | 'fast'

export interface Enemy {
  id: number
  type: EnemyType
  pos: Vec2
  vel: Vec2
  hp: number
  maxHp: number
  speed: number
  damage: number
  attackRange: number
  attackCooldown: number
  attackTimer: number
  isAttacking: boolean
  attackAnimTimer: number
  color: string
  size: number
  isAlive: boolean
  flashTimer: number
  knockbackVel: Vec2
  knockbackTime: number
  stunTime: number
  // Sniper specific
  laserWarning: boolean
  laserAngle: number
  // Fast specific
  dodgeCooldown: number
  // Heavy specific
  shockwaveActive: boolean
  shockwaveTimer: number
  shockwaveRange: number
}

let nextId = 0

export function createEnemy(type: EnemyType, x: number, y: number, difficultyMult = 1.0): Enemy {
  const configs: Record<EnemyType, typeof S.NORMAL_ENEMY & { preferredDistance?: number; dodgeChance?: number; shockwaveRange?: number }> = {
    normal: S.NORMAL_ENEMY,
    sniper: S.SNIPER_ENEMY,
    heavy: S.HEAVY_ENEMY,
    fast: S.FAST_ENEMY,
  }
  const cfg = configs[type]

  const scaledHp = Math.round(cfg.hp * difficultyMult)
  const scaledSpeed = cfg.speed * Math.sqrt(difficultyMult) // speed grows slower than hp
  const scaledDamage = Math.round(cfg.damage * (1 + (difficultyMult - 1) * 0.6)) // damage scales gently

  return {
    id: nextId++,
    type,
    pos: vec2(x, y),
    vel: vec2(0, 0),
    hp: scaledHp,
    maxHp: scaledHp,
    speed: scaledSpeed,
    damage: scaledDamage,
    attackRange: cfg.attackRange,
    attackCooldown: cfg.attackCooldown,
    attackTimer: cfg.attackCooldown * 0.5 + Math.random() * cfg.attackCooldown * 0.5,
    isAttacking: false,
    attackAnimTimer: 0,
    color: cfg.color,
    size: type === 'heavy' ? 26 : S.ENEMY_SIZE,
    isAlive: true,
    flashTimer: 0,
    knockbackVel: vec2(0, 0),
    knockbackTime: 0,
    stunTime: 0,
    laserWarning: false,
    laserAngle: 0,
    dodgeCooldown: 0,
    shockwaveActive: false,
    shockwaveTimer: 0,
    shockwaveRange: (cfg as typeof S.HEAVY_ENEMY).shockwaveRange || 0,
  }
}

export function updateEnemy(enemy: Enemy, player: Player, dt: number, timeScale: number): void {
  if (!enemy.isAlive) return

  const adt = dt * timeScale

  // Timers
  if (enemy.flashTimer > 0) enemy.flashTimer -= dt // flash not affected by time scale
  if (enemy.stunTime > 0) {
    enemy.stunTime -= adt
    enemy.vel = vec2(0, 0)
  }

  // Knockback
  if (enemy.knockbackTime > 0) {
    enemy.knockbackTime -= adt
    enemy.pos = add(enemy.pos, scale(enemy.knockbackVel, adt))
    enemy.knockbackVel = scale(enemy.knockbackVel, 0.9)
    return
  }

  if (enemy.stunTime > 0) return

  const distToPlayer = distance(enemy.pos, player.pos)
  const dirToPlayer = distToPlayer > 0 ? normalize(sub(player.pos, enemy.pos)) : vec2(1, 0)

  // Attack timer
  enemy.attackTimer -= adt
  if (enemy.attackAnimTimer > 0) {
    enemy.attackAnimTimer -= adt
    if (enemy.attackAnimTimer <= 0) {
      enemy.isAttacking = false
    }
  }

  // Shockwave timer
  if (enemy.shockwaveActive) {
    enemy.shockwaveTimer -= adt
    if (enemy.shockwaveTimer <= 0) {
      enemy.shockwaveActive = false
    }
  }

  // AI by type
  switch (enemy.type) {
    case 'normal':
      updateNormalAI(enemy, player, dirToPlayer, distToPlayer, adt)
      break
    case 'sniper':
      updateSniperAI(enemy, player, dirToPlayer, distToPlayer, adt)
      break
    case 'heavy':
      updateHeavyAI(enemy, player, dirToPlayer, distToPlayer, adt)
      break
    case 'fast':
      updateFastAI(enemy, player, dirToPlayer, distToPlayer, adt)
      break
  }

  // Apply velocity
  enemy.pos = add(enemy.pos, scale(enemy.vel, adt))

  // Arena bounds
  const dx = enemy.pos.x - S.ARENA_CENTER_X
  const dy = enemy.pos.y - S.ARENA_CENTER_Y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > S.ARENA_RADIUS - enemy.size) {
    const norm = normalize(vec2(dx, dy))
    enemy.pos = add(vec2(S.ARENA_CENTER_X, S.ARENA_CENTER_Y), scale(norm, S.ARENA_RADIUS - enemy.size))
  }
}

function updateNormalAI(enemy: Enemy, player: Player, dir: Vec2, dist: number, dt: number): void {
  if (dist > enemy.attackRange + 10) {
    // Chase player
    enemy.vel = scale(dir, enemy.speed)
  } else {
    // In range - attack
    enemy.vel = scale(dir, enemy.speed * 0.2)
    if (enemy.attackTimer <= 0 && !enemy.isAttacking) {
      enemy.isAttacking = true
      enemy.attackAnimTimer = 0.3
      enemy.attackTimer = enemy.attackCooldown
    }
  }
}

function updateSniperAI(enemy: Enemy, player: Player, dir: Vec2, dist: number, dt: number): void {
  const preferred = S.SNIPER_ENEMY.preferredDistance

  if (dist < preferred * 0.7) {
    // Too close, run away
    enemy.vel = scale(dir, -enemy.speed * 1.5)
    enemy.laserWarning = false
  } else if (dist > preferred * 1.3) {
    // Too far, get closer
    enemy.vel = scale(dir, enemy.speed)
    enemy.laserWarning = false
  } else {
    // Good range - prepare to fire
    enemy.vel = vec2(0, 0)
    if (enemy.attackTimer <= 0 && !enemy.isAttacking) {
      if (!enemy.laserWarning) {
        // Show warning laser
        enemy.laserWarning = true
        enemy.laserAngle = angleBetween(enemy.pos, player.pos)
        enemy.attackTimer = 0.8 // warning time
      } else {
        // Fire
        enemy.isAttacking = true
        enemy.attackAnimTimer = 0.2
        enemy.attackTimer = enemy.attackCooldown
        enemy.laserWarning = false
      }
    }
  }
}

function updateHeavyAI(enemy: Enemy, player: Player, dir: Vec2, dist: number, dt: number): void {
  if (dist > enemy.attackRange + 20) {
    enemy.vel = scale(dir, enemy.speed)
  } else {
    enemy.vel = vec2(0, 0)
    if (enemy.attackTimer <= 0 && !enemy.isAttacking) {
      enemy.isAttacking = true
      enemy.attackAnimTimer = 0.5
      enemy.attackTimer = enemy.attackCooldown
      // Shockwave on hit
      enemy.shockwaveActive = true
      enemy.shockwaveTimer = 0.3
      enemy.shockwaveRange = S.HEAVY_ENEMY.shockwaveRange!
    }
  }
}

function updateFastAI(enemy: Enemy, player: Player, dir: Vec2, dist: number, dt: number): void {
  if (enemy.dodgeCooldown > 0) enemy.dodgeCooldown -= dt

  if (dist > enemy.attackRange + 30) {
    // Approach from side
    const sideAngle = angleBetween(enemy.pos, player.pos) + (Math.sin(Date.now() * 0.003) * 0.8)
    const sideDir = fromAngle(sideAngle)
    enemy.vel = scale(sideDir, enemy.speed)
  } else {
    if (enemy.attackTimer <= 0 && !enemy.isAttacking) {
      enemy.isAttacking = true
      enemy.attackAnimTimer = 0.15
      enemy.attackTimer = enemy.attackCooldown
    }
    enemy.vel = scale(dir, enemy.speed * 0.5)
  }
}

export function damageEnemy(enemy: Enemy, damage: number, knockbackDir: Vec2, knockback: number): boolean {
  if (!enemy.isAlive) return false
  enemy.hp -= damage
  enemy.flashTimer = 0.08
  enemy.knockbackVel = scale(knockbackDir, knockback)
  enemy.knockbackTime = 0.12
  enemy.stunTime = 0.15

  if (enemy.hp <= 0) {
    enemy.hp = 0
    enemy.isAlive = false
    return true // killed
  }
  return false
}

// Fast enemies can dodge
export function tryDodge(enemy: Enemy): boolean {
  if (enemy.type !== 'fast') return false
  if (enemy.dodgeCooldown > 0) return false
  if (Math.random() < (S.FAST_ENEMY.dodgeChance ?? 0.4)) {
    const dodgeAngle = Math.random() * Math.PI * 2
    enemy.pos = add(enemy.pos, scale(fromAngle(dodgeAngle), 60))
    enemy.dodgeCooldown = 1.5
    return true
  }
  return false
}
