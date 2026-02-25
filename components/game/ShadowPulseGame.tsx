'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { GameState, createGameState, updateGame, renderGame, resetGame } from '@/lib/game/engine'
import { InputState } from '@/lib/game/player'
import { GAME_WIDTH, GAME_HEIGHT } from '@/lib/game/settings'
import { DailyEntry } from '@/lib/game/renderer'
import {
  submitDailyChallengeScore,
  getDailyLeaderboard,
  getAllTimeLeaderboard,
  getOrCreatePlayerId,
  AllTimeEntry,
} from '@/lib/supabase/daily-challenge'

export default function ShadowPulseGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameStateRef = useRef<GameState | null>(null)
  const inputRef = useRef<InputState>({
    up: false,
    down: false,
    left: false,
    right: false,
    dash: false,
    lightAttack: false,
    heavyAttack: false,
    heavyRelease: false,
    pulseWave: false,
    timeFlicker: false,
  })
  const keysRef = useRef<Set<string>>(new Set())
  const animFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const [started, setStarted] = useState(false)
  const [dailyLeaderboard, setDailyLeaderboard] = useState<DailyEntry[]>([])
  const scoreSubmittedRef = useRef(false)

  const startGame = useCallback((isDailyChallenge = false) => {
    gameStateRef.current = createGameState(isDailyChallenge)
    scoreSubmittedRef.current = false
    setDailyLeaderboard([])
    setStarted(true)
  }, [])

  // Input handling
  useEffect(() => {
    if (!started) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      const key = e.key.toLowerCase()
      const wasPressed = keysRef.current.has(key)
      keysRef.current.add(key)

      const input = inputRef.current

      // Movement
      input.up = keysRef.current.has('w') || keysRef.current.has('arrowup')
      input.down = keysRef.current.has('s') || keysRef.current.has('arrowdown')
      input.left = keysRef.current.has('a') || keysRef.current.has('arrowleft')
      input.right = keysRef.current.has('d') || keysRef.current.has('arrowright')

      // Dash (on press, not hold)
      if ((key === ' ' || key === 'shift') && !wasPressed) {
        input.dash = true
      }

      // Light attack (on press)
      if (key === 'j' && !wasPressed) {
        input.lightAttack = true
      }

      // Heavy attack (hold)
      if (key === 'k' && !wasPressed) {
        input.heavyAttack = true
      }

      // Pulse wave (on press)
      if (key === 'l' && !wasPressed) {
        input.pulseWave = true
      }

      // Time flicker (on press)
      if (key === ';' && !wasPressed) {
        input.timeFlicker = true
      }

      // Mutator selection (1, 2, 3 keys)
      const state = gameStateRef.current
      if (state?.mutatorSelectionActive && !wasPressed) {
        if (key === '1') {
          state.mutatorSelectionInput = 1
        } else if (key === '2') {
          state.mutatorSelectionInput = 2
        } else if (key === '3') {
          state.mutatorSelectionInput = 3
        }
      }

      // Restart
      if (key === 'r' && gameStateRef.current?.gameOver) {
        const wasDaily = gameStateRef.current.isDailyChallenge
        gameStateRef.current = resetGame(gameStateRef.current)
        scoreSubmittedRef.current = false
        if (wasDaily) setDailyLeaderboard([])
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysRef.current.delete(key)

      const input = inputRef.current

      input.up = keysRef.current.has('w') || keysRef.current.has('arrowup')
      input.down = keysRef.current.has('s') || keysRef.current.has('arrowdown')
      input.left = keysRef.current.has('a') || keysRef.current.has('arrowleft')
      input.right = keysRef.current.has('d') || keysRef.current.has('arrowright')

      if (key === 'k') {
        input.heavyAttack = false
        input.heavyRelease = true
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [started])

  // Game loop
  useEffect(() => {
    if (!started) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    lastTimeRef.current = performance.now()

    const gameLoop = (time: number) => {
      const state = gameStateRef.current
      if (!state) return

      let dt = (time - lastTimeRef.current) / 1000
      lastTimeRef.current = time

      // Clamp dt
      dt = Math.min(dt, 1 / 30)

      // Process input
      const input = { ...inputRef.current }

      // Update
      updateGame(state, input, dt)

      // Clear one-shot inputs
      inputRef.current.dash = false
      inputRef.current.lightAttack = false
      inputRef.current.heavyRelease = false
      inputRef.current.pulseWave = false
      inputRef.current.timeFlicker = false

      // Submit daily score on game over (once)
      if (state.gameOver && state.isDailyChallenge && !scoreSubmittedRef.current) {
        scoreSubmittedRef.current = true
        const playerId = getOrCreatePlayerId()
        const playerName = localStorage.getItem('shadowpulse_player_name') || 'Anonymous'
        submitDailyChallengeScore({
          date: state.challengeDate,
          playerId,
          playerName,
          score: state.score,
          waveReached: state.wave,
          seed: state.challengeDate,
        }).then(() => {
          getDailyLeaderboard(state.challengeDate, playerId).then(setDailyLeaderboard)
        })
      }

      // Render
      renderGame(state, ctx, dailyLeaderboard)

      animFrameRef.current = requestAnimationFrame(gameLoop)
    }

    animFrameRef.current = requestAnimationFrame(gameLoop)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [started, dailyLeaderboard])

  if (!started) {
    return (
      <TitleScreen
        onStart={() => startGame(false)}
        onStartDaily={() => startGame(true)}
      />
    )
  }

  return (
    <div className="flex items-center justify-center w-full h-screen" style={{ backgroundColor: '#0a0a12' }}>
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="block max-w-full max-h-full"
        style={{
          imageRendering: 'pixelated',
          border: '1px solid #1a1a2e',
        }}
        tabIndex={0}
      />
    </div>
  )
}

function TitleScreen({ onStart, onStartDaily }: { onStart: () => void; onStartDaily: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [playerName, setPlayerName] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('shadowpulse_player_name') || ''
    return ''
  })
  const [allTimeBoard, setAllTimeBoard] = useState<AllTimeEntry[]>([])

  useEffect(() => {
    const playerId = getOrCreatePlayerId()
    getAllTimeLeaderboard(playerId, 8).then(setAllTimeBoard)
  }, [])

  const handleDailyClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowNamePrompt(true)
  }

  const handleNameSubmit = () => {
    const name = playerName.trim() || 'Anonymous'
    localStorage.setItem('shadowpulse_player_name', name)
    setShowNamePrompt(false)
    onStartDaily()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const drawTitle = (time: number) => {
      const w = canvas.width
      const h = canvas.height

      // Background
      ctx.fillStyle = '#0a0a12'
      ctx.fillRect(0, 0, w, h)

      // Ambient particles
      for (let i = 0; i < 40; i++) {
        const x = ((Math.sin(time * 0.0003 + i * 2.1) + 1) / 2) * w
        const y = ((Math.cos(time * 0.0002 + i * 1.7) + 1) / 2) * h
        const alpha = Math.sin(time * 0.001 + i) * 0.2 + 0.2
        const size = i % 5 === 0 ? 3 : 1.5
        ctx.fillStyle = `rgba(123, 47, 255, ${alpha})`
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fill()
      }

      // Pulsing rings (layered for depth)
      for (let ring = 0; ring < 3; ring++) {
        const phase = ring * 0.8
        const pulseSize = (Math.sin(time * 0.002 + phase) + 1) * 25 + 60 + ring * 40
        const alpha = (0.15 - ring * 0.04) + Math.sin(time * 0.003 + phase) * 0.06
        ctx.strokeStyle = `rgba(123, 47, 255, ${Math.max(0, alpha)})`
        ctx.lineWidth = 1.5 - ring * 0.4
        ctx.beginPath()
        ctx.arc(w / 2, h / 2, pulseSize, 0, Math.PI * 2)
        ctx.stroke()
      }

      animRef.current = requestAnimationFrame(drawTitle)
    }

    animRef.current = requestAnimationFrame(drawTitle)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const mono = { fontFamily: 'monospace' } as const

  const abilities = [
    { key: 'J', name: 'Light Attack', desc: 'Fast arc strike', color: '#cc88ff' },
    { key: 'K', name: 'Heavy Attack', desc: 'Hold to charge · high knockback', color: '#ffaa22' },
    { key: 'L', name: 'Pulse Wave', desc: 'AoE energy burst', color: '#aa44ff' },
    { key: ';', name: 'Time Flicker', desc: 'Slows all enemies', color: '#00ccff' },
  ]

  const movement = [
    { key: 'WASD', desc: 'Move' },
    { key: 'SPACE', desc: 'Dash' },
  ]

  return (
    <div
      className="relative flex items-center justify-center w-full h-screen overflow-hidden"
      style={{ backgroundColor: '#0a0a12' }}
    >
      {/* Animated background canvas */}
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="absolute block max-w-full max-h-full pointer-events-none"
      />

      {/* HTML overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 select-none px-8">

        {/* Title */}
        <div className="text-center pointer-events-none">
          <h1 style={{ ...mono, color: '#7b2fff', fontSize: '62px', fontWeight: 'bold', textShadow: '0 0 40px #7b2fff, 0 0 80px #7b2fff44', margin: 0, lineHeight: 1.1, letterSpacing: '0.06em' }}>
            SHADOW PULSE
          </h1>
          <p style={{ ...mono, color: '#ffffff55', fontSize: '13px', letterSpacing: '0.35em', marginTop: '6px' }}>
            THE PULSE AWAKENS
          </p>
        </div>

        {/* Controls grid */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }} className="pointer-events-none">

          {/* Movement card */}
          <div style={{ background: '#0d0d1a', border: '1px solid #7b2fff33', borderRadius: '8px', padding: '14px 20px', minWidth: '160px' }}>
            <p style={{ ...mono, color: '#ffffff44', fontSize: '10px', letterSpacing: '0.25em', marginBottom: '10px', textTransform: 'uppercase' }}>Movement</p>
            {movement.map(({ key, desc }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ ...mono, background: '#ffffff11', border: '1px solid #ffffff33', borderRadius: '4px', padding: '2px 7px', fontSize: '12px', color: '#ffffffcc', minWidth: '48px', textAlign: 'center' }}>
                  {key}
                </span>
                <span style={{ ...mono, color: '#ffffffaa', fontSize: '13px' }}>{desc}</span>
              </div>
            ))}
          </div>

          {/* Abilities card */}
          <div style={{ background: '#0d0d1a', border: '1px solid #7b2fff33', borderRadius: '8px', padding: '14px 20px', minWidth: '280px' }}>
            <p style={{ ...mono, color: '#ffffff44', fontSize: '10px', letterSpacing: '0.25em', marginBottom: '10px', textTransform: 'uppercase' }}>Abilities</p>
            {abilities.map(({ key, name, desc, color }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ ...mono, background: color + '22', border: `1px solid ${color}88`, borderRadius: '4px', padding: '2px 8px', fontSize: '12px', color, minWidth: '22px', textAlign: 'center', boxShadow: `0 0 6px ${color}44` }}>
                  {key}
                </span>
                <div>
                  <span style={{ ...mono, color: '#ffffffcc', fontSize: '13px' }}>{name}</span>
                  <span style={{ ...mono, color: '#ffffff44', fontSize: '11px', marginLeft: '8px' }}>{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
          {/* Normal start */}
          <button
            onClick={onStart}
            style={{
              ...mono,
              background: 'transparent',
              border: '1px solid #7b2fff88',
              borderRadius: '6px',
              color: '#ffffffcc',
              fontSize: '17px',
              letterSpacing: '0.15em',
              padding: '10px 40px',
              cursor: 'pointer',
              animation: 'sp-blink 2s ease-in-out infinite',
            }}
          >
            CLICK TO START
          </button>

          {/* Daily Challenge button */}
          <button
            onClick={handleDailyClick}
            style={{
              ...mono,
              background: 'rgba(255, 200, 0, 0.08)',
              border: '1px solid rgba(255, 200, 0, 0.5)',
              borderRadius: '6px',
              color: '#ffc800',
              fontSize: '13px',
              letterSpacing: '0.12em',
              padding: '7px 24px',
              cursor: 'pointer',
              textShadow: '0 0 10px #ffc80066',
            }}
          >
            ◆ DAILY CHALLENGE
          </button>
        </div>

        {/* Story blurb */}
        <p style={{ ...mono, color: '#ffffff22', fontSize: '11px', textAlign: 'center', lineHeight: 1.7 }} className="pointer-events-none">
          Kael Riven · Ex-Helix operative · Connected to the Pulse<br />
          Survive the corrupted arena. How long can you hold?
        </p>

        {/* All-time leaderboard panel */}
        {allTimeBoard.length > 0 && (
          <div style={{
            background: 'rgba(10, 10, 20, 0.85)',
            border: '1px solid rgba(255, 200, 0, 0.2)',
            borderRadius: '8px',
            padding: '12px 20px',
            minWidth: '320px',
            maxWidth: '400px',
          }} className="pointer-events-none">
            <p style={{ ...mono, color: '#ffc800', fontSize: '10px', letterSpacing: '0.25em', marginBottom: '8px', textAlign: 'center', textTransform: 'uppercase', textShadow: '0 0 8px #ffc80055' }}>
              ◆ All-Time Hall of Fame
            </p>
            {allTimeBoard.map((entry) => (
              <div key={entry.rank} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ ...mono, color: entry.is_you ? '#ffc800' : '#ffffff44', fontSize: '11px', minWidth: '20px' }}>
                  #{entry.rank}
                </span>
                <span style={{ ...mono, color: entry.is_you ? '#ffc800' : '#ffffff88', fontSize: '11px', flex: 1, marginLeft: '8px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {entry.player_name}{entry.is_you ? ' ◀' : ''}
                </span>
                <span style={{ ...mono, color: entry.is_you ? '#ffc800' : '#ffffffaa', fontSize: '11px', marginLeft: '8px' }}>
                  {entry.score.toLocaleString()}
                </span>
                <span style={{ ...mono, color: '#ffffff33', fontSize: '10px', marginLeft: '6px' }}>
                  W{entry.wave_reached}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Name Prompt Modal */}
      {showNamePrompt && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            background: '#0d0d1a',
            border: '1px solid rgba(255, 200, 0, 0.4)',
            borderRadius: '10px',
            padding: '32px 40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            minWidth: '320px',
          }}>
            <p style={{ ...mono, color: '#ffc800', fontSize: '14px', letterSpacing: '0.2em', textShadow: '0 0 10px #ffc80066', margin: 0 }}>
              ◆ DAILY CHALLENGE
            </p>
            <p style={{ ...mono, color: '#ffffff88', fontSize: '12px', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
              One shared seed per day.<br />Compete with everyone.
            </p>
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNameSubmit() }}
              maxLength={20}
              autoFocus
              style={{
                ...mono,
                background: '#1a1a2e',
                border: '1px solid #7b2fff55',
                borderRadius: '6px',
                color: '#ffffffcc',
                fontSize: '14px',
                padding: '8px 14px',
                outline: 'none',
                width: '100%',
                textAlign: 'center',
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleNameSubmit}
                style={{
                  ...mono,
                  background: 'rgba(255, 200, 0, 0.15)',
                  border: '1px solid rgba(255, 200, 0, 0.6)',
                  borderRadius: '6px',
                  color: '#ffc800',
                  fontSize: '13px',
                  padding: '8px 24px',
                  cursor: 'pointer',
                  letterSpacing: '0.1em',
                }}
              >
                PLAY
              </button>
              <button
                onClick={() => setShowNamePrompt(false)}
                style={{
                  ...mono,
                  background: 'transparent',
                  border: '1px solid #ffffff22',
                  borderRadius: '6px',
                  color: '#ffffff44',
                  fontSize: '13px',
                  padding: '8px 24px',
                  cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
