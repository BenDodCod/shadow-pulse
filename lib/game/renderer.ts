import { Player } from './player'
import { Enemy, EnemyType } from './enemy'
import { Camera } from './camera'
import { ParticleSystem, drawParticles } from './particles'
import { LevelTheme, Obstacle, Hazard } from './levels'
import { fromAngle } from './vec2'
import * as S from './settings'
import { Mutator, computeCombinedModifiers } from './mutators'
import { ContractState, ConsumableType, getContractProgressText, getDifficultyColor } from './contracts'
import { WaveAffix } from './affixes'
import { Question } from './questions'

// Inline shape to avoid circular dependency with engine.ts
interface LetterFlash {
  letter: string
  x: number
  y: number
  age: number
  color: string
}
import { WaveEvent } from './waves'
import { AssetCache } from './assetLoader'
import { getAnimFrame } from './spriteAnimator'

/** Leaderboard entry passed from the daily challenge system */
export interface DailyEntry {
  rank: number
  player_name: string
  score: number
  wave_reached: number
  is_you: boolean
}

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
  hazards: Hazard[],
  level: number,
  levelUpTimer: number,
  levelUpName: string,
  // Mutator system
  mutatorSelectionActive: boolean,
  mutatorChoices: Mutator[],
  activeMutators: Mutator[],
  // Contract system
  contractState: ContractState,
  // Affix system
  currentAffix: WaveAffix | null,
  // Last Stand system
  lastStandActive: boolean,
  lastStandTimer: number,
  lastStandUsed: boolean,
  // Death recap
  damageByEnemyType: Record<EnemyType, number>,
  // Daily Challenge
  isDailyChallenge?: boolean,
  dailyLeaderboard?: DailyEntry[],
  // Mutator feedback overlay
  mutatorFeedback?: { name: string; description: string; color: string; timer: number } | null,
  // Damage feedback
  damageFlashTimer?: number,
  damageDir?: { x: number; y: number },
  // Slash trails
  slashTrails?: Array<{ pos: { x: number; y: number }; facing: number; attackType: string; age: number; maxAge: number }>,
  // Mutator ceremony
  mutatorSelectionTimer?: number,
  mutatorPeekActive?: boolean,
  playerRarityGlowTimer?: number,
  playerRarityGlowColor?: string,
  // Consumables
  consumables?: ConsumableType[],
  consumableActive?: { type: ConsumableType; timer: number } | null,
  // Wave events
  pendingWaveEvent?: WaveEvent | null,
  activeWaveEvent?: WaveEvent | null,
  surgeZone?: { x: number; y: number; radius: number } | null,
  assets?: AssetCache | null,
  damageNumbers?: Array<{ value: number; pos: { x: number; y: number }; vel: { x: number; y: number }; age: number; lifetime: number; color: string }>,
  // Educational layer
  quizEnabled?: boolean,
  selectedGrade?: number,
  hebrewLayoutActive?: boolean,
  keyboardPanelTimer?: number,
  letterFlashes?: LetterFlash[],
  questionPhase?: boolean,
  currentQuestion?: Question | null,
  questionResult?: 'pending' | 'correct' | 'wrong-first' | 'wrong-final',
  questionRetryAvailable?: boolean,
  questionFeedbackTimer?: number,
  pendingMutatorIndex?: number,
  // Difficulty badge
  difficultyLabel?: string,
  // Pause menu
  paused?: boolean,
  pauseMenuSelection?: number,
  // Run stats (shown on game over screen)
  totalKills?: number,
  totalDamageDealt?: number,
  contractsCompleted?: number,
  mutatorsCount?: number,
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

  // Hazards (drawn on floor, below particles and entities)
  if (hazards.length > 0) drawHazards(ctx, hazards, now)

  // Surge zone (drawn on floor, player-benefit zone)
  if (surgeZone) drawSurgeZone(ctx, surgeZone, now)

  // Ambient particles
  drawParticles(ctx, particles)

  // Enemies
  for (const enemy of enemies) {
    if (enemy.isAlive) drawEnemy(ctx, enemy)
  }

  // Slash trails (drawn before player so player renders on top)
  if (slashTrails && slashTrails.length > 0) {
    drawSlashTrails(ctx, slashTrails, player)
  }

  // Player
  if (player.isAlive) drawPlayer(ctx, player, playerRarityGlowTimer ?? 0, playerRarityGlowColor ?? '#7b2fff', assets ?? null)

  // Blackout event: near-black overlay with radial vision cutouts
  if (activeWaveEvent?.effectType === 'blackout') {
    drawBlackout(ctx, player, enemies, w, h)
  }

  // Floating damage numbers (world space, inside camera transform)
  if (damageNumbers && damageNumbers.length > 0) {
    drawDamageNumbers(ctx, damageNumbers)
  }

  // Letter flashes (world space, inside camera transform — Classroom Mode only)
  if (quizEnabled && letterFlashes && letterFlashes.length > 0) {
    drawLetterFlashes(ctx, letterFlashes)
  }

  // Restore camera transform for HUD
  ctx.restore()

  // Off-screen enemy indicators (screen-space, before HUD)
  if (enemies.length > 0) {
    drawOffScreenIndicators(ctx, enemies, camera, w, h)
  }

  // Boss health bar (screen-space, top-center)
  drawBossHealthBar(ctx, enemies, w, h)

  // Damage feedback (red vignette + directional blur)
  if (damageFlashTimer && damageFlashTimer > 0) {
    drawDamageFeedback(ctx, damageFlashTimer, damageDir ?? { x: 0, y: 0 }, w, h)
  }

  // Last Stand screen effect
  if (lastStandActive) {
    drawLastStandEffect(ctx, lastStandTimer, w, h)
  }

  // Consumable active effect (screen overlay)
  if (consumableActive) {
    drawConsumableEffect(ctx, consumableActive, w, h)
  }

  // Hebrew layout guide — full-screen blocking overlay (Classroom Mode only)
  if (quizEnabled && hebrewLayoutActive) {
    drawHebrewLayoutGuide(ctx, w, h)
    return
  }

  // Pause menu — full-screen blocking overlay
  if (paused) {
    drawPauseMenu(ctx, pauseMenuSelection ?? 0, score, w, h)
    return
  }

  // HUD
  drawHUD(ctx, player, wave, score, highScore, level, levelTheme, w, h, lastStandUsed, isDailyChallenge, difficultyLabel)

  // Active mutators HUD
  if (activeMutators.length > 0) {
    drawActiveMutators(ctx, activeMutators, w, h)
  }

  // Consumable HUD
  if (consumables && (consumables.length > 0 || consumableActive)) {
    drawConsumableHUD(ctx, consumables, consumableActive ?? null, w, h)
  }

  // Contract banner (top-center)
  if (contractState.contract) {
    drawContractBanner(ctx, contractState, w)
  }

  // Keyboard teaching panel (Grade 1–4)
  const grade = selectedGrade ?? 1
  if (quizEnabled && S.KEYBOARD_PANEL_GRADES.includes(grade)) {
    drawKeyboardPanel(ctx, grade, wave, keyboardPanelTimer ?? 0, w, h)
  }

  // Mutator selection screen (must be resolved before wave event is shown,
  // because the engine blocks on mutator input — Y/N won't fire until after)
  if (mutatorSelectionActive && mutatorChoices.length > 0) {
    drawMutatorSelection(ctx, mutatorChoices, activeMutators, mutatorSelectionTimer ?? 0, mutatorPeekActive ?? false, w, h)
    return
  }

  // Vocabulary quiz — shown after mutator selection for Grade 3+ (Classroom Mode only)
  if (quizEnabled && questionPhase && currentQuestion && S.QUIZ_GRADES.includes(grade)) {
    const chosenMutator = mutatorChoices[pendingMutatorIndex ?? 0] ?? null
    drawQuestionChallenge(ctx, currentQuestion, questionResult ?? 'pending', questionFeedbackTimer ?? 0, chosenMutator, w, h)
    return
  }

  // Wave event offer (shown after mutator selection is complete)
  if (pendingWaveEvent) {
    drawWaveEventOffer(ctx, pendingWaveEvent, w, h)
    return
  }

  // Wave announcement
  if (waveTimer > 0) {
    drawWaveAnnouncement(ctx, wave, waveTimer, levelTheme, currentAffix, w, h)
  }

  // Active wave affix HUD indicator
  if (currentAffix) {
    drawCurrentAffix(ctx, currentAffix, activeMutators.length, w, h)
  }

  // Level-up announcement
  if (levelUpTimer > 0) {
    drawLevelAnnouncement(ctx, level, levelUpName, levelUpTimer, levelTheme, w, h)
  }

  // Mutator feedback overlay (fades in over gameplay after picking)
  if (mutatorFeedback && mutatorFeedback.timer > 0) {
    drawMutatorFeedback(ctx, mutatorFeedback, w, h)
  }

  // Game Over
  if (gameOver) {
    drawGameOver(ctx, score, highScore, level, damageByEnemyType, w, h, isDailyChallenge, dailyLeaderboard, totalKills ?? 0, totalDamageDealt ?? 0, contractsCompleted ?? 0, mutatorsCount ?? 0)
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
    const isRubble = obs.state === 'rubble'
    const isCracked = obs.state === 'cracked'
    const drawRadius = isRubble ? obs.rubbleRadius : obs.radius
    const alpha = isRubble ? 0.45 : 1.0

    ctx.globalAlpha = alpha

    // Glow halo (dimmer when damaged)
    const haloAlpha = isRubble ? '08' : isCracked ? '12' : '18'
    const grad = ctx.createRadialGradient(obs.x, obs.y, drawRadius * 0.5, obs.x, obs.y, drawRadius * 1.8)
    grad.addColorStop(0, theme.glowColor + haloAlpha)
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(obs.x, obs.y, drawRadius * 1.8, 0, Math.PI * 2)
    ctx.fill()

    // Pillar body
    ctx.fillStyle = isRubble ? theme.gridColor : theme.floorColor
    ctx.shadowColor = theme.glowColor
    ctx.shadowBlur = isRubble ? 4 : isCracked ? 8 : 12
    ctx.beginPath()
    ctx.arc(obs.x, obs.y, drawRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // Border
    const pulse = Math.sin(now * 0.002 + obs.x * 0.01) * 0.3 + 0.5
    const borderAlpha = isRubble ? 0x44 : Math.round(pulse * 160)
    ctx.strokeStyle = theme.glowColor + borderAlpha.toString(16).padStart(2, '0')
    ctx.lineWidth = isRubble ? 1 : 2
    ctx.beginPath()
    ctx.arc(obs.x, obs.y, drawRadius, 0, Math.PI * 2)
    ctx.stroke()

    if (!isRubble) {
      // Inner symbol ring
      ctx.strokeStyle = theme.accentColor + (isCracked ? '22' : '44')
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(obs.x, obs.y, drawRadius * 0.5, 0, Math.PI * 2)
      ctx.stroke()

      if (isCracked) {
        // Crack lines — 3 radial fractures
        ctx.strokeStyle = theme.glowColor + '66'
        ctx.lineWidth = 1.5
        for (let c = 0; c < 3; c++) {
          const crackAngle = (c / 3) * Math.PI * 2 + obs.x * 0.05
          ctx.beginPath()
          ctx.moveTo(obs.x + Math.cos(crackAngle) * drawRadius * 0.2, obs.y + Math.sin(crackAngle) * drawRadius * 0.2)
          ctx.lineTo(obs.x + Math.cos(crackAngle) * drawRadius * 0.95, obs.y + Math.sin(crackAngle) * drawRadius * 0.95)
          ctx.stroke()
        }
        // HP bar below pillar
        const barW = drawRadius * 2
        const barX = obs.x - barW / 2
        const barY = obs.y + drawRadius + 6
        ctx.fillStyle = '#33333388'
        ctx.fillRect(barX, barY, barW, 4)
        ctx.fillStyle = theme.glowColor + 'cc'
        ctx.fillRect(barX, barY, barW * (obs.hp / obs.maxHp), 4)
      }
    } else {
      // Rubble: scattered debris dots
      ctx.fillStyle = theme.gridColor
      for (let d = 0; d < 5; d++) {
        const dAngle = (d / 5) * Math.PI * 2 + obs.x * 0.1
        const dDist = drawRadius * 1.3
        ctx.beginPath()
        ctx.arc(obs.x + Math.cos(dAngle) * dDist, obs.y + Math.sin(dAngle) * dDist, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.globalAlpha = 1
  }
}

// ─── Hazards ─────────────────────────────────────────────────────────────────

function drawHazards(ctx: CanvasRenderingContext2D, hazards: Hazard[], now: number): void {
  for (const hz of hazards) {
    if (hz.type === 'floor_zone') {
      // Pulse the zone — flashing as warning when about to turn on (last 0.5s of off phase)
      const isWarning = !hz.active && hz.timer < 0.5
      const baseAlpha = hz.active ? 0.35 : isWarning ? 0.15 + Math.sin(now * 0.02) * 0.12 : 0.07
      ctx.globalAlpha = baseAlpha

      const grad = ctx.createRadialGradient(hz.pos.x, hz.pos.y, 0, hz.pos.x, hz.pos.y, hz.radius)
      grad.addColorStop(0, hz.color + 'cc')
      grad.addColorStop(0.6, hz.color + '88')
      grad.addColorStop(1, hz.color + '22')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(hz.pos.x, hz.pos.y, hz.radius, 0, Math.PI * 2)
      ctx.fill()

      if (hz.active) {
        // Active border pulses
        const pulse = Math.sin(now * 0.01) * 0.4 + 0.6
        ctx.strokeStyle = hz.color
        ctx.lineWidth = 2
        ctx.globalAlpha = pulse
        ctx.beginPath()
        ctx.arc(hz.pos.x, hz.pos.y, hz.radius, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    if (hz.type === 'wall_trap') {
      const trapAngle = hz.trapAngle ?? 0
      const isCharging = hz.timer < 0.6 // last 0.6s before firing = warning
      ctx.save()
      ctx.translate(hz.pos.x, hz.pos.y)
      ctx.rotate(trapAngle)

      // Trap body (small diamond/chevron)
      ctx.fillStyle = hz.color + '99'
      ctx.strokeStyle = hz.color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(12, 0)
      ctx.lineTo(0, 8)
      ctx.lineTo(-8, 0)
      ctx.lineTo(0, -8)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Laser sight line when charging
      if (isCharging) {
        const warningAlpha = 0.3 + Math.sin(now * 0.03) * 0.25
        ctx.globalAlpha = warningAlpha
        ctx.strokeStyle = hz.color
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(14, 0)
        ctx.lineTo(S.HAZARD_TRAP_RANGE, 0)
        ctx.stroke()
        ctx.setLineDash([])
      }

      ctx.restore()
      ctx.globalAlpha = 1
    }

    if (hz.type === 'pulse_center') {
      // Ring expands outward when about to pulse (last 1.5s of off phase)
      const isWarning = !hz.active && hz.timer < 1.5
      if (isWarning) {
        const progress = 1 - hz.timer / 1.5 // 0→1 as it approaches pulse
        const expandR = hz.radius * progress
        ctx.globalAlpha = (1 - progress) * 0.5 + 0.1
        ctx.strokeStyle = hz.color
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(hz.pos.x, hz.pos.y, expandR, 0, Math.PI * 2)
        ctx.stroke()
        // Inner warning glow at center
        ctx.globalAlpha = 0.15 + progress * 0.2
        ctx.fillStyle = hz.color
        ctx.beginPath()
        ctx.arc(hz.pos.x, hz.pos.y, 18, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
      if (hz.active) {
        // Shockwave ring expanding outward
        const progress = 1 - hz.timer / hz.onDuration
        const shockR = hz.radius * progress
        ctx.globalAlpha = (1 - progress) * 0.8
        ctx.strokeStyle = hz.color
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.arc(hz.pos.x, hz.pos.y, shockR, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
  }
}

// ─── Wave Events ─────────────────────────────────────────────────────────────

function drawSurgeZone(ctx: CanvasRenderingContext2D, zone: { x: number; y: number; radius: number }, now: number): void {
  const pulse = Math.sin(now * 0.005) * 0.15 + 0.85
  // Outer glow
  const grad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.radius)
  grad.addColorStop(0, '#22ffcc44')
  grad.addColorStop(0.5, '#22ffcc22')
  grad.addColorStop(1, 'transparent')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2)
  ctx.fill()
  // Border ring
  ctx.globalAlpha = pulse * 0.8
  ctx.strokeStyle = '#22ffcc'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2)
  ctx.stroke()
  // Label
  ctx.globalAlpha = 0.7
  ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#22ffcc'
  ctx.fillText('2× DMG', zone.x, zone.y + 4)
  ctx.globalAlpha = 1
}

function drawBlackout(ctx: CanvasRenderingContext2D, player: Player, enemies: Enemy[], w: number, h: number): void {
  // Create composite dark overlay with vision cutouts
  ctx.save()
  // First: fill near-black overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'
  ctx.fillRect(0, 0, w, h)

  // Cutout: player vision (150px radius)
  ctx.globalCompositeOperation = 'destination-out'
  const playerGrad = ctx.createRadialGradient(player.pos.x, player.pos.y, 0, player.pos.x, player.pos.y, 150)
  playerGrad.addColorStop(0, 'rgba(0,0,0,1)')
  playerGrad.addColorStop(0.6, 'rgba(0,0,0,0.8)')
  playerGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = playerGrad
  ctx.beginPath()
  ctx.arc(player.pos.x, player.pos.y, 150, 0, Math.PI * 2)
  ctx.fill()

  // Enemy glimpses (60px)
  for (const enemy of enemies) {
    if (!enemy.isAlive) continue
    const enemyGrad = ctx.createRadialGradient(enemy.pos.x, enemy.pos.y, 0, enemy.pos.x, enemy.pos.y, 60)
    enemyGrad.addColorStop(0, 'rgba(0,0,0,0.6)')
    enemyGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = enemyGrad
    ctx.beginPath()
    ctx.arc(enemy.pos.x, enemy.pos.y, 60, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawWaveEventOffer(ctx: CanvasRenderingContext2D, event: WaveEvent, w: number, h: number): void {
  const now = Date.now()

  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
  ctx.fillRect(0, 0, w, h)

  // Ambient flicker
  for (let i = 0; i < 20; i++) {
    const sx = ((Math.sin(now * 0.00015 + i * 3.1) + 1) / 2) * w
    const sy = ((Math.cos(now * 0.0002 + i * 2.3) + 1) / 2) * h
    ctx.globalAlpha = Math.sin(now * 0.001 + i) * 0.1 + 0.1
    ctx.fillStyle = '#ff4400'
    ctx.beginPath()
    ctx.arc(sx, sy, i % 3 === 0 ? 2 : 1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Title
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ff8844'
  ctx.shadowColor = '#ff4400'
  ctx.shadowBlur = 25
  ctx.font = 'bold 14px monospace'
  ctx.fillText('⚠  INCOMING CHALLENGE  ⚠', w / 2, h / 2 - 130)
  ctx.shadowBlur = 0

  // Card
  const cardW = 380, cardH = 240
  const cardX = (w - cardW) / 2, cardY = h / 2 - 100
  ctx.fillStyle = '#110800'
  ctx.strokeStyle = '#ff4400aa'
  ctx.lineWidth = 2
  roundRect(ctx, cardX, cardY, cardW, cardH, 14)
  ctx.fill()
  ctx.stroke()

  // Event name (big)
  ctx.font = 'bold 34px monospace'
  ctx.fillStyle = '#ff8844'
  ctx.shadowColor = '#ff4400'
  ctx.shadowBlur = 20
  ctx.fillText(event.name, w / 2, cardY + 58)
  ctx.shadowBlur = 0

  // Description
  ctx.font = '15px monospace'
  ctx.fillStyle = '#ffffffcc'
  const descLines = wrapText(event.description, 36)
  for (let i = 0; i < descLines.length; i++) {
    ctx.fillText(descLines[i], w / 2, cardY + 98 + i * 22)
  }

  // Reward line
  ctx.font = 'bold 13px monospace'
  ctx.fillStyle = '#22ffaa'
  ctx.shadowColor = '#22ffaa'
  ctx.shadowBlur = 10
  ctx.fillText(`REWARD: ${event.rewardText}`, w / 2, cardY + 165)
  ctx.shadowBlur = 0

  // Y/N prompts
  const yFlash = Math.sin(now * 0.008) * 0.2 + 0.8
  ctx.font = 'bold 22px monospace'
  ctx.globalAlpha = yFlash
  ctx.fillStyle = '#22ffaa'
  ctx.shadowColor = '#22ffaa'
  ctx.shadowBlur = 12
  ctx.fillText('[Y] Accept', w / 2 - 80, cardY + cardH + 32)
  ctx.shadowBlur = 0
  ctx.globalAlpha = 0.5
  ctx.fillStyle = '#ff6644'
  ctx.fillText('[N] Decline', w / 2 + 80, cardY + cardH + 32)
  ctx.globalAlpha = 1
}

// ─── Player ──────────────────────────────────────────────────────────────────

function drawSlashTrails(
  ctx: CanvasRenderingContext2D,
  trails: Array<{ pos: { x: number; y: number }; facing: number; attackType: string; age: number; maxAge: number }>,
  player: Player,
): void {
  const attackColors: Record<string, string> = {
    light: '#cc88ff',
    heavy: '#ffaa22',
    pulse_wave: '#aa44ff',
  }

  for (const trail of trails) {
    const t = trail.age / trail.maxAge         // 0 = fresh, 1 = expired
    const remaining = 1 - t                    // 1 = fresh, 0 = expired
    const color = attackColors[trail.attackType] ?? '#cc88ff'

    ctx.save()
    ctx.translate(trail.pos.x, trail.pos.y)

    // 1. Arc glow — faded attack arc at trail position
    const arcRanges: Record<string, [number, number]> = {
      light: [S.LIGHT_RANGE, S.LIGHT_ARC],
      heavy: [S.HEAVY_RANGE, S.HEAVY_ARC],
      pulse_wave: [S.PULSE_WAVE_RANGE, S.PULSE_WAVE_ARC],
    }
    const [range, arc] = arcRanges[trail.attackType] ?? [S.LIGHT_RANGE, S.LIGHT_ARC]
    ctx.globalAlpha = remaining * 0.35
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 18
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, range * 1.1, trail.facing - arc / 2, trail.facing + arc / 2)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0

    // 2. After-image — ghost octagon at trail position
    ctx.globalAlpha = S.SLASH_AFTER_IMAGE_ALPHA * remaining
    ctx.fillStyle = color
    ctx.beginPath()
    const bodyRot = trail.facing + Math.PI / 8
    for (let i = 0; i < 8; i++) {
      const a = bodyRot + (i / 8) * Math.PI * 2
      const px = Math.cos(a) * S.PLAYER_SIZE
      const py = Math.sin(a) * S.PLAYER_SIZE
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()

    ctx.globalAlpha = 1
    ctx.restore()

    // 3. Energy ribbon — Bezier from trail pos to current player pos
    const ribbonWidth = S.SLASH_RIBBON_WIDTH * remaining
    if (ribbonWidth > 0.5) {
      ctx.save()
      ctx.globalAlpha = remaining * 0.6
      ctx.strokeStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 12
      ctx.lineWidth = ribbonWidth
      ctx.lineCap = 'round'
      // Control point: midpoint between trail and player, offset perpendicular
      const mx = (trail.pos.x + player.pos.x) / 2
      const my = (trail.pos.y + player.pos.y) / 2
      const perpX = -(player.pos.y - trail.pos.y) * 0.3
      const perpY = (player.pos.x - trail.pos.x) * 0.3
      ctx.beginPath()
      ctx.moveTo(trail.pos.x, trail.pos.y)
      ctx.quadraticCurveTo(mx + perpX, my + perpY, player.pos.x, player.pos.y)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()
    }
  }
  ctx.globalAlpha = 1
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, rarityGlowTimer = 0, rarityGlowColor = '#7b2fff', assets: AssetCache | null = null): void {
  ctx.save()
  ctx.translate(player.pos.x, player.pos.y)
  const now = Date.now()

  // Rarity glow halo (after picking a mutator)
  if (rarityGlowTimer > 0) {
    const glowT = rarityGlowTimer / 2.0
    const glowAlpha = Math.sqrt(glowT) * 0.8
    const glowRadius = S.PLAYER_SIZE * (3 + (2.0 - rarityGlowTimer) * 2)
    const glowGrad = ctx.createRadialGradient(0, 0, S.PLAYER_SIZE * 0.5, 0, 0, glowRadius)
    glowGrad.addColorStop(0, rarityGlowColor + Math.round(glowAlpha * 255).toString(16).padStart(2, '0'))
    glowGrad.addColorStop(1, 'transparent')
    ctx.globalAlpha = 1
    ctx.fillStyle = glowGrad
    ctx.beginPath()
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2)
    ctx.fill()
  }

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

  // Passive aim direction arc (always visible when not attacking — shows where the next hit will land)
  if (player.attacking === 'none' && !player.isDashing) {
    ctx.globalAlpha = S.AIM_ARC_ALPHA
    ctx.fillStyle = S.NEON_GLOW
    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, S.LIGHT_RANGE * 0.9, player.facing - S.LIGHT_ARC / 2, player.facing + S.LIGHT_ARC / 2)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }

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

  // Body: sprite sheet if loaded, otherwise octagon (procedural fallback)
  if (assets?.player) {
    const { sx, sy } = getAnimFrame(player.animState, player.animFrame)
    const half = S.SPRITE_SIZE / 2
    ctx.save()
    ctx.rotate(player.facing + Math.PI / 2)
    if (player.flashTimer > 0) {
      // White flash on hit
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 0.7
      ctx.fillStyle = S.HIT_FLASH_COLOR
      ctx.fillRect(-half, -half, S.SPRITE_SIZE, S.SPRITE_SIZE)
      ctx.globalAlpha = 1
    }
    ctx.shadowColor = S.NEON_GLOW
    ctx.shadowBlur = player.isDashing ? 25 : 12
    ctx.drawImage(assets.player, sx, sy, S.SPRITE_SIZE, S.SPRITE_SIZE, -half, -half, S.SPRITE_SIZE, S.SPRITE_SIZE)
    ctx.shadowBlur = 0
    ctx.restore()
  } else {
    // Procedural octagon (default until sprites are added)
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
  }

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

function drawDamageNumbers(
  ctx: CanvasRenderingContext2D,
  numbers: Array<{ value: number; pos: { x: number; y: number }; vel: { x: number; y: number }; age: number; lifetime: number; color: string }>,
): void {
  ctx.textAlign = 'center'
  for (const dn of numbers) {
    const t = dn.age / dn.lifetime
    const alpha = 1 - Math.pow(t, 1.5)
    const popScale = t < 0.12 ? 1.3 - t * 2.5 : 1.0
    const x = dn.pos.x + dn.vel.x * dn.age
    const y = dn.pos.y + dn.vel.y * dn.age

    ctx.save()
    ctx.translate(x, y)
    ctx.scale(popScale, popScale)
    ctx.globalAlpha = alpha
    ctx.font = 'bold 14px monospace'
    ctx.fillStyle = dn.color
    ctx.fillText(String(dn.value), 0, 0)
    ctx.restore()
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
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

  // Boss shockwave ring (ring pulse attack) — boss timer starts at 0.5s
  if (enemy.type === 'boss' && enemy.shockwaveActive) {
    const shockProgress = 1 - (enemy.shockwaveTimer / 0.5)
    for (let ring = 0; ring < 4; ring++) {
      const rp = Math.max(0, Math.min(1, shockProgress + ring * 0.06))
      if (rp <= 0) continue
      const alpha = Math.max(0, (1 - shockProgress) * (1 - ring * 0.2))
      ctx.strokeStyle = `rgba(204, 0, 255, ${alpha})`
      ctx.lineWidth = 4 - ring
      ctx.shadowColor = '#cc00ff'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(0, 0, enemy.shockwaveRange * rp, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.shadowBlur = 0
  }

  // Boss charge windup telegraph — pulsing white glow
  if (enemy.type === 'boss' && enemy.chargeWindupTimer > 0) {
    const windupRatio = enemy.chargeWindupTimer / S.BOSS_ENEMY.chargeWindup
    const pulseAlpha = windupRatio * (0.5 + Math.sin(now * 0.04) * 0.3)
    ctx.strokeStyle = `rgba(255, 255, 255, ${pulseAlpha})`
    ctx.lineWidth = 4
    ctx.shadowColor = '#ffffff'
    ctx.shadowBlur = 20 * windupRatio
    ctx.beginPath()
    ctx.arc(0, 0, enemy.size + 8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  // Attack telegraph — pulsing ring warns player when enemy is about to strike
  if ((enemy.type === 'normal' || enemy.type === 'fast') && !enemy.isAttacking) {
    const thresh = S.TELEGRAPH_THRESHOLD
    if (enemy.attackTimer > 0 && enemy.attackTimer < thresh) {
      const urgency = 1 - enemy.attackTimer / thresh
      const pulseRadius = enemy.size + 3 + urgency * enemy.size * 0.8
      ctx.strokeStyle = `rgba(255, 50, 50, ${urgency * 0.65})`
      ctx.lineWidth = 1.5 + urgency
      ctx.beginPath()
      ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2)
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

  // Wave affix aura, icon, and full visual transform
  const affix = enemy.affixState.affix
  if (affix) {
    drawAffixAura(ctx, enemy, affix, now)
    drawAffixTransform(ctx, enemy, affix, now)
  }

  // Glow — intensifies when attacking or critically low
  ctx.shadowColor = hpRatio < 0.3 ? '#ff2222' : enemy.color
  ctx.shadowBlur = enemy.isAttacking ? 22 : (hpRatio < 0.3 ? 16 : 8)

  // Draw by type
  switch (enemy.type) {
    case 'normal':   drawNormalEnemy(ctx, enemy, now, hpRatio);   break
    case 'sniper':   drawSniperEnemy(ctx, enemy, now, hpRatio);   break
    case 'heavy':    drawHeavyEnemy(ctx, enemy, now, hpRatio);    break
    case 'fast':     drawFastEnemy(ctx, enemy, now, hpRatio);     break
    case 'shielder': drawShielderEnemy(ctx, enemy, now, hpRatio); break
    case 'spawner':  drawSpawnerEnemy(ctx, enemy, now, hpRatio);  break
    case 'boss':     drawBossEnemy(ctx, enemy, now, hpRatio);     break
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

function drawShielderEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, _now: number, hpRatio: number): void {
  const s = enemy.size
  const color = enemy.flashTimer > 0 ? S.HIT_FLASH_COLOR : enemy.color
  // Hexagon body
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 6
    const x = Math.cos(a) * s
    const y = Math.sin(a) * s
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  // Inner hexagon outline
  ctx.strokeStyle = color + '66'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 6
    const x = Math.cos(a) * s * 0.6
    const y = Math.sin(a) * s * 0.6
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()
  // Shield arc — only shown when HP > 50% (defensive mode)
  if (hpRatio > 0.5) {
    const shieldColor = '#aaddff'
    ctx.save()
    ctx.rotate(enemy.shieldFacing)
    ctx.strokeStyle = shieldColor
    ctx.lineWidth = 3
    ctx.shadowColor = shieldColor
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.arc(0, 0, s + 8, -Math.PI / 3, Math.PI / 3)
    ctx.stroke()
    // Shield glow tips
    ctx.lineWidth = 1.5
    ctx.shadowBlur = 6
    for (const tipAngle of [-Math.PI / 3, Math.PI / 3]) {
      ctx.beginPath()
      ctx.arc(Math.cos(tipAngle) * (s + 8), Math.sin(tipAngle) * (s + 8), 3, 0, Math.PI * 2)
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
    }
    ctx.shadowBlur = 0
    ctx.restore()
  } else {
    // Aggressive mode — shield turns orange
    ctx.save()
    ctx.rotate(enemy.shieldFacing)
    ctx.strokeStyle = '#ff8844'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, s + 6, -Math.PI / 4, Math.PI / 4)
    ctx.stroke()
    ctx.restore()
  }
  // Core dot
  ctx.fillStyle = '#ffffff44'
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2)
  ctx.fill()
  drawCracks(ctx, s, hpRatio, color)
}

function drawSpawnerEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, now: number, hpRatio: number): void {
  const s = enemy.size
  const color = enemy.flashTimer > 0 ? S.HIT_FLASH_COLOR : enemy.color
  const exhausted = enemy.spawnCount >= enemy.maxSpawns
  // Pulsing body scale
  const pulse = exhausted ? 1.0 : 1 + Math.sin(now * 0.004) * 0.15
  ctx.save()
  ctx.scale(pulse, pulse)
  // Main circle
  ctx.fillStyle = exhausted ? '#666666' : color
  ctx.beginPath()
  ctx.arc(0, 0, s, 0, Math.PI * 2)
  ctx.fill()
  // Inner ring
  ctx.strokeStyle = (exhausted ? '#888888' : color) + '88'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.65, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
  // 4 orbiting spawn-particle dots
  if (!exhausted) {
    const orbitR = s + 10
    const orbitSpeed = now * 0.002
    for (let i = 0; i < 4; i++) {
      const a = orbitSpeed + (i / 4) * Math.PI * 2
      ctx.fillStyle = color + 'cc'
      ctx.beginPath()
      ctx.arc(Math.cos(a) * orbitR, Math.sin(a) * orbitR, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // Spawn count remaining (center text)
  const remaining = Math.max(0, enemy.maxSpawns - enemy.spawnCount)
  ctx.fillStyle = exhausted ? '#555555' : '#ffffff'
  ctx.font = `bold ${Math.round(s * 0.8)}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(remaining), 0, 0)
  ctx.textBaseline = 'alphabetic'
  drawCracks(ctx, s, hpRatio, color)
}

function drawBossEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, now: number, hpRatio: number): void {
  const s = enemy.size
  const color = enemy.flashTimer > 0 ? S.HIT_FLASH_COLOR : enemy.color
  const phase = enemy.bossPhase ?? 1
  const chargeActive = enemy.isCharging ?? false
  // Motion blur trail during charge
  if (chargeActive) {
    for (let ghost = 3; ghost >= 1; ghost--) {
      const offsetX = -(enemy.chargeDir?.x ?? 0) * ghost * 12
      const offsetY = -(enemy.chargeDir?.y ?? 0) * ghost * 12
      ctx.globalAlpha = 0.12 * (4 - ghost) / 3
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(offsetX, offsetY, s, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  // Main body
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 25
  ctx.beginPath()
  ctx.arc(0, 0, s, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  // Phase 1+: spinning outer ring of 8 spikes
  {
    const spikeRot = now * 0.0015
    ctx.save()
    ctx.rotate(spikeRot)
    ctx.strokeStyle = color + 'cc'
    ctx.lineWidth = 2
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * s * 1.1, Math.sin(a) * s * 1.1)
      ctx.lineTo(Math.cos(a) * (s * 1.1 + 12), Math.sin(a) * (s * 1.1 + 12))
      ctx.stroke()
    }
    ctx.restore()
  }
  // Phase 2+: orbiting halo ring of 12 dots
  if (phase >= 2) {
    const haloRot = -(now * 0.0022)
    const haloR = s + 22
    for (let i = 0; i < 12; i++) {
      const a = haloRot + (i / 12) * Math.PI * 2
      const dotAlpha = 0.6 + Math.sin(now * 0.003 + i) * 0.3
      ctx.fillStyle = `rgba(220, 100, 255, ${dotAlpha})`
      ctx.shadowColor = '#dd66ff'
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(Math.cos(a) * haloR, Math.sin(a) * haloR, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }
  // Phase 3: red-purple tint overlay + cracks
  if (phase >= 3) {
    ctx.fillStyle = 'rgba(200, 0, 80, 0.25)'
    ctx.beginPath()
    ctx.arc(0, 0, s, 0, Math.PI * 2)
    ctx.fill()
    drawCracks(ctx, s, hpRatio, '#ff0055')
  }
  // Core bright center
  ctx.fillStyle = '#ffffff33'
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2)
  ctx.fill()
  // Phase label inside body
  ctx.fillStyle = '#ffffff66'
  ctx.font = `bold ${Math.round(s * 0.45)}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`P${phase}`, 0, 0)
  ctx.textBaseline = 'alphabetic'
}

// ─── Off-Screen Enemy Indicators ─────────────────────────────────────────────

function drawOffScreenIndicators(
  ctx: CanvasRenderingContext2D,
  enemies: Enemy[],
  camera: Camera,
  w: number,
  h: number,
): void {
  const MARGIN = 28
  for (const enemy of enemies) {
    if (!enemy.isAlive) continue
    const screenX = enemy.pos.x + camera.offsetX
    const screenY = enemy.pos.y + camera.offsetY
    // Check if off-screen (with a buffer)
    const offLeft = screenX < -enemy.size
    const offRight = screenX > w + enemy.size
    const offTop = screenY < -enemy.size
    const offBottom = screenY > h + enemy.size
    if (!offLeft && !offRight && !offTop && !offBottom) continue
    // Angle from screen center toward enemy
    const angle = Math.atan2(screenY - h / 2, screenX - w / 2)
    // Clamp indicator to screen edge
    const clampedX = Math.max(MARGIN, Math.min(w - MARGIN, w / 2 + Math.cos(angle) * (w / 2 - MARGIN)))
    const clampedY = Math.max(MARGIN, Math.min(h - MARGIN, h / 2 + Math.sin(angle) * (h / 2 - MARGIN)))
    const isBoss = enemy.type === 'boss'
    const arrowSize = isBoss ? 14 : 9
    ctx.save()
    ctx.translate(clampedX, clampedY)
    ctx.rotate(angle)
    // Glow for boss
    if (isBoss) {
      ctx.shadowColor = enemy.color
      ctx.shadowBlur = 12 + Math.sin(Date.now() * 0.004) * 5
    }
    // Arrow triangle
    ctx.fillStyle = enemy.color
    ctx.globalAlpha = isBoss ? 0.95 : 0.75
    ctx.beginPath()
    ctx.moveTo(arrowSize, 0)
    ctx.lineTo(-arrowSize * 0.7, -arrowSize * 0.55)
    ctx.lineTo(-arrowSize * 0.7, arrowSize * 0.55)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
    ctx.restore()
  }
}

// ─── Boss Health Bar ──────────────────────────────────────────────────────────

function drawBossHealthBar(
  ctx: CanvasRenderingContext2D,
  enemies: Enemy[],
  w: number,
  _h: number,
): void {
  const boss = enemies.find(e => e.type === 'boss' && e.isAlive)
  if (!boss) return
  const barW = 400
  const barH = 18
  const barX = w / 2 - barW / 2
  const barY = 28
  const hpRatio = boss.hp / boss.maxHp
  const phase = boss.bossPhase ?? 1
  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  roundRect(ctx, barX - 4, barY - 4, barW + 8, barH + 8, 5)
  ctx.fill()
  // HP fill color based on phase
  const fillColor = hpRatio > 0.66 ? '#22cc66' : hpRatio > 0.33 ? '#ffaa22' : '#ff2244'
  ctx.fillStyle = fillColor
  ctx.shadowColor = fillColor
  ctx.shadowBlur = 8
  roundRect(ctx, barX, barY, barW * hpRatio, barH, 3)
  ctx.fill()
  ctx.shadowBlur = 0
  // Phase dividers at 66% and 33%
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 2
  for (const threshold of [0.66, 0.33]) {
    const divX = barX + barW * threshold
    ctx.beginPath()
    ctx.moveTo(divX, barY - 2)
    ctx.lineTo(divX, barY + barH + 2)
    ctx.stroke()
  }
  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 1
  roundRect(ctx, barX, barY, barW, barH, 3)
  ctx.stroke()
  // Labels
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 12px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('BOSS', w / 2, barY - 8)
  ctx.fillStyle = '#ffffff88'
  ctx.font = '10px monospace'
  ctx.fillText(`${boss.hp} / ${boss.maxHp}  [Phase ${phase}]`, w / 2, barY + barH + 14)
  ctx.textAlign = 'left'
}

// ─── HUD ─────────────────────────────────────────────────────────────────────

function drawHUD(ctx: CanvasRenderingContext2D, player: Player, wave: number, score: number, highScore: number, level: number, theme: LevelTheme, w: number, h: number, lastStandUsed: boolean, isDailyChallenge?: boolean, difficultyLabel?: string): void {
  const padding = 24
  const barWidth = 220
  const barHeight = 12

  // Layout computed bottom-up to guarantee icon row fits inside canvas:
  // h-8: canvas bottom margin
  // h-38: icon row top (30px tall)
  // h-46: 8px gap
  // h-58: energy bar top (12px)
  // h-64: 6px gap
  // h-76: HP bar top (12px)
  const hpX = 24
  const hpY = h - 76

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
  const enY = h - 58

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

  // Ability cooldown icons (below energy bar)
  drawAbilityCooldowns(ctx, player, theme, hpX, h - 38)

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

  // Difficulty badge (top-right, below BEST score) — hidden for Normal, shown otherwise
  if (difficultyLabel) {
    const diffColor = difficultyLabel === 'VERY EASY' ? '#66ddff'
      : difficultyLabel === 'CLASSROOM' ? '#4dcfff'
      : difficultyLabel === 'EASY' ? '#44ff88'
      : '#ff8866'  // ARCADE
    ctx.textAlign = 'right'
    ctx.font = 'bold 11px monospace'
    ctx.fillStyle = diffColor
    ctx.shadowColor = diffColor
    ctx.shadowBlur = 8
    ctx.globalAlpha = 0.80
    ctx.fillText(difficultyLabel, w - padding, h - padding - 94)
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
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
  ctx.fillText('WASD Move | SPACE Dash | J Light | K Heavy | L Pulse | ; Time | Q Consumable', w / 2, h - 4)
  ctx.textAlign = 'left'

  // Daily Challenge badge (top-left)
  if (isDailyChallenge) {
    const badgeX = 12
    const badgeY = 12
    ctx.fillStyle = 'rgba(255, 200, 0, 0.15)'
    roundRect(ctx, badgeX, badgeY, 110, 22, 4)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)'
    ctx.lineWidth = 1
    roundRect(ctx, badgeX, badgeY, 110, 22, 4)
    ctx.stroke()
    ctx.fillStyle = '#ffc800'
    ctx.shadowColor = '#ffc800'
    ctx.shadowBlur = 6
    ctx.font = 'bold 11px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('◆ DAILY CHALLENGE', badgeX + 55, badgeY + 15)
    ctx.textAlign = 'left'
    ctx.shadowBlur = 0
  }
}

// ─── Ability Cooldown Icons ───────────────────────────────────────────────────

function drawAbilityCooldowns(ctx: CanvasRenderingContext2D, player: Player, theme: LevelTheme, x: number, y: number): void {
  const iconSize = 30
  const gap = 5
  const abilities = [
    { label: 'LT', key: 'J', color: '#cc88ff' },
    { label: 'HV', key: 'K', color: '#ffaa22' },
    { label: 'PW', key: 'L', color: '#7b2fff' },
    { label: 'TF', key: ';', color: '#00ccff' },
    { label: 'DS', key: '↑', color: '#22ffaa' },
  ] as const

  // Compute per-ability cooldown ratio (0 = ready, 1 = full cooldown)
  const pulseCost = S.PULSE_WAVE_COST
  const flickerCost = S.TIME_FLICKER_COST
  const cooldownRatio = player.attackMaxCooldown > 0 ? Math.max(0, player.attackCooldown / player.attackMaxCooldown) : 0
  const dashRatio = S.DASH_COOLDOWN > 0 ? Math.max(0, player.dashCooldown / S.DASH_COOLDOWN) : 0
  const flickerRatio = player.timeFlickerActive ? (player.timeFlickerTimer / S.TIME_FLICKER_DURATION) : 0

  const ratios = [
    cooldownRatio,                                              // LT
    player.heavyCharging ? (player.heavyChargeTime / S.HEAVY_CHARGE_TIME) : cooldownRatio, // HV shows charge progress
    player.energy < pulseCost ? -1 : cooldownRatio,           // PW: -1 = low energy
    player.energy < flickerCost ? -1 : flickerRatio,          // TF: -1 = low energy
    dashRatio,                                                  // DS
  ]

  for (let i = 0; i < abilities.length; i++) {
    const ab = abilities[i]
    const ix = x + i * (iconSize + gap)
    const iy = y
    const ratio = ratios[i]
    const lowEnergy = ratio === -1
    const coolRatio = lowEnergy ? 0 : ratio

    // Background
    ctx.fillStyle = '#111122'
    roundRect(ctx, ix, iy, iconSize, iconSize, 4)
    ctx.fill()

    // Cooldown fill (from bottom up)
    if (coolRatio < 1) {
      const fillH = iconSize * (1 - coolRatio)
      ctx.save()
      ctx.beginPath()
      // Clip to icon area
      roundRect(ctx, ix, iy, iconSize, iconSize, 4)
      ctx.clip()
      ctx.fillStyle = lowEnergy ? '#444455' : ab.color + '55'
      ctx.shadowColor = lowEnergy ? 'transparent' : ab.color
      ctx.shadowBlur = coolRatio < 0.05 ? 8 : 0
      ctx.fillRect(ix, iy + iconSize - fillH, iconSize, fillH)
      ctx.shadowBlur = 0
      ctx.restore()
    }

    // Border
    ctx.strokeStyle = lowEnergy ? '#333355' : (coolRatio < 0.05 ? ab.color : '#333355')
    ctx.lineWidth = coolRatio < 0.05 && !lowEnergy ? 1.5 : 1
    if (coolRatio < 0.05 && !lowEnergy) {
      ctx.shadowColor = ab.color
      ctx.shadowBlur = 6
    }
    roundRect(ctx, ix, iy, iconSize, iconSize, 4)
    ctx.stroke()
    ctx.shadowBlur = 0

    // Ability label
    ctx.fillStyle = lowEnergy ? '#555566' : (coolRatio > 0.8 ? '#555566' : '#ffffffcc')
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(ab.label, ix + iconSize / 2, iy + iconSize / 2 - 1)

    // Key hint below label
    ctx.fillStyle = lowEnergy ? '#444455' : '#ffffff44'
    ctx.font = '8px monospace'
    ctx.fillText(ab.key, ix + iconSize / 2, iy + iconSize / 2 + 9)
    ctx.textAlign = 'left'
  }
}

// ─── Mutator Feedback Overlay ─────────────────────────────────────────────────

function drawMutatorFeedback(ctx: CanvasRenderingContext2D, feedback: { name: string; description: string; color: string; timer: number }, w: number, h: number): void {
  const alpha = Math.min(1, feedback.timer / 0.4) * Math.min(1, feedback.timer)
  if (alpha <= 0) return

  ctx.save()
  ctx.globalAlpha = alpha

  // Drop shadow behind text for readability
  const cy = h * 0.62

  ctx.font = 'bold 22px monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = feedback.color
  ctx.shadowColor = feedback.color
  ctx.shadowBlur = 20
  ctx.fillText(feedback.name.toUpperCase(), w / 2, cy)
  ctx.shadowBlur = 0

  ctx.font = '13px monospace'
  ctx.fillStyle = '#ffffffcc'
  ctx.fillText(feedback.description, w / 2, cy + 22)

  ctx.textAlign = 'left'
  ctx.restore()
}

// ─── Announcements ───────────────────────────────────────────────────────────

function drawWaveAnnouncement(ctx: CanvasRenderingContext2D, wave: number, timer: number, theme: LevelTheme, affix: WaveAffix | null, w: number, h: number): void {
  const alpha = Math.min(1, timer / 1.5)
  ctx.fillStyle = `rgba(${hexToRgb(theme.glowColor)}, ${alpha * 0.85})`
  ctx.shadowColor = theme.glowColor
  ctx.shadowBlur = 30
  ctx.font = 'bold 48px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`WAVE ${wave}`, w / 2, h / 2 - 40)

  // Affix announcement (if present)
  if (affix) {
    ctx.shadowBlur = 15
    ctx.shadowColor = affix.color
    ctx.fillStyle = affix.color
    ctx.font = 'bold 22px monospace'
    ctx.fillText(affix.name.toUpperCase(), w / 2, h / 2)

    ctx.shadowBlur = 0
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`
    ctx.font = '14px monospace'
    ctx.fillText(affix.description, w / 2, h / 2 + 28)
  } else {
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`
    ctx.shadowBlur = 0
    ctx.font = '16px monospace'
    ctx.fillText('PREPARE YOURSELF', w / 2, h / 2)
  }

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

function drawDamageFeedback(
  ctx: CanvasRenderingContext2D,
  flashTimer: number,
  damageDir: { x: number; y: number },
  w: number,
  h: number,
): void {
  const alpha = flashTimer / S.DAMAGE_VIGNETTE_DURATION

  // Red vignette
  const cx = w / 2
  const cy = h / 2
  const vigGrad = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 0.75)
  vigGrad.addColorStop(0, 'transparent')
  vigGrad.addColorStop(0.6, 'transparent')
  vigGrad.addColorStop(1, `rgba(200,0,0,${0.55 * alpha})`)
  ctx.fillStyle = vigGrad
  ctx.fillRect(0, 0, w, h)

  // Directional blur — 3 semi-transparent offset overlays in the opposite direction (toward attacker)
  const blurRatio = Math.max(0, (flashTimer - (S.DAMAGE_VIGNETTE_DURATION - S.DAMAGE_BLUR_DURATION)) / S.DAMAGE_BLUR_DURATION)
  if (blurRatio > 0 && (damageDir.x !== 0 || damageDir.y !== 0)) {
    // Invert: blur toward attacker (opposite of damageDir)
    const bx = -damageDir.x * S.DAMAGE_BLUR_DISTANCE * blurRatio
    const by = -damageDir.y * S.DAMAGE_BLUR_DISTANCE * blurRatio
    for (let i = 1; i <= 3; i++) {
      const t = i / 3
      ctx.globalAlpha = 0.06 * blurRatio * (1 - t * 0.4)
      ctx.fillStyle = `rgba(200,0,0,1)`
      ctx.fillRect(bx * t, by * t, w, h)
    }
    ctx.globalAlpha = 1
  }
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

function drawConsumableEffect(
  ctx: CanvasRenderingContext2D,
  active: { type: ConsumableType; timer: number },
  w: number,
  h: number,
): void {
  switch (active.type) {
    case 'nuke': {
      const alpha = Math.min(1, active.timer * 2) * 0.45
      ctx.fillStyle = `rgba(255, 100, 20, ${alpha})`
      ctx.fillRect(0, 0, w, h)
      // "NUKE!" text flash
      if (active.timer > 0.25) {
        const textAlpha = (active.timer - 0.25) / 0.25
        ctx.fillStyle = `rgba(255, 200, 50, ${textAlpha})`
        ctx.shadowColor = '#ff6622'
        ctx.shadowBlur = 30
        ctx.font = 'bold 48px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('NUKE!', w / 2, h / 2)
        ctx.shadowBlur = 0
        ctx.textAlign = 'left'
      }
      break
    }
    case 'full_heal': {
      const alpha = Math.min(1, active.timer * 1.5) * 0.35
      ctx.fillStyle = `rgba(50, 255, 120, ${alpha})`
      ctx.fillRect(0, 0, w, h)
      // "HEALED!" text flash
      if (active.timer > 0.4) {
        const textAlpha = (active.timer - 0.4) / 0.4
        ctx.fillStyle = `rgba(100, 255, 150, ${textAlpha})`
        ctx.shadowColor = '#44ff88'
        ctx.shadowBlur = 25
        ctx.font = 'bold 44px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('HEALED!', w / 2, h / 2)
        ctx.shadowBlur = 0
        ctx.textAlign = 'left'
      }
      break
    }
    case 'invincibility': {
      const now = Date.now()
      const pulse = Math.sin(now * 0.008) * 0.5 + 0.5
      ctx.strokeStyle = `rgba(50, 200, 255, ${0.35 + pulse * 0.35})`
      ctx.lineWidth = 8
      ctx.shadowColor = '#44ccff'
      ctx.shadowBlur = 20
      ctx.strokeRect(4, 4, w - 8, h - 8)
      ctx.shadowBlur = 0
      break
    }
  }
}

function drawConsumableHUD(
  ctx: CanvasRenderingContext2D,
  consumables: ConsumableType[],
  consumableActive: { type: ConsumableType; timer: number } | null,
  w: number,
  h: number,
): void {
  const slotSize = 36
  const slotGap = 5
  // Position: bottom-right, above Level badge (which is at w-24, h-padding-58)
  const startX = w - 24 - slotSize
  const startY = h - 145

  // Show "Q" label if there are consumables
  if (consumables.length > 0) {
    ctx.font = '9px monospace'
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffffff55'
    ctx.fillText('[Q]', startX + slotSize, startY - 4)
    ctx.textAlign = 'left'
  }

  consumables.forEach((type, i) => {
    const x = startX - i * (slotSize + slotGap)
    const y = startY
    const { color, label } = getConsumableStyle(type)

    // Background
    ctx.fillStyle = color + '22'
    ctx.strokeStyle = color + 'bb'
    ctx.lineWidth = 1.5
    roundRect(ctx, x, y, slotSize, slotSize, 6)
    ctx.fill()
    ctx.stroke()

    // Icon
    ctx.font = 'bold 18px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 8
    ctx.fillText(label, x + slotSize / 2, y + slotSize / 2 + 7)
    ctx.shadowBlur = 0

    // Stack number (if more than 1)
    if (consumables.length > 1 && i === 0) {
      ctx.font = 'bold 10px monospace'
      ctx.fillStyle = '#ffffffcc'
      ctx.fillText(`${consumables.length}`, x + slotSize - 7, y + 11)
    }
  })

  // Active effect indicator (e.g., invincibility timer bar)
  if (consumableActive && consumableActive.type === 'invincibility') {
    const { color } = getConsumableStyle('invincibility')
    const barW = slotSize
    const barH = 4
    const x = startX
    const y = startY + slotSize + 4
    const maxTimer = 3.0
    const ratio = Math.max(0, consumableActive.timer / maxTimer)

    ctx.fillStyle = '#ffffff22'
    roundRect(ctx, x, y, barW, barH, 2)
    ctx.fill()

    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 6
    roundRect(ctx, x, y, barW * ratio, barH, 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  ctx.textAlign = 'left'
}

function getConsumableStyle(type: ConsumableType): { color: string; label: string } {
  switch (type) {
    case 'nuke': return { color: '#ff6622', label: '\u2622' }
    case 'full_heal': return { color: '#44ff88', label: '\u271a' }
    case 'invincibility': return { color: '#44ccff', label: '\u25c6' }
  }
}

function drawGameOver(
  ctx: CanvasRenderingContext2D,
  score: number,
  highScore: number,
  level: number,
  damageByEnemyType: Record<EnemyType, number>,
  w: number,
  h: number,
  isDailyChallenge?: boolean,
  dailyLeaderboard?: DailyEntry[],
  totalKills = 0,
  totalDamageDealt = 0,
  contractsCompleted = 0,
  mutatorsCount = 0,
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#ff2244'
  ctx.shadowColor = '#ff2244'
  ctx.shadowBlur = 30
  ctx.font = 'bold 56px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('SHADOW FALLS', w / 2, h / 2 - 110)

  ctx.shadowBlur = 0
  ctx.fillStyle = '#ffffff66'
  ctx.font = '16px monospace'
  ctx.fillText(`Reached Level ${level}`, w / 2, h / 2 - 65)

  // Death Recap - find top damage source
  const topDamageType = getTopDamageSource(damageByEnemyType)
  const topDamageColor = topDamageType !== 'none' ? S.ENEMY_COLORS[topDamageType as keyof typeof S.ENEMY_COLORS] : '#ffffff'
  const hint = S.DEATH_HINTS[topDamageType] || S.DEATH_HINTS.none

  // Show top damage source
  if (topDamageType !== 'none') {
    ctx.fillStyle = '#ffffff88'
    ctx.font = '14px monospace'
    ctx.fillText('Most damage from:', w / 2, h / 2 - 30)

    ctx.fillStyle = topDamageColor
    ctx.shadowColor = topDamageColor
    ctx.shadowBlur = 10
    ctx.font = 'bold 18px monospace'
    ctx.fillText(topDamageType.toUpperCase(), w / 2, h / 2 - 8)
    ctx.shadowBlur = 0
  }

  // Show hint
  ctx.fillStyle = '#aaaaaa'
  ctx.font = '13px monospace'
  ctx.fillText(hint, w / 2, h / 2 + 20)

  // Run stats card
  {
    const cardW = 320
    const cardH = 66
    const cardX = w / 2 - cardW / 2
    const cardY = h / 2 + 35
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    roundRect(ctx, cardX, cardY, cardW, cardH, 6)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1
    roundRect(ctx, cardX, cardY, cardW, cardH, 6)
    ctx.stroke()

    // Divider line between columns
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.beginPath()
    ctx.moveTo(cardX + cardW / 2, cardY + 8)
    ctx.lineTo(cardX + cardW / 2, cardY + cardH - 8)
    ctx.stroke()

    const colW = cardW / 2   // 160px each
    const pad = 12
    const rows = [
      [{ label: 'KILLS', val: String(totalKills) }, { label: 'DAMAGE', val: totalDamageDealt.toLocaleString() }],
      [{ label: 'MUTATORS', val: String(mutatorsCount) }, { label: 'CONTRACTS', val: String(contractsCompleted) }],
    ]
    rows.forEach((row, ri) => {
      const y = cardY + 24 + ri * 22
      row.forEach((item, ci) => {
        const cellLeft = cardX + ci * colW
        // Label — left-aligned inside cell
        ctx.fillStyle = '#ffffff55'
        ctx.font = '10px monospace'
        ctx.textAlign = 'left'
        ctx.fillText(item.label, cellLeft + pad, y)
        // Value — right-aligned inside cell
        ctx.fillStyle = '#ffffffdd'
        ctx.font = 'bold 12px monospace'
        ctx.textAlign = 'right'
        ctx.fillText(item.val, cellLeft + colW - pad, y)
      })
    })
    ctx.textAlign = 'center'
  }

  // Score
  ctx.fillStyle = '#ffffffcc'
  ctx.font = '20px monospace'
  ctx.fillText(`SCORE: ${score}`, w / 2, h / 2 + 110)

  if (score >= highScore && highScore > 0) {
    ctx.fillStyle = '#ffaa22'
    ctx.font = 'bold 16px monospace'
    ctx.fillText('NEW HIGH SCORE!', w / 2, h / 2 + 135)
  }

  ctx.fillStyle = '#ffffff66'
  ctx.font = '14px monospace'
  ctx.fillText('Press R to restart', w / 2, h / 2 + 165)
  ctx.textAlign = 'left'

  // Daily Challenge leaderboard
  if (isDailyChallenge && dailyLeaderboard && dailyLeaderboard.length > 0) {
    const lbX = w / 2
    let lbY = h / 2 + 175

    // Header
    ctx.fillStyle = '#ffc800'
    ctx.shadowColor = '#ffc800'
    ctx.shadowBlur = 8
    ctx.font = 'bold 13px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('◆ TODAY\'S LEADERBOARD', lbX, lbY)
    ctx.shadowBlur = 0
    lbY += 20

    for (const entry of dailyLeaderboard) {
      const isYou = entry.is_you
      ctx.fillStyle = isYou ? '#ffc800' : '#ffffff88'
      if (isYou) {
        ctx.shadowColor = '#ffc800'
        ctx.shadowBlur = 6
      }
      ctx.font = isYou ? 'bold 12px monospace' : '12px monospace'
      const nameDisplay = entry.player_name.length > 14 ? entry.player_name.slice(0, 13) + '…' : entry.player_name
      const line = `#${entry.rank}  ${nameDisplay.padEnd(14)}  ${String(entry.score).padStart(7)}  W${entry.wave_reached}`
      ctx.fillText(line, lbX, lbY)
      ctx.shadowBlur = 0
      lbY += 16
    }

    ctx.textAlign = 'left'
  } else if (isDailyChallenge) {
    // Loading or no Supabase
    ctx.fillStyle = '#ffffff33'
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Loading leaderboard…', w / 2, h / 2 + 185)
    ctx.textAlign = 'left'
  }
}

// Helper to find which enemy type dealt the most damage
function getTopDamageSource(damageByType: Record<EnemyType, number>): string {
  let topType: string = 'none'
  let topDamage = 0

  for (const [type, damage] of Object.entries(damageByType)) {
    if (damage > topDamage) {
      topDamage = damage
      topType = type
    }
  }

  return topType
}

// ─── Mutator UI ─────────────────────────────────────────────────────────────

function drawMutatorSelection(
  ctx: CanvasRenderingContext2D,
  choices: Mutator[],
  activeMutators: Mutator[],
  selectionTimer: number,
  peekActive: boolean,
  w: number,
  h: number,
): void {
  const now = Date.now()
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

  // Dark overlay with cosmic star field
  ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'
  ctx.fillRect(0, 0, w, h)

  // Ambient star particles
  for (let i = 0; i < 30; i++) {
    const sx = ((Math.sin(now * 0.0002 + i * 2.7) + 1) / 2) * w
    const sy = ((Math.cos(now * 0.00015 + i * 1.9) + 1) / 2) * h
    const sa = Math.sin(now * 0.001 + i * 0.8) * 0.15 + 0.15
    ctx.globalAlpha = sa
    ctx.fillStyle = '#7b2fff'
    ctx.beginPath()
    ctx.arc(sx, sy, i % 4 === 0 ? 2 : 1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Title (fades in)
  const titleAlpha = Math.min(1, selectionTimer / 0.3)
  ctx.globalAlpha = titleAlpha
  ctx.fillStyle = '#7b2fff'
  ctx.shadowColor = '#7b2fff'
  ctx.shadowBlur = 30
  ctx.font = 'bold 36px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('CHOOSE YOUR MUTATOR', w / 2, 90)
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1

  // Subtitle
  ctx.fillStyle = `rgba(255,255,255,${titleAlpha * 0.4})`
  ctx.font = '14px monospace'
  ctx.fillText('Press 1, 2, or 3 to select  ·  Hold Tab to peek your build', w / 2, 120)

  // Card dimensions
  const cardWidth = 300
  const cardHeight = 320
  const cardSpacing = 40
  const totalWidth = choices.length * cardWidth + (choices.length - 1) * cardSpacing
  const startX = (w - totalWidth) / 2
  const baseCardY = (h - cardHeight) / 2 + 20

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

  // Epic choice announcement banner
  const hasEpic = choices.some(c => c.rarity === 'epic')
  if (hasEpic) {
    const epicFlash = Math.sin(now * 0.005) * 0.35 + 0.65
    ctx.globalAlpha = titleAlpha * epicFlash
    ctx.fillStyle = '#cc66ff'
    ctx.shadowColor = '#aa44ee'
    ctx.shadowBlur = 20
    ctx.font = 'bold 13px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('✦ EPIC CHOICE AVAILABLE ✦', w / 2, 148)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }

  for (let i = 0; i < choices.length; i++) {
    const mutator = choices[i]
    const cardX = startX + i * (cardWidth + cardSpacing)

    // Float-in animation: slides up from below over first 0.4s
    const floatProgress = easeOut(Math.min(1, selectionTimer / 0.4))
    const floatOffset = (1 - floatProgress) * 120
    // Gentle oscillation after landing
    const oscillate = floatProgress >= 1 ? Math.sin(now * 0.001 + i * 2.1) * 3 : 0
    const cardY = baseCardY + floatOffset + oscillate

    ctx.globalAlpha = floatProgress

    // Radial glow behind card
    const glowGrad = ctx.createRadialGradient(
      cardX + cardWidth / 2, cardY + cardHeight / 2, 0,
      cardX + cardWidth / 2, cardY + cardHeight / 2, cardWidth * 0.8,
    )
    glowGrad.addColorStop(0, mutator.color + '18')
    glowGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = glowGrad
    ctx.fillRect(cardX - 30, cardY - 30, cardWidth + 60, cardHeight + 60)

    // Card background
    ctx.fillStyle = rarityBgColors[mutator.rarity]
    ctx.strokeStyle = rarityBorderColors[mutator.rarity]
    ctx.lineWidth = mutator.rarity === 'epic' ? 2.5 : 2
    roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 12)
    ctx.fill()
    ctx.stroke()

    // Epic rarity fanfare: animated shimmer sweep + extra pulsing border glow
    if (mutator.rarity === 'epic') {
      const epicPulse = Math.sin(now * 0.003) * 0.5 + 0.5
      ctx.shadowColor = mutator.color
      ctx.shadowBlur = 18 + epicPulse * 14
      ctx.strokeStyle = mutator.color + Math.round((0.4 + epicPulse * 0.4) * 255).toString(16).padStart(2, '0')
      ctx.lineWidth = 2.5
      roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 12)
      ctx.stroke()
      ctx.shadowBlur = 0

      // Shimmer sweep line (top → bottom over 1.5s cycle)
      const shimmerT = ((now * 0.0007) % 1)
      const shimmerY = cardY + shimmerT * (cardHeight + 20) - 10
      if (shimmerY > cardY && shimmerY < cardY + cardHeight) {
        const shimGrad = ctx.createLinearGradient(cardX, shimmerY - 8, cardX, shimmerY + 8)
        shimGrad.addColorStop(0, 'transparent')
        shimGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)')
        shimGrad.addColorStop(1, 'transparent')
        ctx.save()
        ctx.beginPath()
        roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 12)
        ctx.clip()
        ctx.fillStyle = shimGrad
        ctx.fillRect(cardX, shimmerY - 8, cardWidth, 16)
        ctx.restore()
      }
    }

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

    // Synergy hint — highlight if active build contains a synergizing mutator
    const activeIds = new Set(activeMutators.map(m => m.id))
    const synergyMatches = (mutator.synergizes ?? []).filter(id => activeIds.has(id))
    if (synergyMatches.length > 0) {
      const synergyNames = synergyMatches.map(id => {
        const m = activeMutators.find(am => am.id === id)
        return m ? m.name : id
      })
      const synergyY = cardY + 165 + lines.length * 20 + 20
      ctx.font = 'bold 11px monospace'
      ctx.fillStyle = '#ffee44'
      ctx.shadowColor = '#ffee44'
      ctx.shadowBlur = 8
      ctx.fillText(`⚡ Synergy: ${synergyNames.join(', ')}`, cardX + cardWidth / 2, synergyY)
      ctx.shadowBlur = 0
    }

    // Stat delta preview — show what changes when picking this mutator
    const beforeMods = computeCombinedModifiers(activeMutators)
    const afterMods = computeCombinedModifiers([...activeMutators, mutator])
    const statDeltas: Array<{ label: string; value: string; positive: boolean }> = []

    const checkMult = (field: keyof typeof beforeMods, label: string) => {
      const b = (beforeMods[field] as number | undefined) ?? 1
      const a = (afterMods[field] as number | undefined) ?? 1
      const delta = Math.round((a - b) * 100)
      if (delta !== 0) statDeltas.push({ label, value: `${delta > 0 ? '+' : ''}${delta}%`, positive: delta > 0 })
    }
    const checkBonus = (field: keyof typeof beforeMods, label: string, unit = '') => {
      const b = (beforeMods[field] as number | undefined) ?? 0
      const a = (afterMods[field] as number | undefined) ?? 0
      const delta = Math.round((a - b) * 10) / 10
      if (delta !== 0) statDeltas.push({ label, value: `${delta > 0 ? '+' : ''}${delta}${unit}`, positive: delta > 0 })
    }

    checkMult('lightDamageMultiplier', 'Light DMG')
    checkMult('heavyDamageMultiplier', 'Heavy DMG')
    checkMult('pulseWaveDamageMultiplier', 'Pulse DMG')
    checkMult('speedMultiplier', 'Speed')
    checkBonus('maxHpBonus', 'Max HP')
    checkBonus('maxEnergyBonus', 'Max Energy')
    if (mutator.modifiers.autoLightAttack && !beforeMods.autoLightAttack) statDeltas.push({ label: 'AUTO LIGHT', value: 'ON', positive: true })
    if (mutator.modifiers.autoPulseWave && !beforeMods.autoPulseWave) statDeltas.push({ label: 'AUTO PULSE', value: 'ON', positive: true })
    if (mutator.modifiers.dashDamagesEnemies && !beforeMods.dashDamagesEnemies) statDeltas.push({ label: 'DASH DAMAGE', value: 'ON', positive: true })

    const displayDeltas = statDeltas.slice(0, 3)
    if (displayDeltas.length > 0) {
      const deltaStartY = cardY + cardHeight - 90
      ctx.font = '10px monospace'
      ctx.textAlign = 'left'
      for (let d = 0; d < displayDeltas.length; d++) {
        const delta = displayDeltas[d]
        const dy = deltaStartY + d * 15
        ctx.fillStyle = delta.positive ? '#66ffaa' : '#ff6644'
        ctx.fillText(`${delta.positive ? '↑' : '↓'} ${delta.label}`, cardX + 16, dy)
        ctx.textAlign = 'right'
        ctx.fillText(delta.value, cardX + cardWidth - 16, dy)
        ctx.textAlign = 'left'
      }
      // Separator line above deltas
      ctx.strokeStyle = '#ffffff18'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cardX + 12, deltaStartY - 8)
      ctx.lineTo(cardX + cardWidth - 12, deltaStartY - 8)
      ctx.stroke()
    }

    // Key prompt
    ctx.font = 'bold 28px monospace'
    ctx.fillStyle = mutator.color
    ctx.shadowColor = mutator.color
    ctx.shadowBlur = 12
    ctx.textAlign = 'center'
    ctx.fillText(`[${i + 1}]`, cardX + cardWidth / 2, cardY + cardHeight - 18)
    ctx.shadowBlur = 0

    ctx.globalAlpha = 1
  }

  ctx.globalAlpha = 1
  ctx.textAlign = 'left'

  // Peek sidebar — current build overview
  if (peekActive && activeMutators.length > 0) {
    const sideW = 220
    const sideX = w - sideW - 16
    const sideY = 60
    const sideH = Math.min(h - 100, activeMutators.length * 52 + 50)

    ctx.fillStyle = 'rgba(0,0,0,0.82)'
    ctx.strokeStyle = '#7b2fff66'
    ctx.lineWidth = 1
    roundRect(ctx, sideX, sideY, sideW, sideH, 10)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#7b2fff'
    ctx.font = 'bold 11px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('YOUR BUILD', sideX + sideW / 2, sideY + 18)

    for (let i = 0; i < activeMutators.length; i++) {
      const m = activeMutators[i]
      const iy = sideY + 32 + i * 52
      ctx.fillStyle = m.color + '22'
      ctx.strokeStyle = m.color + '55'
      ctx.lineWidth = 1
      roundRect(ctx, sideX + 8, iy, sideW - 16, 44, 6)
      ctx.fill()
      ctx.stroke()

      ctx.font = '18px monospace'
      ctx.textAlign = 'left'
      ctx.fillStyle = m.color
      ctx.fillText(m.icon, sideX + 14, iy + 27)

      ctx.font = 'bold 11px monospace'
      ctx.fillStyle = '#ffffffcc'
      ctx.fillText(m.name, sideX + 38, iy + 16)

      ctx.font = '9px monospace'
      ctx.fillStyle = '#ffffff55'
      const desc = m.description.length > 28 ? m.description.slice(0, 26) + '…' : m.description
      ctx.fillText(desc, sideX + 38, iy + 30)
    }
    ctx.textAlign = 'left'
  }
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

  // Failure penalty badge (top-right, shown when active)
  if (status === 'active' && contract.failurePenalty === 'drop_to_1hp') {
    const penaltyLabel = '⚠ 1HP'
    ctx.font = 'bold 9px monospace'
    const penW = ctx.measureText(penaltyLabel).width + 10
    const penX = bannerX + bannerW - penW - 8
    const penY = bannerY + 6
    ctx.fillStyle = 'rgba(255, 60, 60, 0.15)'
    ctx.strokeStyle = '#ff4444aa'
    ctx.lineWidth = 1
    roundRect(ctx, penX, penY, penW, 16, 3)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#ff6666'
    ctx.textAlign = 'center'
    ctx.fillText(penaltyLabel, penX + penW / 2, penY + 11)
    ctx.textAlign = 'left'
  }

  // Failed penalty reminder
  if (status === 'failed' && contract.failurePenalty === 'drop_to_1hp') {
    ctx.font = 'bold 9px monospace'
    ctx.fillStyle = '#ff4444cc'
    ctx.textAlign = 'right'
    ctx.fillText('→ 1HP', bannerX + bannerW - 10, bannerY + bannerH - 10)
    ctx.textAlign = 'left'
  }

  // Reward preview (right side, shown when active)
  if (status === 'active') {
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffffff44'
    let rewardText = `+${contract.scoreBonus} | +${contract.hpRestore}HP | +${contract.energyRestore}E`
    if (contract.consumableReward) {
      const icons: Record<string, string> = { nuke: '\u2622', full_heal: '\u271a', invincibility: '\u25c6' }
      const icon = icons[contract.consumableReward] ?? '?'
      rewardText += ` | ${icon}`
      ctx.fillStyle = '#ffffffcc'
    }
    ctx.fillText(rewardText, bannerX + bannerW - 10, bannerY + bannerH - 10)
    ctx.textAlign = 'left'
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

// ─── Affix Rendering ─────────────────────────────────────────────────────────

function drawAffixAura(ctx: CanvasRenderingContext2D, enemy: Enemy, affix: WaveAffix, now: number): void {
  const pulse = Math.sin(now * 0.004) * 0.2 + 0.5
  const auraSize = enemy.size * (1.6 + pulse * 0.2)

  // Radial gradient aura
  const gradient = ctx.createRadialGradient(0, 0, enemy.size * 0.3, 0, 0, auraSize)
  gradient.addColorStop(0, 'transparent')
  gradient.addColorStop(0.5, affix.color + '15')
  gradient.addColorStop(0.8, affix.color + '22')
  gradient.addColorStop(1, 'transparent')

  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(0, 0, auraSize, 0, Math.PI * 2)
  ctx.fill()

  // Berserker: intensify aura when active
  if (affix.berserkerThreshold && enemy.affixState.isBerserking) {
    const ragePulse = Math.sin(now * 0.015) * 0.3 + 0.7
    ctx.strokeStyle = affix.color + Math.round(ragePulse * 200).toString(16).padStart(2, '0')
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, enemy.size + 4, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Small icon above enemy
  drawAffixIcon(ctx, affix, enemy.size)
}

function drawAffixTransform(ctx: CanvasRenderingContext2D, enemy: Enemy, affix: WaveAffix, now: number): void {
  const s = enemy.size

  switch (affix.id) {
    case 'armored': {
      // 6 angular shield plates rotating slowly around enemy
      const plateCount = 6
      const rot = now * 0.0003
      ctx.strokeStyle = '#8888aa88'
      ctx.lineWidth = 3
      for (let i = 0; i < plateCount; i++) {
        const angle = rot + (i / plateCount) * Math.PI * 2
        const px = Math.cos(angle) * (s + 4)
        const py = Math.sin(angle) * (s + 4)
        const perpA = angle + Math.PI / 2
        const pw = 7
        ctx.fillStyle = `rgba(136,136,170,0.28)`
        ctx.beginPath()
        ctx.moveTo(px + Math.cos(perpA) * pw, py + Math.sin(perpA) * pw)
        ctx.lineTo(px - Math.cos(perpA) * pw, py - Math.sin(perpA) * pw)
        ctx.lineTo(
          (px - Math.cos(perpA) * pw) + Math.cos(angle) * 5,
          (py - Math.sin(perpA) * pw) + Math.sin(angle) * 5,
        )
        ctx.lineTo(
          (px + Math.cos(perpA) * pw) + Math.cos(angle) * 5,
          (py + Math.sin(perpA) * pw) + Math.sin(angle) * 5,
        )
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
      break
    }
    case 'volatile': {
      // 10 flickering flame tongues
      const flameCount = 10
      for (let i = 0; i < flameCount; i++) {
        const baseAngle = (i / flameCount) * Math.PI * 2
        const flicker = Math.sin(now * 0.015 + i * 0.8) * 0.4 + 0.6
        const fh = (8 + flicker * 10)
        const fx = Math.cos(baseAngle) * (s + 2)
        const fy = Math.sin(baseAngle) * (s + 2)
        const tipX = fx + Math.cos(baseAngle) * fh
        const tipY = fy + Math.sin(baseAngle) * fh
        const grad = ctx.createLinearGradient(fx, fy, tipX, tipY)
        grad.addColorStop(0, `rgba(255,68,68,${0.5 * flicker})`)
        grad.addColorStop(0.6, `rgba(255,170,34,${0.35 * flicker})`)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.moveTo(fx, fy)
        ctx.lineTo(
          fx + Math.cos(baseAngle + 0.5) * (fh * 0.4),
          fy + Math.sin(baseAngle + 0.5) * (fh * 0.4),
        )
        ctx.lineTo(tipX, tipY)
        ctx.lineTo(
          fx + Math.cos(baseAngle - 0.5) * (fh * 0.4),
          fy + Math.sin(baseAngle - 0.5) * (fh * 0.4),
        )
        ctx.closePath()
        ctx.fill()
      }
      break
    }
    case 'berserker': {
      // 2 pulsing aura rings (alternating phase), faster when berserking
      const speed = enemy.affixState.isBerserking ? 0.008 : 0.004
      for (let r = 0; r < 2; r++) {
        const phase = r * Math.PI
        const ringPulse = Math.sin(now * speed + phase) * 0.3 + 0.5
        ctx.strokeStyle = `rgba(255,34,102,${ringPulse * 0.7})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(0, 0, s + 6 + r * 5 + ringPulse * 3, 0, Math.PI * 2)
        ctx.stroke()
      }
      break
    }
    case 'swift': {
      // Motion trail lines behind enemy in movement direction
      const vx = enemy.vel.x
      const vy = enemy.vel.y
      const speed2 = Math.sqrt(vx * vx + vy * vy)
      if (speed2 > 10) {
        const nx = -vx / speed2
        const ny = -vy / speed2
        for (let t = 1; t <= 4; t++) {
          const tx = nx * t * 8
          const ty = ny * t * 8
          ctx.strokeStyle = `rgba(34,255,170,${0.25 - t * 0.05})`
          ctx.lineWidth = s * 0.4
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(tx - nx * 4, ty - ny * 4)
          ctx.lineTo(tx + nx * 4, ty + ny * 4)
          ctx.stroke()
        }
      }
      break
    }
    case 'regenerating': {
      // Green wisps floating upward
      for (let i = 0; i < 6; i++) {
        const wispAngle = (i / 6) * Math.PI * 2
        const drift = now * 0.001 + i * 1.1
        const wx = Math.cos(wispAngle) * (s + 4) + Math.sin(drift) * 4
        const wy = Math.sin(wispAngle) * (s + 4) - ((drift % (Math.PI * 2)) / (Math.PI * 2)) * 16
        const wa = 0.5 - ((drift % (Math.PI * 2)) / (Math.PI * 2)) * 0.4
        ctx.fillStyle = `rgba(68,255,136,${Math.max(0, wa)})`
        ctx.beginPath()
        ctx.arc(wx, wy, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'frenzied': {
      // Orange flicker ring on body — faster when attacking
      const fFlicker = Math.sin(now * (enemy.isAttacking ? 0.02 : 0.01)) * 0.3 + 0.5
      ctx.strokeStyle = `rgba(255,170,34,${fFlicker * 0.65})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, s + 3, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
  }
}

function drawAffixIcon(ctx: CanvasRenderingContext2D, affix: WaveAffix, enemySize: number): void {
  const iconY = -enemySize - 18

  // Icon background
  ctx.fillStyle = affix.color + '44'
  ctx.strokeStyle = affix.color + '88'
  ctx.lineWidth = 1
  roundRect(ctx, -12, iconY - 7, 24, 12, 3)
  ctx.fill()
  ctx.stroke()

  // Icon text
  ctx.font = 'bold 8px monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = affix.color
  ctx.fillText(affix.icon, 0, iconY + 2)
  ctx.textAlign = 'left'
}

function drawCurrentAffix(ctx: CanvasRenderingContext2D, affix: WaveAffix, mutatorCount: number, w: number, h: number): void {
  const padding = 24
  const yOffset = padding + (mutatorCount > 0 ? 54 : 10)

  // Label
  ctx.fillStyle = '#ffffff55'
  ctx.font = '10px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('WAVE AFFIX', padding, yOffset + 10)

  // Affix card — more visible with glow
  const cardX = padding
  const cardY = yOffset + 14
  const cardW = 120
  const cardH = 28

  ctx.shadowColor = affix.color
  ctx.shadowBlur = 8
  ctx.fillStyle = affix.color + '30'
  ctx.strokeStyle = affix.color + '99'
  ctx.lineWidth = 1.5
  roundRect(ctx, cardX, cardY, cardW, cardH, 5)
  ctx.fill()
  ctx.stroke()
  ctx.shadowBlur = 0

  // Icon
  ctx.font = 'bold 11px monospace'
  ctx.fillStyle = affix.color
  ctx.fillText(affix.icon, cardX + 8, cardY + 18)

  // Name
  ctx.font = 'bold 11px monospace'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(affix.name, cardX + 28, cardY + 12)

  // Tier
  ctx.font = '9px monospace'
  ctx.fillStyle = affix.color + 'cc'
  ctx.fillText(affix.tier.toUpperCase(), cardX + 28, cardY + 23)
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

// ─── Educational Layer — Draw Functions ──────────────────────────────────────

/**
 * Full-screen blocking overlay shown when Hebrew keyboard layout is detected.
 * Purely visual — no Hebrew or English text needed.
 */
function drawHebrewLayoutGuide(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const now = Date.now()

  // 95% opaque dark overlay
  ctx.fillStyle = 'rgba(8, 8, 18, 0.95)'
  ctx.fillRect(0, 0, w, h)

  // Keyboard emoji large centered
  ctx.font = 'bold 80px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('⌨️', w / 2, h / 2 - 100)

  // Hebrew flag → arrow → English flag
  ctx.font = 'bold 52px serif'
  const flagY = h / 2 - 10
  ctx.fillText('🇮🇱', w / 2 - 90, flagY)
  ctx.font = 'bold 36px monospace'
  ctx.fillStyle = '#ffffff88'
  ctx.fillText('→', w / 2, flagY)
  ctx.font = 'bold 52px serif'
  ctx.fillText('🇺🇸', w / 2 + 90, flagY)

  // ❌ on Hebrew flag, ✓ on English flag
  ctx.font = 'bold 26px monospace'
  ctx.fillStyle = '#ff4444'
  ctx.fillText('✗', w / 2 - 90, flagY + 44)
  ctx.fillStyle = '#44ff88'
  ctx.fillText('✓', w / 2 + 90, flagY + 44)

  // Physical key shapes for Alt + Shift / Win + Space, highlighted yellow
  const keyY = h / 2 + 80
  const keyPairs: Array<[string, string]> = [['Alt', 'Shift'], ['Win', 'Space']]
  const pairWidth = 200
  const startX = w / 2 - (keyPairs.length * pairWidth) / 2 + pairWidth / 2

  for (let pi = 0; pi < keyPairs.length; pi++) {
    const px = startX + pi * pairWidth
    const [keyA, keyB] = keyPairs[pi]
    const pulse = Math.sin(now * 0.005 + pi) * 0.3 + 0.7

    // Separator "/"
    if (pi > 0) {
      ctx.font = 'bold 20px monospace'
      ctx.fillStyle = '#ffffff33'
      ctx.textAlign = 'center'
      ctx.fillText('/', px - pairWidth / 2, keyY + 16)
    }

    for (let ki = 0; ki < 2; ki++) {
      const kx = px - 46 + ki * 52
      const kLabel = ki === 0 ? keyA : keyB
      const kW = kLabel === 'Space' ? 72 : 50
      const kH = 36

      // Key background
      ctx.fillStyle = `rgba(255, 220, 30, ${0.18 * pulse})`
      ctx.strokeStyle = `rgba(255, 220, 30, ${0.8 * pulse})`
      ctx.lineWidth = 2
      roundRect(ctx, kx - kW / 2, keyY, kW, kH, 6)
      ctx.fill()
      ctx.stroke()

      // Key label
      ctx.font = `bold 14px monospace`
      ctx.fillStyle = `rgba(255, 240, 120, ${pulse})`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(kLabel, kx, keyY + kH / 2)
    }
  }

  // Instruction hint row at bottom
  ctx.font = '16px monospace'
  ctx.fillStyle = '#ffffff33'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Switch to English keyboard layout to continue', w / 2, h / 2 + 160)
}

/**
 * Small keyboard diagram in bottom-left corner (Grade 1–4).
 * Shows progressive key unlock by wave number.
 * Fades after KEYBOARD_PANEL_FADE_DELAY seconds for grade 3–4.
 */
function drawKeyboardPanel(
  ctx: CanvasRenderingContext2D,
  grade: number,
  wave: number,
  keyboardPanelTimer: number,
  w: number,
  h: number,
): void {
  // Determine alpha
  let alpha = 1.0
  if (grade >= 3) {
    const fadeStart = S.KEYBOARD_PANEL_FADE_DELAY / 1000  // convert ms → s
    if (keyboardPanelTimer >= fadeStart) {
      alpha = 0
    } else if (keyboardPanelTimer >= fadeStart - 0.5) {
      alpha = (fadeStart - keyboardPanelTimer) / 0.5
    }
  }
  if (alpha <= 0) return

  ctx.save()
  ctx.globalAlpha = alpha

  const panelX = 12
  const panelH = 115
  // Sit above the player vitals (HP label starts at h-80; add 8px gap)
  const panelY = h - 80 - 8 - panelH
  const panelW = 300

  // Panel background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
  ctx.strokeStyle = '#7b2fff44'
  ctx.lineWidth = 1
  roundRect(ctx, panelX, panelY, panelW, panelH, 8)
  ctx.fill()
  ctx.stroke()

  // Title
  ctx.font = '10px monospace'
  ctx.fillStyle = '#ffffff44'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('KEYBOARD', panelX + 8, panelY + 7)

  // Progressive key unlock by wave
  const unlocked: Record<string, boolean> = {
    w: true, a: true, s: true, d: true,   // Wave 1
    j: wave >= 2,                          // Wave 2
    k: wave >= 3,                          // Wave 3
    l: wave >= 4, ' ': wave >= 4,          // Wave 4
    ';': wave >= 6,                        // Wave 6
  }

  const KEY_COLORS: Record<string, string> = {
    w: '#88ff88', a: '#88ff88', s: '#88ff88', d: '#88ff88',
    j: '#cc99ff', k: '#ffaa22', l: '#44ccff', ';': '#ffffff', ' ': '#ffdd44',
  }
  const KEY_LABELS: Record<string, string> = {
    w: 'W', a: 'A', s: 'S', d: 'D',
    j: 'J', k: 'K', l: 'L', ';': ';', ' ': 'SPC',
  }
  const ACTION_LABELS: Record<string, string> = {
    w: '', a: '', s: 'Move', d: '',
    j: 'Light', k: 'Heavy', l: 'Pulse', ';': 'Slow', ' ': 'Dash',
  }

  const kW = 28
  const kH = 26

  const drawKey = (label: string, action: string, kx: number, ky: number, color: string, isUnlocked: boolean) => {
    const kActual = label === 'SPC' ? 44 : kW
    ctx.fillStyle = isUnlocked ? color + '22' : '#ffffff08'
    ctx.strokeStyle = isUnlocked ? color + 'cc' : '#ffffff22'
    ctx.lineWidth = 1
    roundRect(ctx, kx, ky, kActual, kH, 4)
    ctx.fill()
    ctx.stroke()

    ctx.font = `bold 11px monospace`
    ctx.fillStyle = isUnlocked ? color : '#ffffff22'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, kx + kActual / 2, ky + kH / 2)

    if (action && isUnlocked) {
      ctx.font = '8px monospace'
      ctx.fillStyle = color + 'aa'
      ctx.textAlign = 'center'
      ctx.fillText(action, kx + kActual / 2, ky + kH + 8)
    }
  }

  // ── WASD: triangular keyboard shape ──────────────────────────────────
  //       [W]
  //    [A][S][D]
  const wasdX = panelX + 10
  const asdY  = panelY + 56
  const wY    = asdY - kH - 5

  drawKey('W', '',     wasdX + kW + 4,       wY,   KEY_COLORS['w'], unlocked['w'])
  drawKey('A', '',     wasdX,                asdY, KEY_COLORS['a'], unlocked['a'])
  drawKey('S', 'Move', wasdX + kW + 4,       asdY, KEY_COLORS['s'], unlocked['s'])
  drawKey('D', '',     wasdX + 2 * (kW + 4), asdY, KEY_COLORS['d'], unlocked['d'])

  // ── J K L ; SPC — aligned with ASD row ───────────────────────────────
  // WASD block width: 3*(kW+4)-4 = 92px; gap = 12px
  let cx = wasdX + 3 * (kW + 4) - 4 + 12
  for (const k of ['j', 'k', 'l', ';', ' '] as const) {
    const label = KEY_LABELS[k]
    drawKey(label, ACTION_LABELS[k], cx, asdY, KEY_COLORS[k], unlocked[k])
    cx += (label === 'SPC' ? 44 : kW) + 4
  }

  ctx.restore()
}

/**
 * Large glowing letter that floats up and fades (like damage numbers).
 * Called in world space (inside camera transform).
 */
function drawLetterFlashes(ctx: CanvasRenderingContext2D, flashes: LetterFlash[]): void {
  for (const f of flashes) {
    const t = f.age / S.LETTER_FLASH_LIFETIME   // 0→1
    const alpha = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8
    if (alpha <= 0) continue
    const yOffset = -f.age * 55    // floats upward
    const scale = 1 + t * 0.3      // slight grow

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(f.x, f.y + yOffset)
    ctx.scale(scale, scale)

    // Glow shadow
    ctx.shadowColor = f.color
    ctx.shadowBlur = 20

    ctx.font = `bold 72px monospace`
    ctx.fillStyle = f.color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(f.letter, 0, 0)

    ctx.restore()
  }
}

/**
 * Full-screen blocking overlay for the post-wave vocabulary quiz (Grade 3+).
 * Shows mini mutator card, English word + emoji + Hebrew hint, and A/B/C/D options.
 */
function drawQuestionChallenge(
  ctx: CanvasRenderingContext2D,
  question: Question,
  result: 'pending' | 'correct' | 'wrong-first' | 'wrong-final',
  feedbackTimer: number,
  chosenMutator: Mutator | null,
  w: number,
  h: number,
): void {
  // Dark blocking overlay
  ctx.fillStyle = 'rgba(5, 5, 15, 0.93)'
  ctx.fillRect(0, 0, w, h)

  const cx = w / 2
  let y = 60

  // ── Header ────────────────────────────────────────────────────────────────
  // Draw Hebrew and emoji in separate calls to avoid Canvas BiDi stray-glyph artefacts
  ctx.font = 'bold 22px monospace'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#ffdd44'
  ctx.shadowColor = '#ffdd44'
  ctx.shadowBlur = 12
  // Hebrew text only (pure RTL — no emoji mixed in)
  ctx.textAlign = 'center'
  ctx.fillText('ענה נכון — קבל את הכוח!', cx, y)
  ctx.shadowBlur = 0
  // Sparkle emojis drawn separately as LTR anchors
  ctx.font = 'bold 20px serif'
  ctx.textAlign = 'right'
  ctx.fillText('✨', cx - 150, y + 2)
  ctx.textAlign = 'left'
  ctx.fillText('✨', cx + 150, y + 2)
  y += 42

  // ── Mini mutator card (if any) ─────────────────────────────────────────────
  if (chosenMutator) {
    const cardW = 320
    const cardH = 60
    const cardX = cx - cardW / 2
    ctx.fillStyle = chosenMutator.color + '22'
    ctx.strokeStyle = chosenMutator.color + 'cc'
    ctx.lineWidth = 2
    roundRect(ctx, cardX, y, cardW, cardH, 8)
    ctx.fill()
    ctx.stroke()

    ctx.font = 'bold 15px monospace'
    ctx.fillStyle = chosenMutator.color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(chosenMutator.name, cx, y + 18)
    ctx.font = '11px monospace'
    ctx.fillStyle = '#ffffffaa'
    ctx.fillText(chosenMutator.description.slice(0, 50), cx, y + 38)
    y += cardH + 20
  } else {
    y += 20
  }

  // ── English word + emoji ──────────────────────────────────────────────────
  // Measure combined width so the emoji+word group is centered as a unit
  ctx.textBaseline = 'middle'
  const wordY = y + 28
  const wordText = `"${question.englishWord}"`
  const emojiGap = 10

  ctx.font = 'bold 36px monospace'
  const wordW = ctx.measureText(wordText).width
  ctx.font = 'bold 32px serif'
  const emojiW = ctx.measureText(question.emoji).width
  const groupW = emojiW + emojiGap + wordW
  const groupX = cx - groupW / 2

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.fillText(question.emoji, groupX, wordY)

  ctx.font = 'bold 36px monospace'
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = '#7b2fff'
  ctx.shadowBlur = 16
  ctx.textAlign = 'left'
  ctx.fillText(wordText, groupX + emojiW + emojiGap, wordY)
  ctx.shadowBlur = 0
  y += 70

  // ── Answer options (A/B/C/D) ───────────────────────────────────────────────
  const optionLabels = ['A', 'B', 'C', 'D']
  const optW = 180
  const optH = 48
  const gap = 14
  const totalW = optW * 2 + gap
  const optStartX = cx - totalW / 2

  ctx.font = '14px monospace'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < 4; i++) {
    const col = i % 2
    const row = Math.floor(i / 2)
    const ox = optStartX + col * (optW + gap)
    const oy = y + row * (optH + gap)
    const label = optionLabels[i]
    const text = question.options[i]

    let bg = 'rgba(30, 20, 60, 0.8)'
    let border = '#7b2fff88'
    let textColor = '#ffffffcc'

    if (result !== 'pending') {
      if (i === question.correctIndex) {
        bg = 'rgba(34, 180, 80, 0.25)'
        border = '#22b450cc'
        textColor = '#22ff88'
      } else if (result === 'wrong-first' || result === 'wrong-final') {
        bg = 'rgba(180, 34, 34, 0.1)'
        border = '#ff222222'
        textColor = '#ffffff44'
      }
    }

    ctx.fillStyle = bg
    ctx.strokeStyle = border
    ctx.lineWidth = 2
    roundRect(ctx, ox, oy, optW, optH, 8)
    ctx.fill()
    ctx.stroke()

    // Option label letter
    ctx.font = 'bold 16px monospace'
    ctx.fillStyle = border
    ctx.textAlign = 'left'
    ctx.fillText(`[${label}]`, ox + 10, oy + optH / 2)

    // Option text (Hebrew, RTL-ish drawn right-aligned)
    ctx.font = '17px sans-serif'
    ctx.fillStyle = textColor
    ctx.textAlign = 'right'
    ctx.fillText(text, ox + optW - 10, oy + optH / 2)
  }

  y += 2 * (optH + gap) + 24

  // ── Key hint ──────────────────────────────────────────────────────────────
  ctx.font = '14px monospace'
  ctx.fillStyle = '#ffffff44'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('לחץ על  A · B · C · D', cx, y)
  y += 30

  // ── Feedback states ────────────────────────────────────────────────────────
  if (result === 'correct') {
    ctx.font = 'bold 22px monospace'
    ctx.fillStyle = '#22ff88'
    ctx.shadowColor = '#22ff88'
    ctx.shadowBlur = 16
    ctx.textAlign = 'center'
    ctx.fillText('נכון! הכוח שלך! 🎉', cx, y)
    ctx.shadowBlur = 0
  } else if (result === 'wrong-first') {
    ctx.font = 'bold 18px monospace'
    ctx.fillStyle = '#ff6644'
    ctx.textAlign = 'center'
    ctx.fillText('טעות — נסה שוב, נשאר עוד ניסיון אחד', cx, y)
    y += 28
    // Timer bar
    const barW = 300
    const barFill = Math.max(0, feedbackTimer / S.QUESTION_FEEDBACK_DURATION)
    ctx.fillStyle = '#ffffff22'
    roundRect(ctx, cx - barW / 2, y, barW, 8, 4)
    ctx.fill()
    ctx.fillStyle = '#ff8844'
    if (barFill > 0) {
      roundRect(ctx, cx - barW / 2, y, barW * barFill, 8, 4)
      ctx.fill()
    }
  } else if (result === 'wrong-final') {
    ctx.font = 'bold 18px monospace'
    ctx.fillStyle = '#ff4444'
    ctx.textAlign = 'center'
    ctx.fillText('טעות — אין כוח הפעם, לגל הבא!', cx, y)
  }
}

/**
 * Full-screen pause overlay — dark backdrop + 3-option menu (Resume / Restart / Return to Title).
 * Navigated with W/S or ↑↓; confirmed with Enter or number keys 1/2/3.
 */
function drawPauseMenu(
  ctx: CanvasRenderingContext2D,
  selection: number,
  score: number,
  w: number,
  h: number,
): void {
  const cx = w / 2
  const cy = h / 2

  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.80)'
  ctx.fillRect(0, 0, w, h)

  // Title
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 48px monospace'
  ctx.fillStyle = '#c084fc'
  ctx.shadowColor = '#7b2fff'
  ctx.shadowBlur = 24
  ctx.fillText('⏸ PAUSED', cx, cy - 110)
  ctx.shadowBlur = 0

  // Score
  ctx.font = '16px monospace'
  ctx.fillStyle = '#ffffff88'
  ctx.fillText(`Score: ${score.toLocaleString()}`, cx, cy - 66)

  // Menu items
  const items = [
    { key: '1', label: 'RESUME', hint: 'ESC' },
    { key: '2', label: 'RESTART', hint: '' },
    { key: '3', label: 'RETURN TO TITLE', hint: '' },
  ]
  const itemH = 52
  const startY = cy - 18

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const iy = startY + i * itemH
    const isSelected = i === selection

    if (isSelected) {
      ctx.fillStyle = 'rgba(123, 47, 255, 0.30)'
      ctx.beginPath()
      ctx.roundRect(cx - 140, iy - 18, 280, 36, 8)
      ctx.fill()

      // Left accent bar
      ctx.fillStyle = '#c084fc'
      ctx.fillRect(cx - 140, iy - 18, 4, 36)
    }

    // Number key hint
    ctx.font = '13px monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = isSelected ? '#fbbf24' : '#664400'
    ctx.fillText(`[${item.key}]`, cx - 132, iy)

    // Label
    ctx.font = 'bold 20px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = isSelected ? '#ffffff' : '#666666'
    if (isSelected) { ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 8 }
    ctx.fillText(item.label, cx + 10, iy)
    ctx.shadowBlur = 0

    // Hint text (e.g. "or ESC" beside Resume)
    if (item.hint) {
      ctx.font = '12px monospace'
      ctx.textAlign = 'right'
      ctx.fillStyle = '#555555'
      ctx.fillText(`or ${item.hint}`, cx + 140, iy)
    }
  }

  // Bottom hint
  ctx.font = '12px monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#444444'
  ctx.fillText('W / S  or  ↑↓  navigate   •   ENTER confirm', cx, cy + 140)
}
