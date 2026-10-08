import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), react()],
  // Relative asset URLs so the build works from any subpath — GitHub Pages
  // serves this repo at /CMSC128.2-AFP_HealthInfoSys/, not the domain root.
  // The app navigates via state rather than the URL, so no router base is needed.
  base: './',
  server: {
    proxy: {
      '/api': {
        target: loadEnv(mode, process.cwd(), '').BACKEND_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}))
