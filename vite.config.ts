import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './', // pronto per GitHub Pages sotto /repo/
  server: { port: 5180, strictPort: true },
  build: { sourcemap: true }, // Lighthouse: valid-source-maps + debug prod
  plugins: [
    react(),
    VitePWA({
      // 'prompt' invece di 'autoUpdate' per dare il controllo all'utente via UpdatePrompt.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png'],
      manifest: {
        name: 'Mappa delle terrazze al sole',
        short_name: 'Terrazze al sole',
        description: 'Quali terrazze sono al sole adesso a Barcellona',
        lang: 'es',
        theme_color: '#f5a623',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['food', 'travel', 'lifestyle'],
        start_url: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Mi ubicación',
            short_name: 'Aquí',
            description: 'Centrar mapa en mi posición',
            url: './?action=locate',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'app-data' },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('openfreemap.org'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'tiles', expiration: { maxEntries: 500 } },
          },
        ],
      },
    }),
  ],
});
