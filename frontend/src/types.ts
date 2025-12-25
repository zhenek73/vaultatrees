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
  createdAt?: number  // timestamp в ms для вау-эффекта (добавляется на клиенте)
}

export interface TopDonor {
  from_account: string
  total_amount: number
  count: number
  lights_count?: number
  balls_count?: number
  envelopes_count?: number
  stars_count?: number
}

