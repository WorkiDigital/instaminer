import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isDev = process.env.NODE_ENV !== 'production'

export default defineConfig(async () => ({
  plugins: [
    react(),
    // HTTPS local para OAuth callback funcionar em 127.0.0.1 durante dev
    ...(isDev ? [(await import('@vitejs/plugin-basic-ssl')).default()] : []),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    https: isDev ? {} : undefined,
  },
}))
