import { Player } from './player'
import { Enemy } from './enemy'
import { Camera } from './camera'
import { ParticleSystem, drawParticles } from './particles'
import { LevelTheme, Obstacle } from './levels'
import { fromAngle } from './vec2'
import * as S from './settings'
import { Mutator } from './mutators'
import { ContractState, getContractProgressText, getDifficultyColor } from './contracts'

export function render(
  ctx: CanvasRenderingContext2D,
  player: Player,
  enemies: Enemy[],
  camera: Camera,
  particles: ParticleSystem,
  wave: number,
  waveTimer: number,
  gameOver: boolean,
  score: number,
  highScore: number,
  levelTheme: LevelTheme,
  obstacles: Obstacle[],
  level: number,
  levelUpTimer: number,
  levelUpName: string,
  // Mutator system
  mutatorSelectionActive: boolean,
  mutatorChoices: Mutator[],
  activeMutators: Mutator[],
  // Contract system
  contractState: ContractState,
  // Last Stand system
  lastStandActive: boolean,
  lastStandTimer: number,
  lastStandUsed: boolean,
): void {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  const now = Date.now()

  ctx.save()
  ctx.translate(camera.offsetX, camera.offsetY)

  // Background
  ctx.fillStyle = levelTheme.bgColor
  ctx.fillRect(-10, -10, w + 20, h + 20)

  // Arena floor (themed)
  drawArena(ctx, levelTheme, now)

  // Obstacles
  drawObstacles(ctx, obstacles, levelTheme, now)

  // Ambient particles
  drawParticles(ctx, particles)

  // Enemies
  for (const enemy of enemies) {
    if (enemy.isAlive) drawEnemy(ctx, enemy)
  }

  // Player
  if (player.isAlive) drawPlayer(ctx, player)

  // Restore camera transform for HUD
  ctx.restore()

  // Last Stand screen effect
  if (lastStandActive) {
    drawLastStandEffect(ctx, lastStandTimer, w, h)
  }

  // HUD
  drawHUD(ctx, player, wave, score, highScore, level, levelTheme, w, h, lastStandUsed)

  // Active mutators HUD
  if (activeMutators.length > 0) {
    drawActiveMutators(ctx, activeMutators, w, h)
  }

  // Contract banner (top-center)
  if (contractState.contract) {
    drawContractBanner(ctx, contractState, w)
  }

  // Mutator selection screen (takes priority over other overlays)
  if (mutatorSelectionActive && mutatorChoices.length > 0) {
    drawMutatorSelection(ctx, mutatorChoices, w, h)
    return
  }

  // Wave announcement
  if (waveTimer > 0) {
    drawWaveAnnouncement(ctx, wave, waveTimer, levelTheme, w, h)
  }

  // Level-up announcement
  if (levelUpTimer > 0) {
    drawLevelAnnouncement(ctx, level, levelUpName, levelUpTimer, levelTheme, w, h)
  }

  // Game Over
  if (gameOver) {
    drawGameOver(ctx, score, highScore, level, w, h)
  }
}

// ─── Arena Drawing ───────────────────────────────────────────────────────────

function drawArena(ctx: CanvasRenderingContext2D, theme: LevelTheme, now: number): void {
  const cx = S.ARENA_CENTER_X
  const cy = S.ARENA_CENTER_Y
  const r = theme.arenaRadius

  // Outer vignette glow
  const gradient = ctx.createRadialGradient(cx, cy, r - 60, cx, cy, r + 20)
  gradient.addColorStop(0, 'transparent')
  gradient.addColorStop(0.7, theme.glowColor + '08')
  gradient.addColorStop(1, theme.glowColor + '22')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(cx, cy, r + 20, 0, Math.PI * 2)
  ctx.fill()

  // Arena floor
  ctx.fillStyle = theme.floorColor
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // Clip to arena circle for interior decorations
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()

  switch (theme.themeKey) {
    case 'void':
      drawVoidFloor(ctx, theme, cx, cy, r)
      break
    case 'inferno':
      drawInfernoFloor(ctx, theme, cx, cy, r, now)
      break
    case 'cryo':
      drawCryoFloor(ctx, theme, cx, cy, r, now)
      break
    case 'storm':
      drawStormFloor(ctx, theme, cx, cy, r, now)
      break
    case 'abyss':
      drawAbyssFloor(ctx, theme, cx, cy, r, now)
      break
    case 'apocalypse':
      drawApocalypseFloor(ctx, theme, cx, cy, r, now)
      break
  }

  ctx.restore()

  // Arena border
  ctx.strokeStyle = theme.borderColor
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  // Pulsing border glow
  const pulse = Math.sin(now * 0.002) * 0.3 + 0.5
  ctx.strokeStyle = theme.glowColor + Math.round(pulse * 80).toString(16).padStart(2, '0')
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2)
  ctx.stroke()
}

function drawVoidFloor(ctx: CanvasRenderingContext2D, theme: LevelTheme, cx: number, cy: number, r: number): void {
  // Classic square grid
  ctx.strokeStyle = theme.gridColor
  ctx.lineWidth = 1
  const gridSize = 40
  for (let x = cx - r; x < cx + r; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, cy - r)
    ctx.lineTo(x, cy + r)
    ctx.stroke()
  }
  for (let y = cy - r; y < cy + r; y += gridSize) {
    ctx.beginPath()
    ctx.moveTo(cx - r, y)
    ctx.lineTo(cx + r, y)
    ctx.stroke()
  }
  // Center rune circle
  ctx.strokeStyle = theme.glowColor + '22'
  ctx.lineWidth = 1
  for (let ring = 1; ring <= 3; ring++) {
    ctx.beginPath()
    ctx.arc(cx, cy, r * ring / 4, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawInfernoFloor(ctx: CanvasRenderingContext2D, theme: LevelTheme, cx: number, cy: number, r: number, now: number): void {
  // Diagonal crack lines
  ctx.strokeStyle = theme.gridColor
  ctx.lineWidth = 1
  for (let i = -r; i < r * 2; i += 38) {
    ctx.beginPath()
    ctx.moveTo(cx - r + i, cy - r)
    ctx.lineTo(cx - r + i + r * 0.6, cy + r)
    ctx.stroke()
  }
  // Lava pools (pulsing orange circles)
  const lavaPositions = [
    [cx - 90, cy - 70], [cx + 110, cy + 50], [cx - 50, cy + 100],
    [cx + 60, cy - 110], [cx, cy + 40],
  ]
  for (const [lx, ly] of lavaPositions) {
    const lpulse = Math.sin(now * 0.003 + lx * 0.01) * 0.3 + 0.5
    const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 30)
    grad.addColorStop(0, `rgba(255, 150, 0, ${lpulse * 0.4})`)
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(lx, ly, 30, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawCryoFloor(ctx: CanvasRenderingContext2D, theme: LevelTheme, cx: number, cy: number, r: number, now: number): void {
  // Hex grid
  ctx.strokeStyle = theme.gridColor
  ctx.lineWidth = 1
  const hex = 36
  const rowH = hex * Math.sqrt(3)
  for (let row = -Math.ceil(r / rowH); row < Math.ceil(r / rowH) + 1; row++) {
    for (let col = -Math.ceil(r / hex); col < Math.ceil(r / hex) + 1; col++) {
      const offsetX = row % 2 === 0 ? 0 : hex * 1.5
      const hx = cx + col * hex * 3 + offsetX
      const hy = cy + row * rowH * 0.5
      drawHex(ctx, hx, hy, hex * 0.85)
    }
  }
  // Ice sparkles
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + now * 0.0005
    const dist = r * (0.2 + (i % 3) * 0.2)
    const sx = cx + Math.cos(angle) * dist
    const sy = cy + Math.sin(angle) * dist
    const alpha = Math.sin(now * 0.002 + i) * 0.3 + 0.3
    ctx.strokeStyle = `rgba(0, 220, 255, ${alpha})`
    ctx.lineWidth = 1
    drawIceCrystal(ctx, sx, sy, 8)
  }
}

function drawHex(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i
    const px = x + size * Math.cos(angle)
    const py = y + size * Math.sin(angle)
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.stroke()
}

function drawIceCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI / 3) * i
    ctx.beginPath()
    ctx.moveTo(x - Math.cos(angle) * size, y - Math.sin(angle) * size)
    ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size)
    ctx.stroke()
  }
}

function drawStormFloor(ctx: CanvasRenderingContext2D, theme: LevelTheme, cx: number, cy: number, r: number, now: number): void {
  // Radial lines from center
  ctx.strokeStyle = theme.gridColor
  ctx.lineWidth = 1
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * 20, cy + Math.sin(angle) * 20)
    ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r)
    ctx.stroke()
  }
  // Concentric rings
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath()
    ctx.arc(cx, cy, r * ring / 4.5, 0, Math.PI * 2)
    ctx.stroke()
  }
  // Electric arcs
  const arcCount = 5
  for (let a = 0; a < arcCount; a++) {
    const t = (now * 0.003 + a * 13.7) % 1
    const arcAngle = a * (Math.PI * 2 / arcCount) + now * 0.001
    const arcLen = r * 0.5
    const ax = cx + Math.cos(arcAngle) * arcLen * t
    const ay = cy + Math.sin(arcAngle) * arcLen * t
    const alpha = Math.sin(now * 0.01 + a * 2) * 0.4 + 0.3
    ctx.strokeStyle = `rgba(255, 240, 100, ${alpha})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    // zigzag arc
    for (let step = 0; step < 5; step++) {
      const sa = arcAngle + (step - 2) * 0.15
      const sd = arcLen * (t + step * 0.05)
      ctx.lineTo(
        cx + Math.cos(sa) * sd + (Math.random() - 0.5) * 8,
        cy + Math.sin(sa) * sd + (Math.random() - 0.5) * 8,
      )
    }
    ctx.stroke()
  }
}

function drawAbyssFloor(ctx: CanvasRenderingContext2D, theme: LevelTheme, cx: number, cy: number, r: number, now: number): void {
  // Spiral arms
  ctx.strokeStyle = theme.gridColor
  ctx.lineWidth = 1
  for (let arm = 0; arm < 4; arm++) {
    ctx.beginPath()
    const armOffset = (arm / 4) * Math.PI * 2
    for (let t = 0; t < Math.PI * 4; t += 0.1) {
      const dist = (t / (Math.PI * 4)) * r * 0.9
      const angle = t + armOffset + now * 0.0003
      const px = cx + Math.cos(angle) * dist
      const py = cy + Math.sin(angle) * dist
      t === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
  // Vortex rings
  for (let ring = 1; ring <= 5; ring++) {
    const ripple = Math.sin(now * 0.002 - ring * 0.5) * 4
    const alpha = 0.15 + ring * 0.03
    ctx.strokeStyle = `rgba(180, 0, 220, ${alpha})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, r * ring / 5.5 + ripple, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawApocalypseFloor(ctx: CanvasRenderingContext2D, theme: LevelTheme, cx: number, cy: number, r: number, now: number): void {
  // Combination: diagonal grid + rings + chaos
  ctx.strokeStyle = theme.gridColor
  ctx.lineWidth = 1
  for (let i = -r; i < r * 2; i += 30) {
    ctx.beginPath()
    ctx.moveTo(cx - r + i, cy - r)
    ctx.lineTo(cx - r + i + r, cy + r)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx + r - i, cy - r)
    ctx.lineTo(cx + r - i - r, cy + r)
    ctx.stroke()
  }
  // Pulsing rings
  for (let ring = 1; ring <= 5; ring++) {
    const ripple = Math.sin(now * 0.004 + ring * 1.2) * 8
    const alpha = 0.12 + ring * 0.04
    ctx.strokeStyle = `rgba(255, 0, 40, ${alpha})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, r * ring / 5.5 + ripple, 0, Math.PI * 2)
    ctx.stroke()
  }
  // Random sparks
  for (let i = 0; i < 6; i++) {
    const sAngle = now * 0.002 * (i % 2 === 0 ? 1 : -1) + i * 1.1
    const sDist = r * 0.3 + Math.sin(now * 0.003 + i) * r * 0.2
    const sx = cx + Math.cos(sAngle) * sDist
    const sy = cy + Math.sin(sAngle) * sDist
    const alpha = Math.sin(now * 0.005 + i * 2) * 0.4 + 0.3
    ctx.fillStyle = `rgba(255, 50, 80, ${alpha})`
    ctx.beginPath()
    ctx.arc(sx, sy, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ─── Obstacles ───────────────────────────────────────────────────────────────

function drawObstacles(ctx: CanvasRenderingContext2D, obstacles: Obstacle[], theme: LevelTheme, now: number): void {
  for (const obs of obstacles) {
    // Glow halo
    const grad = ctx.createRadialGradient(obs.x, obs.y, obs.radius * 0.5, obs.x, obs.y, obs.radius * 1.6)
    grad.addColorStop(0, theme.glowColor + '18')
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(obs.x, obs.y, obs.radius * 1.6, 0, Math.PI * 2)
    ctx.fill()

    // Pillar body
    ctx.fillStyle = theme.floorColor
    ctx.shadowColor = theme.glowColor
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // Border
    const pulse = Math.sin(now * 0.002 + obs.x * 0.01) * 0.3 + 0.5
    ctx.strokeStyle = theme.glowColor + Math.round(pulse * 160).toString(16).padStart(2, '0')
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2)
    ctx.stroke()

    // Inner symbol
    ctx.strokeStyle = theme.accentColor + '44'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(obs.x, obs.y, obs.radius * 0.5, 0, Math.PI * 2)
    ctx.stroke()
  }
}

// ─── Player ──────────────────────────────────────────────────────────────────

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player): void {
  ctx.save()
  ctx.translate(player.pos.x, player.pos.y)
  const now = Date.now()

  // Dash trail
  for (let i = 0; i < player.trailPositions.length; i++) {
    const t = player.trailPositions[i]
    const alpha = (i / player.trailPositions.length) * 0.4
    ctx.globalAlpha = alpha
    ctx.fillStyle = S.PLAYER_DASH_COLOR
    ctx.beginPath()
    ctx.arc(t.x - player.pos.x, t.y - player.pos.y, S.PLAYER_SIZE * 0.8, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Attack arc visualization
  if (player.attacking !== 'none') {
    drawAttackArc(ctx, player)
  }

  // Heavy charge indicator
  if (player.heavyCharging) {
    const chargeProgress = Math.min(1, player.heavyChargeTime / S.HEAVY_CHARGE_TIME)
    ctx.strokeStyle = `rgba(255, 180, 50, ${chargeProgress})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, S.PLAYER_SIZE + 8 + chargeProgress * 6, 0, Math.PI * 2 * chargeProgress)
    ctx.stroke()
  }

  // 3 spinning orbital orbs (no ring — discrete satellites)
  const orbitSpeed = player.timeFlickerActive ? 0.003 : 0.001
  const orbitRadius = S.PLAYER_SIZE + 11
  const orbColor = player.timeFlickerActive ? '#00ccff' : '#7b2fff'
  for (let i = 0; i < 3; i++) {
    const angle = now * orbitSpeed + (i / 3) * Math.PI * 2
    const ox = Math.cos(angle) * orbitRadius
    const oy = Math.sin(angle) * orbitRadius
    const orbPulse = Math.sin(now * 0.004 + i * 1.5) * 0.3 + 0.7
    ctx.globalAlpha = orbPulse
    ctx.fillStyle = orbColor
    ctx.shadowColor = orbColor
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(ox, oy, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }
  ctx.globalAlpha = 1

  // Body: octagon (shadow warrior silhouette)
  const bodyColor = player.flashTimer > 0 ? S.HIT_FLASH_COLOR :
                    player.isDashing ? S.PLAYER_DASH_COLOR : S.PLAYER_COLOR
  ctx.fillStyle = bodyColor
  ctx.shadowColor = S.NEON_GLOW
  ctx.shadowBlur = player.isDashing ? 25 : 14
  ctx.beginPath()
  const bodyRotation = player.facing + Math.PI / 8
  for (let i = 0; i < 8; i++) {
    const angle = bodyRotation + (i / 8) * Math.PI * 2
    const px = Math.cos(angle) * S.PLAYER_SIZE
    const py = Math.sin(angle) * S.PLAYER_SIZE
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()

  // Inner core
  ctx.shadowColor = '#ffffff'
  ctx.shadowBlur = 8
  ctx.fillStyle = '#ffffff33'
  ctx.beginPath()
  ctx.arc(0, 0, S.PLAYER_SIZE * 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Facing blade — ONLY while attacking
  if (player.attacking !== 'none') {
    const facingDir = fromAngle(player.facing)
    let progress = 0
    let bladeColor = '#cc88ff'
    switch (player.attacking) {
      case 'light':
        progress = player.attackTime / S.LIGHT_DURATION
        bladeColor = '#cc88ff'
        break
      case 'heavy':
        progress = player.attackTime / S.HEAVY_DURATION
        bladeColor = '#ffaa22'
        break
      case 'pulse_wave':
        progress = player.attackTime / S.PULSE_WAVE_DURATION
        bladeColor = '#aa44ff'
        break
    }
    const bladeLen = S.PLAYER_SIZE + 18 + (1 - progress) * 8
    const leftAngle = player.facing + Math.PI * 0.7
    const rightAngle = player.facing - Math.PI * 0.7
    const bladeHalfWidth = 4
    ctx.fillStyle = bladeColor
    ctx.shadowColor = bladeColor
    ctx.shadowBlur = 20
    ctx.globalAlpha = Math.max(0.2, 1 - progress)
    ctx.beginPath()
    ctx.moveTo(facingDir.x * bladeLen, facingDir.y * bladeLen)
    ctx.lineTo(
      facingDir.x * S.PLAYER_SIZE + Math.cos(leftAngle) * bladeHalfWidth,
      facingDir.y * S.PLAYER_SIZE + Math.sin(leftAngle) * bladeHalfWidth,
    )
    ctx.lineTo(
      facingDir.x * S.PLAYER_SIZE + Math.cos(rightAngle) * bladeHalfWidth,
      facingDir.y * S.PLAYER_SIZE + Math.sin(rightAngle) * bladeHalfWidth,
    )
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }

  // Time Flicker indicator
  if (player.timeFlickerActive) {
    const flickerPulse = Math.sin(now * 0.015) * 0.3 + 0.5
    ctx.strokeStyle = `rgba(0, 200, 255, ${flickerPulse})`
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.arc(0, 0, S.PLAYER_SIZE + 20, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.restore()
}

function drawAttackArc(ctx: CanvasRenderingContext2D, player: Player): void {
  let range = 0
  let arc = 0
  let color = ''
  let progress = 0

  switch (player.attacking) {
    case 'light':
      range = S.LIGHT_RANGE
      arc = S.LIGHT_ARC
      color = '#7b2fff'
      progress = player.attackTime / S.LIGHT_DURATION
      break
    case 'heavy':
      range = S.HEAVY_RANGE
      arc = S.HEAVY_ARC
      color = '#ffaa22'
      progress = player.attackTime / S.HEAVY_DURATION
      break
    case 'pulse_wave':
      range = S.PULSE_WAVE_RANGE
      arc = S.PULSE_WAVE_ARC
      color = '#5500ff'
      progress = player.attackTime / S.PULSE_WAVE_DURATION
      break
  }

  ctx.globalAlpha = progress * 0.5
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 20
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, range * (1.2 - progress * 0.2), player.facing - arc / 2, player.facing + arc / 2)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
}

// ─── Enemy ───────────────────────────────────────────────────────────────────

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
  ctx.save()
  ctx.translate(enemy.pos.x, enemy.pos.y)
  const now = Date.now()
  const hpRatio = enemy.hp / enemy.maxHp

  // Sniper laser warning — more dramatic
  if (enemy.type === 'sniper' && enemy.laserWarning) {
    ctx.save()
    ctx.translate(-enemy.pos.x, -enemy.pos.y)
    const dx = Math.cos(enemy.laserAngle)
    const dy = Math.sin(enemy.laserAngle)
    const warnPulse = Math.sin(now * 0.02) * 0.4 + 0.6
    // Soft glow beam
    const beamGrad = ctx.createLinearGradient(
      enemy.pos.x, enemy.pos.y,
      enemy.pos.x + dx * 500, enemy.pos.y + dy * 500,
    )
    beamGrad.addColorStop(0, `rgba(255, 0, 0, ${warnPulse * 0.18})`)
    beamGrad.addColorStop(1, 'transparent')
    ctx.strokeStyle = beamGrad
    ctx.lineWidth = 18
    ctx.beginPath()
    ctx.moveTo(enemy.pos.x, enemy.pos.y)
    ctx.lineTo(enemy.pos.x + dx * 500, enemy.pos.y + dy * 500)
    ctx.stroke()
    // Sharp dashed line
    ctx.strokeStyle = `rgba(255, 30, 30, ${warnPulse * 0.8})`
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(enemy.pos.x, enemy.pos.y)
    ctx.lineTo(enemy.pos.x + dx * 600, enemy.pos.y + dy * 600)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  // Heavy shockwave — multiple expanding rings
  if (enemy.type === 'heavy' && enemy.shockwaveActive) {
    const shockProgress = 1 - (enemy.shockwaveTimer / 0.3)
    for (let ring = 0; ring < 3; ring++) {
      const rp = Math.min(1, shockProgress + ring * 0.08)
      ctx.strokeStyle = `rgba(255, 102, 51, ${(1 - shockProgress) * (1 - ring * 0.25)})`
      ctx.lineWidth = 3 - ring
      ctx.beginPath()
      ctx.arc(0, 0, enemy.shockwaveRange * rp, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // Low-HP danger aura
  if (hpRatio < 0.5) {
    const dangerAlpha = (0.5 - hpRatio) * 0.7
    const dangerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, enemy.size * 2.5)
    dangerGrad.addColorStop(0, `rgba(255, 0, 0, ${dangerAlpha})`)
    dangerGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = dangerGrad
    ctx.beginPath()
    ctx.arc(0, 0, enemy.size * 2.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // Glow — intensifies when attacking or critically low
  ctx.shadowColor = hpRatio < 0.3 ? '#ff2222' : enemy.color
  ctx.shadowBlur = enemy.isAttacking ? 22 : (hpRatio < 0.3 ? 16 : 8)

  // Draw by type
  switch (enemy.type) {
    case 'normal':  drawNormalEnemy(ctx, enemy, now, hpRatio); break
    case 'sniper':  drawSniperEnemy(ctx, enemy, now, hpRatio); break
    case 'heavy':   drawHeavyEnemy(ctx, enemy, now, hpRatio);  break
    case 'fast':    drawFastEnemy(ctx, enemy, now, hpRatio);   break
  }

  ctx.shadowBlur = 0

  // HP bar (color shifts red as damage increases)
  if (enemy.hp < enemy.maxHp) {
    const barW = enemy.size * 2.5
    const barH = 4
    const barY = -enemy.size - 14
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(-barW / 2, barY, barW, barH)
    const hpColor = hpRatio > 0.5 ? enemy.color : hpRatio > 0.25 ? '#ffaa22' : '#ff2222'
    ctx.fillStyle = hpColor
    ctx.fillRect(-barW / 2, barY, barW * hpRatio, barH)
  }

  // Attack telegraph
  if (enemy.isAttacking) {
    ctx.strokeStyle = '#ff000099'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, enemy.size + 6, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.restore()
}

function drawNormalEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, now: number, hpRatio: number): void {
  const s = enemy.size
  const color = enemy.flashTimer > 0 ? S.HIT_FLASH_COLOR : enemy.color
  // Main circle
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(0, 0, s, 0, Math.PI * 2)
  ctx.fill()
  // Inner spinning crosshair spokes
  ctx.save()
  ctx.rotate(now * 0.002)
  ctx.strokeStyle = color + 'aa'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * s * 0.35, Math.sin(a) * s * 0.35)
    ctx.lineTo(Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7)
    ctx.stroke()
  }
  ctx.restore()
  // Core dot
  ctx.fillStyle = '#ffffff55'
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2)
  ctx.fill()
  drawCracks(ctx, s, hpRatio, color)
}

function drawSniperEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, now: number, hpRatio: number): void {
  const s = enemy.size
  const color = enemy.flashTimer > 0 ? S.HIT_FLASH_COLOR : enemy.color
  // Diamond body
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, -s)
  ctx.lineTo(s, 0)
  ctx.lineTo(0, s)
  ctx.lineTo(-s, 0)
  ctx.closePath()
  ctx.fill()
  // Internal crosshair
  ctx.strokeStyle = color + '88'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-s * 0.55, 0); ctx.lineTo(s * 0.55, 0)
  ctx.moveTo(0, -s * 0.55); ctx.lineTo(0, s * 0.55)
  ctx.stroke()
  // Targeting reticle ring
  const reticlePulse = Math.sin(now * 0.008) * 0.3 + 0.7
  ctx.strokeStyle = `rgba(255, 50, 50, ${reticlePulse * 0.65})`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(0, 0, s * 1.35, 0, Math.PI * 2)
  ctx.stroke()
  // 4 notch ticks on the reticle
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * s * 1.25, Math.sin(a) * s * 1.25)
    ctx.lineTo(Math.cos(a) * s * 1.55, Math.sin(a) * s * 1.55)
    ctx.stroke()
  }
  // Core
  ctx.fillStyle = '#ffffff55'
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2)
  ctx.fill()
  drawCracks(ctx, s, hpRatio, color)
}

function drawHeavyEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, now: number, hpRatio: number): void {
  const s = enemy.size
  const color = enemy.flashTimer > 0 ? S.HIT_FLASH_COLOR : enemy.color
  // Main square body
  ctx.fillStyle = color
  ctx.fillRect(-s, -s, s * 2, s * 2)
  // Armor plate lines — center cross
  ctx.strokeStyle = color + '66'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-s + 3, 0); ctx.lineTo(s - 3, 0)
  ctx.moveTo(0, -s + 3); ctx.lineTo(0, s - 3)
  ctx.stroke()
  // Inset border
  ctx.strokeStyle = color + '44'
  ctx.lineWidth = 1
  ctx.strokeRect(-s + 5, -s + 5, s * 2 - 10, s * 2 - 10)
  // Corner bolts
  ctx.fillStyle = '#ffffff33'
  for (let bx = -1; bx <= 1; bx += 2) {
    for (let by = -1; by <= 1; by += 2) {
      ctx.beginPath()
      ctx.arc(bx * (s - 7), by * (s - 7), 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  drawCracks(ctx, s, hpRatio, color)
}

function drawFastEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, now: number, hpRatio: number): void {
  const s = enemy.size
  const color = enemy.flashTimer > 0 ? S.HIT_FLASH_COLOR : enemy.color
  // Main triangle
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, -s)
  ctx.lineTo(s, s)
  ctx.lineTo(-s, s)
  ctx.closePath()
  ctx.fill()
  // Inner smaller triangle
  ctx.strokeStyle = color + '88'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.5)
  ctx.lineTo(s * 0.5, s * 0.5)
  ctx.lineTo(-s * 0.5, s * 0.5)
  ctx.closePath()
  ctx.stroke()
  // Speed lines trailing below
  const speedAlpha = 0.25 + Math.sin(now * 0.012) * 0.12
  ctx.strokeStyle = color + Math.round(speedAlpha * 255).toString(16).padStart(2, '0')
  ctx.lineWidth = 1
  for (let i = 0; i < 3; i++) {
    const lineY = s * 0.45 + i * s * 0.22
    const lineW = s * (0.75 - i * 0.2)
    ctx.beginPath()
    ctx.moveTo(-lineW, lineY)
    ctx.lineTo(lineW, lineY)
    ctx.stroke()
  }
  drawCracks(ctx, s, hpRatio, color)
}

function drawCracks(ctx: CanvasRenderingContext2D, size: number, hpRatio: number, color: string): void {
  if (hpRatio >= 0.75) return
  const crackCount = Math.floor((1 - hpRatio) * 5) + 1
  const alpha = Math.min(0.95, (1 - hpRatio) * 1.3)
  ctx.strokeStyle = color
  ctx.globalAlpha = alpha * 0.8
  ctx.lineWidth = 1
  for (let i = 0; i < crackCount; i++) {
    // Deterministic positions — no per-frame randomness
    const startAngle = i * 1.2566 + 0.4   // ~2π/5 spacing
    const length = size * (0.38 + (i % 3) * 0.14)
    const deviation = 0.28 + (i % 2) * 0.32
    const sx = Math.cos(startAngle) * size * 0.18
    const sy = Math.sin(startAngle) * size * 0.18
    const ex = Math.cos(startAngle + deviation) * length
    const ey = Math.sin(startAngle + deviation) * length
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    // Branch cracks at critical HP
    if (hpRatio < 0.35) {
      const midX = (sx + ex) * 0.55
      const midY = (sy + ey) * 0.55
      const bx = Math.cos(startAngle - deviation * 1.4) * length * 0.5
      const by = Math.sin(startAngle - deviation * 1.4) * length * 0.5
      ctx.beginPath()
      ctx.moveTo(midX, midY)
      ctx.lineTo(bx, by)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

// ─── HUD ─────────────────────────────────────────────────────────────────────

function drawHUD(ctx: CanvasRenderingContext2D, player: Player, wave: number, score: number, highScore: number, level: number, theme: LevelTheme, w: number, h: number, lastStandUsed: boolean): void {
  const padding = 24
  const barWidth = 220
  const barHeight = 12

  // HP Bar
  const hpX = padding
  const hpY = h - padding - barHeight * 2 - 8

  ctx.fillStyle = '#ffffff88'
  ctx.font = '11px monospace'
  ctx.fillText('HP', hpX, hpY - 4)

  ctx.fillStyle = S.HP_BG_COLOR
  roundRect(ctx, hpX, hpY, barWidth, barHeight, 3)
  ctx.fill()

  const hpRatio = player.hp / player.maxHp
  const hpColor = hpRatio > 0.5 ? S.HP_COLOR : hpRatio > 0.25 ? '#ff8822' : '#ff2222'
  ctx.fillStyle = hpColor
  ctx.shadowColor = hpColor
  ctx.shadowBlur = 6
  roundRect(ctx, hpX, hpY, barWidth * hpRatio, barHeight, 3)
  ctx.fill()
  ctx.shadowBlur = 0

  // Last Stand indicator (next to HP bar)
  const lsX = hpX + barWidth + 12
  const lsY = hpY - 2
  const lsSize = 16

  if (!lastStandUsed) {
    // Last Stand available - golden icon
    ctx.fillStyle = '#ffaa00'
    ctx.shadowColor = '#ffaa00'
    ctx.shadowBlur = 8
    ctx.beginPath()
    // Draw a small shield/heart icon
    ctx.arc(lsX + lsSize / 2, lsY + lsSize / 2, lsSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    // Inner symbol
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('★', lsX + lsSize / 2, lsY + lsSize / 2 + 4)
    ctx.textAlign = 'left'
  } else {
    // Last Stand used - grayed out
    ctx.fillStyle = '#333344'
    ctx.beginPath()
    ctx.arc(lsX + lsSize / 2, lsY + lsSize / 2, lsSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#555566'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Energy Bar
  const enY = hpY + barHeight + 6

  ctx.fillStyle = '#ffffff88'
  ctx.font = '11px monospace'
  ctx.fillText('PULSE', hpX, enY - 4)

  ctx.fillStyle = S.ENERGY_BG_COLOR
  roundRect(ctx, hpX, enY, barWidth, barHeight, 3)
  ctx.fill()

  ctx.fillStyle = S.ENERGY_COLOR
  ctx.shadowColor = S.NEON_GLOW
  ctx.shadowBlur = 8
  roundRect(ctx, hpX, enY, barWidth * (player.energy / player.maxEnergy), barHeight, 3)
  ctx.fill()
  ctx.shadowBlur = 0

  // Time Flicker indicator
  if (player.timeFlickerActive) {
    const flickerText = `TIME FLICKER ${player.timeFlickerTimer.toFixed(1)}s`
    ctx.fillStyle = '#00ccff'
    ctx.shadowColor = '#00ccff'
    ctx.shadowBlur = 10
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(flickerText, w / 2, h - padding)
    ctx.textAlign = 'left'
    ctx.shadowBlur = 0
  }

  // Wave, Level, Score (top-right)
  ctx.textAlign = 'right'
  // Level badge
  ctx.fillStyle = theme.glowColor
  ctx.shadowColor = theme.glowColor
  ctx.shadowBlur = 10
  ctx.font = 'bold 13px monospace'
  ctx.fillText(`LEVEL ${level}`, w - padding, h - padding - 58)
  ctx.shadowBlur = 0

  ctx.fillStyle = '#ffffff66'
  ctx.font = '13px monospace'
  ctx.fillText(`WAVE ${wave}`, w - padding, h - padding - 38)

  ctx.fillStyle = '#ffffffaa'
  ctx.font = 'bold 18px monospace'
  ctx.fillText(`${score}`, w - padding, h - padding)

  if (highScore > 0) {
    ctx.fillStyle = '#ffffff33'
    ctx.font = '11px monospace'
    ctx.fillText(`BEST ${highScore}`, w - padding, h - padding - 76)
  }

  ctx.textAlign = 'left'

  // Combo counter
  if (player.comboCount > 1) {
    ctx.fillStyle = '#ffaa22'
    ctx.shadowColor = '#ffaa22'
    ctx.shadowBlur = 10
    ctx.font = 'bold 22px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${player.comboCount}x COMBO`, w / 2, 40)
    ctx.textAlign = 'left'
    ctx.shadowBlur = 0
  }

  // Controls hint
  ctx.fillStyle = '#ffffff22'
  ctx.font = '10px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('WASD Move | SPACE Dash | J Light | K Heavy | L Pulse | ; Time', w / 2, h - 4)
  ctx.textAlign = 'left'
}

// ─── Announcements ───────────────────────────────────────────────────────────

function drawWaveAnnouncement(ctx: CanvasRenderingContext2D, wave: number, timer: number, theme: LevelTheme, w: number, h: number): void {
  const alpha = Math.min(1, timer / 1.5)
  ctx.fillStyle = `rgba(${hexToRgb(theme.glowColor)}, ${alpha * 0.85})`
  ctx.shadowColor = theme.glowColor
  ctx.shadowBlur = 30
  ctx.font = 'bold 48px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`WAVE ${wave}`, w / 2, h / 2 - 40)

  ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`
  ctx.shadowBlur = 0
  ctx.font = '16px monospace'
  ctx.fillText('PREPARE YOURSELF', w / 2, h / 2)
  ctx.textAlign = 'left'
}

function drawLevelAnnouncement(ctx: CanvasRenderingContext2D, level: number, name: string, timer: number, theme: LevelTheme, w: number, h: number): void {
  // Only show for first 3 seconds, fade out at end
  const alpha = Math.min(1, timer / 1.0) * Math.min(1, (timer) / 0.5)
  if (alpha <= 0) return

  // Dark overlay strip
  ctx.fillStyle = `rgba(0,0,0,${alpha * 0.55})`
  ctx.fillRect(0, h / 2 - 110, w, 160)

  // Level number
  ctx.fillStyle = `rgba(${hexToRgb(theme.accentColor)}, ${alpha})`
  ctx.shadowColor = theme.glowColor
  ctx.shadowBlur = 50
  ctx.font = 'bold 72px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`LEVEL ${level}`, w / 2, h / 2 - 30)

  // Theme name
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`
  ctx.shadowColor = theme.glowColor
  ctx.shadowBlur = 20
  ctx.font = 'bold 24px monospace'
  ctx.fillText(name, w / 2, h / 2 + 20)

  ctx.shadowBlur = 0
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.4})`
  ctx.font = '14px monospace'
  ctx.fillText(`Difficulty × ${theme.difficultyMult.toFixed(1)}`, w / 2, h / 2 + 50)

  ctx.textAlign = 'left'
}

function drawLastStandEffect(ctx: CanvasRenderingContext2D, timer: number, w: number, h: number): void {
  const progress = timer / S.LAST_STAND_SLOW_MO_DURATION
  const now = Date.now()

  // Pulsing golden vignette overlay
  const pulseAlpha = (Math.sin(now * 0.01) * 0.15 + 0.25) * progress
  const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7)
  gradient.addColorStop(0, 'transparent')
  gradient.addColorStop(0.5, 'transparent')
  gradient.addColorStop(1, `rgba(255, 170, 0, ${pulseAlpha})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  // "LAST STAND!" announcement (fades out over time)
  const textAlpha = Math.min(1, progress * 2) // Fade faster
  ctx.fillStyle = `rgba(255, 200, 50, ${textAlpha})`
  ctx.shadowColor = '#ffaa00'
  ctx.shadowBlur = 40
  ctx.font = 'bold 56px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('LAST STAND!', w / 2, h / 2 - 60)

  // Subtitle
  ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha * 0.7})`
  ctx.shadowBlur = 0
  ctx.font = '18px monospace'
  ctx.fillText('SURVIVE!', w / 2, h / 2 - 20)

  ctx.textAlign = 'left'
  ctx.shadowBlur = 0
}

function drawGameOver(ctx: CanvasRenderingContext2D, score: number, highScore: number, level: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#ff2244'
  ctx.shadowColor = '#ff2244'
  ctx.shadowBlur = 30
  ctx.font = 'bold 56px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('SHADOW FALLS', w / 2, h / 2 - 70)

  ctx.shadowBlur = 0
  ctx.fillStyle = '#ffffff66'
  ctx.font = '16px monospace'
  ctx.fillText(`Reached Level ${level}`, w / 2, h / 2 - 20)

  ctx.fillStyle = '#ffffffcc'
  ctx.font = '20px monospace'
  ctx.fillText(`SCORE: ${score}`, w / 2, h / 2 + 15)

  if (score >= highScore && highScore > 0) {
    ctx.fillStyle = '#ffaa22'
    ctx.font = 'bold 16px monospace'
    ctx.fillText('NEW HIGH SCORE!', w / 2, h / 2 + 48)
  }

  ctx.fillStyle = '#ffffff66'
  ctx.font = '14px monospace'
  ctx.fillText('Press R to restart', w / 2, h / 2 + 90)
  ctx.textAlign = 'left'
}

// ─── Mutator UI ─────────────────────────────────────────────────────────────

function drawMutatorSelection(ctx: CanvasRenderingContext2D, choices: Mutator[], w: number, h: number): void {
  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'
  ctx.fillRect(0, 0, w, h)

  // Title
  ctx.fillStyle = '#7b2fff'
  ctx.shadowColor = '#7b2fff'
  ctx.shadowBlur = 30
  ctx.font = 'bold 36px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('CHOOSE YOUR MUTATOR', w / 2, 90)
  ctx.shadowBlur = 0

  // Subtitle
  ctx.fillStyle = '#ffffff66'
  ctx.font = '14px monospace'
  ctx.fillText('Press 1, 2, or 3 to select', w / 2, 120)

  // Card dimensions
  const cardWidth = 300
  const cardHeight = 280
  const cardSpacing = 40
  const totalWidth = choices.length * cardWidth + (choices.length - 1) * cardSpacing
  const startX = (w - totalWidth) / 2
  const cardY = (h - cardHeight) / 2 + 20

  // Rarity colors
  const rarityBgColors: Record<string, string> = {
    common: '#222233',
    rare: '#223344',
    epic: '#332244',
  }
  const rarityBorderColors: Record<string, string> = {
    common: '#445566',
    rare: '#4488aa',
    epic: '#8844cc',
  }

  for (let i = 0; i < choices.length; i++) {
    const mutator = choices[i]
    const cardX = startX + i * (cardWidth + cardSpacing)

    // Card background
    ctx.fillStyle = rarityBgColors[mutator.rarity]
    ctx.strokeStyle = rarityBorderColors[mutator.rarity]
    ctx.lineWidth = 2
    roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 12)
    ctx.fill()
    ctx.stroke()

    // Rarity badge
    ctx.fillStyle = mutator.color + '66'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(mutator.rarity.toUpperCase(), cardX + cardWidth / 2, cardY + 24)

    // Icon
    ctx.font = 'bold 48px monospace'
    ctx.fillStyle = mutator.color
    ctx.shadowColor = mutator.color
    ctx.shadowBlur = 15
    ctx.fillText(mutator.icon, cardX + cardWidth / 2, cardY + 90)
    ctx.shadowBlur = 0

    // Name
    ctx.font = 'bold 18px monospace'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(mutator.name, cardX + cardWidth / 2, cardY + 130)

    // Description (with word wrap)
    ctx.font = '13px monospace'
    ctx.fillStyle = '#ffffffaa'
    const lines = wrapText(mutator.description, 28)
    for (let j = 0; j < lines.length; j++) {
      ctx.fillText(lines[j], cardX + cardWidth / 2, cardY + 165 + j * 20)
    }

    // Key prompt
    ctx.font = 'bold 28px monospace'
    ctx.fillStyle = mutator.color
    ctx.shadowColor = mutator.color
    ctx.shadowBlur = 12
    ctx.fillText(`[${i + 1}]`, cardX + cardWidth / 2, cardY + cardHeight - 30)
    ctx.shadowBlur = 0
  }

  ctx.textAlign = 'left'
}

function drawActiveMutators(ctx: CanvasRenderingContext2D, mutators: Mutator[], w: number, h: number): void {
  const padding = 24
  const iconSize = 26
  const iconSpacing = 4

  // Label
  ctx.fillStyle = '#ffffff44'
  ctx.font = '10px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('MUTATORS', padding, padding + 10)

  // Icons
  for (let i = 0; i < mutators.length; i++) {
    const m = mutators[i]
    const x = padding + i * (iconSize + iconSpacing)
    const y = padding + 16

    // Icon background
    ctx.fillStyle = m.color + '33'
    ctx.strokeStyle = m.color + '88'
    ctx.lineWidth = 1
    roundRect(ctx, x, y, iconSize, iconSize, 4)
    ctx.fill()
    ctx.stroke()

    // Icon text
    ctx.font = '14px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = m.color
    ctx.fillText(m.icon, x + iconSize / 2, y + iconSize / 2 + 5)
  }

  ctx.textAlign = 'left'
}

function drawContractBanner(ctx: CanvasRenderingContext2D, contractState: ContractState, w: number): void {
  const contract = contractState.contract
  if (!contract) return

  const { status, progress } = contractState
  const bannerY = S.CONTRACT_BANNER_Y
  const bannerH = S.CONTRACT_BANNER_HEIGHT
  const bannerW = 320
  const bannerX = (w - bannerW) / 2

  // Background color based on status
  let bgColor: string
  let borderColor: string
  let glowColor: string | null = null

  switch (status) {
    case 'completed':
      bgColor = '#0a2a15'
      borderColor = '#44ff88'
      glowColor = '#44ff88'
      break
    case 'failed':
      bgColor = '#2a0a0f'
      borderColor = '#ff445588'
      break
    default: // active
      bgColor = '#0a0f1a'
      borderColor = getDifficultyColor(contract.difficulty) + '88'
      break
  }

  // Glow effect for completed
  if (glowColor) {
    ctx.shadowColor = glowColor
    ctx.shadowBlur = 15
  }

  // Banner background
  ctx.fillStyle = bgColor
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 2
  roundRect(ctx, bannerX, bannerY, bannerW, bannerH, 8)
  ctx.fill()
  ctx.stroke()

  // Reset shadow
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0

  // Difficulty badge
  const diffColor = getDifficultyColor(contract.difficulty)
  const badgeW = 50
  const badgeH = 16
  const badgeX = bannerX + 10
  const badgeY = bannerY + 8

  ctx.fillStyle = diffColor + '33'
  ctx.strokeStyle = diffColor
  ctx.lineWidth = 1
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4)
  ctx.fill()
  ctx.stroke()

  ctx.font = '10px monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = diffColor
  ctx.fillText(contract.difficulty.toUpperCase(), badgeX + badgeW / 2, badgeY + 12)

  // Contract name
  ctx.font = 'bold 14px monospace'
  ctx.textAlign = 'left'
  ctx.fillStyle = status === 'failed' ? '#ffffff66' : '#ffffffdd'
  ctx.fillText(contract.name, badgeX + badgeW + 10, badgeY + 12)

  // Progress text / status
  const progressText = getContractProgressText(contract, progress, status)
  ctx.font = '12px monospace'
  ctx.textAlign = 'left'

  if (status === 'completed') {
    ctx.fillStyle = '#44ff88'
  } else if (status === 'failed') {
    ctx.fillStyle = '#ff4466'
  } else {
    ctx.fillStyle = '#ffffffaa'
  }

  ctx.fillText(progressText, bannerX + 10, bannerY + bannerH - 10)

  // Reward preview (right side)
  if (status === 'active') {
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffffff44'
    const rewardText = `+${contract.scoreBonus} | +${contract.hpRestore}HP | +${contract.energyRestore}E`
    ctx.fillText(rewardText, bannerX + bannerW - 10, bannerY + bannerH - 10)
  }

  ctx.textAlign = 'left'
}

// Helper for text wrapping
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxChars) {
      current = (current + ' ' + word).trim()
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)

  return lines
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
