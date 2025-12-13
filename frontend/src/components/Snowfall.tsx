import { FC } from 'react'

const snowflakes = ['❄️', '❅', '⋆'] as const

const Snowfall: FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
      {Array.from({ length: 35 }, (_, i) => {
        const symbol = snowflakes[i % snowflakes.length]

        const size = i % 4 === 0 ? 'text-xl opacity-40' : i % 4 === 1 ? 'text-2xl opacity-60' : i % 4 === 2 ? 'text-3xl opacity-80' : 'text-2xl opacity-70'

        const duration = 10 + (i % 5) * 3  // 10–22 сек

        const delay = (i % 10) * 1.5      // 0–13.5 сек

        const drift = 30 + (i % 8) * 10   // 30–100px дрейф

        return (
          <div
            key={i}
            className={`absolute text-white ${size} animate-fall`}
            style={{
              left: `${(i * 13) % 100}%`,  // равномерно
              top: '-10%',
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
