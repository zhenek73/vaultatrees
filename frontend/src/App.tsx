import { useEffect, useState, useMemo, useRef, Suspense, lazy, type ChangeEvent } from 'react'
import { Sparkles, X } from 'lucide-react'
import { fetchDecorations, fetchTopDonors } from './api'
import { Decoration, TopDonor } from './types'
import { getSupabaseClient } from './api'
import { useWallet } from './wallet/WalletContext'
import { Name, Asset } from '@wharfkit/antelope'

const Snowfall = lazy(() => import('./components/Snowfall'))

interface Position {
  x: number
  y: number
}

type ModalType = 'light' | 'ball' | 'envelope' | 'star' | null

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
  // Wallet context
  const { session, isLoading: walletLoading, login, logout, switchAccount, account } = useWallet()

  //const [decorations, setDecorations] = useState<Decoration[]>([])

  const [decorations, setDecorations] = useState<Decoration[]>(() => {
    /* Для тестирования 
      const testLights = Array.from({ length: 300 }, (_, i): Decoration => ({
        id: -i - 1,
        type: 'light',
        from_account: 'testuser',
        username: `Тестер #${i + 1}`,
        amount: '1',
        created_at: new Date(Date.now() - i * 1000).toISOString(),
        tx_id: `test-tx-${i}`
      }))
  
      const testBalls = Array.from({ length: 66 }, (_, i): Decoration => ({
        id: -1000 - i,
        type: 'ball',
        from_account: 'testuser',
        username: `Шарик #${i + 1}`,
        amount: '10',
        created_at: new Date(Date.now() - i * 1000).toISOString(),
        tx_id: `test-ball-${i}`
      }))

      const testEnvelopes = Array.from({ length: 18 }, (_, i): Decoration => ({
        id: -2000 - i,
        type: 'candle',
        from_account: 'testuser',
        username: `Отправитель #${i + 1}`,
        text: `Текст открытки номер ${i + 1} с пожеланиями`,
        amount: '100',
        created_at: new Date(Date.now() - i * 1000).toISOString(),
        tx_id: `test-envelope-${i}`
      }))

   //   return [...testLights, ...testBalls, ...testEnvelopes]
   */
    return []  // пусто — реальные данные будут загружаться из бэкенда
  })

  const [loading, setLoading] = useState(true)
  const [modalType, setModalType] = useState<ModalType>(null)
  const [waitingForPayment, setWaitingForPayment] = useState(false)
  const [countdown, setCountdown] = useState(6)
  const [envelopeText, setenvelopeText] = useState('')
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false)
  const [showDonatePanel, setShowDonatePanel] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [logTab, setLogTab] = useState<'actions' | 'donors'>('actions')
  const [topDonors, setTopDonors] = useState<TopDonor[]>([])
  const [timeLeft, setTimeLeft] = useState('')
  const [bidAmount, setBidAmount] = useState('')
  const [bidError, setBidError] = useState('')
  const [burstCount, setBurstCount] = useState(0)  // обнуляется при перезагрузке
  const [showSalute, setShowSalute] = useState(false)
  const [auctionEnded, setAuctionEnded] = useState(false)
  const [localLights, setLocalLights] = useState<number[]>([])      // индексы локальных огоньков
  const [localBalls, setLocalBalls] = useState<number[]>([])       // индексы локальных шариков
  const [localEnvelopes, setLocalEnvelopes] = useState<number[]>([]) // индексы локальных открыток
  const [showBurstCounter, setShowBurstCounter] = useState(false)  // видимость счётчика снежинок
  // Vaulta native token A, contract core.vaulta (2025)
  // Removed token selection - always use A token
  const [isTransacting, setIsTransacting] = useState(false)  // состояние отправки транзакции

  // Обработка лопания снежинки
  const handleBurst = () => {
    const newCount = burstCount + 1
    setBurstCount(newCount)
    setShowBurstCounter(true) // Показываем счётчик при лопании
    
    // Каждая лопнувшая снежинка → зажигает новый огонёк (следующий свободный)
    setLocalLights(prev => {
      const nextIndex = prev.length
      if (nextIndex < lightPositions.length) return [...prev, nextIndex]
      return prev
    })
    
    // Каждые 5 лопнувших снежинок → +1 локальный шарик
    if (newCount % 5 === 0) {
      setLocalBalls(prev => {
        const nextIndex = prev.length
        if (nextIndex < ballPositions.length) return [...prev, nextIndex]
        return prev
      })
    }
    
    // Каждые 20 лопнувших снежинок → +1 локальная открытка
    if (newCount % 20 === 0) {
      setLocalEnvelopes(prev => {
        const nextIndex = prev.length
        if (nextIndex < envelopePositions.length) return [...prev, nextIndex]
        return prev
      })
    }
    
    // Салют каждые 20 лопнувших снежинок
    if (newCount % 20 === 0) {
      // Салют - GIF + звук
      setShowSalute(true)
      try {
        new Audio('/firework.mp3').play().catch(() => console.log('firework'))
      } catch {
        console.log('firework')
      }
      setTimeout(() => {
        setShowSalute(false)
      }, 3000)
    }
  }

  // Автоматическое скрытие счётчика через 3 секунды после последнего лопания
  useEffect(() => {
    if (showBurstCounter) {
      const timer = setTimeout(() => {
        setShowBurstCounter(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [burstCount, showBurstCounter])

  // Окно ожидания с таймером обратного отсчета
  useEffect(() => {
    if (waitingForPayment) {
      setCountdown(6)
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval)
            setWaitingForPayment(false)
            // Данные обновятся автоматически через Realtime
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => {
        clearInterval(countdownInterval)
      }
    }
  }, [waitingForPayment])

  // Загрузка данных при монтировании и Realtime подписка
  useEffect(() => {
    // Начальная загрузка данных
    loadData()
    
    // Подписка на Supabase Realtime для мгновенных обновлений
    let channel: any = null
    
    const setupRealtime = async () => {
      const supabase = await getSupabaseClient()
      if (!supabase) {
        console.warn('⚠️ [App] Supabase client not available, Realtime disabled')
        return
      }

      // Правильная подписка на изменения в БД (только новые INSERT)
      channel = supabase
        .channel('decorations-db-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'decorations'
          },
          (payload: any) => {
            console.log('📡 [Realtime] New decoration inserted:', payload.new)
            const newDecoration = payload.new as Decoration

            const newDec = { ...newDecoration, createdAt: Date.now() }

            setDecorations(prev => {
              // Защита от дубликатов по id
              if (prev.some(d => d.id === newDec.id)) {
                console.log('⚠️ [Realtime] Duplicate ignored')
                return prev
              }

              console.log('✨ [Realtime] Adding new decoration')
              return [newDec, ...prev]
            })
          }
        )
        .subscribe((status: string) => {
          console.log('[Realtime] Subscription status:', status)
          if (status === 'SUBSCRIBED') {
            console.log('✅ [Realtime] Connected to database changes')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ [Realtime] Channel error — проверь лимиты Supabase')
          }
        })
    }
    
    setupRealtime()
    
    return () => {
      if (channel) {
        getSupabaseClient().then((client: any) => {
          if (client) {
            client.removeChannel(channel!)
            console.log('🔌 [Realtime] Unsubscribed from decorations channel')
          }
        })
      }
    }
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
    const envelopes = decorations.filter(d => d.type?.toLowerCase() === 'candle' || d.type?.toLowerCase() === 'envelope').length
    const total = decorations.length
    
    console.log('Current decorations for stats:', decorations)
    console.log('Stats calculated:', { lights, balls, envelopes, total })
    
    return { lights, balls, envelopes, total }
  }, [decorations])


  // Расчёт лидирующей ставки на звезду
  const starBids = useMemo(() => {
    const bids = decorations
      .filter(d => d.type?.toLowerCase() === 'star')
      .sort((a, b) => {
        const amtA = typeof a.amount === 'number' ? a.amount : parseFloat(a.amount || '0')
        const amtB = typeof b.amount === 'number' ? b.amount : parseFloat(b.amount || '0')
        return amtB - amtA
      })
    
    // Убираем дубли по сумме, оставляем только максимальную
    const uniqueBids = []
    const seenAmounts = new Set()
    for (const bid of bids) {
      const amt = typeof bid.amount === 'number' ? bid.amount : parseFloat(bid.amount || '0')
      if (!seenAmounts.has(amt)) {
        seenAmounts.add(amt)
        uniqueBids.push(bid)
      }
    }
    return uniqueBids
  }, [decorations])

  const currentBid = starBids.length > 0 ? (typeof starBids[0].amount === 'number' ? starBids[0].amount : parseFloat(starBids[0].amount || '0')) : 1  // минимум 1 A
  const minBid = currentBid + 0.0001

  // Обработчик изменения ставки
  const handleBidChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setBidAmount(value)
    if (value && parseFloat(value) <= currentBid) {
      setBidError(`Amount must be higher than current bid (${currentBid.toFixed(4)} A)`)
    } else {
      setBidError('')
    }
  }

  // Таймер обратного отсчёта до конца аукциона
  useEffect(() => {
    const auctionEnd = new Date('2025-12-29T23:59:59')
    const updateTimer = () => {
      const now = new Date()
      const diff = auctionEnd.getTime() - now.getTime()
      if (diff <= 0) {
        setTimeLeft('Auction ended')
        setAuctionEnded(true)
        return
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`)
    }
    updateTimer() // Вызываем сразу для немедленного отображения
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [])

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

  // Загрузка позиций открыток (конвертов)
  const [envelopePositions, setEnvelopePositions] = useState<Position[]>([])

  useEffect(() => {
    fetch('/envelope-positions.json')
      .then(res => res.json())
      .then(data => setEnvelopePositions(data))
      .catch(() => setEnvelopePositions([]))
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

  
  
  

  // Note: decorationPositions removed - balls and candles use fixed positions from JSON files

  // Create transaction action for Wharfkit
  const createTransferAction = async (type: ModalType) => {
    if (!session) {
      throw new Error('Wallet not connected')
    }

    // Vaulta native token A, contract core.vaulta (2025)
    const recipient = Name.from('newyeartrees')
    const contract = Name.from('core.vaulta')  // Always use Vaulta A token
    const symbol = 'A'  // Vaulta native token
    let amount = 0
    let memo = ""
    
    switch (type) {
      case 'light':
        amount = 0.2
        memo = ""
        break
      case 'ball':
        amount = 2
        memo = ""
        break
      case 'envelope':
        amount = 20
        memo = envelopeText.trim().substring(0, 200) || ""
        break
      case 'star':
        amount = parseFloat(bidAmount) || minBid
        memo = "star"
        break
      default:
        throw new Error('Invalid decoration type')
    }

    // Create asset with proper format: "amount symbol" (Vaulta A token, 4 decimals)
    const quantity = Asset.from(`${amount.toFixed(4)} ${symbol}`)

    return {
      account: contract,
      name: Name.from('transfer'),
      authorization: [session.permissionLevel],
      data: {
        from: session.actor,
        to: recipient,
        quantity: quantity,
        memo: memo
      }
    }
  }

  const handleOpenModal = (type: ModalType) => {
    setModalType(type)
    setWaitingForPayment(false)
    setShowDonatePanel(false)
    // Vaulta native token A always used
    if (type === 'envelope') setenvelopeText('')
    if (type === 'star') {
      setBidAmount('')
      setBidError('')
    }
  }

  const handlePaymentDone = async () => {
    if (!session || !modalType) {
      return
    }

    try {
      setIsTransacting(true)
      setWaitingForPayment(true)
      setIsPaymentSuccess(false) // Сброс состояния успеха

      const action = await createTransferAction(modalType)

      // ===== WHARFKIT / ANCHOR DEBUG =====
      if (!session) {
        console.error('❌ session is null')
        alert('Session is null! Please reconnect wallet.')
        setIsTransacting(false)
        setWaitingForPayment(false)
        return
      }

      console.log('=== WHARFKIT DEBUG START ===')
      console.log('walletPlugin.id:', session.walletPlugin?.id)
      console.log('walletPlugin:', session.walletPlugin)
      console.log('actor:', session.actor?.toString())
      console.log('permission:', session.permission?.toString())
      console.log('chainId:', session.chain?.id)
      console.log('action:', JSON.stringify(action, null, 2))
      console.log('=== WHARFKIT DEBUG END ===')
      // ==================================

      // Для Telegram Mini App: если deep link заблокирован, используйте "Sign manually" для QR
      console.log('=== TRANSACT START ===')
      const startedAt = Date.now()

      let result
      try {
        result = await session.transact({ action })
        console.log('TRANSACT RESULT:', result)
      } catch (e) {
        console.error('TRANSACT ERROR:', e)
        throw e
      } finally {
        console.log('TRANSACT FINISHED AFTER', Date.now() - startedAt, 'ms')
        console.log('=== TRANSACT END ===')
      }

      console.log('✅ [App] Transaction successful:', result)
      
      // Показываем сообщение успеха в модалке
      setIsTransacting(false)
      setIsPaymentSuccess(true)
      
      // Wait for transaction to be processed (Vaulta block time + parser delay)
      // Сессия сохраняется после транзакции — пользователь остается залогиненным
      setTimeout(async () => {
        await loadData()  // Force refresh decorations
        setWaitingForPayment(false)
        console.log('✅ [App] Forced reload after transaction')
        console.log('✅ [App] Session still active:', session?.actor?.toString())
        
        // Закрываем модалку после обновления данных
        setTimeout(() => {
          setModalType(null)
          setIsPaymentSuccess(false)
        }, 2000) // Дополнительные 2 секунды для показа сообщения
      }, 5000)  // 5 seconds — показываем сообщение успеха, затем обновляем данные
    } catch (error: any) {
      console.error('❌ [App] Transaction error:', error)
      setWaitingForPayment(false)
      setIsTransacting(false)
      setIsPaymentSuccess(false) // Сброс состояния успеха при ошибке
      
      // User-friendly error messages
      let errorMessage = 'Transaction failed. Please try again.'
      const errorStr = error.message || error.toString() || ''
      if (errorStr.includes('does not exist') || errorStr.includes('not found')) {
        errorMessage = 'Wrong token contract. Using Vaulta A token?'
      } else if (errorStr.includes('insufficient')) {
        errorMessage = 'Insufficient balance. Please check your account.'
      } else if (errorStr) {
        errorMessage = `Transaction failed: ${errorStr}`
      }
      
      alert(errorMessage)
    }
  }

  const handleCloseModal = () => {
    setModalType(null)
    setWaitingForPayment(false)
    setIsPaymentSuccess(false)
  }

  // Все действия (все украшения)
  const allActions = useMemo(() => {
    return decorations.slice()
  }, [decorations])

  // Группировка украшений по дарителям для детальной статистики
  const donorStats = useMemo(() => {
    const stats = new Map<string, {
      lights: number
      balls: number
      envelopes: number
      stars: number
      total: number
    }>()

    decorations.forEach(dec => {
      const account = dec.from_account
      if (!stats.has(account)) {
        stats.set(account, { lights: 0, balls: 0, envelopes: 0, stars: 0, total: 0 })
      }
      const stat = stats.get(account)!
      const type = dec.type?.toLowerCase()
      
      if (type === 'light') {
        stat.lights += Math.floor(typeof dec.amount === 'number' ? dec.amount : parseFloat(dec.amount || '0'))
      } else if (type === 'ball') {
        stat.balls += 1
      } else if (type === 'envelope' || type === 'candle') {
        stat.envelopes += 1
      } else if (type === 'star') {
        stat.stars += 1
      }
      const amountValue = typeof dec.amount === 'number' ? dec.amount : (typeof dec.amount === 'string' ? parseFloat(dec.amount) : 0)
      stat.total += amountValue
    })

    return stats
  }, [decorations])

  // Загрузка топ дарителей
  useEffect(() => {
    if (showLog && logTab === 'donors') {
      fetchTopDonors(50).then(setTopDonors)
    }
  }, [showLog, logTab])

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black overflow-hidden">
      {/* Снег — на весь экран, вне контейнера ёлки, не перерендеривается */}
      <Suspense fallback={null}>
        <Snowfall onBurst={handleBurst} />
      </Suspense>

      <div 
        className="relative w-full max-w-lg mx-auto flex items-center justify-center"
        style={{ 
          height: 'var(--tg-viewport-stable-height, 100vh)',
          aspectRatio: '512 / 1024'
        }}
      >
        {/* Фоновое изображение ёлки на весь экран */}
        <img 
          ref={treeImageRef}
          src="/tree-base.png" 
          alt="Christmas Tree" 
          className="absolute inset-0 w-full h-full object-contain object-center pointer-events-none z-1"
        />


      {/* Огоньки — точное позиционирование через imageBounds */}
      <div className="absolute inset-0 pointer-events-none z-15">
        {(stats.lights + localLights.length) > 0 && imageBounds && lightPositions.length > 0 && (() => {
          // Подсчитываем количество свежих огоньков
          const freshLights = decorations.filter(d => 
            d.type?.toLowerCase() === 'light' && 
            d.createdAt && 
            (Date.now() - d.createdAt) < 60000
          ).length
          
          const totalLights = stats.lights + localLights.length
          const isFullyLit = localLights.length >= 100
          
          return Array.from({ length: totalLights }, (_, i) => {
            const isLocal = i >= stats.lights
            const pos = lightPositions[i % lightPositions.length]
            const color = lightColors[i % lightColors.length] || LIGHT_COLORS[0]
            const delay = lightDelays[i % lightDelays.length] || 0
            
            // Последние N огоньков считаются свежими (где N = количество свежих decorations)
            const isFresh = !isLocal && i >= stats.lights - freshLights && freshLights > 0
            const lightSize = isFullyLit ? (isFresh ? 0.025 : 0.018) : (isFresh ? 0.021 : 0.014)
            const lightBrightness = isFullyLit ? 1.8 : (isFresh ? 1.5 : 1)

            const relX = pos.x / 1024   // оригинал light-positions.json — 512×1024
            const relY = pos.y / 2048

            const screenX = imageBounds.left + relX * imageBounds.width
            const screenY = imageBounds.top + relY * imageBounds.height

            return (
              <div
                key={`light-${i}`}
                className={`absolute transition-all duration-1000 ${isFresh ? 'drop-shadow-glow' : ''}`}
                style={{
                  left: `${screenX}px`,
                  top: `${screenY}px`,
                  width: imageBounds ? `${imageBounds.width * lightSize}px` : (isFresh ? '21px' : '14px'),
                  height: imageBounds ? `${imageBounds.width * lightSize}px` : (isFresh ? '21px' : '14px'),
                  backgroundColor: color,
                  borderRadius: '50%',
                  transform: `translate(-50%, -50%) ${isFresh ? 'scale(1.5)' : 'scale(1)'}`,
                  filter: `brightness(${lightBrightness}) blur(1px)`,
                  boxShadow: `
                    0 0 ${imageBounds ? imageBounds.width * (isFresh ? 0.03 : 0.02) : (isFresh ? 15 : 10)}px ${color},
                    0 0 ${imageBounds ? imageBounds.width * (isFresh ? 0.06 : 0.04) : (isFresh ? 30 : 20)}px ${color},
                    0 0 ${imageBounds ? imageBounds.width * (isFresh ? 0.105 : 0.07) : (isFresh ? 52.5 : 35)}px ${color}80,
                   
                  
                    0 0 ${imageBounds ? imageBounds.width * (isFresh ? 0.18 : 0.12) : (isFresh ? 90 : 60)}px ${color}40,
                  /*   0 0 ${imageBounds ? imageBounds.width * (isFresh ? 0.27 : 0.18) : (isFresh ? 135 : 90)}px ${color}20
                  */`,
                  opacity: isFresh ? 1 : 0.9,
                  // Используем отдельные свойства вместо shorthand animation для избежания конфликта с Tailwind
                  // Убрали animate-pulse из className, так как используем inline стили с animationDelay
                  animationName: isFresh ? 'pulse' : 'none',
                  animationDuration: isFresh ? `${0.8 + Math.random() * 0.8}s` : 'none',
                  animationTimingFunction: 'ease-in-out',
                  animationIterationCount: 'infinite',
                  animationDelay: isFresh ? `${delay}s` : '0s',
                }}
              />
            )
          })
        })()}
      </div>
      
     {/* Balls — точное позиционирование */}
<div className="absolute inset-0 pointer-events-none z-30">
  {(stats.balls + localBalls.length) > 0 && imageBounds && ballPositions.length > 0 && (() => {
    // Vaulta native token A - always use vaulta ball image
    const getBallImage = (): string => {
      // Always use Vaulta ball (A token)
      return '/ball_vaulta.png'
    }
    
    return Array.from({ length: stats.balls + localBalls.length }, (_, i) => {
      const pos = ballPositions[i % ballPositions.length]
      const isLocal = i >= stats.balls
      const ball = isLocal ? null : decorations.filter(d => d.type === 'ball')[i]
      const username = isLocal ? 'Zhenek' : (ball?.username || 'Anonymous')
      // Vaulta native token A always used

      const relX = pos.x / 1024
      const relY = pos.y / 2048
      
      const SPREAD_X = 1.1
      const SPREAD_Y = 1.1
      
      const adjustedRelX = 0.5 + (relX - 0.5) * SPREAD_X
      const adjustedRelY = 0.5 + (relY - 0.5) * SPREAD_Y
      
      const screenX = imageBounds.left + adjustedRelX * imageBounds.width
      const screenY = imageBounds.top + adjustedRelY * imageBounds.height + 13

      const isFresh = !isLocal && ball?.createdAt && (Date.now() - ball.createdAt) < 60000
      const ballImage = getBallImage()

      return (
        <div
          key={`ball-${i}`}
          className={`group absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto hover:animate-wiggle transition-all duration-1000 ${isFresh ? 'animate-bounce-slight drop-shadow-glow' : ''}`}
          style={{
            left: `${screenX}px`,
            top: `${screenY}px`,
            transform: `translate(-50%, -50%) ${isFresh ? 'scale(1.25)' : 'scale(1)'}`,
            zIndex: 30, // базовый z-index
          }}
          // 🎈 ДОБАВЛЯЕМ МАГИЮ ДЛЯ ШАРИКОВ
          onMouseEnter={(e) => {
            e.currentTarget.style.zIndex = '9999'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.zIndex = '30'
          }}
        >
          <img
            src={ballImage}
            alt="Ball"
            style={{
              width: imageBounds ? `${imageBounds.width * (isFresh ? 0.09375 : 0.075)}px` : (isFresh ? '60px' : '48px'),
              height: 'auto',
              filter: isFresh ? 'brightness(1.5) drop-shadow(0 4px 8px rgba(0,0,0,0.5))' : 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))'
            }}
          />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-lg shadow-lg whitespace-nowrap">
              {username}
            </div>
          </div>
        </div>
      )
    })
  })()}
  {/* Открытки (конверты) — фиксированные позиции через imageBounds */}
  {/*объединил шарики и открытки в один слой. пока не ясно чем это грозит если что было так
  
       </div>
    <div className="absolute inset-0 pointer-events-none z-30">
 */}
  {(stats.envelopes + localEnvelopes.length) > 0 && imageBounds && envelopePositions.length > 0 && (
    Array.from({ length: stats.envelopes + localEnvelopes.length }, (_, i) => {
      const pos = envelopePositions[i % envelopePositions.length]
      const isLocal = i >= stats.envelopes
      const envelope = isLocal ? null : decorations.filter(d => d.type?.toLowerCase() === 'candle' || d.type?.toLowerCase() === 'envelope')[i]
      const username = isLocal ? 'Zhenek' : (envelope?.username || envelope?.from_account || 'Аноним')
      const text = isLocal ? 'Здесь могло бы быть Ваше поздравление!😉' : (envelope?.text || null)

      const relX = pos.x / 1024
      const relY = pos.y / 2048

      const screenX = imageBounds.left + relX * imageBounds.width
      const screenY = imageBounds.top + relY * imageBounds.height

      const isFresh = !isLocal && envelope?.createdAt && (Date.now() - envelope.createdAt) < 60000

      return (
        <div
          key={`envelope-${i}`}
          className={`group absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto hover:animate-wiggle transition-all duration-1000 ${isFresh ? 'animate-pulse drop-shadow-glow' : ''}`}
          style={{
            left: `${screenX}px`,
            top: `${screenY}px`,
            transform: `translate(-50%, -50%) ${isFresh ? 'scale(1.5)' : 'scale(1)'}`,
            zIndex: 30, // базовый z-index
          }}
          // 🔥 ДОБАВЛЯЕМ ДИНАМИЧЕСКИЙ z-index через inline стиль
          onMouseEnter={(e) => {
            e.currentTarget.style.zIndex = '9999'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.zIndex = '30'
          }}
        >
          <img
            src="/envelope.png"
            alt="Открытка"
            style={{
              width: imageBounds ? `${imageBounds.width * (isFresh ? 0.075 : 0.05)}px` : (isFresh ? '72px' : '48px'),
              height: 'auto',
              filter: isFresh ? 'brightness(1.5) drop-shadow(0 4px 8px rgba(0,0,0,0.5))' : 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))'
            }}
          />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-yellow-400 text-black text-xs font-bold px-3 py-2 rounded-lg shadow-lg border border-yellow-600 max-w-[200px]">
              <div className="font-semibold">{username}:</div>
              {text && (
                <div className="text-xs mt-1 leading-tight">{text}</div>
              )}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-yellow-400"></div>
          </div>
        </div>
      )
    })
  )}
      </div>
      
      {/* Shining five-pointed star on top */}
      {imageBounds && (
        <div 
          className="group absolute left-1/2 z-45"
          style={{
            top: `${imageBounds.top + imageBounds.height * 0.267}px`,
            transform: 'translateX(calc(-50% - 2px))',
            opacity: auctionEnded || localLights.length >= 100 ? 1 : 0,
            transition: 'opacity 1s ease-in-out',
          }}
        >
          <div 
            className="relative animate-pulse-slow"
            style={{
              width: `${imageBounds.width * 0.15}px`,
              height: `${imageBounds.width * 0.15}px`,
            }}
          >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-300 via-yellow-500 to-amber-600 rounded-full blur-md animate-glow"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
              <path 
                d="M50 0 L61 35 L98 35 L67 57 L76 90 L50 70 L24 90 L33 57 L2 35 L39 35 Z" 
                fill="#FFD700" 
                stroke="#FFAA00" 
                strokeWidth="2"
              />
            </svg>
          </div>
          <div className="absolute inset-0 animate-spin-slow opacity-70">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-12 bg-yellow-400 blur-sm"></div>
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-12 h-1 bg-yellow-400 blur-sm"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-12 h-1 bg-yellow-400 blur-sm"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 w-12 h-1 bg-yellow-400 blur-sm"></div>
          </div>
        </div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100]">
            <div className="bg-yellow-400 text-black text-sm font-bold px-4 py-2 rounded-lg shadow-lg whitespace-nowrap">
              {localLights.length >= 100 && !auctionEnded ? 'Congratulations! You lit the star!' : (starBids.length > 0 ? `${starBids[0].username || starBids[0].from_account} lit the star! Happy New Year!` : 'Winner! Happy New Year!')}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-yellow-400"></div>
          </div>
        </div>
      )}


      {/* Decorate Tree button at bottom */}
      <div className="absolute left-1/2 -translate-x-1/2 z-40 w-full px-4" style={{ bottom: 'max(16px, env(safe-area-inset-bottom, var(--tg-content-safe-area-inset-bottom, 20px)))' }}>
        {!showDonatePanel ? (
          <button
            onClick={() => setShowDonatePanel(true)}
            className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold py-4 px-8 rounded-full text-xl shadow-2xl hover:scale-105 transition"
          >
            🎄 Decorate Tree
          </button>
        ) : (
          <div className="bg-black/80 backdrop-blur-sm rounded-2xl p-4 space-y-2">
            {/* Wallet section - Connect Wallet or Account info */}
            {!session ? (
              <button
                onClick={login}
                disabled={walletLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 px-6 rounded-lg text-lg shadow-xl hover:scale-105 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {walletLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>🔗</span>
                    <span>Connect Wallet</span>
                  </>
                )}
              </button>
            ) : (
              <div className="bg-gradient-to-r from-green-600/30 to-blue-600/30 rounded-lg p-3 border border-green-500/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-sm">✓</span>
                    <span className="text-white text-sm font-bold">Account:</span>
                    <span className="text-yellow-300 text-sm font-mono">{account}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={switchAccount}
                      disabled={walletLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-2 py-1 rounded transition disabled:opacity-50"
                      title="Switch Account"
                    >
                      🔄
                    </button>
                    <button
                      onClick={logout}
                      disabled={walletLoading}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-2 py-1 rounded transition disabled:opacity-50"
                      title="Disconnect"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Decoration buttons */}
            <div className="border-t border-gray-700 pt-2 mt-2 space-y-2">
              <button 
                onClick={() => handleOpenModal('light')}
                disabled={!session || isTransacting}
                className={`w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold py-3 px-6 rounded-full text-lg shadow-xl transition ${
                  !session || isTransacting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
              >
                💡 Light (0.2 A)
              </button>
              
              <button 
                onClick={() => handleOpenModal('ball')}
                disabled={!session || isTransacting}
                className={`w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-3 px-6 rounded-full text-lg shadow-xl transition flex items-center justify-center gap-2 ${
                  !session || isTransacting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
              >
                <img src="/ball_vaulta.png" className="w-7 h-8" alt="Ball" />
                Ball (2 A)
              </button>
              
              <button 
                onClick={() => handleOpenModal('envelope')}
                disabled={!session || isTransacting}
                className={`w-full bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 text-white font-bold py-3 px-6 rounded-full text-lg shadow-xl transition flex items-center justify-center gap-2 ${
                  !session || isTransacting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
              >
                <img src="/envelope.png" className="w-6 h-8" alt="Candle" />
                Postcard (20 A)
              </button>
              
              <button 
                onClick={() => handleOpenModal('star')}
                disabled={!session || auctionEnded || isTransacting}
                className={`w-full text-white font-bold py-3 px-6 rounded-full text-lg shadow-xl transition ${
                  !session || auctionEnded || isTransacting
                    ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                    : 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:scale-105 animate-pulse-slow'
                }`}
              >
                ⭐ Light Star (≥100 A)
              </button>
            </div>

            {/* Log button */}
            <button
              onClick={() => setShowLog(true)}
              className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded-full text-sm hover:bg-gray-600 transition"
            >
              📜 Action Log ({allActions.length})
            </button>

            {/* Hide panel button */}
            <button
              onClick={() => setShowDonatePanel(false)}
              className="w-full text-gray-300 text-sm py-2 hover:text-white transition"
            >
              Hide
            </button>
          </div>
        )}
      </div>

      {/* Статус ожидания оплаты с таймером */}
      {waitingForPayment && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={handleCloseModal}>
          <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl p-6 md:p-8 text-center w-full max-w-md mx-4 md:mx-auto my-8 max-h-full overflow-y-auto border-2 border-yellow-500/50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="animate-spin mb-4">
              <Sparkles className="w-16 h-16 text-yellow-400 mx-auto" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2 animate-pulse">
              {isTransacting ? 'Waiting for Anchor...' : 'Waiting for confirmation...'}
            </h3>
            <div className="text-6xl font-bold text-yellow-400 mb-4">
              {countdown}
            </div>
            <p className="text-pink-200 mb-2">
              {isTransacting ? 'Please confirm transaction in Anchor Wallet' : 'Usually takes 10–30 seconds'}
            </p>
            <p className="text-yellow-300 text-sm mb-4">
              Auto-refresh after transaction
            </p>
            <button
              onClick={() => {
                setWaitingForPayment(false)
                loadData()
              }}
              className="mt-4 text-gray-300 hover:text-white underline text-sm transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Специальная модалка для аукциона звезды */}
      {modalType === 'star' && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={handleCloseModal}>
          <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-3xl p-6 md:p-8 w-full max-w-md mx-4 md:mx-auto my-8 max-h-[90vh] relative border-4 border-yellow-500/70 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleCloseModal} className="absolute top-4 right-4 text-white/70 hover:text-white z-10 transition">
              <X className="w-6 h-6" />
            </button>

            {/* Контент модалки */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {isPaymentSuccess ? (
                // Сообщение успеха с анимацией
                <div className="text-center py-8 animate-fade-in">
                  <div className="text-6xl mb-4 animate-bounce-slight">⭐</div>
                  <h3 className="text-2xl font-bold text-yellow-400 mt-4 mb-2">Thank you!</h3>
                  <p className="text-lg text-white mt-2 mb-4">Your bid has been placed!</p>
                  <p className="text-sm text-gray-400 mt-4 opacity-80">Updating in a few seconds...</p>
                  <div className="mt-6 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-3xl font-bold text-yellow-400 mb-4 text-center">
                    ⭐ Star Auction ⭐
                  </h2>

                  <div className="text-center space-y-4 text-white">
                    <p className="text-lg">Current bid: <span className="text-yellow-400 font-bold">{currentBid.toFixed(4)} A</span></p>
                    <p className="text-pink-300 text-sm">Your bid must be higher</p>
                    <p className="text-2xl font-bold text-yellow-300">{timeLeft}</p>
                    <p className="text-pink-400 text-xs">Losing bids are not refunded</p>
                  </div>

                  {/* Vaulta native token A always used */}

                  <div className="my-6">
                    <input
                      type="number"
                      step="0.0001"
                      value={bidAmount}
                      onChange={handleBidChange}
                      placeholder={`Minimum ${minBid.toFixed(4)} A`}
                      className="w-full bg-black/30 border border-yellow-500/50 rounded-lg px-4 py-3 text-white text-center text-xl focus:outline-none focus:border-yellow-400"
                    />
                    {bidError && <p className="text-red-400 text-sm mt-2 text-center">{bidError}</p>}
                  </div>

                  <div className="bg-black/40 rounded-lg p-4 space-y-2 text-sm mb-6">
                    <div className="flex justify-between"><span className="text-gray-400">To:</span><span className="text-white font-mono">newyeartrees</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Your bid:</span><span className="text-yellow-400 font-bold">{bidAmount ? parseFloat(bidAmount).toFixed(4) : minBid.toFixed(4)} A</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Memo:</span><span className="text-yellow-300">star</span></div>
                  </div>

                  <p className="text-center text-yellow-300 mb-4 text-sm">
                    Confirm transaction in Anchor Wallet
                  </p>
                </>
              )}
            </div>

            {/* Кнопка внизу модалки */}
            {!isPaymentSuccess && (
              <div className="mt-auto pt-4 pb-2">
                <button 
                  onClick={handlePaymentDone} 
                  disabled={!session || !bidAmount || parseFloat(bidAmount) <= currentBid || isTransacting}
                  className={`w-full text-white font-bold py-4 rounded-full text-lg shadow-2xl transition-all duration-300 ${
                    !session || !bidAmount || parseFloat(bidAmount) <= currentBid || isTransacting
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:scale-105 hover:shadow-yellow-500/50'
                  }`}
                >
                  {!session ? 'Connect Wallet First' : !bidAmount || parseFloat(bidAmount) <= currentBid ? 'Enter higher amount' : isTransacting ? 'Processing...' : '✅ Place Bid!'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модалка с QR-кодом */}
      {modalType && modalType !== 'star' && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={handleCloseModal}>
          <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-3xl p-6 md:p-8 w-full max-w-md mx-4 md:mx-auto my-8 max-h-[90vh] relative border-2 border-yellow-500/30 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-white/70 hover:text-white transition z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Контент модалки */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {isPaymentSuccess ? (
                // Сообщение успеха с анимацией
                <div className="text-center py-8 animate-fade-in">
                  <div className="text-6xl mb-4 animate-bounce-slight">✨</div>
                  <h3 className="text-2xl font-bold text-yellow-400 mt-4 mb-2">Thank you!</h3>
                  <p className="text-lg text-white mt-2 mb-4">Your decoration is already on the tree!</p>
                  <p className="text-sm text-gray-400 mt-4 opacity-80">Updating in a few seconds...</p>
                  <div className="mt-6 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white mb-2 text-center">
                    {modalType === 'light' && '💡 Light Up'}
                    {modalType === 'ball' && '🎈 Hang Ball'}
                    {modalType === 'envelope' && '🕯️ Light Candle'}
                  </h2>
                  
                  <p className="text-pink-300 text-center mb-6">
                    {modalType === 'light' && '0.2 A'}
                    {modalType === 'ball' && '2 A'}
                    {modalType === 'envelope' && '20 A'}
                  </p>

                  {/* Vaulta native token A always used */}

                  {modalType === 'envelope' && (
                    <div className="mb-4">
                      <input
                        type="text"
                        value={envelopeText}
                        onChange={(e) => setenvelopeText(e.target.value)}
                        placeholder="Enter candle message (up to 200 characters)"
                        maxLength={200}
                        className="w-full bg-black/30 border border-pink-500/50 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-pink-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">{envelopeText.length}/200</p>
                    </div>
                  )}

                  <div className="bg-black/40 rounded-lg p-4 mb-6 space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">To:</span>
                      <span className="text-white font-mono">newyeartrees</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Amount:</span>
                      <span className="text-pink-300 font-bold">
                        {modalType === 'light' && '0.2'}
                        {modalType === 'ball' && '2'}
                        {modalType === 'envelope' && '20'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Token:</span>
                      <span className="text-yellow-300 font-mono">A</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Memo:</span>
                      <span className="text-yellow-300 font-mono text-xs break-all text-right">
                        {modalType === 'light' && '(empty)'}
                        {modalType === 'ball' && '(empty)'}
                        {modalType === 'envelope' && (envelopeText.trim() ? envelopeText.trim().substring(0, 50) + (envelopeText.length > 50 ? '...' : '') : '(empty)')}
                      </span>
                    </div>
                  </div>

                  <p className="text-center text-yellow-300 mb-4 text-sm">
                    Confirm transaction in Anchor Wallet
                  </p>
                </>
              )}
            </div>

            {/* Кнопка внизу модалки */}
            {!isPaymentSuccess && (
              <div className="mt-auto pt-4 pb-2">
                <button
                  onClick={handlePaymentDone}
                  disabled={!session || isTransacting}
                  className={`w-full text-white font-bold py-4 px-6 rounded-full text-lg shadow-2xl transition-all duration-300 ${
                    !session || isTransacting
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:scale-105 hover:shadow-yellow-500/50'
                  }`}
                >
                  {!session ? 'Connect Wallet First' : isTransacting ? 'Processing...' : '✅ Confirm Transaction'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Лог действий - на весь экран */}
      {showLog && (
        <div className="fixed inset-0 bg-black/95 flex flex-col z-50" onClick={() => setShowLog(false)}>
          <div className="flex justify-between items-center p-4 border-b border-yellow-500/30" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white">
              {logTab === 'actions' ? '📜 Action Log' : '🏆 Top Donors'}
            </h2>
            <button
              onClick={() => setShowLog(false)}
              className="text-white/70 hover:text-white transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Вкладки */}
          <div className="flex border-b border-yellow-500/30" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLogTab('actions')}
              className={`flex-1 py-3 text-center font-bold transition ${
                logTab === 'actions'
                  ? 'bg-yellow-500/20 text-yellow-400 border-b-2 border-yellow-400'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Action Log
            </button>
            <button
              onClick={() => setLogTab('donors')}
              className={`flex-1 py-3 text-center font-bold transition ${
                logTab === 'donors'
                  ? 'bg-yellow-500/20 text-yellow-400 border-b-2 border-yellow-400'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Top Donors
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            {logTab === 'actions' ? (
              allActions.length === 0 ? (
                <p className="text-gray-400 text-center">No actions yet</p>
              ) : (
                allActions.map((dec, i) => (
                  <div
                    key={`log-${i}`}
                    className="bg-black/40 rounded-lg p-3 text-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="text-yellow-400 font-bold">
                          {dec.type === 'light' && `💡 Lit 1 light(s)! Amount: ${dec.amount || '0.2000'} A`}
                          {dec.type === 'ball' && '🎈 Ball'}
                          {(dec.type === 'candle' || dec.type === 'envelope') && '🕯️ Candle'}
                          {dec.type === 'star' && (
                            <>
                              ⭐ {dec.username || dec.from_account} placed a bid to light the star for New Year! 🎉
                              {(typeof dec.amount === 'number' ? dec.amount : parseFloat(dec.amount || '0')) === currentBid && ' (current leader!)'}
                            </>
                          )}
                        </div>
                        <div className="text-white mt-1">
                          From: {dec.from_account}
                        </div>
                        <div className="text-pink-300 text-xs mt-1">
                          Amount: {(() => {
                            const amt = typeof dec.amount === 'number' ? dec.amount : parseFloat(String(dec.amount || '0'))
                            return amt.toFixed(4)
                          })()} A
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : (
              topDonors.length === 0 ? (
                <p className="text-gray-400 text-center">Loading...</p>
              ) : (
                topDonors.map((donor, i) => {
                  // Используем данные из API если есть, иначе fallback на локальную статистику
                  const lightsCount = donor.lights_count ?? donorStats.get(donor.from_account)?.lights ?? 0
                  const ballsCount = donor.balls_count ?? donorStats.get(donor.from_account)?.balls ?? 0
                  const envelopesCount = donor.envelopes_count ?? donorStats.get(donor.from_account)?.envelopes ?? 0
                  const starsCount = donor.stars_count ?? donorStats.get(donor.from_account)?.stars ?? 0
                  const isLeader = starBids.length > 0 && starBids[0].from_account === donor.from_account
                  
                  return (
                    <div
                      key={`donor-${donor.from_account}`}
                      className="bg-black/40 rounded-lg p-4 text-sm"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="text-yellow-400 font-bold text-lg">
                            #{i + 1} {donor.from_account}
                          </div>
                          <div className="text-pink-300 text-xs mt-2 space-y-1">
                            {lightsCount > 0 && (
                              <div>Lit lights: {lightsCount}</div>
                            )}
                            {ballsCount > 0 && (
                              <div>Hung balls: {ballsCount}</div>
                            )}
                            {envelopesCount > 0 && (
                              <div>Sent postcards: {envelopesCount}</div>
                            )}
                            {starsCount > 0 && (
                              <div>{isLeader ? '🏆 ' : ''}Auction bids: {starsCount}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-white font-bold text-lg">
                          {donor.total_amount.toFixed(4)} A
                        </div>
                      </div>
                    </div>
                  )
                })
              )
            )}
          </div>
        </div>
      )}

      {/* Statistics header */}
      {!loading && (
        <div className="absolute top-4 left-4 right-4 z-30 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-center">
          <p className="text-pink-300 text-sm font-bold">
            Vaulta Tree 2026
          </p>
          <p className="text-pink-300 text-xs mt-1">
            Lights: {stats.lights} • Balls: {stats.balls} • Postcards: {stats.envelopes} 
          </p>
          <p className="text-pink-200 text-xs mt-1">
            Total: {stats.lights+stats.balls+stats.envelopes} decoration{stats.lights+stats.balls+stats.envelopes !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Счётчик лопнувших снежинок */}
      {showBurstCounter && burstCount > 0 && (
        <div className="fixed top-4 right-4 bg-yellow-400 text-black font-bold text-2xl px-6 py-3 rounded-full shadow-2xl z-50 animate-pulse transition-opacity duration-1000 opacity-100">
          +{burstCount}
        </div>
      )}

      {/* Салют - GIF */}
      {showSalute && (
        
        <div className="fixed inset-x-0 top-0 flex items-start justify-center pointer-events-none z-50 pt-8">
        
          <img
            src="/iskra.gif"
            alt="Салют"
            className="w-128 h-128 object-contain"
            style={{ animation: 'none' }}
          />
        </div>
      )}
      </div>
    </div>
  )
}
