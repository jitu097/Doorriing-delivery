import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      // Extra static assets to precache beyond the build output
      includeAssets: ['Doorriing-delivery.png', 'Doorriing.png', 'icons/*.png'],

      // Only activate the service worker in production builds
      devOptions: { enabled: false },

      manifest: {
        name: 'Doorriing Admin & Delivery',
        short_name: 'Doorriing',
        description: 'Doorriing Admin Panel and Delivery Partner Dashboard',
        theme_color: '#FF6600',
        background_color: '#1a0a00',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        // Stable ID needed for TWA / bubblewrap matching
        id: 'com.doorriing.app',
        categories: ['business', 'productivity'],
        icons: [
          // Generated from public/Doorriing-delivery.png via `npm run pwa:icons`
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        // Precache all compiled assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp,jpg,jpeg}'],

        // SPA navigation fallback — serve index.html for all page navigations
        navigateFallback: '/index.html',
        // Never intercept API navigation requests with the fallback
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          // ── API calls → always go to the network, never cache ──────────
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          // ── Google Fonts (if added later) → long-lived cache ───────────
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // Remove caches left by outdated service worker versions
        cleanupOutdatedCaches: true,
      },
    }),
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          http:   ['axios'],
          date:   ['dayjs'],
        },
      },
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
