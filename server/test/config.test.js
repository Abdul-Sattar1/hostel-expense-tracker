import { test } from 'node:test';
import assert from 'node:assert/strict';

test('production refuses to start without MONGODB_URI and JWT_SECRET, and rejects a short secret', async () => {
  process.env.NODE_ENV = 'production';
  delete process.env.MONGODB_URI;
  delete process.env.JWT_SECRET;
  const { assertConfig, env } = await import('../src/config/env.js');
  assert.throws(() => assertConfig(), /MONGODB_URI is required[\s\S]*JWT_SECRET is required/);
  env.mongoUri = 'mongodb+srv://u:p@h/db';
  env.jwtSecret = 'short';
  assert.throws(() => assertConfig(), (e) => /at least 32/.test(e.message) && !/short|mongodb\+srv/.test(e.message));
  env.jwtSecret = 'x'.repeat(32);
  assert.doesNotThrow(() => assertConfig());
});
