import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

process.env.NODE_ENV = 'test';
dotenv.config({ path: path.join(projectRoot, '.env.test'), quiet: true });
dotenv.config({ path: path.join(projectRoot, '.env'), quiet: true });

export function getTestMongoUri() {
  const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGODB_URI_TEST;
  if (!mongoUri) {
    throw new Error('Configurá MONGO_URI_TEST o MONGODB_URI_TEST para ejecutar los tests.');
  }

  let parsedUri;
  try {
    parsedUri = new URL(mongoUri);
  } catch {
    throw new Error('La URI de testing debe ser una URL válida.');
  }

  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'mongo']);
  if (!allowedHosts.has(parsedUri.hostname.toLowerCase())) {
    throw new Error('Los tests destructivos solo pueden conectarse a MongoDB local.');
  }

  const databaseName = decodeURIComponent(parsedUri.pathname.replace(/^\/+/, '').split('/')[0] || '');
  if (!/(^|[-_])test($|[-_])/i.test(databaseName)) {
    throw new Error('La base de testing debe tener "test" en el nombre.');
  }

  return mongoUri;
}

export async function connectTestDatabase() {
  return mongoose.connect(getTestMongoUri());
}

export async function disconnectTestDatabase({ dropDatabase = false } = {}) {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  try {
    if (dropDatabase) {
      await mongoose.connection.db.dropDatabase();
    }
  } finally {
    await mongoose.disconnect();
  }
}
