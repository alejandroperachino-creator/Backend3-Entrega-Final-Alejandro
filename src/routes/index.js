import { Router } from 'express';
import usersRouter from './users.js';
import productsRouter from './products.js';
import ordersRouter from './orders.js';
import deliveriesRouter from './deliveries.js';
import mocksRouter from './mocks.js';
import loggerRouter from './loggerRouter.js';
import config from '../config/env.config.js';

const router = Router();

router.use('/users', usersRouter);
router.use('/products', productsRouter);
router.use('/orders', ordersRouter);
router.use('/deliveries', deliveriesRouter);
if (config.internalRoutesEnabled) {
    router.use('/mocks', mocksRouter);
    router.use('/logger', loggerRouter);
}

export default router;
