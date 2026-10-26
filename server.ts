import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import app from './server/app.js';

// AI Studio environment constraint: dev server must always run on port 3000
const PORT = 3000;

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(expressStaticFallback(distPath));
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Apex Medi Sales ERP Server listening on http://0.0.0.0:${PORT}`);
  });
}

function expressStaticFallback(distPath: string) {
  const router = express.Router();
  router.use(express.static(distPath));
  router.get('*', (_req: any, res: any) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
  return router;
}

startServer();
