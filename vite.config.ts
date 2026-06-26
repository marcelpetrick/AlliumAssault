import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: {
      '@core': '/src/core',
      '@presentation': '/src/presentation',
      '@persistence': '/src/persistence',
      '@workers': '/src/workers',
      '@data': '/data',
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          dexie: ['dexie'],
        },
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Allium Assault',
        short_name: 'AlliumAssault',
        description: 'Turn-based 2D artillery game with garlic clove characters',
        theme_color: '#1a0a2e',
        background_color: '#1a0a2e',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ogg,mp3,wav}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache' },
          },
        ],
      },
    }),
  ],
});
