import { Router } from 'express';
import { ordersController } from './orders.controller';
import { requireAuth } from '../../middleware/auth.middleware';

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.post('/', (req, res, next) => ordersController.create(req, res, next));
ordersRouter.get('/', (req, res, next) => ordersController.list(req, res, next));
ordersRouter.get('/:id', (req, res, next) => ordersController.getById(req, res, next));
ordersRouter.patch('/:id/pay', (req, res, next) => ordersController.pay(req, res, next));
ordersRouter.patch('/:id/cancel', (req, res, next) => ordersController.cancel(req, res, next));
