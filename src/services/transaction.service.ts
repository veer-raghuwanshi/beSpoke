import { ClientSession, Types } from 'mongoose';
import { mongoose } from '../config/database.js';

export const toObjectId = (value: string) => new Types.ObjectId(value);
export const withTransaction = <T>(work: (session: ClientSession) => Promise<T>) =>
  mongoose.connection.transaction(work, {
    readPreference: 'primary',
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
  });
