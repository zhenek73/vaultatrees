import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Безопасная инициализация Telegram Web App
if (typeof window !== 'undefined') {
  import('@twa-dev/sdk').then((WebApp) => {
    try {
      WebApp.default.ready()
      WebApp.default.expand()
    } catch (e) {
      console.log('Telegram Web App не доступен (запуск в браузере)')
    }
  }).catch(() => {
    // SDK недоступен - это нормально для браузера
  })
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found. Check index.html for <div id="root"></div>')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
