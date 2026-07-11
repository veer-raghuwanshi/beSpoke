import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorHandler } from './middleware/error-handler.js';
import { dropRouter } from './routes/drop.routes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const app = express();
app.use(express.json());
app.use('/v1', dropRouter);
app.get('/openapi.yaml', (_req, res) => res.sendFile(path.join(root, 'swagger.yaml')));
app.use(errorHandler);
