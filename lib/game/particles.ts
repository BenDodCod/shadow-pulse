import { Vec2, vec2, add, scale, fromAngle } from './vec2'

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
