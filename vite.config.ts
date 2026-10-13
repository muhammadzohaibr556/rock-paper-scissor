import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Where the app is served from. GitHub Pages serves it at /<repo-name>/ (the deploy workflow sets
  // BASE_PATH); hosts that serve from the root, like Vercel or Netlify, need nothing.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  // TensorFlow.js is only imported on demand (by the gesture trainer). Pre-bundle it at startup so the
  // dev server doesn't discover it mid-session and reload the page in the middle of training.
  optimizeDeps: { include: ['@tensorflow/tfjs'] },
})
