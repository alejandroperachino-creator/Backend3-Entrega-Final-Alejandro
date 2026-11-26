import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import User from '../../src/models/user.model.js';
import Order from '../../src/models/order.model.js';
import Delivery from '../../src/models/delivery.model.js';
import {
  connectTestDatabase,
  disconnectTestDatabase,
  getTestMongoUri
} from '../helpers/testDatabase.js';

getTestMongoUri();

const testUploadDirectory = mkdtempSync(path.join(tmpdir(), 'shipnow-functional-uploads-'));
process.env.UPLOAD_BASE_DIR = testUploadDirectory;

before(async () => {
  await connectTestDatabase();
});

beforeEach(async () => {
  await Promise.all([
    Delivery.deleteMany({}),
    Order.deleteMany({}),
    User.deleteMany({})
  ]);
});

after(async () => {
  try {
    await disconnectTestDatabase({ dropDatabase: true });
  } finally {
    await rm(testUploadDirectory, { recursive: true, force: true });
  }
});
