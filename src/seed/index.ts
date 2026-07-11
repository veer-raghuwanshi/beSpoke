import { connectDatabase, mongoose } from '../config/database.js';
import { Drop, Wallet } from '../repositories/drop.repository.js';

await connectDatabase();
await Promise.all([Drop.deleteMany({}), Wallet.deleteMany({})]);
const drop = await Drop.create({
  item: 'BeSpoke Midnight Bomber',
  totalStock: 5,
  available: 5,
  liveAt: new Date(Date.now() - 1000),
  price: 25,
  maxPerUser: 2,
});
await Wallet.insertMany([
  { userId: 'alice', balance: 100 },
  { userId: 'bob', balance: 30 },
  { userId: 'carol', balance: 100 },
]);
console.log(`Seeded live drop ${drop._id}; users: alice, bob, carol`);
await mongoose.disconnect();
