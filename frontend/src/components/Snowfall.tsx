import { FC, useState } from 'react'

const snowflakes = ['❄️', '❅', '⋆'] as const

interface SnowfallProps {
  onBurst?: () => void
}

const Snowfall: FC<SnowfallProps> = ({ onBurst }) => {
  const [burstFlakes, setBurstFlakes] = useState<Set<number>>(new Set())

  const handleClick = (index: number) => {
    if (burstFlakes.has(index)) return

    setBurstFlakes(prev => new Set(prev).add(index))
    
    // Звук pop
    try {
      new Audio('/pop.mp3').play().catch(() => console.log('pop'))
    } catch {
      console.log('pop')
    }

    // Вызов callback
    onBurst?.()

    // Удаляем через 1 секунду (после анимации)
    setTimeout(() => {
      setBurstFlakes(prev => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }, 1000)
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
      {Array.from({ length: 35 }, (_, i) => {
        const symbol = snowflakes[i % snowflakes.length]
        const size = i % 4 === 0 ? 'text-xl opacity-40' : i % 4 === 1 ? 'text-2xl opacity-60' : i % 4 === 2 ? 'text-3xl opacity-80' : 'text-2xl opacity-70'
        const duration = 12 + (i % 6) * 3
        const delay = - (i % 30) * 1
        const drift = 30 + (i % 10) * 10
        const startY = (i % 30) * 4
        const isBurst = burstFlakes.has(i)

        return (
          <div
            key={i}
            className={`absolute text-white ${size} ${isBurst ? 'animate-burst' : 'animate-fall'} pointer-events-auto cursor-pointer`}
            onClick={(e) => { e.stopPropagation(); handleClick(i) }}
            style={{
              left: `${(i * 11) % 100}%`,
              top: `-${startY}%`,
              '--drift': `${drift}px`,
              animationDuration: isBurst ? '1s' : `${duration}s`,
              animationDelay: isBurst ? '0s' : `${delay}s`,
              animationTimingFunction: isBurst ? 'ease-out' : 'linear',
              animationIterationCount: isBurst ? 1 : 'infinite',
              animationFillMode: isBurst ? 'forwards' : 'none',
            } as React.CSSProperties}
          >
            {symbol}
          </div>
        )
      })}
    </div>
  )
}

export default Snowfall
