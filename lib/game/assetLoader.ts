// Asset loader — preloads sprite PNGs with graceful fallback
// Place sprites in /public/sprites/. Missing files silently fall back to procedural rendering.

export interface AssetCache {
  player: HTMLImageElement | null
  // Future: enemyNormal, enemySniper, enemyHeavy, enemyFast, bgLayers, etc.
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null) // graceful fallback
    img.src = src
  })
}

export async function loadAssets(): Promise<AssetCache> {
  const [player] = await Promise.all([
    loadImage('/sprites/player.png'),
  ])
  return { player }
}
