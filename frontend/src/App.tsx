import { useEffect, useState, useMemo, useRef } from 'react'
import { Sparkles, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { fetchDecorations } from './api'
import { Decoration } from './types'

interface Position {
  x: number
  y: number
}

type ModalType = 'light' | 'ball' | 'candle' | 'gift' | null

// Список ярких цветов для огоньков
const LIGHT_COLORS = [
  '#FFD700', // золото
  '#FF6B6B', // красный
  '#FFFFFF', // белый
  '#00D4AA', // зеленый
  '#9C27B0', // фиолетовый
  '#673AB7', // пурпурный
  '#2196F3', // синий
  '#FFEB3B', // желтый
  '#E91E63'  // розовый
]

export default function App() {
  //const [decorations, setDecorations] = useState<Decoration[]>([])

  const [decorations, setDecorations] = useState<Decoration[]>(() => {
    /* Для тестирования */
      const testLights = Array.from({ length: 300 }, (_, i): Decoration => ({
        id: -i - 1,
        type: 'light',
        from_account: 'testuser',
        username: `Тестер #${i + 1}`,
        amount: '1',
        created_at: new Date(Date.now() - i * 1000).toISOString(),
        tx_id: `test-tx-${i}`
      }))
  
      const testBalls = Array.from({ length: 73 }, (_, i): Decoration => ({
        id: -1000 - i,
        type: 'ball',
        from_account: 'testuser',
        username: `Шарик #${i + 1}`,
        amount: '10',
        created_at: new Date(Date.now() - i * 1000).toISOString(),
        tx_id: `test-ball-${i}`
      }))
  
      return [...testLights, ...testBalls]
   
    return []  // пусто — реальные данные будут загружаться из бэкенда
  })

  const [loading, setLoading] = useState(true)
  const [modalType, setModalType] = useState<ModalType>(null)
  const [waitingForPayment, setWaitingForPayment] = useState(false)
  const [countdown, setCountdown] = useState(6)
  const [candleText, setCandleText] = useState('')
  const [giftUrl, setGiftUrl] = useState('')
  const [showDonatePanel, setShowDonatePanel] = useState(false)
  const [showLog, setShowLog] = useState(false)

  // Безопасная загрузка WebApp SDK (для будущего использования)
  useEffect(() => {
    try {
      import('@twa-dev/sdk').then((WebApp) => {
        WebApp.default.ready()
        WebApp.default.expand()
      }).catch(() => {
        // WebApp SDK недоступен в браузере - это нормально
      })
    } catch (e) {
      // Игнорируем ошибки
    }
  }, [])

  // Окно ожидания с таймером обратного отсчета
  useEffect(() => {
    if (waitingForPayment) {
      setCountdown(6)
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval)
            setWaitingForPayment(false)
           // loadData() // Обновляем данные после закрытия
            return 0
          }
          return prev - 1
        })
      }, 1000)

      const dataInterval = setInterval(() => {
      //  loadData()
      }, 5000)

      return () => {
        clearInterval(countdownInterval)
        clearInterval(dataInterval)
      }
    }
  }, [waitingForPayment])

  // Загрузка данных при монтировании и realtime подписка
  useEffect(() => {
   /*для тестирования надо закоментить лоад и поставить интервал 300000*/
    // loadData()
    
    // Подписка на realtime обновления через API (polling каждые 3 секунды)
    const interval = setInterval(loadData, 300000)
    
   return () => clearInterval(interval)
   
  }, [])

  async function loadData() {
    try {
      console.log('🔄 [App] Loading data...')
      const decs = await fetchDecorations()
      console.log(`✅ [App] Loaded ${decs.length} decorations`)
      setDecorations(decs)
      setLoading(false)
    } catch (error) {
      console.error('❌ [App] Error loading data:', error)
      setLoading(false)
    }
  }

  // Подсчёт статистики
  const stats = useMemo(() => {
    const lights = decorations.filter(d => d.type?.toLowerCase() === 'light').length
    const balls = decorations.filter(d => d.type?.toLowerCase() === 'ball').length
    const candles = decorations.filter(d => d.type?.toLowerCase() === 'candle').length
    const gifts = decorations.filter(d => d.type?.toLowerCase() === 'gift').length
    const total = decorations.length
    return { lights, balls, candles, gifts, total }
  }, [decorations])

  // Позиции лампочек из JSON файла
  const [lightPositions, setLightPositions] = useState<Position[]>([])
  
  // Ref для фонового изображения ёлки
  const treeImageRef = useRef<HTMLImageElement>(null)
  
  // Состояние для размеров и позиции реального изображения на экране
  const [imageBounds, setImageBounds] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)

  useEffect(() => {
    fetch('/light-positions.json')
      .then(res => res.json())
      .then(data => setLightPositions(data))
      .catch(() => {
        // Fallback позиции из маски заказчика (512×1024)
        setLightPositions([
          {"x":318,"y":122},{"x":810,"y":139},{"x":780,"y":287},{"x":750,"y":332},
          {"x":403,"y":406},{"x":455,"y":424},{"x":486,"y":431},{"x":516,"y":438},
          {"x":546,"y":441},{"x":576,"y":448},{"x":606,"y":451},{"x":364,"y":473},
          {"x":395,"y":482},{"x":425,"y":488},{"x":446,"y":491},{"x":479,"y":500},
          {"x":518,"y":505},{"x":550,"y":508},{"x":587,"y":515},{"x":622,"y":517},
          {"x":661,"y":517},{"x":311,"y":554},{"x":335,"y":564},{"x":371,"y":570},
          {"x":402,"y":575},{"x":428,"y":581},{"x":456,"y":585},{"x":485,"y":588},
          {"x":511,"y":591},{"x":539,"y":594},{"x":567,"y":597},{"x":595,"y":600},
          {"x":631,"y":599},{"x":663,"y":604},{"x":691,"y":604},{"x":719,"y":604},
          {"x":739,"y":601},{"x":231,"y":642},{"x":256,"y":650},{"x":284,"y":657},
          {"x":321,"y":665},{"x":360,"y":670},{"x":401,"y":675},{"x":433,"y":680},
          {"x":464,"y":684},{"x":493,"y":686},{"x":524,"y":689},{"x":555,"y":692},
          {"x":587,"y":695},{"x":622,"y":697},{"x":657,"y":700},{"x":690,"y":700},
          {"x":718,"y":700},{"x":746,"y":697},{"x":772,"y":695},{"x":801,"y":675}
        ])
      })
  }, [])

//добавляем шарики
  const [ballPositions, setBallPositions] = useState<Position[]>([])

  useEffect(() => {
    fetch('/ball-positions.json')
      .then(res => res.json())
      .then(data => setBallPositions(data))
      .catch(() => setBallPositions([]))
  }, [])


  // Вычисление реальных размеров и позиции изображения на экране
  // Вычисление реальных видимых границ картинки при object-fit: contain
useEffect(() => {
  const updateImageBounds = () => {
    const img = treeImageRef.current;
    if (!img) return;

    const container = img.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    if (!naturalWidth || !naturalHeight) return;

    const containerW = containerRect.width;
    const containerH = containerRect.height;

    const scale = Math.min(
      containerW / naturalWidth,
      containerH / naturalHeight
    );

    const displayWidth = naturalWidth * scale;
    const displayHeight = naturalHeight * scale;

    const offsetLeft = (containerW - displayWidth) / 2;
    const offsetTop = (containerH - displayHeight) / 2;

    setImageBounds({
      left: offsetLeft,
      top: offsetTop,
      width: displayWidth,
      height: displayHeight
    });
  };

  updateImageBounds();
  window.addEventListener("resize", updateImageBounds);
  treeImageRef.current?.addEventListener("load", updateImageBounds);

  return () => {
    window.removeEventListener("resize", updateImageBounds);
    treeImageRef.current?.removeEventListener("load", updateImageBounds);
  };
}, []);


  // Случайные цвета и задержки для каждого огонька (стабильные при каждом рендере)
  const lightColors = useMemo(() => {
    return lightPositions.map(() => 
      LIGHT_COLORS[Math.floor(Math.random() * LIGHT_COLORS.length)]
    )
  }, [lightPositions])

  // Случайные задержки анимации для эффекта волн
  const lightDelays = useMemo(() => {
    return lightPositions.map(() => Math.random() * 2)
  }, [lightPositions])

  const lightScreenPositions = useMemo(() => {
    if (lightPositions.length === 0) return [];
  
    const SCALE_X = 512 / 1024; // масштабируем только по ширине
  
    // реальные позиции из JSON
    const positions = lightPositions.map(pos => ({
      screenX: pos.x * SCALE_X + 0,
      screenY: pos.y * SCALE_X + 0
    }));
  
    
  
    return positions;
  }, [lightPositions]);
  
  
  

  // Генерация позиций для украшений (шарики, свечи, подарки)
  const decorationPositions = useMemo(() => {
    const positions: Map<number, Position> = new Map()
    decorations.forEach((dec, index) => {
      if (dec.type?.toLowerCase() !== 'light' && !positions.has(dec.id || index)) {
        // Случайные позиции на ветках
        positions.set(dec.id || index, {
          x: 80 + (index % 5) * 40 + Math.random() * 20,
          y: 150 + Math.floor(index / 5) * 60 + Math.random() * 30
        })
      }
    })
    return positions
  }, [decorations])

  // Генерация QR-кода в JSON формате для PayCash
  const getQRCodeData = (type: ModalType): string => {
    const baseData = {
      symbol: "MLNK",
      address: "malinkatrees",
      precision: 6,
      contract: "swap.pcash",
      protocol: "ScanProtocol",
      action: "transfer",
      memo: "",
      amount: 0
    }
    
    switch (type) {
      case 'light':
        return JSON.stringify({
          ...baseData,
          amount: 1.000000,
          memo: ""
        })
      case 'ball':
        return JSON.stringify({
          ...baseData,
          amount: 10.000000,
          memo: ""
        })
      case 'candle':
        return JSON.stringify({
          ...baseData,
          amount: 100.000000,
          memo: candleText.trim().substring(0, 200) || ""
        })
      case 'gift':
        return JSON.stringify({
          ...baseData,
          amount: 1000.000000,
          memo: giftUrl.trim() || ""
        })
      default:
        return ''
    }
  }

  const handleOpenModal = (type: ModalType) => {
    setModalType(type)
    setWaitingForPayment(false)
    setShowDonatePanel(false)
    if (type === 'candle') setCandleText('')
    if (type === 'gift') setGiftUrl('')
  }

  const handlePaymentDone = () => {
    setWaitingForPayment(true)
    setModalType(null)
    loadData()
  }

  const handleCloseModal = () => {
    setModalType(null)
    setWaitingForPayment(false)
  }

  // Лог последних действий (последние 20 украшений)
  const recentLog = useMemo(() => {
    return decorations
      .slice()
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 20)
  }, [decorations])

  return (
<div className="fixed inset-0 flex items-center justify-center bg-black overflow-hidden">
    <div className="relative w-full h-full max-w-lg mx-auto" style={{ aspectRatio: '512 / 1024' }}>
      {/* Вся твоя ёлка внутри */}
      {/* Фоновое изображение ёлки на весь экран */}
      <img 
        ref={treeImageRef}
        src="/tree-base.png" 
        alt="Christmas Tree" 
        className="absolute inset-0 w-full h-full"
        style={{ 
          width: '512px',
          height: 'auto', // 1024 или auto, если хочешь, чтобы сохранялся ratio
          objectFit: 'cover', // или 'contain', если хочешь видимую середину
          objectPosition: 'center top', // центр по ширине, сверху по высоте
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1
        }}
      />


      {/* Огоньки - показываем столько, сколько донатов типа 'light', используя точные позиции из маски заказчика */}
      {(() => {
        const lightCount = decorations.filter(d => d.type?.toLowerCase() === 'light').length
        if (lightScreenPositions.length === 0) return null
        
        return Array.from({ length: lightCount }, (_, i) => {
          const screenPos = lightScreenPositions[i % lightScreenPositions.length]
          if (!screenPos) return null
          const color = lightColors[i % lightColors.length] || LIGHT_COLORS[0]
          const delay = lightDelays[i % lightDelays.length] || 0
          
          return (
            <div
              key={`light-${i}`}
              className="light-bulb"
              style={{
                position: 'absolute',
                left: `${screenPos.screenX}px`,
                top: `${screenPos.screenY}px`,
                backgroundColor: color,
                transform: 'translate(-50%, -50%)',
                zIndex: 15,
                animationDelay: `${delay}s`,
                boxShadow: `0 0 8px ${color}, 0 0 12px ${color}, 0 0 16px ${color}`
              }}
            />
          )
        })
      })()}
      
       {/* Шарики — теперь дети ёлки, не двигаются при скролле */}
       <div className="absolute inset-0 pointer-events-none z-20">
        {(() => {
          const ballCount = decorations.filter(d => d.type?.toLowerCase() === 'ball').length
          if (!imageBounds || ballPositions.length === 0 || ballCount === 0) return null

          //const SCALE_X = imageBounds.width / 1024
          //const SCALE_Y = imageBounds.height / 2048
          const SPREAD = 1.1  // ← меняй это число: 1.05 = +5% ширины, 1.10 = +10%, 1.00 = без изменений
          const SPREADY = 1.071  // ← меняй это число: 1.05 = +5% ширины, 1.10 = +10%, 1.00 = без изменений


          return Array.from({ length: ballCount }, (_, i) => {
            const pos = ballPositions[i % ballPositions.length]
            const ball = decorations.filter(d => d.type === 'ball')[i]

            const baseRelX = pos.x / 2
            const baseRelY = pos.y / 2
            //const screenX = (pos.x * SCALE_X)+1
            //const screenY = (pos.y * SCALE_Y)+50

            //const screenX = pos.x/2
            //const screenY = pos.y/1.6-34
            
            const screenX = 0.5 + (baseRelX - 0.5) * SPREAD-30
            const screenY = 0.5 + (baseRelY - 0.5) * SPREADY-20  // высоту не трогаем

            //console.log(`Шарик ${i + 1}: original (${pos.x}, ${pos.y}) → rendered (${screenX.toFixed(3)}px, ${screenY.toFixed(3)}px)`)
            return (
              <div
                key={`ball-${ball?.id || i}`}
                className="group absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-opacity"
                style={{
                  left: `${screenX}px`,
                  top: `${screenY}px`,
                }}
              >
                <img
                  src="/malinka-ball.svg"
                  alt="Шарик"
                  className="w-9 h-10 drop-shadow-2xl"
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100  transition-opacity pointer-events-none">
                  <div className="bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-lg shadow-lg whitespace-nowrap">
                    {ball?.username || 'Аноним'}
                  </div>
                </div>
              </div>
            )
          })
        })()}
      </div>
      </div>
      
      {/* Свечи с текстом */}
      {decorations
        .filter(d => d.type?.toLowerCase() === 'candle')
        .map((dec, i) => {
          const pos = decorationPositions.get(dec.id || i)
          if (!pos) return null
          return (
            <div
              key={`candle-${dec.id || i}`}
              className="absolute group"
              style={{
                left: `${(pos.x / 320) * 100}%`,
                top: `${(pos.y / 400) * 100}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 20
              }}
            >
              {/* Свеча */}
              <svg width="8" height="12" className="mb-1">
                <rect x="2" y="0" width="4" height="10" fill="#fff" opacity="0.9"/>
                <circle cx="4" cy="0" r="2" fill="#ffaa00" className="animate-pulse"/>
              </svg>
              {/* Tooltip с именем и текстом - золотая табличка */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <div className="bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded shadow-lg border border-yellow-600 max-w-[150px] text-center">
                  <div>{dec.username || dec.from_account}</div>
                  {dec.text && <div className="text-xs mt-1">{dec.text}</div>}
                </div>
              </div>
            </div>
          )
        })}
      
      {/* Гифки - полноразмерные */}
      {decorations
        .filter(d => d.type?.toLowerCase() === 'gift' && d.image_url)
        .map((dec, i) => {
          const pos = decorationPositions.get(dec.id || i)
          if (!pos) return null
          return (
            <img
              key={`gift-${dec.id || i}`}
              src={dec.image_url}
              alt="Gift"
              className="gift-gif absolute"
              style={{
                left: `${(pos.x / 320) * 100}%`,
                top: `${(pos.y / 400) * 100}%`,
                width: '80px',
                height: '80px',
                transform: 'translate(-50%, -50%)',
                zIndex: 30
              }}
            />
          )
        })}
      
      {/* Звезда - прозрачная по умолчанию */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2"
        style={{
          opacity: decorations.some(d => d.type?.toLowerCase() === 'star') ? 1 : 0,
          transition: 'opacity 0.5s',
          zIndex: 25
        }}
      >
        <div className="text-4xl">⭐</div>
        {decorations.some(d => d.type?.toLowerCase() === 'star') && (
          <div className="absolute inset-0 animate-blink" style={{
            filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 1))',
            color: '#ffd700'
          }}>
            ⭐
          </div>
        )}
      </div>

      {/* Кнопка "Украсить ёлку" внизу (поднята выше) */}
      <div className="absolute left-1/2 -translate-x-1/2 z-40 w-full px-4" style={{ bottom: '16px' }}>
        {!showDonatePanel ? (
          <button
            onClick={() => setShowDonatePanel(true)}
            className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold py-4 px-8 rounded-full text-xl shadow-2xl hover:scale-105 transition"
          >
            🎄 Украсить ёлку
          </button>
        ) : (
          <div className="bg-black/80 backdrop-blur-sm rounded-2xl p-4 space-y-2">
            {/* Кнопки доната */}
            <button 
              onClick={() => handleOpenModal('light')}
              className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold py-3 px-6 rounded-full text-lg shadow-xl hover:scale-105 transition"
            >
              💡 Огонёк (1 MLNK)
            </button>
            
            <button 
              onClick={() => handleOpenModal('ball')}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-3 px-6 rounded-full text-lg shadow-xl hover:scale-105 transition"
            >
              🎈 Шарик (10 MLNK)
            </button>
            
            <button 
              onClick={() => handleOpenModal('candle')}
              className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 text-white font-bold py-3 px-6 rounded-full text-lg shadow-xl hover:scale-105 transition"
            >
              🕯️ Свеча (100 MLNK)
            </button>
            
            <button 
              onClick={() => handleOpenModal('gift')}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-3 px-6 rounded-full text-lg shadow-xl hover:scale-105 transition"
            >
              🎁 Подарок (1000 MLNK)
            </button>

            {/* Кнопка открытия лога */}
            <button
              onClick={() => setShowLog(true)}
              className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded-full text-sm hover:bg-gray-600 transition"
            >
              📜 Лог действий ({recentLog.length})
            </button>

            {/* Кнопка закрытия панели */}
            <button
              onClick={() => setShowDonatePanel(false)}
              className="w-full text-gray-300 text-sm py-2 hover:text-white transition"
            >
              Скрыть
            </button>
          </div>
        )}
      </div>

      {/* Статус ожидания оплаты с таймером */}
      {waitingForPayment && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl p-8 text-center max-w-sm mx-4 border-2 border-yellow-500/50 shadow-2xl">
            <div className="animate-spin mb-4">
              <Sparkles className="w-16 h-16 text-yellow-400 mx-auto" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2 animate-pulse">
              Ожидаем подтверждения...
            </h3>
            <div className="text-6xl font-bold text-yellow-400 mb-4">
              {countdown}
            </div>
            <p className="text-pink-200 mb-2">Обычно это занимает 10–30 секунд</p>
            <p className="text-yellow-300 text-sm mb-4">
              Автообновление каждые 5 секунд
            </p>
            <button
              onClick={() => {
                setWaitingForPayment(false)
                loadData()
              }}
              className="mt-4 text-gray-300 hover:text-white underline text-sm transition"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Модалка с QR-кодом */}
      {modalType && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-3xl p-8 max-w-md w-full relative border-2 border-yellow-500/30 shadow-2xl">
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-white/70 hover:text-white transition"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-bold text-white mb-2 text-center">
              {modalType === 'light' && '💡 Зажечь огонёк'}
              {modalType === 'ball' && '🎈 Повесить шарик'}
              {modalType === 'candle' && '🕯️ Поставить свечу'}
              {modalType === 'gift' && '🎁 Подарить гифку'}
            </h2>
            
            <p className="text-pink-300 text-center mb-6">
              {modalType === 'light' && '1.000000 MLNK'}
              {modalType === 'ball' && '10.000000 MLNK'}
              {modalType === 'candle' && '100.000000 MLNK'}
              {modalType === 'gift' && '1000.000000 MLNK'}
            </p>

            {modalType === 'candle' && (
              <div className="mb-4">
                <input
                  type="text"
                  value={candleText}
                  onChange={(e) => setCandleText(e.target.value)}
                  placeholder="Введите пожелание (до 200 символов)"
                  maxLength={200}
                  className="w-full bg-black/30 border border-pink-500/50 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-pink-500"
                />
                <p className="text-xs text-gray-400 mt-1">{candleText.length}/200</p>
              </div>
            )}

            {modalType === 'gift' && (
              <div className="mb-4">
                <input
                  type="url"
                  value={giftUrl}
                  onChange={(e) => setGiftUrl(e.target.value)}
                  placeholder="https://ссылка_на_гифку.gif"
                  className="w-full bg-black/30 border border-green-500/50 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                />
                <p className="text-xs text-gray-400 mt-1">Поддерживаются .gif, .png, .jpg</p>
              </div>
            )}

            <div className="flex justify-center mb-6">
              <div className="bg-white p-4 rounded-2xl shadow-2xl relative">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-orange-400/20 rounded-2xl animate-pulse"></div>
                <QRCodeSVG
                  value={getQRCodeData(modalType)}
                  size={256}
                  level="H"
                  includeMargin={true}
                  fgColor="#000000"
                  className="relative z-10"
                />
              </div>
            </div>

            <p className="text-center text-yellow-300 mb-4 text-sm">
              Сканируй в PayCash / Anchor
            </p>

            <div className="bg-black/40 rounded-lg p-4 mb-6 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Кому:</span>
                <span className="text-white font-mono">malinkatrees</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Сумма:</span>
                <span className="text-pink-300 font-bold">
                  {modalType === 'light' && '1.000000 MLNK'}
                  {modalType === 'ball' && '10.000000 MLNK'}
                  {modalType === 'candle' && '100.000000 MLNK'}
                  {modalType === 'gift' && '1000.000000 MLNK'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Memo:</span>
                <span className="text-yellow-300 font-mono text-xs break-all text-right">
                  {modalType === 'light' && '(пусто)'}
                  {modalType === 'ball' && '(пусто)'}
                  {modalType === 'candle' && (candleText.trim() ? candleText.trim().substring(0, 50) + (candleText.length > 50 ? '...' : '') : '(пусто)')}
                  {modalType === 'gift' && (giftUrl.trim() ? giftUrl.trim().substring(0, 30) + (giftUrl.length > 30 ? '...' : '') : '(пусто)')}
                </span>
              </div>
            </div>

            <button
              onClick={handlePaymentDone}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-4 px-6 rounded-full text-lg shadow-2xl hover:scale-105 transition animate-pulse"
            >
              ✅ Готово, оплатил!
            </button>
          </div>
        </div>
      )}

      {/* Лог действий - на весь экран */}
      {showLog && (
        <div className="fixed inset-0 bg-black/95 flex flex-col z-50">
          <div className="flex justify-between items-center p-4 border-b border-yellow-500/30">
            <h2 className="text-2xl font-bold text-white">📜 Лог действий</h2>
            <button
              onClick={() => setShowLog(false)}
              className="text-white/70 hover:text-white transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {recentLog.length === 0 ? (
              <p className="text-gray-400 text-center">Пока нет действий</p>
            ) : (
              recentLog.map((dec, i) => (
                <div
                  key={`log-${dec.id || i}`}
                  className="bg-black/40 rounded-lg p-3 text-sm"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-yellow-400 font-bold">
                        {dec.type === 'light' && '💡 Огонёк'}
                        {dec.type === 'ball' && '🎈 Шарик'}
                        {dec.type === 'candle' && '🕯️ Свеча'}
                        {dec.type === 'gift' && '🎁 Подарок'}
                      </div>
                      <div className="text-white mt-1">
                        От: {dec.from_account}
                      </div>
                      {dec.username && (
                        <div className="text-gray-300 text-xs mt-1">
                          Имя: {dec.username}
                        </div>
                      )}
                      {dec.text && (
                        <div className="text-gray-300 text-xs mt-1">
                          Пожелание: {dec.text}
                        </div>
                      )}
                      <div className="text-pink-300 text-xs mt-1">
                        Сумма: {dec.amount}
                      </div>
                    </div>
                    <div className="text-gray-400 text-xs">
                      {dec.created_at ? new Date(dec.created_at).toLocaleString('ru-RU') : ''}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Статистика вверху */}
      {!loading && (
        <div className="absolute top-4 left-4 right-4 z-30 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-center">
          <p className="text-pink-300 text-sm">
            Огоньков: {stats.lights} • Шариков: {stats.balls} • Свечей: {stats.candles} • Подарков: {stats.gifts}
          </p>
          <p className="text-pink-200 text-xs mt-1">Всего: {stats.total} украшений</p>
        </div>
      )}
    </div>
  )
}
