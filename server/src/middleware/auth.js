import mongoose from 'mongoose';
import User from '../models/User.js';
import { readSession } from '../services/session.js';

// The hash is loaded so account pages can tell password accounts from Google-only ones; it is never serialised.
// Identity always comes from the verified token, never from the request body or params.
export async function requireAuth(req, res, next) {
  const id = readSession(req);
  const user = id && mongoose.isValidObjectId(id) ? await User.findById(id).select('+passwordHash') : null;
  if (!user) return res.status(401).json({ message: 'Please log in to continue.' });
  req.user = user;
  next();
}
