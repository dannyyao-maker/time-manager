// Service Worker（在背景幫網站處理請求的小程式）
// 這裡刻意「不快取」也「不攔截」任何請求：每次都直接向網路拿最新版本，
// 避免手機上卡在舊版網站。它存在的目的只是讓瀏覽器把網站當成可安裝的 App。

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
