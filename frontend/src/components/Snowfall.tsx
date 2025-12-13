import { FC } from 'react'

const snowflakes = ['❄️', '❅', '⋆'] as const

const Snowfall: FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
      {Array.from({ length: 45 }, (_, i) => {
        const symbol = snowflakes[i % snowflakes.length]

        const size = i % 4 === 0 ? 'text-xl opacity-40' : i % 4 === 1 ? 'text-2xl opacity-60' : i % 4 === 2 ? 'text-3xl opacity-80' : 'text-2xl opacity-70'

        const duration = 12 + (i % 6) * 3

        const delay = - (i % 30) * 1

        const drift = 30 + (i % 10) * 10

        const startY = (i % 30) * 4

        return (
          <div
            key={i}
            className={`absolute text-white ${size} animate-fall`}
            style={{
              left: `${(i * 11) % 100}%`,
              top: `-${startY}%`,
              '--drift': `${drift}px`,
              animationDuration: `${duration}s`,
              animationDelay: `${delay}s`,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
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
