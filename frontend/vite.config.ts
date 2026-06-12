import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    // Raise the chunk-size warning threshold (avoids noise; actual splitting is below)
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Vendor: React core (tiny, cached for life) ──────────────────
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }

          // ── Vendor: Routing ──────────────────────────────────────────────
          if (id.includes('node_modules/react-router') ||
              id.includes('node_modules/@remix-run/')) {
            return 'vendor-router';
          }

          // ── Vendor: State management ─────────────────────────────────────
          if (id.includes('node_modules/zustand')) {
            return 'vendor-state';
          }

          // ── Vendor: Animation (large — isolate so it's only downloaded
          //    when a page that uses motion is visited) ────────────────────
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }

          // ── Vendor: HTTP ─────────────────────────────────────────────────
          if (id.includes('node_modules/axios')) {
            return 'vendor-http';
          }

          // ── Vendor: Icons ────────────────────────────────────────────────
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }

          // ── App: Admin pages (heavy, only admin users ever load this) ────
          if (id.includes('/pages/admin/')) {
            return 'app-admin';
          }

          // ── App: User account pages ──────────────────────────────────────
          if (id.includes('/pages/user/')) {
            return 'app-account';
          }

          // ── App: Auth pages ──────────────────────────────────────────────
          if (id.includes('/pages/auth/')) {
            return 'app-auth';
          }

          // Everything else (Home, ProductListing, ProductDetail, Cart,
          // Checkout, shared components, stores, utils) stays in the
          // main bundle — it's what most users actually need on first load.
        },
      },
    },
  },

  server: {
    hmr: true,
    // Allow cloudflare tunnel + any local network IP
    allowedHosts: 'all',
  },
})