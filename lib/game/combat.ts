import { Vec2, vec2, sub, normalize, distance, angle, fromAngle, scale, add } from './vec2'
import { Player } from './player'
import { Enemy, damageEnemy, tryDodge } from './enemy'
import * as S from './settings'

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
}

function angleDiff(a: number, b: number): number {
  let diff = b - a
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return Math.abs(diff)
}

export function processPlayerAttacks(player: Player, enemies: Enemy[]): CombatResult {
  const result: CombatResult = {
    hitFreeze: 0,
    cameraShake: { intensity: 0, duration: 0 },
    hitEffects: [],
    playerDamaged: false,
    enemiesKilled: 0,
    energyGained: 0,
  }

  if (player.attacking === 'none' || player.attackTime < 0.01) return result

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
      attackRange = S.LIGHT_RANGE
      attackArc = S.LIGHT_ARC
      attackDamage = S.LIGHT_DAMAGE + (player.comboCount - 1) * 3
      attackKnockback = S.LIGHT_KNOCKBACK
      hitFreezeTime = S.HIT_FREEZE_TIME
      shakeIntensity = S.CAMERA_SHAKE_INTENSITY
      shakeDuration = S.CAMERA_SHAKE_DURATION
      hitType = 'light'
      break
    case 'heavy':
      attackRange = S.HEAVY_RANGE
      attackArc = S.HEAVY_ARC
      attackDamage = S.HEAVY_DAMAGE
      attackKnockback = S.HEAVY_KNOCKBACK
      hitFreezeTime = S.HIT_FREEZE_TIME * 2
      shakeIntensity = S.HEAVY_SHAKE_INTENSITY
      shakeDuration = S.HEAVY_SHAKE_DURATION
      hitType = 'heavy'
      break
    case 'pulse_wave':
      attackRange = S.PULSE_WAVE_RANGE
      attackArc = S.PULSE_WAVE_ARC
      attackDamage = S.PULSE_WAVE_DAMAGE
      attackKnockback = S.PULSE_WAVE_KNOCKBACK
      hitFreezeTime = S.HIT_FREEZE_TIME * 1.5
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

    const knockDir = normalize(sub(enemy.pos, player.pos))
    const killed = damageEnemy(enemy, attackDamage, knockDir, attackKnockback)

    hitSomething = true
    result.energyGained += S.ENERGY_PER_HIT
    if (killed) result.enemiesKilled++

    result.hitEffects.push({
      pos: {
        x: (player.pos.x + enemy.pos.x) / 2,
        y: (player.pos.y + enemy.pos.y) / 2,
      },
      type: hitType,
      time: 0.3,
    })
  }

  if (hitSomething) {
    result.hitFreeze = hitFreezeTime
    result.cameraShake = { intensity: shakeIntensity, duration: shakeDuration }
    player.energy = Math.min(player.maxEnergy, player.energy + result.energyGained)
  }

  return result
}

export function processEnemyAttacks(player: Player, enemies: Enemy[]): CombatResult {
  const result: CombatResult = {
    hitFreeze: 0,
    cameraShake: { intensity: 0, duration: 0 },
    hitEffects: [],
    playerDamaged: false,
    enemiesKilled: 0,
    energyGained: 0,
  }

  if (!player.isAlive) return result

  for (const enemy of enemies) {
    if (!enemy.isAlive || !enemy.isAttacking || enemy.attackAnimTimer < 0.01) continue

    const dist = distance(enemy.pos, player.pos)

    // Different attack checking per type
    switch (enemy.type) {
      case 'normal':
      case 'fast':
        if (dist < enemy.attackRange + S.PLAYER_SIZE) {
          if (player.iframes <= 0 && !player.isDashing) {
            player.hp -= enemy.damage
            player.iframes = S.PLAYER_IFRAMES
            player.flashTimer = 0.15
            result.playerDamaged = true
            result.cameraShake = { intensity: 10, duration: 0.15 }
            result.hitEffects.push({
              pos: { ...player.pos },
              type: 'enemy',
              time: 0.3,
            })
            if (player.hp <= 0) {
              player.hp = 0
              player.isAlive = false
            }
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
              if (player.iframes <= 0 && !player.isDashing) {
                player.hp -= enemy.damage
                player.iframes = S.PLAYER_IFRAMES
                player.flashTimer = 0.15
                result.playerDamaged = true
                result.cameraShake = { intensity: 8, duration: 0.12 }
                result.hitEffects.push({
                  pos: { ...player.pos },
                  type: 'enemy',
                  time: 0.3,
                })
                if (player.hp <= 0) {
                  player.hp = 0
                  player.isAlive = false
                }
              }
            }
          }
        }
        break

      case 'heavy':
        // Shockwave
        if (enemy.shockwaveActive && dist < enemy.shockwaveRange + S.PLAYER_SIZE) {
          if (player.iframes <= 0 && !player.isDashing) {
            player.hp -= enemy.damage
            player.iframes = S.PLAYER_IFRAMES
            player.flashTimer = 0.15
            result.playerDamaged = true
            result.cameraShake = { intensity: 15, duration: 0.25 }
            result.hitEffects.push({
              pos: { ...player.pos },
              type: 'enemy',
              time: 0.3,
            })
            const knockDir = normalize(sub(player.pos, enemy.pos))
            player.vel = scale(knockDir, 400)
            if (player.hp <= 0) {
              player.hp = 0
              player.isAlive = false
            }
          }
        }
        break
    }
  }

  return result
}
