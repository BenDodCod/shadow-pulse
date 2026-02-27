'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { InputState } from '@/lib/game/player'
import { GameState } from '@/lib/game/engine'
import { GAME_WIDTH, GAME_HEIGHT } from '@/lib/game/settings'

interface Props {
  inputRef: React.MutableRefObject<InputState>
  gameStateRef: React.MutableRefObject<GameState | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onRestart: () => void
  isPortrait: boolean
}

// Mutator card hit rects (mirrors renderer.ts constants)
const CARD_WIDTH = 300
const CARD_HEIGHT = 320
const CARD_SPACING = 40
const CARD_START_X = (GAME_WIDTH - (3 * CARD_WIDTH + 2 * CARD_SPACING)) / 2 // 150
const CARD_BASE_Y = (GAME_HEIGHT - CARD_HEIGHT) / 2 + 20 // 220

// Portrait mode: canvas occupies top 56.25vw of screen (100vw × 720/1280)
const PORTRAIT_TOP = '56.25vw'

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

export default function MobileControls({ inputRef, gameStateRef, canvasRef, onRestart, isPortrait }: Props) {
  // Guide state
  const [showGuide, setShowGuide] = useState(() =>
    typeof window !== 'undefined' ? !localStorage.getItem('sp_mobile_guide_seen') : false
  )

  // Game phase — polled from gameStateRef each frame
  const [mutatorActive, setMutatorActive] = useState(false)
  const [waveEventPending, setWaveEventPending] = useState(false)
  const [gameOver, setGameOver] = useState(false)

  // Joystick — DOM-ref based for zero React re-renders during movement
  const joystickTouchIdRef = useRef<number | null>(null)
  const joystickOriginRef = useRef<{ x: number; y: number } | null>(null)
  const [joystickVisible, setJoystickVisible] = useState(false)
  const joystickRingRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)

  // Button active visual
  const [activeButtons, setActiveButtons] = useState<Set<string>>(new Set())

  // Heavy attack toggle
  const heavyChargingRef = useRef(false)
  const [heavyCharging, setHeavyCharging] = useState(false)
  const prevGameOverRef = useRef(false)

  // Fullscreen (with webkit prefix for Safari/Android Chrome)
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const onFSChange = () =>
      setIsFullscreen(!!(document.fullscreenElement || (document as unknown as Record<string,unknown>).webkitFullscreenElement))
    document.addEventListener('fullscreenchange', onFSChange)
    document.addEventListener('webkitfullscreenchange', onFSChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange)
      document.removeEventListener('webkitfullscreenchange', onFSChange)
    }
  }, [])
  const toggleFullscreen = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    try {
      const doc = document as unknown as Record<string, unknown>
      const el = document.documentElement as unknown as Record<string, unknown>
      if (document.fullscreenElement || doc.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen()
        else if (typeof doc.webkitExitFullscreen === 'function') (doc.webkitExitFullscreen as () => void)()
      } else {
        if (typeof el.requestFullscreen === 'function') {
          (el.requestFullscreen as () => Promise<void>)().catch(() => {})
        } else if (typeof el.webkitRequestFullscreen === 'function') {
          (el.webkitRequestFullscreen as () => void)()
        }
      }
    } catch { /* unsupported browser */ }
  }, [])

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

  // ── Joystick (DOM-ref approach — no re-renders during move) ──────────────
  const handleJoystickStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (joystickTouchIdRef.current !== null) return
    const t = e.changedTouches[0]
    joystickTouchIdRef.current = t.identifier
    joystickOriginRef.current = { x: t.clientX, y: t.clientY }
    if (joystickRingRef.current) {
      joystickRingRef.current.style.left = t.clientX + 'px'
      joystickRingRef.current.style.top  = t.clientY + 'px'
    }
    if (thumbRef.current) {
      thumbRef.current.style.transform = 'translate(0px,0px)'
    }
    setJoystickVisible(true)
  }, [])

  const handleJoystickMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (joystickTouchIdRef.current === null) return
    let touch: React.Touch | null = null
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === joystickTouchIdRef.current) { touch = e.touches[i]; break }
    }
    if (!touch) return
    const origin = joystickOriginRef.current
    if (!origin) return
    const dx = touch.clientX - origin.x
    const dy = touch.clientY - origin.y
    const maxR = 50
    const cx = Math.max(-maxR, Math.min(maxR, dx))
    const cy = Math.max(-maxR, Math.min(maxR, dy))
    // Direct DOM update — no React setState, no re-render
    if (thumbRef.current) {
      thumbRef.current.style.transform = `translate(${cx * 0.54}px,${cy * 0.54}px)`
    }
    // Hysteresis: activate at 18px, release only when below 7px — prevents direction flickering
    const THR = 18
    const REL = 7
    const input = inputRef.current
    input.right = dx >  THR || (input.right && dx >  REL)
    input.left  = dx < -THR || (input.left  && dx < -REL)
    input.down  = dy >  THR || (input.down  && dy >  REL)
    input.up    = dy < -THR || (input.up    && dy < -REL)
  }, [inputRef])

  const handleJoystickEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    let found = false
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchIdRef.current) { found = true; break }
    }
    if (!found) return
    joystickTouchIdRef.current = null
    joystickOriginRef.current = null
    setJoystickVisible(false)
    if (thumbRef.current) thumbRef.current.style.transform = 'translate(0px,0px)'
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
    e.stopPropagation()
    onRestart()
    heavyChargingRef.current = false
    setHeavyCharging(false)
  }, [onRestart])

  // ── Styles ─────────────────────────────────────────────────────────────────
  const BTN = isPortrait ? 'clamp(56px, 16vmin, 88px)' : 'clamp(52px, 13vmin, 72px)'
  const SMALL = isPortrait ? '52px' : '44px'

  const btnBase = (action: string, accent = '255,255,255', extra?: React.CSSProperties): React.CSSProperties => ({
    width: BTN, height: BTN, borderRadius: '50%',
    background: activeButtons.has(action) ? `rgba(${accent},0.38)` : `rgba(${accent},0.05)`,
    border: `2px solid rgba(${accent},0.22)`,
    color: `rgba(${accent},0.9)`,
    ...mono, fontSize: '10px', fontWeight: 'bold',
    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' as const, touchAction: 'none' as const,
    flexShrink: 0, transition: 'background 0.08s',
    ...extra,
  })

  const smallBtn = (action: string, accent = '255,255,255'): React.CSSProperties => ({
    width: SMALL, height: SMALL, borderRadius: '50%',
    background: activeButtons.has(action) ? `rgba(${accent},0.35)` : `rgba(${accent},0.03)`,
    border: `1px solid rgba(${accent},0.18)`,
    color: `rgba(${accent},0.7)`,
    ...mono, fontSize: '8px', fontWeight: 'bold', lineHeight: 1.2,
    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' as const, touchAction: 'none' as const,
    flexShrink: 0,
  })

  // ── Portrait vs landscape positioning ─────────────────────────────────────
  const joystickZoneStyle: React.CSSProperties = isPortrait
    ? { position: 'fixed', left: 0, top: PORTRAIT_TOP, bottom: 0, width: '50vw', zIndex: 20, touchAction: 'none' }
    : { position: 'fixed', left: 0, top: 0, width: '45vw', height: '100dvh', zIndex: 20, touchAction: 'none' }

  const buttonPadStyle: React.CSSProperties = isPortrait
    ? { position: 'fixed', right: 12, bottom: 0, top: PORTRAIT_TOP, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 12, zIndex: 20, touchAction: 'none', paddingBottom: 16 }
    : { position: 'fixed', right: 16, bottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, zIndex: 20, touchAction: 'none' }

  const helpBtnStyle: React.CSSProperties = isPortrait
    ? { position: 'fixed', top: `calc(${PORTRAIT_TOP} + 8px)`, right: 12, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.45)', ...mono, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'none', zIndex: 40 }
    : { position: 'fixed', top: 12, right: 12, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.45)', ...mono, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'none', zIndex: 40 }

  const fsBtnStyle: React.CSSProperties = isPortrait
    ? { position: 'fixed', top: `calc(${PORTRAIT_TOP} + 8px)`, right: 60, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.45)', ...mono, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'none', zIndex: 40 }
    : { position: 'fixed', top: 12, right: 60, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.45)', ...mono, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'none', zIndex: 40 }

  const ynContainerStyle: React.CSSProperties = isPortrait
    ? { position: 'fixed', bottom: 24, left: '25vw', transform: 'translateX(-50%)', display: 'flex', gap: 16, zIndex: 30 }
    : { position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 16, zIndex: 30 }

  const restartBtnStyle: React.CSSProperties = isPortrait
    ? { position: 'fixed', bottom: '35%', left: 12, width: 'calc(50vw - 24px)', height: 52, borderRadius: 8, background: 'rgba(255,80,80,0.82)', border: '2px solid rgba(255,120,120,0.9)', color: '#fff', ...mono, fontSize: 16, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.2em', zIndex: 35, boxShadow: '0 0 20px rgba(255,80,80,0.4)', cursor: 'pointer', touchAction: 'none' }
    : { position: 'fixed', bottom: '16vh', left: '50%', transform: 'translateX(-50%)', width: 220, height: 60, borderRadius: 8, background: 'rgba(255,80,80,0.82)', border: '2px solid rgba(255,120,120,0.9)', color: '#fff', ...mono, fontSize: 18, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.2em', zIndex: 35, boxShadow: '0 0 24px rgba(255,80,80,0.45)', cursor: 'pointer', touchAction: 'none' }

  return (
    <>
      {/* Mutator card tap overlay — zIndex 25 so it's above the joystick zone (20) */}
      {mutatorActive && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 25, touchAction: 'none' }}
          onTouchStart={handleCanvasTap}
        />
      )}

      {/* ── Joystick zone ────────────────────────────────────────────────── */}
      <div
        style={joystickZoneStyle}
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
      >
        {/* Ring + thumb — always rendered, shown/hidden via display */}
        <div
          ref={joystickRingRef}
          style={{
            position: 'absolute',
            display: joystickVisible ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'translate(-50%, -50%)',
            width: 90, height: 90, borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
            border: '2px solid rgba(255,255,255,0.2)',
            pointerEvents: 'none',
          }}
        >
          <div
            ref={thumbRef}
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(255,255,255,0.55)',
              boxShadow: '0 0 8px rgba(255,255,255,0.3)',
              position: 'absolute',
              transform: 'translate(0px,0px)',
            }}
          />
        </div>

        {/* Hint text when joystick not active */}
        {!joystickVisible && (
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            color: 'rgba(255,255,255,0.1)', ...mono, fontSize: 11,
            pointerEvents: 'none', textAlign: 'center',
          }}>
            ✦ MOVE
          </div>
        )}
      </div>

      {/* ── Y/N contextual buttons ─────────────────────────────────────────── */}
      {waveEventPending && (
        <div style={ynContainerStyle}>
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
        <div style={restartBtnStyle} onTouchStart={handleRestart}>
          RESTART
        </div>
      )}

      {/* ── Right-side control pad ─────────────────────────────────────────── */}
      <div style={buttonPadStyle}>
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
          <div style={btnBase('light', '200,136,255')} {...makeHandlers('light')}>LIGHT</div>
          <div
            style={btnBase('heavy', '255,170,34', {
              background: heavyCharging
                ? 'rgba(255,170,34,0.5)'
                : activeButtons.has('heavy') ? 'rgba(255,170,34,0.35)' : 'rgba(255,170,34,0.07)',
            })}
            {...makeHandlers('heavy')}
          >
            <span style={{ fontSize: 9, lineHeight: 1.3, textAlign: 'center' }}>
              {heavyCharging ? '⚡\nREL' : 'HEAVY'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Fullscreen button ─────────────────────────────────────────────── */}
      <div style={fsBtnStyle} onTouchStart={toggleFullscreen}>
        {isFullscreen ? '⊡' : '⛶'}
      </div>

      {/* ── ? Help button ──────────────────────────────────────────────────── */}
      <div
        style={helpBtnStyle}
        onTouchStart={(e) => { e.preventDefault(); setShowGuide(true) }}
      >?</div>

      {/* ── Controls Guide Overlay ─────────────────────────────────────────── */}
      {showGuide && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,8,20,0.97)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24, touchAction: 'none' }}>
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
                { label: 'LIGHT',     desc: 'Light Attack',                       color: '#cc88ff' },
                { label: 'HEAVY',     desc: 'Tap → charge  ·  Tap again → fire',  color: '#ffaa22' },
                { label: 'PULSE',     desc: 'AoE Energy Burst',                   color: '#aa44ff' },
                { label: 'DASH',      desc: 'Quick Dodge',                        color: '#00ccff' },
                { label: 'TIME FLIK', desc: 'Slow all enemies',                   color: '#00ccff' },
                { label: 'ITEM',      desc: 'Use Consumable',                     color: '#aaffaa' },
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
