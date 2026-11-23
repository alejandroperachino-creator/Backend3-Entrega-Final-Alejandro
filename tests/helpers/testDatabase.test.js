import test from 'node:test';
import assert from 'node:assert/strict';
import { getTestMongoUri } from './testDatabase.js';

test('test database guard rejects remote MongoDB hosts', () => {
  const previousUri = process.env.MONGO_URI_TEST;
  process.env.MONGO_URI_TEST = 'mongodb+srv://example.mongodb.net/shipnow_test';

  try {
    assert.throws(getTestMongoUri, /MongoDB local/);
  } finally {
    if (previousUri === undefined) {
      delete process.env.MONGO_URI_TEST;
    } else {
      process.env.MONGO_URI_TEST = previousUri;
    }
  }
});

test('test database guard requires a database name containing test', () => {
  const previousUri = process.env.MONGO_URI_TEST;
  process.env.MONGO_URI_TEST = 'mongodb://127.0.0.1:27017/shipnow';

  try {
    assert.throws(getTestMongoUri, /tener "test" en el nombre/);
  } finally {
    if (previousUri === undefined) {
      delete process.env.MONGO_URI_TEST;
    } else {
      process.env.MONGO_URI_TEST = previousUri;
    }
  }
});
