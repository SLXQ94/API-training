import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'wallpaper.svg', 'apple-touch-icon.png'],
      workbox: {
        // Install all local 64px sheets in the background with the app's service
        // worker. Workbox revisions changed files and does not set an expiry.
        globPatterns: ['**/*.{js,css,html,webp}'],
      },
      manifest: {
        name: 'Classroom Chat',
        short_name: 'Chat',
        description: 'Classroom chat for your class',
        theme_color: '#ffffff',
        background_color: '#161717',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
