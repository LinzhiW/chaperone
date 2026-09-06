import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths. The desktop shell loads the built index.html straight
  // off disk over file://, where Vite's default absolute '/assets/…' resolves to
  // the filesystem root and every script and stylesheet 404s. Relative paths work
  // both under file:// and when served over http.
  base: './',
  server: { port: 5173 },
});
