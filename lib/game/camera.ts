export interface Camera {
  shakeIntensity: number
  shakeDuration: number
  shakeTimer: number
  offsetX: number
  offsetY: number
}

export function createCamera(): Camera {
  return {
    shakeIntensity: 0,
    shakeDuration: 0,
    shakeTimer: 0,
    offsetX: 0,
    offsetY: 0,
  }
}

export function shakeCamera(camera: Camera, intensity: number, duration: number): void {
  // Only override if stronger shake
  if (intensity > camera.shakeIntensity || camera.shakeTimer <= 0) {
    camera.shakeIntensity = intensity
    camera.shakeDuration = duration
    camera.shakeTimer = duration
  }
}

export function updateCamera(camera: Camera, dt: number): void {
  if (camera.shakeTimer > 0) {
    camera.shakeTimer -= dt
    const progress = camera.shakeTimer / camera.shakeDuration
    const intensity = camera.shakeIntensity * progress
    camera.offsetX = (Math.random() - 0.5) * 2 * intensity
    camera.offsetY = (Math.random() - 0.5) * 2 * intensity
  } else {
    camera.offsetX = 0
    camera.offsetY = 0
    camera.shakeIntensity = 0
  }
}
