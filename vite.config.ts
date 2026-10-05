import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import express from 'express';
import { apiRouter } from './server/apiRouter.ts';

function apiServerPlugin(): Plugin {
  return {
    name: 'api-server-plugin',
    configureServer(server) {
      const app = express();
      app.use(express.json({ limit: '30mb' }));
      app.use('/api', apiRouter);

      // Prevent unhandled /api calls from falling through to Vite's SPA index.html
      app.use('/api', (req, res) => {
        res.status(404).json({
          error: `API route not found: ${req.method} ${req.originalUrl || req.url}`,
          isQuotaExceeded: false,
        });
      });

      // API Express Error Handler
      app.use((err: any, req: any, res: any, next: any) => {
        console.error("API Express Handler caught error:", err);
        if (res.headersSent) {
          return next(err);
        }
        res.status(err.status || 500).json({
          error: err.message || "Internal server error occurred.",
          isQuotaExceeded: false,
        });
      });

      server.middlewares.use(app);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

