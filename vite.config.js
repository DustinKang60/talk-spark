import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.webp'],
      manifest: {
        name: 'TalkSpark - 오늘의 대화거리',
        short_name: 'TalkSpark',
        description: '매일 뉴스에서 AI가 논쟁거리를 추출해 드립니다',
        start_url: '/',
        display: 'standalone',
        background_color: '#0d1a2e',
        theme_color: '#0d1a2e',
        lang: 'ko',
        icons: [
          {
            src: '/icons/icon-192.webp',
            sizes: '192x192',
            type: 'image/webp',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.webp',
            sizes: '512x512',
            type: 'image/webp',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webp,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/rss-dev': {
        target: 'https://news.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rss-dev/, '/rss'),
      },
      '/claude-api': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/claude-api/, ''),
      }
    }
  }
})
