import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { assertConfig, env } from './config/env.js';

try {
  assertConfig();
  await connectDb();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
createApp().listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
