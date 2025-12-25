import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  },
  
  eos: {
    // Vaulta native token A, contract core.vaulta (2025)
    // Default contracts: core.vaulta for A token
    contracts: (process.env.EOS_CONTRACTS || 'core.vaulta').split(',').map((c: string) => c.trim()),
    account: process.env.EOS_ACCOUNT || 'newyeartrees',
    hyperionApiUrl: process.env.HYPERION_API_URL || 'https://eos.hyperion.eosrio.io/v2'
  }
}

// Проверка обязательных переменных
if (!config.supabase.url || !config.supabase.anonKey) {
  console.warn('⚠️  WARNING: SUPABASE_URL or SUPABASE_ANON_KEY not set!')
  console.warn('   Create .env file with these variables')
}


