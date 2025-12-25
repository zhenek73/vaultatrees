import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'
import { Decoration, DecorationType } from './types.js'

const supabase = createClient(config.supabase.url, config.supabase.anonKey)

// Admin клиент для записи (использует service_role key)
const supabaseAdmin = config.supabase.serviceRoleKey 
  ? createClient(config.supabase.url, config.supabase.serviceRoleKey)
  : null

// In-memory кеш обработанных tx_id для снижения Egress трафика
// При старте загружается последние 1000 tx_id из БД
const processedTxCache = new Set<string>()

/**
 * Инициализирует in-memory кеш tx_id при старте парсера.
 * Загружает последние 1000 обработанных tx_id из базы данных.
 * Это позволяет избежать повторных запросов к Supabase для проверки дубликатов.
 */
export async function initTxCache(): Promise<void> {
  try {
    console.log('🔄 [Cache] Loading recent tx_ids into memory...')
    const { data, error } = await supabase
      .from('decorations')
      .select('tx_id')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      console.error('❌ [Cache] Error loading tx_ids: ' + JSON.stringify(error))
      return
    }

    if (data) {
      data.forEach(d => processedTxCache.add(d.tx_id))
      console.log(`✅ [Cache] Loaded ${data.length} tx_ids into cache`)
    }
  } catch (error) {
    console.error('❌ [Cache] Error: ' + String(error))
  }
}

export async function insertDecoration(decoration: Decoration, skipDeduplication: boolean = false): Promise<Decoration | null> {
  try {
    // Нормализация tx_id к строке перед всеми операциями
    const cleanTxId = String(decoration.tx_id || '').trim()
    if (!cleanTxId || cleanTxId === '[object Object]') {
      console.error(`❌ [DB] Invalid tx_id: ${JSON.stringify(decoration.tx_id)}`)
      return null
    }
    
    // ✅ ВРЕМЕННО: если skipDeduplication = true, пропускаем проверку дубликатов
    if (!skipDeduplication) {
      // ✅ Сначала проверяем in-memory кеш (мгновенно, без запроса к Supabase)
      if (processedTxCache.has(cleanTxId)) {
        console.log(`⚠️  [Cache] Transaction ${cleanTxId.substring(0, 8)}... already in cache, skipping`)
        return null
      }

      // ✅ Если нет в кеше, проверяем в базе данных (редкий случай)
      const { data: existing } = await supabase
        .from('decorations')
        .select('id')
        .eq('tx_id', cleanTxId)
        .single()

      if (existing) {
        console.log(`⚠️  [DB] Transaction ${cleanTxId.substring(0, 8)}... found in DB, adding to cache`)
        processedTxCache.add(cleanTxId)
        return null
      }
    } else {
      console.log(`🔄 [DB] FORCE_REPROCESS: skipping deduplication for ${cleanTxId.substring(0, 8)}...`)
    }

    // Принудительно сохраняем type в нижнем регистре и нормализуем tx_id
    const decorationToInsert = {
      ...decoration,
      type: decoration.type.toLowerCase(),
      tx_id: cleanTxId  // Используем нормализованный tx_id
    }
    
    console.log(`💾 [DB] Inserting decoration: type=${decorationToInsert.type}, from=${decorationToInsert.from_account}, tx_id=${cleanTxId.substring(0, 16)}...`)

    // Используем supabaseAdmin для записи (если доступен), иначе обычный supabase
    const client = supabaseAdmin || supabase
    
    const { data, error } = await client
      .from('decorations')
      .upsert(
        decorationToInsert,
        {
          onConflict: 'tx_id',
          ignoreDuplicates: true
        }
      )
      .select()
      .single()

    if (error) {
      console.error('❌ Error inserting decoration: ' + JSON.stringify(error))
      return null
    }

    console.log(`✅ Decoration inserted: ${decoration.type} from ${decoration.from_account}, tx_id=${cleanTxId.substring(0, 16)}...`)
    
    // ✅ Добавляем tx_id в кеш после успешной вставки
    processedTxCache.add(cleanTxId)
    
    return data
  } catch (error) {
    console.error('❌ Database error: ' + String(error))
    return null
  }
}

/**
 * Проверяет, какие из переданных tx_id уже существуют в базе данных.
 * Используется для batch-проверки вместо множественных одиночных запросов.
 * Найденные tx_id автоматически добавляются в in-memory кеш.
 * 
 * @param txIds - Массив tx_id для проверки
 * @returns Set с tx_id, которые уже есть в базе данных
 */
export async function checkExistingTxIds(txIds: string[]): Promise<Set<string>> {
  try {
    if (txIds.length === 0) return new Set()
    
    // Нормализация txIds к массиву чистых строк для Supabase .in() запроса
    const cleanTxIds = txIds
      .map(id => {
        // Преобразуем в строку и убираем пробелы
        const str = String(id).trim()
        // Фильтруем пустые строки и объекты, которые не преобразовались в строку
        return str.length > 0 && str !== '[object Object]' ? str : null
      })
      .filter((id): id is string => id !== null)
    
    if (cleanTxIds.length === 0) {
      console.log(`⚠️  [Batch] All txIds were invalid, skipping check`)
      return new Set()
    }
    
    console.log(`🔍 [Batch] Checking ${cleanTxIds.length} tx_ids in database (from ${txIds.length} raw)...`)
    console.log('[Batch] Cleaned txIds for Supabase:', cleanTxIds.slice(0, 5), cleanTxIds.length > 5 ? '...' : '')
    
    const { data, error } = await supabase
      .from('decorations')
      .select('tx_id')
      .in('tx_id', cleanTxIds)

    if (error) {
      console.error('❌ [Batch] Error checking tx_ids: ' + JSON.stringify(error))
      return new Set()
    }

    const existingSet = new Set(data?.map(d => d.tx_id) || [])
    console.log(`✅ [Batch] Found ${existingSet.size} existing tx_ids`)
    
    // ✅ Добавляем все найденные tx_id в кеш
    existingSet.forEach(txId => processedTxCache.add(txId))
    
    return existingSet
  } catch (error) {
    console.error('❌ [Batch] Error: ' + String(error))
    return new Set()
  }
}

export async function getDecorations(limit: number = 1000): Promise<Decoration[]> {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    console.log(`📊 [DB] Fetching decorations (limit: ${limit}, since: ${thirtyDaysAgo.toISOString()})`)
    const { data, error } = await supabase
      .from('decorations')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ [DB] Error fetching decorations: ' + JSON.stringify(error))
      return []
    }
    console.log(`✅ [DB] Fetched ${data?.length || 0} decorations`)
    return data || []
  } catch (error) {
    console.error('❌ Database error: ' + String(error))
    return []
  }
}

export async function getTopDonors(limit: number = 10): Promise<Array<{ from_account: string; total_amount: number; count: number; lights_count: number; balls_count: number; envelopes_count: number; stars_count: number }>> {
  try {
    console.log(`📊 [DB] Fetching top donors (limit: ${limit})...`)
    const { data, error } = await supabase
      .from('decorations')
      .select('from_account, amount, type')
      .order('created_at', { ascending: false })
      .limit(10000) // Получаем больше данных для агрегации

    if (error) {
      console.error('❌ [DB] Error fetching donors: ' + JSON.stringify(error))
      return []
    }
    
    console.log(`📊 [DB] Processing ${data?.length || 0} donation records...`)

    // Группируем по аккаунту и суммируем с учётом типов украшений
    const donorsMap = new Map<string, { 
      total: number
      count: number
      lights_count: number
      balls_count: number
      envelopes_count: number
      stars_count: number
    }>()
    
    data?.forEach((item: any) => {
      // Парсим amount из формата "1.0000 A" или "1.0000"
      const amountStr = item.amount || '0'
      const amountMatch = amountStr.toString().match(/^(\d+\.?\d*)/)
      const amount = amountMatch ? parseFloat(amountMatch[1]) : 0
      
      const type = (item.type || '').toLowerCase()
      const existing = donorsMap.get(item.from_account) || { 
        total: 0, 
        count: 0,
        lights_count: 0,
        balls_count: 0,
        envelopes_count: 0,
        stars_count: 0
      }
      
      // Учитываем тип украшения
      if (type === 'light') {
        existing.lights_count += 1
      } else if (type === 'ball') {
        existing.balls_count += 1
      } else if (type === 'candle' || type === 'envelope') {
        existing.envelopes_count += 1
      } else if (type === 'star') {
        existing.stars_count += 1
      }
      
      donorsMap.set(item.from_account, {
        total: existing.total + amount,
        count: existing.count + 1,
        lights_count: existing.lights_count,
        balls_count: existing.balls_count,
        envelopes_count: existing.envelopes_count,
        stars_count: existing.stars_count
      })
    })

    const result = Array.from(donorsMap.entries())
      .map(([from_account, stats]) => ({
        from_account,
        total_amount: stats.total,
        count: stats.count,
        lights_count: stats.lights_count,
        balls_count: stats.balls_count,
        envelopes_count: stats.envelopes_count,
        stars_count: stats.stars_count
      }))
      // Сортируем по total_amount (lights уже учитываются в сумме, так как каждый light = 0.2 A)
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, limit)
    
    console.log(`✅ [DB] Calculated ${result.length} top donors`)
    console.log('Top donors calculated:', result.map(d => ({
      account: d.from_account,
      total: d.total_amount.toFixed(4),
      lights: d.lights_count,
      balls: d.balls_count,
      postcards: d.envelopes_count,
      stars: d.stars_count
    })))
    return result
  } catch (error) {
    console.error('❌ [DB] Error calculating top donors: ' + String(error))
    return []
  }
}

export async function getLastProcessedTxId(): Promise<string | null> {
  try {
    const { data } = await supabase.from('parser_state').select('last_tx_id').eq('id', 1).single()
    return data?.last_tx_id || null
  } catch (error) {
    console.error('❌ [DB] Error getting last processed tx_id: ' + String(error))
    return null
  }
}

export async function setLastProcessedTxId(txId: string): Promise<void> {
  try {
    await supabase.from('parser_state').upsert({ id: 1, last_tx_id: txId })
    console.log(`✅ [DB] Updated last processed tx_id: ${txId.substring(0, 8)}...`)
  } catch (error) {
    console.error('❌ [DB] Error setting last processed tx_id: ' + String(error))
  }
}

export { supabase }


