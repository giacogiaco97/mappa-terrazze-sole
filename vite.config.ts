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
      // 'autoUpdate' garantisce che gli utenti non restino bloccati su SW vecchi:
      // workbox skipWaiting+clientsClaim attivano il nuovo SW immediatamente.
      // UpdatePrompt ascolta controllerchange e mostra un toast per ricaricare la
      // pagina (così l'utente vede subito il nuovo content senza dover chiudere).
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png',
        'screenshots/mobile-1.png', 'screenshots/desktop-1.png',
      ],
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
        screenshots: [
          {
            src: 'screenshots/mobile-1.png',
            sizes: '414x896',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Mapa de terrazas al sol en Barcelona',
          },
          {
            src: 'screenshots/desktop-1.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Mapa de terrazas al sol en Barcelona (escritorio)',
          },
        ],
      },
      workbox: {
        // Forza il nuovo SW a prendere il controllo subito (evita utenti bloccati
        // su SW vecchi che non rispondono al messaggio SKIP_WAITING).
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
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
