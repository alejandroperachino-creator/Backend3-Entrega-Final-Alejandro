import express from 'express';
import cors from 'cors';
import apiRouter from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { routeNotFoundHandler } from './middlewares/routeNotFoundHandler.js';
import { httpLogger } from './middlewares/httpLogger.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import config from './config/env.config.js';

const app = express();
const startTime = Date.now();

app.use(cors({
  origin: (origin, callback) => callback(null, origin === config.clientUrl)
}));
app.use(express.json({ limit: config.requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.requestBodyLimit }));
app.use(httpLogger);
if (config.swaggerEnabled) {
  const swaggerSetup = swaggerUi.setup(swaggerSpec);
  app.use('/api-docs', swaggerUi.serve, swaggerSetup);
  app.use('/api/docs', swaggerUi.serve, swaggerSetup);
}


app.use('/api', apiRouter);

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Consultar el estado de salud de la API
 *     tags: ["Health"]
 *     responses:
 *       200:
 *         description: Estado operativo y métricas básicas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/HealthResponse"
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: config.nodeEnv,
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString()
  });
});

app.use(routeNotFoundHandler);
app.use(errorHandler);

export default app;
