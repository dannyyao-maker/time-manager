import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 固定用 5173 port：Google 登入設定裡填的網址就是 http://localhost:5173
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
})
