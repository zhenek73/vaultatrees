import { SessionKit } from '@wharfkit/session'
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor'
import { WebRenderer } from '@wharfkit/web-renderer'

// Стандартная конфигурация Wharfkit + Anchor (работает идеально на Vaulta 2025)
// Логин через QR → пуш транзакций в мобильный Anchor после pairing
const chainId = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'

export const sessionKit = new SessionKit({
  appName: 'Christmas Tree',
  chains: [
    {
      id: chainId,
      url: 'https://eos.greymass.com',
    },
  ],
  ui: new WebRenderer(),
  walletPlugins: [
    // Стандартная конфигурация без buoyUrl (WebSocket может блокироваться в Telegram WebView)
    // Транзакции будут через QR-код для каждой операции (стабильно работает)
    new WalletPluginAnchor()
  ],
})
