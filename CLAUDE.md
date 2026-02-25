# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Allwayes use "AskUserQuestion" tool when in plan mode.

## Build Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
```

No test framework is configured.

## Architecture Overview

Shadow Pulse is a 2D arcade action combat game built with:
- **Next.js 16 + React 19 + TypeScript** - Application framework
- **Custom Canvas 2D engine** - No game library; raw Canvas API
- **shadcn/ui** - Pre-built UI components (mostly unused; game runs in canvas)

### Game Loop

```
Input (keyboard) → updateGame(deltaTime) → renderGame() @ 60 FPS
```

The game component (`components/game/ShadowPulseGame.tsx`) manages the canvas, input state, and runs the main loop via `requestAnimationFrame`.

## Core Game Modules (`lib/game/`)

| Module | Purpose |
|--------|---------|
| `engine.ts` | GameState interface, create/update/render orchestration, wave & level transitions |
| `player.ts` | Player entity, movement, 4 attack types (light, heavy, pulse, time flicker), dash |
| `enemy.ts` | 4 enemy archetypes: Normal, Sniper, Heavy, Fast - each with unique AI |
| `combat.ts` | Arc-based hit detection, damage calculation, knockback physics |
| `renderer.ts` | All canvas drawing (825 LOC) - arena, entities, particles, HUD |
| `settings.ts` | **Single source of truth** for all game constants and balance values |
| `particles.ts` | Particle system for visual effects |
| `levels.ts` | 6 themed arenas with obstacles, difficulty scaling |
| `waves.ts` | Enemy wave composition and spawn logic |
| `camera.ts` | Screen shake effects |
| `vec2.ts` | 2D vector math utilities |

## Key Patterns

**GameState** (in `engine.ts`) is the central data structure containing player, enemies, particles, wave/level info, and score.

**Settings-driven design**: All balance values (damage, cooldowns, speeds, ranges) live in `settings.ts`. Modify there, not inline.

**Entity model**: Player and Enemy share position/velocity/health patterns but have distinct behavior implementations.

**Combat flow**: Attack input → check enemies in arc range → apply damage/knockback → spawn hit effects → camera shake → particles

## Controls

- **WASD/Arrows**: Move
- **J**: Light attack
- **K**: Heavy attack (hold to charge)
- **L**: Pulse wave (AoE)
- **;**: Time flicker (slow enemies)
- **Space/Shift**: Dash

## Notes

- `next.config.mjs` ignores TypeScript build errors
- High scores persist to `localStorage`
- Game is SSR-disabled (dynamic import in `app/page.tsx`)
