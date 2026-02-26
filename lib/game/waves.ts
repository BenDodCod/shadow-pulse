import { Enemy, createEnemy, EnemyType } from './enemy'
import { WaveAffix } from './affixes'
import { rng } from './seeded-rng'

export interface WaveEvent {
  id: string
  name: string
  description: string
  rewardText: string
  bonusScore: number
  bonusHp?: number
  bonusEnergy?: number
  effectType: 'blackout' | 'surge_zone' | 'enemy_frenzy' | 'double_enemies'
  duration: number   // -1 = whole wave
}

export const WAVE_EVENT_POOL: WaveEvent[] = [
  {
    id: 'blackout',
    name: 'BLACKOUT',
    description: 'Vision is limited. Enemies lurk in the dark.',
    rewardText: '+300 score',
    bonusScore: 300,
    effectType: 'blackout',
    duration: -1,
  },
  {
    id: 'surge_zone',
    name: 'SURGE ZONE',
    description: 'A power zone appears. Deal 2× damage inside it.',
    rewardText: '+200 score + energy refill',
    bonusScore: 200,
    bonusEnergy: 50,
    effectType: 'surge_zone',
    duration: -1,
  },
  {
    id: 'enemy_frenzy',
    name: 'ENEMY FRENZY',
    description: 'Enemies move and attack 50% faster this wave.',
    rewardText: '+400 score + 15 HP',
    bonusScore: 400,
    bonusHp: 15,
    effectType: 'enemy_frenzy',
    duration: -1,
  },
  {
    id: 'double_enemies',
    name: 'OVERWHELMING FORCE',
    description: '50% more enemies spawn this wave.',
    rewardText: '+500 score + 20 HP',
    bonusScore: 500,
    bonusHp: 20,
    effectType: 'double_enemies',
    duration: -1,
  },
]

export function selectWaveEvent(wave: number): WaveEvent | null {
  if (wave < 3) return null
  if (rng() > 0.25) return null   // 25% chance
  const idx = Math.floor(rng() * WAVE_EVENT_POOL.length)
  return WAVE_EVENT_POOL[idx]
}

export interface WaveConfig {
  enemies: { type: EnemyType; count: number }[]
}

export function getWaveConfig(wave: number): WaveConfig {
  const configs: WaveConfig[] = [
    // Wave 1 - Tutorial: just normals
    { enemies: [{ type: 'normal', count: 3 }] },
    // Wave 2
    { enemies: [{ type: 'normal', count: 4 }, { type: 'fast', count: 1 }] },
    // Wave 3
    { enemies: [{ type: 'normal', count: 3 }, { type: 'sniper', count: 2 }] },
    // Wave 4
    { enemies: [{ type: 'normal', count: 3 }, { type: 'fast', count: 2 }, { type: 'sniper', count: 1 }] },
    // Wave 5 - First heavy
    { enemies: [{ type: 'heavy', count: 1 }, { type: 'normal', count: 3 }] },
    // Wave 6
    { enemies: [{ type: 'fast', count: 3 }, { type: 'sniper', count: 2 }] },
    // Wave 7
    { enemies: [{ type: 'heavy', count: 1 }, { type: 'fast', count: 2 }, { type: 'normal', count: 3 }] },
    // Wave 8
    { enemies: [{ type: 'heavy', count: 2 }, { type: 'sniper', count: 2 }, { type: 'fast', count: 2 }] },
    // Wave 9
    { enemies: [{ type: 'heavy', count: 2 }, { type: 'fast', count: 3 }, { type: 'sniper', count: 2 }] },
    // Wave 10
    { enemies: [{ type: 'heavy', count: 3 }, { type: 'sniper', count: 3 }, { type: 'fast', count: 2 }] },
    // Wave 11
    { enemies: [{ type: 'heavy', count: 2 }, { type: 'fast', count: 4 }, { type: 'sniper', count: 3 }] },
    // Wave 12
    { enemies: [{ type: 'heavy', count: 3 }, { type: 'sniper', count: 4 }, { type: 'fast', count: 3 }, { type: 'normal', count: 2 }] },
    // Wave 13
    { enemies: [{ type: 'heavy', count: 3 }, { type: 'fast', count: 5 }, { type: 'sniper', count: 3 }] },
    // Wave 14
    { enemies: [{ type: 'heavy', count: 4 }, { type: 'sniper', count: 4 }, { type: 'fast', count: 4 }] },
    // Wave 15
    { enemies: [{ type: 'heavy', count: 4 }, { type: 'fast', count: 5 }, { type: 'sniper', count: 4 }, { type: 'normal', count: 3 }] },
  ]

  if (wave <= configs.length) {
    return configs[wave - 1]
  }

  // Endless scaling beyond wave 15
  const extraWave = wave - configs.length
  const baseNormals = 2 + Math.floor(extraWave * 0.3)
  const heavies = Math.min(5, 4 + Math.floor(extraWave / 3))
  const snipers = Math.min(5, 4 + Math.floor(extraWave / 3))
  const fasts = Math.min(6, 5 + Math.floor(extraWave / 2))

  return {
    enemies: [
      { type: 'normal', count: baseNormals },
      { type: 'heavy' as EnemyType, count: heavies },
      { type: 'sniper' as EnemyType, count: snipers },
      { type: 'fast' as EnemyType, count: fasts },
    ],
  }
}

export function spawnWaveEnemies(wave: number, arenaRadius: number, centerX: number, centerY: number, difficultyMult = 1.0, affix: WaveAffix | null = null): Enemy[] {
  const config = getWaveConfig(wave)
  const enemies: Enemy[] = []

  for (const group of config.enemies) {
    for (let i = 0; i < group.count; i++) {
      // Spawn around the arena edge
      const angle = rng() * Math.PI * 2
      const radius = arenaRadius * 0.7 + rng() * arenaRadius * 0.25
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius
      enemies.push(createEnemy(group.type, x, y, difficultyMult, affix))
    }
  }

  return enemies
}

export function getWaveScore(wave: number): number {
  return wave * 100
}
