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
| `engine.ts` | GameState interface, create/update/render orchestration, wave & level transitions, pause menu, difficulty presets |
| `player.ts` | Player entity, movement, 4 attack types (light, heavy, pulse, time flicker), dash, sprite animation state |
| `enemy.ts` | 4 enemy archetypes: Normal, Sniper, Heavy, Fast — each with unique AI |
| `combat.ts` | Arc-based hit detection, damage calculation, knockback physics, Last Stand trigger |
| `renderer.ts` | All canvas drawing (~3,435 LOC) — arena, entities, particles, HUD, mutator draft, contract UI, death recap, pause menu, wave events, question challenge |
| `settings.ts` | **Single source of truth** for all game constants and balance values |
| `particles.ts` | Particle system for visual effects |
| `levels.ts` | 6 themed arenas with obstacles and hazards, difficulty scaling |
| `waves.ts` | Enemy wave composition, spawn logic, and wave event system |
| `camera.ts` | Screen shake effects |
| `vec2.ts` | 2D vector math utilities |
| `mutators.ts` | Post-wave roguelike upgrade drafts — 25 mutators (3 rarities) with stacking and synergies |
| `affixes.ts` | Per-wave enemy modifiers — 6 affix types (Swift/Frenzied/Armored/Regenerating/Volatile/Berserker) across 3 tiers |
| `contracts.ts` | Optional wave objectives — 10 contracts (easy/medium/hard) with score/HP/energy/consumable rewards |
| `scores.ts` | Score persistence — localStorage + optional Supabase leaderboard, graceful fallback |
| `seeded-rng.ts` | Mulberry32 PRNG — module-level `rng()` replaces `Math.random()` in waves/affixes/mutators/contracts; swapped for seeded fn in Daily Challenge mode |
| `audio.ts` | Procedural synth music + 11 SFX types via `AudioEngine` class; no external audio files |
| `assetLoader.ts` | Preloads `/public/sprites/` with graceful null fallback; returns `AssetCache` |
| `spriteAnimator.ts` | `PlayerAnimState` enum + sheet frame lookup via `getAnimFrame()`; activate by dropping `player.png` |
| `questions.ts` | Quiz system: `Question`/`QuestionTopic` interfaces, `TOPICS` registry, `getQuestion()` selector |

## Educational Layer (`lib/game/topics/`)

| File | Questions | Grades | Description |
|------|-----------|--------|-------------|
| `english-vocab.ts` | 516 | 3–6 | English words with Hebrew translations; 3 difficulty tiers |
| `_TOPIC_TEMPLATE.ts` | — | — | Template for creating new topic files |

To add a topic: create a file matching the template, define a `QuestionTopic` object, import it into `questions.ts` and add to the `TOPICS` array.

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

**GameState** (in `engine.ts`) is the central data structure. Beyond the basics (player, enemies, particles, wave/level, score) it includes:
- Mutators & modifiers: `activeMutators`, `combinedModifiers`, `mutatorSelectionActive`, `mutatorChoices`, `mutatorPeekActive`
- Contract state & progress: `contractState`, `originalEnemyCounts`
- Wave affix: `currentAffix`
- Wave events: `pendingWaveEvent`, `activeWaveEvent`, `waveEventTimer`, `surgeZone`
- Consumables: `consumables[]`, `consumableActive`
- Difficulty: `difficulty`, `difficultyHpBonus`
- Last Stand flags: `lastStandUsed`, `lastStandActive`, `lastStandTimer`
- Death recap: `damageByEnemyType`
- Visual: `timeScale`, `slashTrails`, `damageNumbers`, `hitEffects`
- Pause: `paused`, `pauseMenuSelection`
- Classroom: `quizEnabled`, `selectedGrade`, `selectedTopicId`, `hebrewLayoutActive`, `keyboardPanelTimer`, `letterFlashes`, `questionPhase`, `currentQuestion`, `questionResult`, `questionRetryAvailable`, `questionFeedbackTimer`, `pendingMutatorIndex`

**Settings-driven design**: All balance values (damage, cooldowns, speeds, ranges, Last Stand constants, death hints, classroom constants) live in `settings.ts`. Modify there, not inline.

**Difficulty** — `getEffectivePreset(state)` in `engine.ts` is the single entry point. It respects Classroom grade-split override, Daily Challenge override, and the player-selected difficulty. The 5 presets (`very_easy`, `easy`, `normal`, `arcade`, `classroom`) live in `DIFFICULTY_PRESETS` in `settings.ts`.

**Entity model**: Player and Enemy share position/velocity/health patterns but have distinct behavior implementations.

**Combat flow**: Attack input → check enemies in arc range → apply damage/knockback → spawn hit effects → camera shake → particles

## Game Systems

**Last Stand** — One-time lethal-hit survival per run. Triggers automatically on a killing blow: player survives with 1 HP, 15% time scale for 1 second, 1.5s iframes. Constants in `settings.ts`.

**Death Recap** — Tracks `damageByEnemyType` throughout the run. On game over, highlights the primary damage source and shows a contextual tip (`DEATH_HINTS` in `settings.ts`).

**Mutator Draft** — After each wave, player chooses 1 of 3 weighted-random mutators (common/rare/epic). 25 mutators total with stacking effects and synergy bonuses. Modifiers stack via `computeCombinedModifiers()`. Select with `1 / 2 / 3`; hold `Tab` to peek before committing.

**Wave Affixes** — Each wave may roll one affix starting from wave 2. Tier (Mild/Medium/Strong) scales with wave number and modifies all enemies spawned that wave.

**Wave Contracts** — Optional objective offered before each wave (e.g. "take no damage", "kill sniper first"). Evaluated at wave end; rewards score bonus, HP restore, energy restore, or consumable.

**Wave Events** — 25% chance per wave starting wave 3. Four types: Blackout (limited vision, +300 score), Surge Zone (2× damage area, +200 score/+50 energy), Enemy Frenzy (faster enemies, +400 score/+15 HP), Overwhelming Force (+50% enemies, +500 score/+20 HP). Accept/reject with **Y/N** before the wave starts; skipping forfeits the reward.

**Consumables** — Rare contract rewards: `nuke` (kills all enemies), `full_heal`, `invincibility`. Activate with **Q**. At most one active at a time; stored in `GameState.consumables[]` and `consumableActive`.

**Daily Seed Challenge** — One fixed run seed per day (hash of `YYYY-MM-DD`). All players get identical enemy spawns, affixes, mutators, and contracts. `createGameState(true)` swaps `rng()` to a mulberry32 seeded generator. Scores stored in Supabase `daily_challenge_scores` table (anonymous player ID via localStorage UUID, upsert best score only). Game over screen shows today's top-10; title screen shows all-time Hall of Fame.

**Pause Menu** — ESC toggles pause (blocked during quiz, mutator draft, and wave event screens). Navigate with W/S or ↑↓; confirm with Enter or mouse click. Options: Resume, Restart, Return to Title.

**Audio** — `AudioEngine` class in `audio.ts`. Procedurally generated synth music (bass, arpeggios, kick/hihat) and 11 synthesized SFX. No external audio files required. Key methods: `playAttack(type)`, `playHit(damage)`, `playEnemyDeath(type)`, `playLastStand()`, `playConsumable(type)`, `playDash()`, `playWaveStart/End()`, `playMutatorSelect(rarity)`, `playContractResult(accepted)`, `playLevelUp()`.

**Sprite Animation** — Optional drop-in: place `/public/sprites/player.png` (320×576, 9-row × 64px sheet) to enable sprite rendering. Falls back to procedural canvas drawing without it. States: `idle`, `walk`, `dash`, `light_attack`, `heavy_charge`, `heavy_attack`, `pulse_attack`, `hurt`, `death`. See `public/sprites/SPEC.md` for sheet format details.

**Classroom Mode** — Fully opt-in educational layer (`quizEnabled` flag, default off). Title screen toggle: "CLASSROOM MODE OFF/ON". When ON reveals grade selector (1–6) and topic dropdown (from `TOPICS` registry in `questions.ts`).
- Grades 1–2: keyboard panel + letter flashes on every keypress; mutators apply immediately (no quiz)
- Grades 3–6: vocabulary quiz (A/B/C/D) gates mutator selection after each wave; one retry on wrong answer
- Hebrew keyboard layout auto-detected (Unicode range check before `toLowerCase()`) and toggled in real-time
- Persistence: `shadowpulse_quiz_enabled`, `shadowpulse_topic` in localStorage

## Controls

- **WASD / Arrows**: Move
- **J**: Light attack
- **K**: Heavy attack (hold to charge)
- **L**: Pulse wave (AoE)
- **;**: Time flicker (slow enemies)
- **Space / Shift**: Dash
- **Q**: Activate consumable (nuke / full heal / invincibility)
- **Tab**: Hold to peek at mutator choices (pre-wave)
- **1 / 2 / 3**: Select mutator (post-wave draft)
- **Y / N**: Accept / Reject wave event offer
- **ESC**: Toggle pause menu (in-game)
- **↑↓ / W/S + Enter**: Navigate and confirm pause menu
- **A / B / C / D**: Quiz answer (Classroom Mode, Grades 3+)
- **R**: Restart (on game over screen)

## Notes

- `next.config.mjs` ignores TypeScript build errors
- Scores persist to localStorage with optional Supabase cloud leaderboard (`lib/game/scores.ts`); game works offline without Supabase configured
- Game is SSR-disabled (dynamic import in `app/page.tsx`)
- Vercel deployment config in `vercel.json` (fra1 region)
- `rng()` from `seeded-rng.ts` must be used instead of `Math.random()` in all game randomness — enables deterministic Daily Challenge replays; `Math.random()` is only acceptable for purely visual effects (particles, damage number velocity scatter)
- Daily Challenge identity: anonymous UUID stored in `shadowpulse_player_id` (localStorage), name in `shadowpulse_player_name`
- Classroom Mode is entirely opt-in via `quizEnabled`; all educational code paths are gated and have zero effect when off
- `getEffectivePreset()` in `engine.ts` is the single entry point for difficulty — always use it; never read `difficulty` directly for gameplay calculations
- Audio is synthesized at runtime via Web Audio API — no audio files required; call `audio.init()` on first user interaction then `audio.resume()` on subsequent interactions
- Drop `/public/sprites/player.png` (320×576, 9-row, 64px cells) to enable sprite rendering; game is fully playable without it
