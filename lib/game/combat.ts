import { Vec2, vec2, sub, normalize, distance, angle, fromAngle, scale, add } from './vec2'
import { Player } from './player'
import { Enemy, EnemyType, damageEnemy, tryDodge } from './enemy'
import * as S from './settings'
import { MutatorModifiers } from './mutators'

export interface HitEffect {
  pos: Vec2
  type: 'light' | 'heavy' | 'pulse' | 'enemy'
  time: number
}

export interface CombatResult {
  hitFreeze: number
  cameraShake: { intensity: number; duration: number }
  hitEffects: HitEffect[]
  playerDamaged: boolean
  enemiesKilled: number
  energyGained: number
  killedEnemyTypes: EnemyType[]
  lastStandTriggered: boolean  // True if a lethal hit was prevented by Last Stand
  // Death recap tracking
  damageDealt: number          // How much damage was dealt to player this frame
  damageSourceType: EnemyType | null  // Which enemy type dealt the damage
  // Damage feedback
  damageDir: Vec2   // normalized direction from attacker to player
  // Floating damage numbers
  damageHits: Array<{ damage: number; pos: { x: number; y: number }; hitType: 'light' | 'heavy' | 'pulse' }>
}

function angleDiff(a: number, b: number): number {
  let diff = b - a
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return Math.abs(diff)
}

export function processPlayerAttacks(player: Player, enemies: Enemy[], modifiers: MutatorModifiers = {}): CombatResult {
  const result: CombatResult = {
    hitFreeze: 0,
    cameraShake: { intensity: 0, duration: 0 },
    hitEffects: [],
    playerDamaged: false,
    enemiesKilled: 0,
    energyGained: 0,
    killedEnemyTypes: [],
    lastStandTriggered: false,
    damageDealt: 0,
    damageSourceType: null,
    damageDir: vec2(0, 0),
    damageHits: [],
  }

  if (player.attacking === 'none' || player.attackTime < 0.01) return result

  // Get modifier values
  const lightDamageMult = modifiers.lightDamageMultiplier ?? 1
  const heavyDamageMult = modifiers.heavyDamageMultiplier ?? 1
  const pulseDamageMult = modifiers.pulseWaveDamageMultiplier ?? 1
  const lightRangeMult = modifiers.lightRangeMultiplier ?? 1
  const heavyRangeMult = modifiers.heavyRangeMultiplier ?? 1
  const pulseRangeMult = modifiers.pulseWaveRangeMultiplier ?? 1
  const knockbackMult = modifiers.knockbackMultiplier ?? 1

  let attackRange = 0
  let attackArc = 0
  let attackDamage = 0
  let attackKnockback = 0
  let hitFreezeTime = 0
  let shakeIntensity = 0
  let shakeDuration = 0
  let hitType: HitEffect['type'] = 'light'

  switch (player.attacking) {
    case 'light':
      attackRange = S.LIGHT_RANGE * lightRangeMult
      attackArc = S.LIGHT_ARC
      attackDamage = Math.round((S.LIGHT_DAMAGE + (player.comboCount - 1) * 3) * lightDamageMult)
      attackKnockback = S.LIGHT_KNOCKBACK * knockbackMult
      hitFreezeTime = S.HIT_FREEZE_TAP
      shakeIntensity = S.CAMERA_SHAKE_INTENSITY
      shakeDuration = S.CAMERA_SHAKE_DURATION
      hitType = 'light'
      break
    case 'heavy': {
      const chargeRatio = Math.min(1, player.heavyChargeTime / S.HEAVY_CHARGE_TIME)
      attackRange = S.HEAVY_RANGE * heavyRangeMult
      attackArc = S.HEAVY_ARC
      attackDamage = Math.round(S.HEAVY_DAMAGE * heavyDamageMult)
      attackKnockback = S.HEAVY_KNOCKBACK * knockbackMult
      hitFreezeTime = S.HIT_FREEZE_HEAVY_PARTIAL + chargeRatio * (S.HIT_FREEZE_HEAVY_FULL - S.HIT_FREEZE_HEAVY_PARTIAL)
      shakeIntensity = S.HEAVY_SHAKE_INTENSITY
      shakeDuration = S.HEAVY_SHAKE_DURATION
      hitType = 'heavy'
      break
    }
    case 'pulse_wave':
      attackRange = S.PULSE_WAVE_RANGE * pulseRangeMult
      attackArc = S.PULSE_WAVE_ARC
      attackDamage = Math.round(S.PULSE_WAVE_DAMAGE * pulseDamageMult)
      attackKnockback = S.PULSE_WAVE_KNOCKBACK * knockbackMult
      hitFreezeTime = S.HIT_FREEZE_PULSE
      shakeIntensity = S.HEAVY_SHAKE_INTENSITY
      shakeDuration = S.HEAVY_SHAKE_DURATION
      hitType = 'pulse'
      break
  }

  // Only check hits on first frame of attack
  const attackProgress = player.attacking === 'light'
    ? (S.LIGHT_DURATION - player.attackTime) / S.LIGHT_DURATION
    : player.attacking === 'heavy'
      ? (S.HEAVY_DURATION - player.attackTime) / S.HEAVY_DURATION
      : (S.PULSE_WAVE_DURATION - player.attackTime) / S.PULSE_WAVE_DURATION

  if (attackProgress > 0.5) return result

  let hitSomething = false

  for (const enemy of enemies) {
    if (!enemy.isAlive) continue

    const dist = distance(player.pos, enemy.pos)
    if (dist > attackRange + enemy.size) continue

    const angleToEnemy = Math.atan2(enemy.pos.y - player.pos.y, enemy.pos.x - player.pos.x)
    const diff = angleDiff(player.facing, angleToEnemy)
    if (diff > attackArc / 2) continue

    // Fast enemies might dodge
    if (player.attacking === 'light' && tryDodge(enemy)) continue

    // Shielder blocks frontal light/heavy attacks
    if (enemy.type === 'shielder' && (player.attacking === 'light' || player.attacking === 'heavy') && enemy.hp / enemy.maxHp > 0.5) {
      const toPlayer = Math.atan2(player.pos.y - enemy.pos.y, player.pos.x - enemy.pos.x)
      const diff = angleDiff(enemy.shieldFacing, toPlayer)
      if (diff < Math.PI / 3) {
        // Blocked — show a zero-damage number with shielder color
        result.hitEffects.push({
          pos: { x: (player.pos.x + enemy.pos.x) / 2, y: (player.pos.y + enemy.pos.y) / 2 },
          type: hitType,
          time: 0.2,
        })
        result.damageHits.push({ damage: 0, pos: { x: enemy.pos.x, y: enemy.pos.y - enemy.size - 10 }, hitType: hitType === 'pulse' ? 'pulse' : hitType })
        hitSomething = true
        continue
      }
    }

    const knockDir = normalize(sub(enemy.pos, player.pos))
    const killed = damageEnemy(enemy, attackDamage, knockDir, attackKnockback)

    hitSomething = true
    result.energyGained += S.ENERGY_PER_HIT
    if (killed) {
      result.enemiesKilled++
      result.killedEnemyTypes.push(enemy.type)
    }

    result.hitEffects.push({
      pos: {
        x: (player.pos.x + enemy.pos.x) / 2,
        y: (player.pos.y + enemy.pos.y) / 2,
      },
      type: hitType,
      time: 0.3,
    })

    // Floating damage number
    result.damageHits.push({
      damage: attackDamage,
      pos: { x: enemy.pos.x, y: enemy.pos.y - enemy.size },
      hitType: hitType === 'pulse' ? 'pulse' : hitType,
    })
  }

  if (hitSomething) {
    result.hitFreeze = hitFreezeTime
    result.cameraShake = { intensity: shakeIntensity, duration: shakeDuration }
    player.energy = Math.min(player.maxEnergy, player.energy + result.energyGained)

    // Heavy chain (chain_heavy mutator)
    if (player.attacking === 'heavy' && (modifiers.heavyChainCount ?? 0) > 0) {
      const chainCount = modifiers.heavyChainCount!
      const chainDamage = Math.round(attackDamage * 0.6)
      // Sort alive enemies by distance to player, skip those already in the arc
      const chainTargets = enemies
        .filter(e => e.isAlive)
        .map(e => ({ enemy: e, dist: distance(player.pos, e.pos) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, chainCount)
      for (const { enemy } of chainTargets) {
        const knockDir = normalize(sub(enemy.pos, player.pos))
        const killed = damageEnemy(enemy, chainDamage, knockDir, attackKnockback * 0.5)
        if (killed) {
          result.enemiesKilled++
          result.killedEnemyTypes.push(enemy.type)
        }
        result.hitEffects.push({
          pos: { x: (player.pos.x + enemy.pos.x) / 2, y: (player.pos.y + enemy.pos.y) / 2 },
          type: 'heavy',
          time: 0.25,
        })
      }
    }
  }

  return result
}

// Helper function to apply damage to player with Last Stand support
function applyPlayerDamage(
  player: Player,
  damage: number,
  enemyType: EnemyType,
  canTriggerLastStand: boolean,
  result: CombatResult,
  cameraShake: { intensity: number; duration: number },
  knockback?: Vec2
): void {
  if (player.iframes > 0 || player.isDashing) return

  const wouldBeLethal = player.hp - damage <= 0

  // Track damage source for death recap
  result.damageDealt += damage
  result.damageSourceType = enemyType

  // If this would kill the player and Last Stand is available, trigger it
  if (wouldBeLethal && canTriggerLastStand) {
    player.hp = S.LAST_STAND_HP
    player.iframes = S.LAST_STAND_IFRAMES
    player.flashTimer = 0.3
    result.playerDamaged = true
    result.lastStandTriggered = true
    result.cameraShake = cameraShake
    result.hitEffects.push({
      pos: { ...player.pos },
      type: 'enemy',
      time: 0.3,
    })
    if (knockback) {
      player.vel = knockback
    }
    return
  }

  // Normal damage
  player.hp -= damage
  player.iframes = S.PLAYER_IFRAMES
  player.flashTimer = 0.15
  result.playerDamaged = true
  result.cameraShake = cameraShake
  result.hitEffects.push({
    pos: { ...player.pos },
    type: 'enemy',
    time: 0.3,
  })
  if (knockback) {
    player.vel = knockback
  }
  if (player.hp <= 0) {
    player.hp = 0
    player.isAlive = false
  }
}

export function processEnemyAttacks(player: Player, enemies: Enemy[], canTriggerLastStand: boolean = false): CombatResult {
  const result: CombatResult = {
    hitFreeze: 0,
    cameraShake: { intensity: 0, duration: 0 },
    hitEffects: [],
    playerDamaged: false,
    enemiesKilled: 0,
    energyGained: 0,
    killedEnemyTypes: [],
    lastStandTriggered: false,
    damageDealt: 0,
    damageSourceType: null,
    damageDir: vec2(0, 0),
    damageHits: [],
  }

  if (!player.isAlive) return result

  for (const enemy of enemies) {
    if (!enemy.isAlive || !enemy.isAttacking || enemy.attackAnimTimer < 0.01) continue

    const dist = distance(enemy.pos, player.pos)

    // Different attack checking per type
    switch (enemy.type) {
      case 'normal':
      case 'fast':
      case 'shielder':
        if (dist < enemy.attackRange + S.PLAYER_SIZE) {
          const prevDamaged = result.playerDamaged
          applyPlayerDamage(
            player,
            enemy.damage,
            enemy.type,
            canTriggerLastStand && !result.lastStandTriggered,
            result,
            { intensity: 10, duration: 0.15 }
          )
          if (!prevDamaged && result.playerDamaged) {
            result.damageDir = normalize(sub(player.pos, enemy.pos))
          }
        }
        break

      case 'sniper':
        // Line attack - check if player is near the line
        if (enemy.attackAnimTimer > 0.1) {
          const shotDir = fromAngle(enemy.laserAngle)
          const toPlayer = sub(player.pos, enemy.pos)
          const proj = toPlayer.x * shotDir.x + toPlayer.y * shotDir.y
          if (proj > 0 && proj < enemy.attackRange) {
            const perpDist = Math.abs(toPlayer.x * shotDir.y - toPlayer.y * shotDir.x)
            if (perpDist < S.PLAYER_SIZE + 8) {
              const prevDamaged = result.playerDamaged
              applyPlayerDamage(
                player,
                enemy.damage,
                enemy.type,
                canTriggerLastStand && !result.lastStandTriggered,
                result,
                { intensity: 8, duration: 0.12 }
              )
              if (!prevDamaged && result.playerDamaged) {
                result.damageDir = shotDir
              }
            }
          }
        }
        break

      case 'heavy':
        // Shockwave
        if (enemy.shockwaveActive && dist < enemy.shockwaveRange + S.PLAYER_SIZE) {
          const knockDir = normalize(sub(player.pos, enemy.pos))
          const prevDamaged = result.playerDamaged
          applyPlayerDamage(
            player,
            enemy.damage,
            enemy.type,
            canTriggerLastStand && !result.lastStandTriggered,
            result,
            { intensity: 15, duration: 0.25 },
            scale(knockDir, 400)
          )
          if (!prevDamaged && result.playerDamaged) {
            result.damageDir = knockDir
          }
        }
        break

      case 'spawner':
        // Spawner never directly attacks the player
        break

      case 'boss':
        // Melee hit when charge connects
        if (!enemy.shockwaveActive && dist < enemy.attackRange + S.PLAYER_SIZE) {
          const knockDir = normalize(sub(player.pos, enemy.pos))
          const prevDamaged = result.playerDamaged
          applyPlayerDamage(
            player,
            enemy.damage,
            enemy.type,
            canTriggerLastStand && !result.lastStandTriggered,
            result,
            { intensity: 18, duration: 0.3 },
            scale(knockDir, 500)
          )
          if (!prevDamaged && result.playerDamaged) {
            result.damageDir = knockDir
          }
        }
        // Ring pulse (shockwave field)
        if (enemy.shockwaveActive && dist < enemy.shockwaveRange + S.PLAYER_SIZE) {
          const knockDir = normalize(sub(player.pos, enemy.pos))
          const prevDamaged = result.playerDamaged
          applyPlayerDamage(
            player,
            Math.round(enemy.damage * 0.7),
            enemy.type,
            canTriggerLastStand && !result.lastStandTriggered,
            result,
            { intensity: 20, duration: 0.3 },
            scale(knockDir, 350)
          )
          if (!prevDamaged && result.playerDamaged) {
            result.damageDir = knockDir
          }
        }
        break
    }
  }

  return result
}
