# BeSpoke Drops API

A small REST API for scarce, scheduled fashion drops. The design optimizes for correctness at the inventory and wallet boundary, not for a broad feature set.

## Run it

Prerequisites: Node 20+ and Docker.

```sh
docker compose up -d
npm install
Copy-Item .env.example .env       # PowerShell; optional defaults already work
npm run seed
npm run dev
```

The replica set is intentional: MongoDB transactions require it. The API starts at `http://localhost:3000`; a compact OpenAPI document is at `/openapi.json`.

Try a claim (replace `DROP_ID` with the seed output):

```sh
curl -X POST http://localhost:3000/v1/drops/DROP_ID/claims -H "x-user-id: alice" -H "Idempotency-Key: alice-1" -H "Content-Type: application/json" -d '{"quantity":2}'
curl -X POST http://localhost:3000/v1/holds/HOLD_ID/confirm -H "x-user-id: alice"
curl http://localhost:3000/v1/me -H "x-user-id: alice"
```

To create a drop use `POST /v1/admin/drops` with header `x-admin-key: dev-admin` and `{item,totalStock,liveAt,price,maxPerUser}`. Authentication is deliberately a stub.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/admin/drops` | Create a scheduled drop |
| GET | `/v1/drops/:dropId` | Read availability and configuration |
| POST | `/v1/drops/:dropId/claims` | Reserve quantity; requires `Idempotency-Key` |
| POST | `/v1/holds/:holdId/confirm` | Charge wallet and make purchase |
| DELETE | `/v1/holds/:holdId` | Cancel active hold |
| POST | `/v1/drops/:dropId/waitlist` | Join the sold-out FIFO waitlist |
| GET | `/v1/me` | Wallet, holds, and purchases |

## Data model and invariants

`Drop.available` is the immediately claimable stock. `Hold` is an immutable-ish state record (`ACTIVE → CONFIRMED|EXPIRED|CANCELLED`); `Purchase` has a unique `holdId`; `Wallet` owns the balance. `Allocation` is the per-user-per-drop counter for held and purchased units, which enforces the limit across multiple holds. `Waitlist` has an indexed FIFO sequence and one row per user/drop.

Every state transition that could lose inventory or money is a Mongo transaction using majority writes:

- A claim conditionally decrements `available`, increments the allocation, and creates the hold together.
- Confirmation conditionally debits sufficient wallet balance, transitions the active/unexpired hold, moves allocation from held to purchased, and inserts the one purchase together.
- Cancellation/expiry conditionally transitions the hold and returns precisely its units.

Mongo automatically retries transient transaction conflicts. The conditional stock/wallet updates are still present so a retry cannot oversell or overdraft. This means a thousand simultaneous claims may produce conflicts/retries, but never negative stock. The primary `Drop` document is a deliberate contention point for a single limited drop; for substantially higher scale I would shard by drop and consider a queue/admission layer, while preserving this transactional reservation boundary.

## Retries, expiry, and restarts

Claims require an idempotency key, unique per `(drop,user,key)`. Repeating it returns the original hold; changing the quantity returns `409`. Confirmation is naturally idempotent because it first returns the unique purchase for that hold. A failed debit leaves the hold active until expiry.

Expiry is not an in-process timer. On startup and every five seconds the reconciler finds expired active holds, releases each in a transaction, and then drains waitlists. Thus a process can die after any committed transaction and resume safely; no funds or stock are stranded permanently. Reconciliation is intentionally idempotent and may run in multiple processes.

The brief does not specify a waitlist quantity, so this implementation makes the explicit choice that promotion automatically grants a **one-unit hold** in ascending `(sequence, created)` FIFO order. Entries that already reached their cap are marked skipped. A promotion is transactional and has the normal hold TTL. The sequence currently combines clock time and a random suffix; a production version would use a database sequence or a monotonic enqueue service for a globally auditable order.

## Tests

`npm test` runs the transaction integration tests when `MONGODB_URI` points to the Docker replica set. They exercise the two important races: many concurrent claims cannot exceed stock, and repeated confirmation charges only once. Set the environment variable explicitly if your shell does not load `.env`:

```sh
$env:MONGODB_URI='mongodb://localhost:27017/bespoke_test?replicaSet=rs0'; npm test
```

## Known limitations / next steps

- Admin auth, input rate limiting, observability, and a durable outbox/audit ledger are intentionally outside the exercise.
- The reconciler polls; at large scale I would use a lease-protected worker and change streams/scheduled jobs, while retaining a periodic repair scan.
- BSON transactions require a healthy replica set. A multi-region deployment needs careful write-region placement and an explicit latency/admission strategy.
- Monetary BSP amounts are integers. If BSP supports fractions, store the smallest indivisible unit instead of floating point.
