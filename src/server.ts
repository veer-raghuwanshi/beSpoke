import { app } from './app.js';
import { connectDb } from './db.js';
import { config } from './config.js';
import { reconcile } from './services/drops.js';

await connectDb();
await reconcile();
setInterval(() => void reconcile().catch(err => console.error('reconcile failed', err)), config.reconcileIntervalMs).unref();
app.listen(config.port, () => console.log(`BeSpoke Drops listening on :${config.port}`));
