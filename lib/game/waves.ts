import { Enemy, createEnemy, EnemyType } from './enemy'

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

export function spawnWaveEnemies(wave: number, arenaRadius: number, centerX: number, centerY: number, difficultyMult = 1.0): Enemy[] {
  const config = getWaveConfig(wave)
  const enemies: Enemy[] = []

  for (const group of config.enemies) {
    for (let i = 0; i < group.count; i++) {
      // Spawn around the arena edge
      const angle = Math.random() * Math.PI * 2
      const radius = arenaRadius * 0.7 + Math.random() * arenaRadius * 0.25
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius
      enemies.push(createEnemy(group.type, x, y, difficultyMult))
    }
  }

  return enemies
}

export function getWaveScore(wave: number): number {
  return wave * 100
}
