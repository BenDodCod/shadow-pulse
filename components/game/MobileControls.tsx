'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { InputState } from '@/lib/game/player'
import { GameState } from '@/lib/game/engine'
import { GAME_WIDTH, GAME_HEIGHT } from '@/lib/game/settings'

interface Props {
  inputRef: React.MutableRefObject<InputState>
  gameStateRef: React.MutableRefObject<GameState | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  restartRef: React.MutableRefObject<boolean>
}

// Mutator card hit rects (mirrors renderer.ts constants)
const CARD_WIDTH = 300
const CARD_HEIGHT = 320
const CARD_SPACING = 40
const CARD_START_X = (GAME_WIDTH - (3 * CARD_WIDTH + 2 * CARD_SPACING)) / 2 // 150
const CARD_BASE_Y = (GAME_HEIGHT - CARD_HEIGHT) / 2 + 20 // 220

function getCardIndex(cx: number, cy: number): number {
  for (let i = 0; i < 3; i++) {
    const x = CARD_START_X + i * (CARD_WIDTH + CARD_SPACING)
    if (cx >= x && cx <= x + CARD_WIDTH && cy >= CARD_BASE_Y && cy <= CARD_BASE_Y + CARD_HEIGHT) {
      return i + 1
    }
  }
  return 0
}

const mono: React.CSSProperties = { fontFamily: 'monospace' }

export default function MobileControls({ inputRef, gameStateRef, canvasRef, restartRef }: Props) {
  // Guide state
  const [showGuide, setShowGuide] = useState(() =>
    typeof window !== 'undefined' ? !localStorage.getItem('sp_mobile_guide_seen') : false
  )

  // Game phase — polled from gameStateRef each frame
  const [mutatorActive, setMutatorActive] = useState(false)
  const [waveEventPending, setWaveEventPending] = useState(false)
  const [gameOver, setGameOver] = useState(false)

  // Joystick visual state
  const joystickTouchIdRef = useRef<number | null>(null)
  const [joystickOrigin, setJoystickOrigin] = useState<{ x: number; y: number } | null>(null)
  const [thumbOffset, setThumbOffset] = useState({ x: 0, y: 0 })

  // Button active visual
  const [activeButtons, setActiveButtons] = useState<Set<string>>(new Set())

  // Heavy attack toggle
  const heavyChargingRef = useRef(false)
  const [heavyCharging, setHeavyCharging] = useState(false)
  const prevGameOverRef = useRef(false)

  // Poll game state at ~60fps for conditional UI
  useEffect(() => {
    let raf: number
    const tick = () => {
      const gs = gameStateRef.current
      if (gs) {
        setMutatorActive(!!gs.mutatorSelectionActive)
        setWaveEventPending(!!gs.pendingWaveEvent && !gs.mutatorSelectionActive)
        const isGO = !!gs.gameOver
        setGameOver(isGO)
        if (isGO && !prevGameOverRef.current) {
          heavyChargingRef.current = false
          setHeavyCharging(false)
        }
        prevGameOverRef.current = isGO
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [gameStateRef])

  const dismissGuide = useCallback(() => {
    localStorage.setItem('sp_mobile_guide_seen', '1')
    setShowGuide(false)
  }, [])

  const setButtonActive = (action: string, on: boolean) => {
    setActiveButtons(prev => {
      const next = new Set(prev)
      on ? next.add(action) : next.delete(action)
      return next
    })
  }

  const handleButtonPress = useCallback((action: string) => {
    setButtonActive(action, true)
    const input = inputRef.current
    switch (action) {
      case 'light':      input.lightAttack = true; break
      case 'heavy':
        if (!heavyChargingRef.current) {
          input.heavyAttack = true
          heavyChargingRef.current = true
          setHeavyCharging(true)
        } else {
          input.heavyRelease = true
          heavyChargingRef.current = false
          setHeavyCharging(false)
        }
        break
      case 'pulse':      input.pulseWave = true; break
      case 'dash':       input.dash = true; break
      case 'flicker':    input.timeFlicker = true; break
      case 'consumable': input.consumableActivate = true; break
      case 'accept':     input.acceptWaveEvent = true; break
      case 'reject':     input.rejectWaveEvent = true; break
    }
  }, [inputRef])

  const handleButtonRelease = useCallback((action: string) => {
    setButtonActive(action, false)
  }, [])

  const makeHandlers = (action: string) => ({
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); e.stopPropagation(); handleButtonPress(action) },
    onTouchEnd:   (e: React.TouchEvent) => { e.preventDefault(); e.stopPropagation(); handleButtonRelease(action) },
    onTouchCancel:(e: React.TouchEvent) => { e.preventDefault(); e.stopPropagation(); handleButtonRelease(action) },
  })

  // ── Joystick ──────────────────────────────────────────────────────────────
  const handleJoystickStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (joystickTouchIdRef.current !== null) return
    const t = e.changedTouches[0]
    joystickTouchIdRef.current = t.identifier
    setJoystickOrigin({ x: t.clientX, y: t.clientY })
    setThumbOffset({ x: 0, y: 0 })
  }, [])

  const handleJoystickMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (joystickTouchIdRef.current === null) return
    let touch: React.Touch | null = null
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === joystickTouchIdRef.current) { touch = e.touches[i]; break }
    }
    if (!touch) return
    // Read origin from state via ref trick — use a stable ref updated each render
    setJoystickOrigin(origin => {
      if (!origin) return origin
      const dx = touch!.clientX - origin.x
      const dy = touch!.clientY - origin.y
      const maxR = 50
      setThumbOffset({ x: Math.max(-maxR, Math.min(maxR, dx)), y: Math.max(-maxR, Math.min(maxR, dy)) })
      const thr = 15
      const input = inputRef.current
      input.right = dx > thr; input.left = dx < -thr
      input.down = dy > thr;  input.up   = dy < -thr
      return origin
    })
  }, [inputRef])

  const handleJoystickEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    let found = false
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchIdRef.current) { found = true; break }
    }
    if (!found) return
    joystickTouchIdRef.current = null
    setJoystickOrigin(null)
    setThumbOffset({ x: 0, y: 0 })
    const input = inputRef.current
    input.up = false; input.down = false; input.left = false; input.right = false
  }, [inputRef])

  // ── Mutator card tap ───────────────────────────────────────────────────────
  const handleCanvasTap = useCallback((e: React.TouchEvent) => {
    const gs = gameStateRef.current
    if (!gs?.mutatorSelectionActive) return
    const canvas = canvasRef.current
    if (!canvas) return
    const t = e.changedTouches[0]
    const rect = canvas.getBoundingClientRect()
    const cx = (t.clientX - rect.left) * (GAME_WIDTH  / rect.width)
    const cy = (t.clientY - rect.top)  * (GAME_HEIGHT / rect.height)
    const idx = getCardIndex(cx, cy)
    if (idx > 0) gs.mutatorSelectionInput = idx
  }, [gameStateRef, canvasRef])

  // ── Restart ────────────────────────────────────────────────────────────────
  const handleRestart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    restartRef.current = true
    heavyChargingRef.current = false
    setHeavyCharging(false)
  }, [restartRef])

  // ── Styles ─────────────────────────────────────────────────────────────────
  const BTN = 'clamp(52px, 13vmin, 72px)'
  const SMALL = '44px'

  const btnBase = (action: string, accent = '255,255,255', extra?: React.CSSProperties): React.CSSProperties => ({
    width: BTN, height: BTN, borderRadius: '50%',
    background: activeButtons.has(action) ? `rgba(${accent},0.4)` : `rgba(${accent},0.08)`,
    border: `2px solid rgba(${accent},0.35)`,
    color: `rgba(${accent},0.95)`,
    ...mono, fontSize: '10px', fontWeight: 'bold',
    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' as const, touchAction: 'none' as const,
    flexShrink: 0, transition: 'background 0.08s',
    ...extra,
  })

  const smallBtn = (action: string, accent = '255,255,255'): React.CSSProperties => ({
    width: SMALL, height: SMALL, borderRadius: '50%',
    background: activeButtons.has(action) ? `rgba(${accent},0.35)` : `rgba(${accent},0.06)`,
    border: `1px solid rgba(${accent},0.22)`,
    color: `rgba(${accent},0.75)`,
    ...mono, fontSize: '8px', fontWeight: 'bold', lineHeight: 1.2,
    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' as const, touchAction: 'none' as const,
    flexShrink: 0,
  })

  return (
    <>
      {/* Mutator card tap overlay — transparent, full screen, only when draft active */}
      {mutatorActive && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10, touchAction: 'none' }}
          onTouchStart={handleCanvasTap}
        />
      )}

      {/* ── Joystick zone (left 45%) ───────────────────────────────────────── */}
      <div
        style={{ position: 'fixed', left: 0, top: 0, width: '45vw', height: '100dvh', zIndex: 20, touchAction: 'none' }}
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
      >
        {joystickOrigin ? (
          <div style={{ position: 'absolute', left: joystickOrigin.x, top: joystickOrigin.y, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
            {/* Ring */}
            <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Thumb */}
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'rgba(255,255,255,0.55)',
                boxShadow: '0 0 8px rgba(255,255,255,0.3)',
                position: 'absolute',
                transform: `translate(${thumbOffset.x * 0.54}px, ${thumbOffset.y * 0.54}px)`,
              }} />
            </div>
          </div>
        ) : (
          <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.12)', ...mono, fontSize: 11, pointerEvents: 'none', textAlign: 'center' }}>
            ✦ MOVE
          </div>
        )}
      </div>

      {/* ── Y/N contextual buttons ─────────────────────────────────────────── */}
      {waveEventPending && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 16, zIndex: 30 }}>
          <div
            style={{ padding: '12px 36px', borderRadius: 24, background: 'rgba(80,200,80,0.2)', border: '2px solid rgba(80,200,80,0.65)', color: '#66ff88', ...mono, fontSize: 20, fontWeight: 'bold', cursor: 'pointer', touchAction: 'none', letterSpacing: '0.1em' }}
            {...makeHandlers('accept')}
          >Y</div>
          <div
            style={{ padding: '12px 36px', borderRadius: 24, background: 'rgba(200,80,80,0.2)', border: '2px solid rgba(200,80,80,0.65)', color: '#ff7766', ...mono, fontSize: 20, fontWeight: 'bold', cursor: 'pointer', touchAction: 'none', letterSpacing: '0.1em' }}
            {...makeHandlers('reject')}
          >N</div>
        </div>
      )}

      {/* ── Game Over Restart button ───────────────────────────────────────── */}
      {gameOver && (
        <div
          style={{ position: 'fixed', bottom: '16vh', left: '50%', transform: 'translateX(-50%)', width: 220, height: 60, borderRadius: 8, background: 'rgba(255,80,80,0.82)', border: '2px solid rgba(255,120,120,0.9)', color: '#fff', ...mono, fontSize: 18, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.2em', zIndex: 30, boxShadow: '0 0 24px rgba(255,80,80,0.45)', cursor: 'pointer', touchAction: 'none' }}
          onTouchStart={handleRestart}
        >
          RESTART
        </div>
      )}

      {/* ── Right-side control pad ─────────────────────────────────────────── */}
      <div style={{ position: 'fixed', right: 16, bottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, zIndex: 20, touchAction: 'none' }}>

        {/* Rare row — Time Flicker + Consumable */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={smallBtn('flicker', '0,200,255')} {...makeHandlers('flicker')}>
            TIME<br/>FLIK
          </div>
          <div style={smallBtn('consumable', '170,255,170')} {...makeHandlers('consumable')}>
            ITEM
          </div>
        </div>

        {/* Main 2×2 grid: Pulse / Dash / Light / Heavy */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={btnBase('pulse', '170,68,255')} {...makeHandlers('pulse')}>PULSE</div>
          <div style={btnBase('dash',  '0,200,255')}  {...makeHandlers('dash')}>DASH</div>
          <div style={btnBase('light', '200,136,255', { width: 'clamp(56px,14vmin,80px)', height: 'clamp(56px,14vmin,80px)' })} {...makeHandlers('light')}>LIGHT</div>
          <div
            style={btnBase('heavy', '255,170,34', {
              background: heavyCharging
                ? 'rgba(255,170,34,0.55)'
                : activeButtons.has('heavy') ? 'rgba(255,170,34,0.35)' : 'rgba(255,170,34,0.1)',
            })}
            {...makeHandlers('heavy')}
          >
            <span style={{ fontSize: 9, lineHeight: 1.3, textAlign: 'center' }}>
              {heavyCharging ? '⚡\nREL' : 'HEAVY'}
            </span>
          </div>
        </div>
      </div>

      {/* ── ? Help button ──────────────────────────────────────────────────── */}
      <div
        style={{ position: 'fixed', top: 12, right: 12, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', ...mono, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'none', zIndex: 40 }}
        onTouchStart={(e) => { e.preventDefault(); setShowGuide(true) }}
      >?</div>

      {/* ── Controls Guide Overlay ─────────────────────────────────────────── */}
      {showGuide && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,8,20,0.96)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24, touchAction: 'none' }}>
          <p style={{ ...mono, color: '#7b2fff', fontSize: 16, letterSpacing: '0.2em', fontWeight: 'bold', margin: 0, textShadow: '0 0 20px #7b2fff88' }}>CONTROLS</p>

          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* Joystick diagram */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                {(['↑','↓','←','→'] as const).map((a, i) => (
                  <span key={i} style={{ position: 'absolute', color: 'rgba(255,255,255,0.4)', fontSize: 13, ...([{ top: 2, left: '50%', transform: 'translateX(-50%)' }, { bottom: 2, left: '50%', transform: 'translateX(-50%)' }, { left: 2, top: '50%', transform: 'translateY(-50%)' }, { right: 2, top: '50%', transform: 'translateY(-50%)' }][i] as React.CSSProperties) }}>{a}</span>
                ))}
              </div>
              <span style={{ ...mono, color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>MOVE</span>
            </div>

            {/* Button legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {([
                { label: 'LIGHT',     desc: 'Light Attack',                   color: '#cc88ff' },
                { label: 'HEAVY',     desc: 'Tap → charge  ·  Tap again → fire', color: '#ffaa22' },
                { label: 'PULSE',     desc: 'AoE Energy Burst',               color: '#aa44ff' },
                { label: 'DASH',      desc: 'Quick Dodge',                    color: '#00ccff' },
                { label: 'TIME FLIK', desc: 'Slow all enemies',               color: '#00ccff' },
                { label: 'ITEM',      desc: 'Use Consumable',                 color: '#aaffaa' },
              ] as const).map(({ label, desc, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...mono, fontSize: 9, color, background: color + '22', border: `1px solid ${color}55`, borderRadius: 4, padding: '2px 6px', minWidth: 60, textAlign: 'center' }}>{label}</span>
                  <span style={{ ...mono, color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>{desc}</span>
                </div>
              ))}
              <div style={{ ...mono, color: 'rgba(255,200,0,0.7)', fontSize: 10, marginTop: 4 }}>✦ Tap upgrade cards to select</div>
              <div style={{ ...mono, color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>✦ Y / N  for wave events</div>
            </div>
          </div>

          <div
            style={{ padding: '10px 36px', borderRadius: 6, background: 'rgba(123,47,255,0.3)', border: '1px solid rgba(123,47,255,0.65)', color: 'rgba(255,255,255,0.9)', ...mono, fontSize: 13, letterSpacing: '0.12em', cursor: 'pointer', touchAction: 'none' }}
            onTouchStart={(e) => { e.preventDefault(); dismissGuide() }}
            onClick={dismissGuide}
          >
            GOT IT!
          </div>
        </div>
      )}
    </>
  )
}
