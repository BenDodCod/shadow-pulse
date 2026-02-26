import { Vec2, vec2, add, scale, fromAngle } from './vec2'
import type { EnemyType } from './enemy'

export interface Particle {
  pos: Vec2
  vel: Vec2
  life: number
  maxLife: number
  color: string
  size: number
  type: 'spark' | 'pulse' | 'death' | 'trail' | 'ambient'
}

export interface ParticleSystem {
  particles: Particle[]
}

export function createParticleSystem(): ParticleSystem {
  return { particles: [] }
}

export function updateParticles(ps: ParticleSystem, dt: number): void {
  for (let i = ps.particles.length - 1; i >= 0; i--) {
    const p = ps.particles[i]
    p.life -= dt
    if (p.life <= 0) {
      ps.particles.splice(i, 1)
      continue
    }
    p.pos = add(p.pos, scale(p.vel, dt))
    p.vel = scale(p.vel, 0.96)

    // Shrink over life
    const lifeRatio = p.life / p.maxLife
    if (p.type === 'spark') {
      p.size = 3 * lifeRatio
    }
  }
}

export function emitHitSparks(ps: ParticleSystem, pos: Vec2, color: string, count: number = 8): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 100 + Math.random() * 250
    ps.particles.push({
      pos: { x: pos.x + (Math.random() - 0.5) * 10, y: pos.y + (Math.random() - 0.5) * 10 },
      vel: scale(fromAngle(angle), speed),
      life: 0.2 + Math.random() * 0.3,
      maxLife: 0.5,
      color,
      size: 2 + Math.random() * 3,
      type: 'spark',
    })
  }
}

export function emitPulseWave(ps: ParticleSystem, pos: Vec2, facing: number, arc: number): void {
  for (let i = 0; i < 20; i++) {
    const angle = facing - arc / 2 + Math.random() * arc
    const speed = 200 + Math.random() * 300
    ps.particles.push({
      pos: { ...pos },
      vel: scale(fromAngle(angle), speed),
      life: 0.3 + Math.random() * 0.2,
      maxLife: 0.5,
      color: '#7b2fff',
      size: 3 + Math.random() * 4,
      type: 'pulse',
    })
  }
}

export function emitDeathExplosion(ps: ParticleSystem, pos: Vec2, color: string): void {
  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 50 + Math.random() * 200
    ps.particles.push({
      pos: { x: pos.x + (Math.random() - 0.5) * 8, y: pos.y + (Math.random() - 0.5) * 8 },
      vel: scale(fromAngle(angle), speed),
      life: 0.3 + Math.random() * 0.5,
      maxLife: 0.8,
      color,
      size: 3 + Math.random() * 5,
      type: 'death',
    })
  }
}

export function emitTypedDeathExplosion(type: EnemyType, pos: Vec2, ps: ParticleSystem): void {
  switch (type) {
    case 'normal': {
      // Base burst
      emitDeathExplosion(ps, pos, '#ff3344')
      // 6 large slow shards
      for (let i = 0; i < 6; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 30 + Math.random() * 50
        ps.particles.push({
          pos: { x: pos.x + (Math.random() - 0.5) * 6, y: pos.y + (Math.random() - 0.5) * 6 },
          vel: scale(fromAngle(angle), speed),
          life: 0.6,
          maxLife: 0.6,
          color: '#ff3344',
          size: 8 + Math.random() * 4,
          type: 'death',
        })
      }
      break
    }
    case 'sniper': {
      // 4 directional streams of 5 particles each (crosshair burst)
      for (let dir = 0; dir < 4; dir++) {
        const baseAngle = (dir * Math.PI) / 2
        for (let i = 0; i < 5; i++) {
          const angle = baseAngle + (Math.random() - 0.5) * 0.3
          const speed = 80 + i * 40 + Math.random() * 30
          ps.particles.push({
            pos: { x: pos.x, y: pos.y },
            vel: scale(fromAngle(angle), speed),
            life: 0.25 + Math.random() * 0.25,
            maxLife: 0.5,
            color: '#ffaa22',
            size: 2 + Math.random() * 3,
            type: 'spark',
          })
        }
      }
      // Scatter burst
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2
        ps.particles.push({
          pos: { x: pos.x + (Math.random() - 0.5) * 8, y: pos.y + (Math.random() - 0.5) * 8 },
          vel: scale(fromAngle(angle), 60 + Math.random() * 120),
          life: 0.3 + Math.random() * 0.3,
          maxLife: 0.6,
          color: '#ffaa22',
          size: 2 + Math.random() * 4,
          type: 'death',
        })
      }
      break
    }
    case 'heavy': {
      // Shockwave ring — 30 particles outward, low speed, large size
      for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * Math.PI * 2
        const speed = 20 + Math.random() * 40
        ps.particles.push({
          pos: { x: pos.x, y: pos.y },
          vel: scale(fromAngle(angle), speed),
          life: 0.6 + Math.random() * 0.3,
          maxLife: 0.9,
          color: '#ff6633',
          size: 6 + Math.random() * 4,
          type: 'pulse',
        })
      }
      // Debris scatter
      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 80 + Math.random() * 180
        ps.particles.push({
          pos: { x: pos.x + (Math.random() - 0.5) * 10, y: pos.y + (Math.random() - 0.5) * 10 },
          vel: scale(fromAngle(angle), speed),
          life: 0.4 + Math.random() * 0.4,
          maxLife: 0.8,
          color: '#ff8844',
          size: 3 + Math.random() * 5,
          type: 'death',
        })
      }
      break
    }
    case 'fast': {
      // 8 speed-line streaks in equidistant directions
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2
        const speed = 200 + Math.random() * 200
        ps.particles.push({
          pos: { x: pos.x, y: pos.y },
          vel: scale(fromAngle(angle), speed),
          life: 0.2 + Math.random() * 0.1,
          maxLife: 0.3,
          color: '#22ffaa',
          size: 2 + Math.random() * 2,
          type: 'spark',
        })
      }
      // Normal scatter
      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 80 + Math.random() * 200
        ps.particles.push({
          pos: { x: pos.x + (Math.random() - 0.5) * 8, y: pos.y + (Math.random() - 0.5) * 8 },
          vel: scale(fromAngle(angle), speed),
          life: 0.2 + Math.random() * 0.15,
          maxLife: 0.35,
          color: '#22ffaa',
          size: 2 + Math.random() * 3,
          type: 'death',
        })
      }
      break
    }
  }
}

export function emitAffixDeathEffect(affix: { id: string; color: string; explosionRadius?: number }, pos: Vec2, ps: ParticleSystem): void {
  switch (affix.id) {
    case 'volatile': {
      const r = affix.explosionRadius ?? 60
      // Main explosion cloud
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 100 + Math.random() * 300
        ps.particles.push({
          pos: { ...pos },
          vel: scale(fromAngle(angle), speed),
          life: 0.5 + Math.random() * 0.4,
          maxLife: 0.9,
          color: '#ff4444',
          size: 8 + Math.random() * 6,
          type: 'death',
        })
      }
      // Shockwave ring
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2
        ps.particles.push({
          pos: { ...pos },
          vel: scale(fromAngle(angle), r * 3),
          life: 0.25,
          maxLife: 0.25,
          color: '#ff8844',
          size: 4,
          type: 'pulse',
        })
      }
      break
    }
    case 'berserker': {
      // AoE shockwave ring
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2
        const speed = 200 + Math.random() * 150
        ps.particles.push({
          pos: { ...pos },
          vel: scale(fromAngle(angle), speed),
          life: 0.3 + Math.random() * 0.2,
          maxLife: 0.5,
          color: '#ff2266',
          size: 4 + Math.random() * 4,
          type: 'pulse',
        })
      }
      // 4 directional rage streaks
      for (let d = 0; d < 4; d++) {
        const baseAngle = (d / 4) * Math.PI * 2
        for (let i = 0; i < 5; i++) {
          const angle = baseAngle + (Math.random() - 0.5) * 0.4
          const speed = 250 + Math.random() * 200
          ps.particles.push({
            pos: { ...pos },
            vel: scale(fromAngle(angle), speed),
            life: 0.2 + Math.random() * 0.15,
            maxLife: 0.35,
            color: '#ff2266',
            size: 3 + Math.random() * 3,
            type: 'spark',
          })
        }
      }
      break
    }
    case 'regenerating': {
      // Slow lingering green wisps
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 5 + Math.random() * 15
        ps.particles.push({
          pos: { x: pos.x + (Math.random() - 0.5) * 20, y: pos.y + (Math.random() - 0.5) * 20 },
          vel: scale(fromAngle(angle), speed),
          life: 1.5,
          maxLife: 1.5,
          color: '#44ff88',
          size: 3 + Math.random() * 3,
          type: 'ambient',
        })
      }
      break
    }
    default: {
      // Generic affix sparkle
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2
        ps.particles.push({
          pos: { ...pos },
          vel: scale(fromAngle(angle), 60 + Math.random() * 120),
          life: 0.3 + Math.random() * 0.3,
          maxLife: 0.6,
          color: affix.color,
          size: 2 + Math.random() * 4,
          type: 'spark',
        })
      }
      break
    }
  }
}

export function emitAmbientParticle(ps: ParticleSystem, bounds: { x: number; y: number; w: number; h: number }): void {
  if (ps.particles.filter(p => p.type === 'ambient').length > 30) return
  if (Math.random() > 0.1) return

  ps.particles.push({
    pos: vec2(
      bounds.x + Math.random() * bounds.w,
      bounds.y + Math.random() * bounds.h,
    ),
    vel: vec2((Math.random() - 0.5) * 15, -10 - Math.random() * 20),
    life: 2 + Math.random() * 3,
    maxLife: 5,
    color: Math.random() > 0.5 ? '#5522aa44' : '#3311ff33',
    size: 1 + Math.random() * 2,
    type: 'ambient',
  })
}

export function drawParticles(ctx: CanvasRenderingContext2D, ps: ParticleSystem): void {
  for (const p of ps.particles) {
    const alpha = Math.min(1, p.life / p.maxLife)
    ctx.globalAlpha = alpha

    if (p.type === 'ambient') {
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillStyle = p.color
      ctx.shadowColor = p.color
      ctx.shadowBlur = p.type === 'pulse' ? 15 : 8
      ctx.beginPath()
      ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }
  ctx.globalAlpha = 1
}
