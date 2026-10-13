import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // TensorFlow.js is only imported on demand (by the gesture trainer). Pre-bundle it at startup so the
  // dev server doesn't discover it mid-session and reload the page in the middle of training.
  optimizeDeps: { include: ['@tensorflow/tfjs'] },
})
