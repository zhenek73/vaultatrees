import { config } from './config.js'
import { startServer } from './server.js'

console.log('🎄 Vaulta Tree 2026 Backend Starting...')
console.log('')

// Проверка конфигурации
if (!config.supabase.url || !config.supabase.anonKey) {
  console.error('❌ ERROR: Supabase credentials not configured!')
  console.error('   Please create .env file with:')
  console.error('   SUPABASE_URL=your_url')
  console.error('   SUPABASE_ANON_KEY=your_key')
  console.error('')
  console.error('   See .env.example for reference')
  process.exit(1)
}

console.log('✅ Configuration loaded')
console.log(`🎄 Tracking contract: ${config.eos.account}`)
console.log(`💰 Token contract: ${config.eos.contracts.join(', ')} (token A)`)
console.log(`   Hyperion API: ${config.eos.hyperionApiUrl}`)
console.log('')

// Запуск сервера
startServer()
