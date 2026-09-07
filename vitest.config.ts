import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ['module-sync', 'import', 'module', 'browser', 'default'] },
  ssr: { resolve: { conditions: ['module-sync', 'import', 'module', 'default'] } },
  test: { server: { deps: { inline: [/react-router/] } } },
})
