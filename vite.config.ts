import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'http-test' ? [] : [basicSsl()])],
  server: {
    host: mode === 'http-test' ? '127.0.0.1' : 'localhost',
    port: mode === 'http-test' ? 4174 : 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: ['index.html', 'oauth-callback.html'],
    },
  },
}))
