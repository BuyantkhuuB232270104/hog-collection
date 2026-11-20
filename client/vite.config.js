import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Хөгжүүлэлтийн үед /api хүсэлтийг Express сервер рүү дамжуулна
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': 'http://localhost:3000' } } });
