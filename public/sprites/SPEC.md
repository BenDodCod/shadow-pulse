# Shadow Pulse — Sprite Sheet Specification

## Player (`player.png`)

### Canvas Size
- **Width**: 320 px (5 columns × 64 px/frame)
- **Height**: 576 px (9 rows × 64 px/frame)
- **Format**: RGBA PNG with transparent background
- **Color palette**: Neon purple/violet theme (`#7800ff` primary, `#b366ff` highlights, `#ffffff` core)

### Frame Size
Each frame is **64 × 64 px**. The player origin (pivot) is the **center** of each frame (32, 32).

### Row Layout

| Row | State          | Frames | FPS | Loops? | Notes |
|-----|----------------|--------|-----|--------|-------|
| 0   | `idle`         | 2      | 4   | Yes    | Gentle bob / pulse |
| 1   | `walk`         | 4      | 8   | Yes    | Foot cycle |
| 2   | `dash`         | 3      | 12  | No     | Stretch → hold trail pose |
| 3   | `light_attack` | 3      | 16  | No     | Quick slash, arm extends |
| 4   | `heavy_charge` | 2      | 6   | Yes    | Charging glow pulse |
| 5   | `heavy_attack` | 4      | 12  | No     | Full swing arc |
| 6   | `pulse_attack` | 3      | 12  | No     | Radial burst emanating from body |
| 7   | `hurt`         | 2      | 12  | No     | Recoil flash |
| 8   | `death`        | 5      | 8   | No     | Dissolve / shatter, hold last frame |

### Frame columns (left to right within each row)
- Columns 0-4 are used; unused columns (if a state has < 5 frames) can be transparent.
- Example: `idle` uses columns 0 and 1 only.

### Orientation
- **Facing right** (`facing = 0`) is the reference direction.
- The game rotates the sprite to match `player.facing + π/2` before drawing.
- Draw the character facing **upward** in the sprite sheet so the rotation works correctly.

### Visual Style
- Abstract / geometric humanoid — no face, bold shapes
- Neon purple core with glowing edge outline (`#7b2fff` glow shadow)
- Limbs are stylised lines or blade shapes
- Dash state: body stretched horizontally with motion blur trail
- Heavy charge: pulsing energy ring visible around body
- Death: body shatters into geometric fragments

### Tools
- [Aseprite](https://www.aseprite.org/) recommended (128 × 128 canvas for each frame, export scaled to 64)
- [LibreSprite](https://libresprite.github.io/) free alternative

### Loading
Drop the finished file at `/public/sprites/player.png`. The game auto-detects it at startup
and switches from the procedural octagon to sprites immediately — no code changes needed.
