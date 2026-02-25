# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Allwayes use "AskUserQuestion" tool when in plan mode.

## Build Commands

```bash
npm run dev        # Start development server (localhost:3000)
npm run build      # Production build
npm run lint       # Run ESLint
npm run test       # Run Vitest unit tests (watch mode)
npm run test:run   # Run Vitest once
npm run test:e2e   # Run Playwright end-to-end tests
```

Vitest and @playwright/test are configured.

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
| `combat.ts` | Arc-based hit detection, damage calculation, knockback physics, Last Stand trigger |
| `renderer.ts` | All canvas drawing (1563 LOC) - arena, entities, particles, HUD, mutator draft, contract UI, death recap |
| `settings.ts` | **Single source of truth** for all game constants and balance values |
| `particles.ts` | Particle system for visual effects |
| `levels.ts` | 6 themed arenas with obstacles, difficulty scaling |
| `waves.ts` | Enemy wave composition and spawn logic |
| `camera.ts` | Screen shake effects |
| `vec2.ts` | 2D vector math utilities |
| `mutators.ts` | Post-wave roguelike upgrade drafts — 15 mutators (3 rarities) with stat/damage/cooldown modifiers |
| `affixes.ts` | Per-wave enemy modifiers — 6 affix types (Swift/Frenzied/Armored/Regenerating/Volatile/Berserker) across 3 tiers |
| `contracts.ts` | Optional wave objectives — 9 contracts (easy/medium/hard) with score/HP/energy rewards |
| `scores.ts` | Score persistence — localStorage + optional Supabase leaderboard, graceful fallback |
| `seeded-rng.ts` | Mulberry32 PRNG — module-level `rng()` replaces `Math.random()` in waves/affixes/mutators/contracts; swapped for seeded fn in Daily Challenge mode |

## Vercel Integration

| File | Purpose |
|------|---------|
| `vercel.json` | Deployment config — region set to `fra1` (Frankfurt) |
| `.env.local` | Local env vars (not committed) — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

Deploy via `vercel --prod` or push to the connected Git branch. Preview deployments are created automatically on PRs. Environment variables must be configured in the Vercel dashboard for production.

## Supabase Integration (`lib/supabase/`)

| File | Purpose |
|------|---------|
| `client.ts` | Singleton Supabase client; checks `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `types.ts` | Database schema types (profiles, game_sessions, leaderboard, daily_challenge_scores) |
| `daily-challenge.ts` | Daily Challenge Supabase ops — submit/upsert score, fetch today's leaderboard, all-time Hall of Fame, anonymous player ID |

## Key Patterns

**GameState** (in `engine.ts`) is the central data structure. Beyond the basics (player, enemies, particles, wave/level, score) it now includes: active mutators & combined modifiers, contract state & progress, current wave affix, Last Stand flags, death recap damage tracking, and `timeScale` (0.15 during slow-mo, 1.0 normally).

**Settings-driven design**: All balance values (damage, cooldowns, speeds, ranges, Last Stand constants, death hints) live in `settings.ts`. Modify there, not inline.

**Entity model**: Player and Enemy share position/velocity/health patterns but have distinct behavior implementations.

**Combat flow**: Attack input → check enemies in arc range → apply damage/knockback → spawn hit effects → camera shake → particles

## Game Systems

**Last Stand** — One-time lethal-hit survival per run. Triggers automatically on a killing blow: player survives with 1 HP, 15% time scale for 1 second, 1.5s iframes. Constants in `settings.ts`.

**Death Recap** — Tracks `damageByEnemyType` throughout the run. On game over, highlights the primary damage source and shows a contextual tip (`DEATH_HINTS` in `settings.ts`).

**Mutator Draft** — After each wave, player chooses 1 of 3 weighted-random mutators (common/rare/epic). Modifiers (damage multipliers, stat bonuses, cooldown changes) stack multiplicatively/additively via `computeCombinedModifiers()`. Select with `1 / 2 / 3`.

**Wave Affixes** — Each wave may roll one affix starting from wave 2. Tier (Mild/Medium/Strong) scales with wave number and modifies all enemies spawned that wave.

**Wave Contracts** — Optional objective offered before each wave (e.g. "take no damage", "kill sniper first"). Evaluated at wave end; rewards score bonus, HP restore, or energy restore.

**Daily Seed Challenge** — One fixed run seed per day (hash of `YYYY-MM-DD`). All players get identical enemy spawns, affixes, mutators, and contracts. `createGameState(true)` swaps `rng()` to a mulberry32 seeded generator. Scores stored in Supabase `daily_challenge_scores` table (anonymous player ID via localStorage UUID, upsert best score only). Game over screen shows today's top-10; title screen shows all-time Hall of Fame.

## Controls

- **WASD/Arrows**: Move
- **J**: Light attack
- **K**: Heavy attack (hold to charge)
- **L**: Pulse wave (AoE)
- **;**: Time flicker (slow enemies)
- **Space/Shift**: Dash
- **1 / 2 / 3**: Select mutator (when post-wave draft is active)
- **R**: Restart (on game over screen)

## Notes

- `next.config.mjs` ignores TypeScript build errors
- Scores persist to localStorage with optional Supabase cloud leaderboard (`lib/game/scores.ts`); game works offline without Supabase configured
- Game is SSR-disabled (dynamic import in `app/page.tsx`)
- Vercel deployment config in `vercel.json` (fra1 region)
- `rng()` from `seeded-rng.ts` must be used instead of `Math.random()` in all game randomness — enables deterministic Daily Challenge replays
- Daily Challenge identity: anonymous UUID stored in `shadowpulse_player_id` (localStorage), name in `shadowpulse_player_name`
