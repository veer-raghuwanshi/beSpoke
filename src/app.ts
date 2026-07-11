import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorHandler } from './middleware/error-handler.js';
import { requestAudit } from './middleware/request-audit.js';
import { dropRouter } from './routes/drop.routes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const app = express();
// Allows the API console to call localhost even when index.html is opened as file://.
app.use(cors());
app.use(express.json());
app.use(requestAudit);
app.use(express.static(path.join(root, 'public')));
app.use('/v1', dropRouter);
app.get('/openapi.yaml', (_req, res) => res.sendFile(path.join(root, 'swagger.yaml')));
app.use(errorHandler);
