import { randomUUID } from 'node:crypto';
import { RequestHandler } from 'express';

export const requestAudit: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const startedAt = performance.now();

  res.setHeader('x-request-id', requestId);
  res.on('finish', () => {
    console.info(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId,
        clientIp: req.ip,
        userId: req.header('x-user-id') ?? 'anonymous',
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      })
    );
  });

  next();
};
