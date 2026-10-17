import mongoose from 'mongoose';
import { env } from './env.js';

export const dbState = () => (!env.mongoUri ? 'not-configured' : mongoose.connection.readyState === 1 ? 'connected' : 'disconnected');

export async function connectDb() {
  if (!env.mongoUri) {
    console.warn('MONGODB_URI not set: running without a database (login and registration are disabled).');
    return;
  }
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  } catch (err) {
    // Never echo the connection string (it contains the password).
    const safe = String(err.message).replaceAll(env.mongoUri, '[redacted]').replace(/:\/\/[^@\s]*@/g, '://[redacted]@');
    throw new Error(`MongoDB connection failed: ${safe}`);
  }
  console.log(`MongoDB connected (database: ${mongoose.connection.name})`);
}
