import axios from 'axios'
import { config } from './config.js'
import { EOSTransfer, Decoration, DecorationType } from './types.js'
import { insertDecoration, initTxCache, checkExistingTxIds } from './database.js'

// ВРЕМЕННЫЙ ФЛАГ ДЛЯ ПОЛНОГО РЕПРОЦЕССИНГА
// После одного успешного запуска поставь false и перезапусти бекенд
export const FORCE_REPROCESS_ALL = false

let lastProcessedBlock = 0
let isPolling = false

// Vaulta native token A, contract core.vaulta (2025)
// Поддерживаемые контракты для переводов (core.vaulta для A токена)
// Используем контракты из конфига

async function fetchTransfers(limit: number = 100): Promise<EOSTransfer[]> {
  try {
    const supportedContracts = config.eos.contracts
    console.log(`🔍 [Vaulta] Fetching transfers from ${config.eos.hyperionApiUrl}...`)
    console.log(`   Supported contracts: ${supportedContracts.join(', ')}`)
    console.log(`   Account: ${config.eos.account}`)
    
    // Делаем один запрос для всех переводов, затем фильтруем по поддерживаемым контрактам
    // Vaulta native token A, contract core.vaulta (2025)
    // Фильтруем по поддерживаемым контрактам (core.vaulta для A токена)
    const response = await axios.get(`${config.eos.hyperionApiUrl}/history/get_actions`, {
      params: {
        account: config.eos.account,
        act_name: 'transfer',
        limit: limit * 2, // Берем больше, чтобы отфильтровать нужные контракты
        skip: 0,
        sort: 'desc'
      },
      timeout: 15000
    })

    const transfers: EOSTransfer[] = []
    const seenTxIds = new Set<string>() // Для дедупликации
    
    // Обрабатываем результаты и фильтруем по поддерживаемым контрактам
    if (response.data?.actions) {
      for (const action of response.data.actions) {
        if (action.act?.name === 'transfer' && action.act?.data) {
          const data = action.act.data
          const contract = action.act?.account
          
          // OR условие: проверяем, что контракт в списке поддерживаемых
              // Vaulta native token A, contract core.vaulta (2025)
          if (data.to === config.eos.account && 
              contract && supportedContracts.includes(contract)) {
              
              const txId = action.trx_id || action.action_trace?.trx_id || ''
              
              // Пропускаем дубликаты
              if (txId && seenTxIds.has(txId)) {
                continue
              }
              seenTxIds.add(txId)
              
              // Парсим amount из data.quantity (Vaulta A token, contract core.vaulta)
              const quantity = data.quantity || '0.0000 A'
              
              transfers.push({
                from: data.from || contract || '',
                to: data.to,
                quantity: quantity,
                memo: data.memo || '',
                trx_id: txId,
                block_time: action['@timestamp'] || action.block_time || new Date().toISOString(),
                contract: contract  // сохраняем контракт для определения токена
              })
              
              console.log(`📥 [Vaulta] Found transfer from ${contract}: ${quantity} from ${data.from}, memo: "${data.memo}"`)
          }
        }
      }
    }

    // Сортируем по времени (новые сначала)
    transfers.sort((a, b) => new Date(b.block_time).getTime() - new Date(a.block_time).getTime())

    console.log(`✅ [Vaulta] Found ${transfers.length} transfers from ${supportedContracts.join(' and ')}`)
    return transfers
  } catch (error: any) {
    console.error('❌ [Vaulta] Error fetching transfers: ' + error.message)
    if (error.response) {
      console.error('   Response status: ' + String(error.response.status))
      console.error('   Response data: ' + JSON.stringify(error.response.data).substring(0, 200))
    }
    return []
  }
}

// Новая логика: парсинг по точной сумме перевода A (Vaulta native token) на newyeartrees
function parseTransfer(transfer: EOSTransfer): { type: DecorationType | null; count?: number; username?: string; text?: string } {
  // Vaulta native token A, contract core.vaulta (2025)
  // Парсим amount из формата "0.2000 A" или "2.0000 A" или "20.0000 A" и т.д.
  // A токен имеет precision 4
  const amountMatch = transfer.quantity.match(/^(\d+\.?\d*)\s*(?:EOS|A)?/i)
  if (!amountMatch) {
    return { type: null }
  }
  
  const amount = parseFloat(amountMatch[1])
  const memo = transfer.memo?.trim() || ''
  
  // Ровно 0.2 → 1 огонёк (light)
  if (Math.abs(amount - 0.2) < 0.0001) {
    return { 
      type: 'light', 
      count: 1 
    }
  }
  
  // Ровно 2 → шарик (ball)
  if (Math.abs(amount - 2) < 0.0001) {
    return { 
      type: 'ball', 
      username: transfer.from 
    }
  }
  
  // Ровно 20 → свеча/открытка (candle, текст из memo до 200 символов)
  if (Math.abs(amount - 20) < 0.0001) {
    return { 
      type: 'candle', 
      text: memo ? memo.substring(0, 200) : undefined 
    }
  }
  
  // ≥1 → участие в аукционе звезды (type = 'star')
  if (amount >= 1) {
    return { 
      type: 'star',
      username: transfer.from
    }
  }
  
  // Любая другая сумма не соответствует ни одному типу украшения
  return { type: null }
}

async function processTransfer(transfer: EOSTransfer): Promise<void> {
  console.log(`🔄 [Vaulta] Processing transfer: ${transfer.trx_id.substring(0, 8)}... from ${transfer.from}, amount: ${transfer.quantity}, memo: "${transfer.memo}"`)
  
  // Пропускаем тестовые/ботовые переводы — они НЕ должны попадать на ёлку
  // if (transfer.from === 'cryptozhenek' || transfer.from === 'bot1pr.pcash') {
  //   console.log(`⏭️ [Vaulta] Skipping test/bot transfer from ${transfer.from} (amount: ${transfer.quantity}, tx: ${transfer.trx_id.substring(0, 8)}...)`)
  //   return
  // }
  
  const parsed = parseTransfer(transfer)

  if (!parsed.type) {
    console.log(`⏭️  [Vaulta] Skipping transfer: amount ${transfer.quantity} doesn't match any decoration type`)
    return
  }
  
  console.log(`✅ [Vaulta] Parsed transfer as type: ${parsed.type} (amount: ${transfer.quantity})`)
  console.log('Parsed decoration:', { type: parsed.type, amount: transfer.quantity, from: transfer.from })

  // Vaulta native token A, contract core.vaulta (2025)
  // Парсим amount из quantity (формат "0.2000 A" или "2.0000 A" и т.д.)
  const amountStr = transfer.quantity.split(' ')[0]
  const amount = parseFloat(amountStr)
  
  // A токен имеет precision 4
  const precision = amountStr.includes('.') ? amountStr.split('.')[1].length : 4
  
  // Vaulta native token A, contract core.vaulta (2025)
  // Определяем токен по контракту: только core.vaulta = A
  const token = transfer.contract === 'core.vaulta' ? 'A' : undefined
  
  // Для звезды создаём одну запись с полной суммой
  if (parsed.type === 'star') {
    const decoration: Decoration = {
      type: 'star',
      from_account: transfer.from,
      username: parsed.username || transfer.from || undefined,
      text: undefined,
      amount: amount.toFixed(precision),
      tx_id: transfer.trx_id,
      image_url: token  // Vaulta native token A
    }

    const inserted = await insertDecoration(decoration, FORCE_REPROCESS_ALL)
    
    if (inserted) {
      console.log(`⭐ [Vaulta] Created star decoration from transfer (amount: ${amount.toFixed(precision)} A)`)
    }
    return  // Завершаем функцию после создания звезды, чтобы не создавать лишние записи
  }

  // Для огоньков создаём одну запись (0.2 → 1 огонёк)
  const count = parsed.type === 'light' ? (parsed.count || 1) : 1
  
  for (let i = 0; i < count; i++) {
    const decoration: Decoration = {
      type: parsed.type.toLowerCase() as DecorationType,
      from_account: transfer.from,
      username: parsed.username || undefined,
      text: parsed.type === 'candle' ? (parsed.text || undefined) : undefined,
      amount: amount.toFixed(precision),
      tx_id: transfer.trx_id,
      image_url: token  // Vaulta native token A
    }

    const inserted = await insertDecoration(decoration, FORCE_REPROCESS_ALL)
    
    if (inserted) {
      // Decoration inserted, Realtime will notify clients via postgres_changes
    }
  }
  
  if (count > 1) {
    console.log(`✨ [Vaulta] Created ${count} lights from single transfer`)
  }
}

export async function startParser(): Promise<void> {
  if (isPolling) {
    console.log('⚠️  Parser already running')
    return
  }

  isPolling = true
  console.log('🚀 Starting Vaulta transaction parser...')
  console.log(`🎄 Tracking contract: ${config.eos.account}`)
  console.log(`💰 Token contract: ${config.eos.contracts.join(', ')} (token A)`)
  console.log(`   Hyperion API: ${config.eos.hyperionApiUrl}`)
  // ✅ Инициализируем in-memory кеш перед началом работы
  await initTxCache()

  // Начальная загрузка последних транзакций
  await pollTransactions()

  // Опрос каждые 10 секунд
  setInterval(async () => {
    await pollTransactions()
  }, 10000)
}

async function pollTransactions(): Promise<void> {
  try {
    console.log(`🔄 [Vaulta] Polling for new transactions...`)
    const transfers = await fetchTransfers(100)
    
    if (transfers.length === 0) {
      console.log(`📭 [Vaulta] No new transfers found`)
      return
    }

    // ✅ ВРЕМЕННО: если FORCE_REPROCESS_ALL = true, пропускаем проверку дубликатов
    let existingTxIds: Set<string>
    
    if (FORCE_REPROCESS_ALL) {
      console.log('🔥 [Vaulta] FORCE_REPROCESS_ALL = true — игнорируем дедупликацию, обрабатываем ВСЕ транзакции как новые')
      existingTxIds = new Set<string>()  // пустой сет → всё считается новым
    } else {
      console.log(`📥 [Vaulta] Found ${transfers.length} transfer(s), filtering duplicates...`)
      // ✅ Batch-проверка: получаем все tx_id из текущего batch
      const txIds = transfers.map(t => t.trx_id)
      existingTxIds = await checkExistingTxIds(txIds)
    }
    
    // ✅ Фильтруем только новые транзакции
    const newTransfers = transfers.filter(t => !existingTxIds.has(t.trx_id))
    
    if (newTransfers.length === 0 && !FORCE_REPROCESS_ALL) {
      console.log(`⏭️  [Vaulta] All transfers already processed (${transfers.length} duplicates)`)
      return
    }

    if (FORCE_REPROCESS_ALL) {
      console.log(`🔄 [Vaulta] Processing ALL ${newTransfers.length} transfers (deduplication disabled)`)
    } else {
      console.log(`📥 [Vaulta] Processing ${newTransfers.length} new transfers (filtered ${transfers.length - newTransfers.length} duplicates)`)
    }
    // Обрабатываем в обратном порядке (старые сначала)
    let processed = 0
    for (const transfer of newTransfers.reverse()) {
      await processTransfer(transfer)
      processed++
    }
    console.log(`✅ [Vaulta] Processed ${processed} new transfers`)
  } catch (error: any) {
    console.error('❌ [Vaulta] Error in pollTransactions: ' + error.message)
  }
}

export async function getLatestTransfers(count: number = 10): Promise<EOSTransfer[]> {
  return await fetchTransfers(count)
}