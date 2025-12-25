export type DecorationType = 'light' | 'ball' | 'candle' | 'star'

export interface Decoration {
  id?: number
  type: DecorationType
  from_account: string
  username?: string
  text?: string
  image_url?: string
  amount: string
  tx_id: string
  created_at?: string
}

export interface EOSTransfer {
  from: string
  to: string
  quantity: string
  memo: string
  trx_id: string
  block_time: string
  contract?: string  // Vaulta native token A, contract core.vaulta (2025)
}

