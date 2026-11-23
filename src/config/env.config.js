import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const DEFAULT_PORT = 3003;

const parseBoolean = (value, variableName, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') {
    throw new Error(`${variableName} debe ser true o false.`);
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`${variableName} debe ser true o false.`);
};

const parseUrl = (value, variableName) => {
  if (!value) {
    return '';
  }

  try {
    return new URL(value).toString();
  } catch (_error) {
    throw new Error(`${variableName} debe ser una URL válida.`);
  }
};

const parseOrigin = (value, variableName) => {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error();
    }

    return url.origin;
  } catch (_error) {
    throw new Error(`${variableName} debe ser un origen HTTP o HTTPS válido, sin ruta.`);
  }
};

const nodeEnv = process.env.NODE_ENV ?? 'development';
const portValue = process.env.PORT ?? String(DEFAULT_PORT);
const parsedPort = Number(portValue);
if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
  throw new Error('PORT debe ser un número entero entre 1 y 65535.');
}

const allowedNodeEnvs = ['development', 'test', 'production'];
if (!allowedNodeEnvs.includes(nodeEnv)) {
  throw new Error(`NODE_ENV invalido. Valores permitidos: ${allowedNodeEnvs.join(', ')}.`);
}

const defaultClientUrl = nodeEnv === 'production' ? '' : 'http://localhost:3000';
const clientUrl = parseOrigin(
  process.env.CLIENT_URL || defaultClientUrl,
  'CLIENT_URL'
);
if (nodeEnv === 'production' && !clientUrl) {
  throw new Error('CLIENT_URL es obligatorio en production.');
}

const requestBodyLimit = (process.env.REQUEST_BODY_LIMIT || '1mb').trim().toLowerCase();
if (!/^\d+(b|kb|mb|gb)$/i.test(requestBodyLimit)) {
  throw new Error('REQUEST_BODY_LIMIT debe ser un tamaño válido (ej: 100kb, 1mb, 2gb).');
}

const mongoUriFromEnv = nodeEnv === 'test'
  ? process.env.MONGO_URI_TEST || process.env.MONGODB_URI_TEST
  : process.env.MONGODB_URI;

if (!mongoUriFromEnv) {
  throw new Error(
    nodeEnv === 'test'
      ? 'MONGO_URI_TEST o MONGODB_URI_TEST es obligatorio en entorno test.'
      : 'MONGODB_URI es obligatorio para iniciar la aplicación.'
  );
}

const authRequired = parseBoolean(
  process.env.AUTH_REQUIRED,
  'AUTH_REQUIRED',
  nodeEnv === 'production'
);
const jwtSecret = process.env.JWT_SECRET || '';
if (nodeEnv === 'production' && !authRequired) {
  throw new Error('AUTH_REQUIRED no puede ser false en production.');
}

if (authRequired && !jwtSecret) {
  throw new Error('JWT_SECRET es obligatorio cuando AUTH_REQUIRED=true.');
}

const allowedLogLevels = ['fatal', 'error', 'warning', 'info', 'http', 'debug'];
const logLevel = (process.env.LOG_LEVEL || 'info').trim().toLowerCase();
if (!allowedLogLevels.includes(logLevel)) {
  throw new Error(`LOG_LEVEL invalido. Valores permitidos: ${allowedLogLevels.join(', ')}.`);
}

const requireReplicaSetTransactions = parseBoolean(
  process.env.REQUIRE_REPLICASET_TRANSACTIONS,
  'REQUIRE_REPLICASET_TRANSACTIONS',
  nodeEnv === 'production'
);

const internalRoutesEnabled = parseBoolean(
  process.env.INTERNAL_ROUTES_ENABLED,
  'INTERNAL_ROUTES_ENABLED',
  nodeEnv !== 'production'
);

const swaggerEnabled = parseBoolean(
  process.env.SWAGGER_ENABLED,
  'SWAGGER_ENABLED',
  nodeEnv !== 'production'
);

const uploadBaseDir = process.env.UPLOAD_BASE_DIR
  ? path.resolve(process.env.UPLOAD_BASE_DIR)
  : path.resolve(process.cwd(), '..', 'shipnow-uploads');

const config = Object.freeze({
  port: parsedPort,
  mongoUri: mongoUriFromEnv,
  environment: nodeEnv,
  nodeEnv,
  clientUrl,
  logLevel,
  requestBodyLimit,
  jwtSecret,
  authRequired,
  requireReplicaSetTransactions,
  internalRoutesEnabled,
  swaggerEnabled,
  uploadBaseDir,
  externalServiceBaseUrl: parseUrl(process.env.EXTERNAL_SERVICE_BASE_URL || '', 'EXTERNAL_SERVICE_BASE_URL')
});

export default config;