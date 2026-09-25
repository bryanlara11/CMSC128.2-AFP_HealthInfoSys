import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the build works from any subpath — GitHub Pages
  // serves this repo at /CMSC128.2-AFP_HealthInfoSys/, not the domain root.
  // The app navigates via state rather than the URL, so no router base is needed.
  base: './',
})
