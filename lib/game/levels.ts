// ==============================
// SHADOW PULSE - Level Themes
// ==============================

export type ThemeKey = 'void' | 'inferno' | 'cryo' | 'storm' | 'abyss' | 'apocalypse'

export interface Hazard {
  type: 'floor_zone' | 'wall_trap' | 'pulse_center'
  pos: { x: number; y: number }
  radius: number
  active: boolean
  timer: number      // seconds until next toggle
  onDuration: number
  offDuration: number
  color: string
  // wall_trap only: angle facing the arena center (set in generateHazards)
  trapAngle?: number
}

export interface Obstacle {
    x: number
    y: number
    radius: number
    // Destructible pillar state
    hp: number
    maxHp: number
    state: 'intact' | 'cracked' | 'rubble'
    rubbleRadius: number
}

export interface LevelTheme {
    level: number
    name: string
    themeKey: ThemeKey
    bgColor: string
    floorColor: string
    gridColor: string
    borderColor: string
    glowColor: string
    accentColor: string
    arenaRadius: number
    obstacleCount: number
    difficultyMult: number // multiplier applied to enemy hp, speed, damage
    waveRange: [number, number] // inclusive range of waves for this level
}

export const LEVEL_THEMES: LevelTheme[] = [
    {
        level: 1,
        name: 'THE VOID',
        themeKey: 'void',
        bgColor: '#0a0a12',
        floorColor: '#0d0d1a',
        gridColor: '#1a1a2e',
        borderColor: '#3311aa44',
        glowColor: '#7b2fff',
        accentColor: '#7b2fff',
        arenaRadius: 300,
        obstacleCount: 0,
        difficultyMult: 1.0,
        waveRange: [1, 3],
    },
    {
        level: 2,
        name: 'INFERNO',
        themeKey: 'inferno',
        bgColor: '#110604',
        floorColor: '#140804',
        gridColor: '#2e1008',
        borderColor: '#aa220044',
        glowColor: '#ff4400',
        accentColor: '#ff6600',
        arenaRadius: 320,
        obstacleCount: 3,
        difficultyMult: 1.3,
        waveRange: [4, 6],
    },
    {
        level: 3,
        name: 'CRYO',
        themeKey: 'cryo',
        bgColor: '#04080f',
        floorColor: '#060b14',
        gridColor: '#0a1e30',
        borderColor: '#00aacc44',
        glowColor: '#00ccff',
        accentColor: '#00eeff',
        arenaRadius: 345,
        obstacleCount: 4,
        difficultyMult: 1.65,
        waveRange: [7, 9],
    },
    {
        level: 4,
        name: 'STORM',
        themeKey: 'storm',
        bgColor: '#0a0a06',
        floorColor: '#0d0d08',
        gridColor: '#28280a',
        borderColor: '#eeee0044',
        glowColor: '#ffee00',
        accentColor: '#ffffff',
        arenaRadius: 370,
        obstacleCount: 5,
        difficultyMult: 2.0,
        waveRange: [10, 12],
    },
    {
        level: 5,
        name: 'ABYSS',
        themeKey: 'abyss',
        bgColor: '#07020e',
        floorColor: '#0a0316',
        gridColor: '#1e0640',
        borderColor: '#aa00cc44',
        glowColor: '#cc00ff',
        accentColor: '#ff00cc',
        arenaRadius: 395,
        obstacleCount: 6,
        difficultyMult: 2.5,
        waveRange: [13, 15],
    },
    {
        level: 6,
        name: 'APOCALYPSE',
        themeKey: 'apocalypse',
        bgColor: '#0a0000',
        floorColor: '#110000',
        gridColor: '#300008',
        borderColor: '#ff000066',
        glowColor: '#ff0040',
        accentColor: '#ff2255',
        arenaRadius: 420,
        obstacleCount: 7,
        difficultyMult: 3.2,
        waveRange: [16, Infinity],
    },
]

export function getLevelTheme(wave: number): LevelTheme {
    for (const theme of LEVEL_THEMES) {
        if (wave >= theme.waveRange[0] && wave <= theme.waveRange[1]) {
            return theme
        }
    }
    // Beyond defined levels: keep using Apocalypse but ramp difficulty
    const base = LEVEL_THEMES[LEVEL_THEMES.length - 1]
    const extraLevels = Math.floor((wave - base.waveRange[0]) / 3)
    return {
        ...base,
        level: base.level + extraLevels,
        difficultyMult: base.difficultyMult + extraLevels * 0.4,
    }
}

export function getLevelNumber(wave: number): number {
    for (const theme of LEVEL_THEMES) {
        if (wave >= theme.waveRange[0] && wave <= theme.waveRange[1]) {
            return theme.level
        }
    }
    const base = LEVEL_THEMES[LEVEL_THEMES.length - 1]
    return base.level + Math.floor((wave - base.waveRange[0]) / 3) + 1
}

export function isLevelTransition(wave: number): boolean {
    if (wave <= 1) return false
    for (const theme of LEVEL_THEMES) {
        if (wave === theme.waveRange[0]) return true
    }
    // Beyond level 6: new level every 3 waves
    const base = LEVEL_THEMES[LEVEL_THEMES.length - 1]
    if (wave > base.waveRange[0]) {
        return (wave - base.waveRange[0]) % 3 === 0
    }
    return false
}

export function generateObstacles(theme: LevelTheme, centerX: number, centerY: number): Obstacle[] {
    const obstacles: Obstacle[] = []
    const count = theme.obstacleCount
    if (count === 0) return obstacles

    // Seed obstacles at even angles within the arena
    const rng = (seed: number) => {
        const x = Math.sin(seed) * 43758.5453
        return x - Math.floor(x)
    }

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + rng(theme.level * 10 + i) * 0.5
        const dist = theme.arenaRadius * (0.35 + rng(theme.level * 7 + i * 3) * 0.25)
        const r = 18 + rng(theme.level * 13 + i * 5) * 12
        obstacles.push({
            x: centerX + Math.cos(angle) * dist,
            y: centerY + Math.sin(angle) * dist,
            radius: r,
            hp: 30,
            maxHp: 30,
            state: 'intact',
            rubbleRadius: Math.max(8, r * 0.35),
        })
    }

    return obstacles
}

export function generateHazards(theme: LevelTheme, cx: number, cy: number): Hazard[] {
    function makeZone(ox: number, oy: number, r: number, onD: number, offD: number, timerOffset: number, color: string): Hazard {
        return { type: 'floor_zone', pos: { x: cx + ox, y: cy + oy }, radius: r, active: false, timer: timerOffset, onDuration: onD, offDuration: offD, color }
    }
    function makeTrap(ox: number, oy: number, timerOffset: number, color: string): Hazard {
        const px = cx + ox, py = cy + oy
        return { type: 'wall_trap', pos: { x: px, y: py }, radius: 18, active: true, timer: timerOffset, onDuration: 0.25, offDuration: 2.5, color, trapAngle: Math.atan2(cy - py, cx - px) }
    }
    function makePulse(r: number, timerOffset: number, color: string): Hazard {
        return { type: 'pulse_center', pos: { x: cx, y: cy }, radius: r, active: false, timer: timerOffset, onDuration: 0.6, offDuration: 5.0, color }
    }

    switch (theme.themeKey) {
        case 'inferno':
            return [
                makeZone(-90, 70, 55, 3.0, 2.0, 2.0, '#ff4400'),
                makeZone(90, -70, 55, 3.0, 2.0, 0.5, '#ff4400'),
            ]
        case 'storm':
            return [
                makeTrap(-200, 0, 2.5, '#ffee00'),
                makeTrap(200, 0, 1.25, '#ffee00'),
                makePulse(210, 4.5, '#ffee00'),
            ]
        case 'abyss':
            return [
                makeZone(-110, 0, 52, 3.5, 2.0, 1.5, '#cc00ff'),
                makeZone(110, 0, 52, 3.5, 2.0, 3.0, '#cc00ff'),
                makeZone(0, -110, 52, 3.5, 2.0, 0.0, '#cc00ff'),
                makeTrap(-210, 90, 1.8, '#aa00cc'),
            ]
        case 'apocalypse':
            return [
                makeZone(-120, 90, 52, 3.0, 2.0, 1.0, '#ff0040'),
                makeZone(120, -90, 52, 3.0, 2.0, 2.5, '#ff0040'),
                makeTrap(-225, -80, 1.8, '#ff2255'),
                makeTrap(225, 80, 0.6, '#ff2255'),
                makePulse(230, 4.0, '#ff0040'),
            ]
        default:
            return []
    }
}
