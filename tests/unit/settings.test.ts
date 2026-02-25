import { describe, it, expect } from 'vitest'
import * as S from '@/lib/game/settings'

describe('settings', () => {
  describe('Game dimensions', () => {
    it('has valid game dimensions', () => {
      expect(S.GAME_WIDTH).toBe(1280)
      expect(S.GAME_HEIGHT).toBe(720)
    })

    it('has arena center in middle of screen', () => {
      expect(S.ARENA_CENTER_X).toBe(S.GAME_WIDTH / 2)
      expect(S.ARENA_CENTER_Y).toBe(S.GAME_HEIGHT / 2)
    })
  })

  describe('Player settings', () => {
    it('has positive player stats', () => {
      expect(S.PLAYER_SPEED).toBeGreaterThan(0)
      expect(S.PLAYER_SIZE).toBeGreaterThan(0)
      expect(S.PLAYER_HP).toBeGreaterThan(0)
    })

    it('has valid dash settings', () => {
      expect(S.DASH_SPEED).toBeGreaterThan(S.PLAYER_SPEED)
      expect(S.DASH_DURATION).toBeGreaterThan(0)
      expect(S.DASH_COST).toBeLessThanOrEqual(S.MAX_ENERGY)
    })
  })

  describe('Energy settings', () => {
    it('has valid energy values', () => {
      expect(S.MAX_ENERGY).toBe(100)
      expect(S.ENERGY_REGEN).toBeGreaterThan(0)
      expect(S.ENERGY_PER_HIT).toBeGreaterThan(0)
    })
  })

  describe('Combat - Light Attack', () => {
    it('has balanced light attack values', () => {
      expect(S.LIGHT_DAMAGE).toBeGreaterThan(0)
      expect(S.LIGHT_RANGE).toBeGreaterThan(0)
      expect(S.LIGHT_ARC).toBeGreaterThan(0)
      expect(S.LIGHT_ARC).toBeLessThan(Math.PI * 2)
      expect(S.LIGHT_COOLDOWN).toBeLessThan(1)
    })
  })

  describe('Combat - Heavy Attack', () => {
    it('heavy attack deals more damage than light', () => {
      expect(S.HEAVY_DAMAGE).toBeGreaterThan(S.LIGHT_DAMAGE)
    })

    it('heavy attack has longer range than light', () => {
      expect(S.HEAVY_RANGE).toBeGreaterThan(S.LIGHT_RANGE)
    })

    it('heavy attack has longer cooldown', () => {
      expect(S.HEAVY_COOLDOWN).toBeGreaterThan(S.LIGHT_COOLDOWN)
    })
  })

  describe('Combat - Pulse Wave', () => {
    it('pulse wave has largest range', () => {
      expect(S.PULSE_WAVE_RANGE).toBeGreaterThan(S.HEAVY_RANGE)
    })

    it('pulse wave has energy cost', () => {
      expect(S.PULSE_WAVE_COST).toBeGreaterThan(0)
      expect(S.PULSE_WAVE_COST).toBeLessThanOrEqual(S.MAX_ENERGY)
    })
  })

  describe('Combat - Time Flicker', () => {
    it('has valid time flicker settings', () => {
      expect(S.TIME_FLICKER_DURATION).toBeGreaterThan(0)
      expect(S.TIME_FLICKER_COST).toBeGreaterThan(0)
      expect(S.TIME_FLICKER_SLOW).toBeGreaterThan(0)
      expect(S.TIME_FLICKER_SLOW).toBeLessThan(1)
    })
  })

  describe('Enemy settings', () => {
    it('normal enemy has balanced stats', () => {
      expect(S.NORMAL_ENEMY.hp).toBeGreaterThan(0)
      expect(S.NORMAL_ENEMY.speed).toBeGreaterThan(0)
      expect(S.NORMAL_ENEMY.damage).toBeGreaterThan(0)
    })

    it('sniper has lower HP but higher range', () => {
      expect(S.SNIPER_ENEMY.hp).toBeLessThan(S.NORMAL_ENEMY.hp)
      expect(S.SNIPER_ENEMY.attackRange).toBeGreaterThan(S.NORMAL_ENEMY.attackRange)
    })

    it('heavy enemy has highest HP', () => {
      expect(S.HEAVY_ENEMY.hp).toBeGreaterThan(S.NORMAL_ENEMY.hp)
      expect(S.HEAVY_ENEMY.hp).toBeGreaterThan(S.SNIPER_ENEMY.hp)
      expect(S.HEAVY_ENEMY.hp).toBeGreaterThan(S.FAST_ENEMY.hp)
    })

    it('fast enemy has highest speed', () => {
      expect(S.FAST_ENEMY.speed).toBeGreaterThan(S.NORMAL_ENEMY.speed)
      expect(S.FAST_ENEMY.speed).toBeGreaterThan(S.SNIPER_ENEMY.speed)
      expect(S.FAST_ENEMY.speed).toBeGreaterThan(S.HEAVY_ENEMY.speed)
    })
  })

  describe('setArenaRadius', () => {
    it('updates arena radius', () => {
      const original = S.ARENA_RADIUS
      S.setArenaRadius(500)
      expect(S.ARENA_RADIUS).toBe(500)
      S.setArenaRadius(original) // restore
    })
  })
})
