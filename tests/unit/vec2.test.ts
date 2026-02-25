import { describe, it, expect } from 'vitest'
import {
  vec2,
  add,
  sub,
  scale,
  length,
  normalize,
  distance,
  dot,
  angle,
  fromAngle,
  lerp,
  angleBetween,
} from '@/lib/game/vec2'

describe('vec2', () => {
  describe('vec2()', () => {
    it('creates a vector with x and y', () => {
      const v = vec2(3, 4)
      expect(v).toEqual({ x: 3, y: 4 })
    })
  })

  describe('add()', () => {
    it('adds two vectors', () => {
      const a = vec2(1, 2)
      const b = vec2(3, 4)
      expect(add(a, b)).toEqual({ x: 4, y: 6 })
    })

    it('handles negative values', () => {
      const a = vec2(-1, 2)
      const b = vec2(3, -4)
      expect(add(a, b)).toEqual({ x: 2, y: -2 })
    })
  })

  describe('sub()', () => {
    it('subtracts two vectors', () => {
      const a = vec2(5, 7)
      const b = vec2(2, 3)
      expect(sub(a, b)).toEqual({ x: 3, y: 4 })
    })
  })

  describe('scale()', () => {
    it('scales a vector by a scalar', () => {
      const v = vec2(2, 3)
      expect(scale(v, 2)).toEqual({ x: 4, y: 6 })
    })

    it('handles zero scaling', () => {
      const v = vec2(5, 10)
      expect(scale(v, 0)).toEqual({ x: 0, y: 0 })
    })
  })

  describe('length()', () => {
    it('calculates length of 3-4-5 triangle', () => {
      const v = vec2(3, 4)
      expect(length(v)).toBe(5)
    })

    it('returns 0 for zero vector', () => {
      expect(length(vec2(0, 0))).toBe(0)
    })
  })

  describe('normalize()', () => {
    it('normalizes a vector to unit length', () => {
      const v = vec2(3, 4)
      const n = normalize(v)
      expect(n.x).toBeCloseTo(0.6)
      expect(n.y).toBeCloseTo(0.8)
      expect(length(n)).toBeCloseTo(1)
    })

    it('returns zero vector for zero input', () => {
      const n = normalize(vec2(0, 0))
      expect(n).toEqual({ x: 0, y: 0 })
    })
  })

  describe('distance()', () => {
    it('calculates distance between two points', () => {
      const a = vec2(0, 0)
      const b = vec2(3, 4)
      expect(distance(a, b)).toBe(5)
    })

    it('returns 0 for same point', () => {
      const p = vec2(5, 5)
      expect(distance(p, p)).toBe(0)
    })
  })

  describe('dot()', () => {
    it('calculates dot product', () => {
      const a = vec2(2, 3)
      const b = vec2(4, 5)
      expect(dot(a, b)).toBe(23) // 2*4 + 3*5
    })

    it('returns 0 for perpendicular vectors', () => {
      const a = vec2(1, 0)
      const b = vec2(0, 1)
      expect(dot(a, b)).toBe(0)
    })
  })

  describe('angle()', () => {
    it('returns 0 for vector pointing right', () => {
      expect(angle(vec2(1, 0))).toBe(0)
    })

    it('returns PI/2 for vector pointing up', () => {
      expect(angle(vec2(0, 1))).toBeCloseTo(Math.PI / 2)
    })

    it('returns PI for vector pointing left', () => {
      expect(angle(vec2(-1, 0))).toBeCloseTo(Math.PI)
    })
  })

  describe('fromAngle()', () => {
    it('creates unit vector pointing right at angle 0', () => {
      const v = fromAngle(0)
      expect(v.x).toBeCloseTo(1)
      expect(v.y).toBeCloseTo(0)
    })

    it('creates unit vector pointing up at PI/2', () => {
      const v = fromAngle(Math.PI / 2)
      expect(v.x).toBeCloseTo(0)
      expect(v.y).toBeCloseTo(1)
    })
  })

  describe('lerp()', () => {
    it('returns start at t=0', () => {
      const a = vec2(0, 0)
      const b = vec2(10, 10)
      expect(lerp(a, b, 0)).toEqual({ x: 0, y: 0 })
    })

    it('returns end at t=1', () => {
      const a = vec2(0, 0)
      const b = vec2(10, 10)
      expect(lerp(a, b, 1)).toEqual({ x: 10, y: 10 })
    })

    it('returns midpoint at t=0.5', () => {
      const a = vec2(0, 0)
      const b = vec2(10, 10)
      expect(lerp(a, b, 0.5)).toEqual({ x: 5, y: 5 })
    })
  })

  describe('angleBetween()', () => {
    it('calculates angle from origin to point', () => {
      const a = vec2(0, 0)
      const b = vec2(1, 0)
      expect(angleBetween(a, b)).toBe(0)
    })

    it('calculates angle for diagonal', () => {
      const a = vec2(0, 0)
      const b = vec2(1, 1)
      expect(angleBetween(a, b)).toBeCloseTo(Math.PI / 4)
    })
  })
})
