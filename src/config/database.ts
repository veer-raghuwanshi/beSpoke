import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDatabase() {
  await mongoose.connect(config.mongoUri);
}
export { mongoose };
