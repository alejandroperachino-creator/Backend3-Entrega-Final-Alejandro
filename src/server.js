import mongoose from 'mongoose';
import app from './app.js';
import config from './config/env.config.js';
import Logger from './utils/logger.js';
import { supportsTransactions } from './utils/mongoCapabilities.js';

const gracefulExit = (code) => {
  Logger.on("finish", () => process.exit(code));
  Logger.end();
};


async function startServer() {
  try {
    await mongoose.connect(config.mongoUri);
    Logger.info('Conectado a la base de datos MongoDB');
    const transactionsSupported = await supportsTransactions(mongoose.connection);
    if (!transactionsSupported && config.requireReplicaSetTransactions) {
      throw new Error('MongoDB no soporta transacciones. Configura replica set o mongos para iniciar en este entorno.');
    }

    if (!transactionsSupported) {
      Logger.warning('MongoDB conectado sin soporte de transacciones');
    }

    app.listen(config.port, () => {
      Logger.info('Servidor iniciado', { port: config.port, env: config.nodeEnv });
    });
  } catch (error) {
    Logger.error('Error al iniciar el servidor:', error.message);
    gracefulExit(1);
    return;
    
  }
}

startServer();

