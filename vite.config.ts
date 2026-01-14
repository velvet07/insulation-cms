import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [
      'cms.emermedia.eu',
      'localhost',
      '127.0.0.1'
    ],
    hmr: {
      host: 'cms.emermedia.eu',
      protocol: 'wss'
    }
  }
});
