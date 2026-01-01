import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Read server port from file (written by server on startup)
function getServerPort(): number {
  const portFilePath = path.resolve(__dirname, '.server-port');
  try {
    if (fs.existsSync(portFilePath)) {
      const port = parseInt(fs.readFileSync(portFilePath, 'utf-8').trim(), 10);
      if (!isNaN(port)) {
        return port;
      }
    }
  } catch {
    // Fall back to default
  }
  return 3003;
}

const serverPort = getServerPort();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
      },
      '/media': {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
      },
    },
  },
});
