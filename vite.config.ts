import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/GPBR_3D_Model/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
