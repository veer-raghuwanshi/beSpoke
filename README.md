# BeSpoke Drops API

A small REST API for scarce, scheduled fashion drops. The design optimizes for correctness at the inventory and wallet boundary, not for a broad feature set.

## Run it

Prerequisites: Node 20+ and a MongoDB replica set (local or Atlas).

```sh
npm install
Copy-Item .env.example .env
# optional defaults already work
npm run seed
npm run dev
```

The replica set is intentional: MongoDB transactions require it. Set
`MONGODB_URI` in `.env` to your local or Atlas replica-set connection string.
The API starts at `http://localhost:3000`; the OpenAPI document is at
`/openapi.yaml`.

### Environment configuration

Create `.env` from `.env.example` before running the application:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/bespoke?replicaSet=rs0
MONGO_MAX_POOL_SIZE=20
HOLD_TTL_SECONDS=120
RECONCILE_INTERVAL_MS=5000
ADMIN_KEY=dev-admin
CORS_ORIGINS=http://localhost:3000
```

| Variable                | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `PORT`                  | HTTP server port                                              |
| `NODE_ENV`              | Runtime environment (`development` or `production`)           |
| `MONGODB_URI`           | MongoDB replica-set or Atlas connection string                |
| `MONGO_MAX_POOL_SIZE`   | Maximum number of MongoDB connections in the application pool |
| `HOLD_TTL_SECONDS`      | How long a stock reservation remains active                   |
| `RECONCILE_INTERVAL_MS` | How often expired holds and waitlists are reconciled          |
| `ADMIN_KEY`             | Required `x-admin-key` value for creating drops               |
| `CORS_ORIGINS`          | Comma-separated browser origins allowed in production         |

Never commit a real Atlas password or production `ADMIN_KEY`. Keep secrets in
your local `.env`; only `.env.example` belongs in the repository.

### Atlas setup

1. Create a MongoDB Atlas project and deploy a free M0 cluster.
2. In **Database & Network Access**, add **My Current IP Address**. Do not use
   `0.0.0.0/0` except as a short-lived local-development workaround.
3. In **Database & Database Access**, create a database user with a generated
   username and password. Give it `readWrite` access to the `bespoke` database
   (or use `readWriteAnyDatabase` only for this development exercise).
4. On the cluster page, select **Connect** → **Drivers** → **Node.js**, then
   copy the SRV connection string.
5. URL-encode the password if it contains special characters, then set the
   following value in `.env`:

   ```env
   MONGODB_URI=mongodb+srv://<username>:<encoded-password>@<cluster-host>/bespoke?retryWrites=true&w=majority
   ```

6. Run `npm run seed`, then `npm run dev`.

Atlas projects allow connections only from IP addresses in their access list,
and database users are separate from Atlas login users. The SRV string above is
the format Atlas provides for application drivers. See MongoDB's
[Atlas connection guide](https://www.mongodb.com/docs/atlas/driver-connection/)
for the current UI flow.

Try a claim (replace `DROP_ID` with the seed output):

```sh
curl -X POST http://localhost:3000/v1/drops/DROP_ID/claims -H "x-user-id: alice" -H "Idempotency-Key: alice-1" -H "Content-Type: application/json" -d '{"quantity":2}'
curl -X POST http://localhost:3000/v1/holds/HOLD_ID/confirm -H "x-user-id: alice"
curl http://localhost:3000/v1/me -H "x-user-id: alice"
```

To create a drop use `POST /v1/admin/drops` with header `x-admin-key: dev-admin` and `{item,totalStock,liveAt,price,maxPerUser}`. Authentication is deliberately a stub.

## Endpoints

| Method | Path                         | Purpose                                      |
| ------ | ---------------------------- | -------------------------------------------- |
| POST   | `/v1/admin/drops`            | Create a scheduled drop                      |
| GET    | `/v1/drops/:dropId`          | Read availability and configuration          |
| POST   | `/v1/drops/:dropId/claims`   | Reserve quantity; requires `Idempotency-Key` |
| POST   | `/v1/holds/:holdId/confirm`  | Charge wallet and make purchase              |
| DELETE | `/v1/holds/:holdId`          | Cancel active hold                           |
| POST   | `/v1/drops/:dropId/waitlist` | Join the sold-out FIFO waitlist              |
| GET    | `/v1/me`                     | Wallet, holds, and purchases                 |

## Project layout

`controllers` translate HTTP requests to use cases; `routes` bind URLs;
`services` own transaction and business rules; `repositories` form the
data-access boundary; `models` define Mongo schemas and indexes. `workers`
handle restart-safe expiry work, `validators` validate API input, and `public`
is a small browser API console served at `/`.

Run `npm run format` to apply the shared formatter.

## Production configuration

Set `NODE_ENV=production`, a strong `ADMIN_KEY`, a production MongoDB
replica-set URI, and explicit comma-separated `CORS_ORIGINS`. The server applies
security headers, disables Express fingerprinting, limits JSON requests to
32 KB, rate-limits `/v1` to 300 requests per minute per IP, emits structured
request logs, and exposes `GET /healthz` for readiness checks. It also closes
the HTTP server, reconciliation timer, and MongoDB connection cleanly on
`SIGINT` or `SIGTERM`.

## Data model and invariants

`Drop.available` is the immediately claimable stock. `Hold` records an active
reservation that becomes `CONFIRMED`, `EXPIRED`, or `CANCELLED`. `Purchase` has
a unique `holdId`; `Wallet` owns the balance. `Allocation` keeps a
per-user-per-drop count of held and purchased units, enforcing the user limit
across multiple holds. `Waitlist` has an indexed FIFO sequence and one row per
user/drop.

Every state transition that could lose inventory or money is a MongoDB
transaction with majority writes:

- A claim conditionally decrements `available`, increments allocation, and
  creates the hold together.
- Confirmation conditionally debits sufficient wallet balance, changes an
  active and unexpired hold to confirmed, updates allocation, and creates the
  purchase together.
- Cancellation or expiry changes the hold state and returns exactly its units.

MongoDB retries transient transaction conflicts. Conditional stock and wallet
updates are also retained, so a retry cannot oversell stock or overdraw a
wallet. A `Drop` document is intentionally a contention point for one limited
drop. At higher scale, the system could shard by drop and add an admission queue
while retaining this transactional reservation boundary.

## Retries, expiry, and restarts

Claims require an idempotency key, unique per `(drop, user, key)`. Repeating a
key returns the original hold; changing the quantity returns `409`.
Confirmation is idempotent because it first returns the unique purchase for the
hold. A failed wallet debit leaves the hold active until expiry.

Expiry is not an in-process timer. On startup and every five seconds, the
reconciler finds expired active holds, releases each in a transaction, and then
drains waitlists. A process can therefore stop after any committed transaction
and restart without permanently stranding stock or funds. Reconciliation is
idempotent and can run in more than one process.

The brief does not specify a waitlist quantity. This implementation deliberately
promotes users with a one-unit hold in ascending FIFO sequence order. Entries
that already reached their cap are marked skipped. Each promotion is
transactional and receives the normal hold TTL.

## Tests

`npm test` runs integration tests when `MONGODB_URI` points to a replica set.
The tests cover concurrent claims, idempotency, per-user limits, expiry,
repeated confirmation, insufficient balance, and FIFO waitlist promotion.

<!-- ```powershell
$env:MONGODB_URI='mongodb+srv://<username>:<encoded-password>@<cluster-host>/bespoke_test?retryWrites=true&w=majority'
$env:RUN_INTEGRATION_TESTS='true'
npm test
```

The guarded runner rejects a URI that does not use the dedicated
`bespoke_test` database:

```powershell
npm run test:integration -- -MongoUri 'mongodb+srv://<username>:<encoded-password>@<cluster-host>/bespoke_test?retryWrites=true&w=majority'
``` -->

### Load test

The HTTP load harness starts an isolated server using `bespoke_load_test`, seeds
wallets, sends simultaneous claims, reports latency, and fails unless exactly
the requested stock count succeeds. It cleans its generated records afterward.

<!-- ```powershell
npm run test:load -- -MongoUri 'mongodb+srv://<username>:<encoded-password>@<cluster-host>/bespoke_load_test?retryWrites=true&w=majority' -VirtualUsers 100 -Stock 20
``` -->

## Known limitations and next steps

- Admin authentication, input-specific rate limits, observability, and a durable
  outbox or audit ledger are outside this exercise.
- The reconciler polls. At larger scale, use a lease-protected worker and change
  streams or scheduled jobs while retaining a periodic repair scan.
- MongoDB transactions require a healthy replica set. A multi-region deployment
  needs deliberate write-region placement and an explicit latency strategy.
- BSP amounts are integers. If fractional BSP is required, store the smallest
  indivisible unit instead of floating-point values.
