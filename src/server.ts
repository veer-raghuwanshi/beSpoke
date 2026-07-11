import { app } from './app.js';
import { connectDatabase, mongoose } from './config/database.js';
import { config } from './config/env.js';
import { startReconciliationWorker } from './workers/reconciliation.worker.js';

try {
  await connectDatabase();
  const worker = await startReconciliationWorker();
  const server = app.listen(config.port, () => console.log(`BeSpoke Drops listening on :${config.port}`));

  const shutdown = async (signal: string) => {
    console.info(`${signal} received; shutting down gracefully`);
    worker.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
} catch (error) {
  console.error('Startup failed', error);
  process.exit(1);
}
