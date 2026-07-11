import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDatabase() {
  await mongoose.connect(config.mongoUri, {
    maxPoolSize: config.mongoMaxPoolSize,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
  });
}
export { mongoose };
