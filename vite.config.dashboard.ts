import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/dashboard/app'),
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, 'dist/dashboard'),
    emptyOutDir: true,
  },
  server: {
    open: true,
  },
});
