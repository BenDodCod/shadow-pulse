import { Vec2, vec2, sub, add, scale, normalize, distance, length, fromAngle, angleBetween } from './vec2'
import * as S from './settings'
import type { Player } from './player'
import { WaveAffix, EnemyAffixState, createEnemyAffixState } from './affixes'

export type EnemyType = 'normal' | 'sniper' | 'heavy' | 'fast' | 'shielder' | 'spawner' | 'boss'

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
  // Affix system
  affixState: EnemyAffixState
  baseDamage: number // Original damage before affix modifiers
  // Shielder specific
  shieldFacing: number      // angle the shield faces (radians)
  // Spawner specific
  spawnTimer: number        // countdown to next spawn
  spawnCount: number        // spawns created so far
  maxSpawns: number         // cap before spawner exhausts
  pendingSpawn: boolean     // signals engine to create a Normal nearby
  // Boss specific
  bossPhase: number         // 1 | 2 | 3 — driven by HP thresholds
  isCharging: boolean
  chargeTimer: number       // active charge duration remaining
  chargeWindupTimer: number // pre-charge telegraph remaining
  chargeCooldownTimer: number
  chargeDir: Vec2           // direction locked at windup end
  ringPulseTimer: number    // countdown to next ring pulse (phase 2+)
  bossSpawnedMinions: boolean // phase 3 one-time spawn flag
}

let nextId = 0

export function createEnemy(
  type: EnemyType,
  x: number,
  y: number,
  difficultyMult = 1.0,
  affix: WaveAffix | null = null,
  presetMults?: { hp: number; speed: number; damage: number },
): Enemy {
  const configs: Record<EnemyType, { hp: number; speed: number; damage: number; attackRange: number; attackCooldown: number; color: string; [key: string]: unknown }> = {
    normal: S.NORMAL_ENEMY,
    sniper: S.SNIPER_ENEMY,
    heavy: S.HEAVY_ENEMY,
    fast: S.FAST_ENEMY,
    shielder: S.SHIELDER_ENEMY,
    spawner: S.SPAWNER_ENEMY,
    boss: S.BOSS_ENEMY,
  }
  const cfg = configs[type]

  // Level-based scaling
  const levelHp = Math.round(cfg.hp * difficultyMult)
  const levelSpeed = cfg.speed * Math.sqrt(difficultyMult) // speed grows slower than hp
  const levelDamage = Math.round(cfg.damage * (1 + (difficultyMult - 1) * 0.6)) // damage scales gently

  // Difficulty-preset layer (applied on top of level scaling)
  const pm = presetMults ?? { hp: 1, speed: 1, damage: 1 }
  const scaledHp = Math.round(levelHp * pm.hp)
  const scaledSpeed = levelSpeed * pm.speed
  const scaledDamage = Math.round(levelDamage * pm.damage)

  // Apply affix stat modifiers
  let finalSpeed = scaledSpeed
  let finalAttackCooldown = cfg.attackCooldown

  if (affix) {
    if (affix.speedMultiplier) finalSpeed *= affix.speedMultiplier
    if (affix.attackSpeedMultiplier) finalAttackCooldown /= affix.attackSpeedMultiplier
  }

  return {
    id: nextId++,
    type,
    pos: vec2(x, y),
    vel: vec2(0, 0),
    hp: scaledHp,
    maxHp: scaledHp,
    speed: finalSpeed,
    damage: scaledDamage,
    attackRange: cfg.attackRange,
    attackCooldown: finalAttackCooldown,
    attackTimer: finalAttackCooldown * 0.5 + Math.random() * finalAttackCooldown * 0.5,
    isAttacking: false,
    attackAnimTimer: 0,
    color: cfg.color,
    size: type === 'boss' ? S.BOSS_ENEMY.size : type === 'heavy' ? 26 : S.ENEMY_SIZE,
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
    shockwaveRange: type === 'boss' ? 140 : (cfg as typeof S.HEAVY_ENEMY).shockwaveRange || 0,
    affixState: createEnemyAffixState(affix),
    baseDamage: scaledDamage,
    // Shielder
    shieldFacing: 0,
    // Spawner
    spawnTimer: type === 'spawner' ? S.SPAWNER_ENEMY.spawnInterval : 0,
    spawnCount: 0,
    maxSpawns: type === 'spawner' ? S.SPAWNER_ENEMY.maxSpawns : 0,
    pendingSpawn: false,
    // Boss
    bossPhase: 1,
    isCharging: false,
    chargeTimer: 0,
    chargeWindupTimer: 0,
    chargeCooldownTimer: S.BOSS_ENEMY.chargeCooldown * 0.5,
    chargeDir: vec2(1, 0),
    ringPulseTimer: S.BOSS_ENEMY.ringPulseCooldown,
    bossSpawnedMinions: false,
  }
}

export function updateEnemy(enemy: Enemy, player: Player, dt: number, timeScale: number): void {
  if (!enemy.isAlive) return

  const adt = dt * timeScale
  const affix = enemy.affixState.affix

  // Timers
  if (enemy.flashTimer > 0) enemy.flashTimer -= dt // flash not affected by time scale
  if (enemy.stunTime > 0) {
    enemy.stunTime -= adt
    enemy.vel = vec2(0, 0)
  }

  // Affix: Regenerating - heal over time
  if (affix?.regenPerSecond && enemy.hp < enemy.maxHp) {
    enemy.affixState.regenAccumulator += affix.regenPerSecond * adt
    if (enemy.affixState.regenAccumulator >= 1) {
      const heal = Math.floor(enemy.affixState.regenAccumulator)
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal)
      enemy.affixState.regenAccumulator -= heal
    }
  }

  // Affix: Berserker - boost damage when low HP
  if (affix?.berserkerThreshold) {
    const hpRatio = enemy.hp / enemy.maxHp
    const shouldBerserk = hpRatio <= affix.berserkerThreshold
    if (shouldBerserk && !enemy.affixState.isBerserking) {
      enemy.affixState.isBerserking = true
      enemy.damage = Math.round(enemy.baseDamage * (affix.berserkerDamageMultiplier ?? 1.5))
    }
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
    case 'shielder':
      updateShielderAI(enemy, player, dirToPlayer, distToPlayer, adt)
      break
    case 'spawner':
      updateSpawnerAI(enemy, adt)
      break
    case 'boss':
      updateBossAI(enemy, player, dirToPlayer, distToPlayer, adt)
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

function updateShielderAI(enemy: Enemy, player: Player, dir: Vec2, dist: number, dt: number): void {
  // Shield always tracks player direction
  enemy.shieldFacing = angleBetween(enemy.pos, player.pos)

  const hpRatio = enemy.hp / enemy.maxHp
  if (hpRatio > 0.5) {
    // Defensive: approach slowly, hold at ~60px
    if (dist > enemy.attackRange + 20) {
      enemy.vel = scale(dir, enemy.speed * 0.7)
    } else {
      enemy.vel = vec2(0, 0)
      if (enemy.attackTimer <= 0 && !enemy.isAttacking) {
        enemy.isAttacking = true
        enemy.attackAnimTimer = 0.35
        enemy.attackTimer = enemy.attackCooldown
      }
    }
  } else {
    // Aggressive at low HP: charge at full speed, shield no longer protects
    enemy.vel = scale(dir, enemy.speed * 1.5)
    if (dist <= enemy.attackRange + 5 && enemy.attackTimer <= 0 && !enemy.isAttacking) {
      enemy.isAttacking = true
      enemy.attackAnimTimer = 0.25
      enemy.attackTimer = enemy.attackCooldown * 0.7
    }
  }
}

function updateSpawnerAI(enemy: Enemy, dt: number): void {
  // Drift toward arena center
  const dx = S.ARENA_CENTER_X - enemy.pos.x
  const dy = S.ARENA_CENTER_Y - enemy.pos.y
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d > 80) {
    enemy.vel = scale(normalize(vec2(dx, dy)), enemy.speed)
  } else {
    enemy.vel = vec2(0, 0)
  }

  // Spawn timer
  if (enemy.spawnCount < enemy.maxSpawns) {
    enemy.spawnTimer -= dt
    if (enemy.spawnTimer <= 0) {
      enemy.pendingSpawn = true
      enemy.spawnCount++
      enemy.spawnTimer = S.SPAWNER_ENEMY.spawnInterval
    }
  }
}

function updateBossAI(enemy: Enemy, player: Player, dir: Vec2, dist: number, dt: number): void {
  // Phase transitions based on HP
  const hpRatio = enemy.hp / enemy.maxHp
  const prevPhase = enemy.bossPhase
  if (hpRatio <= 0.33 && enemy.bossPhase < 3) {
    enemy.bossPhase = 3
    if (!enemy.bossSpawnedMinions) {
      enemy.pendingSpawn = true
      enemy.bossSpawnedMinions = true
    }
  } else if (hpRatio <= 0.66 && enemy.bossPhase < 2) {
    enemy.bossPhase = 2
    enemy.speed += 15
  }
  if (prevPhase < enemy.bossPhase && enemy.bossPhase === 2) {
    enemy.speed += 15 // speed boost on phase 3
  }

  // Charge behavior (all phases)
  if (enemy.isCharging) {
    enemy.chargeTimer -= dt
    enemy.vel = scale(enemy.chargeDir, S.BOSS_ENEMY.chargeSpeed)
    if (enemy.chargeTimer <= 0 || dist < enemy.size + 20) {
      enemy.isCharging = false
      enemy.isAttacking = true
      enemy.attackAnimTimer = 0.3
      enemy.chargeCooldownTimer = S.BOSS_ENEMY.chargeCooldown
    }
    return
  }

  if (enemy.chargeWindupTimer > 0) {
    enemy.chargeWindupTimer -= dt
    enemy.vel = scale(dir, enemy.speed * 0.3) // slow creep during windup
    if (enemy.chargeWindupTimer <= 0) {
      enemy.isCharging = true
      enemy.chargeTimer = S.BOSS_ENEMY.chargeDuration
      enemy.chargeDir = dir
    }
    return
  }

  // Cooldown between charges
  enemy.chargeCooldownTimer -= dt
  if (enemy.chargeCooldownTimer <= 0) {
    enemy.chargeWindupTimer = S.BOSS_ENEMY.chargeWindup
  }

  // Default movement: orbit/chase
  if (dist > 100) {
    enemy.vel = scale(dir, enemy.speed * 0.6)
  } else {
    enemy.vel = vec2(0, 0)
  }

  // Ring pulse (phase 2+)
  if (enemy.bossPhase >= 2) {
    enemy.ringPulseTimer -= dt
    if (enemy.ringPulseTimer <= 0) {
      enemy.shockwaveActive = true
      enemy.shockwaveTimer = 0.5
      enemy.shockwaveRange = 140
      enemy.isAttacking = true
      enemy.attackAnimTimer = 0.5
      enemy.ringPulseTimer = S.BOSS_ENEMY.ringPulseCooldown
    }
  }
}

export function damageEnemy(enemy: Enemy, damage: number, knockbackDir: Vec2, knockback: number): boolean {
  if (!enemy.isAlive) return false

  // Apply Armored affix damage reduction
  let finalDamage = damage
  const affix = enemy.affixState.affix
  if (affix?.damageReduction) {
    finalDamage = Math.round(damage * (1 - affix.damageReduction))
    finalDamage = Math.max(1, finalDamage) // Always deal at least 1 damage
  }

  enemy.hp -= finalDamage
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
