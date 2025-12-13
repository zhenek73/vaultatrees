export type DecorationType = 'light' | 'ball' | 'candle' | 'envelope' | 'gift' | 'star'

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

export interface TopDonor {
  from_account: string
  total_amount: number
  count: number
}

