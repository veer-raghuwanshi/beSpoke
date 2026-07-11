import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { config } from './config/env.js';
import { startReconciliationWorker } from './workers/reconciliation.worker.js';

await connectDatabase();
await startReconciliationWorker();
app.listen(config.port, () => console.log(`BeSpoke Drops listening on :${config.port}`));
