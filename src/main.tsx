import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'

// 註冊 Service Worker，讓手機把網站當成可安裝的 App（只在正式網站，本機開發不用）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 註冊失敗也不影響網站使用
    })
  })
}

// 像 App 一樣：不能用兩指放大縮小（iPhone 的 Safari 會忽略 viewport 設定，所以另外擋）
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
