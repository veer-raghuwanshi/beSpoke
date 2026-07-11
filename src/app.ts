import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mongoose } from './config/database.js';
import { config } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestAudit } from './middleware/request-audit.js';
import { dropRouter } from './routes/drop.routes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const app = express();

app.disable('x-powered-by');
app.use(requestAudit);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || (!config.isProduction && origin === 'null') || config.corsOrigins.includes(origin))
        return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS'));
    },
  })
);
app.use(express.json({ limit: '32kb', strict: true }));
app.use('/v1', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.static(path.join(root, 'public'), { maxAge: config.isProduction ? '1h' : 0 }));
app.get('/healthz', (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'unavailable' });
});
app.use('/v1', dropRouter);
app.get('/openapi.yaml', (_req, res) => res.sendFile(path.join(root, 'swagger.yaml')));
app.use(errorHandler);
