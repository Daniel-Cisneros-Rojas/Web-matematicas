import express from 'express';
import cors from 'cors';
import { createDatabase } from './db/database';
import { createApi } from './routes/api';
import { DomainError } from './engine/fsm';

export function createApp(db: ReturnType<typeof createDatabase> = createDatabase()): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api', createApi(db));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof DomainError) return res.status(error.status).json({ error: error.message });
    console.error(error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  });
  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, '0.0.0.0', () => console.log(`API escuchando en el puerto ${port}`));
}
