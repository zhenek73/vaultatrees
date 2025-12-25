import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Session } from '@wharfkit/session'
import { sessionKit } from './index'

interface WalletContextType {
  session: Session | null
  isLoading: boolean
  login: () => Promise<void>
  logout: () => Promise<void>
  switchAccount: () => Promise<void>
  account: string | null
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Восстановление сессии при монтировании компонента
  useEffect(() => {
    async function restoreSession() {
      try {
        const restored = await sessionKit.restore()
        if (restored) {
          setSession(restored)
          console.log('✅ [Wallet] Session restored:', restored.actor.toString())
        }
      } catch (error) {
        console.error('❌ [Wallet] Error restoring session:', error)
      } finally {
        setIsLoading(false)
      }
    }
    restoreSession()
  }, [])

  // Логин через Anchor (QR или пуш после pairing)
  const login = async () => {
    try {
      setIsLoading(true)
      const response = await sessionKit.login()
      // Handle both response.session and direct session return
      const newSession = (response as any)?.session || response
      if (newSession) {
        setSession(newSession)
        console.log('✅ [Wallet] Logged in:', newSession.actor.toString())
      }
    } catch (error) {
      console.error('❌ [Wallet] Login error:', error)
      alert('Failed to connect wallet. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Выход из кошелька
  const logout = async () => {
    try {
      await sessionKit.logout()
      setSession(null)
      console.log('✅ [Wallet] Logged out')
    } catch (error) {
      console.error('❌ [Wallet] Logout error:', error)
    }
  }

  // Переключение аккаунта (logout + login)
  const switchAccount = async () => {
    try {
      setIsLoading(true)
      await logout()
      await login()
    } catch (error) {
      console.error('❌ [Wallet] Switch account error:', error)
      setIsLoading(false)
    }
  }

  const account = session?.actor?.toString() || null

  return (
    <WalletContext.Provider
      value={{
        session,
        isLoading,
        login,
        logout,
        switchAccount,
        account
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
