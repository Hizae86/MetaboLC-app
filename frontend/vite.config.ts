import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Local dev only: lets the frontend call the API as a same-origin
    // relative path ("/api/...") instead of a hardcoded absolute URL, so
    // Vite forwards it to the FastAPI backend running on :8000. Production
    // (Vercel) ignores this entirely — it sets VITE_API_URL at build time.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
})
