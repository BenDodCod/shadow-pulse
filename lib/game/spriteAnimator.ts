// Sprite animation state machine for the player character.
// PlayerAnimState is defined here and imported by player.ts (no circular deps).

import * as S from './settings'

export type PlayerAnimState =
  | 'idle'         // 2 frames, loops
  | 'walk'         // 4 frames, loops
  | 'dash'         // 3 frames, plays once then holds last frame
  | 'light_attack' // 3 frames, plays once
  | 'heavy_charge' // 2 frames, loops while charging
  | 'heavy_attack' // 4 frames, plays once
  | 'pulse_attack' // 3 frames, plays once
  | 'hurt'         // 2 frames, plays once
  | 'death'        // 5 frames, plays once then holds last frame

// Frame count per animation state
export const SPRITE_FRAME_COUNTS: Record<PlayerAnimState, number> = {
  idle: 2,
  walk: 4,
  dash: 3,
  light_attack: 3,
  heavy_charge: 2,
  heavy_attack: 4,
  pulse_attack: 3,
  hurt: 2,
  death: 5,
}

// Playback speed (frames per second) per state
export const SPRITE_ANIM_FPS: Record<PlayerAnimState, number> = {
  idle: 4,
  walk: 8,
  dash: 12,
  light_attack: 16,
  heavy_charge: 6,
  heavy_attack: 12,
  pulse_attack: 12,
  hurt: 12,
  death: 8,
}

// Sprite sheet row order (top to bottom)
const STATE_ROW: Record<PlayerAnimState, number> = {
  idle: 0,
  walk: 1,
  dash: 2,
  light_attack: 3,
  heavy_charge: 4,
  heavy_attack: 5,
  pulse_attack: 6,
  hurt: 7,
  death: 8,
}

// States that loop vs. play once and hold last frame
export const LOOPING_STATES = new Set<PlayerAnimState>(['idle', 'walk', 'heavy_charge'])

/**
 * Returns the source rect for the given animation state and frame.
 * Caller is responsible for mapping this to drawImage().
 */
export function getAnimFrame(state: PlayerAnimState, frame: number): { sx: number; sy: number } {
  return {
    sx: frame * S.SPRITE_SIZE,
    sy: STATE_ROW[state] * S.SPRITE_SIZE,
  }
}
