import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || ''
  },
  
  eos: {
    contract: process.env.EOS_CONTRACT || 'malinka.token',
    account: process.env.EOS_ACCOUNT || 'malinkatrees',
    hyperionApiUrl: process.env.HYPERION_API_URL || 'https://eos.hyperion.eosrio.io/v2'
  }
}

// Проверка обязательных переменных
if (!config.supabase.url || !config.supabase.anonKey) {
  console.warn('⚠️  WARNING: SUPABASE_URL or SUPABASE_ANON_KEY not set!')
  console.warn('   Create .env file with these variables')
}

