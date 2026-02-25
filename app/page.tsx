'use client'

import dynamic from 'next/dynamic'

const ShadowPulseGame = dynamic(() => import('@/components/game/ShadowPulseGame'), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center w-full h-screen"
      style={{ backgroundColor: '#0a0a12' }}
    >
      <p className="font-mono text-sm" style={{ color: '#7b2fff' }}>
        Loading Shadow Pulse...
      </p>
    </div>
  ),
})

export default function Page() {
  return <ShadowPulseGame />
}
